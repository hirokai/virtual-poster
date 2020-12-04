import { computed, ComputedRef } from "vue"
import {
  calcDirection,
  inRange,
  findRoute,
  decodeMoved,
  personAt,
  posterAt,
  isUserId,
} from "@/common/util"
import {
  startChat,
  myChatGroup,
  inviteToChat,
  kickFromChat,
  myChatGroup as _myChatGroup,
} from "./room_chat_service"
import { adjacentPoster } from "./room_poster_service"
import { addLatencyLog } from "./room_log_service"

import {
  UserId,
  Point,
  Direction,
  PersonInMap,
  RoomAppProps,
  RoomAppState,
  RoomUpdateSocketData,
  MoveSocketData,
  Poster,
  ChatGroup,
  DirectionSendSocket,
  TypingSocketSendData,
  ArrowKey,
  Cell,
  MoveErrorSocketData,
  MySocketObject,
  PosDir,
  PosterId,
} from "@/@types/types"

import { getClosestAdjacentPoints, isAdjacent, range } from "@/common/util"

const BATCH_MOVE_INTERVAL = 100
import { AxiosStatic, AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"

export const posterLooking: (
  props: RoomAppProps,
  state: RoomAppState
) => ComputedRef<PosterId | undefined> = (
  props: RoomAppProps,
  state: RoomAppState
) =>
  computed(() => {
    return state.people[props.myUserId]?.poster_viewing
  })

export const playBGM = (props: RoomAppProps, state: RoomAppState) => () => {
  if (state.playingBGM) {
    state.playingBGM.pause()
  }
  const audio = new Audio()
  state.playingBGM = audio
  audio.src = posterLooking(props, state).value
    ? "/sound/montagu.mp3"
    : // : "/sound/morning-murmur.mp3"
      "/sound/harunouta.mp3"
  audio.volume = 0.1
  audio.loop = true
  audio
    .play()
    .then(() => {
      //
    })
    .catch(() => {
      //
    })
}

export const stopBGM = (state: RoomAppState) => () => {
  state.playingBGM?.pause()
  state.playingBGM = undefined
}

export function showMessage(props: RoomAppProps, state: RoomAppState) {
  return (msg: string, timeout = 5000): void => {
    //Vue.set
    state.message.text = msg
    //Vue.set
    state.message.hide = false
    if (state.message.timer) {
      window.clearTimeout(state.message.timer)
      //Vue.set
      state.message.timer = undefined
    }
    if (timeout > 0) {
      //Vue.set

      state.message.timer = window.setTimeout(() => {
        if (state.message) {
          //Vue.set
          state.message.hide = true
          //Vue.set
          state.message.text = ""
        }
      }, timeout)
    }
  }
}

export const enterPoster = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState
) => async () => {
  const pid = await new Promise<PosterId | null>(resolve => {
    const bm = state.batchMove
    if (!bm) {
      const _adjacentPoster = adjacentPoster(props, state)
      const pid = _adjacentPoster.value?.id
      resolve(pid)
    } else {
      let count = 0
      setInterval(() => {
        count += 1
        if (count >= 20) {
          resolve(null)
        }
        const _adjacentPoster = adjacentPoster(props, state)
        const pid = _adjacentPoster.value?.id
        if (pid) {
          resolve(pid)
        }
      }, 100)
    }
  })
  if (!pid) {
    console.warn("Not adjacent to poster")
    return
  }
  const client = api(axiosClient(axios))
  const r = await client.maps
    ._roomId(props.room_id)
    .posters._posterId(pid)
    .enter.$post()
  console.log("Enter poster result", r)
  if (!r.ok) {
    console.warn("Cannot start viewing a poster", r.error)
    return
  }

  if (r.image_url) {
    state.posters[pid].file_url = r.image_url
  }

  if (props.isMobile) {
    location.hash = "poster"
    state.mobilePane = "poster"
  }
  state.socket?.emit("Subscribe", {
    channel: pid,
  })
  if (state.playingBGM) {
    playBGM(props, state)()
  }
}

export let moveOneStep = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  user_id: string,
  to: Point,
  direction: Direction,
  on_complete: (_g: ChatGroup | undefined) => void = () => {
    /* */
  }
): boolean => {
  // To avoid warning (This function is never called)
  console.log(on_complete)
  return false
}

