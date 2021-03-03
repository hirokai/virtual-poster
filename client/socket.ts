import {
  SocketMessageFromUser,
  RoomAppProps,
  RoomAppState,
  AppEvent,
} from "@/@types/types"
import { decodeNotificationData } from "../common/util"

export class MySocketObject {
  props: RoomAppProps
  state: RoomAppState
  listeners: Record<string, ((data: any) => void)[]> = {}
  ws: WebSocket
  connected?: boolean
  url: string
  setupSocketHandlers: (
    props: RoomAppProps,
    state: RoomAppState,
    obj: MySocketObject
  ) => void

  constructor(
    url: string,
    props: RoomAppProps,
    state: RoomAppState,
    setupSocketHandlers: (
      props: RoomAppProps,
      state: RoomAppState,
      obj: MySocketObject
    ) => void
  ) {
    this.props = props
    this.state = state
    this.url = url
    this.connected = false
    this.setupSocketHandlers = setupSocketHandlers
    this.ws = this.connect()
    console.log("constructor", this.ws, setupSocketHandlers)
    setInterval(() => {
      // console.log("readyState", this.ws?.readyState)
      if (this.ws.readyState >= 2) {
        this.connected = false
      }
      if (this.ws && !this.connected) {
        this.connect()
      }
    }, 2000)
  }
  on(message: string, handler: (data: any) => void) {
    if (!this.listeners[message]) {
      this.listeners[message] = []
    }
    this.listeners[message].push(handler)
  }
  emit(message: SocketMessageFromUser, data: any) {
    if (message == "Move") {
      this.ws.send(JSON.stringify({ Move: data }))
    } else if (message == "Active") {
      this.ws.send(JSON.stringify({ Active: data }))
    } else if (message == "Subscribe") {
      this.ws.send(
        JSON.stringify({
          Subscribe: { channel: data.channel },
        })
      )
    } else if (message == "Unsubscribe") {
      this.ws.send(
        JSON.stringify({
          Unsubscribe: { channel: data.channel },
        })
      )
    } else if (message == "Direction") {
      const obj = JSON.stringify({
        Direction: { direction: data.direction, room: data.room },
      })
      console.log("Emitting", message, obj)
      this.ws.send(obj)
    } else if (message == "ChatTyping") {
      const obj = JSON.stringify({
        ChatTyping: { room: data.room, user: data.user, typing: data.typing },
      })
      console.log("Emitting", message, obj)
      this.ws.send(obj)
    } else {
      console.error("Not implemented: ", message, data)
    }
  }
  connect(): WebSocket {
    console.log("Connecting WS: ", this.url)
    if (this.ws) {
      this.ws.close()
    }
    this.ws = new WebSocket(this.url)
    this.setupSocketHandlers(this.props, this.state, this)
    this.ws.onmessage = d => {
      const dat = JSON.parse(d.data)
      //   console.log("WebSocket received: ", dat)
      const msg: AppEvent = dat.type
      const decoded = decodeNotificationData(msg, dat)
      if (decoded == null) {
        console.error("Decode error for WebSocket notification: ", msg, dat)
        return
      }
      for (const listener of this.listeners[msg] || []) {
        listener(decoded)
      }
    }

    this.ws.onopen = () => {
      console.log("WebSocket server connected")
      this.connected = true
      this.state.socket_active = true
      this.listeners["connection"][0](null)
    }

    this.ws.onclose = ev => {
      this.state.socket_active = false

      //   console.log(
      //     "Socket is closed. Reconnect will be attempted in 5 seconds.",
      //     ev
      //   )
      //   this.connected = false
      //   setTimeout(() => {
      //     if (!this.connected) {
      //       this.connect()
      //     }
      //   }, 5000)
    }

    this.ws.onerror = err => {
      console.error("Socket encountered error: ", err, "Closing socket")
      this.ws.close()
    }

    return this.ws
  }
}
