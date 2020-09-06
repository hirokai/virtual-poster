import Vue from "vue"

import {
  RoomAppState,
  RoomAppProps,
  Person,
  PersonUpdate,
  ActiveUsersSocketData,
  TypingSocketData,
  MySocketObject,
  UserId,
} from "../@types/types"
import { keyBy, filter, map } from "lodash-es"
import axiosDefault, { AxiosStatic, AxiosResponse, AxiosInstance } from "axios"
import { moveOneStep } from "./room_map_service"
import { SocketIO } from "socket.io-client"

const updatePerson = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  d: PersonUpdate
) => {
  console.log("updatePerson", d)
  const p = state.people[d.id]
  if (!p) {
    console.warn("User not found (probably new user)")
    return
  }
  if (d.x != undefined && d.y != undefined && d.direction != undefined) {
    moveOneStep(axios, props, state, d.id, { x: d.x, y: d.y }, d.direction)
    if (d.id != props.myUserId) {
      state.liveMapChangedAfterMove = true
    }
  }
  const person: Person = {
    id: d.id,
    name: d.name || p.name,
    last_updated: d.last_updated,
    avatar: d.avatar || p.avatar,
    room: d.room || p.room,
    x: d.x == undefined ? p.x : d.x,
    y: d.y == undefined ? p.y : d.y,
    moving: d.moving || p.moving,
    direction: d.direction || p.direction,
    stats: d.stats || p.stats,
    public_key: d.public_key || p.public_key,
  }
  Vue.set(state.people, d.id, person)
}

export const initPeopleService = async (
  axios: AxiosStatic | AxiosInstance,
  socket: SocketIO.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState
): Promise<boolean> => {
  socket.on("PersonNew", (ps: Person[]) => {
    for (const p of ps) {
      console.log("socket PersonNew", p)
      Vue.set(state.people, p.id, p)
    }
  })
  socket.on("PersonUpdate", (ps: PersonUpdate[]) => {
    for (const p of ps) {
      console.log("socket PersonUpdate", p)
      updatePerson(axios, props, state, p)
    }
  })
  socket.on("PersonRemove", (uids: UserId[]) => {
    console.log({ msg: "PersonRemove", uids })
    for (const uid of uids) {
      Vue.delete(state.people, uid)
    }
  })
  socket.on("person_multi", ds => {
    console.log("socket people", ds)
    for (const d of ds) {
      updatePerson(axios, props, state, d)
    }
  })
  socket.on("ActiveUsers", (ds: ActiveUsersSocketData) => {
    console.log("ActiveUsers socket", ds)
    for (const d of ds) {
      const person: Person = {
        ...state.people[d.user],
        connected: d.active,
      }
      Vue.set(state.people, d.user, person)
    }
  })

  socket.on("chat_typing", (d: TypingSocketData) => {
    if (d.room == props.room_id) {
      Vue.set(state.people_typing, d.user, d.typing)
    }
    console.log("chat_typing", state.people_typing)
  })

  const [{ data: r_people }, { data: r_avatars }]: [
    AxiosResponse<Person[]>,
    AxiosResponse<{ [index: string]: string }>
  ] = await Promise.all([
    axios.get<Person[]>("/maps/" + props.room_id + "/people"),
    axiosDefault({
      method: "GET",
      url: "/img/avatars_base64.json",
    }),
  ])
  state.people = keyBy(
    filter(r_people, p => {
      return p.x != undefined && p.y != undefined
    }),
    "id"
  )
  // Adhoc fix
  Vue.set(state.people, props.myUserId, {
    ...state.people[props.myUserId],
    connected: true,
  })

  // console.log("posters", r_posters)
  state.connectedUsers = map(
    Object.values(state.people).filter(p => p.connected),
    "name"
  )
  state.avatarImages = r_avatars

  return true
}
