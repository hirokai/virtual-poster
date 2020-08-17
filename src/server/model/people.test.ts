import { PeopleModel } from "./people"
import { Person } from "@/../@types/types"
const pm = new PeopleModel("postgres://postgres@localhost/virtual_poster_test")
import _ from "lodash"
import { dbWith, resetDb } from "."
import { random_str } from "../test_util"

beforeAll(async () => {
  const db = dbWith("postgres://postgres@localhost/virtual_poster_test")
  await db.query(resetDb)
  await pm.init()
})

describe("Add person", () => {
  const NUM_PEOPLE = 100
  let people2: Person[]
  test("Add many", async () => {
    const people = await pm.getAllPeopleList(null)
    for (const i of _.range(NUM_PEOPLE)) {
      const name = "Test user " + i
      const email = "hoge" + i + "@gmail.com"
      const { error } = await pm.create(
        email,
        name,
        "user",
        "001",
        [],
        "reject"
      )
      expect(error).toBeUndefined()
    }
    people2 = await pm.getAllPeopleList(null)
    expect(people2.length - people.length).toBe(NUM_PEOPLE)
  })
  test("Re-init", async () => {
    await pm.init()
    const people3 = await pm.getAllPeopleList(null)
    expect(people3.length).toBe(NUM_PEOPLE)
    expect(people2).toEqual(people3)
  })
})

test("Update a person", async () => {
  const people = await pm.getAllPeopleList(null)
  const p = people[Math.floor(Math.random() * people.length)]
  const new_name = "Name_" + random_str(10)
  await pm.set(p.id, { name: new_name })
  const p2 = await pm.get(p.id)
  expect(p2?.name).toBe(new_name)

  await pm.set(p.id, { avatar: "006" })
  const p3 = await pm.get(p.id)
  expect(p3?.avatar).toBe("006")

  const new_email = "hoge" + Math.floor(Math.random() * 100000) + "@gmail.com"
  await pm.set(p.id, { email: new_email })
  const p4 = await pm.get(p.id)
  expect(p4?.email).toBe(new_email)
})
