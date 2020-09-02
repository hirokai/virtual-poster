//
//  API and Socket.IO server, main code
//

import express from "express"
import sticky from "sticky-session"
import * as bunyan from "bunyan"
import fs from "fs"
import path from "path"
import { setupSocketHandlers, registerSocket } from "./socket"
import * as http from "http"
import * as https from "https"
import spdy from "spdy"
import cluster from "cluster"
import SocketIO from "socket.io"
import redis, { RedisAdapter } from "socket.io-redis"
import * as model from "./model"
import { RoomId } from "@/@types/types"
import dotenv from "dotenv"

dotenv.config()

// Setting by env vars.
const RUN_CLUSTER: number | false = process.env.RUN_CLUSTER
  ? parseInt(process.env.RUN_CLUSTER) || false
  : false
const PRODUCTION = process.env.NODE_ENV == "production"
const PORT =
  (process.env.PORT && parseInt(process.env.PORT)) || (PRODUCTION ? 80 : 5000)
const TLS = process.env.NO_TLS ? false : !!process.env.TLS || PRODUCTION
const DEBUG_LOG = !!process.env.DEBUG_LOG || !PRODUCTION
const CERTIFICATE_FOLDER = process.env.CERTIFICATE_FOLDER
const POSTGRES_CONNECTION_STRING = process.env.NODE_TEST
  ? "postgres://postgres@localhost/virtual_poster_test"
  : process.env.POSTGRES_CONNECTION_STRING ||
    "postgres://postgres@localhost/virtual_poster"

const log = bunyan.createLogger({
  name: "index",
  src: !PRODUCTION,
  level: DEBUG_LOG ? 1 : "info",
})

log.info("Settings", {
  PRODUCTION,
  PORT,
  TLS,
  DEBUG_LOG,
  RUN_CLUSTER,
  CERTIFICATE_FOLDER,
})

const app = express()

app.get("/ping", (req, res) => {
  log.info("ping received")
  res.status(200).send("pong from socket server\n")
})

let server: https.Server | http.Server | null = null

function run() {
  if (TLS) {
    if (!CERTIFICATE_FOLDER) {
      log.error("CERTIFICATE_FOLDER is not specified. Aborting.")
      return
    }
    // https://itnext.io/node-express-letsencrypt-generate-a-free-ssl-certificate-and-run-an-https-server-in-5-minutes-a730fbe528ca
    const privateKey = fs.readFileSync(
      path.join(CERTIFICATE_FOLDER, "privkey.pem"),
      "utf8"
    )
    const certificate = fs.readFileSync(
      path.join(CERTIFICATE_FOLDER, "cert.pem"),
      "utf8"
    )
    const ca = fs.readFileSync(
      path.join(CERTIFICATE_FOLDER, "chain.pem"),
      "utf8"
    )
    const credentials = {
      key: privateKey,
      cert: certificate,
      ca: ca,
    }
    server = spdy.createServer(credentials, app)
    log.info("HTTP2 (HTTPS) Socket.IO server started")
  } else {
    server = http.createServer(app)
    log.info("HTTP Socket.IO server started")
  }
  if (RUN_CLUSTER) {
    const workers: number = parseInt(process.env.RUN_CLUSTER || "1") // require('os').cpus().length
    if (!sticky.listen(server, PORT, { workers })) {
      log.info("Socket.IO Master node run")
      server.once("listening", () => {
        log.info("Cluster Socket.IO master node is listening on port: " + PORT)
      })
      // initSocket(server, rooms)
    } else {
      log.info("Worker node: " + cluster.worker.id, cluster.worker.process.pid)
    }
  } else {
    server.listen(PORT, () => {
      log.info("Socket.IO server is listening on port: " + PORT)
    })
  }

  const io = SocketIO(server, {
    path: "/socket.io",
    origins: "*:*",
  })

  // middleware
  io.use((socket, next) => {
    const cookie = socket.handshake.headers.cookie
    socket.handshake.headers.cookie = cookie + "; hoge=1"

    log.debug(cookie)
    return next()
    // }
    // return next(new Error("authentication error"))
  })

  const adapter: RedisAdapter = redis()
  io.adapter(adapter)

  registerSocket(io)
  setupSocketHandlers(io, log)
}

async function workerInitData(): Promise<RoomId[]> {
  if (!RUN_CLUSTER || cluster.worker?.id) {
    const rooms = await model.initData(POSTGRES_CONNECTION_STRING)
    return rooms
  } else {
    return []
  }
}

workerInitData()
  .then(() => {
    log.info("Data initialization done.")
    run()
  })
  .catch(err => {
    log.error(err)
  })
