//  Data types and model and utility functions
import SocketIO from "socket.io"
import * as bunyan from "bunyan"
import cluster from "cluster"
import _ from "lodash"
import cookie from "cookie"

import {
  Announcement,
  Person,
  PersonInMap,
  ChatComment,
  CommentId,
  ChatGroupId,
  Poster,
  PersonPos,
  PersonUpdate,
  PosterId,
  GroupSocketData,
  ChatEvent,
  MoveErrorSocketData,
  MoveSocketData,
  TypingSocketData,
  TypingSocketSendData,
  DirectionSendSocket,
  RoomId,
  UserId,
  Emitter,
  AppNotification,
  ActiveUsersSocketData,
  SocketMessageFromUser,
  PosterCommentDecrypted,
  RoomUpdateSocketData,
  MapUpdateEntry,
  MapUpdateSocketData,
  MapReplaceSocketData,
  PersonUpdateByEmail,
} from "../@types/types"
import * as model from "./model"
import { userLog } from "./model"
import { encodeMoved } from "../common/util"
import { config } from "./config"

const PRODUCTION = process.env.NODE_ENV == "production"
const DEBUG_LOG = config.api_server.debug_log

const bunyanLogger = bunyan.createLogger({
  name: "index",
  src: !PRODUCTION,
  level: DEBUG_LOG ? 1 : "info",
})

export class Emit {
  emitter: Emitter
  log: any
  socketQueue: { [msg: string]: { [room: string]: any[] } } = {}
  constructor(emitter: Emitter, logger: any = bunyanLogger) {
    this.emitter = emitter
    this.log = logger
    setInterval(() => {
      for (const msg of Object.keys(this.socketQueue)) {
        for (const room in this.socketQueue[msg]) {
          if (this.socketQueue[msg][room].length > 0) {
            this.emitQueuedMessages(msg)
          }
        }
      }
    }, 100)
  }

  channel(name: string): Emit {
    return new Emit(this.emitter.to(name))
  }

  channels(names: string[]): Emit {
    let emit: Emit = new Emit(this.emitter.to(names[0]))
    for (const c of names.slice(1)) {
      emit = new Emit(emit.emitter.to(c))
    }
    return emit
  }

  emitQueuedMessages(msg: string): void {
    const rooms: RoomId[] = Object.keys(this.socketQueue[msg])
    if (msg == "moved") {
      for (const room of rooms) {
        if (
          this.socketQueue[msg][room] &&
          this.socketQueue[msg][room].length > 0
        ) {
          // log.debug(
          //   "emitQueuedMessages",
          //   room,
          //   this.socketQueue[msg][room].length
          // )
          this.emitter
            .to(room)
            .emit("Moved", this.socketQueue[msg][room].join(";"))
          this.socketQueue[msg][room] = []
        }
      }
    } else if (msg == "person") {
      for (const room of rooms) {
        this.emitter.to(room).emit("Person", this.socketQueue[msg][room])
        this.socketQueue[msg][room] = []
      }
    }
  }

  pushSocketQueue(msg: "moved" | "person", data: PersonPos | Person): void {
    // log.debug(this.socketQueue)
    if (!this.socketQueue[msg]) {
      this.socketQueue[msg] = {}
    }
    // log.debug(this.io.sockets.adapter.rooms)
    if (msg == "moved") {
      const d = data as PersonPos

      const s = encodeMoved(d)
      if (!this.socketQueue[msg][d.room]) {
        this.socketQueue[msg][d.room] = []
      }
      this.socketQueue[msg][d.room].push(s)
      this.emitter.to(d.room + ":" + d.user).emit("Moved", s)

      const s2 = encodeMoved(d, true)
      const room_observe = d.room + ":__observe__"
      if (!this.socketQueue[msg][room_observe]) {
        this.socketQueue[msg][room_observe] = []
      }
      this.socketQueue[msg][room_observe].push(s2)
    } else if (msg == "person") {
      const rooms: RoomId[] = Object.keys(this.socketQueue[msg])
      for (const room of rooms) {
        this.socketQueue[msg][room].push(data)
      }
    }
  }

  moveError(d: MoveErrorSocketData, socket: Emitter): void {
    socket.emit("MoveError", d)
  }

