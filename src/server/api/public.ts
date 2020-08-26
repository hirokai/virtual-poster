import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import { UserId } from "@/../@types/types"
import { verifyIdToken } from "../auth"

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
        if (r.user_id) {
          return "Admin account was made: " + email + "\n"
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
    async (
      req
    ): Promise<{
      ok: boolean
      error?: string
      user_id?: UserId
      admin?: boolean
      public_key?: string
      debug_token?: string
    }> => {
      fastify.log.info("/id_token")
      const token: string = req.body.token || ""
      // log.debug("/id_token invoked")
      if (token == "") {
        //For debug_as
        return { ok: false }
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
            user_id: req.query.debug_as,
            admin: typ == "admin",
          }
        } else {
          return { ok: false, error: "User ID (for debug_as) not found" }
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
          error: "Invalid token" + (error ? ": " + error : ""),
        }
      }
      const email = decodedToken.email
      fastify.log.info("/api/id_token", email)
      if (email) {
        const user_id = await model.people.getUserIdFromEmail(email)
        if (user_id) {
          const typ = await model.people.getUserType(user_id)
          await model.people.saveJWT(email, token, decodedToken)
          const rows = await model.db.query(
            `SELECT public_key FROM public_key WHERE person=$1`,
            [user_id]
          )
          const public_key: string | undefined =
            rows.length == 1 ? rows[0].public_key : undefined
          if (typ == "admin") {
            return {
              ok: true,
              user_id,
              admin: true,
              public_key,
              debug_token: process.env.DEBUG_TOKEN,
            }
          } else {
            return { ok: true, user_id, admin: false }
          }
        } else {
          return { ok: false, error: "User email was not found" }
        }
      } else {
        return {
          ok: false,
          error: "No email was found in the decoded token",
        }
      }
    }
  )
}

export default public_api_routes