export class BatchMove {
  points: Point[]
  batchMovePoints: Point[]
  timer?: NodeJS.Timeout
  idx = 0
  on_complete?: (g: ChatGroup | undefined) => void
  moveOneStep: (pos: PosDir) => void
  props: RoomAppProps
  state: RoomAppState
  axios: AxiosStatic | AxiosInstance
  liveMapChangedAfterMove = false
  constructor(
    points: Point[],
    moveOneStep: (pos: PosDir) => void,
    props: RoomAppProps,
    state: RoomAppState,
    axios: AxiosStatic | AxiosInstance
  ) {
    this.points = points
    this.batchMovePoints = points
    this.moveOneStep = moveOneStep
    this.props = props
    this.state = state
    this.axios = axios
  }
  start(
    immediate?: boolean,
    chatAfterMove?: UserId | PosterId,
    on_complete?: (g: ChatGroup | undefined) => void
  ): NodeJS.Timeout {
    this.on_complete = on_complete
    this.timer = setInterval(() => {
      if (!this.state.oneStepAccepted) {
        console.warn("Not received previous move result. Wait to move.")
        return
      }
      // console.log("batchMoveTimer")
      if (!this.points) {
        return
      }
      // if (state.liveMapChangedAfterMove && target) {
      //   const to_person = state.people[target]
      //   if (to_person.x != to.x || to_person.y != to.y) {
      //     console.log(
      //       "Target moved",
      //       target,
      //       pick(state.people[target], ["x", "y"]),
      //       to
      //     )
      //     state.moveTo(
      //       { x: state.people[target].x, y: state.people[target].y },
      //       target
      //     )
      //   }
      // }
      // if (!state.oneStepAccepted) {
      //   return
      // }
      this.idx += 1
      this.batchMovePoints = this.points.slice(this.idx)
      const p2 = this.points[this.idx]
      if (p2) {
        if (immediate) {
          this.moveOneStep({
            ...this.points[this.idx],
            direction: calcDirection(this.points[this.idx - 1], p2),
          })
        }
        this.liveMapChangedAfterMove = false
        const d: MoveSocketData = {
          ...p2,
          room: this.props.room_id,
          user: this.props.myUserId,
          debug_as: this.props.debug_as,
        }
        this.state.move_emitted = performance.now()
        this.state.socket?.emit("Move", d)
        if (this.idx == this.points.length - 1 && this.timer) {
          clearInterval(this.timer)
          this.batchMovePoints = []
          if (chatAfterMove) {
            if (isUserId(chatAfterMove)) {
              this.state.selectedUsers = new Set([chatAfterMove])
              startChat(this.props, this.state, this.axios)
                .then(d => {
                  if (this.on_complete) {
                    this.on_complete(d?.group)
                  }
                  if (d) {
                    this.state.selectedUsers.clear()
                  }
                })
                .catch(() => {
                  //
                })
            } else {
              // Poster
              enterPoster(this.axios, this.props, this.state)()
                .then(() => {
                  //
                })
                .catch(() => {
                  //
                })
            }
            chatAfterMove = undefined
          } else {
            if (this.on_complete) {
              this.on_complete(undefined)
            }
          }
        }
        this.state.oneStepAccepted = false
      }
    }, BATCH_MOVE_INTERVAL)
    return this.timer
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }
}

function startBatchMove(
  props: RoomAppProps,
  state: RoomAppState,
  axios: AxiosInstance | AxiosStatic,
  from: Point,
  to: Point,
  immediate: boolean,
  chatAfterMove?: UserId | PosterId,
  on_complete: (g: ChatGroup | undefined) => void = () => {
    /* */
  }
): boolean {
  const ti = performance.now()
  let points: Point[] | null = null
  for (const margin of [3, 5, 10, undefined]) {
    points = findRoute(
      props.myUserId,
      state.hallMap,
      Object.values(state.people),
      from,
      to,
      margin
    )
    if (points) {
      break
    }
  }
  const tf = performance.now()
  console.log(`Route finding in ${tf - ti} ms`)
  if (!points) {
    console.info("No route was found.")
    return false
  }
  console.log("# of points on route", points.length)
  state.oneStepAccepted = true

  state.batchMove = new BatchMove(
    points,
    (pos: PosDir) =>
      moveOneStep(
        axios,
        props,
        state,
        props.myUserId,
        { x: pos.x, y: pos.y },
        pos.direction
      ),
    props,
    state,
    axios
  )
  state.batchMove?.start(false, chatAfterMove, on_complete)

  return true
}

