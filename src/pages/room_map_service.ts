import Vue from "vue"
import { computed, ComputedRef } from "@vue/composition-api"
import {
  calcDirection,
  inRange,
  findRoute,
  lookingAt,
  decodeMoved,
} from "../common/util"
import { startChat, myChatGroup } from "./room_chat_service"
import { addLatencyLog } from "./room_log_service"

import {
  UserId,
  Point,
  Direction,
  Person,
  RoomAppProps,
  RoomAppState,
  MoveSocketData,
  Poster,
  ChatGroup,
  DirectionSendSocket,
  TypingSocketSendData,
  ArrowKey,
  Cell,
  MapRoomResponse,
  MoveErrorSocketData,
  MySocketObject,
} from "../../@types/types"

import _ from "lodash-es"
import { AxiosStatic } from "axios"
import jsSHA from "jssha"

export const jwt_hash = (props: RoomAppProps): ComputedRef<string> =>
  computed((): string => {
    if (props.debug_as) {
      return props.debug_token || ""
    } else {
      const shaObj = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" })
      shaObj.update(props.idToken)
      return shaObj.getHash("HEX")
    }
  })

export const personAt = (
  people: { [user_id: string]: Person },
  pos: Point
): Person | undefined => {
  return _.find<Person>(Object.values(people), p => {
    return p.x == pos.x && p.y == pos.y
  })
}
export const posterAt = (
  posters: { [id: string]: Poster },
  pos: Point
): Poster | undefined => {
  return _.find<Poster>(Object.values(posters), p => {
    return p.x == pos.x && p.y == pos.y
  })
}

export let moveOneStep = (
  axios: AxiosStatic,
  props: RoomAppProps,
  state: RoomAppState,
  user_id: string,
  to: Point,
  direction: Direction,
  jwt_hash: string,
  on_complete: (_g: ChatGroup | undefined) => void = () => {
    /* */
  }
): boolean => {
  return false
}

export const moveTo = (
  axios: AxiosStatic,
  props: RoomAppProps,
  state: RoomAppState,
  myself: Person,
  to: Point,
  jwt_hash: string,
  on_complete: (g: ChatGroup | undefined) => void = () => {
    /* */
  },
  target?: UserId,
  immediate = false
): boolean => {
  const from = { x: myself.x, y: myself.y }
  const toCell = state.hallMap[to.y][to.x]
  if (state.batchMoveTimer) {
    clearInterval(state.batchMoveTimer)
  }
  console.log("moveTo", toCell)
  if (["wall", "water", "poster"].includes(toCell.kind)) {
    console.log("Destination not open", toCell)
    return false
  }
  if (
    to &&
    Math.abs(from.x - to.x) <= 1 &&
    Math.abs(from.y - to.y) <= 1 &&
    !personAt(state.people, to)
  ) {
    if (immediate) {
      moveOneStep(
        axios,
        props,
        state,
        myself.id,
        to,
        calcDirection(from, to),
        jwt_hash
      )
    }
    const d: MoveSocketData = {
      ...to,
      room: props.room_id,
      user: props.myUserId,
      token: jwt_hash,
      debug_as: props.debug_as,
    }
    state.move_emitted = Date.now()
    state.socket?.emit("move", d)
    return true
  } else {
    const person = personAt(state.people, to)
    const poster = posterAt(state.posters, to)
    if (person || poster) {
      console.info("Cannot move to an occupied cell", state.hallMap[to.y][to.x])
      return false
    }
    const ti = Date.now()
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
    const tf = Date.now()
    console.log(`Route finding in ${tf - ti} ms`)
    if (!points) {
      console.info("No route was found.")
      return false
    }
    console.log("# of points on route", points.length)
    let idx = 0
    state.batchMovePoints = points
    state.oneStepAccepted = true

    state.batchMoveTimer = setInterval(() => {
      console.log("batchMoveTimer")
      if (!points) {
        return
      }
      // if (state.liveMapChangedAfterMove && target) {
      //   const to_person = state.people[target]
      //   if (to_person.x != to.x || to_person.y != to.y) {
      //     console.log(
      //       "Target moved",
      //       target,
      //       _.pick(state.people[target], ["x", "y"]),
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
      idx += 1
      state.batchMovePoints = points.slice(idx)
      const p2 = points[idx]
      if (p2) {
        if (immediate) {
          moveOneStep(
            axios,
            props,
            state,
            props.myUserId,
            points[idx],
            calcDirection(points[idx - 1], p2),
            jwt_hash
          )
        }
        state.liveMapChangedAfterMove = false
        const d: MoveSocketData = {
          ...p2,
          room: props.room_id,
          user: props.myUserId,
          token: props.debug_as ? props.debug_token || "" : jwt_hash,
          debug_as: props.debug_as,
        }
        state.move_emitted = Date.now()
        state.socket?.emit("move", d)
        if (idx == points.length - 1 && state.batchMoveTimer) {
          clearInterval(state.batchMoveTimer)
          state.batchMovePoints = []
          if (state.chatAfterMove) {
            state.selectedUsers = new Set([state.chatAfterMove])
            startChat(props, state, axios)
              .then(group => {
                on_complete(group)
                if (group) {
                  state.selectedUsers.clear()
                }
              })
              .catch(() => {
                //
              })
            state.chatAfterMove = null
          } else {
            on_complete(undefined)
          }
        }
        state.oneStepAccepted = false
      }
    }, 400)
    return true
  }
}

