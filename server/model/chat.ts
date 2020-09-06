import _ from "lodash"
import {
  UserId,
  ChatGroupId,
  ChatGroup,
  Point,
  PosterId,
  RoomId,
  ChatGroupRDB,
  ChatComment,
  ChatCommentDecrypted,
  CommentId,
  CommentEncryptedEntry,
} from "@/@types/types"
import * as bunyan from "bunyan"
import { db, pgp } from "../model"
import * as model from "../model"
import shortid from "shortid"
import { allPointsConnected } from "../../common/util"
import { config } from "../config"

const PRODUCTION = process.env.NODE_ENV == "production"

const DEBUG_LOG = config.api_server.debug_log

const log = bunyan.createLogger({
  name: "chat",
  src: !PRODUCTION,
  level: DEBUG_LOG ? 1 : bunyan.FATAL + 1,
})

// Handling chat groups and comments
export async function getGroup(
  room_id: RoomId,
  group_id: ChatGroupId
): Promise<ChatGroup | null> {
  const row: ChatGroupRDB = (
    await db.query(
      `SELECT g.*,string_agg(pcg.person,'::::') as users FROM chat_group as g join person_in_chat_group as pcg on g.id=pcg.chat WHERE id=$1 and room=$2 GROUP BY g.id`,
      [group_id, room_id]
    )
  )[0]
  return {
    ...row,
    users: row.users?.split("::::") || [],
    color: row.color || "blue",
  }
}
export async function getGroupList(
  room_id: RoomId | null
): Promise<ChatGroup[]> {
  const rows: {
    id: string
    room: string
    color: string
    users: string
    kind: "people" | "poster"
  }[] = await (room_id
    ? db.query(
        `SELECT g.*,string_agg(pcg.person,'::::') as users from chat_group as g join person_in_chat_group as pcg on g.id=pcg.chat WHERE g.room=$1 GROUP BY g.id`,
        [room_id]
      )
    : db.query(
        `SELECT g.*,string_agg(pcg.person,'::::') as users from chat_group as g join person_in_chat_group as pcg on g.id=pcg.chat GROUP BY g.id`
      ))
  return rows.map(r => {
    const d: ChatGroup = {
      id: r.id,
      room: r.room,
      color: r.color,
      users: r.users.split("::::"),
      kind: r.kind,
    }
    return d
  })
}
export async function getGroupOfUser(
  room_id: RoomId,
  user_id: UserId
): Promise<ChatGroup | null> {
  try {
    await db.query(`BEGIN`)
    const rows = await db.query(
      `SELECT id from chat_group as g JOIN person_in_chat_group as pcg ON g.id=pcg.chat where pcg.person=$1 and g.room=$2`,
      [user_id, room_id]
    )
    const group_id: ChatGroupId | undefined = rows[0]?.id
    if (!group_id) {
      await db.query(`COMMIT`)
      return null
    }
    const group = await getGroup(room_id, group_id)
    await db.query(`COMMIT`)
    return group
  } catch (err) {
    await db.query(`ROLLBACK`)
    return null
  }
}

