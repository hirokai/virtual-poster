import _ from "lodash"
import shortid from "shortid"
import jsSHA from "jssha"
import * as admin from "firebase-admin"
import pg from "pg-promise"
import crypto from "crypto"
import perf_hooks from "perf_hooks"
const performance = perf_hooks.performance

import {
  Person,
  PersonInMap,
  PersonRDB,
  PersonWithEmail,
  Direction,
  Point,
  UserId,
  PersonStat,
  RoomId,
  PosterId,
  PosDir,
  TryToMoveResult,
  ChatGroup,
  NotificationEntry,
  PosterCommentNotification,
} from "../../@types/types"
import { redis, log, db, pgp, maps, chat } from "./index"

import { config } from "../config"
import { calcDirection, isAdjacent, removeUndefined } from "../../common/util"
import { ChatGroupId } from "@/api/@types"
import { genChatEventId } from "./chat"
const DEBUG_TOKEN = config.debug_token

const get_pos_pg = new pg.PreparedStatement({
  name: "get_pos",
  text: `SELECT * from person_position WHERE room=$1 AND person=$2`,
})

async function setRedisEmailAndId(
  email: string,
  user_id: UserId,
  admin?: boolean
): Promise<void> {
  await redis.accounts.set("email:" + email, user_id)
  await redis.accounts.set("uid:" + user_id, email)
  if (admin) {
    await redis.accounts.set("email:" + email + ":admin", user_id)
    await redis.accounts.set("uid:" + user_id + ":admin", email)
  }
}

export async function writePeopleCache(): Promise<void> {
  try {
    const people: (PersonRDB & {
      token: string
      expire_at: string
    })[] = await db.query(
      `SELECT * from person left join token on person.id=token.person;`
    )
    for (const p of people) {
      const { email, id } = p
      if (email) {
        await setRedisEmailAndId(email, id, p.role == "admin")
      }
      if (p.token && p.expire_at) {
        const shaObj = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" })
        shaObj.update(p.token)
        const hash = shaObj.getHash("HEX")
        const milliseconds = parseInt(p.expire_at) - Date.now()
        if (milliseconds > 0) {
          await redis.accounts.psetex("token:" + email, milliseconds, p.token)
          await redis.accounts.psetex("hash:" + hash, milliseconds, p.id)
        }
      }
    }
    log.info(`Redis cache of people was prepared.`)
  } catch (err) {
    log.error(err)
  }
}

// Stats fields may be updated frequently during development,
// so the data from DB is normalized upon loading.
function _normalizeStats(obj: Record<string, any>): PersonStat {
  const res: PersonStat = {
    walking_steps: obj?.walking_steps || 0,
    chat_char_count: obj?.chat_char_count || 0,
    chat_count: obj?.chat_count || 0,
    people_encountered:
      typeof obj?.people_encountered == "object" ? obj?.people_encountered : [],
  }
  return res
}

