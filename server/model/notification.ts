import {
  ChatNotificationKind,
  CommentId,
  NotificationId,
  NotificationKind,
  NotificationEntry,
  NewPosterCommentNotification,
  ReplyPosterNotification,
  NewChatCommentNotification,
  ReplyChatCommentNotification,
  Person,
  Poster,
  PosterCommentDecrypted,
  PosterId,
  RoomId,
  UserId,
  NotificationEmail,
  NewPosterCommentNotificationDetail,
  NewChatCommentNotificationDetail,
  ReplyChatCommentNotificationDetail,
  ReplyPosterNotificationDetail,
} from "../../@types/types"
import _ from "lodash"
import shortid from "shortid"
import * as bunyan from "bunyan"
import { db, pgp } from "../model"
import * as model from "../model"
import { config } from "../config"
import { ChatComment } from "../../@types/types"
import { addEmailToQueue } from "../email"
import { emit } from "../socket"
import { removeUndefined } from "../../common/util"
import { NotificationWithEmail, Notification } from "../../api/@types"

const PRODUCTION = process.env.NODE_ENV == "production"

const DEBUG_LOG = config.api_server.debug_log

const log = bunyan.createLogger({
  name: "notification",
  src: !PRODUCTION,
  level: DEBUG_LOG ? 1 : bunyan.FATAL + 1,
})

