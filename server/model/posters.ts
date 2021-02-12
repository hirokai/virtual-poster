import _, { reject } from "lodash"
import axios from "axios"
import AWS from "aws-sdk"
import fs from "fs"
import shortid from "shortid"
import { Poster, RoomId, UserId, PosterId } from "../../@types/types"
import { log, db, people, redis } from "./index"
import { config } from "../config"
import { isAdjacent, removeUndefined } from "../../common/util"
import { promisify } from "util"
const readFileAsync = promisify(fs.readFile)
import { ChildProcessWithoutNullStreams, spawn } from "child_process"
const writeFileAsync = promisify(fs.writeFile)
const deleteFile = promisify(fs.unlink)
const copyFileAsync = promisify(fs.copyFile)
const statAsync = promisify(fs.stat)
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
  const rows = await db.query(
    `SELECT
          p.*,
          c.room,
          c.x,
          c.y,
          c.poster_number,
          c.custom_image
      FROM
          poster AS p
          JOIN map_cell AS c ON p.location = c.id
      WHERE
          p.id = $1;`,
    [poster_id]
  )
  const d = rows[0]
  if (!d) {
    return null
  }
  log.debug("poster.get", d)
  d.last_updated = parseInt(d.last_updated)
  const file_url = d.file_uploaded
    ? config.aws.s3.upload
      ? "not_disclosed"
      : "/api/posters/" + d["id"] + "/file"
    : undefined
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
    file_size: d.file_size,
    access_log: d.access_log,
    author_online_only: d.author_online_only,
    poster_number: d.poster_number,
    watermark: d.watermark == null ? undefined : d.watermark,
  }
}

