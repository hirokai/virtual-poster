import {
  RoomAppState,
  RoomAppProps,
  PersonInMap,
  PersonUpdate,
  ActiveUsersSocketData,
  TypingSocketData,
  MySocketObject,
  UserId,
} from "../@types/types"
import { keyBy } from "../common/util"
import axiosDefault, { AxiosStatic, AxiosResponse, AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "../api/$api"

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
    if (d.id != props.myUserId && state.batchMove) {
      state.batchMove.liveMapChangedAfterMove = true
    }
  }
  const person: PersonInMap = {
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
    connected: d.connected != undefined ? d.connected : p.connected,
    poster_viewing:
      d.poster_viewing === null
        ? undefined
        : d.poster_viewing != undefined
        ? d.poster_viewing
        : p.poster_viewing,
  }
  if (d.id == props.myUserId && person.poster_viewing) {
    const client = api(axiosClient(axios))
    client.posters
      ._posterId(person.poster_viewing)
      .comments.$get()
      .then(data => {
        state.posterComments = keyBy(data, "id")
      })
      .catch(() => {
        //
      })
  }
  console.log("Setting person", person)
  //Vue.set
  state.people[d.id] = person
}

export const initPeopleService = async (
  axios: AxiosStatic | AxiosInstance,
  socket: SocketIO.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState
): Promise<boolean> => {
  socket.on("PersonNew", (ps: PersonInMap[]) => {
    for (const p of ps) {
      console.log("socket PersonNew", p)
      //Vue.set
      state.people[p.id] = p
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
      //Vue.delete
      delete state.people[uid]
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
      const person: PersonInMap = {
        ...state.people[d.user],
        connected: d.active,
      }
      //Vue.set
      state.people[d.user] = person
    }
  })

  socket.on("chat_typing", (d: TypingSocketData) => {
    if (d.room == props.room_id) {
      //Vue.set
      state.people_typing[d.user] = d.typing
    }
    console.log("chat_typing", state.people_typing)
  })

  const [r_people, { data: r_avatars }]: [
    PersonInMap[],
    AxiosResponse<{ [index: string]: string }>
  ] = await Promise.all([
    api(axiosClient(axios))
      .maps._roomId(props.room_id)
      .people.$get(),
    axiosDefault.get<{ [index: string]: string }>("/img/avatars_base64.json"),
  ])
  state.people = keyBy(
    r_people.filter(p => {
      return p.x != undefined && p.y != undefined
    }),
    "id"
  )
  console.log("r_people", r_people)
  // Adhoc fix
  //Vue.set
  state.people[props.myUserId] = {
    ...state.people[props.myUserId],
    connected: true,
  }

  // console.log("posters", r_posters)
  state.connectedUsers = Object.values(state.people)
    .filter(p => p.connected)
    .map(p => p.name)
  state.avatarImages = r_avatars

  return true
}
