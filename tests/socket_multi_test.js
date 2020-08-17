const child_process = require("child_process")
const axios = require("axios")
const _ = require("lodash")

// DEBUG_TOKEN=hogehoge PORT=5000 TEST_USER=U-D-LpL6ARGq ROOM=R-Yol0nhIM node tests/socket_process.test.js 100 100
console.log("parent:" + process.pid)
const NUM_USERS = parseInt(process.argv[2]) || 1
const INTERVAL = parseInt(process.argv[3]) || 200
const MAX_NUM_LOGS = parseInt(process.argv[4]) || 100
const debug_token = process.env.DEBUG_TOKEN || ""
const room = process.env.ROOM || ""
const apiUser = process.env.API_USER || ""
const exclude = (process.env.EXCLUDE_USERS || "").split(",")

const API_URL = process.env.API_URL || "http://localhost:3000/api"
axios.defaults.baseURL = API_URL

let aborted = false

if (debug_token == "" || apiUser == "" || room == "") {
  console.log("DEBUG_TOKEN, API_USER, or ROOM is undefined")
  process.exit(0)
}

const keyBy = (array, key) =>
  (array || []).reduce((r, x) => ({ ...r, [key ? x[key] : x]: x }), {})

const procs = {}
axios
  .get("/maps/" + room + "/people", {
    params: { debug_as: apiUser, debug_token },
  })
  .then(({ data: data1 }) => {
    const people = keyBy(data1, "id")
    let uids = _.difference(Object.keys(people), exclude)
    uids = _.shuffle(uids).slice(0, NUM_USERS)
    console.log(`${uids.length} users`)
    for (const user_id of uids) {
      setTimeout(() => {
        procs[user_id] = child_process.spawn(
          "node",
          ["./tests/socket_process.test.js", "" + INTERVAL, "" + MAX_NUM_LOGS],
          {
            env: {
              ...process.env,
              DEBUG_TOKEN: debug_token,
              PORT: process.env.PORT,
              TEST_USER: user_id,
              ROOM: room,
            },
          }
        )
        procs[user_id].stdout.on("data", data => {
          console.log(
            data
              .toString()
              .trim()
              .split("\n")
              .map(s => procs[user_id].pid + ": " + s)
              .join("\n")
          )
        })
        procs[user_id].on("error", err => {
          console.log(err)
        })
      }, Math.random() * INTERVAL)
    }
    setInterval(() => {
      if (aborted) {
        for (const p of Object.values(procs)) {
          p.kill("SIGINT")
        }
        process.exit(0)
      }
    }, 500)
  })
  .catch(err => {
    console.error(err)
  })

function terminate() {
  aborted = true
}

process.on("SIGINT", terminate)
