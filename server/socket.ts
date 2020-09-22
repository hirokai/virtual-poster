//  Data types and model and utility functions
import SocketIO from "socket.io"
import * as bunyan from "bunyan"
import cluster from "cluster"
import _ from "lodash"
import { SocketIOEmitter } from "socket.io-emitter"

import {
  Announcement,
  Person,
  ChatComment,
  ChatCommentDecrypted,
  CommentId,
  ChatGroupId,
  Poster,
  PersonPos,
  PersonUpdate,
  PosterId,
  GroupSocketData,
  MoveErrorSocketData,
  MoveSocketData,
  TypingSocketData,
  TypingSocketSendData,
  DirectionSendSocket,
  AuthSocket,
  RoomId,
  UserId,
  Emitter,
  EmitCommand,
  ActiveUsersSocketData,
  SocketMessageFromUser,
  PosterCommentDecrypted,
} from "@/@types/types"
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

  room(name: string): Emit {
    this.log.debug("emit.room", name)
    return new Emit(this.emitter.to(name))
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
  peopleNew(d: Person[], socket: Emitter = this.emitter): void {
    this.log.debug("PersonNew", d)
    socket.emit("PersonNew", d)
  }
  peopleUpdate(ds: PersonUpdate[], socket: Emitter = this.emitter): void {
    socket.emit("PersonUpdate", ds)
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
  announce(d: Announcement, socket: Emitter = this.emitter): void {
    socket.emit("Announce", d)
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
export let io: SocketIO.Server | SocketIOEmitter

export function registerSocket(
  _io: SocketIO.Server | SocketIOEmitter,
  logger = bunyanLogger
): void {
  emit = new Emit(_io, logger)
  io = _io
}

function onMoveSocket(d: MoveSocketData, socket: SocketIO.Socket, log: any) {
  ;(async () => {
    log.debug("move", d)
    const verified = await model.people.authSocket(d, socket.id) // Normal users can only move themselves (or admin can move anything)
    if (!verified) {
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
    const { error, result } = await map.tryToMove(pos, d)

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
    emit.pushSocketQueue("moved", {
      user: d.user,
      room: d.room,
      x: d.x,
      y: d.y,
      direction: result?.direction || "none",
    })
    log.debug("Moved", d.room, d.user, d.x, d.y)
    userLog({
      userId: d.user,
      operation: "move",
      data: d,
    })
    if (result) {
      if (result.group_left) {
        emit.group(result.group_left)
      }
      if (result.group_joined) {
        emit.group(result.group_joined)
      }
      if (result.group_removed) {
        emit.groupRemove(result.group_removed)
      }
    }
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

export function setupSocketHandlers(io: SocketIO.Server, log: bunyan): void {
  io.on("connection", function(socket: SocketIO.Socket) {
    log.info("Connected:", socket.id)
    socket.emit("greeting")

    addHandler(socket, "Auth", (d: AuthSocket) => {
      ;(async () => {
        const verified = await model.people.authSocket({
          user: d.user,
          token: d.jwt_hash,
        })
        if (verified) {
          await model.redis.sockets.setex("auth:" + socket.id, 60 * 60 * 3, "1")
        } else {
          log.warn("Auth failed")
          socket.emit("auth_error")
        }
      })().catch(err => log.error(err))
    })
    addHandler(socket, "Move", d => onMoveSocket(d, socket, log))
    addHandler(socket, "Direction", (d: DirectionSendSocket) => {
      ;(async () => {
        const verified = await model.people.authSocket(d, socket.id)
        if (!verified) {
          socket.emit("auth_error")
          return
        }
        userLog({
          userId: d.user,
          operation: "direction",
          data: { direction: d.direction },
        })
        await model.people.setDirection(d.user, d.direction)
      })().catch(err => log.error(err))
    })
    addHandler(socket, "ChatTyping", (d: TypingSocketSendData) => {
      ;(async () => {
        const verified = await model.people.authSocket(d, socket.id)
        if (!verified) {
          socket.emit("auth_error")
          return
        }
        await model.maps[d.room].setTyping(d.user, d.typing)
        const r: TypingSocketData = {
          room: d.room,
          user: d.user,
          typing: d.typing,
        }
        io.to(d.room).emit("chat_typing", r)
      })().catch(err => log.error(err))
    })
    addHandler(socket, "Active", ({ room, user, token }) => {
      ;(async () => {
        const verified = await model.people.authSocket(
          { user, token },
          socket.id
        )

        if (verified) {
          await model.redis.sockets.set("auth:" + socket.id, "1")
        } else {
          socket.emit("auth_error")
        }

        log.debug("User Active", room, user)
        userLog({
          userId: user,
          operation: "active",
          data: { room, user },
        })
        await model.redis.sockets.set(socket.id, room + ":" + user)
        await model.redis.sockets.hincrby("room:" + "__any__", user, 1)
        await model.redis.sockets.sadd("room:" + room + ":__all__", user)
        await model.redis.sockets.sadd("room:" + room + ":" + user, socket.id)
        socket.join(room)
        socket.join(user)
        socket.join(room + ":" + user)

        const ds: ActiveUsersSocketData = [{ room, user, active: true }]
        io.to(room).emit("ActiveUsers", ds)

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
          emit.announce(d, socket)
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

          const count_all_sockets_for_user = await model.redis.sockets.hincrby(
            "room:" + "__any__",
            user,
            -1
          )
          if (count_all_sockets_for_user == 0) {
            await model.redis.sockets.hdel("room:" + "__any__", user)
          }
          const count = await model.redis.sockets.scard(
            "room:" + room + ":" + user
          )
          if (count == 0) {
            //All clients of the user are disconneted
            await model.redis.sockets.srem("room:" + room + ":__all__", user)
            const msg: EmitCommand = "ActiveUsers"
            io.to(room).emit(msg, [{ room, user, active: false }])
            const r: TypingSocketData = {
              room,
              user,
              typing: false,
            }
            const msg2: EmitCommand = "ChatTyping"
            io.to(room).emit(msg2, r)
          }
        }
      })().catch(err => {
        log.error(err)
      })
    })
    socket.on("make_announcement", (d: Announcement) => {
      userLog({
        userId: "__admin",
        operation: "announce",
        data: d,
      })
      log.debug("make_announcement", d)
      if (d.room && d.text) {
        emit.announce(d)
        model.maps[d.room].announce(d)
      }
    })
  })
}
