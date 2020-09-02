import _ from "lodash"
import shortid from "shortid"
import jsSHA from "jssha"
import * as admin from "firebase-admin"
import pg from "pg-promise"
import crypto from "crypto"

import {
  Person,
  PersonRDB,
  PersonWithEmail,
  Direction,
  Point,
  UserId,
  PersonStat,
  RoomId,
  PosDir,
} from "@/@types/types"
import { redis, log, dbWith, db, pgp, maps } from "./index"

let initialized = false

const get_pos_pg = new pg.PreparedStatement({
  name: "get_pos",
  text: `SELECT * from person_position WHERE room=$1 AND person=$2`,
})

export async function init(): Promise<void> {
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
        await redis.accounts.set("email:" + email, id)
        await redis.accounts.set("uid:" + id, email)
        if (p.role == "admin") {
          await redis.accounts.set("email:" + email + ":admin", id)
          await redis.accounts.set("uid:" + id + ":admin", email)
        }
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
    initialized = true
  } catch (err) {
    log.error(err)
  }
}

// Stats fields may be updated frequently during development,
// so the data from DB is normalized upon loading.
function normalizeStats(obj: Record<string, any>): PersonStat {
  const res: PersonStat = {
    walking_steps: obj?.walking_steps || 0,
    chat_char_count: obj?.chat_char_count || 0,
    chat_count: obj?.chat_count || 0,
    people_encountered:
      typeof obj?.people_encountered == "object" ? obj?.people_encountered : [],
  }
  return res
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
): Promise<{ ok: boolean; user?: PersonWithEmail; error?: string }> {
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
    await db.query(`BEGIN`)
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
    await redis.accounts.set("email:" + email, uid_actual)
    await redis.accounts.set("uid:" + uid_actual, email)
    if (typ == "admin") {
      await redis.accounts.set("email:" + email + ":admin", uid_actual)
      await redis.accounts.set("uid:" + uid_actual + ":admin", email)
    }
    if (merge_strategy == "replace") {
      await db.query(`DELETE FROM person_room_access WHERE person=$1;`, [
        uid_actual,
      ])
    }
    for (const room of allowed_rooms) {
      if (!maps[room]) {
        log.warn("Room does not exist", room)
        continue
      }
      await db.query(
        `INSERT INTO person_room_access (room,person,"role") values ($1,$2,$3) ON CONFLICT ON CONSTRAINT person_room_access_pkey DO NOTHING;`,
        [room, uid_actual, typ]
      )
      const pos = await maps[room].getRandomOpenPos(uid_actual)
      if (pos) {
        const _person = await db.query(
          `INSERT INTO person_position (person,room,last_updated,x,y,direction) values ($1,$2,$3,$4,$5,$6) ON CONFLICT ON CONSTRAINT person_position_pkey DO NOTHING RETURNING person;`,
          [uid_actual, room, Date.now(), pos.x, pos.y, randomDirection()]
        )
      } else {
        log.warn("No open space or map uninitialized")
        await db.query(`ROLLBACK`)
        return { ok: false, error: "No open space or map uninitialized" }
      }
    }
    const user = await getUnwrap(uid_actual)
    await db.query(`COMMIT`)
    return { ok: true, user }
  } catch (err) {
    await db.query("ROLLBACK")
    log.error(err)
    return { ok: false }
  }
}
export async function getAllPeopleList(
  room_id: RoomId | null,
  with_email = false,
  with_room_access = false
): Promise<PersonWithEmail[]> {
  let rows
  if (room_id) {
    rows = await db.query(
      `select * from person left join person_position as pos on person.id=pos.person left join public_key as k on person.id=k.person where pos.room=$1;`,
      [room_id]
    )
  } else {
    rows = await (with_room_access
      ? db.query(
          `select person.*,string_agg(ra.room,'::::') as rooms,k.public_key from person left join person_room_access as ra on person.id=ra.person left join public_key as k on person.id=k.person group by person.id,k.public_key;`
        )
      : db.query("select * from person;"))
  }
  const connected = room_id
    ? new Set(await redis.sockets.smembers("room:" + room_id + ":__all__"))
    : new Set<string>()

  const count_all_sockets_for_users = await redis.sockets.hgetall(
    "room:" + "__any__"
  )

  // log.debug(count_all_sockets_for_users)
  return rows.map(row => {
    delete row["person"]
    if (!with_email) {
      delete row["email"]
    }
    if (row["rooms"]) {
      row["rooms"] = row["rooms"].split("::::")
    }
    row["stats"] = {
      walking_steps: 0,
      people_encountered: [],
      chat_count: 0,
      chat_char_count: 0,
    }
    log.debug()
    if (room_id) {
      row["connected"] = connected.has(row.id)
    } else {
      row["connected"] =
        count_all_sockets_for_users[row.id] &&
        parseInt(count_all_sockets_for_users[row.id]) > 0
          ? true
          : false
    }
    row.last_updated = parseInt(row.last_updated)
    return row
  })
}

