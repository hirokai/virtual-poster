import * as model from "../model"
import { FastifyInstance } from "fastify"
import {
  PosterId,
  CommentEncryptedEntry,
  ChatComment,
  ChatCommentDecrypted,
} from "@/@types/types"
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

  fastify.get<any>("/maps/:roomId/comments", async req => {
    return model.chat.getAllComments(req.params.roomId, req["requester"])
  })

  fastify.post<any>("/maps/:roomId/comments", async req => {
    const comments_encrypted: CommentEncryptedEntry[] | undefined =
      req.body.comments_encrypted
    const roomId: string = req.params.roomId
    const requester: string = req["requester"]
    if (!comments_encrypted) {
      throw { statusCode: 400, message: "Parameter(s) missing" }
    }
    const timestamp = Date.now()
    userLog({
      userId: requester,
      operation: "comment.new",
      data: { text: comments_encrypted },
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
    return { ok: true }
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
      const comment_not_encrypted: ChatCommentDecrypted = {
        id: comment_actual.id,
        timestamp: comment_actual.timestamp,
        last_updated: comment_actual.last_updated,
        x: comment_actual.x,
        y: comment_actual.y,
        room: comment_actual.room,
        person: comment_actual.person,
        kind: comment_actual.kind,
        texts: [
          {
            encrypted: false,
            to: poster_id,
          },
        ],
        text_decrypted: comment,
      }
      emit.posterComment(comment_not_encrypted)
    }
    return { ok, comment: comment_actual, error }
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
