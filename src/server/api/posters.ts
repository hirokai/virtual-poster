import * as model from "../model"
import { FastifyInstance } from "fastify"
import { Poster, ChatComment } from "@/../@types/types"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { userLog } from "../model"
import { emit } from "../socket"
import multer from "fastify-multer"
import { promisify } from "util"
import fs from "fs"
import { spawn } from "child_process"
import shortid from "shortid"
import { ChatModel } from "../model/chat"
import path from "path"
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const deleteFile = promisify(fs.unlink)
const existsAsync = promisify(fs.exists)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1000 * 1000 * 10 },
}).single("file")

async function routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.decorateRequest("requester", "")

  fastify.addHook("preHandler", protectedRoute)

  fastify.setSerializerCompiler(({ schema }) => {
    fastify.log.info(schema)
    return data => JSON.stringify(data)
  })

  fastify.get<any>("/maps/:roomId/people/:userId/poster", async req => {
    const { userId, roomId } = req.params
    const poster = await model.Posters.getOfUser(roomId, userId)
    return { ok: !!poster, poster: poster || undefined }
  })

  fastify.get<any>("/people/:userId/posters", async req => {
    const { userId } = req.params
    const posters = await model.Posters.getAllOfUser(userId)
    return { ok: !!posters, posters: posters || undefined }
  })

  async function updatePosterFile(
    poster: Poster,
    file: any
  ): Promise<{ ok: boolean; error?: string }> {
    const data = file.buffer
    if (file.mimetype == "image/png") {
      await writeFile("db/posters/" + poster.id + ".png", data)
      await model.Posters.set(poster)
      return { ok: true }
    } else {
      const filename = "db/posters/tmp-" + shortid.generate() + ".pdf"
      await writeFile(filename, data)
      fastify.log.debug("writeFile: ", filename, data.length)

      // gs -sDEVICE=png16m -r300 -dGraphicsAlphaBits=4 -o test-out.png tmp-4RBgnRNyN.pdf
      const child = spawn("gs", [
        "-sDEVICE=png16m",
        "-dLastPage=1",
        "-r300",
        "-dGraphicsAlphaBits=4",
        "-o",
        "db/posters/" + poster.id + ".png",
        filename,
      ])
      await model.Posters.set(poster)
      const r = await new Promise<{ ok: boolean; error?: string }>(resolve => {
        // use child.stdout.setEncoding('utf8'); if you want text chunks
        child.stdout.on("data", (chunk: Buffer) => {
          fastify.log.debug("Ghostscript stdout:", chunk.toString("utf8"))
        })
        child.on("close", code => {
          fs.unlink(filename, () => {
            //
          })
          if (code == 0) {
            resolve({ ok: true })
          } else {
            resolve({ ok: false, error: "PDF conversion error" })
          }
        })
      })
      return r
    }
  }

  fastify.post<any>(
    "/maps/:roomId/people/:userId/poster/file",
    { preHandler: upload },
    async req => {
      const { userId, roomId } = req.params
      const permitted =
        req["requester_type"] == "admin" || req["requester"] == userId
      if (!permitted) {
        throw { statusCode: 403 }
      } else {
        const poster = await model.Posters.getOfUser(roomId, userId)
        if (!poster) {
          return { ok: false, error: "Poster not found" }
        } else {
          poster.last_updated = Date.now()
          const r = await updatePosterFile(poster, req["file"])
          if (r.ok) {
            emit.poster(poster)
          }
          return r
        }
      }
    }
  )

  fastify.get<any>("/posters/:posterId/file", async (req, res) => {
    const posterId: string = req.params.posterId
    const file = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "db",
      "posters",
      posterId + ".png"
    )
    if (await existsAsync(file)) {
      fastify.log.info("File found: " + posterId + " " + file)

      const ti = Date.now()
      const content = await readFile(file)
      await res.send(content)
      res.sent = true
      const tf = Date.now()
      fastify.log.debug(`Sent file in ${tf - ti} ms.`)
    } else {
      fastify.log.info("File not found: " + posterId + " " + file)
      throw { statusCode: 404 }
    }
  })

  fastify.post<any>(
    "/posters/:posterId/file",
    { preHandler: upload },
    async (req): Promise<{ ok: boolean; error?: string; poster?: Poster }> => {
      const poster_id = req.params.posterId
      const poster = await model.Posters.get(poster_id)

      if (!poster) {
        return { ok: false, error: "Poster not found" }
      }
      const permitted =
        req["requester_type"] == "admin" || req["requester"] == poster.author
      if (!permitted) {
        throw { statusCode: 403 }
      }
      poster.last_updated = Date.now()
      const r = await updatePosterFile(poster, req["file"])
      if (r.ok) {
        const new_poster = await model.Posters.get(poster_id)
        if (new_poster) {
          emit.poster(new_poster)
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
      const poster = await model.Posters.get(posterId)
      if (!poster) {
        return { ok: false, error: "Poster not found" }
      } else {
        poster.last_updated = Date.now()
        await deleteFile("db/posters/" + poster.id + ".png")
        emit.poster(poster)
        return { ok: true, poster }
      }
    }
  )

  fastify.delete<any>(
    "/maps/:room_id/people/:user_id/poster/file",
    async req => {
      const { user_id, room_id } = req.params
      const poster = await model.Posters.getOfUser(room_id, user_id)
      if (!poster) {
        return { ok: false, error: "Poster not found" }
      } else {
        poster.last_updated = Date.now()
        await deleteFile("db/posters/" + poster.id + ".png")
        emit.poster(poster)
        return { ok: true, poster }
      }
    }
  )

  fastify.post<any>(
    "/posters/:posterId/comments",
    async (req): Promise<{ ok: boolean }> => {
      const user_id: string = req.body.user_id
      const comment: string = req.body.comment
      const posterId: string = req.params.posterId
      const timestamp = Date.now()

      const permitted =
        user_id &&
        (req["requester_type"] == "admin" || user_id == req["requester"])
      if (!permitted) {
        throw { statusCode: 403 }
      }
      userLog({
        userId: user_id,
        operation: "comment.new",
        data: { text: comment },
      })
      const poster = await model.Posters.get(posterId)
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
      const e: ChatComment = {
        id: ChatModel.genCommentId(),
        person: user_id,
        room: roomId,
        x: pos.x,
        y: pos.y,
        text: comment,
        timestamp: timestamp,
        last_updated: timestamp,
        encrypted: [false],
        to: [posterId],
        kind: "poster",
      }
      const r = await model.chat.addComment(e)
      if (r) {
        emit.posterComment(e)
      }
      return { ok: true }
    }
  )

  fastify.get("/posters", async req => {
    if (req["requester_type"] != "admin") {
      throw { statusCode: 403 }
    }
    return await model.Posters.getAll(null)
  })

  fastify.get<any>("/posters/:posterId/comments", async req => {
    return await model.chat.getPosterComments(req.params.posterId)
  })

  fastify.get<any>("/maps/:roomId/posters", async req => {
    const room = req.params.roomId
    return await model.Posters.getAll(room)
  })
}

export default routes
