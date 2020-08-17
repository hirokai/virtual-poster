const client = require("socket.io-client")
const _ = require("lodash")

const axios = require("axios")

const API_URL = process.env.API_URL || "http://localhost:3000/api"
axios.defaults.baseURL = API_URL
// "https://posters.coi-conference.org/api"

const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:5000/"
// "https://posters.coi-conference.org:80/"

const myUserId = process.env.TEST_USER || ""
const room = process.env.ROOM || ""

let NUM_USERS = parseInt(process.argv[2])
let INTERVAL = parseInt(process.argv[3])
let MAX_NUM_LOGS = parseInt(process.argv[4])

NUM_USERS = NUM_USERS && !isNaN(NUM_USERS) ? NUM_USERS : 5
INTERVAL = INTERVAL && !isNaN(INTERVAL) ? INTERVAL : 500
MAX_NUM_LOGS = MAX_NUM_LOGS && !isNaN(MAX_NUM_LOGS) ? MAX_NUM_LOGS : 100

const debug_token = process.env.DEBUG_TOKEN || ""
if (debug_token == "" || myUserId == "" || room == "") {
  console.log("DEBUG_TOKEN, TEST_USER, or ROOM is undefined")
  process.exit(0)
}

const exclude = [myUserId]

console.log("# of logs to collect: " + MAX_NUM_LOGS)

// sort array ascending
const asc = arr => arr.sort((a, b) => a - b)

const sum = arr => arr.reduce((a, b) => a + b, 0)

const mean = arr => sum(arr) / arr.length

// sample standard deviation
const _std = arr => {
  const mu = mean(arr)
  const diffArr = arr.map(a => (a - mu) ** 2)
  return Math.sqrt(sum(diffArr) / (arr.length - 1))
}

const quantile = (arr, q) => {
  const sorted = asc(arr)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  } else {
    return sorted[base]
  }
}

const socket = {}
let uids = []
const positions = {}
const emitted_ts = {}
const latency_logs = []
const timers = {}

let hallMap = {}

function terminate() {
  const final_uids = Object.keys(latency_logs)

  console.log("\n" + ["--NUM_USERS", "INTERVAL", "MAX_NUM_LOGS"].join(","))
  console.log([NUM_USERS, INTERVAL, MAX_NUM_LOGS].join(","))
  console.log("--Final # of users")
  console.log(final_uids.length)
  console.log("--Latency list for each user")

  for (const uid of final_uids) {
    console.log(uid + "," + latency_logs[uid].join(","))
  }
  console.log("--Summary")
  console.log("--Mean,Min,5% percentile,Median,95% percentile,Max")
  for (const uid of final_uids) {
    const vs = latency_logs[uid]
    console.log(
      uid,
      vs.length,
      Math.round(_.mean(vs)),
      _.min(vs),
      Math.round(quantile(vs, 0.05)),
      Math.round(quantile(vs, 0.5)),
      Math.round(quantile(vs, 0.95)),
      _.max(vs)
    )
  }
  const vs = _.flatten(Object.values(latency_logs))
  console.log(
    "Total",
    vs.length,
    Math.round(_.mean(vs)),
    _.min(vs),
    Math.round(quantile(vs, 0.05)),
    Math.round(quantile(vs, 0.5)),
    Math.round(quantile(vs, 0.95)),
    _.max(vs)
  )
  process.exit(0)
}

