import * as model from "./model"
import { FastifyInstance, FastifyRequest } from "fastify"
import _ from "lodash"
import * as bunyan from "bunyan"
import { protectedRoute } from "./auth"
import { emit } from "./socket"
import jsbn from "jsbn"

import { config } from "./config"

const DEBUG_LOG = config.api_server.debug_log

const latency_log = bunyan.createLogger({
  name: "latency_log",
  level: DEBUG_LOG ? 1 : "warn",
  streams: [
    {
      level: 1,
      path: "./db/latency_report.log",
    },
  ],
})

import * as BlindSignature from "blind-signatures"
const BigInteger = jsbn.BigInteger

// Alice wants Bob to sign a message without revealing it's contents.
// Bob can later verify he did sign the message

// Bob2.key.importKey(JSON.parse(fs.readFileSync('./db/blindsing_private.pem','utf-8'))
const Bob: {
  key: any
  blinded: string | null
  unblinded: string | null
  message: string | null
} = {
  key: BlindSignature.keyGeneration({ b: 128 }), // b: key-length
  blinded: null,
  unblinded: null,
  message: null,
}

// console.log("Blind key pair generated", Bob.key.exportKey("pkcs8-public"))
// console.log("Blind key pair generated", Bob.key.exportKey("pkcs8-private"))

// const Bob2 = {
//   key: BlindSignature.keyGeneration({ b: 2048 }),
//   blinded: null,
//   unblinded: null,
//   message: null,
// }

/*
Bob.key.importKey(
  fs.readFileSync("./db/blindsign_public_key.pem", "utf-8"),
  "pkcs8-public"
)
Bob.key.importKey(
  fs.readFileSync("./db/blindsign_private_key.pem", "utf-8"),
  "pkcs8-private"
)
*/

async function protected_api_routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.decorateRequest("requester", "")

  fastify.addHook("preHandler", protectedRoute)

  fastify.post<any, any>(
    "/latency_report",
    async (req: FastifyRequest<any, any, any>) => {
      const logs: {
        url: string
        method?: string
        latency: number
        timestamp: number
      }[] = req.body
      const ip = (req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        undefined) as string | undefined
      for (const l of logs) {
        latency_log.info(JSON.stringify({ ...l, ip, user: req["requester"] }))
      }
      return { ok: true }
    }
  )

  fastify.get<any>("/public_key", async req => {
    const rows = await model.db.query(
      `SELECT public_key FROM public_key WHERE person=$1`,
      [req["requester"]]
    )
    const public_key: string | undefined =
      rows.length == 1 ? rows[0].public_key : undefined
    return { ok: !!public_key, public_key }
  })

  fastify.post<any>("/public_key", async req => {
    const public_key = req.body.key as string
    const r = req.body.force
      ? await model.db.query(
          `INSERT INTO public_key (public_key,person) values ($1,$2) ON CONFLICT ON CONSTRAINT public_key_pkey DO UPDATE SET public_key=$1;`,
          [public_key, req["requester"]]
        )
      : await model.db
          .query(`INSERT INTO public_key (public_key,person) values ($1,$2);`, [
            public_key,
            req["requester"],
          ])
          .catch(() => null)
    const ok = r != null
    if (ok && req["requester"]) {
      const p = await model.people.get(req["requester"])
      if (p) {
        const all_rooms = Object.keys(model.maps)
        emit
          .channels(all_rooms)
          .peopleUpdate([
            { public_key, id: req["requester"], last_updated: Date.now() },
          ])
      }
    }
    return { ok, error: r != null ? "Exists" : undefined }
  })

  fastify.get("/blind_sign/key_pair", async () => {
    return {
      N: Bob.key.keyPair.n.toString(),
      E: Bob.key.keyPair.e.toString(),
    }
  })

  fastify.post<any>("/blind_sign/sign", async req => {
    const rows = await model.db.query(
      `SELECT person FROM vote WHERE person=$1;`,
      [req["requester"]]
    )
    const obtained = rows.length >= 1
    if (obtained) {
      return { ok: false, error: "Already signed." }
    }
    // Alice sends blinded to Bob
    const blinded = new BigInteger(req.body.blinded)
    const signed = BlindSignature.sign({
      blinded,
      key: Bob.key,
    }) // Bob signs blinded message

    console.log("signed", signed)
    await model.db.query(
      `INSERT INTO vote (person,blinded_signature) values ($1,$2);`,
      [req["requester"], req.body.blinded]
    )
    return { ok: true, signed: signed.toString() }
  })

  fastify.get<any>("/blind_sign/verify", async req => {
    // Alice sends Bob unblinded signature and original message
    const unblinded = req.query.unblinded
    const message = req.query.message
    // Bob verifies
    const result2 = BlindSignature.verify2({
      unblinded: new BigInteger(unblinded),
      key: Bob.key,
      message: message,
    })
    if (result2) {
      console.log("Bob: Signatures verify!")
    } else {
      console.log("Bob: Invalid signature")
    }
    return { ok: result2 }
  })
}

export default protected_api_routes
