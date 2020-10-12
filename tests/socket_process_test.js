const performance = require("perf_hooks").performance

const EMIT_TIMEOUT = 2000

const _ = require("lodash")
const axios = require("axios")
const WebSocket = require("ws")

const API_URL = process.env.API_URL || "http://localhost:3000/api"
const RUST_WS = false
const SOCKET_URL =
  process.env.SOCKET_URL ||
  (RUST_WS ? "http://localhost:5000/ws" : "http://localhost:5000/")

axios.defaults.baseURL = API_URL
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

const client = RUST_WS ? undefined : require("socket.io-client")

let uids = []
const positions = {}
let emitted_ts = null
const latency_logs = []

let hallMap = {}
let people = {}
function terminate(ws) {
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
        mean: +_.mean(vs).toFixed(2),
        min: _.min(vs),
        q5: +quantile(vs, 0.05).toFixed(2),
        median: +quantile(vs, 0.5).toFixed(2),
        q95: +quantile(vs, 0.95).toFixed(2),
        max: _.max(vs),
      })
  )
  if (ws) {
    ws.close()
  }

  process.exit(0)
}

function isPersonInCell(x, y) {
  const p1 = _.find(Object.values(positions), p => {
    return p.x == x && p.y == y
  })
  return !!p1
}

const initial_wait_time = 2000 + Math.random() * INTERVAL

function runForSocketIO(uid) {
  const socket = client.connect(SOCKET_URL)
  console.log(SOCKET_URL, socket.connected)
  process.on("SIGINT", () => {
    terminate()
  })
  console.log("runForSocketIO")
  socket.on("connect", () => {
    console.log("Connected", myUserId)
    socket.emit("Active", {
      room,
      user: uid,
      token: debug_token,
      debug_as: myUserId,
    })
    socket.emit("Subscribe", {
      channel: room,
    })
    console.log(`Waiting to start: ${initial_wait_time.toFixed(0)} ms.`)
    // socket.send(JSON.stringify({ type: "Active" }))
  })

  socket.on("disconnect", function() {
    console.log("Disconnected", uid, socket.id)
  })

  const onMoved = str => {
    // console.log("moved_multi", dat)
    const ss = str.split(";")

    for (const s of ss) {
      const [u, x_, y_, direction] = s.split(",")
      const [x, y] = [x_, y_].map(s => parseInt(s))
      positions[u] = { x, y, direction }
      if (emitted_ts) {
        const latency = +(performance.now() - emitted_ts).toFixed(2)
        if (u == myUserId) {
          // console.log(positions[u])
          latency_logs.push(latency)
          if (latency_logs.length % 10 == 0) {
            console.log(
              `${
                latency_logs.length
              } logs recorded: ${uid} Mean latency = ${_.mean(
                latency_logs
              ).toFixed(2)} ms.`
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
    }
  }

  socket.on("Moved", data => {
    onMoved(data)
  })

  socket.on("MoveError", d => {
    positions[d.user_id] = d.pos
    console.log(
      "MoveError",
      [d.user_id, ":", d.pos.x, ".", d.pos.y, ":", d.error].join("")
    )
    if (emitted_ts) {
      const latency = +(performance.now() - emitted_ts).toFixed(2)
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

  setTimeout(() => {
    console.log("Batch started.", socket.connected)
    setInterval(() => {
      if (emitted_ts) {
        // console.log("Emitted already: " + uid)
        if (performance.now() - emitted_ts >= EMIT_TIMEOUT) {
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
      let count = 0
      for (count = 0; count < 10000; count += 1) {
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
          ["wall", "water", "poster"].indexOf(hallMap.cells[ny][nx].kind) ==
            -1 &&
          !isPersonInCell(nx, ny)
        ) {
          break
        }
      }
      if (count == 10000) {
        console.error("Open pos NOT FOUND")
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
      emitted_ts = performance.now()
      // console.log(socket)
      socket.emit("Move", d)
    }, INTERVAL)
  }, initial_wait_time)
}

function runForWS(uid) {
  const ws = new WebSocket(SOCKET_URL)
  process.on("SIGINT", () => {
    terminate(ws)
  })
  console.log("runFor")
  ws.on("open", () => {
    console.log("Connected", myUserId)
    ws.send(
      JSON.stringify({
        Active: {
          room,
          user: uid,
          token: debug_token,
          debug_as: myUserId,
        },
      })
    )
    ws.send(
      JSON.stringify({
        Subscribe: {
          channel: room,
        },
      })
    )
    console.log(`Waiting to start: ${initial_wait_time.toFixed(0)} ms.`)
    // socket.send(JSON.stringify({ type: "Active" }))
  })

  console.log("Socket active sent")

  ws.on("close", function() {
    console.log("Disconnected", uid, ws.id)
  })

  const onMoved = str => {
    console.log("onMoved", str)
    const ss = str.split(";")

    for (const s of ss) {
      const [u, x_, y_, direction] = s.split(",")
      const [x, y] = [x_, y_].map(s => parseInt(s))
      positions[u] = { x, y, direction }
      if (emitted_ts) {
        const latency = +(performance.now() - emitted_ts).toFixed(2)
        if (u == myUserId) {
          // console.log(positions[u])
          latency_logs.push(latency)
          if (latency_logs.length % 10 == 0) {
            console.log(
              `${
                latency_logs.length
              } logs recorded: ${uid} Mean latency = ${_.mean(
                latency_logs
              ).toFixed(2)} ms.`
            )
          }
          if (latency_logs.length >= MAX_NUM_LOGS) {
            terminate(ws)
          }
        }
        // console.log(uid, "" + latency + "ms", x, y)
        emitted_ts = null
        // console.log(d)
        // moving = false
      }
    }
  }

  ws.on("message", msg => {
    // console.log("Received:", msg)
    let obj
    try {
      obj = JSON.parse(msg)
    } catch (e) {
      obj = null
    }
    if (obj && obj.type == "Moved") {
      onMoved(obj.data)
    }
  })

  /*
  ws.on("MoveError", d => {
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
  })*/

  setTimeout(() => {
    console.log("Batch started.")
    setInterval(() => {
      if (emitted_ts) {
        console.log("Emitted already: " + uid)
        if (performance.now() - emitted_ts >= INTERVAL * 10) {
          console.log(
            "Seems inactive. Abort: " + uid + " " + latency_logs.length
          )
          terminate(ws)
        }
        return
      }
      let nx = 0
      let ny = 0
      let dx = 0,
        dy = 0
      let count = 0
      for (count = 0; count < 10000; count += 1) {
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
          ["wall", "water", "poster"].indexOf(hallMap.cells[ny][nx].kind) ==
            -1 &&
          !isPersonInCell(nx, ny)
        ) {
          break
        }
      }
      if (count == 10000) {
        console.error("Open pos NOT FOUND")
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
      emitted_ts = performance.now()
      ws.send(JSON.stringify({ Move: d }))
    }, INTERVAL)
  }, initial_wait_time)
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
    console.log("Map and people data received")
    hallMap = data2
    people = _.keyBy(data1, "id")
    uids = Object.keys(people)
    for (const u of uids) {
      const p = people[u]
      positions[u] = { x: p.x, y: p.y, direction: p.direction }
    }
    // console.log(uids, hallMap)

    try {
      if (RUST_WS) {
        runForWS(myUserId)
      } else {
        runForSocketIO(myUserId)
      }
    } catch (err) {
      console.error(err)
    }
  })
  .catch(err => {
    console.error("REST API failed", err)
  })
