import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import { protectedRoute } from "../auth"
import {
  RoomId,
  PersonInMap,
  PersonUpdate,
  ChatComment,
  ChatEvent,
  RoomUpdateSocketData,
} from "../../@types/types"
import { emit } from "../socket"
import * as admin from "firebase-admin"
import fs from "fs"
import { config } from "../config"

const serviceAccount: admin.ServiceAccount & {
  databaseURL: string
} = JSON.parse(fs.readFileSync(config.firebase_auth_credential, "utf-8"))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: serviceAccount.databaseURL,
})

async function routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.decorateRequest("requester", "")

  fastify.addHook("preHandler", protectedRoute)

  fastify.get<any>("/people", async req => {
    try {
      const with_email = req["requester_type"] == "admin" && !!req.query.email
      const rows = await model.people.getAllPeopleList(
        null,
        with_email,
        req["requester_type"] == "admin"
      )
      return rows
    } catch (err) {
      req.log.error(err)
    }
  })

  fastify.post<any>("/people", async req => {
    const email: string = req.body.email
    const name: string = req.body.name
    const avatar: string | undefined = req.body.avatar
    const rooms: RoomId[] | undefined = req.body.rooms
    const on_conflict: "reject" | "replace" | "append" | undefined =
      req.body.on_onflict
    const r = await model.people.create(
      email,
      name,
      "user",
      avatar || model.people.randomAvatar(),
      rooms || [],
      on_conflict || "reject"
    )
    return r
  })

  fastify.get<any>("/maps/:roomId/people", async (req, res) => {
    const roomId = req.params.roomId as string
    const map = model.maps[roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const room_owner = await map.getOwner()
    const with_email =
      (req["requester_type"] == "admin" || req["requester"] == room_owner) &&
      !!req.query.email
    const rs = await model.people.getAllPeopleList(
      req.params.roomId,
      with_email
    )
    return rs
  })

  fastify.get<any>("/maps/:roomId/people_allowed", async (req, res) => {
    const roomId = req.params.roomId as string
    const map = model.maps[roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const owner = await map.getOwner()
    const allowed =
      req["requester_type"] == "admin" || owner == req["requester"]
    if (!allowed) {
      await res.status(403).send("Unauthorized")
      return
    }
    const people = await map.getPeopleWithAccess()
    return { ok: true, people }
  })

  fastify.post<any>("/maps/:roomId/people_allowed", async (req, res) => {
    const roomId = req.params.roomId as string
    const map = model.maps[roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const owner = await map.getOwner()
    const allowed =
      req["requester_type"] == "admin" || owner == req["requester"]
    if (!allowed) {
      await res.status(403).send("Unauthorized")
      return
    }
    const email = req.body.email as string
    const r = await map.addUser(email, false, "user", req["requester"])
    if (r.ok) {
      const d: RoomUpdateSocketData = {
        id: roomId,
        num_people_joined: r.num_people_joined,
        num_people_with_access: r.num_people_with_access,
      }
      emit.channels(["::admin", "::index"]).room(d)
    }
    return r
  })

  fastify.delete<any>(
    "/maps/:roomId/people_allowed/:email",
    async (req, res) => {
      const roomId = req.params.roomId as string
      const email = req.params.email as string
      const map = model.maps[roomId]
      if (!map) {
        await res.status(404).send("Not found")
        return
      }
      const owner = await map.getOwner()
      const allowed =
        req["requester_type"] == "admin" || owner == req["requester"]
      if (!allowed) {
        await res.status(403).send("Unauthorized")
        return
      }
      const r = await map.removeUser({ email })
      if (r.ok) {
        const d: RoomUpdateSocketData = {
          id: roomId,
          num_people_joined: r.num_people_joined,
          num_people_with_access: r.num_people_with_access,
        }
        emit.channels(["::admin", "::index"]).room(d)
      }
      return r
    }
  )

  fastify.post<any>("/maps/:roomId/people_multi", async (req, res) => {
    const roomId = req.params.roomId as string
    const map = model.maps[roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const owner = await map.getOwner()
    if (owner != req["requester"] && req["requester_type"] != "admin") {
      return res.status(403).send("Not an owner or admin")
    }
    const people = req.body.people as {
      email: string
      assign_position?: boolean
    }[]
    for (const p of people) {
      const r = await map.addUser(
        p.email,
        !!p.assign_position,
        "user",
        req["requester"]
      )
      if (!r.ok) {
        return { ok: false }
      }
    }
    return { ok: true }
  })

  fastify.get<any>("/people/:userId", async req => {
    const {
      query: { email },
      params: { userId },
    } = req
    const with_email = req["requester_type"] == "admin" && !!email
    const p = await model.people.get(userId, undefined, with_email, true)
    if (p) {
      return p
    } else {
      throw { statusCode: 404 }
    }
  })

  fastify.get<any>("/people_multi/:userIds", async req => {
    const {
      query: { email },
      params: { userIds },
    } = req
    const with_email = req["requester_type"] == "admin" && !!email
    const split_user_ids = userIds.split("::::")
    const ps = await model.people.get_multi(split_user_ids, with_email)
    return ps
  })

  fastify.patch<any>("/people/:userId", async req => {
    const {
      body,
      params: { userId },
    } = req
    const permitted =
      req["requester_type"] == "admin" || req["requester"] == userId
    if (!permitted) {
      throw { statusCode: 403 }
    } else {
      fastify.log.debug("person patch", body)
      const modified = await model.people.update(userId, body)
      if (modified != null) {
        const u: PersonUpdate = {
          id: userId,
          last_updated: modified.update.last_updated,
        }
        if (modified.update?.avatar) {
          u.avatar = modified.update?.avatar
        }
        if (modified.update?.name) {
          u.name = modified.update?.name
        }
        console.log("patch person", modified.keys, u)
        const all_rooms = Object.keys(model.maps)
        emit.channels(all_rooms).peopleUpdate([u])
        return { ok: true, modified }
      } else {
        return {
          ok: false,
          error: "Nothing was updated",
        }
      }
    }
  })

  fastify.post<any>("/register", async (req, res) => {
    const requester_email = req["requester_email"]
    const email = req.body.email as string
    if (requester_email != email) {
      console.warn("Incorrect email", email, requester_email)
      return { ok: false, error: "Incorrect email address" }
    }
    const name = req.body.name as string
    const access_code = ((
      req.body.access_code || ""
    ).toString() as string).trim()
    console.log(name, access_code)
    const rooms = await model.MapModel.getAllowedRoomsFromCode(access_code)
    if (!rooms) {
      return { ok: false, error: "Access code is invalid" }
    }
    const default_rooms = model.MapModel.getDefaultRooms()
    const avatar = model.people.randomAvatar()
    const r = await model.people.create(
      email,
      name,
      "user",
      avatar,
      rooms.concat(default_rooms),
      "reject"
    )
    if (r.ok && r.user) {
      console.log("model.people.create ", r.user)
      const sid = await model.people.createSessionId(
        "user",
        requester_email,
        r.user.id
      )
      for (const room of r.user.rooms || []) {
        const p: PersonInMap = {
          id: r.user.id,
          last_updated: r.user.last_updated,
          room: room.room_id,
          x: room.pos?.x || NaN,
          y: room.pos?.y || NaN,
          direction: room.pos?.direction || "none",
          name: r.user.name,
          moving: false,
          avatar,
          stats: {
            walking_steps: 0,
            people_encountered: [],
            chat_count: 0,
            chat_char_count: 0,
          },
          profiles: {},
        }
        emit.channel(room.room_id).peopleNew([p])
      }
      return await res
        .setCookie("virtual_poster_session_id", sid, {
          expires: new Date(Date.now() + 1000 * 60 * config.cookie_expires),
          path: "/",
        })
        .send(r)
    } else {
      return r
    }
  })

  fastify.post<any>("/people/:userId/access_code", async req => {
    const access_code = ((
      req.body.access_code || ""
    ).toString() as string).trim()
    if (access_code.indexOf("set_avatar:") == 0) {
      const avatar = access_code.slice(11)
      const user_id = req["requester"]
      const modified = await model.people.update(user_id, { avatar })
      if (modified) {
        const u: PersonUpdate = {
          id: user_id,
          last_updated: modified.update.last_updated,
          avatar: avatar,
        }
        const all_rooms = Object.keys(model.maps)
        emit.channels(all_rooms).peopleUpdate([u])
      }
      return { ok: !!modified, added: ["__avatar__"] }
    } else {
      const rooms = await model.MapModel.getAllowedRoomsFromCode(access_code)
      const added_rooms: RoomId[] = []
      if (rooms) {
        req.log.debug({ rooms })
        const p = await model.people.get(
          req["requester"],
          undefined,
          false,
          true
        )
        console.log(p)
        const rooms_already = (p?.rooms || []).map(r => r.room_id)
        for (const rid of rooms) {
          if (rooms_already.indexOf(rid) != -1) {
            continue
          }
          const m = model.maps[rid]
          if (!m) {
            req.log.info({
              info: "Room data not found",
              rooms,
              rid,
              current: Object.keys(model.maps),
            })
            return { ok: false, error: "Room data not found" }
          }
          const r = await m.addUser(
            req["requester_email"],
            true,
            "user",
            req["requester"] + ":code:" + access_code
          )
          if (!r.ok) {
            req.log.debug(r)
            return { ok: false }
          }
          added_rooms.push(rid)
        }
        return added_rooms.length > 0
          ? { ok: true, added: added_rooms }
          : { ok: false, error: "Already added" }
      } else {
        return { ok: false, error: "Access code is invalid" }
      }
    }
  })

  fastify.post<any>("/logout", async (req, res) => {
    return await res.clearCookie("virtual_poster_session_id").send({ ok: true })
  })

  fastify.delete<any>("/people/:userId", async req => {
    const userId: string = req.params.userId
    if (req["requester_type"] == "admin" || req["requester"] == userId) {
      const u = await model.people.get(userId, undefined, true)
      if (!u) {
        throw {
          statusCode: 404,
        }
      }
      const r = await model.people.removePerson(userId)

      if (r.ok) {
        try {
          const firebase_user = await admin.auth().getUserByEmail(u.email!)
          req.log.info("Deleting Firebase user", firebase_user.uid)
          await admin.auth().deleteUser(firebase_user.uid)
          req.log.info("Successfully deleted Firebase user")
        } catch (error) {
          req.log.error("Error deleting Firebase user:", error)
        }
        const all_rooms = Object.keys(model.maps)
        emit.channels(all_rooms).peopleRemove([userId])
      }

      return r
    } else {
      throw {
        statusCode: 403,
        error: "Not admin, but " + req["requester_type"],
      }
    }
  })
  fastify.get<any>("/people/:userId/comments", async req => {
    const userId = req.params.userId
    if (req["requester_type"] == "admin" || req["requester"] == userId) {
      const rooms = Object.keys(model.maps)
      req.log.debug(rooms)
      let comments: (ChatComment | ChatEvent)[] = []
      for (const room_id of rooms) {
        const cs = await model.chat.getAllComments(room_id, userId)
        comments = comments.concat(cs || [])
      }
      return comments
    } else {
      throw { statusCode: 403 }
    }
  })
}

export default routes
