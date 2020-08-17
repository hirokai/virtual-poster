// Data types and model and utility functions
import SocketIO from "socket.io"
import * as bunyan from "bunyan"
import cluster from "cluster"
import _ from "lodash"
import { SocketIOEmitter } from "socket.io-emitter"

import {
  Announcement,
  Person,
  ChatComment,
  CommentId,
  ChatGroupId,
  Poster,
  PersonPos,
  GroupSocketData,
  MoveErrorSocketData,
  MoveSocketData,
  TypingSocketData,
  TypingSocketSendData,
  DirectionSendSocket,
  ChatCommentEncrypted,
  RoomId,
  UserId,
  ActiveUsersSocketData,
} from "../../@types/types"
import * as model from "./model"
import { userLog } from "./model"
import { encodeMoved } from "../common/util"

// Setting mode (production/development) and port
const PRODUCTION = process.env.NODE_ENV == "production"
const DEBUG_LOG = !!process.env.DEBUG_LOG || !PRODUCTION

const bunyanLogger = bunyan.createLogger({
  name: "index",
  src: !PRODUCTION,
  level: DEBUG_LOG ? 1 : "info",
})

export class Emit {
  io: SocketIO.Server | SocketIOEmitter
  log: any
  socketQueue: { [msg: string]: { [room: string]: any[] } } = {}
  constructor(
    io: SocketIO.Server | SocketIOEmitter,
    logger: any = bunyanLogger
  ) {
    this.io = io
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
          this.custom(
            msg + "_multi",
            this.socketQueue[msg][room].join(";"),
            room
          )
          this.socketQueue[msg][room] = []
        }
      }
    } else if (msg == "person") {
      for (const room of rooms) {
        this.custom(msg + "_multi", this.socketQueue[msg][room], room)
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
      this.io.to(d.user).emit("moved", s)
    } else if (msg == "person") {
      const rooms: RoomId[] = Object.keys(this.socketQueue[msg])
      for (const room of rooms) {
        this.socketQueue[msg][room].push(data)
      }
    }
  }

  moveError(
    d: MoveErrorSocketData,
    socket: SocketIO.Socket | SocketIO.Namespace | SocketIOEmitter
  ): void {
    socket.emit("move.error", d)
  }
  people(
    d: Person[],
    socket: SocketIO.Socket | SocketIO.Server | SocketIOEmitter = this.io
  ): void {
    socket.emit("people", d)
  }
  group(
    d: GroupSocketData,
    socket: SocketIO.Socket | SocketIO.Server | SocketIOEmitter = this.io
  ): void {
    socket.emit("group", d)
  }
  groupRemove(
    d: ChatGroupId,
    socket:
      | SocketIO.Socket
      | SocketIO.Server
      | SocketIO.Namespace
      | SocketIOEmitter = this.io
  ): void {
    socket.emit("group.remove", d)
  }
  comment(d: ChatCommentEncrypted): void {
    for (const t of d.texts) {
      this.io.to(t.to_user).emit("comment", d)
    }
  }
  posterComment(
    d: ChatComment,
    socket: SocketIO.Socket | SocketIO.Server | SocketIOEmitter = this.io
  ): void {
    socket.emit("poster.comment", d)
  }
  async commentRemove(cid: CommentId, to_users: UserId[]): Promise<void> {
    console.log("commentRemove", cid)

    for (const u of to_users) {
      this.io.to(u).emit("comment.remove", cid)
    }
  }
  posterCommentRemove(
    d: CommentId,
    socket: SocketIO.Socket | SocketIO.Server | SocketIOEmitter = this.io
  ): void {
    socket.emit("poster.comment.remove", d)
  }
  poster(
    d: Poster,
    socket: SocketIO.Socket | SocketIO.Server | SocketIOEmitter = this.io
  ): void {
    socket.emit("poster", d)
  }
  mapReset(
    socket: SocketIO.Socket | SocketIO.Server | SocketIOEmitter = this.io
  ): void {
    socket.emit("map.reset")
  }
  custom<T = any>(msg: string, data?: T, room?: string): void {
    // log.debug("emit.custom", msg, data, room)
    if (room) {
      this.io.to(room).emit(msg, data)
    } else {
      this.io.emit(msg, data)
    }
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
    const verified = await model.people.verifySocketToken(d) // Normal users can only move themselves (or admin can move anything)
    if (!verified) {
      emit.moveError(
        {
          user_id: d.user,
          error: "Access denied (invalid user or token)",
        },
        socket
      )
      emit.custom("auth_error", null, d.user)
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
    if (!d || !d.user || !d.token || !d.room) {
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

export function setupSocketHandlers(io: SocketIO.Server, log: bunyan): void {
  io.on("connection", function(socket: SocketIO.Socket) {
    log.info("connection", socket.id)
    socket.emit("greeting")
    socket.on("move", d => onMoveSocket(d, socket, log))
    socket.on("direction", (d: DirectionSendSocket) => {
      ;(async () => {
        const verified = await model.people.verifySocketToken(d)
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
    socket.on("chat_typing", (d: TypingSocketSendData) => {
      ;(async () => {
        const verified = await model.people.verifySocketToken(d)
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
    socket.on("active", ({ room, user }) => {
      ;(async () => {
        log.debug("active", room, user)
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

        const ds: ActiveUsersSocketData = [{ room, user, active: true }]
        io.to(room).emit("active_users", ds)
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
            io.to(room).emit("active_users", [{ room, user, active: false }])
            const r: TypingSocketData = {
              room,
              user,
              typing: false,
            }
            /*
            const group = await model.chat.getGroupOfUser(room, user)
            if (group) {
              const cs = await model.people.isConnected(room, group.users)
              if (_.every(cs, c => c == false)) {
                //All users in the group disconnected
                await model.chat.deleteGroup(group.id)
                emit.groupRemove(group.id, emit.io.to(room))
              }
            }
            const r2 = await model.chat.leaveChat(room, user)
            */
            io.to(room).emit("chat_typing", r)
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
        io.emit("announce", d)
        model.maps[d.room].announce(d)
      }
    })
  })
}