export async function getAdmin(): Promise<UserId[] | null> {
  const admins = await redis.accounts.keys("uid:*:admin")
  return admins.length == 0 ? null : admins
}
export async function get(
  user_id: string,
  with_email = false,
  with_room_access = false
): Promise<PersonWithEmail | null> {
  if (!initialized) {
    throw new Error("Not initialized")
  }
  const rows = with_room_access
    ? await db.query(
        `select person.*,string_agg(ra.room,'::::') as rooms from person left join person_room_access as ra on person.id=ra.person left join public_key as k on person.id=k.person where person.id=$1 group by person.id;`,
        [user_id]
      )
    : await db.query(
        `SELECT * from person left join public_key as k on person.id=k.person where id=$1;`,
        [user_id]
      )
  const p: PersonWithEmail | null = rows[0]
  if (p) {
    p.public_key = rows[0].public_key || undefined
    if (with_email) {
      p.email = (await redis.accounts.get("uid:" + user_id)) || undefined
    }
  }
  return p
}
export async function getUnwrap(
  user_id: string,
  with_email = false,
  with_room_access = false
): Promise<PersonWithEmail> {
  const p = await get(user_id, with_email, with_room_access)
  if (p) {
    return p
  } else {
    throw "Tried to unwrap undefined Person"
  }
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
    log.debug("Get raw data", s)
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
export async function getPosMulti(
  room_id: RoomId,
  user_ids: UserId[]
): Promise<((Point & { direction: Direction }) | null)[]> {
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
): Promise<PersonWithEmail[]> {
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
  }
): Promise<void> {
  if (!initialized) {
    throw new Error("Not initialized")
  }
  const q = await pgp.helpers.update(
    {
      ..._.pick(data, ["name", "email", "avatar"]),
      last_updated: Date.now(),
    },
    null,
    "person"
  )
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
}
export async function set_stats(pid: UserId, stats: PersonStat): Promise<void> {
  log.debug("set_stats() stub:", pid, stats)
  await 1
}
export async function update(
  user_id: UserId,
  obj: { [index: string]: string | number }
): Promise<string[] | null> {
  if (!initialized) {
    throw new Error("Not initialized")
  }
  const person = await get(user_id)
  if (!person) {
    return null
  } else {
    log.debug(obj)
    const last_updated = Date.now()
    const new_person = { ...person, last_updated }
    const keys = _.intersection(Object.keys(obj), [
      "name",
      "email",
      "x",
      "y",
      "avatar",
    ])
    for (const k of keys) {
      new_person[k] = obj[k]
    }
    await set(user_id, new_person)

    const email: string | undefined = obj["email"] as string | undefined

    return keys.concat(email ? ["email"] : [])
  }
}
export async function getUserIdFromEmail(
  email: string
): Promise<string | null> {
  return await redis.accounts.get("email:" + email)
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
export async function getUserType(
  user_id: UserId
): Promise<"admin" | "user" | null> {
  const count = await redis.accounts.exists(
    "uid:" + user_id,
    "uid:" + user_id + ":admin"
  )
  return count == 2 ? "admin" : count == 1 ? "user" : null
}

export async function authSocket(
  {
    user,
    token,
    debug_as,
  }: {
    user: UserId
    token?: string
    debug_as?: UserId
  },
  socket_id?: string
): Promise<boolean> {
  log.debug({ user, token, debug_as })
  if (socket_id) {
    const r = redis.sockets.get("auth:" + socket_id)
    if (r) {
      return true
    }
  }
  if (debug_as) {
    if (debug_as == user && token == process.env.DEBUG_TOKEN) {
      return true
    } else {
      const is_admin = (await getUserType(debug_as)) == "admin"
      return is_admin
    }
  } else if (token) {
    const sender_id = await getUserIdFromJWTHash(token)
    if (!sender_id) {
      log.debug("Sender not found")
      return false
    } else if (sender_id && sender_id == user) {
      return true
    } else {
      const is_admin = (await getUserType(sender_id)) == "admin"
      return is_admin
    }
  } else {
    return false
  }
}

export async function isConnected(
  room_id: RoomId,
  user_ids: UserId[]
): Promise<boolean[]> {
  const connected = new Set(
    await redis.sockets.smembers("room:" + room_id + ":__all__")
  )
  return user_ids.map(u => connected.has(u))
}

export async function setDirection(
  user_id: UserId,
  direction: Direction
): Promise<void> {
  if (!initialized) {
    throw new Error("Not initialized")
  }
  const person = await get(user_id)
  if (person) {
    const r = await db.query(
      `UPDATE person_position SET direction=$1 where person=$2;`,
      [direction, person.id]
    )
    log.debug(r)
  }
}

export async function getAll(
  room_id: RoomId | null
): Promise<{ [index: string]: Person }> {
  if (!initialized) {
    throw new Error("Not initialized")
  }
  const people_list = await getAllPeopleList(room_id)
  return _.keyBy(people_list, "id")
}

function genUserId(): string {
  for (;;) {
    const s = "U" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
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

function randomDirection(): Direction {
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
  const expires_in = type == "pre_registration" ? 60 * 60 : 60 * 60 * 6
  await redis.sessions.setex("cookie:value:" + user_id, expires_in, sid)
  await redis.sessions.setex("cookie:email:" + sid, expires_in, email)
  await redis.sessions.setex("cookie:type:" + sid, expires_in, type)
  if (type == "user") {
    await redis.sessions.setex("cookie:uid:" + sid, expires_in, user_id!)
  }
  return sid
}

/*
export async function createPreRegistrationSessionId(
  email: string
): Promise<string> {
  const bs = crypto.randomBytes(32)
  const sid =
    "P_" +
    bs
      .toString("base64")
      .replace("+", "-")
      .replace("/", "_")
      .replace(/=+$/, "")
  console.log("Setting pre-registration session ID", email, sid)
  await redis.sessions.setex("cookie:email:" + sid, 60 * 60 * 6, email)
  await redis.sessions.setex(
    "cookie:type:" + sid,
    60 * 60 * 6,
    "pre_registration"
  )
  return sid
}
*/

export async function removePerson(
  user_id: UserId
): Promise<{ ok: boolean; error?: string }> {
  try {
    const row = (
      await db.query(`SELECT email FROM person WHERE id=$1`, [user_id])
    )[0]
    if (!row) {
      return { ok: false, error: "User not found" }
    }
    const email = row.email
    await db.query(`BEGIN`)
    await db.query(`DELETE FROM person_stats WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM person_room_access WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM person_position WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM person_in_chat_group WHERE person=$1`, [
      user_id,
    ])
    await db.query(`DELETE FROM comment_to_person WHERE person=$1`, [user_id])
    await db.query(
      `DELETE FROM comment_to_person WHERE comment IN (SELECT id FROM comment WHERE person=$1)`,
      [user_id]
    )
    await db.query(`DELETE FROM comment WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM poster WHERE author=$1`, [user_id])
    await db.query(`DELETE FROM stat_encountered WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM token WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM vote WHERE person=$1`, [user_id])
    await db.query(`DELETE FROM public_key WHERE person=$1`, [user_id])
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