export async function calcChatColor(
  this_group_id: string | null,
  room_id: RoomId,
  pos: Point | null,
  points: { [user_id: string]: Point }, //Points of users that belong to any chat group
  groups: { [index: string]: { users: UserId[]; color: string } }
): Promise<string> {
  const chatGroups = _.keyBy(await getGroupList(room_id), "id")
  const colors10 = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ]
  function calcDistance(
    ps1: Point[],
    position: Point | null,
    ps2: Point[]
  ): { x: number; y: number } {
    log.debug(ps1, ps2)
    let min_x = Number.MAX_VALUE
    let min_y = Number.MAX_VALUE
    if (ps1.length == 0) {
      if (position == null) {
        throw new Error(
          "Position must be specified for a (new) group with no member"
        )
      }
      ps2.forEach(b => {
        min_x = Math.min(min_x, Math.abs(position.x - b.x))
        min_y = Math.min(min_x, Math.abs(position.y - b.y))
      })
    } else {
      ps1.forEach(a => {
        ps2.forEach(b => {
          min_x = Math.min(min_x, Math.abs(a.x - b.x))
          min_y = Math.min(min_x, Math.abs(a.y - b.y))
        })
      })
    }
    return { x: min_x, y: min_y }
  }
  const possible_colors: string[] = _.clone(colors10)
  const users_a = (this_group_id ? groups[this_group_id]?.users || [] : []).map(
    u => points[u]
  )
  for (const group_id in groups) {
    if (group_id != this_group_id) {
      const users_b = groups[group_id].users.map(u => points[u])
      const distance = calcDistance(users_a, pos, users_b)
      if (distance.x < 7 && distance.y < 7 && chatGroups[group_id] != null) {
        _.pull(possible_colors, chatGroups[group_id]?.color)
      }
    }
  }
  if (possible_colors.length > 0) {
    return possible_colors[0]
  } else {
    console.warn(
      "No unique color for the group. Use a random color.",
      this_group_id
    )
    return colors10[Math.floor(Math.random() * 10)]
  }
}
export function calcCenter(positions: Point[]): Point | null {
  if (positions.length == 0) {
    return null
  }
  const mean_x = _.sum(positions.map(p => p.x)) / positions.length
  const mean_y = _.sum(positions.map(p => p.y)) / positions.length
  return { x: Math.round(mean_x), y: Math.round(mean_y) }
}
async function deleteComment(comment_id: string): Promise<boolean> {
  try {
    await db.query("BEGIN")
    await db.query(`DELETE from comment_to_person where comment=$1;`, [
      comment_id,
    ])
    await db.query(`DELETE from comment_to_poster where comment=$1;`, [
      comment_id,
    ])
    await db.query(`DELETE from comment where id=$1;`, [comment_id])
    await db.query("COMMIT")
    return true
  } catch (err) {
    await db.query("ROLLBACK")
    log.error(err)
    return false
  }
}
export async function deleteGroup(group_id: ChatGroupId): Promise<boolean> {
  try {
    await db.query("BEGIN")
    await db.query(`DELETE FROM person_in_chat_group WHERE chat=$1`, [group_id])
    await db.query(`DELETE FROM chat_group WHERE id=$1`, [group_id])
    await db.query("COMMIT")
    return true
  } catch (err) {
    await db.query("ROLLBACK")
    log.error(err)
    return false
  }
}

export async function getAllComments(
  room_id: RoomId,
  user_id: UserId | null
): Promise<ChatComment[]> {
  console.log("getAllComments()", room_id, user_id)
  const from_me = await db.query(
    `select 'from_me' as mode,c.id as id,c.person,c.x,c.y,array_agg(cp.encrypted) as to_e,string_agg(cp.person,'::::') as to,string_agg(cp.comment_encrypted,'::::') as to_c,c.timestamp,c.last_updated,c.kind,c.text,c.room from comment as c left join comment_to_person as cp on c.id=cp.comment where c.person=$1 and room=$2 and kind='person' group by c.id, c.x, c.y,c.text,c.timestamp,c.last_updated,c.person,c.kind,c.text order by c.timestamp`,
    [user_id, room_id]
  )
  const to_me = await db.query(
    `select 'to_me' as mode,c.id as id,c.person,c.x,c.y,array_agg(cp2.encrypted) as to_e,string_agg(cp2.person,'::::') as to,string_agg(cp2.comment_encrypted,'::::') as to_c,c.timestamp,c.last_updated,c.kind,c.text,c.room from comment as c left join comment_to_person as cp on c.id=cp.comment left join comment_to_person as cp2 on c.id=cp2.comment where cp.person=$1 and room=$2 and kind='person' group by c.id, c.x, c.y,c.text,c.timestamp,c.last_updated,c.person,c.kind,c.text order by c.timestamp`,
    [user_id, room_id]
  )
  const ds: ChatComment[] = from_me.concat(to_me).map(r => {
    const for_users: string[] = (r["to"] || "").split("::::")
    const comments_for_users: string[] = (r["to_c"] || "").split("::::")
    const encrypted_for_users: boolean[] = r["to_e"]
    const r2: ChatComment = {
      id: r.id,
      timestamp: parseInt(r["timestamp"]),
      last_updated: parseInt(r["last_updated"]),
      room: r.room,
      person: r.person,
      x: r.x,
      y: r.y,
      kind: r.kind,
      texts: _.zipWith(
        for_users,
        comments_for_users,
        encrypted_for_users,
        (to, text, encrypted) => {
          return { to, text, encrypted }
        }
      ),
    }
    return r2
  })
  const ds2 = _.uniqBy(ds, "id")
  return ds2
}

