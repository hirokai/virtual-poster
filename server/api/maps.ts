import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import {
  RoomId,
  MapEnterResponse,
  UserId,
  Room,
  RoomUpdateSocketData,
  Cell,
} from "../../@types/types"
import { protectedRoute } from "../auth"
import { emit } from "../socket"
import { config } from "../config"
import { loadCustomMapCsv } from "../../common/maps"
import crypto from "crypto"

const PRODUCTION = process.env.NODE_ENV == "production"
const RUST_WS_SERVER = config.socket_server.system == "Rust"

async function maps_api_routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.addHook("preHandler", protectedRoute)

  fastify.get(
    "/maps",
    async (req): Promise<Room[]> => {
      const requester_email = req["requester_email"]
      const is_admin = req["requester_type"] == "admin"
      const rows: any[] = is_admin
        ? await model.db.query(
            `
        SELECT
            room.*,
            count(c.poster_number) AS poster_location_count,
            count(poster.id) AS poster_count,
            max(c.x) AS max_x,
            max(c.y) AS max_y,
            cd.code AS access_code,
            cd.active AS access_code_active
        FROM
            room
            LEFT JOIN room_access_code AS cd ON room.id = cd.room
            LEFT JOIN map_cell AS c ON room.id = c.room
            LEFT JOIN poster ON c.id = poster.location
        GROUP BY
            room.id,
            cd.code,
            cd.active;`
          )
        : await model.db.query(
            `
        SELECT
            room.*,
            count(c.poster_number) as poster_location_count,
            count(poster.id) as poster_count,
            max(c.x) as max_x,
            max(c.y) as max_y,
            cd.code AS access_code,
            cd.active AS access_code_active
        FROM
            room
            LEFT JOIN room_access_code AS cd ON room.id = cd.room
            LEFT JOIN map_cell as c on room.id = c.room
            LEFT JOIN poster ON c.id = poster.location
            JOIN person_room_access AS a ON room.id = a.room
        WHERE
            a.email = $1
        GROUP BY
            room.id,
            cd.code,
            cd.active;`,
            [requester_email]
          )
      const result: Room[] = []
      for (const r of rows) {
        const room_id = r["id"]
        const numCols: number = r["max_y"] + 1
        const numRows: number = r["max_x"] + 1
        const poster_count = parseInt(r.poster_count)
        const poster_location_count = parseInt(r.poster_location_count)
        const allow_poster_assignment = r["allow_poster_assignment"]

        const rows1 = await model.db.query(
          `SELECT count(*) as c FROM person_position WHERE room=$1`,
          [room_id]
        )
        const rows2 = await model.db.query(
          `SELECT count(*) as c FROM person_room_access WHERE room=$1`,
          [room_id]
        )

        const access_code_active = r["access_code_active"]
        const owner = r["room_owner"]
        const is_owner = req["requester"] == owner

        const num_people_joined: number = +rows1[0]["c"]
        const num_people_with_access: number | undefined =
          is_admin || is_owner ? +rows2[0]["c"] : undefined

        const num_people_active = await model.redis.accounts.scard(
          "connected_users:room:" + room_id + ":__all__"
        )

        result.push({
          id: room_id,
          name: r["name"],
          poster_location_count,
          poster_count,
          num_people_joined,
          num_people_with_access,
          allow_poster_assignment,
          numCols,
          numRows,
          owner,
          num_people_active,
          access_code:
            owner == req["requester"] || req["requester_type"] == "admin"
              ? { code: r["access_code"], active: access_code_active }
              : undefined,
        })
      }
      return result
    }
  )

  fastify.post<any>("/maps", async req => {
    const name: string = req.body.name
    const template: string | undefined = req.body.template
    const csv_str: string | undefined = req.body.data
    let allow_poster_assignment: boolean | undefined =
      req.body.allow_poster_assignment == undefined
        ? undefined
        : req.body.allow_poster_assignment

    const { map_data } = template
      ? await model.MapModel.loadTemplate(template)
      : { map_data: undefined }

    if (!map_data && !csv_str) {
      return {
        ok: false,
        error: "CSV data or valid template name has to be specified",
      }
    }
    let cells: Cell[][] = []
    let numRows = 0
    let numCols = 0
    if (csv_str) {
      const r = loadCustomMapCsv(csv_str, model.MapModel.genMapCellId)
      if (r) {
        cells = r.cells
        req.log.debug(cells)
        allow_poster_assignment =
          allow_poster_assignment == undefined
            ? r.allowPosterAssignment
            : allow_poster_assignment
        numRows = r.numRows
        numCols = r.numCols
      }
    }
    const { map: mm, error } = await model.MapModel.mkNewRoom(
      name,
      map_data || { cells, numRows, numCols },
      allow_poster_assignment || false,
      req["requester"]
    )
    if (!mm) {
      return { ok: false, error }
    }

    await model.maps[mm.room_id].addUser(
      req["requester_email"],
      true,
      "admin",
      req["requester"]
    )
    return { ok: true, room: { id: mm.room_id, name } }
  })

  fastify.get<any>("/maps/:roomId", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const key = "map_cache:" + map.room_id
    const cache = await model.redis.staticMap.get(key)
    if (cache) {
      await res
        .status(200)
        .header("content-type", "application/json")
        .send(cache)
      return
    } else {
      const data = await map.get()
      await model.redis.staticMap.set(key, JSON.stringify(data))
      return data
    }
  })

  fastify.post<any>("/maps/:roomId/reset_cache", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    if (req["requester_type"] != "admin") {
      const owner = await map.getOwner()
      if (!owner || owner != req["requester"]) {
        return {
          ok: false,
          error: "You are not the admin or owner of the room.",
        }
      }
    }
    await map.clearStaticMapCache()
    return { ok: true }
  })

  fastify.patch<any>("/maps/:roomId", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const allow_poster_assignment = req.body.allow_poster_assignment as
      | boolean
      | undefined
    if (allow_poster_assignment != undefined) {
      await model.db.query(
        `UPDATE room SET allow_poster_assignment=$1 WHERE id=$2`,
        [allow_poster_assignment, map.room_id]
      )
      await map.clearStaticMapCache()
      const data = await map.getMetadata()
      emit.room(data)
      return { ok: true }
    }
    return { ok: false, error: "Stub" }
  })

  fastify.delete<any>("/maps/:roomId", async (req, res) => {
    const roomId = req.params.roomId
    const m = model.maps[roomId]
    if (!m) {
      throw { statusCode: 404 }
    }
    if (req["requester_type"] != "admin") {
      const owner = await m.getOwner()
      if (!owner || owner != req["requester"]) {
        return {
          ok: false,
          error: "You are not the admin or owner of the room.",
        }
      }
    }
    const ok = await m.deleteRoomFromDB()
    if (ok) {
      delete model.maps[roomId]
    }
    return { ok }
  })

  const random_str = (N?: number): string => {
    const MAX_LENGTH = 100
    const MIN_LENGTH = 10
    N = N
      ? N
      : MIN_LENGTH + Math.floor(Math.random() * (MAX_LENGTH - MIN_LENGTH))
    return crypto
      .randomBytes(N)
      .toString("base64")
      .substring(0, N)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
  }

  fastify.delete<any>("/maps/:roomId/access_code", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const owner = await map.getOwner()
    if (owner != req["requester"] && req["requester_type"] != "admin") {
      return res.status(403).send("Not an owner or admin")
    }
    try {
      const rows = await model.db.query(
        `DELETE FROM room_access_code WHERE room=$1 RETURNING code`,
        [map.room_id]
      )
      await map.clearStaticMapCache()
      const data = await map.getMetadata()
      emit.room(data)
      const deleted_code = rows[0]?.code
      return { ok: true, deleted_code }
    } catch (e) {
      req.log.error(e)
      return { ok: false, error: "DB error" }
    }
  })

  fastify.patch<any>(
    "/maps/:roomId/access_code/:accessCode",
    async (req, res) => {
      const map = model.maps[req.params.roomId]
      if (!map) {
        await res.status(404).send("Not found")
        return
      }
      const active = req.body.active as boolean
      const rows = await model.db.query(
        `UPDATE room_access_code SET active=$1 WHERE room=$2`,
        [active, map.room_id]
      )
      await map.clearStaticMapCache()
      const data = await map.getMetadata()
      emit.room(data)

      return { ok: true }
    }
  )

  fastify.post<any>("/maps/:roomId/access_code/renew", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const rows = await model.db.query(
      `SELECT room_owner FROM room WHERE id=$1`,
      [map.room_id]
    )
    const owner: UserId | undefined = rows[0]?.room_owner
    if (owner != req["requester"] && req["requester_type"] != "admin") {
      return res.status(403).send("Not an owner or admin")
    }
    try {
      const code = random_str(20)
      await model.db.query(`BEGIN`)
      const r1 = await model.db.query(
        `SELECT active FROM room_access_code WHERE room=$1`,
        [map.room_id]
      )
      const active = r1[0] ? !!r1[0]?.active : true
      await model.db.query(`DELETE FROM room_access_code WHERE room=$1`, [
        map.room_id,
      ])
      await model.db.query(
        `INSERT INTO room_access_code (code,room,granted_right,timestamp,active) VALUES ($1,$2,$3,$4,$5)`,
        [code, map.room_id, "user", Date.now(), active]
      )
      await map.clearStaticMapCache()
      await model.db.query(`COMMIT`)
      const data = await map.getMetadata()
      emit.room(data)
      return { ok: true, code, active }
    } catch (e) {
      await model.db.query(`ROLLBACK`)
      req.log.error(e)
      return { ok: false, error: "DB error" }
    }
  })

  fastify.get<any>("/maps/:roomId/notifications", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    return model.people.getNotifications(req["requester"], map.room_id)
  })

  fastify.post<any>("/maps/:roomId/posters/:posterId/approach", async req => {
    // console.log("APPROACH", req["requester"])
    emit
      .channel(req["requester"])
      .moveRequest({ to_poster: req.params.posterId })
    return { ok: true }
  })

  fastify.post<any>("/maps/:roomId/posters/:posterId/enter", async req => {
    const roomId = req.params.roomId
    const posterId = req.params.posterId
    const map = model.maps[roomId]
    if (!map) {
      throw { statusCode: 404, message: "Room not found" }
    }
    const r = await model.posters.startViewing(
      req["requester"],
      roomId,
      posterId
    )
    if (r.ok && r.joined_time) {
      emit.channel(roomId).peopleUpdate([
        {
          id: req["requester"] as UserId,
          last_updated: r.joined_time,
          poster_viewing: posterId,
        },
      ])
    }
    return {
      ok: r.ok,
      error: r.error,
      image_allowed: r.image_allowed,
      image_url: r.image_url,
    }
  })

  fastify.post<any>("/maps/:roomId/posters/:posterId/leave", async req => {
    const roomId = req.params.roomId
    const posterId = req.params.posterId
    const map = model.maps[roomId]
    if (!map) {
      throw { statusCode: 404, message: "Room not found" }
    }
    const r = await model.posters.endViewing(req["requester"], roomId, posterId)
    if (r.ok && r.left_time) {
      emit.channel(roomId).peopleUpdate([
        {
          id: req["requester"] as UserId,
          last_updated: r.left_time,
          poster_viewing: null,
        },
      ])
    }
    return r
  })

  fastify.post<any>("/maps/:roomId/enter", async req => {
    //   if (cluster?.worker?.id) {
    //     log.debug(req.path + " Worker #", cluster.worker.id)
    //   }
    const roomId = req.params.roomId as string
    const map = model.maps[roomId]
    if (!map) {
      throw { statusCode: 404, message: "Room not found" }
    }

    const r = await map.enterRoom(req["requester"])

    const r2: MapEnterResponse = {
      ...r,
      socket_url: PRODUCTION
        ? RUST_WS_SERVER
          ? "/ws"
          : "/"
        : RUST_WS_SERVER
        ? "ws://localhost:8080/ws"
        : "http://localhost:5000/",
      socket_protocol: RUST_WS_SERVER ? "WebSocket" : "Socket.IO",
    }
    if (r.ok) {
      const rows = await model.db.query(
        `SELECT public_key FROM public_key WHERE person=$1;`,
        [req["requester"]]
      )
      r2.public_key = rows[0]?.public_key
      if (r.num_people_joined) {
        const d: RoomUpdateSocketData = {
          id: roomId,
          num_people_joined: r.num_people_joined,
        }
        emit.channels([roomId, "::admin", "::index", "::mypage"]).room(d)
      }
    }
    return r2
  })

  fastify.post<any>("/maps/:roomId/leave", async req => {
    const roomId = req.params.roomId
    const map = model.maps[roomId]
    if (!map) {
      throw { statusCode: 404, message: "Room not found" }
    }
    const r = await map.leaveRoom(req["requester"])
    return r
  })

  fastify.delete<any>("/maps/:roomId/people/:userId", async (req, res) => {
    const requester = req["requester"]
    const userId = req.params.userId as string
    const roomId = req.params.roomId as string
    const m = model.maps[roomId || ""]
    if (!m) {
      throw { statusCode: 404 }
    }
    const owner = await m.getOwner()
    if (
      req["requester_type"] != "admin" &&
      requester != userId &&
      requester != owner
    ) {
      throw { statusCode: 403, message: "Unauthorized" }
    }
    const r = await m.removeUser({ user_id: userId })
    if (r.ok) {
      const d: RoomUpdateSocketData = {
        id: roomId,
        num_people_joined: r.num_people_joined,
        num_people_with_access: r.num_people_with_access,
        num_people_active: r.num_people_active,
      }
      emit.room(d)
    }
    return r
  })
}

export default maps_api_routes