function genUserId(): string {
  for (;;) {
    const s = "U" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
}

export async function getUserIdFromEmail(
  email: string
): Promise<string | null> {
  return await redis.accounts.get("email:" + email)
}

const allowed_profile_keys = [
  "url",
  "url2",
  "url3",
  "display_name_full",
  "display_name_short",
]

export async function get(
  user_id: UserId,
  room_id?: RoomId,
  with_email = false,
  with_room_access = false
): Promise<(Person & { rooms?: { room_id: RoomId; pos?: PosDir }[] }) | null> {
  const rows = with_room_access
    ? await db.query(
        `
        SELECT
            person.*,
            array_agg(ra.room) AS rooms
        FROM
            person
            LEFT JOIN person_room_access AS ra ON person.email = ra.email
            LEFT JOIN public_key AS k ON person.id = k.person
        WHERE
            person.id = $1
        GROUP BY
            person.id;
    `,
        [user_id]
      )
    : await db.query(
        `
        SELECT
            *
        FROM
            person
            LEFT JOIN public_key AS k ON person.id = k.person
        WHERE
            id = $1;`,
        [user_id]
      )
  const profile_rows = await db.query(
    `
    SELECT
        *
    FROM
        person_profile
    WHERE
        person = $1
    `,
    [user_id]
  )
  const profile_rows_room = room_id
    ? await db.query(
        `
    SELECT
        *
    FROM
        person_profile
    WHERE
        person = $1
        AND room = $2
    `,
        [user_id, room_id]
      )
    : []

  const profiles: {
    [key: string]: {
      last_updated: number
      content: string
      metadata?: any
    }
  } = {}

  for (const k of config.profile_keys) {
    profiles[k] = {
      last_updated: -1,
      content: "",
    }
  }

  log.debug(profile_rows.concat(profile_rows_room))

  for (const p of profile_rows.concat(profile_rows_room)) {
    if (config.profile_keys.indexOf(p.key) >= 0) {
      profiles[p.key] = removeUndefined({
        last_updated: +p.last_updated,
        content: p.content,
        metadata: p.metadata || undefined,
      })
    }
  }

  const p: (Person & { rooms?: { room_id: RoomId; pos?: PosDir }[] }) | null =
    rows.length == 0
      ? null
      : {
          id: rows[0].id,
          last_updated: parseInt(rows[0].last_updated),
          public_key: rows[0].public_key || undefined,
          // room: rows[0].room,
          name: rows[0].name,
          avatar: rows[0].avatar,
          rooms:
            rows[0].rooms?.map((room_id: string) => {
              return { room_id }
            }) || [],
          email: with_email
            ? (await redis.accounts.get("uid:" + user_id)) || undefined
            : undefined,
          stats: {
            walking_steps: 0,
            people_encountered: [],
            chat_count: 0,
            chat_char_count: 0,
          },
          profiles,
        }
  return p
}

export async function getUnwrap(
  user_id: string,
  with_email = false,
  with_room_access = false
): Promise<{
  id: UserId
  last_updated: number
  name: string
  email?: string
  rooms?: { room_id: RoomId; pos?: PosDir }[]
}> {
  const p = await get(user_id, undefined, with_email, with_room_access)
  if (p) {
    return p
  } else {
    throw "Tried to unwrap undefined Person"
  }
}

export async function getUserType(
  user_id: UserId
): Promise<"admin" | "user" | null> {
  const count = await redis.accounts.exists(
    "uid:" + user_id,
    "uid:" + user_id + ":admin"
  )
  return count == 2 ? "admin" : count == 1 ? "user" : null
}

export async function isAdmin(token: string): Promise<boolean> {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token)
    const email = decodedToken.email
    if (email) {
      const user_id = await getUserIdFromEmail(email)
      if (user_id) {
        const typ = await getUserType(user_id)
        return typ == "admin"
      }
    }
    return false
  } catch (err) {
    log.error(err, token)
    return false
  }
}
export async function create(
  email: string,
  name: string,
  typ: "admin" | "user",
  avatar: string,
  allowed_rooms: RoomId[],
  merge_strategy: "reject" | "replace" | "append" = "append"
): Promise<{
  ok: boolean
  user?: {
    id: UserId
    last_updated: number
    name: string
    email?: string
    rooms?: { room_id: RoomId; pos?: PosDir }[]
  }
  error?: string
}> {
  if ((email == "" || name == "") && merge_strategy == "reject") {
    return { ok: false, error: "Name and/or email is missing" }
  }
  const count_email = (
    await db.query(`SELECT count(*) from person where email=$1;`, [email])
  )[0].count
  if (count_email > 0 && merge_strategy == "reject") {
    log.warn("Email name already exists")
    return { ok: false, error: "Email already exists: " + email }
  }
  const count_name = (
    await db.query(`SELECT count(*) from person where name=$1;`, [name])
  )[0].count
  if (count_name > 0 && merge_strategy == "reject") {
    log.warn("User name already exists")
    return { ok: false, error: "User name already exists: " + name }
  }
  const uid = genUserId()
  try {
    if (merge_strategy == "reject") {
      const r = await db.query(`SELECT 1 FROM person WHERE email=$1;`, [email])
      if (r.length > 0) {
        return { ok: false, error: "Email already exists" }
      }
      await db.query(
        `INSERT INTO person (id,email,name,last_updated,avatar,role) values ($1,$2,$3,$4,$5,$6);`,
        [uid, email, name, Date.now(), avatar, typ]
      )
    } else if (merge_strategy == "replace") {
      await db.query(
        `INSERT INTO person (id,email,name,last_updated,avatar,role) values ($1,$2,$3,$4,$5,$6) ON CONFLICT ON CONSTRAINT person_email_key DO UPDATE SET name=$3,last_updated=$4,avatar=$5,role=$6;`,
        [uid, email, name, Date.now(), avatar, typ]
      )
    } else if (merge_strategy == "append") {
      await db.query(
        `INSERT INTO person (id,email,name,last_updated,avatar,role) values ($1,$2,$3,$4,$5,$6) ON CONFLICT ON CONSTRAINT person_email_key DO NOTHING;`,
        [uid, email, name, Date.now(), avatar, typ]
      )
    }
    const uid_actual: string = (
      await db.query(`SELECT id FROM person WHERE email=$1`, [email])
    )[0].id
    await setRedisEmailAndId(email, uid_actual, typ == "admin")
    if (merge_strategy == "replace") {
      await db.query(`DELETE FROM person_room_access WHERE email=$1;`, [email])
    }
    const rooms: { room_id: string; pos?: PosDir }[] = []
    for (const room of allowed_rooms) {
      if (!maps[room]) {
        log.warn("Room does not exist", room)
        continue
      }
      await db.query(
        `INSERT INTO person_room_access (room,email,"role") values ($1,$2,$3) ON CONFLICT ON CONSTRAINT person_room_access_pkey DO NOTHING;`,
        [room, email, typ]
      )
      const pos = await maps[room].assignRandomOpenPos(uid_actual)
      rooms.push({ room_id: room, pos: pos || undefined })
      if (!pos) {
        log.warn("No open space or map uninitialized")
      }
    }
    const user = await getUnwrap(uid_actual)
    user.rooms = rooms
    return { ok: true, user }
  } catch (err) {
    log.error(err)
    return { ok: false }
  }
}
export async function getAllPeopleList(
  room_id: RoomId | null,
  with_email = false,
  with_room_access = false
): Promise<(PersonInMap & { email?: string })[]> {
  let rows
  let rows2: { person: UserId; poster: PosterId }[]
  if (room_id) {
    rows = await db.query(
      ` SELECT
            person.*,
            pos.x,
            pos.y,
            pos.direction,
            k.*
        FROM
            person
            LEFT JOIN person_position AS pos ON person.id = pos.person
            LEFT JOIN public_key AS k ON person.id = k.person
        WHERE
            pos.room = $1
        GROUP BY
            person.id,
            pos.x,
            pos.y,
            pos.direction,
            k.person;`,
      [room_id]
    )
    rows2 = await db.query(
      ` SELECT
            *
        FROM
            poster_viewer
        WHERE
            poster IN (
                SELECT
                    id
                FROM
                    poster
                WHERE
                    location IN (
                        SELECT
                            id
                        FROM
                            map_cell
                        WHERE
                            room = $1
                    )
            )
            AND left_time IS NULL;`,
      [room_id]
    )
    //
  } else {
    rows = await (with_room_access
      ? db.query(
          ` SELECT
                person.*,
                array_agg(ra.room) AS rooms,
                k.public_key
            FROM
                person
                LEFT JOIN person_room_access AS ra ON person.email = ra.email
                LEFT JOIN public_key AS k ON person.id = k.person
            GROUP BY
                person.id,
                k.public_key;`
        )
      : db.query("select * from person;"))
    rows2 = []
  }
  const connected_users = room_id
    ? new Set(
        await redis.accounts.smembers(
          "connected_users:room:" + room_id + ":__all__"
        )
      )
    : new Set<string>()

  const count_all_sockets_for_users = await redis.sockets.hgetall(
    "room:" + "__any__"
  )

  const poster_viewers = _.groupBy(rows2, "person")

  // log.debug(count_all_sockets_for_users)
  return rows.map(row => {
    const uid = row["id"] as UserId
    const poster_viewing = poster_viewers[uid]
      ? poster_viewers[uid][0]?.poster
      : undefined
    const r: PersonInMap & {
      email?: string
      rooms?: RoomId[]
      poster_viewing?: PosterId
    } = {
      name: row["name"],
      rooms: row["rooms"] || [],
      stats: {
        walking_steps: 0,
        people_encountered: [],
        chat_count: 0,
        chat_char_count: 0,
      },
      profiles: {},
      public_key: row["public_key"],
      id: uid,
      last_updated: parseInt(row["last_updated"]),
      connected: room_id
        ? connected_users.has(uid)
        : count_all_sockets_for_users[uid] &&
          parseInt(count_all_sockets_for_users[uid]) > 0
        ? true
        : false,
      room: room_id || "N/A",
      avatar: row["avatar"],
      x: row["x"],
      y: row["y"],
      direction: row["direction"],
      moving: false,
    }
    if (poster_viewing) {
      r.poster_viewing = poster_viewing
    }
    if (with_email) {
      r.email = row["email"]
    }
    return r
  })
}

