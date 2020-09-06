import * as model from "../model"
import { FastifyInstance } from "fastify"
import { Poster, ChatComment, ChatCommentDecrypted } from "@/@types/types"
import _ from "lodash"
import { protectedRoute } from "../auth"
import { userLog } from "../model"
import { emit } from "../socket"
import multer from "fastify-multer"
import { promisify } from "util"
import fs from "fs"
import { spawn } from "child_process"
import shortid from "shortid"
import path from "path"
import AWS from "aws-sdk"
import { config } from "../config"

const writeFile = promisify(fs.writeFile)
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
const s3 = new AWS.S3({ apiVersion: "2006-03-01", signatureVersion: "v4" })

const cloudfront = new AWS.CloudFront({
  apiVersion: "2017-03-25",
})

async function uploadFileToS3(file_path: string): Promise<string> {
  if (!S3_BUCKET) {
    throw "S3 bucket not set"
  }
  const key = "files/" + path.basename(file_path)
  const invalidate_items = ["/" + key]

  if (CLOUDFRONT_ID && config.aws.s3.via_cdn) {
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
    console.log(data1)
  }

  // call S3 to retrieve upload file to specified bucket

  // Configure the file stream and obtain the upload parameters
  const fileStream = fs.createReadStream(file_path)
  fileStream.on("error", function(err) {
    console.log("File Error", err)
  })

  const uploadParams = {
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileStream,
    ACL: "public-read",
  }

  // call S3 to retrieve upload file to specified bucket
  const data = await s3.upload(uploadParams).promise()
  console.log("Uploaded:", data)
  return data.Location
}

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
    const poster = await model.posters.getOfUser(roomId, userId)
    return { ok: !!poster, poster: poster || undefined }
  })

  fastify.get<any>("/people/:userId/posters", async req => {
    const { userId } = req.params
    const posters = await model.posters.getAllOfUser(userId)
    return { ok: !!posters, posters: posters || undefined }
  })

  fastify.post<any>("/maps/:roomId/take_slot/:posterNumber", async req => {
    const { roomId, posterNumber } = req.params as Record<string, string>
    const num = parseInt(posterNumber)
    if (isNaN(num)) {
      return { ok: false }
    } else {
      const r = await model.maps[roomId].assignPosterLocation(
        num,
        req["requester"],
        false
      )
      if (r.ok && r.poster) {
        emit.poster(r.poster)
      }
      return r
    }
  })

  fastify.patch<any>("/posters/:posterId", async req => {
    const poster_id = req.params.posterId as string
    const title = req.body.title as string
    const p = await model.posters.get(poster_id)
    if (p) {
      p.title = title
      p.last_updated = Date.now()
      const r = await model.posters.set(p)
      emit.poster(p)
      return { ok: r }
    } else {
      return { ok: false }
    }
  })

  async function updatePosterFile(
    poster: Poster,
    file: any
  ): Promise<{ ok: boolean; error?: string }> {
    const data = file.buffer
    if (file.mimetype == "image/png") {
      const out_path = "db/posters/" + poster.id + ".png"
      await writeFile(out_path, data)
      await model.posters.set(poster)
      if (S3_BUCKET) {
        const s3_url = await uploadFileToS3(out_path)
        await deleteFile(out_path)
      }
      return { ok: true }
    } else {
      const filename = "db/posters/tmp-" + shortid.generate() + ".pdf"
      await writeFile(filename, data)
      fastify.log.debug("writeFile: ", filename, data.length)

      const out_path = "db/posters/" + poster.id + ".png"
      // gs -sDEVICE=png16m -r300 -dGraphicsAlphaBits=4 -o test-out.png tmp-4RBgnRNyN.pdf
      const child = spawn("gs", [
        "-sDEVICE=png16m",
        "-dLastPage=1",
        "-r300",
        "-dGraphicsAlphaBits=4",
        "-o",
        out_path,
        filename,
      ])
      await model.posters.set(poster)
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
            if (S3_BUCKET) {
              uploadFileToS3(out_path)
                .then(() => {
                  deleteFile(out_path)
                    .then(() => {
                      console.log(
                        "Uploaded PDF to S3 and deleted a local file."
                      )
                    })
                    .catch(err => {
                      console.error(err)
                    })
                })
                .catch(err => {
                  console.error(err)
                })
            }
            resolve({ ok: true })
          } else {
            resolve({ ok: false, error: "PDF conversion error" })
          }
        })
      })
      const s3_url = await uploadFileToS3(out_path)
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
        const poster = await model.posters.getOfUser(roomId, userId)
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
      const poster = await model.posters.get(poster_id)

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
        const new_poster = await model.posters.get(poster_id)
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
      const poster = await model.posters.get(posterId)
      if (!poster) {
        return { ok: false, error: "Poster not found" }
      } else {
        poster.last_updated = Date.now()
        if (S3_BUCKET) {
          const key = "files/" + posterId + ".png"
          await s3
            .deleteObject({
              Bucket: S3_BUCKET as string,
              Key: key,
            })
            .promise()
          if (CLOUDFRONT_ID && config.aws.s3.via_cdn) {
            const invalidate_items = ["/" + key]
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
            console.log(data1)
          }
        } else {
          await deleteFile("db/posters/" + poster.id + ".png")
        }
        emit.poster(poster)
        return { ok: true, poster }
      }
    }
  )

  fastify.delete<any>(
    "/maps/:room_id/people/:user_id/poster/file",
    async req => {
      const { user_id, room_id } = req.params
      const poster = await model.posters.getOfUser(room_id, user_id)
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
      const e: ChatCommentDecrypted = {
        id: model.chat.genCommentId(),
        person: user_id,
        room: roomId,
        x: pos.x,
        y: pos.y,
        text_decrypted: comment,
        texts: [{ to: posterId, encrypted: false }],
        timestamp: timestamp,
        last_updated: timestamp,
        kind: "poster",
      }
      const r = await model.chat.addPosterComment(e)
      if (r) {
        emit.posterComment(e)
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
    return await model.chat.getPosterComments(req.params.posterId)
  })

  fastify.get<any>("/maps/:roomId/posters", async req => {
    const room = req.params.roomId
    return await model.posters.getAll(room)
  })
}

export default routes
