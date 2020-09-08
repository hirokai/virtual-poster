import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import { UserId, PostIdTokenResponse } from "@/@types/types"
import { verifyIdToken } from "../auth"
import { config } from "../config"

const USER_REGISTRATION = config.user_registration
const DOMAIN = config.domain
const SOCKET_URL = config.socket_url
const DEBUG_TOKEN = config.debug_token

async function public_api_routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.setSerializerCompiler(({ schema }) => {
    fastify.log.info(schema)
    return data => JSON.stringify(data)
  })

  fastify.get<any>("/init_admin", async req => {
    const email = req.query.email
    if (email) {
      const existing = (await model.people.getAdmin()) != null
      if (existing) {
        return { ok: false, error: "Admin already exists" }
      } else {
        const r = await model.people.create(
          email,
          "Admin",
          "admin",
          model.people.randomAvatar(),
          []
        )
        console.log("model.people.create", r)
        if (r.user) {
          return { ok: true, user_id: r.user.id }
        } else {
          return { ok: false, error: r.error }
        }
      }
    } else {
      return { ok: false, error: "No email specified" }
    }
  })

  fastify.post<any>(
    "/id_token",
    async (req, reply): Promise<PostIdTokenResponse> => {
      fastify.log.info("/id_token")
      const token: string = req.body.token || ""
      // log.debug("/id_token invoked")
      if (token == "") {
        //For debug_as
        return { ok: false, updated: false }
      }
      if (
        DEBUG_TOKEN &&
        req.query.debug_token == DEBUG_TOKEN &&
        req.query.debug_as
      ) {
        // log.debug("Debug as ", req.query.debug_as)
        const typ = await model.people.getUserType(req.query.debug_as as UserId)
        if (typ != null) {
          return {
            ok: true,
            updated: false,
            user_id: req.query.debug_as,
            admin: typ == "admin",
          }
        } else {
          return {
            ok: false,
            updated: false,
            error: "User ID (for debug_as) not found",
          }
        }
      }
      fastify.log.info(token)
      const { decoded: decodedToken, ok, error } = await verifyIdToken(token)
      fastify.log.info(error, decodedToken)

      if (!ok || !decodedToken) {
        fastify.log.debug(
          "/api/id_token verification failed",
          // req.path,
          req.body.debug_from
        )
        return {
          ok: false,
          updated: false,
          error: "Invalid token" + (error ? ": " + error : ""),
        }
      }
      const email = decodedToken.email
      fastify.log.info("/api/id_token", email)
      if (email) {
        const user_id = await model.people.getUserIdFromEmail(email)
        if (user_id) {
          const user = await model.people.get(user_id)
          if (!user) {
            return reply.clearCookie("virtual_poster_session_id").send({
              ok: false,
            })
          } else {
            const r = await verifyIdToken(token)
            const typ = await model.people.getUserType(user_id)

            const rows = await model.db.query(
              `SELECT public_key FROM public_key WHERE person=$1`,
              [user_id]
            )
            const public_key: string | undefined =
              rows.length == 1 ? rows[0].public_key : undefined
            if (req.body.force || !r.ok) {
              await model.people.saveJWT(email, token, decodedToken)
              const sid = await model.people.createSessionId(
                "user",
                email,
                user_id
              )
              return reply
                .setCookie("virtual_poster_session_id", sid, {
                  expires: new Date(Date.now() + 1000 * 60 * 60 * 6),
                })
                .send({
                  ok: true,
                  user_id,
                  updated: true,
                  name: user.name,
                  admin: typ == "admin",
                  public_key,
                  token_actual: token,
                  debug_token: typ == "admin" ? DEBUG_TOKEN : undefined,
                  registered: "registered",
                })
            } else {
              const curent_token = await model.people.getJWT(user_id)
              return reply.send({
                ok: true,
                user_id,
                updated: false,
                token_actual: curent_token || undefined,
                name: user.name,
                admin: typ == "admin",
                public_key,
                debug_token: typ == "admin" ? DEBUG_TOKEN : undefined,
                registered: "registered",
              })
            }
          }
        } else {
          const sid = await model.people.createSessionId(
            "pre_registration",
            email
          )
          if (decodedToken.email_verified) {
            return reply
              .setCookie("virtual_poster_session_id", sid, {
                expires: new Date(Date.now() + 1000 * 60 * 60 * 6),
              })
              .send({
                ok: false,
                error: "User email was not found on DB, but email is verified",
                registered: USER_REGISTRATION ? "can_register" : undefined,
              })
          } else {
            return reply
              .setCookie("virtual_poster_session_id", sid, {
                expires: new Date(Date.now() + 1000 * 60 * 60 * 6),
              })
              .send({
                ok: false,
                error: "User email was not found",
                registered: USER_REGISTRATION ? "should_verify" : undefined,
              })
          }
        }
      } else {
        return {
          ok: false,
          updated: false,

          error:
            "No email was found in the decoded token. This is likely to be a bug.",
        }
      }
    }
  )
  fastify.get("/socket_url", async () => {
    return {
      socket_url: SOCKET_URL
        ? SOCKET_URL
        : (config.socket_server.tls ? "https" : "http") +
          "://" +
          DOMAIN +
          ":" +
          config.socket_server.port +
          "/socket.io",
    }
  })
  if (process.env.NODE_TEST) {
    fastify.get("/is_test", async () => {
      return { ok: true }
    })
    fastify.post("/reload_data", async () => {
      await model.initData(config.postgresql)
      return { ok: true }
    })
  }
}

export default public_api_routes