export async function getAdmin(): Promise<UserId[] | null> {
  const admins = await redis.accounts.keys("uid:*:admin")
  return admins.length == 0 ? null : admins
}

export async function getPos(
  user_id: UserId,
  room_id: RoomId,
  use_redis = true
): Promise<PosDir | null> {
  if (use_redis) {
    const k = "pos:" + room_id + ":" + user_id
    const s = await redis.accounts.get(k)
    if (!s) {
      console.log("Position not found", k)
      return null
    }
    // log.debug("Get raw data", s)
    const [x, y, direction] = s.split(".")
    return {
      x: parseInt(x),
      y: parseInt(y),
      direction: direction as Direction,
    }
  } else {
    get_pos_pg.values = [room_id, user_id]
    const row = await db.oneOrNone(get_pos_pg)
    return row ? { x: row.x, y: row.y, direction: row.direction } : null
  }
}
export async function setPos(
  user_id: UserId,
  room_id: RoomId,
  pos: Point,
  direction: Direction,
  createIfNotExist = false
): Promise<boolean> {
  await redis.accounts.set(
    "pos:" + room_id + ":" + user_id,
    "" + pos.x + "." + pos.y + "." + direction
  )
  // console.log("setPos done on Redis", user_id, room_id, pos, r)

  try {
    if (createIfNotExist) {
      await db.query(
        `INSERT INTO person_position (person,room,last_updated,x,y,direction) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ON CONSTRAINT person_position_pkey DO UPDATE SET last_updated=$3,x=$4,y=$5,direction=$6;`,
        [user_id, room_id, Date.now(), pos.x, pos.y, direction]
      )
    } else {
      await db.query(
        `UPDATE person_position SET last_updated=$3,x=$4,y=$5,direction=$6 WHERE person=$1 and room=$2;`,
        [user_id, room_id, Date.now(), pos.x, pos.y, direction]
      )
      // log.debug("setPos done on RDB", user_id, room_id, pos, r)
    }
    return true
  } catch (err) {
    if (
      err.message.indexOf(
        'duplicate key value violates unique constraint "person_position_room_x_y_key"'
      ) != -1
    ) {
      log.warn("Person conflict on DB")
    } else {
      log.error(err)
    }
    const rows = await db.query(
      `SELECT x,y,direction FROM person_position WHERE room=$1 AND person=$2`,
      [room_id, user_id]
    )
    const old_pos = {
      x: rows[0].x,
      y: rows[0].y,
      direction: rows[0].direction,
    }
    const r = await redis.accounts.set(
      "pos:" + room_id + ":" + user_id,
      "" + old_pos.x + "." + old_pos.y + "." + old_pos.direction
    )
    log.debug(
      "setPos reverted on Redis. Old pos is",
      user_id,
      room_id,
      old_pos,
      r
    )
    return false
  }
}

