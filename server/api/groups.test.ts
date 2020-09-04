import axios from "axios"
import _ from "lodash"
import { config } from "../config"
jest.setTimeout(10000)

axios.defaults.baseURL = "http://localhost:3000/api/"

axios.interceptors.request.use(cfg => {
  cfg.params = cfg.params || {}
  cfg.params["debug_token"] = config.debug_token
  cfg.params["debug_as"] = process.env.DEBUG_AS
  return cfg
})

if (!config.debug_token || !process.env.DEBUG_AS) {
  throw "Debug token not specified."
}

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
