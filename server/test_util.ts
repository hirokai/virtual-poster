import * as model from "./model"
import { RoomId, UserId, Point, PosDir } from "@/@types/types"
import { inRange } from "../common/util"
import _ from "lodash"

export const random_str = (N?: number): string => {
  const MAX_LENGTH = 100
  const MIN_LENGTH = 0
  N = N ? N : MIN_LENGTH + Math.floor(Math.random() * (MAX_LENGTH - MIN_LENGTH))
  const S = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return Array.from(Array(N))
    .map(() => S[Math.floor(Math.random() * S.length)])
    .join("")
}

export const createUser = async (
  room_id: RoomId
): Promise<{
  id: UserId
  last_updated: number
  name: string
  email?: string
  rooms?: { room_id: RoomId; pos?: PosDir }[]
}> => {
  const name = "Test user " + random_str(5)
  const email = "hoge" + random_str(5) + "@gmail.com"
  const { user } = await model.people.create(
    email,
    name,
    "user",
    "001",
    [room_id],
    "reject"
  )
  if (!user) {
    throw "No user was created"
  }
  return await model.people.getUnwrap(user.id)
}

export function mkMapData(rows: number, cols: number): string {
  return _.map(_.range(rows), () => {
    return _.map(_.range(cols), () => {
      return "."
    }).join("")
  }).join("\n")
}

export function mkWrongMapData(rows: number, cols: number): string {
  return _.map(_.range(rows), () => {
    return _.map(_.range(cols), () => {
      return "4"
    }).join("")
  }).join("\n")
}

export const rand_adjacent = (p: Point, cols: number, rows: number): Point => {
  const dx = Math.random() > 0.66667 ? 1 : Math.random() > 0.5 ? 0 : -1
  const dy = Math.random() > 0.66667 ? 1 : Math.random() > 0.5 ? 0 : -1
  const x = inRange(p.x + dx, 0, cols - 1)
  const y = inRange(p.y + dy, 0, rows - 1)
  return { x, y }
}

export const rand_non_adjacent = (
  p: Point,
  rows: number,
  cols: number
): Point => {
  let x = 0,
    y = 0
  for (;;) {
    x = Math.floor(Math.random() * cols)
    y = Math.floor(Math.random() * rows)
    if (Math.abs(x - p.x) > 1 && Math.abs(y - p.y) > 1) {
      return { x, y }
    }
  }
}