// user_id_2 must be inactive person (because it is force removed from the group chat).
export async function swapTwoPeople(
  room_id: RoomId,
  user_id_1: UserId,
  user_id_2: UserId
): Promise<{
  ok: boolean
  results?: TryToMoveResult[]
  removed_user2_from?: { chat?: ChatGroupId; poster?: PosterId }
}> {
  const ti = performance.now()
  const s1 = await redis.accounts.get("pos:" + room_id + ":" + user_id_1)
  const s2 = await redis.accounts.get("pos:" + room_id + ":" + user_id_2)
  if (!s1 || !s2) {
    return { ok: false }
  }
  const [x1_s, y1_s, direction1] = s1.split(".")
  const [x2_s, y2_s, direction2] = s2.split(".")
  const p1_ = { x: parseInt(x1_s), y: parseInt(y1_s) }
  const p2_ = { x: parseInt(x2_s), y: parseInt(y2_s) }
  const p1 = { ...p1_, direction: calcDirection(p2_, p1_) }
  const p2 = { ...p2_, direction: calcDirection(p1_, p2_) }
  if (!isAdjacent(p1, p2)) {
    log.warn("swapTwoPeople(): Not adjacent: ")
    return { ok: false }
  }
  await redis.accounts.mset(
    "pos:" + room_id + ":" + user_id_1,
    "" + p2.x + "." + p2.y + "." + p2.direction,
    "pos:" + room_id + ":" + user_id_2,
    "" + p1.x + "." + p1.y + "." + p1.direction
  )
  const last_updated = Date.now()
  try {
    await db.query(`BEGIN`)
    const rows1 = await db.query(
      `SELECT x,y FROM person_position WHERE person=$1 AND room=$2`,
      [user_id_1, room_id]
    )
    const rows2 = await db.query(
      `SELECT x,y FROM person_position WHERE person=$1 AND room=$2`,
      [user_id_2, room_id]
    )
    const p1_db = rows1[0]
      ? { x: rows1[0].x as number, y: rows1[0].y as number }
      : null
    const p2_db = rows2[0]
      ? { x: rows2[0].x as number, y: rows2[0].y as number }
      : null
    if (
      !p1_db ||
      p1_db.x != p1.x ||
      p1_db.y != p1.y ||
      !p2_db ||
      p2_db.x != p2.x ||
      p2_db.y != p2.y
    ) {
      throw {
        message: "swapTwoPeople(): Redis and RDB are inconsistent",
        p1,
        p1_db,
        p2,
        p2_db,
      }
    }
    await db.query(`DELETE FROM person_position WHERE person=$1 AND room=$2`, [
      user_id_1,
      room_id,
    ])
    await db.query(`DELETE FROM person_position WHERE person=$1 AND room=$2`, [
      user_id_2,
      room_id,
    ])
    await db.query(
      `INSERT INTO person_position (person,room,x,y,direction,last_updated) VALUES ($1,$2,$3,$4,$5,$6);`,
      [user_id_1, room_id, p2.x, p2.y, p2.direction, last_updated]
    )
    await db.query(
      `INSERT INTO person_position (person,room,x,y,direction,last_updated) VALUES ($1,$2,$3,$4,$5,$6);`,
      [user_id_2, room_id, p1.x, p1.y, p1.direction, last_updated]
    )
    const rows3 = await db.query(
      `DELETE FROM person_in_chat_group WHERE person=$1 AND chat IN (SELECT id FROM chat_group WHERE room=$2) RETURNING chat;`,
      [user_id_2, room_id]
    )
    const removed_from_chat = rows3[0] ? rows3[0].chat : undefined
    let group_removed: ChatGroupId | undefined = undefined
    let group_left: ChatGroup | undefined = undefined
    if (removed_from_chat) {
      const rs = await db.query(
        `SELECT person FROM person_in_chat_group WHERE chat=$1;`,
        [removed_from_chat]
      )
      const id = genChatEventId()
      if (rs.length <= 1) {
        group_removed = removed_from_chat
        await db.query(`DELETE FROM person_in_chat_group WHERE chat=$1;`, [
          removed_from_chat,
        ])
        await db.query(`DELETE FROM chat_group WHERE id=$1;`, [
          removed_from_chat,
        ])
        await db.query(
          `INSERT INTO chat_event (id, room, chat_group, person, event_type, "timestamp") VALUES ($1,$2,$3,$4,$5,$6);`,
          [
            id,
            room_id,
            removed_from_chat,
            rs[0] ? rs[0].person : user_id_2,
            "dissolve",
            last_updated,
          ]
        )
      } else {
        group_left =
          (await chat.getGroup(room_id, removed_from_chat)) || undefined
        await db.query(
          `INSERT INTO chat_event (id, room, chat_group, person, event_type, "timestamp") VALUES ($1,$2,$3,$4,$5,$6);`,
          [id, room_id, removed_from_chat, user_id_2, "leave", last_updated]
        )
      }
    }

    const rows4 = await db.query(
      `DELETE FROM poster_viewer WHERE person=$1 AND poster IN (SELECT id FROM poster WHERE location in (SELECT id FROM map_cell WHERE room=$2 AND kind='poster')) RETURNING poster;`,
      [user_id_2, room_id]
    )
    const poster_left: PosterId | undefined = rows4[0]
      ? rows4[0].poster
      : undefined
    if (poster_left) {
      await db.query(
        `UPDATE poster_viewer SET left_time=$3 WHERE person=$1 AND poster=$2;`,
        [user_id_2, poster_left, last_updated]
      )
    }
    await db.query(`COMMIT`)
    const tf = performance.now()
    log.debug(`swapTwoPeople() finished in ${(tf - ti).toFixed(3)} ms`)
    return {
      ok: true,
      results: [
        {
          room: room_id,
          user: user_id_1,
          position: p2,
          direction: p2.direction,
        },
        {
          room: room_id,
          user: user_id_2,
          position: p1,
          direction: p1.direction,
          group_removed,
          group_left,
          poster_left,
        },
      ],
    }
  } catch (err) {
    await db.query(`ROLLBACK`)
    await redis.accounts.mset(
      "pos:" + room_id + ":" + user_id_1,
      "" + p1.x + "." + p1.y + "." + direction1,
      "pos:" + room_id + ":" + user_id_2,
      "" + p2.x + "." + p2.y + "." + direction2
    )
    log.error(err)
    return { ok: false }
  }
}
export async function getPosMulti(
  room_id: RoomId,
  user_ids: UserId[]
): Promise<(PosDir | null)[]> {
  const keys = user_ids.map(u => "pos:" + room_id + ":" + u)
  const ss = await redis.accounts.mget(keys)
  return ss.map(s => {
    if (!s) {
      return null
    }
    const [x, y, direction] = s.split(".")
    return {
      x: parseInt(x),
      y: parseInt(y),
      direction: direction as Direction,
    }
  })
}
export async function get_multi(
  user_ids: string[],
  with_email = false,
  with_room_access = true
): Promise<(Person & { email?: string })[]> {
  const ps = await getAllPeopleList(null, with_email, with_room_access)
  const dict = _.fromPairs(user_ids.map(u => [u, 1]))
  return ps.filter(p => dict[p.id])
}
// Set person data with updated timestamp and socket notification
// For moving, you need to call a function `MapModel.movePerson`, instead of
export async function set(
  person_id: UserId,
  data: {
    name?: string
    email?: string
    avatar?: string
  },
  profiles?: {
    [key: string]: {
      content: string
      metadata?: any
    }
  }
): Promise<void> {
  const updateObj = {
    ..._.pickBy(_.pick(data, ["name", "email", "avatar"])),
    last_updated: Date.now(),
  }
  console.log("model.people.set", updateObj, profiles)
  const q = await pgp.helpers.update(updateObj, null, "person")
  const condition = pgp.as.format(" WHERE id=$1", person_id)
  await db.query(q + condition)
  if (data.email) {
    const old_email = await redis.accounts.getset(
      "uid:" + person_id,
      data.email
    )
    if (old_email) {
      await redis.accounts.rename("email:" + old_email, "email:" + data.email)
    } else {
      await redis.accounts.set("email:" + data.email, person_id)
    }
  }
  if (profiles) {
    for (const [k, v] of Object.entries(profiles)) {
      try {
        await db.query("BEGIN")
        // Note: with a nullable column, unique constrait cannot be used for upsert.
        await db.query(
          `DELETE FROM person_profile WHERE person = $1 AND "key" = $2 AND room IS NULL`,
          [person_id, k]
        )
        await db.query(
          `
          INSERT INTO person_profile (person, last_updated, "key", content, metadata)
              VALUES ($1, $2, $3, $4, $5);
          `,
          [
            person_id,
            updateObj.last_updated,
            k,
            v.content,
            v.metadata?.description
              ? { description: v.metadata.description }
              : null,
          ]
        )
        await db.query("COMMIT")
      } catch (e) {
        log.error(e)
        await db.query("ROLLBACK")
      }
    }
  }
}
export async function set_stats(pid: UserId, stats: PersonStat): Promise<void> {
  log.debug("set_stats() stub:", pid, stats)
  await 1
}

