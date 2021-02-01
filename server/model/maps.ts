import {
  Cell,
  Poster,
  Announcement,
  Point,
  PosDir,
  PosterId,
  RoomId,
  UserId,
  MapCellId,
  TryToMoveResult,
  MapCellRDB,
  Direction,
  PersonInMap,
  MapUpdateEntry,
  UserGroupId,
  RoomAccessCode,
  UserGroup,
} from "../../@types/types"
import shortid from "shortid"
import { redis, log, db, pgp, POSTGRES_CONNECTION_STRING } from "./index"
import * as model from "./index"
import _ from "lodash"
import {
  mkKey,
  calcDirection,
  isOpenCell,
  range,
  flatten,
} from "../../common/util"
import {
  getCellOpenFromString,
  getCellKindFromString,
  mkKindString,
} from "../../common/maps"
import cluster from "cluster"
import * as Posters from "./posters"
import { config } from "../config"
import { emit } from "../socket"
import { promisify } from "util"
import fs from "fs"
import path from "path"
import { random_str } from "./util"
const readFile = promisify(fs.readFile)

const USE_S3_CDN = config.aws.s3.via_cdn
const S3_BUCKET = config.aws.s3.bucket
const CDN_DOMAIN = config.aws.cloud_front.domain

function adjacentCells(
  cells: Cell[][],
  x: number,
  y: number,
  distance: number
): Cell[] {
  const rows = cells.length
  const cols = cells[0].length
  const ds: number[][] = []
  for (const dx of _.range(-distance, distance + 1)) {
    for (const dy of _.range(-distance, distance + 1)) {
      if (dx != 0 || dy != 0) {
        ds.push([x + dx, y + dy])
      }
    }
  }
  return ds
    .filter(([x_, y_]) => {
      return 0 <= x_ && x_ < cols && 0 <= y_ && y_ < rows
    })
    .map(([x_, y_]) => {
      return cells[y_][x_]
    })
}

async function setRedisPeoplePosition(room_id: RoomId, people: PersonInMap[]) {
  const cmds = people.map(p => {
    return [
      "set",
      "pos:" + room_id + ":" + p.id,
      p.x + "." + p.y + "." + p.direction,
    ]
  })
  await redis.accounts.pipeline(cmds).exec(() => {
    //
  })
}

export class MapModel {
  announcement: Announcement | null = null
  name!: string
  room_id!: string
  constructor(room_id: RoomId, name: string) {
    this.room_id = room_id
    this.name = name
  }
  static async mkNewRoom(
    name: string,
    map_data: string | { cells: Cell[][]; numRows: number; numCols: number },
    allow_poster_assignment: boolean,
    minimap_visibility:
      | "all_initial"
      | "map_initial"
      | "all_only_visited"
      | "map_only_visited",
    owner?: UserId
  ): Promise<{ map?: MapModel; error?: string }> {
    const room_id = MapModel.genRoomId()
    if (name.length == 0 || name.trim() == "") {
      return { error: "Invalid name" }
    }
    const rows = await db.query(`SELECT 1 FROM room WHERE name=$1`, [name])
    if (rows.length > 0) {
      return { error: "Room name already exists" }
    }
    await db.query(
      `INSERT INTO room (id,name,room_owner,allow_poster_assignment,minimap_visibility) values ($1,$2,$3,$4,$5)`,
      [room_id, name, owner, allow_poster_assignment, minimap_visibility]
    )
    const m = new MapModel(room_id, name)
    model.maps[room_id] = m
    const res =
      typeof map_data == "string" ? MapModel.parseMapString(map_data) : map_data
    if (!res) {
      await db.query(`DELETE FROM room WHERE id=$1`, [room_id])
      return { error: "Import failed" }
    }
    await m.importMapData(res)
    return { map: m }
  }

  async replaceMapCells(
    map_data: string | { cells: Cell[][]; numRows: number; numCols: number }
  ): Promise<{ ok: boolean; error?: string }> {
    const res =
      typeof map_data == "string" ? MapModel.parseMapString(map_data) : map_data
    if (!res) {
      return { ok: false, error: "Import failed" }
    }
    const r = await this.importMapData(res, true)
    return { ok: !!r }
  }

  async getOwner(): Promise<UserId | undefined> {
    const rows = await db.query(`SELECT room_owner FROM room WHERE id=$1`, [
      this.room_id,
    ])
    return rows[0]?.room_owner
  }

  async isUserOwnerOrAdmin(user_id: UserId): Promise<boolean> {
    if (user_id.indexOf("@") != -1 || user_id[0] != "U") {
      throw "Wrong user ID"
    }
    const rows = await db.query(
      `SELECT
            1
        FROM
            person
            JOIN person_room_access AS ra ON person.email = ra.email
        WHERE
            ra.room = $1
            AND ra.role = 'admin'
            AND person.id = $2
  `,
      [this.room_id, user_id]
    )
    if (rows.length == 1) {
      return true
    }
    const rows2 = await db.query(
      `SELECT 1 FROM room WHERE id=$1 AND room_owner=$2`,
      [this.room_id, user_id]
    )
    return rows2.length == 1
  }

  async getAdmins(): Promise<UserId[]> {
    const rows = await db.query(
      `SELECT person.id FROM person JOIN person_room_access as ra ON person.email=ra.email WHERE ra.room=$1 AND ra.role='admin'`,
      [this.room_id]
    )
    return rows.map(r => r["id"])
  }

  async getAdminEmails(): Promise<string[]> {
    const rows = await db.query(
      `SELECT email FROM person_room_access WHERE room=$1 AND role='admin'`,
      [this.room_id]
    )
    return rows.map(r => r["email"])
  }

  async get(): Promise<{
    cells: Cell[][]
    numRows: number
    numCols: number
    allow_poster_assignment: boolean
    name: string
  }> {
    const data1 = await this.getStaticMap()
    const room = await model.db.oneOrNone(
      `SELECT name,allow_poster_assignment,move_log,minimap_visibility FROM room WHERE id=$1`,
      [this.room_id]
    )
    if (!room) {
      throw "Not found room"
    }

    const allow_poster_assignment = !!room.allow_poster_assignment
    const name: string = room!.name
    const move_log: boolean = room.move_log
    const minimap_visibility: string = room.minimap_visibility
    const data = {
      ...data1,
      allow_poster_assignment,
      name,
      move_log,
      minimap_visibility,
    }
    return data
  }

