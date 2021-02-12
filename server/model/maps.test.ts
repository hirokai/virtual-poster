import { initMapModel, dbWith, resetDb } from "."
import * as model from "."
import { mkMapData, mkWrongMapData } from "../test_util"
import _ from "lodash"
import {
  random_str,
  createUser,
  rand_adjacent,
  rand_non_adjacent,
} from "../test_util"

beforeEach(async () => {
  const db = dbWith("postgres://postgres@localhost/virtual_poster_test")
  await db.query(resetDb)
  await initMapModel("postgres://postgres@localhost/virtual_poster_test")
})

describe("Add a map and person", () => {
  const cols = 5
  const rows = 4
  test("Add a map", async done => {
    const map_data = mkMapData(rows, cols)
    const { map: mm } = await model.MapModel.mkNewRoom(
      "Room 1",
      map_data,
      false,
      "all_initial"
    )
    expect(mm).toBeDefined()
    const { cells, numRows, numCols } = await mm!.getStaticMap()
    expect(_.flatten(cells).length).toEqual(cols * rows)
    expect(cells.length).toEqual(rows)
    expect(cells[0].length).toEqual(cols)
    expect({ cols: numCols, rows: numRows }).toEqual({ cols, rows })

    done()
  })
  test("Error on adding a wrong map", async done => {
    for (let i = 0; i < 100; i++) {
      const map_data = mkWrongMapData(rows, cols)
      const { map: mm } = await model.MapModel.mkNewRoom(
        "Room " + random_str(3),
        map_data,
        false,
        "all_initial"
      )
      expect(mm).toBeUndefined()
    }
    done()
  })
  test("Add people to a map, then delete a map", async done => {
    const map_data = mkMapData(rows, cols)
    const { map: mm } = await model.MapModel.mkNewRoom(
      "Room 2",
      map_data,
      false,
      "all_initial"
    )
    if (!mm) {
      throw "Initialization failed"
    }
    for (let i = 0; i < cols * rows; i++) {
      const p = await createUser(mm.room_id)
      expect(p).toBeDefined()
    }
    const ps = await model.people.getPeopleInRoom(mm.room_id, false, false)
    expect(ps).toHaveLength(cols * rows)

    // Now the room is full, BUT you can still create another person with the room access.
    const i = cols * rows
    const name = "Test user " + i
    const email = "hoge" + i + "@gmail.com"
    const { ok, user, error } = await model.people.create(
      email,
      name,
      "user",
      "001",
      [{ id: mm.room_id, groups: [] }],
      "reject"
    )
    expect(user).toBeDefined()
    expect(ok).toBeTruthy()
    expect(error).toBeUndefined()

    const r = await mm.deleteRoomFromDB()
    expect(r).toBe(true)
    done()
  })
})

describe("Enter a room", () => {
  test("Entering a room sets a position", async () => {
    const cols = 10
    const rows = 10
    const map_data = mkMapData(rows, cols)
    const { map: mm } = await model.MapModel.mkNewRoom(
      "Room " + random_str(5),
      map_data,
      false,
      "all_initial"
    )
    if (!mm) {
      throw "Initialization failed"
    }
    const p = await createUser(mm.room_id)
    const { ok: ok1 } = await mm.enterRoom(p.id)
    expect(ok1).toBe(true)
    const pos = await model.people.getPos(p.id, mm.room_id)
    expect(pos).toBeDefined()
  })
})

describe("Move a person", () => {
  test("Can move to adjacent points", async () => {
    const cols = 10
    const rows = 10
    const map_data = mkMapData(rows, cols)
    const { map: mm } = await model.MapModel.mkNewRoom(
      "Room " + random_str(5),
      map_data,
      false,
      "all_initial"
    )
    const person = await createUser(mm!.room_id)
    const { ok: ok1 } = await mm!.enterRoom(person.id)
    expect(ok1).toBe(true)

    //FIXME: This should be unnecessary
    await model.people.setPos(
      person.id,
      mm!.room_id,
      { x: 5, y: 5 },
      "up",
      true
    )

    for (let i = 0; i < 100; i++) {
      const posd = await model.people.getPos(person.id, mm!.room_id)
      expect(posd).toBeTruthy()
      let pos = { x: posd!.x, y: posd!.y }

      const p2 = rand_adjacent(pos!, cols, rows)
      const { results, error } = await mm!.tryToMove(pos!, {
        x: p2.x,
        y: p2.y,
        user: person.id,
      })
      expect(error).toBeUndefined()
      expect(results![0].position).toEqual({ x: p2.x, y: p2.y })
      pos = results![0].position!
    }
  })

  test("Cannot move to a remote point", async () => {
    const cols = 10
    const rows = 10
    const map_data = mkMapData(rows, cols)
    const { map: mm } = await model.MapModel.mkNewRoom(
      "Room " + random_str(5),
      map_data,
      false,
      "all_initial"
    )
    const person = await createUser(mm!.room_id)
    const { ok: ok1 } = await mm!.enterRoom(person.id)
    expect(ok1).toBe(true)
    await model.people.setPos(
      person.id,
      mm!.room_id,
      { x: 5, y: 5 },
      "up",
      true
    )

    for (let i = 0; i < 100; i++) {
      const posd = await model.people.getPos(person.id, mm!.room_id)
      expect(posd).toBeTruthy()
      const pos = { x: posd!.x, y: posd!.y }

      const p2 = rand_non_adjacent(pos!, rows, cols)
      const { results, error } = await mm!.tryToMove(pos!, {
        x: p2.x,
        y: p2.y,
        user: person.id,
      })
      expect(error).toBeDefined()
      expect(results).toBeUndefined()
    }
  })
})

test("Cannot move during a chat", async () => {
  const rows = 10
  const cols = 10
  const map_data = mkMapData(rows, cols)
  const { map: mm } = await model.MapModel.mkNewRoom(
    "Room 1",
    map_data,
    false,
    "all_initial"
  )
  expect(mm).toBeDefined()
  if (!mm) {
    throw "MapModel failed to init"
  }
  const pos1 = { x: 3, y: 3 }
  const p = await createUser(mm.room_id)
  const pos2 = rand_adjacent(pos1, rows, cols)
  await model.people.setPos(p.id, mm.room_id, pos2, "down")
  const p2 = await createUser(mm.room_id)
  await model.people.setPos(p2.id, mm.room_id, pos1, "down")

  const { error } = await model.chat.startChat(mm.room_id, p.id, [p2.id])
  expect(error).toBeUndefined()
  const pos3 = rand_adjacent(pos2, rows, cols)
  const { error: error2 } = await mm.tryToMove(pos2, {
    ...pos3,
    user: p.id,
  })
  expect(error2).toEqual("Cannot move during chat")
})

describe("Posters", () => {
  test("Assign a poster", async () => {
    const map_data = "....\n....\n..P."
    const { map: mm } = await model.MapModel.mkNewRoom(
      "Room " + random_str(3),
      map_data,
      false,
      "all_initial"
    )
    if (!mm) {
      throw "Undefined MapModel"
    }
    console.log(JSON.stringify((await mm.getStaticMap()).cells))
    const p = await createUser(mm.room_id)
    const { ok, poster, error } = await mm.assignPosterLocation(
      "1",
      p.id,
      false
    )
    expect(ok).toBeTruthy()
    expect(poster).toBeDefined()
    expect(error).toBeUndefined()
  })
})