function decodeProperty(
  key: string,
  value: any
): { is_profile: boolean; value: any } | null {
  if (["name", "email", "avatar"].indexOf(key) >= 0) {
    return { is_profile: false, value }
  } else if (config.profile_keys.indexOf(key) >= 0) {
    const content = value.content
    const description = value.description
    return { is_profile: true, value: { content, metadata: { description } } }
  } else {
    return null
  }
}

export async function update(
  user_id: UserId,
  obj: { [index: string]: any }
): Promise<{
  keys: string[]
  update: {
    id: UserId
    last_updated: number
    name?: string
    email?: string
    avatar?: string
  }
} | null> {
  const person = await get(user_id)
  if (!person) {
    return null
  } else {
    const updated_keys: string[] = []
    const last_updated = Date.now()
    const new_person = { ...person, last_updated }
    for (const k of Object.keys(obj)) {
      const v = decodeProperty(k, obj[k])
      if (v) {
        updated_keys.push(k)
        if (v.is_profile) {
          if (!new_person.profiles) {
            new_person.profiles = {}
          }
          new_person.profiles[k] = v.value
        } else {
          new_person[k] = v.value
        }
      }
    }
    if (updated_keys.length > 0) {
      await set(user_id, new_person, new_person.profiles)
      return { keys: updated_keys.concat(["last_updated"]), update: new_person }
    } else {
      return null
    }
  }
}

