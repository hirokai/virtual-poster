import * as model from "../model"
import { FastifyInstance } from "fastify"
import _ from "lodash"
import {
  RoomId,
  MapEnterResponse,
  UserId,
  Room,
  RoomUpdateSocketData,
  Cell,
  PersonUpdate,
  MinimapVisibility,
  MapUpdateEntry,
  MapUpdateSocketData,
  RoomAccessCode,
  UserGroup,
  ParsedMapData,
} from "../../@types/types"
import { protectedRoute, manageRoom, roomMembers } from "../auth"
import { emit } from "../socket"
import { config } from "../config"
import { loadCustomMapCsv, verifyMapUpdateEntries } from "../../common/maps"
import { pgp } from "../model"
import { removeUndefined } from "../../common/util"

const PRODUCTION = process.env.NODE_ENV == "production"
const RUST_WS_SERVER = config.socket_server.system == "Rust"

async function maps_api_routes(
  fastify: FastifyInstance<any, any, any, any>
): Promise<void> {
  fastify.addHook("preHandler", protectedRoute)

  fastify.get(
    "/maps",
    async (req): Promise<Room[]> => {
      const requester = req["requester"]
      const requester_email = req["requester_email"]
      const is_site_admin = req["requester_type"] == "admin"
      const rows: any[] = await model.db.query(
        `
        SELECT
            room.*,
            count(c.poster_number) as poster_location_count,
            count(poster.id) as poster_count
        FROM
            room
            LEFT JOIN map_cell as c on room.id = c.room
            LEFT JOIN poster ON c.id = poster.location
            LEFT JOIN person_room_access AS a ON room.id = a.room
        WHERE
            a.email = $1
        GROUP BY
            room.id;`,
        [requester_email]
      )
      const result: Room[] = []
      for (const r of rows) {
        const room_id = r["id"]

        const owner = r["room_owner"]
        const is_owner = owner == requester
        const numCols: number = await model.maps[room_id].numCols()
        const numRows: number = await model.maps[room_id].numRows()

        const poster_count = parseInt(r.poster_count)
        const poster_location_count = parseInt(r.poster_location_count)
        const allow_poster_assignment = r["allow_poster_assignment"]

        const page_admins: UserId[] = await model.maps[room_id].getAdmins()
        const is_page_admin = await model.maps[room_id].isUserOwnerOrAdmin(
          req["requester"]
        )

        const rows1 = await model.db.query(
          `SELECT count(*) as c FROM person_position WHERE room=$1`,
          [room_id]
        )
        const rows2 = await model.db.query(
          `SELECT count(*) as c FROM person_room_access WHERE room=$1`,
          [room_id]
        )

        const minimap_visibility = r["minimap_visibility"]

        const num_people_joined: number = +rows1[0]["c"]
        const num_people_with_access: number | undefined =
          is_site_admin || is_page_admin ? +rows2[0]["c"] : undefined

        const num_people_active = await model.redis.accounts.scard(
          "connected_users:room:" + room_id + ":__all__"
        )

        const move_log = r["move_log"] == null ? undefined : r["move_log"]

        let access_codes: RoomAccessCode[] | undefined = undefined
        let people_groups: UserGroup[] | undefined = undefined

        if (is_page_admin || is_site_admin) {
          const rows3 = await model.db.query(
            `SELECT * FROM room_access_code WHERE room=$1`,
            [room_id]
          )
          const rows4 = await model.db.query(
            `SELECT * FROM people_group WHERE room=$1`,
            [room_id]
          )

          access_codes = rows3.map((row: any) => {
            return {
              code: row["code"],
              active: row["active"],
              access_granted: row["granted_right"].split(";;"),
              timestamp: parseInt(row["timestamp"]),
            }
          })
          access_codes!.sort((a, b) => {
            return b.timestamp - a.timestamp
          })
          people_groups = rows4.map((row: any) => {
            return {
              id: row["id"],
              name: row["name"],
              description: row["description"],
            }
          })
        }

        result.push(
          removeUndefined({
            id: room_id,
            name: r["name"],
            poster_location_count,
            poster_count,
            num_people_joined,
            num_people_with_access,
            allow_poster_assignment,
            numCols,
            numRows,
            owner,
            num_people_active,
            move_log,
            minimap_visibility,
            admins: is_page_admin || is_site_admin ? page_admins : undefined,
            role: is_owner ? "owner" : is_page_admin ? "admin" : "user",
            access_codes,
            people_groups,
          })
        )
      }
      return result
    }
  )

  fastify.post<any>("/maps", async req => {
    const name: string = req.body.name
    const template: string | undefined = req.body.template
    const csv_str: string | undefined = req.body.data
    let allow_poster_assignment: boolean | undefined =
      req.body.allow_poster_assignment == undefined
        ? undefined
        : req.body.allow_poster_assignment
    let minimap_visibility: MinimapVisibility | undefined =
      req.body.minimap_visibility == undefined
        ? undefined
        : req.body.minimap_visibility
    const { map_data } = template
      ? await model.MapModel.loadTemplate(template)
      : { map_data: undefined }

    if (!map_data && !csv_str) {
      return {
        ok: false,
        error: "CSV data or valid template name has to be specified",
      }
    }
    let cells: Cell[][] = []
    let numRows = 0
    let numCols = 0
    let r: ParsedMapData | null = null
    if (csv_str) {
      r = loadCustomMapCsv(csv_str, model.MapModel.genMapCellId)
      if (r) {
        cells = r.cells
        req.log.debug(cells)
        allow_poster_assignment =
          allow_poster_assignment == undefined
            ? r.allowPosterAssignment
            : allow_poster_assignment
        minimap_visibility =
          minimap_visibility == undefined
            ? r.minimapVisibility
            : minimap_visibility
        numRows = r.numRows
        numCols = r.numCols
      }
    }
    const { map: mm, error } = await model.MapModel.mkNewRoom(
      name,
      map_data || { cells, numRows, numCols },
      allow_poster_assignment || false,
      minimap_visibility || "all_initial",
      req["requester"]
    )
    if (!mm) {
      return { ok: false, error }
    }
    if (r?.userGroups) {
      for (const g of r?.userGroups) {
        await mm.createUserGroup(g.name, g.description)
      }
    }
    if (r?.regions) {
      for (const g of r?.regions) {
        await mm.createRegion(g.name, g.rect, g.description)
      }
    }
    if (r?.permissions) {
      let order = 1
      for (const p of r?.permissions) {
        order += await mm.createRule(
          p.group_names,
          p.region_names,
          p.operation,
          p.allow,
          order
        )
      }
    }

    await model.maps[mm.room_id].addUser(
      req["requester_email"],
      req["requester"],
      true,
      "admin",
      req["requester"]
    )
    return { ok: true, room_id: mm.room_id }
  })

  fastify.put<any>("/maps/:roomId/cells", async (req, res) => {
    const roomId: string = req.params.roomId
    const map = model.maps[roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const template: string | undefined = req.body.template
    const csv_str: string | undefined = req.body.data
    const message: string | undefined = req.body.message

    const { map_data } = template
      ? await model.MapModel.loadTemplate(template)
      : { map_data: undefined }

    if (!map_data && !csv_str) {
      return {
        ok: false,
        error: "CSV data or valid template name has to be specified",
      }
    }
    let cells: Cell[][] = []
    let numRows = 0
    let numCols = 0
    if (csv_str) {
      const r = loadCustomMapCsv(csv_str, model.MapModel.genMapCellId)
      if (r) {
        cells = r.cells
        numRows = r.numRows
        numCols = r.numCols
      }
    }
    const { ok, error } = await map.replaceMapCells(
      map_data || { cells, numRows, numCols }
    )
    if (!ok) {
      return { ok: false, error }
    }
    const obj = removeUndefined({ room: roomId, message })
    emit.channel(roomId).mapReplace(obj)
    emit.channel(roomId + ":__observe__").mapReplace(obj)
    return { ok: true }
  })

  fastify.get<any>("/maps/:roomId", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }

    const is_room_admin = await map.isUserOwnerOrAdmin(req["requester"])
    const admin = req["requester_type"] != "admin" || is_room_admin

    const data: {
      id: RoomId
      numCols: number
      numRows: number
      name: string
      move_log: boolean
      allow_poster_assignment: boolean
      minimap_visibility:
        | "all_initial"
        | "map_initial"
        | "all_only_visited"
        | "map_only_visited"
      access_codes?: RoomAccessCode[]
      people_groups?: UserGroup[]
    } = await map.getMetadata(admin)
    return removeUndefined(data)
  })

  fastify.get<any>("/maps/:roomId/cells", async (req, res) => {
    const map = model.maps[req.params.roomId]
    const user_id: UserId = req["requester"]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const key = "map_cache:" + map.room_id
    const cache = await model.redis.staticMap.get(key)
    let data: {
      cells: Cell[][]
      numRows: number
      numCols: number
    }
    if (cache) {
      data = JSON.parse(cache)
      if (!data.cells) {
        data = await map.get()
        await model.redis.staticMap.set(key, JSON.stringify(data))
      }
    } else {
      data = await map.get()
      await model.redis.staticMap.set(key, JSON.stringify(data))
    }
    const cell_ids = await map.getVisitedCells(user_id)
    // console.log("cell_ids", cell_ids.size || "undef size")
    for (const row of data.cells) {
      for (const c of row) {
        // console.log(c)
        if (cell_ids.has(c.id)) {
          c.visited = "visited"
          // console.log("visited!!")
        }
      }
    }
    return data
  })

  fastify.post<any>(
    "/maps/:roomId/reset_cache",
    { preHandler: manageRoom },
    async req => {
      const map = model.maps[req.params.roomId]

      await map.clearStaticMapCache()
      return { ok: true }
    }
  )

  fastify.patch<any>("/maps/:roomId", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    const allow_poster_assignment = req.body.allow_poster_assignment as
      | boolean
      | undefined
    const minimap_visibility = req.body.minimap_visibility as
      | "all_initial"
      | "all_only_visited"
      | undefined
    let changed = false
    if (allow_poster_assignment != undefined) {
      await model.db.query(
        `UPDATE room SET allow_poster_assignment=$1 WHERE id=$2`,
        [allow_poster_assignment, map.room_id]
      )
      changed = true
    }
    if (minimap_visibility != undefined) {
      await model.db.query(
        `UPDATE room SET minimap_visibility=$1 WHERE id=$2`,
        [minimap_visibility, map.room_id]
      )
      await map.clearStaticMapCache()
      changed = true
    }
    if (changed) {
      await map.clearStaticMapCache()
      const data = await map.getMetadata()
      emit.room(data)
      return { ok: true }
    } else {
      return { ok: false, error: "Nothing has changed" }
    }
  })

  fastify.patch<any>(
    "/maps/:roomId/cells",
    { preHandler: manageRoom },
    async req => {
      const roomId: string = req.params.roomId
      const message: string | undefined = req.body.message
      const changes: MapUpdateEntry[] | null = verifyMapUpdateEntries(
        req.body.changes
      )
      if (!changes) {
        return { ok: false, error: "Data format invalid" }
      }
      const m = model.maps[roomId]
      const r = await m.updateMapCells(changes)
      if (r.ok) {
        const data: MapUpdateSocketData = {
          room: roomId,
          message,
          changes,
        }
        emit.channel(roomId).mapUpdate(data)
        return { ok: true }
      } else {
        return { ok: false }
      }
    }
  )

  fastify.delete<any>("/maps/:roomId", async (req, res) => {
    const roomId = req.params.roomId
    const m = model.maps[roomId]
    if (!m) {
      throw { statusCode: 404 }
    }

    // Only owner can delete the room
    const owner = await m.getOwner()
    if (req["requester_type"] != "admin" && owner != req["requester"]) {
      return {
        ok: false,
        error: "You are not the site admin or owner of the room.",
      }
    }

    const ok = await m.deleteRoomFromDB()
    if (ok) {
      delete model.maps[roomId]
    }
    return { ok }
  })

  fastify.post<any>(
    "/maps/:roomId/access_code",
    { preHandler: manageRoom },
    async (req, res) => {
      const map = model.maps[req.params.roomId]
      const access_granted: string[] = req.body.access_granted || []
      const active: boolean | undefined = req.body.active
      try {
        const r = await map.createAccessCode(access_granted, active)
        await map.clearStaticMapCache()
        const data = await map.getMetadata()
        emit.room(data)
        if (r) {
          return { ok: true, access_code: r }
        } else {
          return { ok: false }
        }
      } catch (e) {
        req.log.error(e)
        return { ok: false, error: "DB error" }
      }
    }
  )

  fastify.delete<any>(
    "/maps/:roomId/access_code/:accessCode",
    { preHandler: manageRoom },
    async (req, res) => {
      const map = model.maps[req.params.roomId]
      const code: string | undefined = req.params.accessCode

      try {
        const rows = await model.db.query(
          `DELETE FROM room_access_code WHERE room=$1 AND code=$2`,
          [map.room_id, code]
        )
        await map.clearStaticMapCache()
        const data = await map.getMetadata()
        emit.room(data)
        return { ok: true, deleted_code: code }
      } catch (e) {
        req.log.error(e)
        return { ok: false, error: "DB error" }
      }
    }
  )

  fastify.patch<any>(
    "/maps/:roomId/access_code/:accessCode",
    async (req, res) => {
      const map = model.maps[req.params.roomId]
      const code = req.params.accessCode
      if (!map) {
        await res.status(404).send("Not found")
        return
      }
      const active = req.body.active as boolean | undefined
      const access_granted = req.body.access_granted as string[] | undefined
      const granted_right = access_granted?.join(";;")
      const updateObj = removeUndefined({ active, granted_right })
      const q = pgp.helpers.update(updateObj, null, "room_access_code")
      await model.db.query(q + ` WHERE code=$1`, [code])
      await map.clearStaticMapCache()
      const data = await map.getMetadata()
      emit.room(data)

      return { ok: true }
    }
  )

  fastify.post<any>(
    "/maps/:roomId/access_code/:accessCode/renew",
    { preHandler: manageRoom },
    async req => {
      const map = model.maps[req.params.roomId]

      try {
        await model.db.query(`BEGIN`)
        const r1 = await model.db.query(
          `SELECT active,granted_right FROM room_access_code WHERE room=$1 AND code=$2`,
          [map.room_id, req.params.accessCode]
        )
        const active = r1[0] ? !!r1[0]?.active : true
        const access_granted: string[] = r1[0]
          ? r1[0]?.granted_right.split(";;")
          : true
        await model.db.query(
          `DELETE FROM room_access_code WHERE room=$1 AND code=$2`,
          [map.room_id, req.params.accessCode]
        )
        const r = await map.createAccessCode(access_granted, active)
        await model.db.query(`COMMIT`)
        if (r) {
          await map.clearStaticMapCache()
          const data = await map.getMetadata()
          emit.room(data)
          return { ok: true, code: r.code, active }
        } else {
          return { ok: false }
        }
      } catch (e) {
        await model.db.query(`ROLLBACK`)
        req.log.error(e)
        return { ok: false, error: "DB error" }
      }
    }
  )

  fastify.get<any>("/maps/:roomId/notifications", async (req, res) => {
    const map = model.maps[req.params.roomId]
    if (!map) {
      await res.status(404).send("Not found")
      return
    }
    return model.people.getNotifications(req["requester"], map.room_id)
  })

  fastify.post<any>("/maps/:roomId/posters/:posterId/approach", async req => {
    // console.log("APPROACH", req["requester"])
    emit
      .channel(req["requester"])
      .moveRequest({ to_poster: req.params.posterId })
    return { ok: true }
  })

  fastify.post<any>("/maps/:roomId/posters/:posterId/enter", async req => {
    const roomId = req.params.roomId
    const posterId = req.params.posterId
    const map = model.maps[roomId]
    if (!map) {
      throw { statusCode: 404, message: "Room not found" }
    }
    const r = await model.posters.startViewing(
      req["requester"],
      roomId,
      posterId
    )
    if (r.ok && r.joined_time) {
      emit.channel(roomId).peopleUpdate([
        {
          id: req["requester"] as UserId,
          last_updated: r.joined_time,
          poster_viewing: posterId,
        },
      ])
    }
    return {
      ok: r.ok,
      error: r.error,
      image_allowed: r.image_allowed,
      image_url: r.image_url,
    }
  })

  fastify.post<any>("/maps/:roomId/posters/:posterId/leave", async req => {
    const roomId = req.params.roomId
    const posterId = req.params.posterId
    const map = model.maps[roomId]
    if (!map) {
      throw { statusCode: 404, message: "Room not found" }
    }
    const r = await model.posters.endViewing(req["requester"], roomId, posterId)
    if (r.ok && r.left_time) {
      emit.channel(roomId).peopleUpdate([
        {
          id: req["requester"] as UserId,
          last_updated: r.left_time,
          poster_viewing: null,
        },
      ])
    }
    return r
  })

  fastify.post<any>("/maps/:roomId/enter", async req => {
    //   if (cluster?.worker?.id) {
    //     log.debug(req.path + " Worker #", cluster.worker.id)
    //   }
    const roomId = req.params.roomId as string
    const requester: UserId = req["requester"]
    const map = model.maps[roomId]
    if (!map) {
      throw { statusCode: 404, message: "Room not found" }
    }

    const r = await map.enterRoom(requester)

    const r2: MapEnterResponse = {
      ...r,
      socket_url: PRODUCTION
        ? RUST_WS_SERVER
          ? "/ws"
          : "/"
        : RUST_WS_SERVER
        ? "ws://localhost:8080/ws"
        : "http://localhost:5000/",
      socket_protocol: RUST_WS_SERVER ? "WebSocket" : "Socket.IO",
    }
    if (r.ok) {
      const rows = await model.db.query(
        `SELECT public_key FROM public_key WHERE person=$1;`,
        [req["requester"]]
      )
      r2.public_key = rows[0]?.public_key
      const p = await model.people.getInRoom(requester, roomId)
      if (p) {
        emit.channels([roomId]).peopleNew([p])
      }
      if (r.num_people_joined) {
        const d: RoomUpdateSocketData = {
          id: roomId,
          num_people_joined: r.num_people_joined,
        }
        emit.channels([roomId, "::admin", "::index", "::mypage"]).room(d)
      }
    }
    return r2
  })

  fastify.post<any>("/maps/:roomId/leave", async req => {
    const roomId = req.params.roomId
    const map = model.maps[roomId]
    if (!map) {
      throw { statusCode: 404, message: "Room not found" }
    }
    const r = await map.leaveRoom(req["requester"])
    return r
  })

  fastify.get<any>(
    "/maps/:roomId/people/:userId",
    { preHandler: roomMembers },
    async req => {
      const userId: UserId = req.params.userId as string
      const roomId: RoomId = req.params.roomId as string
      const requester = req["requester"]

      const m = model.maps[roomId]

      const is_room_admin = await m.isUserOwnerOrAdmin(requester)
      const admin_or_self =
        req["requester_type"] == "admin" || requester == userId || is_room_admin
      const user = await model.people.getInRoom(
        userId,
        roomId,
        admin_or_self,
        admin_or_self
      )
      return user
    }
  )

  fastify.patch<any>(
    "/maps/:roomId/people/:userId",
    { preHandler: manageRoom },
    async req => {
      const userId: UserId = req.params.userId as string
      const roomId: RoomId = req.params.roomId as string
      const m = model.maps[roomId || ""]
      if (!m) {
        throw { statusCode: 404 }
      }
      const role: "admin" | "user" = req.body.role

      const user = await model.people.getUnwrap(userId, true)
      await model.people.updateRole(roomId, user.email!, role)
      const d: PersonUpdate = {
        id: userId,
        last_updated: Date.now(),
        room: roomId,
        role,
      }
      emit.peopleUpdate([d])
      return { ok: true }
    }
  )

  fastify.delete<any>("/maps/:roomId/people/:userId", async (req, res) => {
    const requester = req["requester"]
    const userId = req.params.userId as string
    const roomId = req.params.roomId as string
    const m = model.maps[roomId || ""]
    if (!m) {
      throw { statusCode: 404 }
    }
    const is_room_admin = await m.isUserOwnerOrAdmin(requester)

    if (
      req["requester_type"] != "admin" &&
      requester != userId &&
      !is_room_admin
    ) {
      throw { statusCode: 403, message: "Unauthorized" }
    }
    const r = await m.removeUser({ user_id: userId })
    if (r.ok) {
      const d: RoomUpdateSocketData = {
        id: roomId,
        num_people_joined: r.num_people_joined,
        num_people_with_access: r.num_people_with_access,
        num_people_active: r.num_people_active,
      }
      emit.room(d)
      emit.channel(roomId).peopleRemove([userId])
    }
    return r
  })
}

export default maps_api_routes