  room(d: RoomUpdateSocketData, socket: Emitter = this.emitter) {
    socket.emit("Room", d)
  }
  mapUpdate(ds: MapUpdateSocketData, socket: Emitter = this.emitter) {
    socket.emit("MapUpdate", ds)
  }
  mapReplace(d: MapReplaceSocketData, socket: Emitter = this.emitter) {
    socket.emit("MapReplace", d)
  }
  peopleNew(d: PersonInMap[], socket: Emitter = this.emitter): void {
    this.log.debug("PersonNew", d)
    socket.emit("PersonNew", d)
  }
  peopleUpdate(ds: PersonUpdate[], socket: Emitter = this.emitter): void {
    socket.emit("PersonUpdate", ds)
  }
  peopleUpdateByEmail(
    ds: PersonUpdateByEmail[],
    socket: Emitter = this.emitter
  ): void {
    socket.emit("PersonUpdateByEmail", ds)
  }
  peopleRemove(uids: UserId[], socket: Emitter = this.emitter): void {
    socket.emit("PersonRemove", uids)
  }
  group(d: GroupSocketData, socket: Emitter = this.emitter): void {
    socket.emit("Group", d)
  }
  groupRemove(d: ChatGroupId, socket: Emitter = this.emitter): void {
    socket.emit("GroupRemove", d)
  }
  comment(d: ChatComment): void {
    for (const t of d.texts) {
      this.emitter.to(t.to).emit("Comment", d)
    }
  }
  chatEvent(d: ChatEvent, socket: Emitter = this.emitter): void {
    socket.emit("ChatEvent", d)
  }
  announce(d: Announcement, socket: Emitter = this.emitter): void {
    socket.emit("Announce", d)
  }
  appReload(force?: boolean, socket: Emitter = this.emitter): void {
    socket.emit("AppReload", force || false)
  }
  posterComment(
    d: PosterCommentDecrypted,
    socket: Emitter = this.emitter
  ): void {
    socket.emit("PosterComment", d)
  }
  async commentRemove(cid: CommentId, to_users: UserId[]): Promise<void> {
    for (const u of to_users) {
      this.emitter.to(u).emit("CommentRemove", cid)
    }
  }
  posterCommentRemove(d: CommentId, socket: Emitter = this.emitter): void {
    socket.emit("PosterCommentRemove", d)
  }
  poster(d: Poster, socket: Emitter = this.emitter): void {
    socket.emit("Poster", d)
  }
  posterRemove(rid: RoomId, uid: UserId, pid: PosterId): void {
    this.emitter
      .to(rid)
      .to(uid)
      .emit("PosterRemove", pid)
  }
  posterReset(): void {
    this.emitter.emit("PosterReset")
  }
  mapReset(socket: Emitter = this.emitter): void {
    socket.emit("MapReset")
  }
  authError(user_id: UserId): void {
    this.emitter.to(user_id).emit("AuthError")
  }
  moveRequest(d: { to_poster: PosterId }): void {
    console.log("Emitting: MoveRequest", d)
    this.emitter.emit("MoveRequest", d)
  }
}

export let emit: Emit
export let io: Emitter

export function registerSocket(_io: Emitter, logger = bunyanLogger): void {
  emit = new Emit(_io, logger)
  io = _io
}

function onMoveSocket(d: MoveSocketData, socket: SocketIO.Socket, log: any) {
  ;(async () => {
    log.debug("move", d)
    const verified_user = await model.people.authSocket(d, socket.id) // Normal users can only move themselves (or admin can move anything)
    if (!verified_user) {
      emit.moveError(
        {
          user_id: d.user,
          error: "Access denied (invalid user or token)",
        },
        socket
      )
      emit.authError(d.user)
      return
    }
    log.debug(
      cluster?.worker?.id
        ? "move Worker# " +
            cluster?.worker?.id +
            " " +
            socket.conn.transport.name
        : "move " + socket.conn.transport.name
    )
    const pos = d.user ? await model.people.getPos(d.user, d.room) : null
    if (!pos) {
      // Silently return (without emitting move.error)
      log.warn("User position not found: ", d.room, d.user)
      return
    }
    if (!d || !d.user || !d.room) {
      log.warn("socket move: Missing parameter(s).", d)
      emit.moveError(
        {
          pos,
          user_id: d.user,
          error: "Missing parameter(s). This must be a bug",
        },
        socket
      )
      return false
    }
    const map = model.maps[d.room]
    if (!map) {
      emit.moveError(
        {
          pos,
          user_id: d.user,
          error: "Map not found: " + d.room,
        },
        socket
      )
    }
    const { error, results } = await map.tryToMove(pos, d)

    if (error) {
      log.warn("tryToMove failed", d.room, d.user, error)
      const e: MoveErrorSocketData = {
        pos,
        user_id: d.user,
        error: PRODUCTION
          ? "Invalid movement (destination not open, too far, or out of bounds)"
          : error,
      }
      emit.moveError(e, socket)

      return
    }
    for (const result of results || []) {
      if (result.position) {
        emit.pushSocketQueue("moved", {
          user: result.user,
          room: result.room,
          x: result.position.x,
          y: result.position.y,
          direction: result.direction || "none",
        })
      }
      if (result.group_left) {
        emit.channel(d.room).group(result.group_left)
      }
      if (result.group_joined) {
        emit.channel(d.room).group(result.group_joined)
      }
      if (result.group_removed) {
        emit.channel(d.room).groupRemove(result.group_removed)
      }
      if (result.poster_left) {
        emit.channel(d.room).peopleUpdate([
          {
            id: result.user,
            last_updated: Date.now(),
            poster_viewing: null,
          },
        ])
      }
    }
    log.debug("Moved", d.room, d.user, d.x, d.y)
    userLog({
      userId: d.user,
      operation: "move",
      data: d,
    })
  })().catch(err => {
    log.error(err)
  })
}