moveOneStep = (
  axios: AxiosStatic,
  props: RoomAppProps,
  state: RoomAppState,
  user_id: string,
  to: Point,
  direction: Direction,
  jwt_hash: string,
  on_complete: (g: ChatGroup | undefined) => void = () => {
    /* */
  }
): boolean => {
  const { x, y } = to
  const p = state.people[user_id]
  if (!p) {
    return false
  }
  if (p.x != to.x || p.y != to.y || p.direction != direction) {
    Vue.set(state.people, user_id, { ...p, x, y, direction })
    if (p.id == props.myUserId) {
      state.center = {
        x: inRange(x, 5, state.cols - 6),
        y: inRange(y, 5, state.rows - 6),
      }
      if (state.hallMap[y][x].kind == "poster") {
        // state.enteredMyPoster()
      }
    }
    if (p.id != props.myUserId && _.find(state.batchMovePoints, to)) {
      console.log("Recalculate paths")
      moveTo(
        axios,
        props,
        state,
        state.people[props.myUserId],
        state.batchMovePoints[state.batchMovePoints.length - 1],
        jwt_hash,
        on_complete
      )
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}

export const moveByArrow = (
  axios: AxiosStatic,
  props: RoomAppProps,
  state: RoomAppState,
  me: Person,
  key: ArrowKey,
  jwt_hash: string
): { ok: boolean; moved: boolean; error?: "during_chat" | undefined } => {
  let dx = 0,
    dy = 0
  let moved = false
  if (myChatGroup(props, state).value) {
    return { ok: false, moved, error: "during_chat" }
  }
  const x = me.x
  const y = me.y
  if (key == "ArrowRight") {
    dx = 1
    dy = 0
    me.direction = "right"
  } else if (key == "ArrowUp") {
    dx = 0
    dy = -1
    me.direction = "up"
  } else if (key == "ArrowLeft") {
    dx = -1
    dy = 0
    me.direction = "left"
  } else if (key == "ArrowDown") {
    dx = 0
    dy = 1
    me.direction = "down"
  }
  const nx = x + dx
  const ny = y + dy
  if (nx >= 0 && nx < state.cols && ny >= 0 && ny < state.rows) {
    const la: UserId | null = lookingAt(Object.values(state.people), me)
    if (!la) {
      if (state.people_typing[props.myUserId]) {
        const d: TypingSocketSendData = {
          user: me.id,
          room: props.room_id,
          token: jwt_hash,
          typing: false,
        }
        state.socket?.emit("chat_typing", d)
      }
      state.selectedUsers.clear()
      moveTo(axios, props, state, me, { x: nx, y: ny }, jwt_hash)
      moved = true
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
      user: props.myUserId,
      room: props.room_id,
      direction: me.direction,
      token: jwt_hash,
      debug_as: props.debug_as,
    }
    state.socket?.emit("direction", d)
  }
  return { ok: true, moved }
}

export const cellsMag = (state: RoomAppState): ComputedRef<Cell[][]> =>
  computed((): Cell[][] => {
    if (state.hallMap.length == 0) {
      return []
    }
    const min_x = Math.max(0, state.center.x - 5)
    const min_y = Math.max(0, state.center.y - 5)
    const max_x = Math.min(state.hallMap[0].length - 1, state.center.x + 5)
    const max_y = Math.min(state.hallMap.length - 1, state.center.y + 5)

    return _.map(_.range(min_y, max_y + 1), y => {
      return state.hallMap[y].slice(min_x, max_x + 1)
    })
  })

const on_socket_move = (
  axios: AxiosStatic,
  props: RoomAppProps,
  state: RoomAppState,
  s: string,
  jwt_hash: string
) => {
  // console.log("on_socket_move", s)
  const pos = decodeMoved(s, props.room_id)
  if (
    !pos ||
    !state.people ||
    !state.hallMap ||
    pos.y >= state.hallMap.length ||
    pos.x >= state.hallMap[0].length
  ) {
    return
  }
  if (pos.user == props.myUserId) {
    state.oneStepAccepted = true
  }
  if (pos.user == props.myUserId && state.move_emitted) {
    const latency = Date.now() - state.move_emitted
    state.move_emitted = null
    console.log("%c" + latency + "ms socket move", "color: green")
    addLatencyLog(axios, {
      url: "socket:move",
      latency,
      timestamp: Date.now(),
    })
  }
  moveOneStep(
    axios,
    props,
    state,
    pos.user,
    { x: pos.x, y: pos.y },
    pos.direction,
    jwt_hash
  )
  if (pos.user != props.myUserId) {
    state.liveMapChangedAfterMove = true
  }
}

export const initMapService = async (
  axios: AxiosStatic,
  socket: SocketIO.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState,
  jwt_hash: ComputedRef<string>
): Promise<boolean> => {
  console.log("initMapService", socket)
  socket.on("moved", (s: string) => {
    on_socket_move(axios, props, state, s, jwt_hash.value)
  })
  socket.on("moved_multi", (s: string) => {
    const ss = s.split(";")
    for (const s of ss) {
      on_socket_move(axios, props, state, s, jwt_hash.value)
    }
  })
  socket.on("move.error", (msg: MoveErrorSocketData) => {
    console.log("move.error socket", msg)
    if (msg.user_id && msg.pos != undefined) {
      moveOneStep(
        axios,
        props,
        state,
        msg.user_id,
        { x: msg.pos.x, y: msg.pos.y },
        msg.pos.direction as Direction,
        jwt_hash.value
      )
    }
    if (msg.error.indexOf("Access denied") != -1) {
      // location.reload()
    }
  })
  const { data } = await axios.get<MapRoomResponse>("/maps/" + props.room_id)
  state.hallMap = data.cells
  state.cols = data.numCols
  state.rows = data.numRows

  return true
}
