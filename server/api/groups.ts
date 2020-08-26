import * as model from "../model"
import { FastifyInstance } from "fastify"
import { UserId, ChatGroup, ChatGroupId } from "@/@types/types"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { userLog } from "../model"
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

  fastify.post<any>("/maps/:roomId/groups/:groupId/join", async req => {
    const { ok, error, joinedGroup } = await model.chat.joinChat(
      req.params.roomId,
      req["requester"],
      req.params.groupId
    )
    if (joinedGroup) {
      emit.group(joinedGroup)
    }
    return { ok, error, joinedGroup }
  })

  fastify.post<any>("/maps/:roomId/groups/:groupId/leave", async req => {
    const room = req.params.roomId
    const { ok, error, leftGroup, removedGroup } = await model.chat.leaveChat(
      room,
      req["requester"]
    )
    if (ok && leftGroup) {
      emit.group(leftGroup)
    } else if (ok && removedGroup) {
      emit.groupRemove(removedGroup, emit.emitter.to(room))
    }
    return { ok, error, leftGroup }
  })

  fastify.post<any>("/maps/:roomId/groups/:groupId/people", async req => {
    const personToAdd: string = req.body.userId
    const { ok, error, joinedGroup } = await model.chat.addMember(
      req.params.roomId,
      req["requester"],
      personToAdd,
      req.params.groupId
    )
    if (joinedGroup) {
      emit.group(joinedGroup)
    }
    return { ok, error, joinedGroup }
  })

  // Make a new group
  fastify.post<any>(
    "/maps/:roomId/groups",
    async (
      req
    ): Promise<{ ok: boolean; error?: string; group?: ChatGroup }> => {
      const {
        params: { roomId },
        body,
      } = req
      console.log("Make a new group")

      const requester = req["requester"]
      const requester_type = req["requester_type"]
      const from_user: UserId = body.fromUser
      const to_users: UserId[] = body.toUsers
      userLog({
        userId: requester,
        operation: "groups.join",
        data: { to_users, from_user },
      })
      console.log("log 1")

      fastify.log.debug(from_user)
      fastify.log.debug(to_users)
      console.log("log 2")
      if (!to_users || to_users.length == 0 || !from_user) {
        console.log("Parameter missing")
        throw { statusCode: 400, message: "Parameter(s) missing" }
      }
      if (to_users.indexOf(from_user) != -1) {
        console.log("to_users cannot include from_user")

        return { ok: false, error: "to_users cannot include from_user" }
      }
      console.log("log 3")
      const permitted =
        !!requester && (requester_type == "admin" || requester == from_user)
      console.log("permitted", permitted)
      if (!permitted) {
        throw { statusCode: 403 }
      }
      const p = await model.people.get(from_user)
      if (!p) {
        return { ok: false, error: "User not found" }
      }
      const { group, error } = await model.chat.startChat(
        roomId,
        from_user,
        to_users
      )
      if (group) {
        emit.group(group)
        return {
          ok: true,
          group,
        }
      } else {
        return {
          ok: false,
          error,
        }
      }
    }
  )

  fastify.get<any>(
    "/groups",
    async (): Promise<{
      [group_id: string]: { users: string[][]; color: string }
    }> => {
      const groups = _.keyBy(await model.chat.getGroupList(null), "id")
      const people = await model.people.getAll(null)
      return _.mapValues(groups, group => {
        return {
          users: group.users.map(u => [u, people[u].name]),
          color: group.color,
        }
      })
    }
  )

  fastify.get<any>(
    "/maps/:roomId/groups",
    async (
      req
    ): Promise<
      {
        id: ChatGroupId
        users: UserId[]
        color: string
      }[]
    > => {
      const roomId = req.params.roomId
      const groups = await model.chat.getGroupList(roomId)
      return _.map(groups, group => {
        return {
          id: group.id,
          users: group.users,
          color: group.color,
        }
      })
    }
  )

  fastify.get<any>(
    "/maps/:roomId/people/:userId/groups",
    async (req): Promise<ChatGroup | null> => {
      const { userId, roomId } = req.params
      const g = await model.chat.getGroupOfUser(roomId, userId)
      return g
    }
  )
}

export default routes
