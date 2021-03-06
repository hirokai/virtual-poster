import { FastifyRequest, FastifyReply } from "fastify"
import { promisify } from "util"
import * as model from "./model"
import * as admin from "firebase-admin"
import * as jwt from "jsonwebtoken"
import axios from "axios"
import { config } from "./config"
import { readFileSync } from "fs"

const DEBUG_TOKEN = config.debug_token

let google_keys: { [key: string]: string } = {}

function renewFirebaseAuthKeys() {
  axios
    .get(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    )
    .then(res => {
      google_keys = res.data
    })
    .catch(err => {
      console.error(err)
    })
}

renewFirebaseAuthKeys()

setInterval(renewFirebaseAuthKeys, 1000 * 60 * 60)

const s = readFileSync("./firebaseConfig.json", "utf-8")
const firebaseProjectId: string = JSON.parse(s).projectId

if (!firebaseProjectId) {
  throw "firebaseConfig.json is invalid"
}

export async function verifyIdToken(
  token: string
): Promise<{
  ok: boolean
  decoded?: admin.auth.DecodedIdToken
  error?: string
}> {
  const firebaseProject: string = firebaseProjectId
  const decode = promisify(jwt.decode)
  try {
    let decoded: admin.auth.DecodedIdToken | null = null
    // decoded = await admin.auth().verifyIdToken(token)
    for (const key of Object.values(google_keys)) {
      try {
        decoded = jwt.verify(token, key) as admin.auth.DecodedIdToken
        break
      } catch (err) {
        //
      }
    }
    // console.log("/api/id_token decoded", decoded)

    if (!decoded) {
      return {
        ok: false,
        error: "Fail to decode",
        decoded: jwt.decode(token) as admin.auth.DecodedIdToken,
      }
    }
    if (decoded.aud != firebaseProject) {
      throw "aud is invalid"
    }
    if (decoded.iss != "https://securetoken.google.com/" + firebaseProject) {
      throw "Error"
    }
    if (decoded.exp <= Date.now() / 1000) {
      throw "exp is invalid (expired)"
    }
    if (decoded.iat >= Date.now() / 1000) {
      throw "iat is invalid (future)"
    }
    if (decoded.auth_time >= Date.now() / 1000) {
      throw "auth_time is invalid (future)"
    }
    if (decoded.sub == "") {
      throw "sub is invalid"
    }
    if (!decoded.email) {
      throw "Email is missing"
    }

    return { ok: true, decoded }
  } catch (err) {
    const decoded2 = (await decode(token, {
      complete: true,
    }).catch(() => {
      return undefined
    })) as admin.auth.DecodedIdToken | undefined
    return { ok: false, error: err, decoded: decoded2 }
  }
}

export async function protectedRoute(
  req: FastifyRequest<any, any>,
  reply: FastifyReply
): Promise<void> {
  if (
    DEBUG_TOKEN &&
    req.query.debug_token == DEBUG_TOKEN &&
    req.query.debug_as
  ) {
    const user_id = req.query.debug_as as string
    req["requester"] = user_id
    const typ = await model.people.getUserType(user_id)
    req.log.debug({ type: typ })
    if (typ) {
      req["requester_type"] = typ
    } else {
      await reply.status(403).send("No user found")
    }
    return
  }
  const cookie_session_id = req.cookies["virtual_poster_session_id"]
  const user_id = await model.redis.sessions.get(
    "cookie:uid:" + cookie_session_id
  )
  req.log.info("protectedRoute():", req.url, cookie_session_id, user_id)
  if (req.url.indexOf("/api/register") == 0) {
    const user_email = await model.redis.sessions.get(
      "cookie:email:" + cookie_session_id
    )
    req["requester_email"] = user_email
    console.log("/api/register protect", { user_email, cookie_session_id })
    if (!user_email) {
      await reply.status(403).send("No temporary registration")
    }
    return
  } else if (user_id) {
    const user_email = await model.redis.accounts.get("uid:" + user_id)
    req["requester"] = user_id
    req["requester_email"] = user_email
    const typ = await model.people.getUserType(user_id)
    if (typ) {
      req["requester_type"] = typ
    } else {
      await reply.status(403).send("No user found. This is likely a bug.")
    }
    return
  }

  const token: string | undefined = req.headers["authorization"]
    ? req.headers["authorization"].split(" ")[1]
    : req.query["access_token"]
  const _ip = (req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    undefined) as string | undefined

  req.log.info("Token: ", token || "(Not found)")

  if (!token) {
    req.log.warn({ cookie_session_id, user_id, token })
    await reply.status(403).send("No token provided.")
    return
  }

  const { decoded: decodedToken, error } = await verifyIdToken(token)
  if (error || !decodedToken) {
    // fastify.log.warn(
    //   "verifyIdToken error: ",
    //   error,

    //   decodedToken?.email
    // )
    await reply
      .status(403)
      .send({ success: false, message: "Invalid token: " + error })
    return
  }
  if (decodedToken.email) {
    const user_id = await model.people.getUserIdFromEmail(decodedToken.email)
    if (user_id) {
      req["decoded"] = decodedToken
      req["requester"] = user_id
      const typ = await model.people.getUserType(user_id)
      if (typ == null) {
        await reply.status(403).send("User not found")
      } else {
        req["requester_type"] = typ
      }
    } else {
      await reply.status(403).send({
        success: false,
        message: "Email is not registered",
        email: decodedToken.email,
      })
    }
  }
}

export const manageRoom = async (req, res) => {
  const roomId = req.params.roomId
  const map = model.maps[roomId]
  if (!map) {
    return res.status(404).send("Room not found")
  }
  if (req["requester_type"] == "admin") {
    return
  }
  const is_room_admin = await map.isUserOwnerOrAdmin(req["requester"])
  if (!is_room_admin) {
    return res.status(403).send("Not an owner or admin")
  }
}

export const roomMembers = async (req, res) => {
  const roomId = req.params.roomId
  const map = model.maps[roomId]
  if (!map) {
    return res.status(404).send("Room not found")
  }
  if (req["requester_type"] == "admin") {
    return
  }
  const is_member = !!(await model.db.oneOrNone(
    `SELECT 1 from person_room_access WHERE email=$1 AND room=$2`,
    [req["requester_email"], roomId]
  ))
  if (!is_member) {
    return res.status(403).send("You are not a member of the room")
  }
}
