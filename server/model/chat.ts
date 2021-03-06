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
  ChatEvent,
  CommentId,
  CommentEncryptedEntry,
  PosterCommentDecrypted,
  NotificationEntry,
  NotificationId,
} from "../../@types/types"
import * as bunyan from "bunyan"
import { db, pgp } from "../model"
import * as model from "../model"
import shortid from "shortid"
import { allPointsConnected, removeUndefined } from "../../common/util"
import { config } from "../config"
import {
  processChatCommentNotifications,
  processPosterCommentNotifications,
} from "./notification"

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
      `SELECT g.*,array_agg(pcg.person) as users FROM chat_group as g join person_in_chat_group as pcg on g.id=pcg.chat WHERE id=$1 and room=$2 GROUP BY g.id`,
      [group_id, room_id]
    )
  )[0]
  return {
    ...row,
    users: row.users || [],
    color: row.color || "blue",
    last_updated: +row.last_updated,
  }
}
export async function getGroupList(
  room_id: RoomId | null
): Promise<ChatGroup[]> {
  const rows: {
    id: string
    room: string
    color: string
    users: string[]
    last_updated: string
    kind: "people" | "poster"
  }[] = await (room_id
    ? db.query(
        `SELECT g.*,array_agg(pcg.person) as users from chat_group as g join person_in_chat_group as pcg on g.id=pcg.chat WHERE g.room=$1 GROUP BY g.id`,
        [room_id]
      )
    : db.query(
        `SELECT g.*,array_agg(pcg.person) as users from chat_group as g join person_in_chat_group as pcg on g.id=pcg.chat GROUP BY g.id`
      ))
  return rows.map(r => {
    const d: ChatGroup = {
      id: r.id,
      room: r.room,
      color: r.color,
      users: r.users,
      kind: r.kind,
      last_updated: +r.last_updated,
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
    await db.query(
      `DELETE from comment_to_person where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to=$1))));`,
      [comment_id]
    )
    await db.query(
      `DELETE from comment_to_person where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to=$1)));`,
      [comment_id]
    )
    await db.query(
      `DELETE from comment_to_person where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to=$1));`,
      [comment_id]
    )
    await db.query(
      `DELETE from comment_to_person where comment in (SELECT id FROM comment WHERE reply_to=$1);`,
      [comment_id]
    )
    await db.query(`DELETE from comment_to_person where comment=$1;`, [
      comment_id,
    ])
    await db.query(
      `DELETE from comment_to_poster where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to=$1))));`,
      [comment_id]
    )
    await db.query(
      `DELETE from comment_to_poster where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to=$1)));`,
      [comment_id]
    )
    await db.query(
      `DELETE from comment_to_poster where comment in (SELECT id FROM comment WHERE reply_to in (SELECT id FROM comment WHERE reply_to=$1));`,
      [comment_id]
    )
    await db.query(
      `DELETE from comment_to_poster where comment in (SELECT id FROM comment WHERE reply_to=$1);`,
      [comment_id]
    )
    await db.query(`DELETE from comment_to_poster where comment=$1;`, [
      comment_id,
    ])
    await db.query(
      `DELETE FROM comment_for_notification
        WHERE comment IN (
                SELECT
                    id
                FROM
                    comment
                WHERE
                    reply_to IN (
                        SELECT
                            id
                        FROM
                            comment
                        WHERE
                            reply_to IN (
                                SELECT
                                    id
                                FROM
                                    comment
                                WHERE
                                    reply_to IN (
                                        SELECT
                                            id
                                        FROM
                                            comment
                                        WHERE
                                            reply_to = $1))));`,
      [comment_id]
    )
    await db.query(
      `DELETE FROM comment_for_notification
        WHERE comment IN (
                SELECT
                    id
                FROM
                    comment
                WHERE            
                    reply_to IN (
                        SELECT
                            id
                        FROM
                            comment
                        WHERE
                            reply_to IN (
                                SELECT
                                    id
                                FROM
                                    comment
                                WHERE
                                    reply_to = $1)));`,
      [comment_id]
    )
    await db.query(
      `DELETE FROM comment_for_notification
        WHERE comment IN (
                SELECT
                    id
                FROM
                    comment
                WHERE
                    reply_to IN (
                        SELECT
                            id
                        FROM
                            comment
                        WHERE
                            reply_to = $1));`,
      [comment_id]
    )
    await db.query(
      `DELETE FROM comment_for_notification
        WHERE comment IN (
                SELECT
                    id
                FROM
                    comment
                WHERE
                    reply_to = $1);`,
      [comment_id]
    )
    await db.query(
      `DELETE FROM comment_for_notification
        WHERE comment = $1;`,
      [comment_id]
    )
    await db.query(
      `DELETE from comment WHERE reply_to IN (SELECT id FROM comment WHERE reply_to IN (SELECT id FROM comment WHERE reply_to IN (SELECT id FROM comment WHERE reply_to=$1)));`,
      [comment_id]
    )
    await db.query(
      `DELETE from comment WHERE reply_to IN (SELECT id FROM comment WHERE reply_to IN (SELECT id FROM comment WHERE reply_to=$1));`,
      [comment_id]
    )
    await db.query(
      `DELETE from comment WHERE reply_to IN (SELECT id FROM comment WHERE reply_to=$1);`,
      [comment_id]
    )
    await db.query(`DELETE from comment WHERE reply_to=$1;`, [comment_id])
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
): Promise<(ChatComment | ChatEvent)[]> {
  const from_me = await db.query(
    `SELECT
          'from_me' AS mode,
          c.id AS id,
          c.person,
          c.x,
          c.y,
          array_agg(cp.encrypted) AS to_e,
          array_agg(cp.person) AS to_p,
          array_agg(cp.comment_encrypted) AS to_c,
          c.timestamp,
          c.last_updated,
          c.kind,
          c.text,
          c.room,
          c.reply_to,
          array_agg(cp.read) AS read
      FROM
          comment AS c
          LEFT JOIN comment_to_person AS cp ON c.id = cp.comment
      WHERE
          c.person = $1
          AND room = $2
          AND kind = 'person'
      GROUP BY
          c.id,
          c.x,
          c.y,
          c.text,
          c.timestamp,
          c.last_updated,
          c.person,
          c.kind,
          c.text
      ORDER BY
          c.timestamp;
      `,
    [user_id, room_id]
  )
  const to_me = await db.query(
    `SELECT
          'to_me' AS mode,
          c.id AS id,
          c.person,
          c.x,
          c.y,
          array_agg(cp2.encrypted) AS to_e,
          array_agg(cp2.person) AS to_p,
          array_agg(cp2.comment_encrypted) AS to_c,
          c.timestamp,
          c.last_updated,
          c.kind,
          c.text,
          c.room,
          c.reply_to,
          array_agg(cp.read) AS read
      FROM
          comment AS c
          LEFT JOIN comment_to_person AS cp ON c.id = cp.comment
          LEFT JOIN comment_to_person AS cp2 ON c.id = cp2.comment
      WHERE
          cp.person = $1
          AND room = $2
          AND kind = 'person'
      GROUP BY
          c.id,
          c.x,
          c.y,
          c.text,
          c.timestamp,
          c.last_updated,
          c.person,
          c.kind,
          c.text
      ORDER BY
          c.timestamp;
`,
    [user_id, room_id]
  )
  const events: ChatEvent[] = (
    await db.query(
      `
      SELECT
          e.*
      FROM
          chat_event AS e
          JOIN chat_event_recipient AS r ON e.id = r.event
      WHERE
          e.room = $1
          AND r.person = $2;
  `,
      [room_id, user_id]
    )
  ).map(
    (row): ChatEvent => {
      return {
        kind: "event",
        room: room_id,
        group: row.chat_group,
        person: row.person,
        event_type: row.event_type,
        event_data: row.event_data,
        timestamp: +row.timestamp,
      }
    }
  )
  const ds: ChatComment[] = from_me.concat(to_me).map(r => {
    const for_users: string[] = r["to_p"]
    const comments_for_users: string[] = r["to_c"]
    const encrypted_for_users: boolean[] = r["to_e"]
    const user_idx = for_users.findIndex(u => u == user_id)

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
      reply_to: r["reply_to"] || undefined,
      read: user_idx != -1 ? r["read"][user_idx] : undefined,
    }
    return r2
  })
  const ds2 = _.uniqBy(ds, "id")
  return (ds2 as (ChatComment | ChatEvent)[]).concat(events)
}

export async function getPosterComments(
  poster_id: PosterId,
  user_id: UserId
): Promise<PosterCommentDecrypted[]> {
  const rows = await db.query(
    `SELECT
          c.id AS id,
          c.person,
          c.x,
          c.y,
          array_agg(cp.poster) AS to_poster,
          c.timestamp,
          c.last_updated,
          c.kind,
          c.text,
          c.room,
          c.reply_to
      FROM
          comment AS c
          JOIN comment_to_poster AS cp ON c.id = cp.comment
      WHERE
          cp.poster = $1
      GROUP BY
          c.id,
          c.x,
          c.y,
          c.text,
          c.timestamp,
          c.last_updated,
          c.person,
          c.kind,
          c.text
      ORDER BY
          c.timestamp
      `,
    [poster_id]
  )

  const comment_ids = rows.map(r => r.id)
  const reads: { comment: CommentId; read: boolean | null }[] =
    comment_ids.length == 0
      ? []
      : (
          await db.query(
            `SELECT comment,read FROM poster_comment_read WHERE comment IN ($1:csv) AND person=$2`,
            [comment_ids, user_id]
          )
        ).map(r => {
          return { comment: r.comment, read: r.read }
        })
  const readsDict = _.keyBy(reads, "comment")
  const ds: PosterCommentDecrypted[] = rows.map(r => {
    const to_s: string[] = r["to_poster"]
    if (to_s.length != 1) {
      console.log(
        "Comment is sent to multiple posters. This should be a bug. (DB schema should be fixed at some point.)"
      )
    }
    // Assuming there is only one to_s.
    const poster = to_s[0]
    const read = readsDict[r.id]?.read
    const r2: PosterCommentDecrypted = removeUndefined({
      id: r.id,
      timestamp: parseInt(r["timestamp"]),
      last_updated: parseInt(r["last_updated"]),
      x: r.x,
      y: r.y,
      room: r.room,
      person: r.person,
      text_decrypted: r.text,
      poster,
      reply_to: r["reply_to"] || undefined,
      read: read == true ? true : read == false ? false : undefined,
    })
    return r2
  })
  return ds
}

export async function getPosterComment(
  comment_id: CommentId
): Promise<PosterCommentDecrypted | null> {
  const rows = await db.query(
    `SELECT
          c.id AS id,
          c.person,
          c.x,
          c.y,
          array_agg(cp.poster) AS to_poster,
          c.timestamp,
          c.last_updated,
          c.kind,
          c.text,
          c.room,
          c.reply_to
      FROM
          comment AS c
          JOIN comment_to_poster AS cp ON c.id = cp.comment
      WHERE
          c.id = $1
      GROUP BY
          c.id,
          c.x,
          c.y,
          c.text,
          c.timestamp,
          c.last_updated,
          c.person,
          c.kind,
          c.text
      ORDER BY
          c.timestamp
      `,
    comment_id
  )
  const d: PosterCommentDecrypted | undefined = rows.map(r => {
    const to_s: string[] = r["to_poster"]
    if (to_s.length != 1) {
      console.log(
        "Comment is sent to multiple posters. This should be a bug. (DB schema should be fixed at some point.)"
      )
    }
    // Assuming there is only one to_s.
    const poster = to_s[0]
    const r2: PosterCommentDecrypted = {
      id: r.id,
      timestamp: parseInt(r["timestamp"]),
      last_updated: parseInt(r["last_updated"]),
      x: r.x,
      y: r.y,
      room: r.room,
      person: r.person,
      poster,
      text_decrypted: r.text,
      reply_to: r["reply_to"] || undefined,
      read: true, // FIXME: 'read' should be fetched from another table.
    }
    return r2
  })[0]
  return d || null
}

export async function addPosterComment(
  c: PosterCommentDecrypted
): Promise<NotificationEntry[] | undefined> {
  log.debug(c)
  const poster = await model.posters.get(c.poster)
  if (!poster) {
    return undefined
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
      kind: "poster",
      reply_to: c.reply_to,
    }
    await db.query(pgp.helpers.insert(obj, null, "comment"))
    const s = pgp.helpers.insert(
      [{ comment: c.id, poster: c.poster }],
      ["comment", "poster"],
      "comment_to_poster"
    )
    await db.query(s)

    const subscribers: UserId[] = await model.posters.getSubscribers(
      poster.id,
      [c]
    )

    const values = subscribers
      .filter(id => id != c.person)
      .map(u => {
        return { comment: c.id, person: u, read: false }
      })
    if (values.length > 0) {
      const s2 = pgp.helpers.insert(
        values,
        ["comment", "person", "read"],
        "poster_comment_read"
      )
      await db.query(s2)
    }

    await db.query(
      `UPDATE poster_viewer SET last_active=$1 WHERE person=$2 AND poster=$3 AND left_time IS NULL;`,
      [c.last_updated, c.person, c.poster]
    )

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

    const notifications = await processPosterCommentNotifications(c)

    return notifications
  } catch (err) {
    log.error(err)
    await db.query("ROLLBACK")
    return undefined
  }
}

export async function findMentions(text: string): Promise<UserId[]> {
  const regex1 = new RegExp("@([^@\\s]+)", "g")
  let array1: RegExpExecArray | null
  const user_ids: UserId[] = []
  while ((array1 = regex1.exec(text)) !== null) {
    console.log({ array1 })
    const name = array1[1]
    const user = await model.people.getByName(name)
    if (user) {
      user_ids.push(user)
    }
  }
  log.debug("findMentions", { user_ids })
  return user_ids
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
          reply_to: c.reply_to,
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
            comment_encrypted: t.text,
            encrypted: t.encrypted,
            read: false,
          }
        }),
        ["comment", "person", "comment_encrypted", "encrypted", "read"],
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

    await processChatCommentNotifications(c)

    return true
  } catch (err) {
    log.error(err)
    await db.query("ROLLBACK")
    return false
  }
}

