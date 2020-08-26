import { FastifyRequest, FastifyReply } from "fastify"
import { promisify } from "util"
import * as model from "./model"
import * as admin from "firebase-admin"
import * as jwt from "jsonwebtoken"
import axios from "axios"

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

export async function verifyIdToken(
  token: string
): Promise<{
  ok: boolean
  decoded?: admin.auth.DecodedIdToken
  error?: string
}> {
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
    if (decoded.aud != "coi-conf") {
      throw "aud is invalid"
    }
    if (decoded.iss != "https://securetoken.google.com/coi-conf") {
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
    })) as admin.auth.DecodedIdToken
    return { ok: false, error: err, decoded: decoded2 }
  }
}

export async function protectedRoute(
  req: FastifyRequest<any, any>,
  reply: FastifyReply
): Promise<void> {
  // your logic
  // req.log.info(req.headers)
  const token: string | undefined = req.headers["authorization"]
    ? req.headers["authorization"].split(" ")[1]
    : req.query["access_token"]
  const _ip = (req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    undefined) as string | undefined

  // if (cluster.worker) {
  //   log.info(ip, req.path, "Worker #" + cluster.worker.id)
  // } else {
  //   log.info(ip, req.path)
  // }
  req.log.info("Token: ", token || "(Not found)")
  if (
    process.env.DEBUG_TOKEN &&
    req.query.debug_token == process.env.DEBUG_TOKEN &&
    req.query.debug_as
  ) {
    const user_id = req.query.debug_as as string
    req["requester"] = user_id
    const typ = model.people.getUserType(user_id)
    req.log.debug(typ)
    if (typ) {
      req["requester_type"] = typ
    } else {
      await reply.status(403).send("No user found")
    }
    return
  }
  if (!token) {
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
