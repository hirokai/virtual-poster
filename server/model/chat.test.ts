import { initData, dbWith, resetDb } from "."
import * as model from "."
import _, { omit } from "lodash"
import { Point, UserId } from "@/@types/types"
import { inRange } from "../../common/util"
import {
  random_str,
  createUser,
  mkMapData,
  rand_non_adjacent,
} from "../test_util"

beforeEach(async () => {
  const db = dbWith("postgres://postgres@localhost/virtual_poster_test")
  await db.query(resetDb)
  await initData("postgres://postgres@localhost/virtual_poster_test", false)
})

describe("Chat group", () => {
  const cols = 40
  const rows = 30
  test("Make a group", async () => {
    const map_data = mkMapData(rows, cols)
    const { map: mm } = await model.MapModel.mkNewRoom("Room 1", map_data)
    expect(mm).toBeDefined()
    if (!mm) {
      throw "MapModel failed to init"
    }
    const users: UserId[] = []
    for (let i = 0; i < 20; i++) {
      const p = await createUser(mm.room_id)
      await model.people.setPos(p.id, mm.room_id, { x: i, y: i }, "down")
      users.push(p.id)
    }
    const { ok, group, error } = await model.chat.startChat(
      mm.room_id,
      users[0],
      [users[1], users[2]]
    )
    expect(error).toBeUndefined()
    expect(ok).toBe(true)
    expect(group).toBeDefined()
  })

  test("Cannot make a group with a remote person", async () => {
    const map_data = mkMapData(rows, cols)
    const { map: mm } = await model.MapModel.mkNewRoom("Room 1", map_data)
    expect(mm).toBeDefined()
    if (!mm) {
      throw "MapModel failed to init"
    }
    const pos1 = { x: 3, y: 3 }
    const users: UserId[] = []
    let p = await createUser(mm.room_id)
    const pos2 = rand_non_adjacent(pos1, rows, cols)
    await model.people.setPos(p.id, mm.room_id, pos2, "down")
    users.push(p.id)
    p = await createUser(mm.room_id)
    await model.people.setPos(p.id, mm.room_id, pos1, "down")
    users.push(p.id)

    const { ok, group, error } = await model.chat.startChat(
      mm.room_id,
      users[0],
      [users[1]]
    )
    expect(error).toBeDefined()
    expect(ok).toBe(false)
    expect(group).toBeUndefined()
  })
})
