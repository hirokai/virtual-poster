import {
  ChatCommentDecrypted,
  CommentId,
  NotificationId,
  NotificationKind,
  PosterCommentDecrypted,
  PosterId,
  RoomId,
  UserId,
} from "../../@types/types"
import _ from "lodash"
import shortid from "shortid"
import * as bunyan from "bunyan"
import { db, pgp } from "../model"
import * as model from "../model"
import { config } from "../config"
import { ChatComment } from "../../@types/types"
import { addEmailToQueue } from "../email"

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

async function mkNewCommentNotification(
  user_id: UserId,
  room_id: RoomId,
  kind:
    | "new_chat_comments"
    | "new_poster_comments"
    | "reply_chat_comments"
    | "reply_poster_comments",
  comments: CommentId[]
): Promise<NotificationId | null> {
  const nid = genNotificationId()
  const timestamp = Date.now()
  try {
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
    return nid
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
  const new_id = await mkNewCommentNotification(
    user_id,
    row["room"],
    kind,
    comments
  )
  console.log("supersedeCommentNotification", { new_id, old_id, comments })
  if (new_id) {
    await db.query(`UPDATE notification SET superseded_by=$2 WHERE id=$1`, [
      old_id,
      new_id,
    ])
  }
}

export async function processChatCommentNotifications(c: ChatComment) {
  console.log("processChatCommentNotifications", c)
  try {
    const recipients: UserId[] = c.texts.map(t => t.to)
    const are_connected = await model.people.isConnected(c.room, recipients)
    for (const [uid, connected] of _.zip(recipients, are_connected)) {
      if (uid && !connected) {
        const unread_comments_current: CommentId[] = (
          await db.query(
            `SELECT cp.comment FROM comment_to_person cp JOIN comment c ON cp.comment=c.id WHERE cp.person=$2 AND read='f' AND c.room=$1`,
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
                AND n.superseded_by IS NULL
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
          await mkNewCommentNotification(
            uid,
            c.room,
            c.reply_to ? "reply_chat_comments" : "new_chat_comments",
            unread_comments_current
          )
        }
      }
    }
  } catch (err) {
    log.error(err)
  }
}

export async function processPosterCommentNotifications(
  c: PosterCommentDecrypted
) {
  try {
    const subscribers: UserId[] = await model.posters.getSubscribers(c.poster)
    const are_connected = await model.people.isConnected(c.room, subscribers)
    for (const [uid, connected] of _.zip(subscribers, are_connected)) {
      if (uid && !connected) {
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
            WHERE
                cp.poster = $1
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
        } else {
          await mkNewCommentNotification(
            uid,
            c.room,
            c.reply_to ? "reply_poster_comments" : "new_poster_comments",
            unread_comments_current
          )
        }
      }
    }
  } catch (err) {
    log.error(err)
  }
}

export async function processCommentRead(
  user_id: UserId,
  comment_id: CommentId,
  read: boolean,
  timestamp: number
) {
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
    } catch (err) {
      log.error(err)
      await db.query("ROLLBACK")
    }
  }
}

export async function pushNotificationToEmailQueue() {
  const ts_before = Date.now() - 1000 * 10 // 10 sec for testing
  const rows1 = await db.query(
    `SELECT * FROM notification WHERE resolved_time IS NULL AND superseded_by IS NULL AND timestamp < $1 AND email_sent='f' AND app_notified='f'`,
    [ts_before]
  )
  for (const r of rows1) {
    const notification_id = r["id"]
    const user_id: UserId = r["person"]
    const room_id: RoomId = r["room"]
    const user = await model.people.get(user_id, true)
    if (!user?.email || !notification_id) {
      continue
    }
    if (["new_chat_comments", "new_poster_comments"].indexOf(r["kind"]) != -1)
      await addEmailToQueue(
        notification_id,
        user.email,
        "noreply@" + config.email.domain,
        "[バーチャルポスターセッション] 通知",
        user.name +
          " さん\n\n" +
          "新着コメントがあります。\n" +
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