export async function getPosterComments(
  poster_id: PosterId
): Promise<ChatCommentDecrypted[]> {
  const rows = await db.query(
    `select c.id as id,c.person,c.x,c.y,string_agg(cp.poster,'::::') as to_poster,c.timestamp,c.last_updated,c.kind,c.text,c.room from comment as c join comment_to_poster as cp on c.id=cp.comment where cp.poster=$1 group by c.id, c.x, c.y,c.text,c.timestamp,c.last_updated,c.person,c.kind,c.text order by c.timestamp`,
    poster_id
  )
  const ds: ChatCommentDecrypted[] = rows.map(r => {
    const r2: ChatCommentDecrypted = {
      id: r.id,
      timestamp: parseInt(r["timestamp"]),
      last_updated: parseInt(r["last_updated"]),
      x: r.x,
      y: r.y,
      room: r.room,
      person: r.person,
      text_decrypted: r.text,
      texts: r["to_poster"].split("::::").map(to => {
        return { to, encrypted: false }
      }),
      kind: "poster",
    }
    return r2
  })
  return ds
}
export async function addPosterComment(
  c: ChatCommentDecrypted
): Promise<boolean> {
  log.debug(c)
  if (c.kind != "poster") {
    return false
  }
  try {
    await db.query("BEGIN")
    const obj = {
      id: c.id,
      person: c.person,
      text: c.text_decrypted,
      room: c.room,
      x: c.x,
      y: c.y,
      timestamp: c.timestamp,
      last_updated: c.last_updated,
      kind: c.kind,
    }
    await db.query(pgp.helpers.insert(obj, null, "comment"))
    const s = pgp.helpers.insert(
      c.texts.map(t => {
        return { comment: c.id, poster: t.to }
      }),
      ["comment", "poster"],
      "comment_to_poster"
    )
    await db.query(s)

    const p = await model.people.get(c.person)
    if (p) {
      // const to = c.kind == "poster" ? [] : (c.to as string[])
      // p.stats.people_encountered = _.difference(
      //   _.uniq(p.stats.people_encountered.concat(to)),
      //   [c.user]
      // )
      // await model.people.set_stats(p.id, p.stats)
    }
    await db.query("COMMIT")

    return true
  } catch (err) {
    log.error(err)
    await db.query("ROLLBACK")
    return false
  }
}
export async function addCommentEncrypted(c: ChatComment): Promise<boolean> {
  log.debug(c)
  try {
    await db.query("BEGIN")
    await db.query(
      pgp.helpers.insert(
        {
          id: c.id,
          person: c.person,
          text: "@@@@__unused__@@@@",
          room: c.room,
          x: c.x,
          y: c.y,
          timestamp: c.timestamp,
          last_updated: c.last_updated,
          kind: c.kind,
        },
        null,
        "comment"
      )
    )
    if (c.kind == "person") {
      const s = pgp.helpers.insert(
        c.texts.map(t => {
          return {
            comment: c.id,
            person: t.to,
            comment_encrypted: t.text.replace(/::::/g, "：：：："),
            encrypted: t.encrypted,
          }
        }),
        ["comment", "person", "comment_encrypted", "encrypted"],
        "comment_to_person"
      )
      await db.query(s)
    }
    const p = await model.people.get(c.person)
    if (p) {
      // const to = c.kind == "poster" ? [] : (c.to as string[])
      // p.stats.people_encountered = _.difference(
      //   _.uniq(p.stats.people_encountered.concat(to)),
      //   [c.user]
      // )
      // await model.people.set_stats(p.id, p.stats)
    }
    await db.query("COMMIT")

    return true
  } catch (err) {
    log.error(err)
    await db.query("ROLLBACK")
    return false
  }
}