export const moveTo = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  myself: PersonInMap,
  to: Point,
  on_complete: (g: ChatGroup | undefined) => void = () => {
    /* */
  },
  target?: UserId,
  immediate = false,
  chatAfterMove?: UserId | PosterId
): boolean => {
  if (state.batchMove) {
    state.batchMove.stop()
    state.batchMove = undefined
  }
  const from = { x: myself.x, y: myself.y }
  const toCell = state.hallMap[to.y][to.x]
  const person = personAt(state.people, to)
  const poster = posterAt(state.posters, to)
  if (
    (person && person.connected) ||
    poster ||
    ["wall", "water", "poster"].includes(toCell.kind)
  ) {
    console.info("Destination not open", { toCell, person, poster })
    return false
  }
  if (Math.abs(from.x - to.x) <= 1 && Math.abs(from.y - to.y) <= 1) {
    if (immediate) {
      moveOneStep(axios, props, state, myself.id, to, calcDirection(from, to))
    }
    const d: MoveSocketData = props.debug_as
      ? {
          ...to,
          room: props.room_id,
          user: props.myUserId,
          debug_as: props.debug_as,
        }
      : {
          ...to,
          room: props.room_id,
          user: props.myUserId,
        }
    // console.log("Move emitting", d)
    state.socket?.emit("Move", d)
    state.move_emitted = performance.now()
    return true
  } else {
    return startBatchMove(
      props,
      state,
      axios,
      from,
      to,
      immediate,
      chatAfterMove,
      on_complete
    )
  }
}

moveOneStep = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  user_id: string,
  to: Point,
  direction: Direction,
  on_complete: (g: ChatGroup | undefined) => void = () => {
    /* */
  }
): boolean => {
  const { x, y } = to
  const p = state.people[user_id]
  if (!p) {
    return false
  }
  if (p.x == to.x && p.y == to.y && p.direction == direction) {
    return false
  }
  // console.log("moveOneStep()", to.x, to.y, direction)
  // Vue.set
  if (p.id == props.myUserId) {
    state.center = {
      x: inRange(
        x,
        props.isMobile ? 4 : 5,
        state.cols - (props.isMobile ? 4 : 5) - 1
      ),
      y: inRange(
        y,
        props.isMobile ? 6 : 5,
        state.rows - (props.isMobile ? 6 : 5) - 1
      ),
    }
  }
  state.people[user_id] = { ...p, x, y, direction }
  if (
    p.id != props.myUserId &&
    state.batchMove &&
    state.batchMove.batchMovePoints
      .slice(0, 5)
      .find(p => p.x == to.x && p.y == to.y)
  ) {
    console.log("Recalculate paths")
    moveTo(
      axios,
      props,
      state,
      state.people[props.myUserId],
      state.batchMove.batchMovePoints[
        state.batchMove.batchMovePoints.length - 1
      ],
      on_complete
    )
    return true
  } else {
    return false
  }
}

