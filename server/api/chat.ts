import * as model from "../model"
import { FastifyInstance } from "fastify"
import {
  PosterId,
  CommentEncryptedEntry,
  ChatComment,
  CommentId,
  PosterCommentDecrypted,
  UserId,
} from "../../@types/types"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { userLog } from "../model"
import { emit } from "../socket"

async function routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.decorateRequest("requester", "")

  fastify.addHook("preHandler", protectedRoute)

  fastify.get<any>("/maps/:roomId/comments", async req => {
    return model.chat.getAllComments(req.params.roomId, req["requester"])
  })

  fastify.post<any>(
    "/maps/:roomId/chat_groups/:groupId/comments",
    async req => {
      const comments_encrypted: CommentEncryptedEntry[] = req.body as CommentEncryptedEntry[]
      const roomId: string = req.params.roomId
      const groupId: string = req.params.groupId
      const requester: string = req["requester"]
      const timestamp = Date.now()
      userLog({
        userId: requester,
        operation: "comment.new",
        data: { text: comments_encrypted },
      })
      const group = await model.chat.getGroupOfUser(roomId, requester)
      if (!group) {
        throw { statusCode: 400, message: "Not in a chat group" }
      }
      if (group.id != groupId) {
        throw { statusCode: 400, message: "Chat group is wrong" }
      }
      const pos = await model.people.getPos(requester, roomId)
      if (!pos) {
        throw { statusCode: 400, message: "User position not found" }
      }
      const map = model.maps[roomId]
      if (!map) {
        throw { statusCode: 400, message: "Room not found" }
      }

      const to_users = comments_encrypted.map(c => c.to)
      if (!_.isEqual(group.users.sort(), to_users.sort())) {
        emit.channel(requester).group(group) // Emit correct group info
        throw { statusCode: 400, message: "Chat recipients are invalid" }
      }

      const e: ChatComment = {
        id: model.chat.genCommentId(),
        person: requester,
        room: roomId,
        x: pos.x,
        y: pos.y,
        texts: comments_encrypted,
        timestamp,
        last_updated: timestamp,
        kind: "person",
      }
      const r = await model.chat.addCommentEncrypted(e)
      if (r) {
        emit.comment(e)
      }
      return { ok: r }
    }
  )

  fastify.delete<any>("/posters/:posterId/comments/:commentId", async req => {
    const posterId: PosterId = req.params.posterId
    const commentId: CommentId = req.params.commentId

    userLog({
      userId: req["requester"],
      operation: "comment.delete",
      data: { commentId, kind: "poster" },
    })
    const { ok, error } = await model.chat.removePosterComment(
      req["requester"],
      posterId,
      commentId
    )
    if (ok) {
      emit.channel(posterId).posterCommentRemove(commentId)
    }
    return { ok, error }
  })

  fastify.patch<{
    Params: { posterId: string; commentId: string }
    Body: { comment: string }
  }>("/posters/:posterId/comments/:commentId", async req => {
    const poster_id: PosterId = req.params.posterId
    const comment_id: string = req.params.commentId
    const comment: string = req.body.comment

    const v = await model.posters.isViewing(req["requester"], poster_id)
    if (!v.viewing) {
      throw { statusCode: 400, message: "Not viewing a poster" }
    }
    userLog({
      userId: req["requester"],
      operation: "comment.update",
      data: { commentId: comment_id, comment },
    })

    const {
      ok,
      comment: comment_actual,
      error,
    } = await model.chat.updatePosterComment(
      req["requester"],
      poster_id,
      comment_id,
      comment
    )
    if (comment_actual) {
      const comment_not_encrypted: PosterCommentDecrypted = {
        id: comment_actual.id,
        timestamp: comment_actual.timestamp,
        last_updated: comment_actual.last_updated,
        x: comment_actual.x,
        y: comment_actual.y,
        room: comment_actual.room,
        person: comment_actual.person,
        poster: poster_id,
        text_decrypted: comment,
        reply_to: comment_actual.reply_to,
        read: true, //FIXME
      }
      emit.channel(poster_id).posterComment(comment_not_encrypted)
    }
    return { ok, comment: comment_actual, error }
  })

  fastify.post<any>("/comments/:commentId/reply", async req => {
    const reply_to: CommentId = req.params.commentId
    const comments_encrypted: CommentEncryptedEntry[] = req.body as CommentEncryptedEntry[]
    const requester: string = req["requester"]
    const timestamp = Date.now()
    userLog({
      userId: requester,
      operation: "comment.new",
      data: { text: comments_encrypted, reply_to },
    })
    const reply_to_comment = await model.chat.getComment(reply_to)
    if (!reply_to_comment) {
      throw { statusCode: 400, message: "Comment not found" }
    }
    const pos = await model.people.getPos(requester, reply_to_comment.room)
    if (!pos) {
      throw { statusCode: 400, message: "User position not found" }
    }
    if (reply_to_comment.kind != "person") {
      return { ok: false, error: "Not a comment in a group chat." }
    }
    const map = model.maps[reply_to_comment.room]
    if (!map) {
      throw { statusCode: 400, message: "Room not found" }
    }
    const to_users_original = reply_to_comment.texts.map(t => t.to)
    const to_users_this = comments_encrypted.map(c => c.to)
    if (!_.isEqual(to_users_original.sort(), to_users_this.sort())) {
      req.log.debug({ to_users_original, to_users_this })
      throw { statusCode: 400, message: "Chat recipients are invalid" }
    }
    const e: ChatComment = {
      id: model.chat.genCommentId(),
      person: requester,
      room: reply_to_comment.room,
      x: pos.x,
      y: pos.y,
      texts: comments_encrypted,
      timestamp,
      last_updated: timestamp,
      kind: "person",
      reply_to,
    }
    req.log.debug("ChatComment emitting", e)
    const r = await model.chat.addCommentEncrypted(e)
    if (r) {
      emit.comment(e)
    }
    return { ok: r }
  })

  fastify.patch<any>("/comments/:commentId", async req => {
    const comment_id: string = req.params.commentId
    const comments: CommentEncryptedEntry[] = req.body.comments
    userLog({
      userId: req["requester"],
      operation: "comment.update",
      data: { commentId: comment_id, comments },
    })
    const { ok, comment, error } = await model.chat.updateComment(
      req["requester"],
      comment_id,
      comments
    )
    if (comment) {
      emit.comment(comment)
    }
    return { ok, comment, error }
  })

  fastify.delete<any>("/comments/:commentId", async req => {
    const commentId = req.params.commentId

    userLog({
      userId: req["requester"],
      operation: "comment.delete",
      data: { commentId },
    })
    const { ok, removed_to_users, error } = await model.chat.removeComment(
      req["requester"],
      commentId
    )
    fastify.log.info("removeComment result" + JSON.stringify({ ok, error }))
    if (ok) {
      if (removed_to_users) {
        await emit
          .channels(removed_to_users)
          .commentRemove(commentId, removed_to_users)
      }
    }
    return { ok, error }
  })

  fastify.post<any>("/comments/:commentId/read", async req => {
    const comment_id: string = req.params.commentId
    const read: boolean = req.body.read
    const requester: UserId = req["requester"]
    const {
      ok,
      error,
      removed_notification_ids,
    } = await model.chat.commentRead(req["requester"], comment_id, read)
    if (removed_notification_ids && removed_notification_ids.length > 0) {
      emit.channel(requester).notificationRemove(removed_notification_ids)
    }

    return { ok, error }
  })
}

export default routes