  async getMetadata(
    admin = false
  ): Promise<{
    id: RoomId
    name: string
    numCols: number
    numRows: number
    move_log: boolean
    allow_poster_assignment: boolean
    minimap_visibility:
      | "all_initial"
      | "map_initial"
      | "all_only_visited"
      | "map_only_visited"
    access_codes?: RoomAccessCode[]
    people_groups?: UserGroup[]
  }> {
    const d = await model.db.oneOrNone(
      `SELECT
            room.name,
            room.move_log,
            allow_poster_assignment,
            minimap_visibility,
            array_agg(DISTINCT concat(cd.code, ' ', cd.active, ' ', cd.granted_right, ' ', cd.timestamp)) AS access_codes,
            array_agg(DISTINCT concat(pg.id, ' ', pg.name, ' ', pg.description)) AS people_groups
        FROM
            room
            LEFT JOIN room_access_code AS cd ON cd.room = room.id
            LEFT JOIN people_group AS pg ON pg.room = room.id
        WHERE
            room.id = $1
        GROUP BY
            room.allow_poster_assignment,
            room.minimap_visibility,
            room.name,
            room.move_log
        `,
      [this.room_id]
    )
    const name: string = d.name
    const move_log: boolean = d.move_log
    const allow_poster_assignment = !!d.allow_poster_assignment
    const minimap_visibility:
      | "all_initial"
      | "map_initial"
      | "all_only_visited"
      | "map_only_visited" = d.minimap_visibility
    const access_codes: RoomAccessCode[] | undefined = admin
      ? (d["access_codes"] as string[])
          .map((s: string) => {
            const ts = s.split(" ")
            return {
              code: ts[0],
              active: ts[1] == "t",
              access_granted: ts[2].split(";;"),
              timestamp: parseInt(ts[3]),
            }
          })
          .filter(c => c.code != "")
      : undefined

    const people_groups: UserGroup[] | undefined = admin
      ? (d["people_groups"] as string[])
          .map((s: string) => {
            const ts = s.split(" ")
            return {
              id: ts[0],
              name: ts[1],
              description: ts[2] || undefined,
            }
          })
          .filter(c => c.id != "")
      : undefined

    const numCols = await this.numCols()
    const numRows = await this.numRows()

    return {
      id: this.room_id,
      name,
      numCols,
      numRows,
      move_log,
      allow_poster_assignment,
      minimap_visibility,
      access_codes,
      people_groups,
    }
  }

  async getVisitedCells(user_id: UserId): Promise<Set<MapCellId>> {
    const s = new Set<MapCellId>()
    const cells = await db.query(
      `SELECT "location" FROM cell_visit_history WHERE person=$1 AND "location" in (SELECT id FROM map_cell WHERE room=$2)`,
      [user_id, this.room_id]
    )
    for (const c of cells) {
      // console.log(c)
      s.add(c.location)
      // console.log(s)
    }
    return s
  }

  async createUserGroup(name: string, description?: string) {
    const group_id = model.people.genPeopleGroupId()
    await db.query(
      `INSERT INTO people_group (room, id, name,description) values ($1,$2,$3,$4)`,
      [this.room_id, group_id, name, description || null]
    )
  }

  async addUserToUserGroups(
    user_email: string,
    user_id: UserId | null,
    groups: UserGroupId[]
  ) {
    if (user_id) {
      for (const g of groups) {
        const rows = await db.query(
          `SELECT 1 FROM people_group WHERE id=$1 AND room=$2`,
          [g, this.room_id]
        )
        if (rows.length == 0) {
          continue
        }
        await db.query(
          `DELETE FROM person_in_people_group WHERE people_group=$1 AND person_id=$2`,
          [g, user_id]
        )
        await db.query(
          `INSERT INTO person_in_people_group (people_group, person_id) values ($1,$2)`,
          [g, user_id]
        )
      }
    } else {
      for (const g of groups) {
        const rows = await db.query(
          `SELECT 1 FROM people_group WHERE id=$1 AND room=$2`,
          [g, this.room_id]
        )
        if (rows.length == 0) {
          continue
        }
        await db.query(
          `DELETE FROM person_in_people_group WHERE people_group=$1 AND person_email=$2`,
          [g, user_email]
        )
        await db.query(
          `INSERT INTO person_in_people_group (people_group, person_email) values ($1,$2) `,
          [g, user_email]
        )
      }
    }
  }

  // Give a user room access, add the user to user groups, and optionally place them in a map.
  async addUser(
    user_email: string,
    user_id?: UserId,
    assignPosition = true,
    role: "user" | "admin" = "user",
    groups: UserGroupId[] = [],
    added_by?: string
  ): Promise<{
    ok: boolean
    error?: string
    num_people_joined?: number
    num_people_with_access?: number
  }> {
    try {
      await db.query(
        `INSERT INTO person_room_access (room,email,"role",added_by) values ($1,$2,$3,$4) ON CONFLICT ON CONSTRAINT person_room_access_pkey DO NOTHING `,
        [this.room_id, user_email, role, added_by]
      )
      user_id =
        user_id ||
        (await model.people.getUserIdFromEmail(user_email)) ||
        undefined

      await this.addUserToUserGroups(user_email, user_id || null, groups)
      if (assignPosition) {
        if (!user_id) {
          return {
            ok: false,
            error:
              "Cannot assign a position to a user that has not registered yet.",
          }
        }
        const r = await this.assignUserPosition(user_id)
        return {
          ok: r.ok,
          error: r.ok ? undefined : "AssignPostion error: " + r.status,
        }
      }
      const num_people_joined = +(
        await db.query(
          `SELECT count(*) as c FROM person_position WHERE room=$1`,
          [this.room_id]
        )
      )[0].c
      const num_people_with_access = +(
        await db.query(
          `SELECT count(*) as c FROM person_room_access WHERE room=$1`,
          [this.room_id]
        )
      )[0].c
      return { ok: true, num_people_joined, num_people_with_access }
    } catch (err) {
      console.log(err)
      return { ok: false, error: "DB error in addUser()" }
    }
  }

