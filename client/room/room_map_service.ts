import { computed, ComputedRef, nextTick } from "vue"
import {
  calcDirection,
  inRange,
  findRoute,
  decodeMoved,
  personAt,
  posterAt,
  isUserId,
  isOpenCell,
  lookingAt,
  updateMapCell,
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
  Person,
  MapUpdateSocketData,
  MapReplaceSocketData,
} from "@/@types/types"

import { getClosestAdjacentPoints, isAdjacent, range } from "@/common/util"

const BATCH_MOVE_INTERVAL = 300
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

export const personInFront: (
  props: RoomAppProps,
  state: RoomAppState
) => ComputedRef<PersonInMap | undefined> = (
  props: RoomAppProps,
  state: RoomAppState
) =>
  computed(() => {
    const me = state.people[props.myUserId]
    const p = me ? lookingAt(me) : undefined
    return p ? personAt(state.people, p) : undefined
  })

export const objectCellInFront: (
  props: RoomAppProps,
  state: RoomAppState
) => ComputedRef<{ cell?: Cell; object: boolean }> = (
  props: RoomAppProps,
  state: RoomAppState
) =>
  computed<{ cell?: Cell; object: boolean }>(() => {
    const me = state.people[props.myUserId]
    const p = me ? lookingAt(me) : undefined
    const c = p
      ? state.hallMap[p.y]
        ? state.hallMap[p.y][p.x]
        : undefined
      : undefined
    if (c) {
      if (c.link_url || c.poster_number) {
        return { cell: c, object: true }
      } else {
        return { cell: c, object: false }
      }
    }
    return { object: false }
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
  return (
    msg: string,
    timeout = 5000,
    color: string | undefined = undefined
  ): void => {
    state.message.text = msg
    state.message.color = color
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

export function showMyStatus(props: RoomAppProps, state: RoomAppState) {
  return (
    person: PersonInMap,
    in_menu: boolean,
    timeout = 5000,
    color: string | undefined = undefined
  ): void => {
    state.people[person.id] = person
  }
}

export function showPersonInfo(props: RoomAppProps, state: RoomAppState) {
  return (
    person: Person,
    in_menu: boolean,
    timeout = 5000,
    color: string | undefined = undefined
  ): void => {
    state.personInfo.person = person
    state.personInfo.color = color
    if (!in_menu) {
      state.personInfo.hide = false
      if (state.personInfo.timer) {
        window.clearTimeout(state.personInfo.timer)
        state.personInfo.timer = undefined
      }
      if (timeout > 0) {
        state.personInfo.timer = window.setTimeout(() => {
          if (state.personInfo) {
            state.personInfo.hide = true
            state.personInfo.person = undefined
          }
        }, timeout)
      }
    }
  }
}

export function showObjectInfo(props: RoomAppProps, state: RoomAppState) {
  return (
    cell: Cell,
    in_menu: boolean,
    timeout = 5000,
    color: string | undefined = undefined
  ): void => {
    state.objectInfo.url = cell.link_url || ""
    state.objectInfo.text =
      cell.kind == "poster"
        ? "ポスター板：番号" +
          (cell.poster_number == undefined ? "不明" : cell.poster_number)
        : ""
    state.objectInfo.color = color
    if (!in_menu) {
      state.objectInfo.hide = false
      if (state.objectInfo.timer) {
        window.clearTimeout(state.objectInfo.timer)
        state.objectInfo.timer = undefined
      }
      if (timeout > 0) {
        state.objectInfo.timer = window.setTimeout(() => {
          if (state.objectInfo) {
            state.objectInfo.hide = true
            state.objectInfo.text = ""
          }
        }, timeout)
      }
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
      const pid = _adjacentPoster.value?.id || null
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
  if (!r.ok) {
    console.warn("Cannot start viewing a poster", r.error)
    return
  }

  if (r.image_url) {
    state.posters[pid].file_url = r.image_url
  }

  if (props.isMobile) {
    location.hash = "poster"
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
  if ((person && person.connected) || poster || !isOpenCell(toCell)) {
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
  const old_direction = me.direction
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
  const la = { x: nx, y: ny }
  const la_person: PersonInMap | undefined = personAt(state.people, la)
  const la_poster: Poster | undefined = posterAt(state.posters, la)
  if (nx >= 0 && nx < state.cols && ny >= 0 && ny < state.rows) {
    if (la_poster || (la_person && old_direction != me.direction)) {
      moved = false
    } else {
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

const highlightMinimap = (props: RoomAppProps, state: RoomAppState) => (
  regions: [number, number][][]
) => {
  state.miniMapHighlighted = regions
  if (state.miniMapHighlightedTimer) {
    window.clearInterval(state.miniMapHighlightedTimer)
    state.miniMapHighlightedTimer = undefined
  }
  let count = 0
  state.miniMapHighlightedTimer = window.setInterval(() => {
    count += 1
    state.miniMapHighlighted =
      count % 2 == 0
        ? (state.miniMapHighlighted = regions)
        : (state.miniMapHighlighted = undefined)
    if (count > 10) {
      window.clearInterval(state.miniMapHighlightedTimer)
      state.miniMapHighlightedTimer = undefined
    }
  }, 800)
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
    return
  }
  if (pos.user == props.myUserId && state.move_emitted) {
    const max_y = Math.min(state.rows - 1, pos.y + state.viewDistance)
    const max_x = Math.min(state.cols - 1, pos.x + state.viewDistance)
    for (let y = Math.max(0, pos.y - state.viewDistance); y <= max_y; y++) {
      for (let x = Math.max(0, pos.x - state.viewDistance); x <= max_x; x++) {
        state.cellVisibility[y][x] = "visible"
      }
    }
    state.cellVisibility[pos.y][pos.x] = "visited"

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

    if (state.people_typing[props.myUserId]) {
      const d: TypingSocketSendData = {
        user: me.id,
        room: props.room_id,
        typing: false,
      }
      state.socket?.emit("ChatTyping", d)
    }

    if (!poster && poster_location != undefined) {
      if (!state.room?.allow_poster_assignment) {
        alert(
          state.locale == "ja"
            ? "この会場では参加者によるポスターの確保はできません。"
            : "You cannot take a poster board in this room."
        )
        return
      }
      const r = confirm(
        state.locale == "ja"
          ? `このポスター板（${poster_location}番）を確保しますか？`
          : `Do you want to take this poster board (#${poster_location})?`
      )
      if (!r) {
        return
      }
      const r2 = await client.maps
        ._roomId(props.room_id)
        .poster_slots._posterNumber(poster_location)
        .$post({ body: {} })
      if (r2.ok) {
        showMessage(
          props,
          state
        )(`ポスター板（${poster_location}番）を確保しました。`)
      } else {
        if (r2.allowed_regions) {
          highlightMinimap(
            props,
            state
          )(r2.allowed_regions as [number, number][][])
        }
        if (r2.suggested_message) {
          alert(r2.suggested_message)
        } else {
          alert("ポスター板を確保できませんでした。")
        }
      }
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
              showMessage(
                props,
                state
              )(state.locale == "ja" ? "会話を開始しました。" : "Started chat.")
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
  socket.on("Room", (data: RoomUpdateSocketData) => {
    if (data.id != props.room_id) {
      return
    }
    if (data.allow_poster_assignment != undefined) {
      state.room!.allow_poster_assignment = data.allow_poster_assignment
    }
    if (data.minimap_visibility != undefined) {
      state.room!.minimap_visibility = data.minimap_visibility
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
    const p = state.posters[d.to_poster]
    await dblClickHandler(props, state, axios)({ x: p.x, y: p.y })
  })

  socket.on("MapUpdate", async (d: MapUpdateSocketData) => {
    if (d.room == props.room_id) {
      for (const c of d.changes) {
        const obj = state.hallMap[c.y][c.x]
        updateMapCell(obj, c)
      }
    }
    await nextTick(() => {
      if (d.message) {
        alert(d.message)
      }
    })
  })

  const client = api(axiosClient(axios))

  socket.on("MapReplace", async (d: MapReplaceSocketData) => {
    if (d.room == props.room_id) {
      const data = await client.maps._roomId(props.room_id).cells.$get()
      state.hallMap = data.cells
      state.cols = data.numCols
      state.rows = data.numRows
    }
    if (d.message) {
      alert(d.message)
    }
  })

  const [data_meta, data] = await Promise.all([
    client.maps._roomId(props.room_id).$get(),
    client.maps._roomId(props.room_id).cells.$get(),
  ])
  state.room = {
    allow_poster_assignment: data_meta.allow_poster_assignment,
    move_log: data_meta.move_log,
    minimap_visibility: data_meta.minimap_visibility,
    name: data_meta.name,
  }
  state.hallMap = data.cells

  state.cols = data.numCols
  state.rows = data.numRows
  state.viewDistance = 5

  state.cellVisibility = data.cells.map(row => {
    return row.map(() => {
      return "not_visited"
    })
  })

  for (const row of data.cells) {
    for (const c of row) {
      if (c.visited == "visited") {
        const max_y = Math.min(state.rows - 1, c.y + state.viewDistance)
        const max_x = Math.min(state.cols - 1, c.x + state.viewDistance)
        for (let y = Math.max(0, c.y - state.viewDistance); y <= max_y; y++) {
          for (let x = Math.max(0, c.x - state.viewDistance); x <= max_x; x++) {
            state.cellVisibility[y][x] = "visible"
          }
        }
        state.cellVisibility[c.y][c.x] = "visited"
      }
    }
  }

  state.notifications = await client.maps
    ._roomId(props.room_id)
    .notifications.$get()
    .catch(() => [])

  return true
}