export async function saveJWT(
  email: string,
  token: string,
  decoded: admin.auth.DecodedIdToken
): Promise<boolean> {
  const user_id = await getUserIdFromEmail(email)
  if (user_id) {
    const shaObj = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" })
    shaObj.update(token)
    const hash = shaObj.getHash("HEX")
    const milliseconds = decoded.exp * 1000 - Date.now()
    await db.query(
      `INSERT into token (person,token,expire_at) values ($1,$2,$3) ON CONFLICT ON CONSTRAINT token_pkey DO UPDATE SET token=$2,expire_at=$3;`,
      [user_id, token, decoded.exp * 1000]
    )
    await redis.accounts.psetex("token:" + email, milliseconds, token)
    await redis.accounts.psetex("hash:" + hash, milliseconds, user_id)
    return true
  } else {
    return false
  }
}

export async function getJWT(user_id: UserId): Promise<string | null> {
  const rows = await db.query(`SELECT token FROM token WHERE person=$1`, [
    user_id,
  ])
  return rows.length > 0 ? (rows[0].token as string) : null
}

export async function getUserIdFromJWTHash(
  hash: string
): Promise<UserId | null> {
  return await redis.accounts.get("hash:" + hash)
}

export async function authSocket(
  {
    user,
    token,
    debug_as,
  }: {
    user?: UserId
    token?: string
    debug_as?: UserId
  },
  socket_id?: string
): Promise<UserId | null> {
  log.debug("authSocket", { user, token, debug_as, socket_id })
  if (socket_id) {
    const r = await redis.sockets.get("auth:" + socket_id)
    if (r) {
      return r
    } else {
      log.debug("Socket ID not found in Redis.")
    }
  }
  if (debug_as) {
    if (debug_as == user && token == DEBUG_TOKEN) {
      return user
    } else {
      const is_admin = (await getUserType(debug_as)) == "admin"
      return is_admin ? debug_as : null
    }
  } else if (token) {
    const sender_id = await getUserIdFromJWTHash(token)
    log.info({ sender_id, user, token })
    if (!sender_id) {
      log.debug("Sender not found")
      return null
    } else if (sender_id && sender_id == user) {
      return user
    } else {
      const is_admin = (await getUserType(sender_id)) == "admin"
      return is_admin ? sender_id : null
    }
  } else {
    return null
  }
}