export const moveByArrow = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  me: PersonInMap,
  key: ArrowKey
): {
  ok: boolean
  moved: boolean
  error?: "during_chat" | "during_poster" | undefined
} => {
  let dx = 0,
    dy = 0
  let moved = false
  if (myChatGroup(props, state).value) {
    return { ok: false, moved, error: "during_chat" }
  }
  if (me.poster_viewing) {
    return { ok: false, moved, error: "during_poster" }
  }
  const x = me.x
  const y = me.y
  if (key == "ArrowRight" || key == "l") {
    dx = 1
    dy = 0
    me.direction = "right"
  } else if (key == "ArrowUp" || key == "k") {
    dx = 0
    dy = -1
    me.direction = "up"
  } else if (key == "ArrowLeft" || key == "h") {
    dx = -1
    dy = 0
    me.direction = "left"
  } else if (key == "ArrowDown" || key == "j") {
    dx = 0
    dy = 1
    me.direction = "down"
  } else if (key == "y") {
    dx = -1
    dy = -1
    me.direction = "left"
  } else if (key == "u") {
    dx = 1
    dy = -1
    me.direction = "right"
  } else if (key == "b") {
    dx = -1
    dy = 1
    me.direction = "left"
  } else if (key == "n") {
    dx = 1
    dy = 1
    me.direction = "right"
  }
  const nx = x + dx
  const ny = y + dy
  if (nx >= 0 && nx < state.cols && ny >= 0 && ny < state.rows) {
    const la = { x: nx, y: ny }
    const la_person: PersonInMap | undefined = la
      ? personAt(state.people, la)
      : undefined
    const la_poster: Poster | undefined = la
      ? posterAt(state.posters, la)
      : undefined
    if ((!la_person || !la_person.connected) && !la_poster) {
      if (state.people_typing[props.myUserId]) {
        const d: TypingSocketSendData = {
          user: me.id,
          room: props.room_id,
          typing: false,
        }
        state.socket?.emit("ChatTyping", d)
      }
      state.selectedUsers.clear()
      moved = moveTo(
        axios,
        props,
        state,
        me,
        { x: nx, y: ny },
        localStorage["virtual-poster:jwt_hash"]
      )
    } else {
      const d = {
        user: props.myUserId,
        direction: me.direction,
      }
      console.log(d)
      moved = false
    }
  }
  if (!moved) {
    //Only direction change
    const d: DirectionSendSocket = {
      room: props.room_id,
      direction: me.direction,
    }
    console.log("Only direction", d)
    state.socket?.emit("Direction", d)
  }
  return { ok: true, moved }
}

export const cellsMag = (
  state: RoomAppState,
  radiusX: number,
  radiusY: number
): ComputedRef<Cell[][]> =>
  computed((): Cell[][] => {
    if (state.hallMap.length == 0) {
      return []
    }
    const min_x = Math.max(0, state.center.x - radiusX)
    const min_y = Math.max(0, state.center.y - radiusY)
    const max_x = Math.min(
      state.hallMap[0].length - 1,
      state.center.x + radiusX
    )
    const max_y = Math.min(state.hallMap.length - 1, state.center.y + radiusY)

    return range(min_y, max_y + 1).map(y => {
      return state.hallMap[y].slice(min_x, max_x + 1)
    })
  })

const on_socket_move = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  s: string
) => {
  const pos = decodeMoved(s, props.room_id)
  // console.log("on_socket_move", s, pos, state.move_emitted)
  if (
    !pos ||
    !state.people ||
    !state.hallMap ||
    pos.y >= state.hallMap.length ||
    pos.x >= state.hallMap[0].length
  ) {
    console.log("move rejecting")
    return
  }
  if (pos.user == props.myUserId && state.move_emitted) {
    const latency =
      Math.round((performance.now() - state.move_emitted) * 100) / 100
    console.log("%c" + latency.toFixed(2) + "ms socket move", "color: green")
    state.move_emitted = null
    addLatencyLog(axios, {
      url: "socket:move",
      latency,
      timestamp: Date.now(),
    })
  }
  if (pos.user == props.myUserId) {
    state.oneStepAccepted = true
  }
  moveOneStep(
    axios,
    props,
    state,
    pos.user,
    { x: pos.x, y: pos.y },
    pos.direction
  )
  if (pos.user != props.myUserId && state.batchMove) {
    state.batchMove.liveMapChangedAfterMove = true
  }
}

