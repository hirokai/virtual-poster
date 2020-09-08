import axios from "axios"
import { Person, Room } from "@/@types/types"
import _ from "lodash"
import { exec } from "child_process"
import { promisify } from "util"
import { random_str } from "../test_util"
import { config } from "../config"
import * as model from "../model"

const execAsync = promisify(exec)
jest.setTimeout(10000)

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

test("ping", async () => {
  const { data } = await axios.get("/ping")
  expect(data).toBe("pong")
})

test("Email must be unique", async () => {
  const name = "Test user " + Math.floor(Math.random() * 10000)
  const email = "hoge" + Math.floor(Math.random() * 10000) + "@gmail.com"
  const { data: r1 } = await axios.post("/people", {
    name,
    email,
  })
  expect(r1.ok).toBe(true)
  const name2 = "Test user " + Math.floor(Math.random() * 10000)
  const { data: r2 } = await axios.post("/people", {
    name: name2,
    email,
  })
  expect(r2.ok).toBe(false)
})

describe("Create and get", () => {
  beforeAll(async () => {
    await execAsync("psql -d virtual_poster_test < migration/schema.sql")
  })
  test("Create and get people", async done => {
    const NUM_PEOPLE = 100
    const res = await axios.get("/people")
    for (const _i of _.range(NUM_PEOPLE)) {
      const name = "Test user " + random_str(10)
      const email = "hoge" + random_str(10) + "@gmail.com"
      const { data: r1 } = await axios.post("/people", {
        name,
        email,
      })
      expect(r1.ok).toBe(true)
    }
    const res2 = await axios.get("/people")
    expect(res2.data.length - res.data.length).toBe(NUM_PEOPLE)
    done()
  })

  test("Get people", async () => {
    const res = await axios.get("/people").catch(err => {
      console.error(err)
      return { data: null }
    })
    const dict = _.keyBy(res.data, "id")
    for (const p of res.data as Person[]) {
      expect(p).toEqual(dict[p.id])
    }
  })

  test("Get person in room", async () => {
    const allPeople: { [uid: string]: Person } = _.keyBy(
      (await axios.get("/people")).data,
      "id"
    )

    const { data: rooms } = await axios.get("/maps")
    for (const rid of rooms as Room[]) {
      const peopleInRoom: Person[] = (
        await axios.get("/maps/" + rid + "/people")
      ).data
      for (const p of peopleInRoom) {
        expect(p).toEqual(allPeople[p.id])
      }
    }
  })
})
