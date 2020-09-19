import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import { RoomId, MapEnterResponse } from "@/@types/types"
import { protectedRoute } from "../auth"
import { emit } from "../socket"

const PRODUCTION = process.env.NODE_ENV == "production"

async function maps_api_routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.addHook("preHandler", protectedRoute)

  fastify.get("/maps", async req => {
    const rows =
      req["requester_type"] == "admin"
        ? await model.db.query(
            `SELECT room.id,room.name,count(c.poster_number) as poster_location_count,count(poster.id) as poster_count from room left join map_cell as c on room.id=c.room LEFT JOIN poster ON c.id=poster.location GROUP BY room.id;`
          )
        : await model.db.query(
            `SELECT room.id,room.name,count(c.poster_number) as poster_location_count,count(poster.id) as poster_count from room left join map_cell as c on room.id=c.room LEFT JOIN poster ON c.id=poster.location JOIN person_room_access AS a ON room.id=a.room WHERE a.person=$1 GROUP BY room.id;`,
            [req["requester"]]
          )
    const result: {
      id: RoomId
      name: string
      numCols: number
      numRows: number
    }[] = []
    for (const r of rows) {
      const map = model.maps[r.id]
      r.numCols = await map.numCols()
      r.numRows = await map.numRows()
      r.poster_count = parseInt(r.poster_count)
      r.poster_location_count = parseInt(r.poster_location_count)
      result.push(r)
    }
    return result
  })

  fastify.get<any>("/maps/:roomId", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Static map get failed")
      return
    }
    return await map.getStaticMap()
  })

  fastify.post<any>("/maps/:roomId/posters/:posterId/approach", async req => {
    console.log("APPROACH", req["requester"])
    emit.room(req["requester"]).moveRequest({ to_poster: req.params.posterId })
    return { ok: true }
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
      socket_url: PRODUCTION ? "/" : "http://localhost:5000/",
      socket_protocol: "Socket.IO",
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
}

export default maps_api_routes