  // Remove room access of a user
  async removeUser(d: {
    user_id?: UserId
    email?: string
  }): Promise<{
    ok: boolean
    error?: string
    num_people_active?: number
    num_people_joined?: number
    num_people_with_access?: number
  }> {
    const user_email = d.email || (await redis.accounts.get("uid:" + d.user_id))
    const user_id = d.user_id || (await redis.accounts.get("email:" + d.email))
    log.debug("removeUser()", user_id, user_email)
    if (!user_email) {
      return { ok: false, error: "User email is not found" }
    }
    try {
      //FIXME: Delete other activities such as comments, groups, posters, etc.
      if (user_id) {
        await db.query(
          `DELETE FROM person_in_people_group WHERE person_id=$1 AND people_group IN (SELECT id FROM people_group WHERE room=$2)`,
          [user_id, this.room_id]
        )
        await db.query(
          `DELETE FROM person_position WHERE room=$1 AND person=$2`,
          [this.room_id, user_id]
        )
        await model.redis.accounts.srem(
          "connected_users:room:" + this.room_id + ":__all__",
          user_id
        )
        await model.redis.accounts.hdel(
          "connected_users:room:" + "__any__",
          user_id
        )
        await model.redis.sockets.del("room:" + this.room_id + ":" + user_id)
      }
      await db.query(
        `DELETE FROM person_room_access WHERE room=$1 AND email=$2`,
        [this.room_id, user_email]
      )
      const num_people_active = await model.redis.accounts.scard(
        "connected_users:room:" + this.room_id + ":__all__"
      )
      const num_people_joined = +(
        await db.query(
          `SELECT count(*) as c FROM person_position WHERE room=$1`,
          [this.room_id]
        )
      )[0].c
      const num_people_with_access = +(
        await db.query(
          `SELECT count(*) as c FROM person_room_access WHERE room=$1`,
          [this.room_id]
        )
      )[0].c

      return {
        ok: true,
        num_people_active,
        num_people_joined,
        num_people_with_access,
      }
    } catch (err) {
      console.log(err)
      return { ok: false, error: "DB error in removeUser()" }
    }
  }

  async createAccessCode(
    access_granted: string[] = [],
    active = true
  ): Promise<RoomAccessCode | null> {
    const code = random_str(20)
    const timestamp = Date.now()
    try {
      await model.db.query(
        `INSERT INTO room_access_code (code,room,granted_right,timestamp,active) VALUES ($1,$2,$3,$4,$5)`,
        [
          code,
          this.room_id,
          ["user", ...access_granted].join(";;"),
          timestamp,
          active,
        ]
      )
    } catch (err) {
      log.error(err)
      return null
    }
    return { code, active, access_granted, timestamp }
  }

  async writeRedisCache(): Promise<void> {
    await this.initStaticMap()
    await this.initLiveObjects()
  }

  async clearStaticMapCache(): Promise<void> {
    await model.redis.staticMap.del("map_cache:" + this.room_id)
  }

  async initStaticMap(): Promise<void> {
    const cells = await this.getAllStaticMapCellsFromRDB()
    const cmds = cells.map(c => {
      return ["set", mkKey(this.room_id, c.x, c.y), JSON.stringify(c)]
    })
    await redis.staticMap.pipeline(cmds).exec(() => {
      //
    })
    const numCols =
      cells.length == 0 ? 0 : (_.max(cells.map(c => c.x || 0)) || 0) + 1
    const numRows =
      cells.length == 0 ? 0 : (_.max(cells.map(c => c.y || 0)) || 0) + 1
    await redis.staticMap.set(this.room_id + ":num_cols", numCols)
    await redis.staticMap.set(this.room_id + ":num_rows", numRows)
  }

  async initLiveObjects(): Promise<void> {
    const people = await model.people.getPeopleInRoom(
      this.room_id,
      false,
      false
    )
    await setRedisPeoplePosition(this.room_id, people)
  }

