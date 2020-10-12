const child_process = require("child_process")
const axios = require("axios")
const _ = require("lodash")
const path = require("path")
const jsYaml = require("js-yaml")
const fs = require("fs")
const config = jsYaml.load(
  fs.readFileSync(path.join(__dirname, "..", "virtual_poster.yaml"))
)

console.log("parent:" + process.pid)
const NUM_USERS = parseInt(process.argv[2]) || 1
const INTERVAL = parseInt(process.argv[3]) || 200
const MAX_NUM_LOGS = parseInt(process.argv[4]) || 100
const PORT = parseInt(process.env.PORT || "5000") || 5000
const debug_token = process.env.DEBUG_TOKEN || config.debug_token || ""
const room = process.env.ROOM || ""
const API_USER = process.env.API_USER || ""
const exclude = (process.env.EXCLUDE_USERS || "").split(",")

const API_URL = process.env.API_URL || "http://localhost:3000/api"

axios.defaults.baseURL = API_URL

let aborted = false

console.log({
  debug_token,
  API_USER,
  room,
})

if (debug_token == "" || API_USER == "" || room == "") {
  console.log("DEBUG_TOKEN, TEST_USER, or ROOM is undefined")
  process.exit(0)
}

const keyBy = (array, key) =>
  (array || []).reduce((r, x) => ({ ...r, [key ? x[key] : x]: x }), {})

const procs = {}
axios
  .get("/maps/" + room + "/people", {
    params: { debug_as: API_USER, debug_token },
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
          [
            path.join(__dirname, "socket_process_test.js"),
            "" + INTERVAL,
            "" + MAX_NUM_LOGS,
          ],
          {
            env: {
              ...process.env,
              DEBUG_TOKEN: debug_token,
              PORT: PORT,
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
    console.error(err.message)
  })

function terminate() {
  aborted = true
}

process.on("SIGINT", terminate)
