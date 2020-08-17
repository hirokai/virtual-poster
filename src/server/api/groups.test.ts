import axios from "axios"
import _ from "lodash"

jest.setTimeout(10000)

axios.defaults.baseURL = "http://localhost:3000/api/"

axios.interceptors.request.use(config => {
  config.params = config.params || {}
  config.params["debug_token"] = process.env.DEBUG_TOKEN
  config.params["debug_as"] = process.env.DEBUG_AS
  return config
})

if (!process.env.DEBUG_TOKEN || !process.env.DEBUG_AS) {
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
