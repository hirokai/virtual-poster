import Redis from "ioredis"

import dotenv from "dotenv"
dotenv.config()

import { UserOperationLog, RoomId, UserId } from "../../@types/types"
import * as ChatModule from "./chat"
export const chat = ChatModule
import { MapModel } from "./maps"
import * as PeopleModule from "./people"
export const people = PeopleModule
import * as PosterModule from "./posters"
export const posters = PosterModule
export { MapModel } from "./maps"
import _ from "lodash"
import { config } from "../config"
import fs from "fs"
import cluster from "cluster"
import { join as joinPath } from "path"
import { emit } from "../socket"

const PRODUCTION = process.env.NODE_ENV == "production"

const DEBUG_LOG = config.api_server.debug_log

export const POSTGRES_CONNECTION_STRING = config.postgresql

import pg from "pg-promise"
import pgt from "pg-promise/typescript/pg-subset"

export const pgp = pg()
const connections: { [id: string]: pg.IDatabase<unknown, pgt.IClient> } = {}
export const dbWith = (
  connection: string
): pg.IDatabase<unknown, pgt.IClient> => {
  if (!(connection in connections)) {
    connections[connection] = pg()({ connectionString: connection, max: 100 })
  }
  return connections[connection]
}

// Helper for linking to external query files:
function sql(file) {
  const fullPath = joinPath(__dirname, file)
  return new pg.QueryFile(fullPath, { minify: true })
}

// Create a QueryFile globally, once per file:
export const resetDb = sql("../../migration/schema.sql")

export let db: pg.IDatabase<unknown, pgt.IClient>

import * as bunyan from "bunyan"
export const log = bunyan.createLogger({
  name: "model",
  src: !PRODUCTION,
  level: DEBUG_LOG ? 1 : bunyan.FATAL + 1,
})

const data_folder = "db"
if (!fs.existsSync(data_folder)) {
  fs.mkdirSync(data_folder, { recursive: true })
}

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
  accounts: new Redis(config.redis + "/0"),
  staticMap: new Redis(config.redis + "/1"),
  sockets: new Redis(config.redis + "/2"),
  sessions: new Redis(config.redis + "/3"),
}

export function userLog(obj: UserOperationLog): void {
  user_log.info(obj)
}

export let maps: { [room_id: string]: MapModel }

export async function initData(
  pg_connection_string: string,
  monitoring = true
): Promise<RoomId[]> {
  // log.info("initData() with", pg_connection_string)
  db = dbWith(pg_connection_string)
  await redis.accounts.flushdb()
  await redis.staticMap.flushdb()
  await redis.sockets.flushdb()
  const rows = await db.query("select * from room;")
  const inactive_counts: {
    [room_id: string]: { [user_id: string]: number }
  } = {}

  if (monitoring) {
    setInterval(async () => {
      const rows = await db.query("select * from room;")
      const new_ids = rows.map(r => r.id)
      const old_ids = Object.keys(maps)
      const added = _.difference(new_ids, old_ids)
      const removed = _.difference(old_ids, new_ids)

      for (const r of added) {
        inactive_counts[r] = {}
      }
      for (const r of removed) {
        delete inactive_counts[r]
      }

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

      for (const room_id of new_ids) {
        const connected_users: Set<UserId> = new Set(
          await redis.accounts.smembers(
            "connected_users:room:" + room_id + ":__all__"
          )
        )
        const all_users = new Set<UserId>(
          (
            await db.query(
              `
          SELECT
              person.id
          FROM
              person
              LEFT JOIN person_position AS pos ON person.id = pos.person
          WHERE
              pos.room = $1;`,
              room_id
            )
          ).map(r => r.id as UserId)
        )
        const inactive_users: Set<UserId> = all_users["difference"](
          connected_users
        )
        for (const user_id of inactive_users) {
          if (inactive_counts[room_id][user_id] == undefined) {
            inactive_counts[room_id][user_id] = 0
          }
          inactive_counts[room_id][user_id] += 1
        }
        for (const user_id of connected_users) {
          inactive_counts[room_id][user_id] = 0
        }
        for (const user_id of all_users) {
          if (inactive_counts[room_id][user_id] >= 3 && maps[room_id]) {
            const rows = await db.query(
              `SELECT last_updated FROM person_position WHERE person=$1 AND room=$2;`,
              [user_id, room_id]
            )
            if (rows[0] && Date.now() - +rows[0].last_updated >= 5000 * 3) {
              const p = await maps[room_id].purgePersonFromRestrictedArea(
                user_id
              )
              if (p) {
                emit.channel(room_id).pushSocketQueue("moved", {
                  ...p,
                  room: room_id,
                  user: user_id,
                })
              }
            }
          }
        }
      }
    }, 5000)
  }
  maps = {}
  const rooms: RoomId[] = []
  for (const r of rows) {
    const room_id = r["id"]
    maps[room_id] = new MapModel(room_id, r["name"])
    rooms.push(room_id)
    inactive_counts[room_id] = {}
  }
  await people.init()
  for (const map of Object.values(maps)) {
    await map.writeRedisCache()
  }
  return rooms
}

Set.prototype["difference"] = function(setB) {
  const difference = new Set(this)
  for (const elem of setB) {
    difference.delete(elem)
  }
  return difference
}
