import {
  Cell,
  Poster,
  Announcement,
  Point,
  PosterId,
  RoomId,
  UserId,
  MapCellId,
  TryToMoveResult,
  MapCellRDB,
} from "@/../@types/types"
import shortid from "shortid"
import { redis, log, db, POSTGRES_CONNECTION_STRING } from "./index"
import * as model from "./index"
import _ from "lodash"
import { mkKey, calcDirection } from "../../common/util"
import cluster from "cluster"
import * as Posters from "./posters"

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
    map_data: string
  ): Promise<{ map?: MapModel; error?: string }> {
    const room_id = MapModel.genRoomId()
    await db.query(`INSERT INTO room (id,name) values ($1,$2)`, [room_id, name])
    const m = new MapModel(room_id, name)
    const res = await m.importMapString(map_data)
    if (!res) {
      return { error: "Import failed" }
    }
    model.maps[room_id] = m
    return { map: m }
  }

  // Give a user room access and place in a map.
  async addUser(
    user_id: UserId,
    assignPosition = true,
    role: "user" | "admin" = "user"
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await db.query(
        `INSERT INTO person_room_access (room,person,"role") values ($1,$2,$3) ON CONFLICT ON CONSTRAINT person_room_access_pkey DO NOTHING`,
        [this.room_id, user_id, role]
      )
      if (assignPosition) {
        const r = await this.assignUserPosition(user_id)
        return {
          ok: r.ok,
          error: r.ok ? undefined : "AssignPostion error: " + r.status,
        }
      }
      return { ok: true }
    } catch (err) {
      console.log(err)
      return { ok: false, error: "DB error" }
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
              if (c.open) {
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
    let poster_number = 1
    for (const c of _.flatten(map.cells)) {
      await db.query(
        `INSERT INTO map_cell (id,room,x,y,kind,poster_number) values ($1,$2,$3,$4,$5,$6);`,
        [
          c.id,
          this.room_id,
          c.x,
          c.y,
          c.kind,
          c.kind == "poster" ? poster_number : null,
        ]
      )
      if (c.kind == "poster") {
        poster_number += 1
      }
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
    await model.initData(POSTGRES_CONNECTION_STRING)
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
    status: "New" | "ComeBack" | "NoAccess" | "Deleted" | "NoSpace"
  }> {
    for (let count = 0; count < 100; count++) {
      const r = await db.query(
        `SELECT count(*) from person_room_access where room=$1 and person=$2;`,
        [this.room_id, user_id]
      )
      if (r[0].count == 0) {
        return { ok: false, status: "NoAccess" }
      }
      const pos: Point | null = await this.getRandomOpenPos()
      if (!pos) {
        log.error("No open space")
        return { ok: false, status: "NoSpace" }
      }
      const r2 = await model.people.setPos(
        user_id,
        this.room_id,
        pos,
        "down",
        true
      )
      if (r2) {
        return { ok: true, status: "New" }
      }
    }
    return { ok: false, status: "NoSpace" }
  }
  async enterRoom(
    user_id: UserId
  ): Promise<{
    ok: boolean
    status: "New" | "ComeBack" | "NoAccess" | "Deleted" | "NoSpace"
  }> {
    const r1 = (
      await db.query(`SELECT count(*) from room where id=$1`, [this.room_id])
    )[0].count
    if (r1 == 0) {
      log.warn("Room was deleted")
      return { ok: false, status: "Deleted" }
    }
    const rows = await db.query(
      `SELECT count(*) FROM person_position where person=$1 and room=$2;`,
      [user_id, this.room_id]
    )
    if (rows[0].count == 0) {
      const r = await this.assignUserPosition(user_id)
      return r
    } else {
      return { ok: true, status: "ComeBack" }
    }
  }

  async setTyping(user: UserId, typing: boolean): Promise<void> {
    await redis.accounts.set(
      "typing:" + this.room_id + ":" + user,
      typing ? "1" : "0"
    )
  }
  async getRandomOpenPos(): Promise<Point | null> {
    const cells = await this.getAllStaticMapCellsFromRDB()
    const ps = await model.people.getAllPeopleList(this.room_id)
    const people_places = _.fromPairs(
      ps.map(p => {
        return ["" + p.x + "." + p.y, true]
      })
    )
    const open_cells = _.shuffle(
      _.filter(cells, c => {
        return (
          c.open &&
          c.kind != "poster_seat" &&
          !people_places["" + c.x + "." + c.y]
        )
      })
    )
    // console.log("open_cells: ", open_cells.length, people_places)
    if (open_cells.length == 0) {
      return null
    } else {
      const c = open_cells[0]
      return { x: c.x, y: c.y }
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
    result?: TryToMoveResult
  }> {
    try {
      const result: TryToMoveResult = {}
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
      if (!to_cell.open) {
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
      const r = await model.people.setPos(d.user, this.room_id, to, direction)
      if (r) {
        result.position = to
        result.direction = direction
        return { result }
      } else {
        return { error: "setPos failed", result }
      }
    } catch (err) {
      log.error(err)
      return { error: err }
    }
  }

  async anotherPersonExistsAt(user: UserId, pos: Point): Promise<boolean> {
    const rows = await db.query(
      `SELECT 1 FROM person_position WHERE room=$1 AND person<>$2 AND x=$3 AND y=$4`,
      [this.room_id, user, pos.x, pos.y]
    )
    return rows.length > 0
  }

  async getStaticMapAt(x: number, y: number): Promise<Cell | null> {
    const s = await redis.staticMap.get(mkKey(this.room_id, x, y))
    return s ? JSON.parse(s) : null
  }
  async getAllStaticMapCellsFromRDB(): Promise<Cell[]> {
    const rows = await db.many<MapCellRDB>(
      `SELECT * from map_cell where room=$1`,
      [this.room_id]
    )
    return rows.map(r => {
      const r2: Cell = {
        id: r.id,
        x: r.x,
        y: r.y,
        kind: r.kind,
        open: r.kind == "grass" || r.kind == "mud" || r.kind == "poster_seat",
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
    title?: string
  ): Promise<{ ok: boolean; poster?: Poster; error?: string }> {
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
    if (overwrite) {
      res = await db.query(
        `INSERT INTO poster (id,last_updated,title,author,location) VALUES ($1,$2,$3,$4,$5) ON CONFLICT ON CONSTRAINT poster_location_key DO UPDATE SET id=$1,last_updated=$2,title=$3,author=$4 RETURNING id;`,
        [poster_id, last_updated, title, author, cells[0].id]
      )
      log.debug("poster overwrite", res)
    } else {
      res = await db.query(
        `INSERT INTO poster (id,last_updated,title,author,location) VALUES ($1,$2,$3,$4,$5) RETURNING id;`,
        [poster_id, last_updated, title, author, cells[0].id]
      )
    }
    if (res.length == 0 || res[0].id != poster_id) {
      return { ok: false, error: "DB error" }
    }
    return {
      ok: true,
      poster: {
        id: poster_id,
        title: title,
        author: author,
        last_updated,
        room: this.room_id,
        location: res[0].location,
        x: cells[0].x,
        y: cells[0].y,
      },
    }
  }
  async freePosterLocation(
    poster_number: number,
    author: UserId
  ): Promise<boolean> {
    try {
      const rows = await db.query(
        `DELETE FROM poster WHERE author=$1 AND location in (SELECT id FROM map_cell WHERE room=$2 AND poster_number=$3) RETURNING id;`,
        [author, this.room_id, poster_number]
      )
      return rows.length == 1
    } catch (err) {
      log.error(err)
      return false
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
    this.announcement = d
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
}
