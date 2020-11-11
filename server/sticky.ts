// Adapted from: https://github.com/indutny/sticky-session

import cluster from "cluster"
import net from "net"
import ip from "ip"
import os from "os"
import http from "http"
import https from "https"
import { log } from "./socket_index"

class Master extends net.Server {
  env: any
  seed: number
  workers: cluster.Worker[]
  constructor(workerCount, env) {
    super(
      {
        pauseOnConnect: true,
      },
      (socket: net.Socket) => {
        // const addr_str =
        //   socket.remoteAddress && socket.remotePort
        //     ? socket.remoteAddress + ":" + socket.remotePort
        //     : "127.0.0.1"
        const addr_str = socket.remoteAddress || "127.0.0.1"
        log.debug("sticky balance", addr_str)
        const addr = ip.toBuffer(addr_str)
        const hash = this.hash(addr)

        // debug("balacing connection %j", addr)
        this.workers[hash % this.workers.length].send("sticky:balance", socket)
      }
    )

    this.env = env || {}

    this.seed = (Math.random() * 0xffffffff) | 0
    this.workers = []

    //   debug("master seed=%d", this.seed)

    this.once("listening", () => {
      log.debug("master listening on %j", this.address())

      for (let i = 0; i < workerCount; i++) this.spawnWorker()
    })
  }
  spawnWorker() {
    const worker = cluster.fork(this.env)

    worker.on("exit", code => {
      //   debug("worker=%d died with code=%d", worker.process.pid, code)
      this.respawn(worker)
    })

    worker.on("message", msg => {
      // Graceful exit
      if (msg.type === "close") this.respawn(worker)
    })

    // debug("worker=%d spawn", worker.process.pid)
    this.workers.push(worker)
  }
  hash(ip) {
    let hash = this.seed
    for (let i = 0; i < ip.length; i++) {
      const num = ip[i]

      hash += num
      hash %= 2147483648
      hash += hash << 10
      hash %= 2147483648
      hash ^= hash >> 6
    }

    hash += hash << 3
    hash %= 2147483648
    hash ^= hash >> 11
    hash += hash << 15
    hash %= 2147483648

    return hash >>> 0
  }
  respawn(worker) {
    const index = this.workers.indexOf(worker)
    if (index !== -1) this.workers.splice(index, 1)
    this.spawnWorker()
  }
}

export function listen(server: http.Server | https.Server, port, options) {
  log.info("Listen sticky start", cluster.isMaster)
  if (!options) options = {}

  if (cluster.isMaster) {
    const workerCount = options.workers || os.cpus().length

    const master = new Master(workerCount, options.env)
    master.listen(port)
    master.once("listening", function() {
      server.emit("listening")
    })
    return false
  }

  // Override close callback to gracefully close server
  const oldClose = server.close
  server.close = (...args: any[]) => {
    // debug("graceful close")
    process.send!({ type: "close" })
    return oldClose(...args)
  }

  process.on("message", (msg, socket) => {
    if (msg !== "sticky:balance" || !socket) return

    // debug("incoming socket")
    server.connections++
    socket.server = server
    server.emit("connection", socket)
  })
  return true
}
