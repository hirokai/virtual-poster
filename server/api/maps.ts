import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import { RoomId, MapEnterResponse, UserId } from "../../@types/types"
import { protectedRoute } from "../auth"
import { emit } from "../socket"
import { config } from "../config"

const PRODUCTION = process.env.NODE_ENV == "production"
const RUST_WS_SERVER = config.socket_server.system == "Rust"

async function maps_api_routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.addHook("preHandler", protectedRoute)

  fastify.get(
    "/maps",
    async (
      req
    ): Promise<
      {
        id: RoomId
        name: string
        numCols: number
        numRows: number
        poster_count: number
        poster_location_count: number
      }[]
    > => {
      const rows: any[] =
        req["requester_type"] == "admin"
          ? await model.db.query(
              `
        SELECT
            room.id,
            room.name,
            count(c.poster_number) AS poster_location_count,
            count(poster.id) AS poster_count,
            max(c.x) AS max_x,
            max(c.y) AS max_y,
            room.room_owner
        FROM
            room
            LEFT JOIN map_cell AS c ON room.id = c.room
            LEFT JOIN poster ON c.id = poster.location
        GROUP BY
            room.id;`
            )
          : await model.db.query(
              `
        SELECT
            room.id,
            room.name,
            count(c.poster_number) as poster_location_count,
            count(poster.id) as poster_count,
            max(c.x) as max_x,
            max(c.y) as max_y,
            room.room_owner
        FROM
            room
            LEFT JOIN map_cell as c on room.id = c.room
            LEFT JOIN poster ON c.id = poster.location
            JOIN person_room_access AS a ON room.id = a.room
        WHERE
            a.person = $1
        GROUP BY
            room.id;`,
              [req["requester"]]
            )
      const result = rows.map(r => {
        const numCols: number = r["max_y"] + 1
        const numRows: number = r["max_x"] + 1
        const poster_count = parseInt(r.poster_count)
        const poster_location_count = parseInt(r.poster_location_count)
        return {
          id: r["id"],
          name: r["name"],
          poster_location_count,
          poster_count,
          numCols,
          numRows,
          owner: r["room_owner"],
        }
      })
      return result
    }
  )

  fastify.post<any>("/maps", async req => {
    const name: string = req.body.name
    const template: string = req.body.template

    const { map_data } = await model.MapModel.loadTemplate(template)
    if (!map_data) {
      return { ok: false, error: "Template not found" }
    } else {
      const { map: mm, error } = await model.MapModel.mkNewRoom(
        name,
        map_data,
        req["requester"]
      )
      if (!mm) {
        return { ok: false, error }
      }
      await model.maps[mm.room_id].addUser(req["requester"], true)
      return { ok: true, room: { id: mm.room_id, name } }
    }
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
      const data = await map.getStaticMap()
      model.redis.staticMap
        .set(key, JSON.stringify(data))
        .then(() => {
          //
        })
        .catch(err => {
          console.error(err)
        })
      return data
    }
  })

  fastify.delete<any>("/maps/:roomId", async (req, res) => {
    const userId = req["requester"]
    const roomId = req.params.roomId
    const m = model.maps[roomId]
    if (!m) {
      throw { statusCode: 404 }
    }
    if (req["requester_type"] != "admin") {
      const owned_rooms = (
        await model.db.query<{ id: RoomId }[]>(
          `SELECT 1 FROM room WHERE room_owner=$1 AND id=$2`,
          [userId, roomId]
        )
      ).map(r => r.id)
      if (owned_rooms.length != 1) {
        return { ok: false, error: "You are not the owner of the room." }
      }
    }
    const ok = await m.deleteRoomFromDB()
    if (ok) {
      delete model.maps[roomId]
    }
    return { ok }
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
    const roomId = req.params.roomId
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
}

export default maps_api_routes
