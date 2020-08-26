import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { RoomId } from "@/@types/types"
import { emit } from "../socket"

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
}

export default routes
