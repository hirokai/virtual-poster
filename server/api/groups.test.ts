import axios from "axios"
import _ from "lodash"
import { config } from "../config"
import { exec } from "child_process"
import { promisify } from "util"

jest.setTimeout(10000)

const execAsync = promisify(exec)

axios.defaults.baseURL = "http://localhost:3000/api/"

beforeAll(async () => {
  await execAsync("psql -d virtual_poster_test < migration/schema.sql")
  await axios.get("/is_test").catch(() => {
    throw "API server must be run with NODE_ENV=1"
  })
  await axios.post("/reload_data", {}).catch(err => {
    console.log(err)
    throw "Reload API server data failed"
  })
  const { data: r } = await axios.get("/init_admin?email=admin@gmail.com")
  console.log(r)
  expect(r["error"]).toBeUndefined()
  console.log(r["user_id"])
  axios.interceptors.request.use(cfg => {
    cfg.params = cfg.params || {}
    cfg.params["debug_token"] = config.debug_token
    cfg.params["debug_as"] = r["user_id"]
    return cfg
  })
})

test("Join and leave group", async done => {
  // console.log("Stub")
  expect(1).toBe(1)
  done()
})

test("Add and remove a person in a group", async done => {
  // console.log("Stub")
  expect(1).toBe(1)
  done()
})