export async function getByNumber(
  room_id: RoomId,
  num: string
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

export async function set(
  poster: Poster,
  file_size?: number
): Promise<boolean> {
  const file_uploaded = file_size != undefined
  log.debug("poster.set", poster)
  if (file_uploaded) {
    await db.query(
      `UPDATE
            poster
        SET
            LOCATION = $1,
            title = $2,
            author = $3,
            last_updated = $4,
            access_log = $5,
            author_online_only = $6,
            file_uploaded = $8,
            file_size = $9,
            watermark = $10
        WHERE
            id = $7;
  `,
      [
        poster.location,
        poster.title,
        poster.author,
        poster.last_updated,
        poster.access_log,
        poster.author_online_only,
        poster.id,
        file_uploaded,
        file_size,
        poster.watermark,
      ]
    )
  } else {
    await db.query(
      `UPDATE
            poster
        SET
            LOCATION = $1,
            title = $2,
            author = $3,
            last_updated = $4,
            access_log = $5,
            author_online_only = $6,
            file_size = $8,
            watermark = $9
        WHERE
            id = $7;`,
      [
        poster.location,
        poster.title,
        poster.author,
        poster.last_updated,
        poster.access_log,
        poster.author_online_only,
        poster.id,
        file_size,
        poster.watermark,
      ]
    )
  }
  return true
}

export async function deletePoster(poster_id: string): Promise<boolean> {
  await db.query(`DELETE from poster where id=$1;`, [poster_id])
  return true
}

export async function getAll(
  room_id: RoomId | null,
  requester?: UserId
): Promise<Poster[]> {
  const rows = await (room_id
    ? db.query(
        `SELECT
              p.*,
              c.room,
              c.x,
              c.y,
              c.poster_number,
              c.custom_image
          FROM
              poster AS p
              JOIN map_cell AS c ON p.location = c.id
          WHERE
              LOCATION IN (
                  SELECT
                      id
                  FROM
                      map_cell
                  WHERE
                      room = $1);
    `,
        [room_id]
      )
    : db.query(
        `SELECT
              p.*,
              c.room,
              c.x,
              c.y,
              c.poster_number,
              c.custom_image
          FROM
              poster AS p
              JOIN map_cell AS c ON p.location = c.id;`
      ))

  const viewed_posters: Set<PosterId> =
    room_id && requester
      ? new Set(
          (
            await db.query(
              `
      SELECT
        poster
      FROM
          poster_viewer
      WHERE
          person = $1
          AND poster IN (
              SELECT
                  id
              FROM
                  poster
              WHERE
                  LOCATION IN (
                      SELECT
                          id
                      FROM
                          map_cell
                      WHERE
                          room = $2));
  `,
              [requester, room_id]
            )
          ).map(r => r.poster)
        )
      : new Set()
  const parse = (
    s: string,
    typ: "boolean" | "string" | "integer" | "float"
  ) => {
    if (typ == "string") {
      return s
    } else if (typ == "boolean") {
      return s == "t" || s == "true"
    } else if (typ == "integer") {
      const v = parseInt(s)
      return isNaN(v) ? null : v
    } else if (typ == "float") {
      const v = parseFloat(s)
      return isNaN(v) ? null : v
    }
    return null
  }
  return rows.map(d => {
    const file_url = d.file_uploaded
      ? config.aws.s3.upload
        ? "not_disclosed"
        : "/api/posters/" + d["id"] + "/file"
      : undefined

    let metadata: { [index: string]: number | string | boolean } | undefined
    for (const i of [1, 2, 3, 4, 5]) {
      const key_k = "attr" + i + "_key"
      const key_v = "attr" + i + "_val"
      if (d[key_k]) {
        const key = d[key_k].split(":")[0]
        const typ = d[key_k].split(":")[1]
        const p = parse(d[key_v], typ)
        if (p) {
          if (!metadata) {
            metadata = {}
          }
          metadata[key] = p
        }
      }
    }
    console.log({ metadata })
    return removeUndefined({
      id: d.id,
      title: d.title,
      author: d.author,
      room: d.room,
      x: d.x,
      y: d.y,
      last_updated: +d.last_updated,
      location: d.location,
      file_url,
      file_size: d.file_size,
      access_log: d.access_log,
      author_online_only: d.author_online_only,
      poster_number: d.poster_number,
      watermark: d.watermark,
      viewed: viewed_posters.has(d.id),
      metadata,
    })
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

export async function getAllOfUser(user_id: UserId): Promise<Poster[] | null> {
  const posters = await getAll(null)
  return _.filter(posters, p => p.author == user_id) || null
}

// https://qiita.com/Kazunori-Kimura/items/11882e4f7497e1e59e84
function getSignedUrlAsync(
  keypairId: string,
  privateKey: string,
  options: { path: string; expires: number },
  target: "cloudfront" | "s3" | "s3_put"
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (target == "s3" || target == "s3_put") {
      s3.getSignedUrl(
        target == "s3_put" ? "putObject" : "getObject",
        {
          Bucket: S3_BUCKET,
          Key: options.path,
          Expires: options.expires,
        },
        (err, url) => {
          if (err) {
            reject(err)
          } else {
            resolve(url)
          }
        }
      )
    } else {
      const url = "https://" + config.domain + options.path
      const signer = new AWS.CloudFront.Signer(keypairId, privateKey)
      signer.getSignedUrl({ url, expires: options.expires }, (err, url) => {
        if (err) {
          reject(err)
        } else {
          resolve(url)
        }
      })
    }
  })
}

export async function get_signed_url(
  poster_id: PosterId,
  source: "cloudfront" | "s3"
): Promise<{ url: string; file_size: number } | null> {
  try {
    const headCode = await s3
      .headObject({
        Bucket: config.aws.s3.bucket,
        Key: `files/${poster_id}.png`,
      })
      .promise()
    log.debug({ headCode })
    const file_size = headCode.ContentLength
    if (source == "cloudfront") {
      const keyPairId = config.aws.cloud_front.key_pair_id
      const privateKey = await readFileAsync(
        config.aws.cloud_front.private_key,
        "utf-8"
      )
      const image_url = await getSignedUrlAsync(
        keyPairId,
        privateKey,
        {
          path: "/files/" + poster_id + ".png",
          expires: Math.floor(Date.now() / 1000) + 60,
        },
        "cloudfront"
      ).catch(err => {
        log.error(err)
        return null
      })
      return image_url && file_size ? { url: image_url, file_size } : null
    } else {
      const image_url = await getSignedUrlAsync(
        "",
        "",
        {
          path: "files/" + poster_id + ".png",
          expires: 60,
        },
        "s3"
      ).catch(err => {
        log.error(err)
        return null
      })
      return image_url && file_size ? { url: image_url, file_size } : null
    }
  } catch (err) {
    log.debug({ err })
    // if (err.code == "NotFound") {
    return null
    // }
  }
}

export async function get_signed_url_for_upload(
  poster_id: PosterId,
  mime_type: string
): Promise<string | null> {
  try {
    const ext: string | undefined = {
      "image/png": "png",
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
    }[mime_type]
    if (!ext) {
      return null
    }
    const image_url = await getSignedUrlAsync(
      "",
      "",
      {
        path: "files/" + poster_id + "." + ext,
        expires: 60, // 1 minute
      },
      "s3_put"
    ).catch(err => {
      log.error(err)
      return null
    })
    return image_url
  } catch (err) {
    log.debug({ err })
    // if (err.code == "NotFound") {
    return null
    // }
  }
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
      const r =
        (await get_signed_url(
          poster.id,
          config.aws.s3.via_cdn ? "cloudfront" : "s3"
        )) || undefined
      image_url = r ? r.url : undefined
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

async function uploadFileToS3(file_path: string, key: string): Promise<string> {
  if (!config.aws.s3.bucket) {
    throw "S3 bucket not set"
  }
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
  console.log("Uploaded:", data)
  return data.Location
}

async function waitForChild(child: ChildProcessWithoutNullStreams) {
  return new Promise<number>((resolve, reject) => {
    // use child.stdout.setEncoding('utf8'); if you want text chunks
    child.stdout.on("data", (chunk: Buffer) => {
      log.debug("Child process stdout:", chunk.toString("utf8"))
    })
    child.on("close", code => {
      resolve(code)
    })
    child.on("error", err => {
      log.error(err)
      reject(err)
    })
  })
}

export async function updatePosterFile(
  poster: Poster,
  file: any
): Promise<{ ok: boolean; error?: string }> {
  const data = file.buffer
  let file_size: number
  if (file.mimetype == "image/png") {
    const out_path = "db/posters/" + poster.id + ".png"
    await writeFileAsync(out_path, data)
    try {
      file_size = (await statAsync(out_path)).size
    } catch (err) {
      log.error(err)
      return { ok: false }
    }
    await set(poster, file_size)
    if (config.aws.s3.upload && config.aws.s3.bucket) {
      const key = `files/${poster.id}.png`
      const _s3_url = await uploadFileToS3(out_path, key)
      await deleteFile(out_path)
    }
    return { ok: true }
  } else {
    const filename = "db/posters/tmp-" + shortid.generate() + ".pdf"
    await writeFileAsync(filename, data)
    log.debug("writeFile: ", filename, data.length)

    const out_path1 = "db/posters/" + poster.id + ".tmp.png"
    const out_path = "db/posters/" + poster.id + ".png"
    const child = spawn("gs", [
      "-sDEVICE=png16m",
      "-dLastPage=1",
      "-r300",
      "-dGraphicsAlphaBits=4",
      "-o",
      out_path1,
      filename,
    ])
    const code = await waitForChild(child).catch(() => -1)
    await deleteFile(filename)
    if (code != 0) {
      return { ok: false, error: "PDF conversion error" }
    }
    const child2 = spawn("magick", [
      "convert",
      "-resize",
      "6237000@>", //  = 2100*2970
      out_path1,
      out_path,
    ])
    const code2 = await waitForChild(child2).catch(err => {
      log.error(err)
      return -1
    })
    log.debug("imagemagick result", code2)
    if (code2 != 0) {
      // await set(poster)
      // return { ok: true } // PNG file reduction is not necessary, so NO error
      // return { ok: false, error: "PNG file reduction error" }
    } else {
      await deleteFile(out_path1)
    }
    const file_to_upload = code2 == 0 ? out_path : out_path1
    try {
      file_size = (await statAsync(file_to_upload)).size
    } catch (err) {
      log.error(err)
      return { ok: false }
    }
    await set(poster, file_size)
    if (config.aws.s3.upload && config.aws.s3.bucket) {
      log.info("Uploading to S3.")
      try {
        const key = "files/" + poster.id + ".png"
        await uploadFileToS3(file_to_upload, key)
        await deleteFile(file_to_upload)
        log.info("Uploaded PDF to S3 and deleted a local file.")
      } catch (err) {
        log.error(err)
        console.log(err)
        await set(poster)
      }
    } else {
      if (code2 != 0) {
        await copyFileAsync(out_path1, out_path)
        await deleteFile(out_path1)
      }
    }
    return { ok: true }
  }
}

export async function updatePosterFileFromS3(
  poster: Poster,
  mime_type: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ext: "png" | "pdf" | "jpg" | undefined = {
      "image/png": "png",
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
    }[mime_type]

    if (!ext) {
      return { ok: false, error: "MIME type invalid: " + mime_type }
    }

    const Key = "files/" + poster.id + "." + ext

    const downloaded_path = `db/posters/tmp-${
      poster.id
    }-${shortid.generate()}.${ext}`

    const file_stream = fs.createWriteStream(downloaded_path)

    console.log(`Downloading ${Key} to ${downloaded_path}, ${poster}`)

    const s3_stream = s3
      .getObject({ Bucket: S3_BUCKET, Key })
      .createReadStream()

    try {
      await new Promise<void>((resolve, reject) => {
        // Listen for errors returned by the service
        s3_stream.on("error", function(err) {
          // NoSuchKey: The specified key does not exist
          console.error(err)
          file_stream.destroy()
          reject(err)
        })

        s3_stream
          .pipe(file_stream)
          .on("error", function(err) {
            // capture any errors that occur when writing data to the file
            console.error("File Stream:", err)
            reject(err)
          })
          .on("close", function() {
            resolve()
          })
      })
    } catch (err) {
      log.error(err)
      return { ok: false, error: "Could not download a file" }
    }

    let file_to_upload = ""
    if (mime_type == "image/png") {
      const out_path = `db/posters/${poster.id}.png`
      const child_magick = spawn("magick", [
        "convert",
        "-resize",
        "6237000@>", //  = 2100*2970
        downloaded_path,
        out_path,
      ])
      const code_magick = await waitForChild(child_magick).catch(err => {
        log.error(err)
        return -1
      })
      console.log("ImageMagick result for PNG resize", code_magick)
      file_to_upload = code_magick == 0 ? out_path : downloaded_path
      if (code_magick == 0) {
        await deleteFile(downloaded_path)
      }
    } else if (mime_type == "application/pdf") {
      const png_tmp_path = `db/posters/tmp-${
        poster.id
      }-${shortid.generate()}.png`
      const child_gs = spawn("gs", [
        "-sDEVICE=png16m",
        "-dLastPage=1",
        "-r300",
        "-dGraphicsAlphaBits=4",
        "-o",
        png_tmp_path,
        downloaded_path,
      ])
      const code_gs = await waitForChild(child_gs).catch(() => -1)
      if (code_gs != 0) {
        return { ok: false, error: "PDF conversion error" }
      }
      await deleteFile(downloaded_path)
      console.log("Conversion PNG -> PDF was OK.")
      const magick_out_path = `db/posters/${poster.id}.png`
      const child_magick = spawn("magick", [
        "convert",
        "-resize",
        "6237000@>", //  = 2100*2970
        png_tmp_path,
        magick_out_path,
      ])
      const code_magick = await waitForChild(child_magick).catch(err => {
        log.error(err)
        return -1
      })
      console.log("Resizing PNG by ImageMagick: ", code_magick)
      if (code_magick == 0) {
        await deleteFile(png_tmp_path)
      }
      file_to_upload = code_magick == 0 ? magick_out_path : png_tmp_path
    }
    let file_size: number

    try {
      file_size = (await statAsync(file_to_upload)).size
    } catch (err) {
      log.error(err)
      console.log("file size fail to get", file_to_upload)
      return { ok: false, error: "Failed to get file size" }
    }
    console.log("Uploading to S3.", file_to_upload, file_size)
    try {
      const key = "files/" + poster.id + ".png"
      await uploadFileToS3(file_to_upload, key)
      await deleteFile(file_to_upload)
      console.log("Uploaded PDF to S3 and deleted a local file.", file_size)
      await set(poster, file_size)
    } catch (err) {
      log.error(err)
      console.log("Error on upload.", err)
      await set(poster)
    }
    return { ok: true }
  } catch (err) {
    console.log(err)
    return { ok: false, error: err }
  }
}

async function exists(path: string, remote: boolean) {
  if (remote) {
    const r = await axios.head(path)
    return r.status == 200
  } else {
    const r = await statAsync(path).catch(err => err.code as string)
    return r != "ENOENT"
  }
}

async function getFileSize(
  path: string,
  remote: boolean
): Promise<number | undefined> {
  if (remote) {
    const r = await axios.head(path)
    log.debug("getFileSize", r.headers)
    return r.status == 200 ? r.headers["Content-Length"] : undefined
  } else {
    try {
      const r = await statAsync(path)
      return r.size
    } catch (err) {
      if (err.code == "ENOENT") {
        return undefined
      } else {
        throw err
      }
    }
  }
}

export async function refreshFiles(
  room_id: RoomId
): Promise<{ ok: boolean; updated?: Poster[] }> {
  const poster_ids = (await getAll(room_id)).map(p => p.id)
  try {
    const updated: Poster[] = []
    for (const poster_id of poster_ids) {
      let e: boolean
      let file_size: number | undefined
      if (config.aws.s3.upload) {
        const r = await get_signed_url(
          poster_id,
          config.aws.s3.via_cdn ? "cloudfront" : "s3"
        )
        if (r) {
          // file_size = await getFileSize(r.url, true)
          file_size = r.file_size
          e = file_size != undefined
        } else {
          e = false
        }
      } else {
        const path = `db/posters/${poster_id}.png`
        file_size = await getFileSize(path, false)
        e = file_size != undefined
      }
      const row = (
        await db.query(
          `SELECT file_uploaded, file_size FROM poster WHERE id=$1`,
          [poster_id]
        )
      )[0]
      const e_old = !!row?.file_uploaded
      const file_size_old: number | undefined = row?.file_size

      const file_size2 = file_size == undefined ? null : file_size
      await db.query(
        `UPDATE poster SET file_uploaded=$1, file_size=$2 WHERE id=$3`,
        [e, file_size2, poster_id]
      )
      if (e_old != e || file_size_old != file_size) {
        const p = await get(poster_id)
        if (p) {
          updated.push(p)
        }
      }
    }
    return { ok: true, updated }
  } catch (err) {
    log.error(err)
    return { ok: false }
  }
}

export async function getSubscribers(poster_id: PosterId): Promise<UserId[]> {
  const poster = await get(poster_id)
  return poster ? [poster.author] : [] //Stub
}
