import _ from "lodash"
import shortid from "shortid"
import { Poster, RoomId, UserId, PosterId } from "@/@types/types"
import { log, db, people, redis } from "./index"
import { config } from "../config"
import { isAdjacent } from "../../common/util"

const CDN_DOMAIN = config.aws.cloud_front.domain
const S3_BUCKET = config.aws.s3.bucket

export async function get(poster_id: string): Promise<Poster | null> {
  log.debug(poster_id)
  const rows = await db.query(
    `SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image from poster as p join map_cell as c on p.location=c.id where p.id=$1;`,
    [poster_id]
  )
  const d = rows[0]
  if (!d) {
    return null
  }
  d.last_updated = parseInt(d.last_updated)
  const poster_file_domain = S3_BUCKET
    ? "https://" + CDN_DOMAIN
    : "https://" + (S3_BUCKET as string) + ".s3.amazonaws.com"
  const file_url = poster_file_domain + "/files/" + d["id"] + ".png"
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    room: d.room,
    x: d.x,
    y: d.y,
    last_updated: d.last_updated,
    location: d.location,
    file_url,
    access_log: d.access_log,
    author_online_only: d.author_online_only,
    poster_number: d.poster_number,
  }
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
    `UPDATE poster set location=$1,title=$2,author=$3,last_updated=$4,access_log=$5,author_online_only=$6 where id=$7;`,
    [
      poster.location,
      poster.title,
      poster.author,
      poster.last_updated,
      poster.access_log,
      poster.author_online_only,
      poster.id,
    ]
  )
  return true
}

export async function deletePoster(poster_id: string): Promise<boolean> {
  await db.query(`DELETE from poster where id=$1;`, [poster_id])
  return true
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
    const file_url = poster_file_domain + "/files/" + d["id"] + ".png"
    return {
      id: d.id,
      title: d.title,
      author: d.author,
      room: d.room,
      x: d.x,
      y: d.y,
      last_updated: d.last_updated,
      location: d.location,
      file_url,
      access_log: d.access_log,
      author_online_only: d.author_online_only,
      poster_number: d.poster_number,
    }
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

export async function startViewing(
  user_id: UserId,
  room_id: RoomId,
  poster_id: PosterId
): Promise<{
  ok: boolean
  joined_time?: number
  error?: string
  image_allowed?: boolean
}> {
  const person_pos = await people.getPos(user_id, room_id)
  const poster = await get(poster_id)
  if (!person_pos || !poster || poster.room != room_id) {
    return { ok: false, error: "Person position or poster not found" }
  }
  if (!isAdjacent(person_pos, poster)) {
    return { ok: false, error: "Poster is not ajacent to user" }
  }
  let image_allowed = true
  if (poster.author_online_only) {
    const author_connected = await redis.accounts.sismember(
      "connected_users:room:" + poster.room + ":__all__",
      poster.author
    )
    if (!author_connected) {
      // return {
      //   ok: false,
      //   error:
      //     "This poster is an online-only poster. Author of the poster is offline.",
      // }
      image_allowed = false
    }
  }
  const joined_time = Date.now()
  try {
    //More than one poster and person in the same room IS DISALLOWED.
    const rows = await db.query(
      `UPDATE poster_viewer SET left_time=$3
        WHERE person=$1
          AND left_time IS NULL
          AND poster IN (
            SELECT id FROM poster
              WHERE location IN
                (SELECT id FROM map_cell WHERE room=$2))`,
      [user_id, room_id, joined_time]
    )
    if (rows.length > 0) {
      return { ok: false, error: "Only one poster can be viewed at one time" }
    }
    await db.query(
      `INSERT INTO poster_viewer (person,poster,joined_time,last_active,access_log) VALUES ($1,$2,$3,$4,$5);`,
      [user_id, poster.id, joined_time, joined_time, poster.access_log]
    )
    return { ok: true, joined_time, image_allowed }
  } catch (e) {
    console.log(e)
    return { ok: false, error: "DB error" }
  }
}

export async function endViewing(
  user_id: UserId,
  room_id: RoomId,
  poster_id: PosterId
): Promise<{ ok: boolean; left_time?: number; error?: string }> {
  const person_pos = await people.getPos(user_id, room_id)
  const poster = await get(poster_id)
  if (!person_pos || !poster || poster.room != room_id) {
    return { ok: false, error: "Person position or poster not found" }
  }
  if (!isAdjacent(person_pos, poster)) {
    return { ok: false, error: "Poster is not ajacent to user" }
  }
  const left_time = Date.now()
  try {
    await db.query(
      `UPDATE poster_viewer SET left_time=$3 WHERE person=$1 AND poster=$2;`,
      [user_id, poster_id, left_time]
    )
    return { ok: true, left_time }
  } catch (e) {
    console.log(e)
    return { ok: false, error: "DB error" }
  }
}

export async function isViewing(
  user_id: UserId,
  poster_id: PosterId
): Promise<{ viewing?: boolean; error?: string }> {
  console.log("isViewing()", user_id, poster_id)
  const poster = await get(poster_id)
  if (!poster) {
    return { error: "Poster not found" }
  }
  try {
    const rows = await db.query(
      `SELECT 1 FROM poster_viewer WHERE person=$1 AND poster=$2 AND left_time IS NULL;`,
      [user_id, poster_id]
    )
    return { viewing: rows.length == 1 }
  } catch (e) {
    console.log(e)
    return { error: "DB error" }
  }
}

export async function getViewHistory(
  room_id: RoomId,
  poster_id: PosterId
): Promise<{
  posters?: {
    user_id: string
    joined_time: number
    left_time?: number
    last_active?: number
  }[]
  error?: string
}> {
  const poster = await get(poster_id)
  if (!poster) {
    return { error: "Poster not found" }
  }
  if (poster.room != room_id) {
    return { error: "Poster not found" }
  }
  const hs = await db.query(
    `SELECT * FROM poster_viewer WHERE poster=$1 AND access_log=$2 ORDER BY last_active DESC`,
    [poster.id, true]
  )
  return {
    posters: hs.map(h => {
      return {
        user_id: h.person,
        poster_id: h.poster,
        joined_time: h.joined_time ? +h.joined_time : undefined,
        left_time: h.left_time ? +h.left_time : undefined,
        last_active: h.last_active ? +h.last_active : undefined,
      }
    }),
  }
}
