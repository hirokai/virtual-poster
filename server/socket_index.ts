//
//  API and Socket.IO server, main code
//

import express from "express"
// import sticky from "sticky-session"
import { listen as sticky_listen } from "./sticky"
import _ from "lodash"
import * as bunyan from "bunyan"
import fs from "fs"
import path from "path"
import { setupSocketHandlers, registerSocket, emit } from "./socket"
import * as http from "http"
import * as https from "https"
import spdy from "spdy"
import cluster from "cluster"
import SocketIO from "socket.io"
import redis, { RedisAdapter } from "socket.io-redis"
import * as model from "./model"
import { AppNotification } from "../@types/types"
import dotenv from "dotenv"
import { config } from "./config"
import bodyParser from "body-parser"

dotenv.config()

const PRODUCTION = process.env.NODE_ENV == "production"

const RUN_CLUSTER: number = config.socket_server.cluster
const PORT: number = config.socket_server.port || (PRODUCTION ? 443 : 3000)
const TLS: boolean = config.socket_server.tls
const DEBUG_LOG = config.socket_server.debug_log
const CERTIFICATE_FOLDER = config.certificate_folder
const POSTGRES_CONNECTION_STRING = config.postgresql

export const log = bunyan.createLogger({
  name: "socket_index",
  src: !PRODUCTION,
  level: DEBUG_LOG ? 1 : "info",
})

if (!(RUN_CLUSTER > 0) || cluster.isMaster) {
  log.info("Settings", {
    PRODUCTION,
    PORT,
    TLS,
    DEBUG_LOG,
    RUN_CLUSTER,
    CERTIFICATE_FOLDER,
  })
}

const app = express()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get("/ping", (req, res) => {
  log.info("ping received")
  res.status(200).send("pong from socket server\n")
})

app.post("/input/:debug_token", (req, res) => {
  if (req.params.debug_token != config.debug_token) {
    res.send(403).send("Unauthorized")
    return
  }
  log.info("Emit input received", req.body)
  const data: { type: AppNotification } & any = req.body.data
  const topics: string[] = req.body.topics
  if (data.type == "Group") {
    emit.channel(topics[0]).group(data.group)
  } else if (data.type == "GroupRemove") {
    emit.channel(topics[0]).groupRemove(data.id)
  }
  res.status(200).send("OK")
})

let server: https.Server | http.Server | null = null

function run() {
  if (RUN_CLUSTER > 0 && cluster.isMaster) {
    const workers: number = RUN_CLUSTER
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
      log.info("HTTP2 (HTTPS) Socket.IO server created")
    } else {
      server = http.createServer(app)
      log.info(
        "HTTP Socket.IO server created" +
          (cluster.isMaster
            ? " (Master node)"
            : cluster.worker
            ? " (Worker #" + cluster.worker?.id + ")"
            : "")
      )
    }
    const io = SocketIO(server, {
      path: "/socket.io",
      origins: "*:*",
      transports: ["websocket"],
    })

    const adapter: RedisAdapter = redis(config.redis)
    io.adapter(adapter)

    registerSocket(io)
    setupSocketHandlers(io, log)
    server.listen(PORT, () => {
      log.info("Socket.IO server is listening on port: " + PORT)
    })
  }
}

async function workerInitData(): Promise<void> {
  if (!RUN_CLUSTER || cluster.worker?.id) {
    await model.initMapModel(POSTGRES_CONNECTION_STRING)
    log.info(`Worker #${cluster.worker?.id}: Initialization of map data done.`)
  }
}

workerInitData()
  .then(() => {
    run()
  })
  .catch(err => {
    log.error(err)
  })
