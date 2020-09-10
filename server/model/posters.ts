import _ from "lodash"
import shortid from "shortid"
import { Poster, RoomId, UserId, PosterId } from "@/@types/types"
import { log, db } from "./index"
import { config } from "../config"

const CDN_DOMAIN = config.aws.cloud_front.domain
const S3_BUCKET = config.aws.s3.bucket

export async function get(poster_id: string): Promise<Poster | null> {
  log.debug(poster_id)
  const rows = await db.query(
    `SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image from poster as p join map_cell as c on p.location=c.id where p.id=$1;`,
    [poster_id]
  )
  const d = rows[0]
  d.last_updated = parseInt(d.last_updated)
  const poster_file_domain = S3_BUCKET
    ? "https://" + CDN_DOMAIN
    : "https://" + (S3_BUCKET as string) + ".s3.amazonaws.com"
  d["file_url"] = poster_file_domain + "/files/" + d["id"] + ".png"
  return d as Poster
}

export async function getByNumber(
  room_id: RoomId,
  num: number
): Promise<Poster | null> {
  const rows = await db.query(
    `
      SELECT id FROM poster
      WHERE location in
        (SELECT id FROM map_cell
          WHERE room=$1 AND poster_number=$2);
        `,
    [room_id, num]
  )
  return rows.length > 0 ? await get(rows[0].id) : null
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
  const poster_file_domain = S3_BUCKET
    ? "https://" + CDN_DOMAIN
    : "https://" + (S3_BUCKET as string) + ".s3.amazonaws.com"
  return rows.map(d => {
    // d["room"] = room_id
    d["file_url"] = poster_file_domain + "/files/" + d["id"] + ".png"
    return d
  })
}

export function genPosterId(): PosterId {
  for (;;) {
    const s = "P" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
}
