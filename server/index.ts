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
import comments_routes from "./api/chat"
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
import { AppNotification } from "../@types/types"
import * as bunyan from "bunyan"
import io from "socket.io-emitter"
import cluster from "cluster"
import _ from "lodash"
import multer from "fastify-multer"
import swaggerValidation from "openapi-validator-middleware"
import fastifyCookie from "fastify-cookie"
import { config } from "./config"
import axios from "axios"
import { encodeAppNotificationData } from "../common/util"

const PRODUCTION: boolean = process.env.NODE_ENV == "production"

const RUST_WS_SERVER: boolean = config.socket_server.system == "Rust"
const RUN_CLUSTER: number = config.api_server.cluster
const PORT: number = config.api_server.port || (PRODUCTION ? 443 : 3000)
const HTTP2: boolean = config.api_server.http2
const TLS: boolean = config.api_server.tls
const DEBUG_LOG = config.api_server.debug_log
const DEBUG_TOKEN = config.debug_token
const CERTIFICATE_FOLDER = config.certificate_folder
const POSTGRES_CONNECTION_STRING = config.postgresql
const GOOGLE_APPLICATION_CREDENTIALS = config.firebase_auth_credential

const log = bunyan.createLogger({
  name: "index",
  src: !PRODUCTION,
  level: DEBUG_LOG ? 1 : "info",
})

if (!(RUN_CLUSTER > 0) || cluster.isMaster) {
  log.info("Settings", {
    PRODUCTION,
    PORT,
    HTTP2,
    TLS,
    RUST_WS_SERVER,
    DEBUG_LOG,
    RUN_CLUSTER,
    CERTIFICATE_FOLDER,
    POSTGRES_CONNECTION_STRING,
    GOOGLE_APPLICATION_CREDENTIALS,
  })
}
class HTTPEmitter {
  channels: string[] = []
  url =
    "http://localhost:" +
    config.socket_server.port +
    "/input/" +
    config.debug_token
  constructor(channels: string[] = []) {
    this.channels = channels
  }
  emit(cmd: AppNotification, cmd_data?: any) {
    const data_to_send = encodeAppNotificationData(cmd, cmd_data)
    if (!data_to_send) {
      log.error("Error in encoding notification", cmd, cmd_data)
      return
    }
    log.info("Emitting: ", data_to_send)
    const data = { channels: this.channels, data: data_to_send }
    axios
      .post(this.url, data)
      .then(r => {
        console.log("HTTPEmitter result:", r.status, r.data)
      })
      .catch(err => {
        console.error("HTTPEmitter error with: ", data, err.message)
      })
  }
  to(channel: string) {
    return new HTTPEmitter(this.channels.concat([channel]))
  }
}

async function workerInitData(): Promise<void> {
  await model.initMapModel(POSTGRES_CONNECTION_STRING)
  if (!(RUN_CLUSTER > 0) || cluster.isMaster) {
    await model.initDataForMaster(POSTGRES_CONNECTION_STRING)
  }
}

// let server: https.Server | http.Server

workerInitData()
  .then(() => {
    if (RUN_CLUSTER > 0 && cluster.isMaster) {
      const workers: number = RUN_CLUSTER // require('os').cpus().length
      log.info("Master node run")
      _.range(workers).forEach(() => {
        const worker = cluster.fork()
        log.info("CLUSTER: Worker %d forked", worker.id)
      })
      cluster.on("exit", old_worker => {
        log.info("CLUSTER: Worker %d exited", old_worker.id)
        const worker = cluster.fork()
        log.info("CLUSTER: Worker %d started", worker.id)
      })
    } else {
      if (cluster.worker?.id) {
        log.info("Starting worker #" + cluster.worker?.id)
      }

      let server: fastify_.FastifyInstance<any, any, any, any>
      if (HTTP2) {
        const opt = {
          http2: true,
          // logger: pino({ level: "warn" }),
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
          // logger: pino({ level: "warn" }),
          logger: DEBUG_LOG ? pino({ level: "debug" }) : false,
        })
      }

      if (RUST_WS_SERVER) {
        registerSocket(new HTTPEmitter())
      } else {
        registerSocket(io({ host: "localhost", port: 6379 }))
      }
      ;(async () => {
        try {
          await server.register(fastifyCookie, {
            secret: DEBUG_TOKEN || "",
          })

          await swaggerValidation.initAsync(`./server/virtual-poster.v1.yaml`, {
            framework: "fastify",
            beautifyErrors: true,
          })
          await server.register(swaggerValidation.validate({}))

          server.setErrorHandler(async (err, req, reply) => {
            console.log("ERROR!!!!!", err)
            if (err instanceof swaggerValidation.InputValidationError) {
              server.log.warn(err.errors)
              return reply.status(400).send(err.errors.join("\n"))
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
            root: path.join(process.cwd(), PRODUCTION ? "dist" : "public"),
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
            log.info(
              `Server started: listening on ${PORT}` +
                (cluster.isMaster
                  ? " (Master node)"
                  : cluster.worker
                  ? " (Worker #" + cluster.worker?.id + ")"
                  : "")
            )
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