  async updateMapCells(
    changes: MapUpdateEntry[]
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await db.query(`BEGIN`)
      for (const c of changes) {
        const updateObj: { [index: string]: number | string | boolean } = {}
        //FIXME: Complete this.
        if (c.kind) {
          updateObj.kind = c.kind
        }
        const q = pgp.helpers.update(updateObj, null, "map_cell")
        const condition = pgp.as.format(" WHERE room=$1 and x=$2 and y=$3", [
          this.room_id,
          c.x,
          c.y,
        ])
        await db.query(q + condition)
      }
      await db.query(`COMMIT`)
    } catch (err) {
      console.error(err)
      await db.query(`ROLLBACK`)
      return { ok: false, error: "DB error" }
    }
    await this.clearStaticMapCache()
    return { ok: true }
  }

  private async tryPurge(
    user_id: UserId,
    p: PosDir,
    radius: number
  ): Promise<PosDir | null> {
    const direction: Direction = "down"
    const last_updated = Date.now()
    try {
      const rows = await db.query(
        `
  UPDATE
      person_position
  SET
      (x,
          y,
          direction,
          last_updated) = (
          SELECT
              x,
              y,
              $3::direction,
              $4
          FROM
              map_cell
          WHERE
              room = $1
              AND (x,
                  y)
              NOT IN (
                  SELECT
                      x,
                      y
                  FROM
                      person_position
                  WHERE
                      room = $1)
              AND kind NOT IN ('water', 'wall', 'poster', 'poster_seat')
              AND x >= $5
              AND x <= $6
              AND y >= $7
              AND y <= $8
          ORDER BY
              RANDOM()
          LIMIT 1)
  WHERE
      person = $2
  RETURNING
      x,
      y;        
    `,
        [
          this.room_id,
          user_id,
          direction,
          last_updated,
          p.x - radius,
          p.x + radius,
          p.y - radius,
          p.y + radius,
        ]
      )
      if (rows[0]) {
        const x = rows[0].x
        const y = rows[0].y
        const pos = { x, y, direction }
        await redis.accounts.set(
          "pos:" + this.room_id + ":" + user_id,
          "" + pos.x + "." + pos.y + "." + pos.direction
        )
        await model.chat.leaveChat(this.room_id, user_id)
        const r = await model.posters.getViewingPoster(user_id, this.room_id)
        if (r.poster_id) {
          await model.posters.endViewing(user_id, this.room_id, r.poster_id)
        }
        return pos
      } else {
        return null
      }
    } catch (err) {
      // Probably this means no SELECT result.
      return null
    }
  }
  async purgePersonFromRestrictedArea(user_id: UserId): Promise<PosDir | null> {
    //
    const p = await model.people.getPos(user_id, this.room_id)
    if (p) {
      const cell = await this.getStaticMapAt(p.x, p.y)
      if (cell) {
        if (cell.kind == "poster_seat") {
          console.log("Purging person:", user_id, p)
          const radius_list = [1, 2, 3, 5, 10, 100]
          for (const radius of radius_list) {
            const pos = await this.tryPurge(user_id, p, radius)
            if (pos) {
              return pos
            }
          }
        }
      }
    }
    return null
  }

  static parseMapString(
    str: string
  ): {
    cells: Cell[][]
    numRows: number
    numCols: number
  } | null {
    try {
      const map_rows = str.split("\n").filter(line => line.length > 0)
      const numRows = map_rows.length
      const numCols = map_rows[0].length

      const cells: Cell[][] = _.map(_.range(numRows), y => {
        const rs: Cell[] = _.map(_.range(numCols), x => {
          const id = MapModel.genMapCellId()
          if (map_rows[y][x] == ".") {
            return { id, x, y, kind: "grass", open: true }
          } else if (map_rows[y][x] == "W") {
            return { id, x, y, kind: "wall", open: false }
          } else if (map_rows[y][x] == "P") {
            return { id, x, y, kind: "poster", open: false }
          } else if (map_rows[y][x] == "M") {
            return { id, x, y, kind: "mud", open: true }
          } else if (map_rows[y][x] == "{") {
            return { id, x, y, kind: "water", open: false }
          } else {
            throw "Invalid map element." + map_rows[y][x]
          }
        })
        return rs
      })
      if ([...new Set(cells.map(c => c.length))].length != 1) {
        throw "Map is not rectanglar"
      }
      for (let y = 0; y < cells.length; y++) {
        for (let x = 0; x < cells[0].length; x++) {
          if (cells[y][x].kind == "poster") {
            for (const c of adjacentCells(cells, x, y, 1)) {
              if (isOpenCell(c)) {
                c.kind = "poster_seat"
              }
            }
          }
        }
      }
      return { cells, numRows, numCols }
    } catch (err) {
      log.error(err)
      return null
    }
  }

  async importMapData(
    map: {
      cells: Cell[][]
      numRows: number
      numCols: number
    },
    replace = false
  ): Promise<{ cells: Cell[][]; numRows: number; numCols: number } | null> {
    let poster_number = 0
    try {
      await db.query("BEGIN")
      if (replace) {
        const currentRows = await this.numRows()
        const currentCols = await this.numCols()
        if (map.numRows < currentRows) {
          //Shrink rows
          await db.query(
            `DELETE FROM cell_visit_history WHERE "location" in (SELECT id FROM map_cell WHERE room=$1 AND y>=$2)`,
            [this.room_id, map.numRows]
          )
          await db.query(`DELETE FROM map_cell WHERE room=$1 AND y>=$2`, [
            this.room_id,
            map.numRows,
          ])
        } else if (map.numRows > currentRows) {
          //Expand rows
          const cs = flatten(
            range(currentRows, map.numRows).map(y => {
              return range(0, map.numCols).map(x => {
                return { x, y }
              })
            })
          )
          const data_dummy = cs.map(c => {
            return {
              id: MapModel.genMapCellId(),
              room: this.room_id,
              x: c.x,
              y: c.y,
              kind: "grass",
              no_initial_position: false,
            }
          })
          await db.none(
            pgp.helpers.insert(
              data_dummy,
              ["id", "room", "x", "y", "kind", "no_initial_position"],
              "map_cell"
            ) + " ON CONFLICT ON CONSTRAINT map_cell_room_x_y_key DO NOTHING"
          )
        }
        if (map.numCols < currentCols) {
          //Shrink columns
          await db.query(
            `DELETE FROM cell_visit_history WHERE "location" in (SELECT id FROM map_cell WHERE room=$1 AND x>=$2)`,
            [this.room_id, map.numCols]
          )
          await db.query(`DELETE FROM map_cell WHERE room=$1 AND x>=$2`, [
            this.room_id,
            map.numCols,
          ])
        } else if (map.numCols > currentCols) {
          //Expand columns
          const cs = flatten(
            range(currentCols, map.numCols).map(x => {
              return range(0, map.numRows).map(y => {
                return { x, y }
              })
            })
          )
          const data_dummy = cs.map(c => {
            return {
              id: MapModel.genMapCellId(),
              room: this.room_id,
              x: c.x,
              y: c.y,
              kind: "grass",
              no_initial_position: false,
            }
          })
          await db.none(
            pgp.helpers.insert(
              data_dummy,
              ["id", "room", "x", "y", "kind", "no_initial_position"],
              "map_cell"
            ) + " ON CONFLICT ON CONSTRAINT map_cell_room_x_y_key DO NOTHING"
          )
        }
      }
      for (const cs of _.chunk(_.flatten(map.cells), 1000)) {
        const dataMulti = cs.map(c => {
          if (c.kind == "poster") {
            poster_number += 1
          }
          return {
            id: c.id,
            room: this.room_id,
            x: c.x,
            y: c.y,
            kind: mkKindString(c.kind, c.open),
            poster_number: c.kind == "poster" ? poster_number : null,
            custom_image: c.custom_image,
            link_url: c.link_url,
            no_initial_position: c.no_initial_position,
          }
        })
        if (replace) {
          const values = pgp.helpers.values(
            dataMulti,
            new pgp.helpers.ColumnSet([
              {
                name: "room",
                cast: "text", // use SQL type casting '::int[]'
              },
              {
                name: "x",
                cast: "integer", // use SQL type casting '::int[]'
              },
              {
                name: "y",
                cast: "integer", // use SQL type casting '::int[]'
              },
              {
                name: "kind",
                cast: "text", // use SQL type casting '::int[]'
              },
              {
                name: "poster_number",
                cast: "integer", // use SQL type casting '::int[]'
              },
              {
                name: "custom_image",
                cast: "text", // use SQL type casting '::int[]'
              },
              {
                name: "link_url",
                cast: "text", // use SQL type casting '::int[]'
              },
              {
                name: "no_initial_position",
                cast: "boolean", // use SQL type casting '::int[]'
              },
            ])
          )
          const s =
            `
          UPDATE
              map_cell
          SET
              kind = t.kind,
              poster_number = t.poster_number,
              custom_image = t.custom_image,
              link_url = t.link_url,
              no_initial_position = t.no_initial_position
          FROM
          (VALUES ` +
            values +
            `) AS t (room,
                  x,
                  y,
                  kind,
                  poster_number,
                  custom_image,
                  link_url,
                  no_initial_position)
          WHERE
              map_cell.room = t.room
              AND map_cell.x = t.x
              AND map_cell.y = t.y
          `
          await db.none(s)
        } else {
          await db.none(
            pgp.helpers.insert(
              dataMulti,
              [
                "id",
                "room",
                "x",
                "y",
                "kind",
                "poster_number",
                "custom_image",
                "link_url",
                "no_initial_position",
              ],
              "map_cell"
            )
          )
        }
      }
      await db.query("COMMIT")
    } catch (err) {
      if (replace) {
        log.error(
          "DB error (maybe UPDATE failed by poster or chat group map_cell references)",
          err
        )
      } else {
        log.error("DB error", err)
      }
      await db.query("ROLLBACK")
      return null
    }
    //Reload Redis cache
    await this.clearStaticMapCache()
    await this.writeRedisCache()
    return map
  }
  async importPosterAssignment(
    posters: { author: UserId; poster_number: number; title?: string }[],
    overwrite: boolean
  ): Promise<Poster[]> {
    const result: Poster[] = []
    for (const p of posters) {
      log.debug(p)
      try {
        const { ok, poster } = await this.assignPosterLocation(
          p.poster_number,
          p.author,
          overwrite,
          p.title
        )
        if (ok && poster) {
          result.push(poster)
        }
      } catch (err) {
        log.error(err)
      }
    }
    await model.initMapModel(POSTGRES_CONNECTION_STRING)
    return result
  }
  async numCols(): Promise<number> {
    const s = await redis.staticMap.get(this.room_id + ":num_cols")
    return s ? parseInt(s) : 0
  }
  async numRows(): Promise<number> {
    const s = await redis.staticMap.get(this.room_id + ":num_rows")
    return s ? parseInt(s) : 0
  }
  async getStaticMap(): Promise<{
    cells: Cell[][]
    numCols: number
    numRows: number
  }> {
    const cell_list = await this.getAllStaticMapCellsFromRDB()
    let numCols = 0
    let numRows = 0
    for (const c of cell_list) {
      numCols = Math.max(numCols, c.x + 1)
      numRows = Math.max(numRows, c.y + 1)
    }
    const cells: Cell[][] = _.range(numRows).map(y => {
      return new Array(numCols).fill(null).map(x => {
        return { id: "", kind: "grass", open: false, x, y }
      })
    })
    for (const c of cell_list) {
      cells[c.y][c.x] = c
    }
    return { cells, numCols, numRows }
  }

  // Place a user in a map if they have access and the room has open space.
  async assignUserPosition(
    user_id: UserId
  ): Promise<{
    ok: boolean
    status: "New" | "ComeBack" | "NoAccess" | "DoesNotExist" | "NoSpace"
    position?: Point
  }> {
    log.debug("assignUserPosition()", user_id)
    const user = await model.people.get(user_id, undefined, true)
    if (!user) {
      return { ok: false, status: "DoesNotExist" }
    }
    const r = await db.query(
      `SELECT count(*) from person_room_access where room=$1 and email=$2;`,
      [this.room_id, user.email]
    )
    if (r[0].count == 0) {
      return { ok: false, status: "NoAccess" }
    }
    const pos: PosDir | null = await this.assignRandomOpenPos(user_id)
    if (!pos) {
      log.error("No open space")
      return { ok: false, status: "NoSpace" }
    }
    log.debug("Found open pos for user:", pos)
    await model.people.setPos(
      user_id,
      this.room_id,
      { x: pos.x, y: pos.y },
      pos.direction,
      true
    )
    return { ok: true, status: "New", position: { x: pos.x, y: pos.y } }
  }

  async enterRoom(
    user_id: UserId
  ): Promise<{
    ok: boolean
    status: "New" | "ComeBack" | "NoAccess" | "DoesNotExist" | "NoSpace"
    num_people_joined?: number
  }> {
    const r1 = (
      await db.query(`SELECT count(*) from room where id=$1`, [this.room_id])
    )[0].count
    if (r1 == 0) {
      log.warn("Room was deleted")
      return { ok: false, status: "DoesNotExist" }
    }
    const rows = await db.query(
      `SELECT * FROM person_position where person=$1 and room=$2;`,
      [user_id, this.room_id]
    )
    if (rows.length == 0) {
      const r = await this.assignUserPosition(user_id)
      if (r.status == "New") {
        const num_people_joined = +(
          await db.query(
            `SELECT count(*) as c FROM person_position WHERE room=$1`,
            [this.room_id]
          )
        )[0].c
        return { ...r, num_people_joined }
      }
      if (r.position) {
        const r1 = await db.query(`SELECT move_log FROM room WHERE id=$1`, [
          this.room_id,
        ])
        if (r1[0].move_log) {
          const c: Cell | null = await this.getStaticMapAt(
            r.position.x,
            r.position.y
          )
          if (c) {
            await db.query(
              `INSERT INTO cell_visit_history (person,"location",last_updated,state) VALUES ($1,$2,$3,$4) ON CONFLICT ON CONSTRAINT cell_visit_history_pkey DO UPDATE SET last_updated=$3,state=$4;`,
              [user_id, c.id, Date.now(), "visited"]
            )
          }
        }
      }
      return r
    } else {
      const x: number = rows[0].x
      const y: number = rows[0].y
      const r1 = await db.query(`SELECT move_log FROM room WHERE id=$1`, [
        this.room_id,
      ])
      if (r1[0].move_log) {
        const c = await this.getStaticMapAt(x, y)
        if (c) {
          await db.query(
            `INSERT INTO cell_visit_history (person,"location",last_updated,state) VALUES ($1,$2,$3,$4) ON CONFLICT ON CONSTRAINT cell_visit_history_pkey DO UPDATE SET last_updated=$3,state=$4;`,
            [user_id, c.id, Date.now(), "visited"]
          )
        }
      }
      return { ok: true, status: "ComeBack" }
    }
  }

  async leaveRoom(
    user_id: UserId
  ): Promise<{
    ok: boolean
  }> {
    const left_time = Date.now()
    await db.query(
      `UPDATE
              poster_viewer
          SET
              left_time = $1
          WHERE
              left_time IS NULL
              AND person = $2
              AND poster IN (
                  SELECT
                      id
                  FROM
                      poster
                  WHERE
                      LOCATION IN (
                          SELECT
                              id
                          FROM
                              map_cell
                          WHERE
                              room = $3
                              AND poster_number IS NOT NULL))
              RETURNING
                  poster;`,
      [left_time, user_id, this.room_id]
    )
    const r = await model.chat.leaveChat(this.room_id, user_id)
    if (r.ok && r.leftGroup) {
      emit.channel(this.room_id).group(r.leftGroup)
    } else if (r.ok && r.removedGroup) {
      emit.channel(this.room_id).groupRemove(r.removedGroup)
    }
    return { ok: true }
  }

  async getPeopleWithAccess(): Promise<{ email: string }[]> {
    const rows = await db.query(
      `SELECT email FROM person_room_access WHERE room=$1;`,
      [this.room_id]
    )
    return rows.map(r => {
      return { email: r["email"] as string }
    })
  }
  async setTyping(user: UserId, typing: boolean): Promise<void> {
    await redis.accounts.set(
      "typing:" + this.room_id + ":" + user,
      typing ? "1" : "0"
    )
  }

  async assignRandomOpenPos(
    user_id: UserId,
    remove_old = false
  ): Promise<PosDir | null> {
    const last_updated = Date.now()
    const direction: Direction = "down"
    if (remove_old) {
      await db.query(
        `DELETE FROM person_position WHERE room=$1 AND person=$2;`,
        [this.room_id, user_id]
      )
    }
    const rows = await db.query(
      `INSERT INTO person_position
            (room,person,last_updated,x,y,direction)
        SELECT
            $1,$2,$3,x,y,$4 FROM map_cell 
        WHERE
            room=$1
            AND (x,y) NOT IN
                (SELECT x,y FROM person_position WHERE room=$1)
            AND kind IN ('grass', 'mud', 'poster_seat', '+water', '+wall', '+poster')
            AND (no_initial_position IS NULL OR no_initial_position='f')
        ORDER BY RANDOM()
        LIMIT 1
            RETURNING x,y;
    `,
      [this.room_id, user_id, last_updated, direction]
    )
    if (rows.length == 0) {
      return null
    } else {
      const pos = { x: rows[0].x, y: rows[0].y, direction }
      await redis.accounts.set(
        "pos:" + this.room_id + ":" + user_id,
        "" + pos.x + "." + pos.y + "." + pos.direction
      )
      return pos
    }
  }
  async tryToMove(
    current: Point,
    d: {
      x: number
      y: number
      user: UserId
    }
  ): Promise<{
    error?: string
    results?: TryToMoveResult[]
  }> {
    try {
      const result: TryToMoveResult = { room: this.room_id, user: d.user }
      const numCols = await this.numCols()
      const numRows = await this.numRows()
      log.debug(
        "tryToMove(): " +
          (cluster?.worker?.id ? "Worker#" + cluster.worker.id : ""),
        this.room_id,
        d.user,
        current.x,
        current.y,
        "to",
        d.x,
        d.y
      )
      if (!(d.x >= 0 && d.y >= 0 && d.x < numCols && d.y < numRows)) {
        log.warn("Destination out of bounds.", d, current, numCols, numRows)
        return { error: "Destination out of bounds" }
      }
      if (Math.abs(current.x - d.x) > 1 || Math.abs(current.y - d.y) > 1) {
        log.warn("Destination too far from the current point", d, current)
        return { error: "Destination too far from the current point" }
      }
      const to_cell = await this.getStaticMapAt(d.x, d.y)
      if (!to_cell) {
        log.warn("Static cell cache failed to get.")
        return { error: "Static cell cache failed to get." }
      }
      if (!isOpenCell(to_cell)) {
        log.warn("Destination is not open:", to_cell)
        return { error: "Destination is not open" }
      }
      const group = await model.chat.getGroupIdOfUser(this.room_id, d.user)
      if (group) {
        log.warn("Cannot move during chat")
        return { error: "Cannot move during chat" }
      }
      const from = { x: current.x, y: current.y }
      const to = { x: d.x, y: d.y }
      const direction = calcDirection(from, to)

      const person_at_dest = await this.anotherPersonAt(d.user, to)
      if (person_at_dest) {
        const connected = await redis.accounts.sismember(
          "connected_users:room:" + this.room_id + ":__all__",
          person_at_dest
        )
        if (connected) {
          return { error: "Person exists at the destination" }
        }
        const r = await model.people.swapTwoPeople(
          this.room_id,
          d.user,
          person_at_dest
        )
        if (!r.ok) {
          return {
            error: "tryToMove(): Error in swapping with inactive person",
          }
        }
        return {
          results: r.results,
        }
      } else {
        const r = await model.people.setPos(d.user, this.room_id, to, direction)
        if (!r) {
          return { error: "setPos failed", results: [result] }
        }
        result.position = to
        result.direction = direction
        return { results: [result] }
      }
    } catch (err) {
      log.error(err)
      return { error: err }
    }
  }

  async anotherPersonAt(myself: UserId, pos: Point): Promise<UserId | null> {
    const rows = await db.query(
      `SELECT person FROM person_position WHERE room=$1 AND person<>$2 AND x=$3 AND y=$4`,
      [this.room_id, myself, pos.x, pos.y]
    )
    return rows[0] ? rows[0].person : null
  }

  async getStaticMapAt(x: number, y: number): Promise<Cell | null> {
    const s = await redis.staticMap.get(mkKey(this.room_id, x, y))
    return s ? JSON.parse(s) : null
  }

  async getAllStaticMapCellsFromRDB(): Promise<Cell[]> {
    const rows = await db.query<MapCellRDB[]>(
      `SELECT * from map_cell where room=$1`,
      [this.room_id]
    )
    return rows.map(r => {
      const r2: Cell = {
        id: r.id,
        open: getCellOpenFromString(r.kind),
        x: r.x,
        y: r.y,
        kind: getCellKindFromString(r.kind) || "grass",
      }
      if (r.poster_number != null) {
        r2.poster_number = r.poster_number
      }
      if (r.custom_image != null) {
        r2.custom_image = r.custom_image
      }
      if (r.link_url != null) {
        r2.link_url = r.link_url
      }
      return r2
    })
  }

  async assignPosterLocation(
    poster_number: number,
    author: UserId,
    overwrite: boolean,
    title?: string,
    access_log = false,
    author_online_only = false
  ): Promise<{
    ok: boolean
    poster?: Poster
    error?: string
    poster_count?: number
  }> {
    log.debug("assignPosterLocation()", poster_number, author, title, overwrite)
    const poster_id = Posters.genPosterId()
    const last_updated = Date.now()
    const cells: MapCellRDB[] = await db.many(
      `SELECT * FROM map_cell WHERE room=$1 AND poster_number=$2;`,
      [this.room_id, poster_number]
    )
    if (cells.length != 1) {
      return { ok: false, error: "Cannot find the poster cell" }
    }
    let res: any[] = []
    const location = cells[0].id
    try {
      if (overwrite) {
        res = await db.query(
          `INSERT INTO poster (id,last_updated,title,author,location,access_log,author_online_only,file_uploaded) VALUES ($1,$2,$3,$4,$5,$6,$7,'f') ON CONFLICT ON CONSTRAINT poster_location_key DO UPDATE SET id=$1,last_updated=$2,title=$3,author=$4 RETURNING id;`,
          [
            poster_id,
            last_updated,
            title,
            author,
            location,
            access_log,
            author_online_only,
          ]
        )
        log.debug("poster overwrite", res)
      } else {
        res = await db.query(
          `INSERT INTO poster (id,last_updated,title,author,location,access_log,author_online_only,file_uploaded) VALUES ($1,$2,$3,$4,$5,$6,$7,'f') RETURNING id;`,
          [
            poster_id,
            last_updated,
            title,
            author,
            location,
            access_log,
            author_online_only,
          ]
        )
      }
    } catch (err) {
      log.error(err)
      return { ok: false, error: "DB error" }
    }
    if (res.length == 0 || res[0].id != poster_id) {
      return { ok: false, error: "DB error" }
    }
    const domain = USE_S3_CDN
      ? (CDN_DOMAIN as string)
      : "https://" + (S3_BUCKET as string) + ".s3.amazonaws.com/"
    const poster_count: number | undefined = +(
      await db.query(
        `SELECT count(*) as c FROM poster WHERE location IN (SELECT id FROM map_cell WHERE room=$1)`,
        [this.room_id]
      )
    )[0].c
    return {
      ok: true,
      poster: {
        id: poster_id,
        title: title,
        author: author,
        last_updated,
        room: this.room_id,
        location,
        poster_number,
        x: cells[0].x,
        y: cells[0].y,
        file_url: undefined,
        // file_url: config.aws.s3.upload
        //   ? "not_disclosed"
        //   : "/api/posters/" + poster_id + "/file",
        access_log,
        author_online_only,
      },
      poster_count,
    }
  }

  async freePosterLocation(
    poster_number: number,
    requester: UserId,
    forceRemoveComments = false
  ): Promise<{
    ok: boolean
    poster_id?: PosterId
    viewers?: UserId[]
    error?: string
    poster_count?: number
  }> {
    try {
      const poster: Poster | null = await model.posters.getByNumber(
        this.room_id,
        poster_number
      )
      if (!poster) {
        return { ok: false, error: "Poster not found" }
      }
      const typ = await model.people.getUserType(requester)
      const typ_room = await model.people.getUserTypeForRoom(
        requester,
        this.room_id
      )
      if (
        poster.author != requester &&
        typ != "admin" &&
        typ_room != "owner" &&
        typ_room != "admin"
      ) {
        return {
          ok: false,
          poster_id: poster.id,
          error: "Not my poster or I am not admin",
        }
      }
      if (forceRemoveComments) {
        await db.query(`DELETE FROM comment_to_poster WHERE poster=$1;`, [
          poster.id,
        ])
      }
      const rows1 = await db.query(
        `DELETE FROM poster_viewer WHERE poster=$1 AND left_time IS NULL RETURNING person;`,
        [poster.id]
      )
      const viewers = rows1.map(r => r["person"]) as string[]
      await db.query(`DELETE FROM poster_viewer WHERE poster=$1;`, [poster.id])

      const rows = await db.query(
        `DELETE FROM poster WHERE author=$1 AND location in (SELECT id FROM map_cell WHERE room=$2 AND poster_number=$3) RETURNING id;`,
        [poster.author, this.room_id, poster_number]
      )
      const poster_count: number | undefined = +(
        await db.query(
          `SELECT count(*) as c FROM poster WHERE location IN (SELECT id FROM map_cell WHERE room=$1)`,
          [this.room_id]
        )
      )[0].c
      return {
        ok: rows.length == 1,
        poster_id: rows[0]?.id,
        viewers,
        poster_count,
      }
    } catch (err) {
      log.error(err)
      return { ok: false, error: "DB error" }
    }
  }
  async getAdjacentPosters(pos: Point): Promise<PosterId[]> {
    const keys = _.map(
      [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ],
      a => {
        return mkKey(this.room_id, pos.x + a[0], pos.y + a[1])
      }
    )
    const cells: Cell[] = _.compact(await redis.staticMap.mget(keys)).map(s =>
      JSON.parse(s)
    )
    // log.debug("cells", pos, keys, cells)
    const adjs: MapCellId[] = _.compact(
      cells
        .filter(c => {
          return c.kind == "poster"
        })
        .map(c => c.id)
    )
    // log.debug(adjs)
    const rows =
      adjs.length > 0
        ? await db.query(
            `SELECT id from poster where location in ($1:list)`,
            adjs
          )
        : []
    return rows.map(r => r.id)
  }
  announce(d: Announcement): void {
    this.announcement = d.text == "" ? null : d
    ;(async () => {
      if (d.text != "") {
        await model.db.query(
          `
        INSERT INTO announce (room, text, marquee, period)
            VALUES ($1, $2, $3, $4)
        ON CONFLICT ON CONSTRAINT announce_pkey
            DO UPDATE SET
                text = $2, marquee = $3, period = $4;
        `,
          [d.room, d.text, d.marquee, d.period]
        )
      } else {
        await model.db.query(
          `
        DELETE FROM announce WHERE room=$1;
        `,
          [d.room]
        )
      }
    })().catch(err => {
      console.error(err)
    })
  }

  static async loadTemplate(template: string): Promise<{ map_data?: string }> {
    const template_sanitized = template.replace(/\W/g, "")
    try {
      const s = await readFile(
        path.join(__dirname, "map_templates", template_sanitized + ".txt"),
        "utf-8"
      )
      return { map_data: s }
    } catch (err) {
      return {}
    }
  }
  async deleteRoomFromDB(): Promise<boolean> {
    try {
      await db.query("BEGIN")

      await db.query(
        `
      DELETE FROM announce
      WHERE room = $1`,
        [this.room_id]
      )

      await db.query(
        `
      DELETE FROM room_access_code
      WHERE room = $1
      `,
        [this.room_id]
      )

      await db.query(
        `
        DELETE FROM poster_viewer
        WHERE poster IN (
                SELECT
                    id
                FROM
                    poster
                WHERE
                    "location" IN (
                        SELECT
                            id
                        FROM
                            map_cell
                        WHERE
                            room = $1))`,
        [this.room_id]
      )
      await db.query(
        `
        DELETE FROM chat_event_recipient
        WHERE event IN (
                SELECT
                    id
                FROM
                    chat_event
                WHERE
                    room = $1)`,
        [this.room_id]
      )
      await db.query(
        `
      DELETE FROM chat_event
      WHERE room = $1
      `,
        [this.room_id]
      )

      await db.query(
        `DELETE from poster_comment_read where comment in (SELECT id from comment where room=$1);`,
        [this.room_id]
      )

      await db.query(
        `DELETE from comment_to_person where comment in (SELECT id from comment where room=$1);`,
        [this.room_id]
      )
      await db.query(
        `DELETE from comment_to_poster where comment in (SELECT id from comment where room=$1);`,
        [this.room_id]
      )
      await db.query(
        `DELETE from person_in_chat_group where chat in (SELECT id from chat_group where location in (SELECT id from map_cell where room=$1));`,
        [this.room_id]
      )
      await db.query(
        `DELETE from chat_group where location in (SELECT id from map_cell where room=$1);`,
        [this.room_id]
      )
      await db.query(`DELETE from comment where room=$1;`, [this.room_id])
      await db.query(
        `DELETE from poster where location in (SELECT id from map_cell where room=$1);`,
        [this.room_id]
      )
      await db.query(
        `DELETE from cell_visit_history where location in (SELECT id from map_cell where room=$1);`,
        [this.room_id]
      )

      await db.query(`DELETE from map_cell where room=$1;`, [this.room_id])
      await db.query(`DELETE from person_position where room=$1;`, [
        this.room_id,
      ])
      await db.query(`DELETE from person_room_access where room=$1;`, [
        this.room_id,
      ])
      await db.query(`DELETE FROM person_profile WHERE room=$1`, [this.room_id])
      await db.query(`DELETE from room where id=$1`, [this.room_id])
      await db.query("COMMIT")
      return true
    } catch (err) {
      await db.query("ROLLBACK")
      log.error("DB error, this must be a bug.", err)
      return false
    }
  }

  static genRoomId(): string {
    for (;;) {
      const s = "R" + shortid.generate()
      if (s.indexOf("-") == -1) {
        return s
      }
    }
  }
  static genMapCellId(): string {
    for (;;) {
      const s = "E" + shortid.generate()
      if (s.indexOf("-") == -1) {
        return s
      }
    }
  }

  static async getAllowedRoomsFromCode(
    code: string
  ): Promise<{ id: RoomId; groups: UserGroupId[] }[] | undefined> {
    // If it has non-existent room ID, return undefined
    const codes = code.split(":")
    const rooms_ok: { id: RoomId; groups: UserGroupId[] }[] = []
    for (const code of codes) {
      const rows = await model.db.query(
        `SELECT room,granted_right FROM room_access_code WHERE code=$1`,
        [code]
      )
      const rid: string | undefined = rows[0]?.room
      const granted_right_str: string = rows[0]?.granted_right || ""
      const groups = granted_right_str.split(";;")
      if (rid) {
        const mm = model.maps[rid]
        if (mm) {
          rooms_ok.push({ id: rid, groups })
        }
      }
    }
    return rooms_ok
  }

  static getDefaultRooms(): { id: RoomId; groups: UserGroupId[] }[] {
    return config.default_rooms
      .filter(rid => model.maps[rid])
      .map(rid => {
        return { id: model.maps[rid].room_id, groups: ["__user__"] }
      })
  }
}