export async function getComment(
  comment_id: string
): Promise<ChatComment | null> {
  const from_me = await db.query(
    `select 'from_me' as mode,c.id as id,c.person,c.x,c.y,array_agg(cp.encrypted) as to_e,string_agg(cp.person,'::::') as to,string_agg(cp.comment_encrypted,'::::') as to_c,c.timestamp,c.last_updated,c.kind,c.text,c.room from comment as c left join comment_to_person as cp on c.id=cp.comment WHERE c.id=$1 group by c.id, c.x, c.y,c.text,c.timestamp,c.last_updated,c.person,c.kind,c.text order by c.timestamp`,
    [comment_id]
  )
  const to_me = await db.query(
    `select 'to_me' as mode,c.id as id,c.person,c.x,c.y,array_agg(cp2.encrypted) as to_e,string_agg(cp2.person,'::::') as to,string_agg(cp2.comment_encrypted,'::::') as to_c,c.timestamp,c.last_updated,c.kind,c.text,c.room from comment as c left join comment_to_person as cp on c.id=cp.comment left join comment_to_person as cp2 on c.id=cp2.comment WHERE c.id=$1 group by c.id, c.x, c.y,c.text,c.timestamp,c.last_updated,c.person,c.kind,c.text order by c.timestamp`,
    [comment_id]
  )

  const ds: ChatComment[] = from_me.concat(to_me).map(r => {
    const for_users: string[] = (r["to"] || "").split("::::")
    const comments_for_users: string[] = (r["to_c"] || "").split("::::")
    const encrypted_for_users: boolean[] = r["to_e"]
    const r2: ChatComment = {
      id: r.id,
      timestamp: parseInt(r["timestamp"]),
      last_updated: parseInt(r["last_updated"]),
      room: r.room,
      person: r.person,
      x: r.x,
      y: r.y,
      kind: r.kind,
      texts: _.zipWith(
        for_users,
        comments_for_users,
        encrypted_for_users,
        (to, text, encrypted) => {
          return { to, text, encrypted }
        }
      ),
    }
    return r2
  })
  const ds2 = _.uniqBy(ds, "id")
  return ds2[0]
}

