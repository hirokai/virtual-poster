import { removeUndefined } from "../common/util"
import AWS from "aws-sdk"
import bunyan from "bunyan"
import * as model from "./model"
import { config } from "./config"
import shortid from "shortid"
import { NotificationId } from "../@types/types"
const DEBUG_LOG = config.api_server.debug_log

const log = bunyan.createLogger({
  name: "email",
  level: DEBUG_LOG ? 1 : "info",
  streams: [
    {
      level: 1,
      path: "./logs/email.log",
    },
  ],
})

const AWS_ACCESS_KEY_ID = config.aws.access_key_id
const AWS_SECRET_ACCESS_KEY = config.aws.secret_access_key

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: "ap-northeast-1",
})
const ses = new AWS.SES()

function genEmailId(): string {
  for (;;) {
    const s = "M" + shortid.generate()
    if (s.indexOf("-") == -1) {
      return s
    }
  }
}

export async function addEmailToQueue(
  notification: NotificationId | null,
  to: string,
  from: string,
  subject: string,
  body: string,
  body_html?: string
) {
  const timestamp = Date.now()
  const id = genEmailId()
  await model.db.query(
    `INSERT INTO email_to_user (id, send_from, send_to, subject, body, body_html, "timestamp", "status", notification)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [
      id,
      from,
      to,
      subject,
      body,
      body_html || null,
      timestamp,
      "queued",
      notification,
    ]
  )
}

async function checkRateLimitForSystem(): Promise<"day" | "sec" | "ok"> {
  const ts_since = Date.now() - 1000
  const row: {
    count: number
  } | null = await model.db.oneOrNone(
    `SELECT count(*) as count FROM email_to_user WHERE "status"='sent' AND "timestamp">$1`,
    [ts_since]
  )
  const count = row?.count
  if (count == null || count >= config.email.max_rate_per_sec) {
    //Rate limit exceeded
    return "sec"
  }

  const ts_since2 = Date.now() - 1000 * 60 * 60 * 24
  const row2: {
    count: number
  } | null = await model.db.oneOrNone(
    `SELECT count(*) as count FROM email_to_user WHERE "status"='sent' AND "timestamp">$1`,
    [ts_since2]
  )
  const count2 = row2?.count
  if (count2 == null || count2 >= config.email.max_rate_per_day) {
    //Rate limit exceeded
    return "day"
  }

  return "ok"
}

async function checkRateLimitForUser(
  user_email: string
): Promise<"hour" | "ok"> {
  const ts_since = Date.now() - 1000 * 60 * 60
  const row: {
    count: number
  } | null = await model.db.oneOrNone(
    `SELECT
          count(*) AS count
      FROM
          email_to_user
      WHERE
          "status" = 'sent'
          AND notification IS NOT NULL
          AND send_to = $2
          AND "timestamp" > $1`,
    [ts_since, user_email]
  )
  const count = row?.count
  if (count == null || count >= config.email.max_rate_user_per_hour) {
    //Rate limit exceeded
    return "hour"
  }

  return "ok"
}

async function sendEmail(
  to: string,
  from: string,
  subject: string,
  body: string,
  body_html?: string,
  dry_run?: boolean
): Promise<{ ok: boolean; error?: string; rate_limit_error?: boolean }> {
  const limit_ok = await checkRateLimitForSystem()
  if (limit_ok != "ok") {
    return {
      ok: false,
      error: "Rate limit per " + limit_ok + " exceeded. Should wait.",
      rate_limit_error: true,
    }
  }
  const limit_ok2 = await checkRateLimitForUser(to)
  if (limit_ok2 != "ok") {
    return {
      ok: false,
      error:
        "Rate limit per " +
        limit_ok2 +
        " exceeded for the email: " +
        to +
        ". Should wait.",
      rate_limit_error: true,
    }
  }
  const params: AWS.SES.SendEmailRequest = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Text: {
          Data: body,
          Charset: "utf-8",
        },
      },
      Subject: {
        Data: subject,
        Charset: "utf-8",
      },
    },
    Source: from,
  }
  if (body_html) {
    params.Message.Body.Html = { Data: body_html, Charset: "utf-8" }
  }

  if (dry_run) {
    console.log("sendEmail dry run", params)
    return { ok: true }
  }

  try {
    const res = await ses.sendEmail(params).promise()
    const ok = !!res.MessageId
    log.info(
      removeUndefined({
        event: "sent_email",
        to,
        from,
        subject,
        body,
        body_html,
        ok,
        MessageId: res.MessageId,
      })
    )
    return { ok }
  } catch (err) {
    log.error(err as AWS.AWSError)
    log.info(
      removeUndefined({
        event: "send_email_failed",
        to,
        from,
        subject,
        body,
        body_html,
        ok: false,
      })
    )
    return { ok: false, error: (err as AWS.AWSError).message }
  }
}

const sleepAsync = (delay_millisec: number) => {
  return new Promise<void>(resolve => {
    setTimeout(() => {
      resolve()
    }, delay_millisec)
  })
}

export async function processEmailQueue(dry_run?: boolean) {
  const rows = await model.db.query(
    `SELECT
          e.*,
          n.resolved_time,
          n.superseded_by
      FROM
          email_to_user e
          LEFT JOIN notification n ON e.notification = n.id
      WHERE
          "status" = 'queued'
      ORDER BY
          "timestamp"
      LIMIT $1;
      `,
    [config.email.max_rate_per_sec]
  )
  for (const row of rows) {
    // Notification is resolved after email queue was set.
    if (row["resolved_time"] || row["superseded_by"]) {
      await model.db.query(`DELETE FROM email_to_user WHERE id=$1`, [row["id"]])
      continue
    }
    await model.db.query(
      `UPDATE email_to_user SET "status"='sending' WHERE id=$1`,
      [row["id"]]
    )
    const r = await sendEmail(
      row["send_to"],
      row["send_from"],
      row["subject"],
      row["body"],
      row["body_html"] || undefined,
      !!dry_run
    )
    console.log("sendMail result", r)
    await model.db.query(`UPDATE email_to_user SET "status"=$2 WHERE id=$1`, [
      row["id"],
      r.ok ? "sent" : r.rate_limit_error ? "queued" : "failed",
    ])
    await sleepAsync(1000 / config.email.max_rate_per_sec)
  }
}
