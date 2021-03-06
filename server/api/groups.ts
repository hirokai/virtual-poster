import * as model from "../model"
import { FastifyInstance } from "fastify"
import { UserId, ChatGroup, ChatGroupId, RoomId } from "../../@types/types"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { userLog } from "../model"
import { emit } from "../socket"

async function routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.decorateRequest("requester", "")

  fastify.addHook("preHandler", protectedRoute)

  fastify.post<any>("/maps/:roomId/chat_groups/:groupId/join", async req => {
    const from_user = req["requester"]
    const { ok, error, joinedGroup } = await model.chat.joinChat(
      req.params.roomId,
      from_user,
      req.params.groupId
    )
    if (joinedGroup) {
      emit.channel(req.params.roomId).group(joinedGroup)
      emit.channels(joinedGroup.users).chatEvent({
        room: req.params.roomId,
        group: joinedGroup.id,
        person: from_user,
        kind: "event",
        event_type: "join",
        event_data: { from_user },
        timestamp: joinedGroup.last_updated,
      })
    }
    return { ok, error, joinedGroup }
  })

  fastify.post<any>("/maps/:roomId/chat_groups/:groupId/leave", async req => {
    const room = req.params.roomId
    const user_id = req["requester"]
    const {
      ok,
      error,
      leftGroup,
      removedGroup,
      removedGroupOldMembers,
      timestamp,
    } = await model.chat.leaveChat(room, user_id)
    if (ok && leftGroup && timestamp) {
      emit.channel(room).group(leftGroup)
      emit.channels(leftGroup.users.concat([user_id])).chatEvent({
        kind: "event",
        room,
        person: user_id,
        timestamp,
        group: leftGroup.id,
        event_type: "leave",
        event_data: { left_user: user_id, users: leftGroup.users },
      })
    } else if (ok && removedGroup && timestamp) {
      emit.channel(room).groupRemove(removedGroup)
      if (removedGroupOldMembers) {
        emit.channels(removedGroupOldMembers.concat([user_id])).chatEvent({
          kind: "event",
          room,
          person: user_id,
          timestamp,
          group: removedGroup,
          event_type: "dissolve",
        })
      }
    }
    return { ok, error, leftGroup }
  })

  fastify.delete<any>(
    "/maps/:roomId/chat_groups/:groupId/people",
    async req => {
      //Kick out user
      const room = req.params.roomId
      const personToRemove: string = req.body.userId
      const requester = req["requester"]
      const {
        ok,
        error,
        leftGroup,
        removedGroup,
        removedGroupOldMembers,
        timestamp,
      } = await model.chat.leaveChat(room, personToRemove)
      if (ok && leftGroup && timestamp) {
        emit.channel(room).group(leftGroup)
        emit.channels(leftGroup.users.concat([personToRemove])).chatEvent({
          kind: "event",
          room,
          person: requester,
          timestamp,
          group: leftGroup.id,
          event_type: "kick",
          event_data: { left_user: personToRemove, users: leftGroup.users },
        })
      } else if (ok && removedGroup && timestamp) {
        emit.channel(room).groupRemove(removedGroup)
        if (removedGroupOldMembers) {
          emit
            .channels(removedGroupOldMembers.concat([personToRemove]))
            .chatEvent({
              kind: "event",
              room,
              person: requester,
              timestamp,
              group: removedGroup,
              event_type: "dissolve",
            })
        }
      }
      return { ok, error, leftGroup }
    }
  )

  fastify.post<any>("/maps/:roomId/chat_groups/:groupId/people", async req => {
    const personToAdd: string = req.body.userId
    const room: RoomId = req.params.roomId
    const requester = req["requester"]
    const { ok, error, joinedGroup } = await model.chat.addMember(
      room,
      requester,
      personToAdd,
      req.params.groupId
    )
    if (joinedGroup) {
      emit.channel(room).group(joinedGroup)
      emit.channels(joinedGroup.users).chatEvent({
        kind: "event",
        room,
        group: req.params.groupId,
        person: requester,
        event_type: "add",
        event_data: { to_user: personToAdd, from_user: requester },
        timestamp: joinedGroup.last_updated,
      })
    }
    return { ok, error, joinedGroup }
  })

  // Make a new group
  fastify.post<any>(
    "/maps/:roomId/chat_groups",
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
      if (to_users.indexOf(from_user) != -1) {
        console.log("to_users cannot include from_user")

        return { ok: false, error: "to_users cannot include from_user" }
      }
      const permitted =
        !!requester && (requester_type == "admin" || requester == from_user)
      if (!permitted) {
        throw { statusCode: 403 }
      }
      const p = await model.people.get(from_user)
      if (!p) {
        return { ok: false, error: "User not found" }
      }
      const { group, error, timestamp } = await model.chat.startChat(
        roomId,
        from_user,
        to_users
      )
      if (group && timestamp) {
        emit.channel(roomId).group(group)
        emit.channels(group.users).chatEvent({
          kind: "event",
          room: roomId,
          person: requester,
          timestamp,
          group: group.id,
          event_type: "new",
          event_data: { from_user, to_users },
        })
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
    "/chat_groups",
    async (): Promise<{ users: UserId[]; color: string }[]> => {
      const groups = await model.chat.getGroupList(null)
      return groups
    }
  )

  fastify.get<any>(
    "/maps/:roomId/chat_groups",
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
    "/maps/:roomId/people/:userId/chat_groups",
    async (req): Promise<ChatGroup | null> => {
      const { userId, roomId } = req.params
      const g = await model.chat.getGroupOfUser(roomId, userId)
      return g
    }
  )
}

export default routes
