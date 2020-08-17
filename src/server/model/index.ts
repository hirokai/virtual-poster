import Redis from "ioredis"

import dotenv from "dotenv"
dotenv.config()

import {
  Poster,
  UserOperationLog,
  UserId,
  RoomId,
  PosterId,
} from "../../../@types/types"
import { ChatModel } from "./chat"
import { MapModel } from "./map"
import { PeopleModel } from "./people"
export { ChatModel } from "./chat"
export { MapModel } from "./map"
export { PeopleModel } from "./people"
import _ from "lodash"
import shortid from "shortid"

import cluster from "cluster"
import { join as joinPath } from "path"

const PRODUCTION = process.env.NODE_ENV == "production"
const DEBUG_LOG = !!process.env.DEBUG_LOG || !PRODUCTION
const LOG_LEVEL = process.env.LOG_LEVEL
  ? parseInt(process.env.LOG_LEVEL)
  : undefined

export const POSTGRES_CONNECTION_STRING = process.env.NODE_TEST
  ? "postgres://postgres@localhost/virtual_poster_test"
  : process.env.POSTGRES_CONNECTION_STRING ||
    "postgres://postgres@localhost/virtual_poster"

import pg from "pg-promise"
import pgt from "pg-promise/typescript/pg-subset"

export const pgp = pg()
const connections: { [id: string]: pg.IDatabase<unknown, pgt.IClient> } = {}
export const dbWith = (
  connection: string
): pg.IDatabase<unknown, pgt.IClient> => {
  if (!(connection in connections)) {
    connections[connection] = pg()(connection)
  }
  return connections[connection]
}

// Helper for linking to external query files:
function sql(file) {
  const fullPath = joinPath(__dirname, file)
  return new pg.QueryFile(fullPath, { minify: true })
}

// Create a QueryFile globally, once per file:
export const resetDb = sql("../../../migration/schema.sql")

export let db: pg.IDatabase<unknown, pgt.IClient>

import * as bunyan from "bunyan"
export const log = bunyan.createLogger({
  name: "model",
  src: !PRODUCTION,
  level: LOG_LEVEL || (DEBUG_LOG ? 1 : "info"),
})

const user_log = bunyan.createLogger({
  name: "user_operations",
  src: false,
  streams: [
    // {
    //   level: 1,
    //   stream: process.stdout, // log INFO and above to stdout
    // },
    {
      level: 1,
      path: "./db/all_user_operations.log", // log ERROR and above to a file
    },
  ],
})

export const redis = {
  accounts: new Redis({ db: 0 }),
  staticMap: new Redis({ db: 1 }),
  sockets: new Redis({ db: 2 }),
}

export function userLog(obj: UserOperationLog): void {
  user_log.info(obj)
}

export let maps: { [room_id: string]: MapModel }
export let people: PeopleModel
export let chat: ChatModel

export class Posters {
  static async get(poster_id: string): Promise<Poster | null> {
    log.debug(poster_id)
    const rows = await db.query(
      `SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image from poster as p join map_cell as c on p.location=c.id where p.id=$1;`,
      [poster_id]
    )
    const d = rows[0]
    return d as Poster
  }
  static async set(poster: Poster): Promise<boolean> {
    await db.query(
      `UPDATE poster set location=$1,title=$2,author=$3,last_updated=$4 where id=$5;`,
      [
        poster.location,
        poster.title,
        poster.author,
        poster.last_updated,
        poster.id,
      ]
    )
    return true
  }
  static async delete(poster_id: string): Promise<boolean> {
    await db.query(`DELETE from poster where id=$1;`, [poster_id])
    return true
  }
  static async getOfUser(
    room_id: RoomId,
    user_id: UserId
  ): Promise<Poster | null> {
    const posters = await Posters.getAll(room_id)
    return _.find(posters, p => p.author == user_id) || null
  }
  static async getAllOfUser(user_id: UserId): Promise<Poster[] | null> {
    const posters = await Posters.getAll(null)
    return _.filter(posters, p => p.author == user_id) || null
  }
  static async getAll(room_id: RoomId | null): Promise<Poster[]> {
    const rows = await (room_id
      ? db.query(
          `SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image from poster as p join map_cell as c on p.location=c.id where location in (SELECT id from map_cell where room=$1);`,
          [room_id]
        )
      : db.query(
          `SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image from poster as p join map_cell as c on p.location=c.id;`
        ))
    return rows.map(d => {
      // d["room"] = room_id
      return d
    })
  }
  static genPosterId(): PosterId {
    return "P" + shortid.generate()
  }
}

export async function initData(
  pg_connection_string: string,
  monitoring = true
): Promise<RoomId[]> {
  log.info("initData() with", pg_connection_string)
  db = dbWith(pg_connection_string)
  await redis.accounts.flushdb()
  // await redis.people.flushdb()
  await redis.staticMap.flushdb()
  await redis.sockets.flushdb()
  const rows = await db.query("select * from room;")
  if (monitoring) {
    setInterval(() => {
      db.query("select * from room;")
        .then(rows => {
          const new_ids = rows.map(r => r.id)
          const old_ids = Object.keys(maps)
          const added = _.difference(new_ids, old_ids)
          const removed = _.difference(old_ids, new_ids)
          if (added.length > 0 || removed.length > 0) {
            log.info("Change in rooms: W#", cluster?.worker?.id, added, removed)
            for (const r of rows) {
              if (added.indexOf(r.id) != -1) {
                maps[r.id] = new MapModel(r.id, r.name)
              }
            }
            for (const r of removed) {
              delete maps[r]
              log.debug(
                cluster?.worker?.id
                  ? "Room deleted: W#" + cluster?.worker?.id
                  : "Room deleted",
                r
              )
            }
          }
          // log.debug("Now rooms: W#", cluster?.worker?.id, Object.keys(maps))
        })
        .catch(err => {
          log.error(err)
        })
    }, 5000)
  }
  maps = {}
  const rooms: RoomId[] = []
  for (const r of rows) {
    maps[r["id"]] = new MapModel(r["id"], r["name"])
    rooms.push(r["id"])
  }
  people = new PeopleModel()
  await people.init()
  chat = new ChatModel()
  for (const map of Object.values(maps)) {
    await map.writeRedisCache(people)
  }
  return rooms
}