function addHandler(
  socket: SocketIO.Socket,
  msg: SocketMessageFromUser,
  func: ((d: any) => Promise<void>) | ((d: any) => void)
) {
  socket.on(msg, d => {
    ;(async () => {
      await func(d)
    })().catch(err => console.error(err))
  })
}

export function setupSocketHandlers(
  io: SocketIO.Server,
  log: bunyan,
  instance_id?: string
): void {
  io.on("connection", async (socket: SocketIO.Socket) => {
    log.info("Connected:", socket.id)
    socket.emit("Greeting", {
      instance_id,
    })

    const cookie_str: string | undefined = socket.handshake.headers.cookie
    if (!cookie_str) {
      log.warn("Cookie not found. Aborting connection")
      return
    }
    const cookies = cookie.parse(cookie_str)
    const cookie_session_id = cookies.virtual_poster_session_id
    const user_id = await model.redis.sessions.get(
      "cookie:uid:" + cookie_session_id
    )
    log.debug(cookies, cookie_session_id, user_id)
    if (user_id) {
      const ttl = await model.redis.sessions.ttl(
        "cookie:uid:" + cookie_session_id
      )
      await model.redis.sockets.setex("auth:" + socket.id, ttl, user_id)
      socket.emit("AuthComplete", { socket_id: socket.id })
      log.debug(
        "AuthComplete, ttl for " + ("cookie:uid:" + cookie_session_id),
        ttl
      )
    } else {
      log.warn("User ID not found from cookie")
    }

    addHandler(socket, "Move", d => onMoveSocket(d, socket, log))
    addHandler(socket, "Direction", (d: DirectionSendSocket) => {
      ;(async () => {
        const uid = await model.redis.sockets.get("auth:" + socket.id)
        if (!uid) {
          socket.emit("AuthError")
          return
        }
        userLog({
          userId: uid,
          operation: "direction",
          data: { direction: d.direction },
        })
        await model.people.setDirection(d.room, uid, d.direction)
      })().catch(err => log.error(err))
    })
    addHandler(socket, "ChatTyping", (d: TypingSocketSendData) => {
      ;(async () => {
        await model.maps[d.room].setTyping(d.user, d.typing)
        const r: TypingSocketData = {
          room: d.room,
          user: d.user,
          typing: d.typing,
        }
        io.to(d.room).emit("ChatTyping", r)
      })().catch(err => log.error(err))
    })
    addHandler(socket, "Subscribe", ({ channel }: { channel: string }) => {
      //FIXME: Add authentication
      socket.join(channel)
    })
    addHandler(socket, "Active", ({ room, user, token, observe_only }) => {
      ;(async () => {
        const verified = await model.people.authSocket(
          { user, token },
          socket.id
        )
        if (verified) {
          const ttl = await model.redis.sessions.ttl(
            "cookie:uid:" + cookie_session_id
          )
          await model.redis.sockets.setex(
            "auth:" + socket.id,
            ttl >= 0 ? ttl : 60 * 60, // Expiration time of cookie or ID token
            user
          )
          socket.join("__all__")
        } else {
          socket.emit("AuthError")
          return
        }

        if (observe_only) {
          socket.join(room + ":__observe__") // This will give room ID for Moved socket.
        } else {
          socket.join(room)
        }
        socket.join(user)
        socket.join(room + ":" + user)

        const rows = await model.db.query<
          {
            room: string
            text: string
            marquee: boolean
            period?: number
          }[]
        >(`SELECT * FROM announce WHERE room=$1`, [room])
        if (rows.length == 1) {
          const d: Announcement = {
            room: rows[0].room,
            text: rows[0].text,
            marquee: rows[0].marquee,
            period: rows[0].period || 0,
          }
          emit.channel(room).announce(d, socket)
        }

        if (!observe_only) {
          log.debug("User Active", room, user)
          userLog({
            userId: user,
            operation: "active",
            data: { room, user },
          })
          await model.redis.sockets.set(socket.id, room + ":" + user)
          await model.redis.sockets.sadd("room:" + room + ":" + user, socket.id)
          await model.redis.accounts.hincrby(
            "connected_users:room:" + "__any__",
            user,
            1
          )
          await model.redis.accounts.sadd(
            "connected_users:room:" + room + ":__all__",
            user
          )
          const users_count = await model.redis.accounts.scard(
            "connected_users:room:" + room + ":__all__"
          )
          const countObj = {}
          countObj[room] = users_count
          const ds: ActiveUsersSocketData = {
            users: [{ room, user, active: true }],
            count: countObj,
          }
          io.to(room).emit("ActiveUsers", ds)
          const d2: RoomUpdateSocketData = {
            id: room,
            num_people_active: users_count,
          }
          io.to("::index")
            .to("::admin")
            .to("::mypage")
            .emit("Room", d2)
        }
      })().catch(err => {
        log.error(err)
      })
    })
    socket.on("disconnect", () => {
      ;(async () => {
        const s = await model.redis.sockets.get(socket.id)
        if (!s) {
          log.info("Disconnect", socket.id, "(No user found)")
        } else {
          const [room, user] = s.split(":")
          log.info("Disconnect", room, user)
          userLog({
            userId: user,
            operation: "disconnect",
            data: null,
          })
          await model.redis.sockets.del(socket.id)
          await model.redis.sockets.srem("room:" + room + ":" + user, socket.id)

          const count_all_sockets_for_user = await model.redis.accounts.hincrby(
            "connected_users:room:" + "__any__",
            user,
            -1
          )
          if (count_all_sockets_for_user == 0) {
            await model.redis.accounts.hdel(
              "connected_users:room:" + "__any__",
              user
            )
          }
          const count = await model.redis.sockets.scard(
            "room:" + room + ":" + user
          )
          if (count == 0) {
            //All clients of the user are disconneted
            await model.redis.accounts.srem(
              "connected_users:room:" + room + ":__all__",
              user
            )
            const users_count = await model.redis.accounts.scard(
              "connected_users:room:" + room + ":__all__"
            )
            const msg: AppNotification = "ActiveUsers"
            const countObj = {}
            countObj[room] = users_count
            const d: ActiveUsersSocketData = {
              users: [{ room, user, active: false }],
              count: countObj,
            }
            io.to(room).emit(msg, d)
            const d2: RoomUpdateSocketData = {
              id: room,
              num_people_active: users_count,
            }
            io.to("::index")
              .to("::mypage")
              .to("::admin")
              .emit("Room", d2)
            const r: TypingSocketData = {
              room,
              user,
              typing: false,
            }
            const msg2: AppNotification = "ChatTyping"
            io.to(room).emit(msg2, r)
          }
        }
      })().catch(err => {
        log.error(err)
      })
    })
    socket.on("AskReload", async (d: { room_id: RoomId; force: boolean }) => {
      const verified_user = await model.people.authSocket(
        { user: "NA" },
        socket.id
      )
      if (!verified_user) {
        socket.emit("AuthError", "User not found")
        return
      }
      if (!verified_user.admin) {
        socket.emit("AuthError", "User not admin")
        return
      }
      emit.channels([d.room_id, "::mypage", "::admin"]).appReload(d.force)
    })
    socket.on("make_announcement", async (d: Announcement) => {
      const verified_user = await model.people.authSocket(
        { user: "NA" },
        socket.id
      )
      if (!verified_user) {
        socket.emit("AuthError", "User not found")
        return
      }
      const is_room_admin = model.maps[d.room]
        ? await model.maps[d.room].isUserOwnerOrAdmin(verified_user.user_id)
        : undefined
      if (!is_room_admin) {
        socket.emit("AuthError", "The user is not admin of the room")
        return
      }
      userLog({
        userId: verified_user.user_id,
        operation: "announce",
        data: d,
      })
      log.debug("make_announcement", d)
      if (d.room) {
        emit.channel(d.room).announce(d)
        if (d.room == "__all__") {
          for (const r of Object.values(model.maps)) {
            r.announce({ ...d, room: r.room_id })
          }
        } else {
          model.maps[d.room].announce(d)
        }
      }
    })
  })
}

process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Rejection at: Promise", p, "reason:", reason)
  // application specific logging, throwing an error, or other logic here
})