function runFor(uids) {
  console.log("# of users: ", uids.length)

  setTimeout(() => {
    for (const u of uids) {
      if (!socket[u].connected) {
        delete latency_logs[u]
        delete socket[u]
        console.log("Socket deleted: " + u)
      }
    }
  }, 5000)

  for (const uid of uids) {
    emitted_ts[uid] = {}
    latency_logs[uid] = []
    socket[uid] = client.connect(SOCKET_URL)

    socket[uid].emit("active", {
      room,
      user: uid,
      active: true,
    })

    socket[uid].on("connect", function() {
      console.log("Connected", uid, socket[uid] ? socket[uid].id : "")
    })

    socket[uid].on("disconnect", function() {
      console.log("Disconnected", uid, socket[uid].id)
    })

    socket[uid].on("greeting", () => {
      // console.log("Greeting received, emitting active")
      socket[uid].emit("active", {
        room,
        user: uid,
        active: true,
      })
    })

    socket[uid].on("move.error", d => {
      positions[uid][d.user_id] = d.pos
      console.log(
        "move.error",
        [d.user_id, ":", d.pos.x, ".", d.pos.y, ":", d.error].join("")
      )
      if (emitted_ts[uid][d.user_id]) {
        const latency = Date.now() - emitted_ts[uid][d.user_id]
        if (d.user_id == uid) {
          latency_logs[uid].push(latency)
          if (latency_logs[uid].length % 10 == 0) {
            console.log(
              `${
                latency_logs[uid].length
              } logs recorded: ${uid} Mean = ${_.mean(latency_logs[uid])}`
            )
          }
          if (
            _.every(Object.values(latency_logs), ls => {
              return ls.length >= MAX_NUM_LOGS
            })
          ) {
            terminate()
          }
        }
      }
      delete emitted_ts[uid][d.user_id]

      // moving = false
    })

    socket[uid].on("moved", dat => {
      // console.log("moved", dat)
      const [u, x_, y_, direction] = dat.split(",")
      const [x, y] = [x_, y_].map(s => parseInt(s))
      if (emitted_ts[uid][u]) {
        const latency = Date.now() - emitted_ts[uid][u]
        if (u == uid) {
          // console.log("moved", u, x, y)
          latency_logs[uid].push(latency)
          if (latency_logs[uid].length % 10 == 0) {
            console.log(
              `${
                latency_logs[uid].length
              } logs recorded: ${uid} Mean = ${_.mean(latency_logs[uid])}`
            )
          }
          if (
            _.every(Object.values(latency_logs), ls => {
              return ls.length >= MAX_NUM_LOGS
            })
          ) {
            terminate()
          }
        }
      }
      // console.log(uid, "" + latency + "ms", x, y)
      delete emitted_ts[uid][u]
      positions[uid][u] = { x, y, direction }
      // moving = false
    })

    socket[uid].on("moved_multi", dat => {
      // console.log("moved_multi", dat)
      const ss = dat.split(";")

      for (const s of ss) {
        const [u, x_, y_, direction] = s.split(",")
        const [x, y] = [x_, y_].map(s => parseInt(s))
        positions[uid][u] = { x, y, direction }
        if (emitted_ts[uid][u]) {
          const latency = Date.now() - emitted_ts[uid]
          if (u == myUserId) {
            latency_logs[uid].push(latency)
            if (latency_logs[uid].length % 10 == 0) {
              console.log(
                `${
                  latency_logs[uid].length
                } logs recorded: ${uid} Mean = ${_.mean(latency_logs[uid])}`
              )
            }
            if (
              _.every(Object.values(latency_logs), ls => {
                return ls.length >= MAX_NUM_LOGS
              })
            ) {
              terminate()
            }
          }
          // console.log(uid, "" + latency + "ms", x, y)
          delete emitted_ts[uid][u]
          // console.log(d)
          // moving = false
        }

        break
      }
    })

    setTimeout(() => {
      timers[uid] = setInterval(() => {
        // if (!socket[uid]) {
        //   clearInterval(timers[uid])
        //   return
        // }
        if (emitted_ts[uid][uid]) {
          console.log("Emitted already: " + uid)
          if (Date.now() - emitted_ts[uid][uid] >= INTERVAL * 10) {
            console.log(
              "Seems inactive. Abort: " + uid + " " + latency_logs[uid].length
            )
            clearInterval(timers[uid])
            delete timers[uid]
            delete latency_logs[uid]
          }
          return
        }
        let nx = 0
        let ny = 0
        let dx = 0,
          dy = 0
        for (;;) {
          const dir = Math.floor(Math.random() * 4)
          if (dir == 0) {
            dx = 1
            dy = 0
          } else if (dir == 1) {
            dx = 0
            dy = 1
          } else if (dir == 2) {
            dx = 0
            dy = -1
          } else if (dir == 3) {
            dx = -1
            dy = 0
          }
          nx = positions[uid][uid].x + dx
          ny = positions[uid][uid].y + dy
          // nx = positions[uid][uid].x + Math.floor(Math.random() * 3) - 1
          // ny = positions[uid][uid].y + Math.floor(Math.random() * 3) - 1
          if (
            0 <= nx &&
            nx < hallMap.numCols &&
            0 <= ny &&
            ny < hallMap.numRows &&
            hallMap.cells[ny][nx].open
          ) {
            break
          }
        }
        const d = {
          x: nx,
          y: ny,
          room,
          user: uid,
          token: debug_token,
          debug_as: uid,
        }
        // console.log(
        //   uid,
        //   "moving from",
        //   { x: positions[uid][uid].x, y: positions[uid][uid].y },
        //   "to",
        //   { x: nx, y: ny }
        // )
        emitted_ts[uid][uid] = Date.now()
        socket[uid].emit("move", d)
      }, INTERVAL)
    }, 3000 + Math.random() * INTERVAL)
  }
}

Promise.all([
  axios.get("/maps/" + room + "/people", {
    params: { debug_as: myUserId, debug_token },
  }),
  axios.get("/maps/" + room, {
    params: { debug_as: myUserId, debug_token },
  }),
])
  .then(([{ data: data1 }, { data: data2 }]) => {
    hallMap = data2
    const people = _.keyBy(data1, "id")
    uids = Object.keys(people)
    uids = _.take(_.shuffle(_.difference(uids, exclude)), NUM_USERS)
    for (const u of uids) {
      positions[u] = {}
      for (const u2 of uids) {
        const p = people[u2]
        positions[u][u2] = { x: p.x, y: p.y, direction: p.direction }
        // console.log(p.id)
      }
    }
    // console.log(uids)

    runFor(uids)
  })
  .catch(() => {
    //
  })

process.on("SIGINT", terminate)
