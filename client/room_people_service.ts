import Vue from "vue"

import {
  RoomAppState,
  RoomAppProps,
  Person,
  PersonUpdate,
  ActiveUsersSocketData,
  TypingSocketData,
  MySocketObject,
} from "../@types/types"
import _ from "lodash-es"
import axiosDefault, { AxiosStatic, AxiosResponse, AxiosInstance } from "axios"
import { moveOneStep, jwt_hash } from "./room_map_service"
import { SocketIO } from "socket.io-client"

const PRODUCTION = process.env.NODE_ENV == "production"
const BASE_URL = PRODUCTION ? "/" : "http://localhost:3000/"

const setPerson = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  d: PersonUpdate
) => {
  console.log("setPerson", d)
  const p = state.people[d.id]
  if (d.x != undefined && d.y != undefined && d.direction != undefined) {
    moveOneStep(
      axios,
      props,
      state,
      d.id,
      { x: d.x, y: d.y },
      d.direction,
      jwt_hash(props).value
    )
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
  }
  Vue.set(state.people, d.id, person)
}

export const initPeopleService = async (
  axios: AxiosStatic | AxiosInstance,
  socket: SocketIO.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState
): Promise<boolean> => {
  socket.on("person", d => {
    console.log("socket person", d.name)
    setPerson(axios, props, state, d)
  })
  socket.on("person_multi", ds => {
    console.log("socket people", ds)
    for (const d of ds) {
      setPerson(axios, props, state, d)
    }
  })
  socket.on("active_users", (ds: ActiveUsersSocketData) => {
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
  state.people = _.keyBy(
    _.filter(r_people, p => {
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
  state.connectedUsers = _.map(
    Object.values(state.people).filter(p => p.connected),
    "name"
  )
  state.avatarImages = r_avatars

  return true
}