export async function isConnected(
  room_id: RoomId,
  user_ids: UserId[]
): Promise<boolean[]> {
  const connected = new Set(
    await redis.accounts.smembers(
      "connected_users:room:" + room_id + ":__all__"
    )
  )
  return user_ids.map(u => connected.has(u))
}

export async function setDirection(
  room_id: RoomId,
  user_id: UserId,
  direction: Direction
): Promise<void> {
  const pos = await getPos(user_id, room_id)
  if (pos) {
    await redis.accounts.set(
      "pos:" + room_id + ":" + user_id,
      "" + pos.x + "." + pos.y + "." + direction
    )
    const r = await db.query(
      `UPDATE person_position SET direction=$1 where person=$2 and room=$3;`,
      [direction, user_id, room_id]
    )
  }
}

export async function getAll(
  room_id: RoomId | null
): Promise<{ [index: string]: Person }> {
  const people_list = await getAllPeopleList(room_id)
  return _.keyBy(people_list, "id")
}

export function randomAvatar(): string {
  let n: number
  for (;;) {
    n = 1 + Math.floor(Math.random() * 30)
    if (n != 20) {
      break
    }
  }
  const avatar = n.toString().padStart(3, "0")
  return avatar
}

function _randomDirection(): Direction {
  return ["up", "down", "right", "left"][
    Math.floor(Math.random() * 4)
  ] as Direction
}

export async function createSessionId(
  type: "user" | "pre_registration",
  email: string,
  user_id?: UserId
): Promise<string> {
  const bs = crypto.randomBytes(32)
  const sid =
    "S_" +
    bs
      .toString("base64")
      .replace("+", "-")
      .replace("/", "_")
      .replace(/=+$/, "")
  console.log("Setting session ID", user_id, sid)
  const expires_in =
    type == "pre_registration" ? 60 * 60 : 60 * config.cookie_expires
  await redis.sessions.setex("cookie:value:" + user_id, expires_in, sid)
  await redis.sessions.setex("cookie:email:" + sid, expires_in, email)
  await redis.sessions.setex("cookie:type:" + sid, expires_in, type)
  if (type == "user") {
    await redis.sessions.setex("cookie:uid:" + sid, expires_in, user_id!)
  }
  return sid
}

