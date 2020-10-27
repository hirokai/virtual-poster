import _ from "lodash"
import AWS from "aws-sdk"
import fs from "fs"
import shortid from "shortid"
import { Poster, RoomId, UserId, PosterId } from "../../@types/types"
import { log, db, people, redis } from "./index"
import { config } from "../config"
import { isAdjacent } from "../../common/util"
import { promisify } from "util"
const readFileAsync = promisify(fs.readFile)
import { spawn } from "child_process"
const writeFileAsync = promisify(fs.writeFile)
const deleteFile = promisify(fs.unlink)
const existsAsync = promisify(fs.exists)
import path from "path"

const CLOUDFRONT_ID = config.aws.cloud_front.id
const AWS_REGION = config.aws.region
const AWS_ACCESS_KEY_ID = config.aws.access_key_id
const AWS_SECRET_ACCESS_KEY = config.aws.secret_access_key
const S3_BUCKET = config.aws.s3.bucket

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
})

const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  signatureVersion: "v4",
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
})

const cloudfront = new AWS.CloudFront({
  apiVersion: "2017-03-25",
})

export async function get(poster_id: PosterId): Promise<Poster | null> {
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
  const file_url = config.aws.s3.upload
    ? "not_disclosed"
    : "/api/posters/" + d["id"] + "/file"
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
  return rows.map(d => {
    const file_url = config.aws.s3.upload
      ? "not_disclosed"
      : "/api/posters/" + d["id"] + "/file"
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

// https://qiita.com/Kazunori-Kimura/items/11882e4f7497e1e59e84
function getSignedUrlAsync(
  keypairId: string,
  privateKey: string,
  options: any
): Promise<string> {
  return new Promise((resolve, reject) => {
    const signer = new AWS.CloudFront.Signer(keypairId, privateKey)
    signer.getSignedUrl(options, (err, url) => {
      if (err) {
        reject(err)
      }
      resolve(url)
    })
  })
}

export async function get_signed_url(
  poster_id: PosterId
): Promise<string | null> {
  const keyPairId = config.aws.cloud_front.key_pair_id
  const privateKey = await readFileAsync(
    config.aws.cloud_front.private_key,
    "utf-8"
  )
  const image_url = await getSignedUrlAsync(keyPairId, privateKey, {
    url: "https://" + config.domain + "/files/" + poster_id + ".png",
    expires: Math.floor(Date.now() / 1000) + 60,
  }).catch(err => {
    log.error(err)
    return null
  })
  return image_url
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
  image_url?: string
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
    let image_url: string | undefined = undefined
    if (config.aws.s3.upload) {
      image_url = (await get_signed_url(poster.id)) || undefined
    }

    return { ok: true, joined_time, image_allowed, image_url }
  } catch (e) {
    log.error(e)
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
    log.error(e)
    return { ok: false, error: "DB error" }
  }
}

export async function isViewing(
  user_id: UserId,
  poster_id: PosterId
): Promise<{ viewing?: boolean; error?: string }> {
  log.debug("isViewing()", user_id, poster_id)
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
    log.error(e)
    return { error: "DB error" }
  }
}

export async function getViewingPoster(
  user_id: UserId,
  room_id: RoomId
): Promise<{ poster_id?: PosterId; error?: string }> {
  try {
    const rows = await db.query(
      `SELECT poster FROM poster_viewer WHERE person=$1 AND poster IN (SELECT id FROM poster WHERE location IN (SELECT id FROM map_cell WHERE room=$2 AND kind='poster')) AND left_time IS NULL;`,
      [user_id, room_id]
    )
    return { poster_id: rows[0] ? rows[0].poster : undefined }
  } catch (e) {
    log.error(e)
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

async function uploadFileToS3(file_path: string): Promise<string> {
  if (!config.aws.s3.bucket) {
    throw "S3 bucket not set"
  }
  const key = "files/" + path.basename(file_path)
  const invalidate_items = ["/" + key]

  if (config.aws.cloud_front.id && config.aws.s3.via_cdn) {
    const params = {
      DistributionId: config.aws.cloud_front.id,
      InvalidationBatch: {
        CallerReference: String(new Date().getTime()),
        Paths: {
          Quantity: invalidate_items.length,
          Items: invalidate_items,
        },
      },
    }
    const data1 = await cloudfront.createInvalidation(params).promise()
    log.debug(data1)
  }

  // call S3 to retrieve upload file to specified bucket

  // Configure the file stream and obtain the upload parameters
  const fileStream = fs.createReadStream(file_path)
  fileStream.on("error", function(err) {
    log.error("File Error", err)
  })

  const uploadParams = {
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileStream,
    ACL: "private",
  }

  // call S3 to retrieve upload file to specified bucket
  const data = await s3.upload(uploadParams).promise()
  log.info("Uploaded:", data)
  return data.Location
}

export async function updatePosterFile(
  poster: Poster,
  file: any
): Promise<{ ok: boolean; error?: string }> {
  const data = file.buffer
  if (file.mimetype == "image/png") {
    const out_path = "db/posters/" + poster.id + ".png"
    await writeFileAsync(out_path, data)
    await set(poster)
    if (config.aws.s3.upload && config.aws.s3.bucket) {
      const _s3_url = await uploadFileToS3(out_path)
      await deleteFile(out_path)
    }
    return { ok: true }
  } else {
    const filename = "db/posters/tmp-" + shortid.generate() + ".pdf"
    await writeFileAsync(filename, data)
    log.debug("writeFile: ", filename, data.length)

    const out_path = "db/posters/" + poster.id + ".png"
    const child = spawn("gs", [
      "-sDEVICE=png16m",
      "-dLastPage=1",
      "-r300",
      "-dGraphicsAlphaBits=4",
      "-o",
      out_path,
      filename,
    ])
    await set(poster)
    const r = await new Promise<{ ok: boolean; error?: string }>(resolve => {
      // use child.stdout.setEncoding('utf8'); if you want text chunks
      child.stdout.on("data", (chunk: Buffer) => {
        log.debug("Ghostscript stdout:", chunk.toString("utf8"))
      })
      child.on("close", code => {
        fs.unlink(filename, () => {
          //
        })
        if (code == 0) {
          if (config.aws.s3.upload && config.aws.s3.bucket) {
            log.info("Uploading to S3.")
            uploadFileToS3(out_path)
              .then(() => {
                deleteFile(out_path)
                  .then(() => {
                    log.info("Uploaded PDF to S3 and deleted a local file.")
                  })
                  .catch(err => {
                    log.error(err)
                  })
              })
              .catch(err => {
                log.error(err)
              })
          }
          resolve({ ok: true })
        } else {
          resolve({ ok: false, error: "PDF conversion error" })
        }
      })
    })
    return r
  }
}