export async function updateComment(
  user_id: string,
  comment_id: string,
  comments_encrypted: CommentEncryptedEntry[]
): Promise<{ ok: boolean; comment?: ChatComment; error?: string }> {
  let last_updated: number
  const comment = await getComment(comment_id)
  log.debug("updateComment", comment, user_id)
  if (!comment) {
    return { ok: false, error: "Comment not found: ID = " + comment_id }
  }
  if (user_id == comment.person) {
    last_updated = Date.now()
    const updated_comment: ChatComment = {
      x: comment.x,
      y: comment.y,
      id: comment.id,
      timestamp: comment.timestamp,
      room: comment.room,
      person: comment.person,
      kind: "person",
      texts: comments_encrypted,
      last_updated,
    }
    try {
      await db.query(`BEGIN`)
      await db.query(`UPDATE comment SET "text"=$1 WHERE id=$2;`, [
        "@@@@__unused__@@@@",
        comment_id,
      ])
      for (const c of comments_encrypted) {
        await db.query(
          `UPDATE comment_to_person SET comment_encrypted=$1 WHERE comment=$2 AND person=$3`,
          [c.text, comment_id, c.to]
        )
      }
      await db.query(`COMMIT`)
    } catch (err) {
      log.error(err)
      await db.query(`ROLLBACK`)
    }

    return { ok: true, comment: updated_comment }
  } else {
    return {
      ok: false,
      error: `User ${user_id} does not own comment ${comment_id}.`,
    }
  }
}
export async function updatePosterComment(
  user_id: string,
  poster_id: PosterId,
  comment_id: string,
  text: string
): Promise<{ ok: boolean; comment?: ChatComment; error?: string }> {
  let last_updated: number
  const comment = await getComment(comment_id)
  // log.debug("updateComment", text, user_id)
  if (!comment) {
    return { ok: false, error: "Comment not found: ID = " + comment_id }
  }
  if (user_id == comment.person) {
    last_updated = Date.now()
    try {
      await db.query(
        `UPDATE comment SET "text"=$1,last_updated=$2 WHERE id=$3;`,
        [text, last_updated, comment_id]
      )
      const uc = await getComment(comment_id)
      const res: ChatComment | undefined = uc
        ? {
            x: uc.x,
            y: uc.y,
            id: uc.id,
            timestamp: uc.timestamp,
            last_updated: uc.last_updated,
            kind: "poster" as "poster" | "person",
            room: uc.room,
            person: uc.person,
            texts: [{ to: poster_id, text, encrypted: false }],
          }
        : undefined
      return { ok: !!uc, comment: res }
    } catch (err) {
      log.error(err)
      return { ok: false, error: "DB update error" }
    }
  } else {
    return {
      ok: false,
      error: `User ${user_id} does not own comment ${comment_id}.`,
    }
  }
}

export async function removeComment(
  user_id: string,
  comment_id: string
): Promise<{
  ok: boolean
  kind?: "person" | "poster"
  removed_to_users?: UserId[]
  error?: string
}> {
  const doc = await getComment(comment_id)
  if (!doc) {
    return { ok: false, error: "Comment does not exist." }
  }
  if (doc.person != user_id) {
    return { ok: false, error: "User does not own comment." }
  }
  const ok = await deleteComment(comment_id)
  return { ok, kind: doc.kind, removed_to_users: doc.texts.map(t => t.to) }
}

