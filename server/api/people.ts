import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { RoomId } from "@/@types/types"
import { emit } from "../socket"
import * as admin from "firebase-admin"
import fs from "fs"

const serviceAccount = JSON.parse(
  fs.readFileSync(
    "./coi-conf-firebase-adminsdk-fc4p6-74c47d8a6b.secret.json",
    "utf-8"
  )
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://coi-conf.firebaseio.com",
})

async function routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.decorateRequest("requester", "")

  fastify.addHook("preHandler", protectedRoute)

  fastify.setSerializerCompiler(({ schema }) => {
    fastify.log.info(schema)
    return data => JSON.stringify(data)
  })

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
    const obj = _.pick(body, ["name", "email", "x", "y", "avatar"])
    const permitted =
      req["requester_type"] == "admin" || req["requester"] == userId
    if (!permitted) {
      throw { statusCode: 403 }
    } else {
      fastify.log.debug(obj)
      const modified = await model.people.update(userId, obj)
      if (modified != null) {
        const new_person = await model.people.get(userId)
        if (new_person) {
          emit.pushSocketQueue("person", new_person)
        }
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
    const access_code = req.body.access_code as string | undefined
    console.log(name, access_code)
    const rooms = access_code
      ? await model.MapModel.getAllowedRoomsFromCode(access_code)
      : []
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
      const sid = await model.people.createSessionId(
        "user",
        requester_email,
        r.user.id
      )
      return await res
        .setCookie("virtual_poster_session_id", sid, {
          expires: new Date(Date.now() + 1000 * 60 * 60 * 6),
        })
        .send(r)
    } else {
      return r
    }
  })

  fastify.post<any>("/logout", async (req, res) => {
    return await res.clearCookie("virtual_poster_session_id").send({ ok: true })
  })

  fastify.delete<any>("/people/:userId", async req => {
    const userId = req.params.userId
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
        emit.peopleRemove(userId)
      } catch (error) {
        console.log("Error deleting user:", error)
      }
      return r
    } else {
      throw {
        statusCode: 403,
        error: "Not admin, but " + req["requester_type"],
      }
    }
  })
}

export default routes
