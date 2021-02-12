import * as model from "../model"
import { FastifyInstance } from "fastify"
import { Poster, PosterId, PosterCommentDecrypted } from "../../@types/types"
import _ from "lodash"
import { protectedRoute, manageRoom } from "../auth"
import { userLog } from "../model"
import { emit } from "../socket"
import multer from "fastify-multer"
import { promisify } from "util"
import fs from "fs"
import path from "path"
import AWS from "aws-sdk"
import { config } from "../config"

const readFile = promisify(fs.readFile)
const deleteFile = promisify(fs.unlink)
const existsAsync = promisify(fs.exists)

const CLOUDFRONT_ID = config.aws.cloud_front.id
const AWS_REGION = config.aws.region
const AWS_ACCESS_KEY_ID = config.aws.access_key_id
const AWS_SECRET_ACCESS_KEY = config.aws.secret_access_key
const S3_BUCKET = config.aws.s3.bucket

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
})

const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  signatureVersion: "v4",
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
})

const cloudfront = new AWS.CloudFront({
  apiVersion: "2017-03-25",
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1000 * 1000 * 10 },
}).single("file")

async function routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.decorateRequest("requester", "")

  fastify.addHook("preHandler", protectedRoute)

  fastify.get<any>("/people/:userId/posters", async req => {
    const { userId } = req.params
    const posters = await model.posters.getAllOfUser(userId)
    return { ok: !!posters, posters: posters || undefined }
  })

  fastify.post<any>(
    "/maps/:roomId/poster_slots/:posterNumber",
    async (req, reply) => {
      const { roomId, posterNumber } = req.params as Record<string, string>
      const user_id = (req.body.user_id || req["requester"]) as string
      const title = req.body.title as string | undefined
      console.log({ roomId, posterNumber })
      const allowedRoom =
        req["requester_type"] == "admin" ||
        !!(
          await model.db.oneOrNone(
            `SELECT allow_poster_assignment FROM room WHERE id=$1`,
            [roomId]
          )
        )?.allow_poster_assignment
      const is_page_admin = await model.maps[roomId]?.isUserOwnerOrAdmin(
        req["requester"]
      )
      const isAllowedUser = user_id == req["requester"] || is_page_admin
      if (!isAllowedUser || !allowedRoom) {
        return await reply.code(403).send("Unauthorized")
      }
      const r = await model.maps[roomId].assignPosterLocation(
        posterNumber,
        user_id,
        false
      )
      if (!r.poster) {
        return {
          ok: false,
          error: r.error,
          allowed_regions: r.allowed_regions,
          suggested_message:
            r?.allowed_regions?.length && r?.allowed_regions?.length > 0
              ? "このエリアは他の参加者のために予約されているため，ポスターを貼れません。ミニマップ上で色で示されたエリアで貼ってください。"
              : "（発表登録をしていないため，ポスターは貼れません。）",
        }
      }
      if (title) {
        r.poster.title = title
        await model.posters.set(r.poster)
      }
      if (r.ok && r.poster) {
        emit.channels([roomId, user_id]).poster(r.poster)
        emit
          .channels([roomId, "::index"])
          .room({ id: roomId, poster_count: r.poster_count })
      }
      return r
    }
  )

  fastify.delete<any>("/maps/:roomId/poster_slots/:posterNumber", async req => {
    const { roomId, posterNumber } = req.params as Record<string, string>
    if (!model.maps[roomId]) {
      throw { statusCode: 404 }
    }
    const room = await model.maps[roomId]?.getMetadata()
    const permitted =
      req["requester_type"] == "admin" || room?.allow_poster_assignment
    if (!permitted) {
      throw { statusCode: 403 }
    }
    const r = await model.maps[roomId].freePosterLocation(
      posterNumber,
      req["requester"],
      true
    )
    const last_updated = Date.now()
    if (r.ok && r.poster_id) {
      emit
        .channels([roomId, req["requester"]])
        .posterRemove(roomId, req["requester"], r.poster_id)
      emit.channels([roomId, req["requester"]]).peopleUpdate(
        r.viewers!.map(pid => {
          return { id: pid, last_updated, poster_viewing: null }
        })
      )
      emit
        .channels([roomId, "::index"])
        .room({ id: roomId, poster_count: r.poster_count })
    }
    return r
  })

  fastify.patch<any>("/posters/:posterId", async req => {
    const poster_id = req.params.posterId as string
    const title = req.body.title as string | undefined
    const access_log = req.body.access_log as boolean | undefined
    const author_online_only = req.body.author_online_only as
      | boolean
      | undefined
    const watermark = req.body.watermark as number | null | undefined
    const p = await model.posters.get(poster_id)
    if (!p) {
      throw { statusCode: 404 }
    }
    const room = await model.maps[p.room]?.getMetadata()
    const permitted =
      req["requester_type"] == "admin" ||
      (room?.allow_poster_assignment && req["requester"] == p.author)
    if (!permitted) {
      throw { statusCode: 403 }
    }
    if (title) {
      p.title = title
    }
    if (access_log != undefined) {
      p.access_log = access_log
    }
    if (author_online_only != undefined) {
      p.author_online_only = author_online_only
    }
    req.log.debug("poster PATCH watermark", JSON.stringify(watermark))
    if (watermark != undefined) {
      p.watermark = watermark
    }
    p.last_updated = Date.now()
    const r = await model.posters.set(p)
    emit.channels([p.room, req["requester"], p.author]).poster(p)
    return { ok: r }
  })

  fastify.get<any>("/posters/:posterId/file", async (req, res) => {
    const posterId: string = req.params.posterId
    const poster = await model.posters.get(posterId)
    if (!poster) {
      throw { statusCode: 404, message: "Poster not found" }
    }
    if (
      poster.author != req["requester"] &&
      req["requester_type"] != "admin" &&
      !(await model.posters.isViewing(req["requester"], poster.id))
    ) {
      throw { statusCode: 403 }
    }

    const file = path.join(
      __dirname,
      "..",
      "..",
      "db",
      "posters",
      posterId + ".png"
    )
    if (!(await existsAsync(file))) {
      fastify.log.info("File not found: " + posterId + " " + file)
      throw { statusCode: 404 }
    }
    fastify.log.info("File found: " + posterId + " " + file)

    const ti = Date.now()
    const content = await readFile(file)
    await res.send(content)
    const tf = Date.now()
    fastify.log.debug(`Sent file in ${tf - ti} ms.`)
  })

  fastify.post<any>(
    "/posters/:posterId/file",
    { preHandler: upload },
    async (req): Promise<{ ok: boolean; error?: string; poster?: Poster }> => {
      const poster_id = req.params.posterId
      const poster = await model.posters.get(poster_id)

      if (!poster) {
        return { ok: false, error: "Poster not found" }
      }
      const room = await model.maps[poster.room]?.getMetadata()
      const permitted =
        req["requester_type"] == "admin" ||
        (room?.allow_poster_assignment && req["requester"] == poster.author)
      if (!permitted) {
        throw { statusCode: 403 }
      }
      poster.last_updated = Date.now()
      const r = await model.posters.updatePosterFile(poster, req["file"])
      if (r.ok) {
        const new_poster = await model.posters.get(poster_id)
        if (new_poster) {
          emit.channels([new_poster.author, new_poster.room]).poster(new_poster)
        }
        return { ...r, poster: new_poster || undefined }
      } else {
        return r
      }
    }
  )

  fastify.get<any>(
    "/posters/:posterId/file_upload_url",
    async (
      req
    ): Promise<{
      ok: boolean
      error?: string
      url?: string
      target?: "s3" | "api_server"
    }> => {
      const poster_id = req.params.posterId
      const mime_type: string = req.query.mime_type
      const poster = await model.posters.get(poster_id)

      const target = config.aws.s3.upload ? "s3" : "api_server"

      if (!poster) {
        return { ok: false, error: "Poster not found" }
      }
      const room = await model.maps[poster.room]?.getMetadata()
      const permitted =
        req["requester_type"] == "admin" ||
        (room?.allow_poster_assignment && req["requester"] == poster.author)
      if (!permitted) {
        throw { statusCode: 403 }
      }
      const url = config.aws.s3.upload
        ? await model.posters.get_signed_url_for_upload(poster.id, mime_type)
        : "/posters/" + poster_id + "/file"
      if (url) {
        return { ok: true, url, target }
      } else {
        return { ok: false, error: "Failed to get a URL" }
      }
    }
  )

  fastify.post<any>(
    "/posters/:posterId/file_upload_done",
    async (req): Promise<{ ok: boolean; error?: string; poster?: Poster }> => {
      const poster_id: PosterId = req.params.posterId
      const poster = await model.posters.get(poster_id)
      const mime_type = req.body.mime_type

      if (!poster) {
        return { ok: false, error: "Poster not found" }
      }
      const room = await model.maps[poster.room]?.getMetadata()
      const permitted =
        req["requester_type"] == "admin" ||
        (room?.allow_poster_assignment && req["requester"] == poster.author)
      if (!permitted) {
        throw { statusCode: 403 }
      }
      poster.last_updated = Date.now()
      const r = await model.posters.updatePosterFileFromS3(poster, mime_type)
      if (r.ok) {
        const new_poster = await model.posters.get(poster_id)
        if (new_poster) {
          emit.channels([new_poster.author, new_poster.room]).poster(new_poster)
        }
        return { ...r, poster: new_poster || undefined }
      } else {
        return r
      }
    }
  )

  fastify.delete<any>(
    "/posters/:posterId/file",
    async (req): Promise<{ ok: boolean; error?: string; poster?: Poster }> => {
      const posterId: string = req.params.posterId
      const poster = await model.posters.get(posterId)
      if (!poster) {
        throw { statusCode: 404 }
      }
      const room = await model.maps[poster.room]?.getMetadata()
      const permitted =
        req["requester_type"] == "admin" ||
        (room?.allow_poster_assignment && req["requester"] == poster.author)
      if (!permitted) {
        throw { statusCode: 403 }
      }
      poster.last_updated = Date.now()
      if (config.aws.s3.upload) {
        const key = "files/" + posterId + ".png"
        req.log.info("Deleting S3 file", key)
        await s3
          .deleteObject({
            Bucket: S3_BUCKET as string,
            Key: key,
          })
          .promise()
        if (CLOUDFRONT_ID && config.aws.s3.via_cdn) {
          const invalidate_items = ["/" + key]
          req.log.info("Invalidating CloudFront cache", invalidate_items)
          const params = {
            DistributionId: CLOUDFRONT_ID,
            InvalidationBatch: {
              CallerReference: String(new Date().getTime()),
              Paths: {
                Quantity: invalidate_items.length,
                Items: invalidate_items,
              },
            },
          }
          const data1 = await cloudfront.createInvalidation(params).promise()
          req.log.debug(data1)
        }
      } else {
        await deleteFile("db/posters/" + poster.id + ".png")
      }
      await model.db.query(
        `UPDATE poster SET file_uploaded='f',file_size=NULL WHERE id=$1`,
        [posterId]
      )
      poster.file_url = undefined
      poster.file_size = undefined
      emit.channels([poster.author, poster.room]).poster(poster)
      return { ok: true, poster }
    }
  )

  fastify.get<any>("/posters/:posterId/file_url", async (req, res) => {
    const posterId: string = req.params.posterId
    const poster = await model.posters.get(posterId)
    if (!poster) {
      throw { satusCode: 404, message: "Poster not found" }
    }
    if (config.aws.s3.upload) {
      if (
        poster.author == req["requester"] ||
        req["requester_type"] == "admin" ||
        (await model.posters.isViewing(req["requester"], poster.id))
      ) {
        const r =
          (await model.posters.get_signed_url(
            posterId,
            config.aws.s3.via_cdn ? "cloudfront" : "s3"
          )) || undefined
        return r ? { ok: true, url: r.url } : { ok: false }
      } else {
        throw { statusCode: 403 }
      }
    } else {
      const file_url = "/api/posters/" + poster.id + "/file"
      return { ok: true, url: file_url }
    }
  })

  fastify.post<any>(
    "/posters/:posterId/comments",
    async (req): Promise<{ ok: boolean }> => {
      const user_id: string = req["requester"]
      const comment: string = req.body.comment
      const posterId: string = req.params.posterId

      const timestamp = Date.now()

      const v = await model.posters.isViewing(user_id, posterId)
      if (!v.viewing) {
        throw { statusCode: 400, message: "Not viewing a poster" }
      }

      userLog({
        userId: user_id,
        operation: "comment.new",
        data: { text: comment },
      })
      const poster = await model.posters.get(posterId)
      if (!poster) {
        throw { statusCode: 404, message: "Poster is not found" }
      }
      const roomId = poster.room
      const pos = await model.people.getPos(user_id, roomId)
      if (!pos) {
        throw { statusCode: 400, message: "User position not found." }
      }
      const map = model.maps[roomId]
      if (!map) {
        throw { statusCode: 404, message: "Room not found" }
      }
      const posters = await map.getAdjacentPosters(pos)
      if (posters.indexOf(posterId) == -1) {
        throw { statusCode: 400, message: "Poster is not in ajacency" }
      }

      fastify.log.debug("Ajacent posters", posters)
      const c: PosterCommentDecrypted = {
        id: model.chat.genCommentId(),
        person: user_id,
        room: roomId,
        x: pos.x,
        y: pos.y,
        text_decrypted: comment,
        poster: posterId,
        timestamp: timestamp,
        last_updated: timestamp,
      }
      const r = await model.chat.addPosterComment(c)
      if (r) {
        emit.channel(c.poster).posterComment(c)
        return { ok: true }
      } else {
        return { ok: false }
      }
    }
  )

  fastify.post<any>(
    "/posters/:posterId/comments/:commentId/reply",
    async (req): Promise<{ ok: boolean }> => {
      const posterId: string = req.params.posterId
      const reply_to_id: string = req.params.commentId
      const text = req.body.text

      const timestamp = Date.now()

      const requester: string = req["requester"]

      userLog({
        userId: requester,
        operation: "comment.new",
        data: { text, reply_to: reply_to_id },
      })
      const poster = await model.posters.get(posterId)
      if (!poster) {
        throw { statusCode: 404, message: "Poster is not found" }
      }
      const roomId = poster.room
      const map = model.maps[roomId]
      if (!map) {
        throw { statusCode: 404, message: "Room not found" }
      }
      const pos = await model.people.getPos(requester, roomId)
      if (!pos) {
        throw { statusCode: 400, message: "User position not found." }
      }
      const posters = await map.getAdjacentPosters(pos)
      if (posters.indexOf(posterId) == -1) {
        throw { statusCode: 400, message: "Poster is not in ajacency" }
      }

      fastify.log.debug("Ajacent posters", posters)
      const e: PosterCommentDecrypted = {
        id: model.chat.genCommentId(),
        person: requester,
        room: roomId,
        x: pos.x,
        y: pos.y,
        text_decrypted: text,
        poster: posterId,
        timestamp: timestamp,
        last_updated: timestamp,
        reply_to: reply_to_id,
      }
      const r = await model.chat.addPosterComment(e)
      if (r) {
        emit.channel(posterId).posterComment(e)
        return { ok: true }
      } else {
        return { ok: false }
      }
    }
  )

  fastify.get("/posters", async (req, reply) => {
    if (req["requester_type"] != "admin") {
      return await reply.code(403).send("Not admin")
    }
    return await model.posters.getAll(null)
  })

  fastify.get<any>("/posters/:posterId/comments", async req => {
    const posterId: PosterId = req.params.posterId
    const v = await model.posters.isViewing(req["requester"], posterId)
    if (v.viewing == true) {
      return await model.chat.getPosterComments(posterId)
    } else {
      throw { statusCode: 400, message: "Not viewing a poster" }
    }
  })

  fastify.get<any>("/maps/:roomId/posters", async req => {
    const room = req.params.roomId
    const requester: string = req["requester"]
    return await model.posters.getAll(room, requester)
  })

  fastify.post<any>(
    "/maps/:roomId/posters/refresh_files",
    { preHandler: manageRoom },
    async req => {
      const roomId = req.params.roomId
      // await sleepAsync(1000) // For testing UI
      const r = await model.posters.refreshFiles(roomId)
      for (const p of r.updated || []) {
        emit.channel(roomId).poster(p)
      }
      return r
    }
  )

  fastify.get<any>("/maps/:roomId/posters/:posterId/history", async req => {
    const roomId: PosterId = req.params.roomId
    const posterId: PosterId = req.params.posterId
    const r = await model.posters.getViewHistory(roomId, posterId)
    if (!r.error) {
      return r.posters
    }
  })
}

export default routes
