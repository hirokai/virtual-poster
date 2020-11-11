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
  ChatGroupId,
} from "../../@types/types"
import shortid from "shortid"
import { redis, log, db, pgp, POSTGRES_CONNECTION_STRING } from "./index"
import * as model from "./index"
import _ from "lodash"
import { mkKey, calcDirection, isOpenCell } from "../../common/util"
import cluster from "cluster"
import * as Posters from "./posters"
import { config } from "../config"
import { emit } from "../socket"
import { promisify } from "util"
import fs from "fs"
import path from "path"
const readFile = promisify(fs.readFile)

const USE_S3_CDN = config.aws.s3.via_cdn
const S3_BUCKET = config.aws.s3.bucket
const CDN_DOMAIN = config.aws.cloud_front.domain
const DEFAULT_ROOMS = config.default_rooms

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
    map_data: string,
    allow_poster_assignment: boolean,
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
      `INSERT INTO room (id,name,room_owner,allow_poster_assignment) values ($1,$2,$3,$4)`,
      [room_id, name, owner, allow_poster_assignment]
    )
    const m = new MapModel(room_id, name)
    const res = await m.importMapString(map_data)
    if (!res) {
      await db.query(`DELETE FROM room WHERE id=$1`, [room_id])
      return { error: "Import failed" }
    }
    model.maps[room_id] = m
    return { map: m }
  }

  async getOwner(): Promise<UserId | undefined> {
    const rows = await db.query(`SELECT room_owner FROM room WHERE id=$1`, [
      this.room_id,
    ])
    return rows[0]?.room_owner
  }

  async get(): Promise<{
    cells: Cell[][]
    numRows: number
    numCols: number
    allow_poster_assignment: boolean
  }> {
    const data1 = await this.getStaticMap()
    const allow_poster_assignment = !!(
      await model.db.oneOrNone(
        `SELECT allow_poster_assignment FROM room WHERE id=$1`,
        [this.room_id]
      )
    )?.allow_poster_assignment
    const data = { ...data1, allow_poster_assignment }
    return data
  }

  async getMetadata(): Promise<{
    id: RoomId
    allow_poster_assignment: boolean
  }> {
    const allow_poster_assignment = !!(
      await model.db.oneOrNone(
        `SELECT allow_poster_assignment FROM room WHERE id=$1`,
        [this.room_id]
      )
    )?.allow_poster_assignment
    return { id: this.room_id, allow_poster_assignment }
  }

  // Give a user room access and optionally place in a map.
  async addUser(
    user_email: string,
    assignPosition = true,
    role: "user" | "admin" = "user",
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
      const user_id = await model.people.getUserIdFromEmail(user_email)
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

  async writeRedisCache(): Promise<void> {
    await this.initStaticMap()
    await this.initLiveObjects()
  }
  async initStaticMap(): Promise<void> {
    const cells = await this.getAllStaticMapCellsFromRDB()
    for (const c of cells) {
      await redis.staticMap.set(
        mkKey(this.room_id, c.x, c.y),
        JSON.stringify(c)
      )
    }
    const numCols =
      cells.length == 0 ? 0 : (_.max(cells.map(c => c.x || 0)) || 0) + 1
    const numRows =
      cells.length == 0 ? 0 : (_.max(cells.map(c => c.y || 0)) || 0) + 1
    await redis.staticMap.set(this.room_id + ":num_cols", numCols)
    await redis.staticMap.set(this.room_id + ":num_rows", numRows)
  }
  async initLiveObjects(): Promise<void> {
    const people = await model.people.getAllPeopleList(this.room_id)

    for (const p of people) {
      await redis.accounts.set(
        "pos:" + this.room_id + ":" + p.id,
        p.x + "." + p.y + "." + p.direction
      )
    }
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
  static loadMapString(
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
            return { id, x, y, kind: "grass" }
          } else if (map_rows[y][x] == "W") {
            return { id, x, y, kind: "wall" }
          } else if (map_rows[y][x] == "P") {
            return { id, x, y, kind: "poster" }
          } else if (map_rows[y][x] == "M") {
            return { id, x, y, kind: "mud" }
          } else if (map_rows[y][x] == "{") {
            return { id, x, y, kind: "water" }
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

  async importMapString(
    str: string
  ): Promise<{ cells: Cell[][]; numRows: number; numCols: number } | null> {
    // Import and overwrite the map with string data.
    const map = MapModel.loadMapString(str)
    if (!map) {
      return null
    }
    let poster_number = 0
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
          kind: c.kind,
          poster_number: c.kind == "poster" ? poster_number : null,
        }
      })
      await db.none(
        pgp.helpers.insert(
          dataMulti,
          ["id", "room", "x", "y", "kind", "poster_number"],
          "map_cell"
        )
      )
    }
    //Reload Redis cache
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
    const cells: Cell[][] = _.range(numRows).map(() => {
      return new Array(numCols).fill(null)
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
  }> {
    log.debug("assignUserPosition()", user_id)
    const user = await model.people.get(user_id, true)
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
    return { ok: true, status: "New" }
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
      `SELECT count(*) FROM person_position where person=$1 and room=$2;`,
      [user_id, this.room_id]
    )
    if (rows[0].count == 0) {
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
      return r
    } else {
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
            AND kind NOT IN ('water','wall','poster','poster_seat')
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
        log.warn("Destination is not open")
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
        x: r.x,
        y: r.y,
        kind: r.kind,
      }
      if (r.poster_number != null) {
        r2.poster_number = r.poster_number
      }
      if (r.custom_image != null) {
        r2.custom_image = r.custom_image
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
      if (poster.author != requester && typ != "admin") {
        return {
          ok: false,
          poster_id: poster.id,
          error: "Not my poster",
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
      await db.query(`DELETE from map_cell where room=$1;`, [this.room_id])
      await db.query(`DELETE from person_position where room=$1;`, [
        this.room_id,
      ])
      await db.query(`DELETE from person_room_access where room=$1;`, [
        this.room_id,
      ])
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
  ): Promise<RoomId[] | undefined> {
    // If it has non-existent room ID, return undefined
    const codes = code.split(":")
    const rooms_ok: RoomId[] = []
    for (const code of codes) {
      const rows = await model.db.query(
        `SELECT room FROM room_access_code WHERE code=$1`,
        [code]
      )
      const rid: string | undefined = rows[0]?.room
      if (rid) {
        const mm = model.maps[rid]
        if (mm) {
          rooms_ok.push(rid)
        }
      }
    }
    return rooms_ok.concat(DEFAULT_ROOMS)
  }
}