export function genNotificationId(): NotificationId {
  for (;;) {
    const s = "F" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
}

export async function get(
  id: NotificationId
): Promise<NotificationEntry | null> {
  const row = await db.oneOrNone(`SELECT * FROM notification WHERE id=$1`, [id])
  if (!row) {
    return null
  }
  const n: NotificationEntry = {
    id: row.id,
    person: row.person,
    room: row.room,
    kind: row.kind,
    timestamp: row.timestamp,
  }
  return n
}

async function mkNewCommentNotification(
  user_id: UserId,
  room_id: RoomId,
  kind: ChatNotificationKind,
  comments: CommentId[],
  poster?: PosterId
): Promise<NotificationEntry | null> {
  const nid = genNotificationId()
  const timestamp = Date.now()
  try {
    if (comments.length == 0) {
      log.warn("No unread comments")
      return null
    }
    await db.query(`BEGIN`)
    await db.query(
      `INSERT INTO notification (id,person,room,"timestamp",kind) VALUES ($1,$2,$3,$4,$5)`,
      [nid, user_id, room_id, timestamp, kind]
    )
    for (const cid of comments) {
      await db.query(
        `INSERT INTO comment_for_notification ("notification","comment") VALUES ($1,$2)`,
        [nid, cid]
      )
    }

    await db.query(`COMMIT`)
    return removeUndefined({
      id: nid,
      person: user_id,
      room: room_id,
      kind,
      data: {
        poster,
        comments,
      },
      timestamp,
    })
  } catch (err) {
    log.error(err)
    await db.query(`ROLLBACK`)
    return null
  }
}

async function supersedeCommentNotification(
  user_id: UserId,
  old_id: NotificationId,
  comments: CommentId[]
) {
  const row = await db.oneOrNone(
    `SELECT kind,room FROM notification WHERE id=$1`,
    [old_id]
  )
  if (!row) {
    log.error("Notification not found: " + old_id)
    return false
  }
  const kind: NotificationKind = row["kind"]
  if (
    kind != "new_poster_comments" &&
    kind != "new_chat_comments" &&
    kind != "reply_chat_comments" &&
    kind != "reply_poster_comments"
  ) {
    log.error("Notification kind is invalid: " + old_id)
    return false
  }
  const notification = await mkNewCommentNotification(
    user_id,
    row["room"],
    kind,
    comments
  )
  console.log("supersedeCommentNotification", {
    new_id: notification?.id,
    old_id,
    comments,
  })
  if (notification) {
    emit.channel(user_id).notification([notification])
    await db.query(`UPDATE notification SET superseded_by=$2 WHERE id=$1`, [
      old_id,
      notification.id,
    ])
  }
}

export async function processChatCommentNotifications(
  c: ChatComment
): Promise<NotificationEntry[]> {
  console.log("processChatCommentNotifications", c)
  if (
    c.texts[0].encrypted == false &&
    c.texts[0].text.indexOf("\\reaction") == 0
  ) {
    // Reaction should not generate notification
    return []
  }
  const notifications: NotificationEntry[] = []
  try {
    const recipients: UserId[] = c.texts.map(t => t.to)
    const are_connected = await model.people.isConnected(c.room, recipients)
    for (const [uid, connected] of _.zip(recipients, are_connected)) {
      if (uid && uid != c.person) {
        const unread_comments_current: CommentId[] = (
          await db.query(
            `SELECT cp.comment FROM comment_to_person cp JOIN comment c ON cp.comment=c.id WHERE cp.person=$2 AND read='f' AND c.room=$1 AND (comment_encrypted NOT LIKE '\\\\reaction')`,
            [c.room, uid]
          )
        ).map(r => r.comment)
        const unread_comments_for_notification: {
          comment: CommentId
          notification: string
          room: string
        }[] = (
          await db.query(
            `
            SELECT
                ur.comment,
                n.id,
                n.room
            FROM
                comment_for_notification ur
                JOIN comment_to_person cp ON ur.comment = cp.comment
                JOIN notification n ON ur.notification = n.id
            WHERE
                cp.person = $1
                AND (n.kind = 'new_chat_comments' OR n.kind = 'reply_chat_comments')
                AND ur.read = 'f'
            ORDER BY
                n.timestamp DESC
            `,
            [uid]
          )
        ).map(r => {
          return {
            comment: r.comment,
            notification: r.id,
            room: r.room,
          }
        })
        const old_notification_id: NotificationId | undefined =
          unread_comments_for_notification[0]?.notification
        const grs = _.groupBy(unread_comments_for_notification, "notification")
        console.log({
          uid,
          unread_comments_current,
          grs,
          unread_comments_for_notification,
        })
        if (Object.keys(grs).length > 1) {
          log.warn(
            "The number of notifications for unread chat comments should be one or zero per room."
          )
        }
        const gr = old_notification_id
          ? _.groupBy(
              grs[old_notification_id].map(g => {
                return { comment: g.comment, room: g.room }
              }),
              "room"
            )[c.room]
          : undefined
        const unread_comments_notification_in_room = gr?.map(c1 => c1.comment)
        if (unread_comments_notification_in_room) {
          const diff = _.difference(
            unread_comments_current,
            unread_comments_notification_in_room
          )
          if (diff.length > 0) {
            await supersedeCommentNotification(
              uid,
              old_notification_id,
              unread_comments_current
            )
            old_notification_id
          }
        } else {
          const notification = await mkNewCommentNotification(
            uid,
            c.room,
            c.reply_to ? "reply_chat_comments" : "new_chat_comments",
            unread_comments_current
          )
          if (notification) {
            notifications.push(notification)
          }
        }
      }
    }
    return notifications
  } catch (err) {
    log.error(err)
    return []
  }
}

export async function processPosterCommentNotifications(
  c: PosterCommentDecrypted
): Promise<NotificationEntry[]> {
  const notifications: NotificationEntry[] = []
  try {
    if (c.text_decrypted.indexOf("\\reaction") == 0) {
      // Reaction should not generate notification
      return []
    }
    let parent_comment: PosterCommentDecrypted | undefined = undefined
    if (c.reply_to) {
      parent_comment =
        (await model.chat.getPosterComment(c.reply_to)) || undefined
    }
    const mentioned_users: UserId[] = await model.chat.findMentions(
      c.text_decrypted
    )
    const subscribers: UserId[] = await model.posters.getSubscribers(
      c.poster,
      parent_comment ? [parent_comment] : []
    )
    const are_connected = await model.people.isConnected(c.room, subscribers)
    for (const [uid, connected] of _.zip(subscribers, are_connected)) {
      if (uid) {
        const unread_comments_current: CommentId[] = (
          await db.query(
            `SELECT comment FROM poster_comment_read WHERE comment=$1 AND person=$2 AND read='f'`,
            [c.id, uid]
          )
        ).map(r => r.comment)
        const unread_comments_for_notification: {
          comment: CommentId
          notification: string
          poster: PosterId
        }[] = (
          await db.query(
            `
            SELECT
                ur.comment,
                n.id,
                n.room
            FROM
                comment_for_notification ur
                JOIN comment_to_poster cp ON ur.comment = cp.comment
                JOIN notification n ON ur.notification = n.id
                JOIN comment c ON c.id=cp.comment
            WHERE
                cp.poster = $1
                AND c.text NOT LIKE '\\\\reaction%'
                AND (n.kind = 'new_poster_comments' OR n.kind = 'reply_poster_comments')
                AND n.superseded_by IS NULL
            ORDER BY
                n.timestamp DESC
            `,
            [c.poster]
          )
        ).map(r => {
          return {
            comment: r.comment,
            notification: r.id,
            poster: r.poster,
          }
        })
        const old_notification_id: NotificationId | undefined =
          unread_comments_for_notification[0]?.notification
        const grs = _.groupBy(unread_comments_for_notification, "notification")
        console.log({
          unread_comments_current,
          grs,
          unread_comments_for_notification,
        })
        if (Object.keys(grs).length > 1) {
          log.warn(
            "The number of notifications for unread chat comments should be one or zero per room."
          )
        }
        const gr = old_notification_id
          ? _.groupBy(
              grs[old_notification_id].map(g => {
                return { comment: g.comment, poster: g.poster }
              }),
              "room"
            )[c.poster]
          : undefined
        const unread_comments_notification_in_poster = gr?.map(c1 => c1.comment)
        if (unread_comments_notification_in_poster) {
          const diff = _.difference(
            unread_comments_current,
            unread_comments_notification_in_poster
          )
          if (diff.length > 0) {
            await supersedeCommentNotification(
              uid,
              old_notification_id,
              unread_comments_current
            )
            old_notification_id
          }
        } else if (unread_comments_current.length > 0) {
          const notification = await mkNewCommentNotification(
            uid,
            c.room,
            c.reply_to ? "reply_poster_comments" : "new_poster_comments",
            unread_comments_current,
            c.poster
          )
          console.log("mkNewCommentNotification result", { notification })
          if (notification) {
            notifications.push(notification)
          }
        }
      }
    }
    return notifications
  } catch (err) {
    log.error(err)
    return []
  }
}

export async function processCommentRead(
  user_id: UserId,
  comment_id: CommentId,
  read: boolean,
  timestamp: number
): Promise<{ ok: boolean; removed_notification_ids?: NotificationId[] }> {
  if (read) {
    try {
      await db.query("BEGIN")

      const notification_ids: NotificationId[] = (
        await db.query(
          `UPDATE comment_for_notification SET read=$3 WHERE "comment"=$1 AND notification IN (SELECT id FROM notification WHERE person=$2) RETURNING notification`,
          [comment_id, user_id, read]
        )
      ).map(r => r.notification)
      for (const notification_id of notification_ids) {
        if (notification_id) {
          const count: number = +(
            await db.one(
              `SELECT count(*) as count FROM comment_for_notification WHERE notification=$1 AND read='f'`,
              [notification_id]
            )
          ).count
          if (count == 0) {
            await db.none(
              `UPDATE notification SET resolved_time=$2 WHERE id=$1`,
              [notification_id, timestamp]
            )
          }
        }
      }
      await db.query("COMMIT")
      return { ok: true, removed_notification_ids: notification_ids }
    } catch (err) {
      log.error(err)
      await db.query("ROLLBACK")
      return { ok: false }
    }
  }
  return { ok: true }
}

async function getPosterOfNotification(
  nid: NotificationId
): Promise<Poster | null> {
  try {
    const poster_id: PosterId | undefined = (
      await db.oneOrNone(
        `
    SELECT
        poster
    FROM
        comment_to_poster
    WHERE
        comment IN (
            SELECT
                comment
            FROM
                comment_for_notification
            WHERE
                notification = $1)
    `,
        [nid]
      )
    )?.poster
    const p = poster_id ? await model.posters.get(poster_id) : null
    return p
  } catch (err) {
    log.error("DB error", err)
    return null
  }
}

export async function pushNotificationToEmailQueue() {
  const ts_before = Date.now() - 1000 * 60 * 10 // 10 minutes
  const rows1 = await db.query(
    `SELECT * FROM notification WHERE resolved_time IS NULL AND superseded_by IS NULL AND timestamp < $1 AND email_sent='f'`,
    [ts_before]
  )
  for (const r of rows1) {
    const notification_id: NotificationId = r["id"]
    const user_id: UserId = r["person"]
    const room_id: RoomId = r["room"]
    const user = await model.people.get(user_id, true)
    if (!user?.email || !notification_id) {
      continue
    }
    const kind = r["kind"] as NotificationKind
    let poster: Poster | null = null
    let poster_author: Person | null = null
    if (
      kind == "new_poster_comments" ||
      kind == "reply_poster_comments" ||
      kind == "mention_in_poster_comment"
    ) {
      poster = await getPosterOfNotification(notification_id)
      if (poster) {
        poster_author = await model.people.get(poster.author)
      }
      if (!poster) {
        log.warn("pushNotificationToEmailQueue(): Poster null", notification_id)
      }
    }

    let body = "通知があります"
    switch (kind) {
      case "new_chat_comments":
        body = "新しいメッセージがあります。\nYou have a new message."
        break
      case "new_poster_comments":
        if (!poster || !poster_author) {
          log.error("Poster or poster author for new_poster_comments not found")
          continue
        }
        body = `ポスター（${poster_author.name}さん；ポスター番号${poster.poster_number}）に新しいコメントがあります。\nYou have a new comment on a poster.`
        break
      case "reply_chat_comments":
        body = "新しい返信があります。\nYou have a new reply."
        break
      case "reply_poster_comments":
        if (!poster || !poster_author) {
          log.error(
            "Poster or poster author for reply_poster_comments not found"
          )
          continue
        }
        body = `ポスター(${poster_author.name}さん；ポスター番号${poster.poster_number})のコメントに新しい返信があります。\nYou have a new reply on a poster.`
        break
      case "mention_in_poster_comment":
        if (!poster || !poster_author) {
          log.error(
            "Poster or poster author for mention_in_poster_comment not found"
          )
          continue
        }
        body = `${poster_author.name}さんのポスター(ポスター番号${poster.poster_number})のコメントでメンションされました。\nYou have been mentioned in a poster comment.`
        break
    }

    await addEmailToQueue(
      notification_id,
      user.email,
      "noreply@" + config.email.domain,
      "[バーチャルポスターセッション] 通知",
      user.name +
        " さん\n\n" +
        body +
        "\n\n" +
        "https://" +
        config.domain +
        "/room?room_id=" +
        room_id +
        "\n\n" +
        "バーチャルポスターセッション"
    )
    await db.none(`UPDATE notification SET email_sent='t' WHERE id=$1`, [
      notification_id,
    ])
  }
  const rows: { id: NotificationId; count: string }[] = await db.query(
    `SELECT
          n.id,
          count(cn) as count
      FROM
          notification n
          JOIN comment_for_notification cn ON n.id = cn.notification
              AND cn.read = 'f'
      WHERE
          n.superseded_by IS NULL
          AND (n.kind = 'new_chat_comments'
           OR n.kind = 'new_poster_comments'
           OR n.kind = 'reply_chat_comments'
           OR n.kind = 'reply_poster_comments')
      GROUP BY
          n.id;
      `
  )
  for (const row of rows) {
    if (+row.count == 0) {
      await db.query(`DELETE FROM notification WHERE id=$1`, [row.id])
    }
  }
}

export async function getNotificationDetailsInRoom(
  room_id: RoomId
): Promise<NotificationWithEmail[]> {
  const rows = await db.query<
    {
      notification_id: NotificationId
      person: UserId
      room: RoomId
      notification_timestamp: string
      kind: NotificationKind
      comments: CommentId[]
      reads: boolean[]
      resolved_time: number | null
      superseded_by: string | null
      id: string // Email ID
      send_from: string | null
      send_to: string
      subject: string
      body: string
      body_html: string | null
      timestamp: string
      status: "queued" | "sending" | "sent" | "failed"
      retry_count: number
    }[]
  >(
    `SELECT
        n.id as notification_id,
        n.person,
        n.room,
        n.timestamp as notification_timestamp,
        n.kind,
        n.resolved_time,
        n.superseded_by,
        array_agg(cn.comment) as comments,
        array_agg(cn.read) as reads,
        eu.*
    FROM
        notification n
        JOIN comment_for_notification cn ON n.id = cn.notification
        LEFT JOIN email_to_user eu ON n.id = eu.notification
    WHERE
        n.room = $1
    GROUP BY
        n.id,
        eu.id;
    `,
    [room_id]
  )
  console.log("getNotificationsInRoom", rows.length)
  const notifications: NotificationEntry[] = []

  const comments_table: {
    [comment_id: string]: {
      id: CommentId
      from: UserId
      kind: "person" | "poster"
      timestamp: number
      reads: { [user_id: string]: boolean }
    }
  } = {}

  const rows2 = await db.query<
    {
      id: string
      person: string
      kind: "poster" | "person"
      timestamp: string
      reads: boolean[]
      recipients: string[]
    }[]
  >(
    `SELECT
          c.id,
          c.person,
          c.kind,
          c.timestamp,
          array_agg(cp.read) AS reads,
          array_agg(cp.person) AS recipients
      FROM
          comment c
          LEFT JOIN comment_to_person cp ON c.id = cp.comment
      WHERE
          room = $1
      GROUP BY
          c.id,
          cp.comment
    `,
    [room_id]
  )

  for (const r of rows2) {
    const reads_dict = _.mapValues(
      _.keyBy(
        _.map(_.zip(r.reads, r.recipients), a => {
          return { read: a[0], recipient: a[1] }
        }),
        "recipient"
      ),
      a => a.read || false
    )
    comments_table[r.id] = {
      id: r.id,
      from: r.person,
      kind: r.kind,
      timestamp: +r.timestamp,
      reads: reads_dict,
    }
  }
  const rows3 = await db.query<
    { comment: string; person: string; read: boolean }[]
  >(
    `SELECT comment,person,read FROM poster_comment_read WHERE comment IN (SELECT id from comment where room=$1)`,
    [room_id]
  )
  for (const r of rows3) {
    if (comments_table[r.comment]) {
      comments_table[r.comment].reads[r.person] = r.read
    }
  }

  const mkInfo = (cid: CommentId, uid: UserId) => {
    const c = comments_table[cid]
    return {
      id: c.id,
      from: c.from,
      kind: c.kind,
      timestamp: c.timestamp,
      read: c.reads[uid] || false,
    }
  }

  for (const row of rows) {
    if (row.kind == "new_poster_comments") {
      const poster = await getPosterOfNotification(row.notification_id)
      if (poster) {
        const n: NewPosterCommentNotificationDetail & {
          email?: NotificationEmail
        } & {
          resolved_time?: number
          superseded_by?: NotificationId
        } = {
          id: row.notification_id,
          person: row.person,
          room: row.room,
          kind: "new_poster_comments",
          data: {
            poster: poster.id,
            comments: row.comments.map(c => mkInfo(c, row.person)),
          },
          timestamp: +row.notification_timestamp,
          resolved_time: row.resolved_time || undefined,
          superseded_by: row.superseded_by || undefined,
          email: row.id
            ? {
                status: row.status,
                subject: row.subject,
                body: row.body,
                send_to: row.send_to,
                retry_count: 0,
              }
            : undefined,
        }
        notifications.push(removeUndefined(n))
      } else {
        log.warn("No poster", row)
      }
    } else if (row.kind == "new_chat_comments") {
      const n: NewChatCommentNotificationDetail & {
        email?: NotificationEmail
      } & {
        resolved_time?: number
        superseded_by?: NotificationId
      } = {
        id: row.notification_id,
        person: row.person,
        room: row.room,
        kind: "new_chat_comments",
        data: {
          comments: row.comments.map(c => mkInfo(c, row.person)),
        },
        timestamp: +row.notification_timestamp,
        resolved_time: row.resolved_time || undefined,
        superseded_by: row.superseded_by || undefined,
        email: row.id
          ? {
              status: row.status,
              subject: row.subject,
              body: row.body,
              send_to: row.send_to,
              retry_count: 0,
            }
          : undefined,
      }
      notifications.push(removeUndefined(n))
    } else if (row.kind == "reply_chat_comments") {
      const n: ReplyChatCommentNotificationDetail & {
        email?: NotificationEmail
      } & {
        resolved_time?: number
        superseded_by?: NotificationId
      } = {
        id: row.notification_id,
        person: row.person,
        room: row.room,
        kind: "reply_chat_comments",
        data: {
          comments: row.comments.map(c => mkInfo(c, row.person)),
        },
        timestamp: +row.notification_timestamp,
        resolved_time: row.resolved_time || undefined,
        superseded_by: row.superseded_by || undefined,
        email: row.id
          ? {
              status: row.status,
              subject: row.subject,
              body: row.body,
              send_to: row.send_to,
              retry_count: 0,
            }
          : undefined,
      }
      notifications.push(removeUndefined(n))
    } else if (row.kind == "reply_poster_comments") {
      const poster = await getPosterOfNotification(row.notification_id)
      if (poster) {
        const n: ReplyPosterNotificationDetail & {
          email?: NotificationEmail
        } & {
          resolved_time?: number
          superseded_by?: NotificationId
        } = {
          id: row.notification_id,
          person: row.person,
          room: row.room,
          kind: "reply_poster_comments",
          data: {
            poster: poster.id,
            comments: row.comments.map(c => mkInfo(c, row.person)),
          },
          timestamp: +row.notification_timestamp,
          resolved_time: row.resolved_time || undefined,
          superseded_by: row.superseded_by || undefined,
          email: row.id
            ? {
                status: row.status,
                subject: row.subject,
                body: row.body,
                send_to: row.send_to,
                retry_count: 0,
              }
            : undefined,
        }
        notifications.push(removeUndefined(n))
      } else {
        log.warn("No poster for reply_poster_comments", row)
      }
    } else {
      log.warn("Not match", row)
    }
  }
  return notifications
}

export async function getNotifications(
  user_id: UserId,
  room_id: RoomId
): Promise<Notification[]> {
  const rows = await db.query<
    {
      id: NotificationId
      person: UserId
      room: RoomId
      timestamp: string
      kind: NotificationKind
      comments: CommentId[]
      reads: boolean[]
    }[]
  >(
    `SELECT
          n.id,
          n.person,
          n.room,
          n.timestamp,
          n.kind,
          array_agg(cn.comment) as comments,
          array_agg(cn.read) as reads
      FROM
          notification n
          JOIN comment_for_notification cn ON n.id = cn.notification
      WHERE
          n.person = $1
          AND n.room = $2
          AND n.resolved_time IS NULL
          AND n.superseded_by IS NULL
      GROUP BY
          n.id;
      `,
    [user_id, room_id]
  )
  const notifications: Notification[] = []
  for (const row of rows) {
    if (row.kind == "new_poster_comments") {
      const poster = await getPosterOfNotification(row.id)
      if (poster) {
        const n: NewPosterCommentNotification = {
          id: row.id,
          person: row.person,
          room: row.room,
          kind: "new_poster_comments",
          data: {
            comments: row.comments,
            poster: poster.id,
          },
          timestamp: +row.timestamp,
        }
        notifications.push(n)
      }
    } else if (row.kind == "new_chat_comments") {
      const n: NewChatCommentNotification = {
        id: row.id,
        person: row.person,
        room: row.room,
        kind: "new_chat_comments",
        data: {
          comments: row.comments,
        },
        timestamp: +row.timestamp,
      }
      notifications.push(n)
    } else if (row.kind == "reply_chat_comments") {
      const n: ReplyChatCommentNotification = {
        id: row.id,
        person: row.person,
        room: row.room,
        kind: "reply_chat_comments",
        data: {
          comments: row.comments,
        },
        timestamp: +row.timestamp,
      }
      notifications.push(n)
    } else if (row.kind == "reply_poster_comments") {
      const poster = await getPosterOfNotification(row.id)
      if (poster) {
        const n: ReplyPosterNotification = {
          id: row.id,
          person: row.person,
          room: row.room,
          kind: "reply_poster_comments",
          data: {
            poster: poster.id,
            comments: row.comments,
          },
          timestamp: +row.timestamp,
        }
        notifications.push(n)
      }
    }
  }

  return notifications
}

export async function getNotificationsOld(
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
      kind: "new_poster_comments",
      data: {
        comments: row.comments,
        poster: row.poster,
      },
      timestamp: +row.max_timestamp,
    } as NewPosterCommentNotification
  })
}

export async function forceRemoveNotification(
  user_id: UserId,
  room_id: RoomId,
  notification_id: NotificationId
): Promise<{ ok: boolean; error?: string }> {
  const timestamp = Date.now()
  await db.query(
    `UPDATE notification SET resolved_time=$1 WHERE id=$2 AND person=$3 AND room=$4`,
    [timestamp, notification_id, user_id, room_id]
  )
  await db.query(
    `UPDATE comment_for_notification SET read='t' WHERE notification=$1`,
    [notification_id]
  )
  return { ok: true }
}