export async function removePerson(
  user_id: UserId
): Promise<{ ok: boolean; error?: string }> {
  try {
    const owned_rooms = (
      await db.query<{ id: RoomId }[]>(
        `SELECT id FROM room WHERE room_owner=$1`,
        [user_id]
      )
    ).map(r => r.id)
    for (const room_id of owned_rooms) {
      const ok = await maps[room_id].deleteRoomFromDB()
      if (!ok) {
        log.warn("Deleting my own room failed. This must be a bug.")
        return { ok: false, error: "Deleting my own room failed." }
      } else {
        delete maps[room_id]
      }
    }
    const row = (
      await db.query(`SELECT email FROM person WHERE id=$1`, [user_id])
    )[0]
    if (!row) {
      return { ok: false, error: "User not found" }
    }
    const email: string = row.email
    await db.query(`BEGIN`)
    await db.query(`DELETE FROM chat_event_recipient WHERE person=$1`, [
      user_id,
    ])
    await db.query(`DELETE FROM poster_viewer WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM person_stats WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM person_room_access WHERE email=$1`, [email])
    await db.query(`DELETE FROM person_position WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM person_in_chat_group WHERE person=$1`, [
      user_id,
    ])
    console.log("Reply to delete 1")
    await db.query(
      `DELETE from comment_to_person where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1)))));`,
      [user_id]
    )
    await db.query(
      `DELETE from comment_to_poster where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1)))));`,
      [user_id]
    )
    await db.query(
      `DELETE from comment where id in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1)))));`,
      [user_id]
    )
    console.log("Reply to delete 2")
    await db.query(
      `DELETE from comment_to_person where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1))));`,
      [user_id]
    )
    await db.query(
      `DELETE from comment_to_poster where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1))));`,
      [user_id]
    )
    await db.query(
      `DELETE from comment where id in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1))));`,
      [user_id]
    )
    console.log("Reply to delete 3")
    await db.query(
      `DELETE from comment_to_person where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1)));`,
      [user_id]
    )
    await db.query(
      `DELETE from comment_to_poster where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1)));`,
      [user_id]
    )
    await db.query(
      `DELETE from comment where id in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1)));`,
      [user_id]
    )

    console.log("Reply to delete 4")
    await db.query(
      `DELETE from comment_to_person where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1));`,
      [user_id]
    )
    await db.query(
      `DELETE from comment_to_poster where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1));`,
      [user_id]
    )
    await db.query(
      `DELETE from comment where id in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE person=$1));`,
      [user_id]
    )
    console.log("Reply to delete 5")
    await db.query(
      `DELETE from comment_to_person WHERE comment IN (SELECT id FROM comment WHERE person=$1);`,
      [user_id]
    )
    await db.query(
      `DELETE from comment_to_poster WHERE comment IN (SELECT id FROM comment WHERE person=$1);`,
      [user_id]
    )
    await db.query(`DELETE from comment where person=$1;`, [user_id])
    console.log("Reply to delete 6")
    await db.query(
      `DELETE from comment_to_poster where comment in (SELECT id FROM comment WHERE person=$1);`,
      [user_id]
    )
    await db.query(
      `DELETE from comment_to_poster where poster in (SELECT id FROM poster WHERE author=$1);`,
      [user_id]
    )
    await db.query(
      `DELETE FROM poster_viewer WHERE poster IN (SELECT id FROM poster WHERE author=$1)`,
      [user_id]
    )
    await db.query(`DELETE FROM poster WHERE author=$1`, [user_id])
    await db.query(`DELETE FROM stat_encountered WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM token WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM vote WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM chat_event_recipient WHERE person=$1`, [
      user_id,
    ])
    await db.query(`DELETE FROM poster_comment_read WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM public_key WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM person_profile WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM person WHERE id=$1`, [user_id])
    await db.query(`COMMIT`)
    await redis.accounts.del("email:" + email)
    return { ok: true }
  } catch (e) {
    console.error(e)
    await db.query(`ROLLBACK`)
    return { ok: false, error: "DB error" }
  }
}

export async function getNotifications(
  user_id: UserId,
  room_id: RoomId
): Promise<NotificationEntry[]> {
  const rows = await db.query(
    `SELECT
          poster,
          array_agg(comment) as comments,
          max(timestamp) as max_timestamp
      FROM
          comment_to_poster AS cp
          LEFT JOIN comment AS c ON cp.comment = c.id
      WHERE
          c.id IN (
              SELECT
                  comment
              FROM
                  poster_comment_read
              WHERE
                  person = $1
                  AND read = 'f')
          AND c.room = $2
      GROUP BY poster;
          `,
    [user_id, room_id]
  )
  return rows.map(row => {
    return {
      kind: "poster_comments",
      data: {
        count: row.comments.length,
        poster: row.poster,
      },
      timestamp: +row.max_timestamp,
    } as PosterCommentNotification
  })
}
