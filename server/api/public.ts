import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import { UserId, PostIdTokenResponse } from "@/@types/types"
import { verifyIdToken } from "../auth"

const USER_REGISTRATION = process.env.USER_REGISTRATION == "YES"
const PRODUCTION = process.env.NODE_ENV == "production"

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
        return "Admin already exists.\n"
      } else {
        const r = await model.people.create(
          email,
          "Admin",
          "admin",
          model.people.randomAvatar(),
          ["default"]
        )
        if (r.user) {
          return "Admin account was made: " + r.user.id + "\n"
        } else {
          return r.error + "\n"
        }
      }
    } else {
      return "No email specified\n"
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
        process.env.DEBUG_TOKEN &&
        req.query.debug_token == process.env.DEBUG_TOKEN &&
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
                  debug_token:
                    typ == "admin" ? process.env.DEBUG_TOKEN : undefined,
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
                debug_token:
                  typ == "admin" ? process.env.DEBUG_TOKEN : undefined,
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
      socket_url: PRODUCTION ? "/" : "http://localhost:5000/socket.io",
    }
  })
}

export default public_api_routes
