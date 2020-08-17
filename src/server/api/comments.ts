import * as model from "../model"
import { FastifyInstance } from "fastify"
import {
  CommentEncrypted,
  PosterId,
  ChatComment,
  ChatCommentEncrypted,
} from "@/../@types/types"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { userLog } from "../model"
import { emit } from "../socket"
import { ChatModel } from "../model/chat"

async function routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.decorateRequest("requester", "")

  fastify.addHook("preHandler", protectedRoute)

  fastify.setSerializerCompiler(({ schema }) => {
    fastify.log.info(schema)
    return data => JSON.stringify(data)
  })

  fastify.get<any>("/maps/:roomId/comments", async req => {
    return model.chat.getAllComments(req.params.roomId, req["requester"])
  })

  fastify.post<any>("/maps/:roomId/comments", async req => {
    const comment: string = req.body.comment
    const comments_encrypted: CommentEncrypted[] | undefined =
      req.body.comments_encrypted
    const roomId: string = req.params.roomId
    const requester: string = req["requester"]
    if (!comment && !comments_encrypted) {
      throw { statusCode: 400, message: "Parameter(s) missing" }
    }
    const timestamp = Date.now()
    userLog({
      userId: requester,
      operation: "comment.new",
      data: { text: comment || comments_encrypted },
    })
    const group = await model.chat.getGroupOfUser(roomId, requester)
    const pos = await model.people.getPos(requester, roomId)
    if (!pos) {
      throw { statusCode: 400, message: "User position not found" }
    }
    const map = model.maps[roomId]
    if (!map) {
      throw { statusCode: 400, message: "Room not found" }
    }

    const chat_other_members: string[] = group?.users || []
    if (comment) {
      //NOT encrypted
      if (chat_other_members.length > 0) {
        const e: ChatComment = {
          id: ChatModel.genCommentId(),
          person: requester,
          room: roomId,
          x: pos.x,
          y: pos.y,
          timestamp,
          last_updated: timestamp,
          kind: "person",
          text: comment,
          encrypted: _.map(_.range(chat_other_members.length), () => false),
          to: chat_other_members,
        }
        const e2: ChatCommentEncrypted = {
          id: ChatModel.genCommentId(),
          person: requester,
          room: roomId,
          x: pos.x,
          y: pos.y,
          timestamp,
          last_updated: timestamp,
          kind: "person",
          texts: chat_other_members.map(m => {
            return { to_user: m, text: comment, encrypted: false }
          }),
        }
        const r = await model.chat.addComment(e)
        if (r) {
          emit.comment(e2)
        }
      }
      return { ok: true }
    } else if (comments_encrypted) {
      //encrypted
      const e: ChatCommentEncrypted = {
        id: ChatModel.genCommentId(),
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
      return { ok: true }
    } else {
      return { ok: false }
    }
  })

  fastify.patch<{
    Params: { posterId: string; commentId: string }
    Body: { comment: string }
  }>("/posters/:posterId/comments/:commentId", async req => {
    const poster_id: PosterId = req.params.posterId
    const comment_id: string = req.params.commentId
    const comment: string = req.body.comment

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
      const comment_not_encrypted: ChatComment = {
        id: comment_actual.id,
        timestamp: comment_actual.timestamp,
        last_updated: comment_actual.last_updated,
        x: comment_actual.x,
        y: comment_actual.y,
        room: comment_actual.room,
        person: comment_actual.person,
        kind: comment_actual.kind,
        encrypted: [false],
        text: comment,
        to: [poster_id],
      }
      emit.posterComment(comment_not_encrypted)
    }
    return { ok, comment: comment_actual, error }
  })

  fastify.patch<any>("/comments/:commentId", async req => {
    const comment_id: string = req.params.commentId
    const comments: CommentEncrypted[] = req.body.comments
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
    const {
      ok,
      kind,
      removed_to_users,
      error,
    } = await model.chat.removeComment(req["requester"], commentId)
    fastify.log.info(
      "removeComment result" + JSON.stringify({ ok, kind, error })
    )
    if (ok) {
      if (kind == "person" && removed_to_users) {
        await emit.commentRemove(commentId, removed_to_users)
      } else {
        emit.posterCommentRemove(commentId)
      }
    }
    return { ok, error }
  })
}

export default routes
