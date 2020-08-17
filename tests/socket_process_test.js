const _ = require("lodash")
const axios = require("axios")
const client = require("socket.io-client")

const API_URL = process.env.API_URL || "http://localhost:3000/api"
axios.defaults.baseURL = API_URL
// "https://posters.coi-conference.org/api"

const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:5000/"
// "https://posters.coi-conference.org:80/"

const myUserId = process.env.TEST_USER || ""
const room = process.env.ROOM || ""

let INTERVAL = parseInt(process.argv[2])
let MAX_NUM_LOGS = parseInt(process.argv[3])

INTERVAL = INTERVAL && !isNaN(INTERVAL) ? INTERVAL : 500
MAX_NUM_LOGS = MAX_NUM_LOGS && !isNaN(MAX_NUM_LOGS) ? MAX_NUM_LOGS : 100

const debug_token = process.env.DEBUG_TOKEN || ""
if (debug_token == "" || myUserId == "" || room == "") {
  console.log("DEBUG_TOKEN, TEST_USER, or ROOM is undefined")
  process.exit(0)
}

console.log(
  "Starting. MAX_NUM_LOGS: " + MAX_NUM_LOGS + " INTERVAL: " + INTERVAL
)

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

const socket = client.connect(SOCKET_URL)
let uids = []
const positions = {}
let emitted_ts = null
const latency_logs = []

let hallMap = {}
let people = {}
function terminate() {
  console.log(
    "\n" + ["--INTERVAL", "MAX_NUM_LOGS", INTERVAL, MAX_NUM_LOGS].join(",")
  )
  console.log("--Latency:" + myUserId + "," + latency_logs.join(","))
  const vs = latency_logs
  console.log(
    "--Summary:" +
      myUserId +
      "," +
      JSON.stringify({
        user: myUserId,
        count: vs.length,
        mean: Math.round(_.mean(vs)),
        min: _.min(vs),
        q5: Math.round(quantile(vs, 0.05)),
        median: Math.round(quantile(vs, 0.5)),
        q95: Math.round(quantile(vs, 0.95)),
        max: _.max(vs),
      })
  )
  process.exit(0)
}

process.on("SIGINT", terminate)

function isPersonInCell(x, y) {
  const p1 = _.find(Object.values(positions), p => {
    return p.x == x && p.y == y
  })
  return !!p1
}

function runFor(uid) {
  socket.on("connect", function() {
    console.log("Connected", myUserId, socket.id)
  })

  socket.emit("active", {
    room,
    user: uid,
    active: true,
  })

  socket.on("disconnect", function() {
    console.log("Disconnected", uid, socket.id)
  })

  socket.on("greeting", () => {
    // console.log("Greeting received, emitting active")
    socket.emit("active", {
      room,
      user: uid,
      active: true,
    })
  })

  socket.on("move.error", d => {
    positions[d.user_id] = d.pos
    console.log(
      "move.error",
      [d.user_id, ":", d.pos.x, ".", d.pos.y, ":", d.error].join("")
    )
    if (emitted_ts) {
      const latency = Date.now() - emitted_ts
      if (d.user_id == uid) {
        latency_logs.push(latency)
        if (latency_logs.length % 10 == 0) {
          console.log(
            `${latency_logs.length} logs recorded: ${uid} Mean = ${_.mean(
              latency_logs
            )}`
          )
        }
        if (latency_logs.length >= MAX_NUM_LOGS) {
          terminate()
        }
      }
    }
    emitted_ts = null
    // moving = false
  })

  socket.on("moved", dat => {
    // console.log("moved", dat)
    const [u, x_, y_, direction] = dat.split(",")
    const [x, y] = [x_, y_].map(s => parseInt(s))
    if (emitted_ts) {
      const latency = Date.now() - emitted_ts
      if (u == uid) {
        // console.log("moved", u, x, y)
        latency_logs.push(latency)
        if (latency_logs.length % 10 == 0) {
          console.log(
            `${latency_logs.length} logs recorded: ${uid} Mean = ${_.mean(
              latency_logs
            )}`
          )
        }
        if (latency_logs.length >= MAX_NUM_LOGS) {
          terminate()
        }
      }
    }
    // console.log(uid, "" + latency + "ms", x, y)
    emitted_ts = null
    positions[u] = { x, y, direction }
    // moving = false
  })

  socket.on("moved_multi", dat => {
    // console.log("moved_multi", dat)
    const ss = dat.split(";")

    for (const s of ss) {
      const [u, x_, y_, direction] = s.split(",")
      const [x, y] = [x_, y_].map(s => parseInt(s))
      positions[u] = { x, y, direction }
      if (emitted_ts) {
        const latency = Date.now() - emitted_ts
        if (u == myUserId) {
          // console.log(positions[u])
          latency_logs.push(latency)
          if (latency_logs.length % 10 == 0) {
            console.log(
              `${latency_logs.length} logs recorded: ${uid} Mean = ${_.mean(
                latency_logs
              )}`
            )
          }
          if (latency_logs.length >= MAX_NUM_LOGS) {
            terminate()
          }
        }
        // console.log(uid, "" + latency + "ms", x, y)
        emitted_ts = null
        // console.log(d)
        // moving = false
      }

      break
    }
  })

  setTimeout(() => {
    setInterval(() => {
      // if (!socket) {
      //   clearInterval(timers[uid])
      //   return
      // }
      if (emitted_ts) {
        console.log("Emitted already: " + uid)
        if (Date.now() - emitted_ts >= INTERVAL * 10) {
          console.log(
            "Seems inactive. Abort: " + uid + " " + latency_logs.length
          )
          terminate()
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
        nx = positions[uid].x + dx
        ny = positions[uid].y + dy
        if (
          0 <= nx &&
          nx < hallMap.numCols &&
          0 <= ny &&
          ny < hallMap.numRows &&
          hallMap.cells[ny][nx].open &&
          !isPersonInCell(nx, ny)
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
      emitted_ts = Date.now()
      socket.emit("move", d)
    }, INTERVAL)
  }, 3000 + Math.random() * INTERVAL)
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
    people = _.keyBy(data1, "id")
    uids = Object.keys(people)
    for (const u of uids) {
      const p = people[u]
      positions[u] = { x: p.x, y: p.y, direction: p.direction }
    }
    // console.log(uids)

    runFor(myUserId)
  })
  .catch(() => {
    //
  })
