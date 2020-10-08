import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { RoomId, PersonInMap, PersonUpdate, ChatComment } from "@/@types/types"
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

  fastify.get<any>("/maps/:roomId/people", async req => {
    const with_email = req["requester_type"] == "admin" && !!req.query.email
    const rs = await model.people.getAllPeopleList(
      req.params.roomId,
      with_email
    )
    return rs
  })

  fastify.get<any>("/people/:userId", async req => {
    const {
      query: { email },
      params: { userId },
    } = req
    const with_email = req["requester_type"] == "admin" && !!email
    const p = await model.people.get(userId, with_email, true)
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
    const obj = _.pickBy(_.pick(body, ["name", "email", "avatar"]))
    const permitted =
      req["requester_type"] == "admin" || req["requester"] == userId
    if (!permitted) {
      throw { statusCode: 403 }
    } else {
      fastify.log.debug(obj)
      const modified = await model.people.update(userId, obj)
      if (modified != null) {
        const u: PersonUpdate = {
          id: userId,
          last_updated: modified.update.last_updated,
        }
        if (modified.keys.indexOf("avatar") != -1) {
          u.avatar = obj.avatar
        }
        if (modified.keys.indexOf("name") != -1) {
          u.name = obj.name
        }
        console.log("patch person", modified.keys, u)
        const all_rooms = Object.keys(model.maps)
        emit.channels(all_rooms).peopleUpdate([u])
        return { ok: true, modified }
      } else {
        return {
          ok: false,
          error: "Update failed. Wrong user ID, or email already exists.",
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

    const avatar = model.people.randomAvatar()
    const r = await model.people.create(
      email,
      name,
      "user",
      avatar,
      rooms,
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
        }
        emit.channel(room.room_id).peopleNew([p])
      }
      return await res
        .setCookie("virtual_poster_session_id", sid, {
          expires: new Date(Date.now() + 1000 * 60 * config.cookie_expires),
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
    const rooms = await model.MapModel.getAllowedRoomsFromCode(access_code)
    if (rooms) {
      for (const rid of rooms) {
        const r = await model.maps[rid].addUser(req["requester"], true, "user")
        if (!r.ok) {
          req.log.debug(r)
          return { ok: false }
        }
      }
      return { ok: true }
    } else {
      return { ok: false, error: "Access code is invalid" }
    }
  })

  fastify.post<any>("/logout", async (req, res) => {
    return await res.clearCookie("virtual_poster_session_id").send({ ok: true })
  })

  fastify.delete<any>("/people/:userId", async req => {
    const userId: string = req.params.userId
    if (req["requester_type"] == "admin" || req["requester"] == userId) {
      const u = await model.people.get(userId, true)
      if (!u) {
        throw {
          statusCode: 404,
        }
      }
      const r = await model.people.removePerson(userId)
      try {
        const firebase_user = await admin.auth().getUserByEmail(u.email!)
        console.log("Deleting firebase user", firebase_user.uid)
        await admin.auth().deleteUser(firebase_user.uid)
        console.log("Successfully deleted user")
      } catch (error) {
        console.log("Error deleting Firebase user:", error)
      }
      if (r.ok) {
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
      let comments: ChatComment[] = []
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
