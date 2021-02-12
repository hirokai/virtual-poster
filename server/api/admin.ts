import * as model from "../model"
import { FastifyInstance, FastifyRequest } from "fastify"
import { UserId, RoomId, Person, UserGroupId } from "../../@types/types"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { emit } from "../socket"
import * as Papa from "papaparse"
import * as yaml from "js-yaml"
import multer from "fastify-multer"
import { MapModel, POSTGRES_CONNECTION_STRING } from "../model"
import { config } from "../config"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1000 * 1000 * 10 },
}).single("file")

async function routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.decorateRequest("requester", "")
  fastify.decorateRequest("requester_type", "")

  fastify.addHook("preHandler", protectedRoute)
  fastify.addHook(
    "preHandler",
    async (req: FastifyRequest<any, any>, reply) => {
      if (req["requester_type"] != "admin") {
        await reply.code(403)
      }
    }
  )

  fastify.get("/debug_token", async (req, res) => {
    return { debug_token: config.debug_token }
  })

  fastify.get("/admin/export/people", async (req, res) => {
    const people = await model.people.getAllPeopleList(true)
    await res.type("application/json")
    return JSON.stringify(people, null, 2)
  })

  fastify.get("/admin/export/chat_groups", async (req, res) => {
    const groups = await model.chat.getGroupList(null)
    await res.type("application/json")
    return JSON.stringify(groups, null, 2)
  })

  fastify.get("/admin/export/posters", async (req, res) => {
    const posters = await model.posters.getAll(null)
    await res.type("application/json")
    return JSON.stringify(posters, null, 2)
  })

  fastify.get<any>("/admin/export/maps/:room/text", async (req, res) => {
    const thisMap = model.maps[req.params.room]
    if (!thisMap) {
      throw { statusCode: 404 }
    }
    const map = await thisMap.getStaticMap()
    const cells = _.map(_.range(map.numRows), () => {
      return _.map(_.range(map.numCols), () => "")
    })
    const d = { grass: ".", mud: "M", water: "{", wall: "W", poster: "P" }
    for (const c of _.flatten(map.cells)) {
      cells[c.y][c.x] = d[c.kind]
    }
    await res.type("text/plain")
    return cells.map(row => row.join("")).join("\n")
  })

  fastify.post("/admin/import/map.yaml", { preHandler: upload }, async req => {
    const text = new TextDecoder().decode(req["file"].buffer)
    const data = yaml.safeLoad(text) as Record<string, any>
    fastify.log.debug(Object.keys(data), data["cells"])
    if (!data || !data["name"] || !data["cells"]) {
      return { ok: false, error: "Invalid data format" }
    }
    const { map: mm } = await MapModel.mkNewRoom(
      data["name"],
      data["cells"],
      false,
      "all_initial",
      req["requester"]
    )
    if (!mm) {
      return { ok: false, error: "Import failed" }
    }
    await model.maps[mm.room_id].addUser(
      req["requester_email"],
      req["requester"],
      true,
      "admin",
      req["requester"]
    )
    return { ok: true, room: { id: mm.room_id, name: data["name"] } }
  })

  fastify.post(
    "/admin/import/people.csv",
    { preHandler: upload },
    async req => {
      const text = new TextDecoder().decode(req["file"].buffer)
      const people: {
        name: string
        email: string
        rooms: { id: RoomId; groups: UserGroupId[] }[]
        posters: { room: RoomId; loc: string; title?: string }[]
      }[] = _.compact(
        Papa.parse<string[]>(text)
          .data.slice(1)
          .map((row: string[]) => {
            try {
              const r2 = row[2] as string
              const r3 = row[3] as string
              const r4 = row[4] as string
              const posters =
                r3 == ""
                  ? []
                  : r3.split(";").map(s => {
                      const [a, b] = s.split(":")
                      return { room: a, loc: b }
                    })
              const titles = r4 != "" ? r4.split("@@@@") : []
              const rooms =
                r2 == ""
                  ? []
                  : r2
                      .split(";")
                      .filter(s => s != "")
                      .map(s => {
                        const ts = s.split(":")
                        return { id: ts[0], groups: ts[1]?.split(",") || [] }
                      })
              return {
                name: row[0] as string,
                email: row[1] as string,
                rooms,
                posters: posters.map((p, i): {
                  room: RoomId
                  loc: string
                  title?: string
                } => {
                  if (titles[i]) {
                    p["title"] = titles[i]
                  }
                  return p
                }),
              }
            } catch {
              return null
            }
          })
      )
      const people_result: {
        user_id?: string
        email: string
        name: string
        ok: boolean
        error?: string
      }[] = []
      const merge_strategy: "append" | "replace" | "reject" = "append"
      for (const p of people) {
        if (p.name == "" || p.email == "") {
          people_result.push({
            ok: false,
            email: p.email,
            name: p.name,
            error: "Name or email missing",
          })
          continue
        }
        const avatar = model.people.randomAvatar()
        const { user, error } = await model.people.create(
          p.email,
          p.name,
          "user",
          avatar,
          p.rooms,
          merge_strategy
        )
        if (error || !user) {
          people_result.push({ email: p.email, name: p.name, ok: false, error })
        } else {
          // if (merge_strategy == "replace") {
          //   for (const po of p.posters) {
          //     const room = model.maps[po.room]
          //     if (room) {
          //       await room.freePosterLocation(po.loc, user_id)
          //     } else {
          //       log.warn("Room not found:", po.room)
          //     }
          //   }
          // }
          const new_person = await model.people.get(user.id)
          people_result.push({
            user_id: user.id,
            email: p.email,
            name: p.name,
            ok: true,
          })
          const new_person_for_emit = _.omit(new_person, ["email"]) as Person
          emit.pushSocketQueue("person", new_person_for_emit)
          for (const po of p.posters) {
            const room = model.maps[po.room]
            if (room) {
              await room.assignPosterLocation(
                po.loc,
                user.id,
                ["replace", "append"].indexOf(merge_strategy) != -1,
                po.title
              )
            } else {
              fastify.log.warn("Room not found:", po.room)
            }
          }
        }
      }
      await model.initMapModel(POSTGRES_CONNECTION_STRING)
      const all_rooms = Object.keys(model.maps)
      emit.channels(all_rooms).mapReset()
      return {
        ok: true,
        ok_count: people_result.filter(r => r.ok).length,
        people: people_result,
      }
    }
  )

  fastify.post<any>(
    "/admin/import/maps/:room/poster_locations",
    { preHandler: upload },
    async req => {
      const map = model.maps[req.params.room]
      if (!map) {
        throw { statusCode: 404 }
      }
      const csv_string = new TextDecoder().decode(req["file"].buffer)
      const posters = Papa.parse<string[]>(csv_string, {
        skipEmptyLines: true,
      })
        .data.slice(1)
        .map(row => {
          return {
            author: row[0] as UserId,
            poster_number: row[1],
            title: row[2] == "" ? undefined : (row[2] as string),
          }
        })
      const poster_assigned = await map.importPosterAssignment(posters, true)
      emit.channel(req.params.room).posterReset()

      return { ok: !!poster_assigned, poster_assigned }
    }
  )

  fastify.post<any>("/maps/:roomId/poster_slots_multi", async req => {
    const { roomId } = req.params
    const posters = req.body.posters as {
      poster_number: string
      user: UserId
      title?: string
    }[]
    const added: string[] = []
    const error_entries: string[] = []
    for (const p of posters) {
      const r = await model.maps[roomId].assignPosterLocation(
        p.poster_number,
        p.user,
        true,
        p.title
      )
      if (r.ok && r.poster) {
        added.push(p.poster_number)
        emit.channels([roomId, r.poster.author]).poster(r.poster)
        emit
          .channels([roomId, "::index", "::admin"])
          .room({ id: roomId, poster_count: r.poster_count })
      } else {
        error_entries.push(p.poster_number)
      }
    }
    if (error_entries.length > 0) {
      return {
        ok: false,
        error: "Errors on poster numbers: [" + error_entries.join(",") + "]",
        error_entries,
        added,
      }
    }
    return { ok: true, added }
  })
}

export default routes
