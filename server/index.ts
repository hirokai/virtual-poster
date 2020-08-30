//
// API and Socket.IO server, main code
//

import dotenv from "dotenv"
dotenv.config()

import * as fastify_ from "fastify"
import { fastify } from "fastify"
import protected_api_routes from "./app"
import public_api_routes from "./api/public"
import maps_routes from "./api/maps"
import comments_routes from "./api/comments"
import groups_routes from "./api/groups"
import people_routes from "./api/people"
import posters_routes from "./api/posters"
import admin_routes from "./api/admin"
import pino from "pino"
import fastify_static from "fastify-static"
import * as model from "./model"
import fs from "fs"
import path from "path"
import { registerSocket } from "./socket"
import { RoomId } from "@/@types/types"
import io from "socket.io-emitter"
import cluster from "cluster"
import _ from "lodash"
import fastify_express from "fastify-express"
import cors from "cors"
import multer from "fastify-multer"
import swaggerValidation from "openapi-validator-middleware"

// Setting by env vars.
const RUN_CLUSTER: number | false = process.env.RUN_CLUSTER
  ? parseInt(process.env.RUN_CLUSTER) || false
  : false
const PRODUCTION = process.env.NODE_ENV == "production"
const PORT =
  (process.env.PORT && parseInt(process.env.PORT)) || (PRODUCTION ? 443 : 3000)
const HTTP2 = !!process.env.HTTP2 || PRODUCTION
const TLS = process.env.NO_TLS ? false : !!process.env.TLS || PRODUCTION
const DEBUG_LOG = !!process.env.DEBUG_LOG
const CERTIFICATE_FOLDER = process.env.CERTIFICATE_FOLDER
const POSTGRES_CONNECTION_STRING = process.env.NODE_TEST
  ? "postgres://postgres@localhost/virtual_poster_test"
  : process.env.POSTGRES_CONNECTION_STRING ||
    "postgres://postgres@localhost/virtual_poster"

console.log("Settings:")
console.log({
  PRODUCTION,
  PORT,
  HTTP2,
  TLS,
  DEBUG_LOG,
  RUN_CLUSTER,
  CERTIFICATE_FOLDER,
  POSTGRES_CONNECTION_STRING,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
})

async function workerInitData(): Promise<RoomId[]> {
  if (!RUN_CLUSTER || cluster.worker?.id) {
    const rooms = await model.initData(POSTGRES_CONNECTION_STRING)
    return rooms
  } else {
    return []
  }
}

// let server: https.Server | http.Server

workerInitData()
  .then(() => {
    if (RUN_CLUSTER && cluster.isMaster) {
      const workers: number = parseInt(process.env.RUN_CLUSTER || "1") // require('os').cpus().length
      console.log("Master node run")
      _.range(workers).forEach(() => {
        const worker = cluster.fork()
        console.log("CLUSTER: Worker %d forked", worker.id)
      })
      cluster.on("exit", old_worker => {
        console.log("CLUSTER: Worker %d exited", old_worker.id)
        const worker = cluster.fork()
        console.log("CLUSTER: Worker %d started", worker.id)
      })
    } else {
      if (cluster.worker?.id) {
        console.log("Starting worker #" + cluster.worker?.id)
      }

      let server: fastify_.FastifyInstance<any, any, any, any>
      if (HTTP2) {
        const opt = {
          http2: true,
          logger: DEBUG_LOG ? pino({ level: "debug" }) : false,
        }
        if (TLS && CERTIFICATE_FOLDER) {
          opt["https"] = {
            allowHTTP1: true,
            key: fs.readFileSync(
              path.join(CERTIFICATE_FOLDER, "privkey.pem"),
              "utf8"
            ),
            cert: fs.readFileSync(
              path.join(CERTIFICATE_FOLDER, "cert.pem"),
              "utf8"
            ),
            ca: fs.readFileSync(
              path.join(CERTIFICATE_FOLDER, "chain.pem"),
              "utf8"
            ),
          }
        }
        server = fastify(opt)
      } else {
        server = fastify({
          logger: DEBUG_LOG ? pino({ level: "debug" }) : false,
        })
      }

      console.log("Registering socket")
      const io_ = io({ host: "localhost", port: 6379 })
      registerSocket(io_)
      ;(async () => {
        try {
          await server.register(fastify_express)
          if (!PRODUCTION) {
            server.use(cors())
          }

          swaggerValidation.init(`${__dirname}/virtual-poster.v1.yaml`, {
            framework: "fastify",
            beautifyErrors: true,
          })
          await server.register(swaggerValidation.validate({}))

          server.setErrorHandler(async (err, req, reply) => {
            if (err instanceof swaggerValidation.InputValidationError) {
              server.log.warn(err.errors)
              return reply
                .status(400)
                .send(
                  PRODUCTION
                    ? "Invalid request body or query/path parameters."
                    : err.errors.join("\n")
                )
            }
            console.log(err)
            await reply.status(err.statusCode || 500).send(err.message)
          })

          await server.register(multer.contentParser)

          await server.register(protected_api_routes, { prefix: "/api" })
          await server.register(maps_routes, { prefix: "/api" })
          await server.register(comments_routes, { prefix: "/api" })
          await server.register(people_routes, { prefix: "/api" })
          await server.register(posters_routes, { prefix: "/api" })
          await server.register(groups_routes, { prefix: "/api" })
          await server.register(admin_routes, { prefix: "/api" })
          await server.register(public_api_routes, { prefix: "/api" })

          await server.register(fastify_static, {
            root: path.join(__dirname, "..", PRODUCTION ? "dist" : "public"),
            extensions: ["html"],
            maxAge: 1000 * 60 * 60 * 24,
          })

          server.get(
            "/api/ping",
            {
              schema: {
                response: {
                  200: {
                    type: "string",
                  },
                },
              },
            },
            async request => {
              try {
                return "pong"
              } catch (err) {
                request.log.error(err)
              }
            }
          )

          server.listen(PORT, "0.0.0.0", err => {
            // log.info(
            //   "Worker #" + cluster.worker?.id + " is listening on port " + PORT
            // )
            if (err) throw err
            // server.log.info(`server listening on ${address}`)
          })
        } catch (e) {
          console.log(e)
        }
      })().catch(err => {
        console.error(err)
      })

      // log.info(
      //   "Worker node: " + cluster.worker.id,
      //   cluster.worker.process.pid
      // )
      // initSocket(server)
    }
  })
  .catch(e => {
    console.log(e)
    // log.error("Init data error", e)
    process.exit(0)
  })

// server.listen(3030, (err, address) => {
//   if (err) throw err
//   server.log.info(`server listening on ${address}`)
// })