export const dblClickHandler = (
  props: RoomAppProps,
  state: RoomAppState,
  axios: AxiosStatic | AxiosInstance
): ((p: Point) => Promise<void>) => {
  const client = api(axiosClient(axios))
  return async (p: Point): Promise<void> => {
    const me = state.people[props.myUserId]
    if (!me) {
      return
    }
    const poster = posterAt(state.posters, p)
    const person = poster ? undefined : personAt(state.people, p)
    if (me.poster_viewing && !(person && isAdjacent(me, person))) {
      showMessage(
        props,
        state
      )(
        "ポスター閲覧中は動けません。動くためにはポスターから離脱してください。"
      )
      return
    }

    const chat_group = myChatGroup(props, state).value
    if (chat_group) {
      const chat_members = state.chatGroups[chat_group].users
      if (
        person &&
        isAdjacent(me, person) &&
        chat_members.indexOf(person.id) == -1
      ) {
        const group = await inviteToChat(axios, props, state, person)
        if (group) {
          showMessage(
            props,
            state
          )(
            "会話に加わりました。参加者：" +
              group.users.map(u => state.people[u].name).join(",")
          )
          state.selectedUsers.clear()
        }
      } else if (person && chat_members.indexOf(person.id) != -1) {
        const r = await kickFromChat(axios, props, state, person)
        if (!r.ok) {
          console.error("Kick user failed")
        }
      } else {
        showMessage(
          props,
          state
        )("会話中は動けません。動くためには会話を終了してください。")
      }
      return
    }
    const poster_location = state.hallMap[p.y][p.x].poster_number

    console.log("dblClicked", person, poster, poster_location)

    if (state.people_typing[props.myUserId]) {
      const d: TypingSocketSendData = {
        user: me.id,
        room: props.room_id,
        typing: false,
      }
      state.socket?.emit("ChatTyping", d)
    }

    if (!poster && poster_location != undefined) {
      if (!state.allow_poster_assignment) {
        alert("この会場では参加者によるポスターの確保はできません。")
        return
      }
      const r = confirm("このポスター板を確保しますか？")
      if (!r) {
        return
      }
      const data = await client.maps
        ._roomId(props.room_id)
        .poster_slots._posterNumber(poster_location)
        .$post({ body: {} })
      console.log("take poster result", data)
    }

    if (!person && !poster) {
      state.selectedUsers.clear()
      moveTo(axios, props, state, me, p)
      return
    }

    if (Math.abs(p.x - me.x) <= 1 && Math.abs(p.y - me.y) <= 1) {
      if (person) {
        state.selectedUsers.add(person.id)
        startChat(props, state, axios)
          .then(d => {
            if (d) {
              state.encryption_possible_in_chat =
                !!state.privateKey && d.encryption_possible
              state.selectedUsers.clear()
            }
            //
          })
          .catch(() => {
            //
          })
      } else if (poster) {
        state.selectedUsers.clear()
        // Vue.set
        await enterPoster(axios, props, state)()
      }
      return
    } else {
      const dps = getClosestAdjacentPoints({ x: me.x, y: me.y }, p)
      const chatAfterMove = person ? person.id : poster ? poster.id : undefined
      console.log("Start batch move with chatAfterMove:", chatAfterMove)
      // Try to move to an adjacent open until it succeeds.
      for (const p1 of dps) {
        const r = moveTo(
          axios,
          props,
          state,
          me,
          p1,
          group => {
            if (group) {
              showMessage(
                props,
                state
              )(
                "会話に加わりました。参加者：" +
                  group.users.map(u => state.people[u].name).join(",")
              )
            }
          },
          person?.id,
          false,
          chatAfterMove
        )
        if (r) {
          break
        }
      }
    }
  }
}

export const initMapService = async (
  axios: AxiosStatic | AxiosInstance,
  socket: SocketIOClient.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState
): Promise<boolean> => {
  const client = api(axiosClient(axios))
  socket.on("Room", (data: RoomUpdateSocketData) => {
    if (data.id != props.room_id) {
      return
    }
    if (data.allow_poster_assignment != undefined) {
      state.allow_poster_assignment = data.allow_poster_assignment
    }
  })
  socket.on("Moved", data => {
    const ss = data.split(";")
    for (const s of ss) {
      on_socket_move(axios, props, state, s)
    }
  })
  socket.on("MoveError", (msg: MoveErrorSocketData) => {
    console.log("MoveError socket", msg)
    if (msg.user_id && msg.pos != undefined) {
      moveOneStep(
        axios,
        props,
        state,
        msg.user_id,
        { x: msg.pos.x, y: msg.pos.y },
        msg.pos.direction as Direction
      )
    }
    if (msg.error.indexOf("Access denied") != -1) {
      // location.reload()
    }
  })
  socket.on("MoveRequest", async d => {
    console.log("MoveRequest", d)
    const p = state.posters[d.to_poster]
    await dblClickHandler(props, state, axios)({ x: p.x, y: p.y })
  })
  const data = await client.maps._roomId(props.room_id).$get()
  state.hallMap = data.cells
  state.cols = data.numCols
  state.rows = data.numRows
  state.allow_poster_assignment = data.allow_poster_assignment
  state.roomName = data.name
  state.notifications = await client.maps
    ._roomId(props.room_id)
    .notifications.$get()
    .catch(() => [])

  return true
}