export async function getComment(
  comment_id: CommentId,
  user_id?: UserId // if 'read' field is needed
): Promise<ChatComment | null> {
  const from_me = await db.query(
    `SELECT
          'from_me' AS mode,
          c.id AS id,
          c.person,
          c.x,
          c.y,
          array_agg(cp.encrypted) AS to_e,
          array_agg(cp.person) AS to_p,
          array_agg(cp.comment_encrypted) AS to_c,
          c.timestamp,
          c.last_updated,
          c.kind,
          c.text,
          c.room,
          c.reply_to,
          array_agg(cp.read) AS read
      FROM
          comment AS c
          LEFT JOIN comment_to_person AS cp ON c.id = cp.comment
      WHERE
          c.id = $1
      GROUP BY
          c.id,
          c.x,
          c.y,
          c.text,
          c.timestamp,
          c.last_updated,
          c.person,
          c.kind,
          c.text
      ORDER BY
          c.timestamp
      `,
    [comment_id]
  )
  const to_me = await db.query(
    `SELECT
          'to_me' AS mode,
          c.id AS id,
          c.person,
          c.x,
          c.y,
          array_agg(cp2.encrypted) AS to_e,
          array_agg(cp2.person) AS to_p,
          array_agg(cp2.comment_encrypted) AS to_c,
          c.timestamp,
          c.last_updated,
          c.kind,
          c.text,
          c.room,
          c.reply_to,
          array_agg(cp.read) AS read
      FROM
          comment AS c
          LEFT JOIN comment_to_person AS cp ON c.id = cp.comment
          LEFT JOIN comment_to_person AS cp2 ON c.id = cp2.comment
      WHERE
          c.id = $1
      GROUP BY
          c.id,
          c.x,
          c.y,
          c.text,
          c.timestamp,
          c.last_updated,
          c.person,
          c.kind,
          c.text
      ORDER BY
          c.timestamp
      `,
    [comment_id]
  )

  const ds: ChatComment[] = from_me.concat(to_me).map(r => {
    const for_users: string[] = r["to_p"]
    const comments_for_users: string[] = r["to_c"]
    const encrypted_for_users: boolean[] = r["to_e"]
    const read: boolean[] = r["read"]

    let user_idx = -1
    if (user_id) {
      user_idx = for_users.findIndex(u => u == user_id)
    }
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
      reply_to: r["reply_to"] || undefined,
      read: user_idx != -1 ? read[user_idx] : undefined,
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
      reply_to: comment.reply_to,
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
): Promise<{ ok: boolean; comment?: PosterCommentDecrypted; error?: string }> {
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
      await db.query(
        `UPDATE poster_viewer SET last_active=$1 WHERE person=$2 AND poster=$3 AND left_time IS NULL;`,
        [last_updated, user_id, poster_id]
      )
      const uc = (await getPosterComment(comment_id)) || undefined
      return { ok: !!uc, comment: uc }
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
  if (doc.kind == "poster") {
    return {
      ok: false,
      error: "Poster comment cannot be deleted by this method.",
    }
  }
  const ok = await deleteComment(comment_id)
  return { ok, removed_to_users: doc.texts.map(t => t.to) }
}

export async function removePosterComment(
  user_id: UserId,
  poster_id: PosterId,
  comment_id: CommentId
): Promise<{
  ok: boolean
  error?: string
}> {
  const doc = await getPosterComment(comment_id)
  if (!doc) {
    return { ok: false, error: "Comment does not exist." }
  }
  if (doc.person != user_id) {
    return { ok: false, error: "User does not own comment." }
  }
  const v = await model.posters.isViewing(user_id, doc.poster)
  if (!v.viewing) {
    throw { statusCode: 400, message: "Not viewing a poster" }
  }
  await db.query(`DELETE FROM poster_comment_read WHERE comment=$1`, [
    comment_id,
  ])
  const ok = await deleteComment(comment_id)

  return { ok }
}

export function genCommentId(): CommentId {
  for (;;) {
    const s = "C" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
}

export function genChatGroupId(): ChatGroupId {
  for (;;) {
    const s = "G" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
}

export function genChatEventId(): CommentId {
  for (;;) {
    const s = "N" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
}

export async function getGroupIdOfUser(
  room_id: RoomId,
  user_id: UserId
): Promise<ChatGroupId | null> {
  // log.info("getGroupIdOfUser", room_id, user_id)
  const rows = await db.query(
    `SELECT id FROM chat_group AS g
     JOIN person_in_chat_group AS pcg ON pcg.chat=g.id
     WHERE pcg.person=$1 AND g.room=$2`,
    [user_id, room_id]
  )
  if (rows.length > 0) {
    return rows[0].id
  } else {
    return null
  }
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
  const group_id = genChatGroupId()
  const groups = _.keyBy(await getGroupList(room_id), "id")
  if (!_.every(users, u => u[0] == "U")) {
    return { ok: false }
  }
  const points_ = await model.people.getPosMulti(room_id, users)
  const points = _.compact(points_)
  if (points.length != points_.length) {
    log.error("Null position exists.")
    return { ok: false, error: "Not all people have a position" }
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
    last_updated: Date.now(),
  }
  await db.query("BEGIN")
  await db.query(
    pgp.helpers.insert(
      {
        id: group.id,
        last_updated: group.last_updated,
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

export async function startChat(
  room_id: RoomId,
  from_user: UserId,
  to_users: UserId[]
): Promise<{
  ok: boolean
  group?: ChatGroup
  error?: string
  timestamp?: number
}> {
  log.debug("startChat", room_id, from_user, to_users)
  const currentGroups = _.compact(
    await Promise.all(
      [from_user].concat(to_users).map(u => getGroupIdOfUser(room_id, u))
    )
  )
  if (currentGroups.length > 0) {
    return { ok: false, error: "Currently in chat" }
  }
  const r = await newGroup(room_id, [from_user].concat(to_users))
  if (r.ok && r.group) {
    const id = genChatEventId()
    await db.query(
      `INSERT INTO chat_event (id, room, chat_group, person, event_type, event_data, "timestamp")
          VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        id,
        room_id,
        r.group.id,
        from_user,
        "new",
        { from_user, to_users },
        r.group.last_updated,
      ]
    )
    await db.query(
      pgp.helpers.insert(
        [from_user].concat(to_users).map(u => {
          return { event: id, person: u }
        }),
        ["event", "person"],
        "chat_event_recipient"
      )
    )
  }
  return { ...r, timestamp: r.ok ? r.group?.last_updated : undefined }
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
  const timestamp = Date.now()
  await db.query(`UPDATE chat_group SET last_updated=$1 WHERE id=$2;`, [
    timestamp,
    group_id,
  ])
  const joinedGroup = (await getGroup(room_id, group_id)) || undefined
  if (joinedGroup) {
    const id = genChatEventId()
    await db.query(
      `INSERT INTO chat_event (id, room, chat_group, person, event_type, event_data, "timestamp") VALUES ($1,$2,$3,$4,$5,$6,$7);`,
      [
        id,
        room_id,
        group_id,
        from_user,
        "join",
        { from_user },
        joinedGroup.last_updated,
      ]
    )
    await db.query(
      pgp.helpers.insert(
        joinedGroup.users.map(u => {
          return { event: id, person: u }
        }),
        ["event", "person"],
        "chat_event_recipient"
      )
    )
  }
  return { ok: !!joinedGroup, joinedGroup }
}

export async function addMember(
  room_id: RoomId,
  from_user_id: UserId,
  to_user_id: UserId,
  group_id: ChatGroupId
): Promise<{ ok: boolean; error?: string; joinedGroup?: ChatGroup }> {
  // log.debug("addMember", room_id, from_user, to_user, group_id)
  try {
    const group = await model.chat.getGroupOfUser(room_id, from_user_id)
    if (!group || group.id != group_id) {
      return { ok: false, error: "Wrong Group ID" }
    }
    const positions = await model.people.getPosMulti(
      room_id,
      _.uniq(group.users.concat([from_user_id, to_user_id]))
    )
    if (!_.every(positions)) {
      return { ok: false, error: "Not all people have a position" }
    }
    if (!allPointsConnected(_.compact(positions))) {
      return { ok: false, error: "Cannot add a member at a remote site" }
    }
    await db.query(
      pgp.helpers.insert(
        { person: to_user_id, chat: group_id },
        null,
        "person_in_chat_group"
      )
    )
    const timestamp = Date.now()
    await db.query(`UPDATE chat_group SET last_updated=$1 WHERE id=$2;`, [
      timestamp,
      group_id,
    ])
    const joinedGroup = (await getGroup(room_id, group_id)) || undefined
    if (joinedGroup) {
      const id = genChatEventId()
      await db.query(
        `INSERT INTO chat_event (id, room, chat_group, person, event_type, event_data, "timestamp") VALUES ($1,$2,$3,$4,$5,$6,$7);`,
        [
          id,
          room_id,
          group_id,
          from_user_id,
          "add",
          { to_user: to_user_id, from_user: from_user_id },
          joinedGroup.last_updated,
        ]
      )
      await db.query(
        pgp.helpers.insert(
          joinedGroup.users.map(u => {
            return { event: id, person: u }
          }),
          ["event", "person"],
          "chat_event_recipient"
        )
      )
    }
    return { ok: !!joinedGroup, joinedGroup }
  } catch (err) {
    log.error(err)
    return { ok: false, error: "Add member failed" }
  }
}
export async function leaveChat(
  room_id: RoomId,
  user_id: UserId,
  by_user?: UserId //Kicked by another use
): Promise<{
  ok: boolean
  error?: string
  leftGroup?: ChatGroup
  removedGroup?: ChatGroupId
  removedGroupOldMembers?: UserId[]
  timestamp?: number
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
  const timestamp = Date.now()
  await db.query(
    `DELETE FROM person_in_chat_group WHERE person=$1 and chat=$2`,
    [user_id, group_id]
  )
  const left_users = _.difference(g1.users, [user_id])
  const online = await model.people.isConnected(room_id, left_users)
  //Only one person remains or all remained are offline.
  if (left_users.length == 1 || _.every(online, o => o == false)) {
    const ok = await deleteGroup(group_id)
    if (ok) {
      const id = genChatEventId()
      await db.query(
        `INSERT INTO chat_event (id, room, chat_group, person, event_type, "timestamp") VALUES ($1,$2,$3,$4,$5,$6);`,
        [id, room_id, group_id, by_user || user_id, "dissolve", timestamp]
      )
      await db.query(
        pgp.helpers.insert(
          g1.users.map(u => {
            return { event: id, person: u }
          }),
          ["event", "person"],
          "chat_event_recipient"
        )
      )
    }
    return {
      ok,
      removedGroup: ok ? group_id : undefined,
      removedGroupOldMembers: ok ? g1.users : undefined,
      timestamp,
    }
  } else {
    const group = await getGroup(room_id, group_id)
    if (!group) {
      throw "Cannot find a group after member removal."
    } else {
      const id = genChatEventId()
      await db.query(
        `INSERT INTO chat_event (id, room, chat_group, person, event_type, event_data, "timestamp") VALUES ($1,$2,$3,$4,$5,$6,$7);`,
        [
          id,
          room_id,
          group_id,
          by_user || user_id,
          by_user ? "kick" : "leave",
          { left_user: user_id, users: group.users },
          timestamp,
        ]
      )
      await db.query(
        pgp.helpers.insert(
          g1.users.map(u => {
            return { event: id, person: u }
          }),
          ["event", "person"],
          "chat_event_recipient"
        )
      )
      return { ok: true, leftGroup: group, timestamp }
    }
  }
}

export async function commentRead(
  user_id: UserId,
  comment_id: CommentId,
  read: boolean
): Promise<{
  ok: boolean
  removed_notification_ids?: NotificationId[]
  error?: string
}> {
  try {
    const timestamp = Date.now()
    const r = await db.result(
      `UPDATE comment_to_person SET read=$3 WHERE person=$1 AND comment=$2 AND read=$4;`,
      [user_id, comment_id, read, !read]
    )
    const r2 = await db.result(
      `UPDATE comment_to_person SET read=$3 WHERE person=$1 AND comment IN (SELECT id FROM comment WHERE reply_to=$2) AND comment_encrypted LIKE '\\\\reaction %' AND read=$4;`,
      [user_id, comment_id, read, !read]
    )
    const r3 = await db.result(
      `UPDATE poster_comment_read SET read=$3 WHERE person=$1 AND comment IN (SELECT id FROM comment WHERE id=$2 AND kind='poster') AND person=$5 AND read=$4;`,
      [user_id, comment_id, read, !read, user_id]
    )

    const {
      ok,
      removed_notification_ids,
    } = await model.notification.processCommentRead(
      user_id,
      comment_id,
      read,
      timestamp
    )

    return { ok, removed_notification_ids }
  } catch (err) {
    log.error(err)
    return { ok: false, error: "DB error" }
  }
}
