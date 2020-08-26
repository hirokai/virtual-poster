import _ from "lodash"
import shortid from "shortid"

import { Poster, RoomId, UserId, PosterId } from "@/../@types/types"
import { log, db } from "./index"

export async function get(poster_id: string): Promise<Poster | null> {
  log.debug(poster_id)
  const rows = await db.query(
    `SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image from poster as p join map_cell as c on p.location=c.id where p.id=$1;`,
    [poster_id]
  )
  const d = rows[0]
  return d as Poster
}

export async function set(poster: Poster): Promise<boolean> {
  await db.query(
    `UPDATE poster set location=$1,title=$2,author=$3,last_updated=$4 where id=$5;`,
    [
      poster.location,
      poster.title,
      poster.author,
      poster.last_updated,
      poster.id,
    ]
  )
  return true
}

export async function deletePoster(poster_id: string): Promise<boolean> {
  await db.query(`DELETE from poster where id=$1;`, [poster_id])
  return true
}

export async function getOfUser(
  room_id: RoomId,
  user_id: UserId
): Promise<Poster | null> {
  const posters = await getAll(room_id)
  return _.find(posters, p => p.author == user_id) || null
}

export async function getAllOfUser(user_id: UserId): Promise<Poster[] | null> {
  const posters = await getAll(null)
  return _.filter(posters, p => p.author == user_id) || null
}

export async function getAll(room_id: RoomId | null): Promise<Poster[]> {
  const rows = await (room_id
    ? db.query(
        `SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image from poster as p join map_cell as c on p.location=c.id where location in (SELECT id from map_cell where room=$1);`,
        [room_id]
      )
    : db.query(
        `SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image from poster as p join map_cell as c on p.location=c.id;`
      ))
  return rows.map(d => {
    // d["room"] = room_id
    return d
  })
}

export function genPosterId(): PosterId {
  return "P" + shortid.generate()
}