export function genCommentId(): CommentId {
  for (;;) {
    const s = "C" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
}

export function genGroupId(): ChatGroupId {
  for (;;) {
    const s = "G" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
}

export async function getGroupIdOfUser(
  room_id: RoomId,
  user_id: UserId
): Promise<ChatGroupId | null> {
  log.info("getGroupIdOfUser", room_id, user_id)
  const rows = await db.query(
    `SELECT id FROM chat_group as g join person_in_chat_group as pcg on pcg.chat=g.id WHERE pcg.person=$1 and g.room=$2`,
    [user_id, room_id]
  )
  if (rows.length > 0) {
    return rows[0].id
  } else {
    return null
  }
}
export async function startChat(
  room_id: RoomId,
  from_user: UserId,
  to_users: UserId[]
): Promise<{ ok: boolean; group?: ChatGroup; error?: string }> {
  log.debug("startChat", room_id, from_user, to_users)
  const currentGroups = _.compact(
    await Promise.all(
      [from_user].concat(to_users).map(u => getGroupIdOfUser(room_id, u))
    )
  )
  if (currentGroups.length > 0) {
    return { ok: false, error: "Currently in chat" }
  }
  return await newGroup(room_id, [from_user].concat(to_users))
}
async function positionsOfPeopleInChat(): Promise<{
  [user_id: string]: Point
}> {
  const rows = await db.query(
    `select x,y,id from person join person_position as pp on person.id=pp.person join person_in_chat_group as pcg on person.id=pcg.person;`
  )
  return _.keyBy(
    rows.map(r => {
      return { id: r.id, x: r.x, y: r.y }
    }),
    "id"
  )
}
export async function newGroup(
  room_id: RoomId,
  users: UserId[]
): Promise<{ ok: boolean; error?: string; group?: ChatGroup }> {
  const group_id = genGroupId()
  const groups = _.keyBy(await getGroupList(room_id), "id")
  if (!_.every(users, u => u[0] == "U")) {
    return { ok: false }
  }
  const points_ = await model.people.getPosMulti(room_id, users)
  const points = _.compact(points_)
  if (points.length != points_.length) {
    log.error("Null position exists.")
    return { ok: false, error: "Null position exists" }
  }
  if (!allPointsConnected(points)) {
    return { ok: false, error: "Not all people are in proximity" }
  }
  const center = calcCenter(points)
  const center_cell = center
    ? await model.maps[room_id].getStaticMapAt(center.x, center.y)
    : null
  const all_pos_people_in_chat: {
    [user_id: string]: Point
  } = await positionsOfPeopleInChat()
  log.debug(points)
  log.debug(center)
  log.debug(all_pos_people_in_chat)
  const color = await calcChatColor(
    group_id,
    room_id,
    center,
    all_pos_people_in_chat,
    groups
  )
  const group: ChatGroup = {
    id: group_id,
    room: room_id,
    users,
    color,
    kind: "people",
  }
  await db.query("BEGIN")
  await db.query(
    pgp.helpers.insert(
      {
        id: group.id,
        last_updated: Date.now(),
        room: room_id,
        location: center_cell?.id,
        color,
        kind: group.kind,
      },
      null,
      "chat_group"
    )
  )
  await db.query(
    pgp.helpers.insert(
      users.map(u => {
        return { person: u, chat: group_id }
      }),
      ["person", "chat"],
      "person_in_chat_group"
    )
  )
  await db.query("COMMIT")
  return { ok: true, group }
}
export async function joinChat(
  room_id: RoomId,
  from_user: UserId,
  group_id: ChatGroupId
): Promise<{ ok: boolean; error?: string; joinedGroup?: ChatGroup }> {
  log.debug("joinChat", room_id, from_user, group_id)
  await db.query(
    pgp.helpers.insert(
      { person: from_user, chat: group_id },
      null,
      "person_in_chat_group"
    )
  )
  const joinedGroup = (await getGroup(room_id, group_id)) || undefined
  return { ok: !!joinedGroup, joinedGroup }
}
export async function addMember(
  room_id: RoomId,
  from_user: UserId,
  to_user: UserId,
  group_id: ChatGroupId
): Promise<{ ok: boolean; error?: string; joinedGroup?: ChatGroup }> {
  // log.debug("addMember", room_id, from_user, to_user, group_id)
  try {
    await db.query(
      pgp.helpers.insert(
        { person: to_user, chat: group_id },
        null,
        "person_in_chat_group"
      )
    )
    const joinedGroup = (await getGroup(room_id, group_id)) || undefined
    return { ok: !!joinedGroup, joinedGroup }
  } catch (err) {
    log.error(err)
    return { ok: false, error: "Add member failed" }
  }
}
export async function leaveChat(
  room_id: RoomId,
  user_id: UserId
): Promise<{
  ok: boolean
  error?: string
  leftGroup?: ChatGroup
  removedGroup?: ChatGroupId
}> {
  log.debug("leaveChat", room_id, user_id)
  const group_id = await getGroupIdOfUser(room_id, user_id)
  if (!group_id) {
    log.warn("Does not belong to a group")
    return { ok: false, error: "Does not belong to a group" }
  }
  const g1 = await getGroup(room_id, group_id)
  if (!g1) {
    log.error(`${group_id} does not exist`)
    return { ok: false, error: `${group_id} does not exist` }
  }
  await db.query(
    `DELETE FROM person_in_chat_group WHERE person=$1 and chat=$2`,
    [user_id, group_id]
  )
  const online = await model.people.isConnected(
    room_id,
    _.difference(g1.users, [user_id])
  )
  //Only one person remains or all remained are offline.
  if (g1.users.length == 2 || _.every(online, o => o == false)) {
    const r = await deleteGroup(group_id)
    return { ok: r, removedGroup: r ? group_id : undefined }
  } else {
    const group = await getGroup(room_id, group_id)
    if (!group) {
      throw "Cannot find a group after member removal."
    }
    return { ok: true, leftGroup: group }
  }
}
