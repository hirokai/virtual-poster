import {
  RoomAppState,
  RoomAppProps,
  PersonInMap,
  PersonUpdate,
  ActiveUsersSocketData,
  TypingSocketData,
  MySocketObject,
  UserId,
} from "@/@types/types"
import { keyBy } from "@/common/util"
import axiosDefault, { AxiosStatic, AxiosResponse, AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"

import { moveOneStep } from "./room_map_service"

const updatePerson = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  d: PersonUpdate
) => {
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
    role: d.role || p.role,
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
  state.people[d.id] = person
}

export const initPeopleService = async (
  axios: AxiosStatic | AxiosInstance,
  socket: SocketIOClient.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState
): Promise<boolean> => {
  socket.on("PersonNew", (ps: PersonInMap[]) => {
    for (const p of ps) {
      state.people[p.id] = p
    }
  })
  socket.on("PersonUpdate", (ps: PersonUpdate[]) => {
    for (const p of ps) {
      updatePerson(axios, props, state, p)
    }
  })
  socket.on("PersonRemove", (uids: UserId[]) => {
    for (const uid of uids) {
      if (uid == props.myUserId) {
        alert(
          state.locale == "ja"
            ? "会場から退出させられました"
            : "You have been removed from the room."
        )
        location.href = "/"
      }
      delete state.people[uid]
    }
  })
  socket.on("person_multi", ds => {
    for (const d of ds) {
      updatePerson(axios, props, state, d)
    }
  })
  socket.on("ActiveUsers", (ds: ActiveUsersSocketData) => {
    for (const d of ds.users) {
      const p = state.people[d.user]
      if (p) {
        const person: PersonInMap = {
          ...p,
          connected: d.active,
        }
        //Vue.set
        state.people[d.user] = person
      }
    }
  })

  socket.on("ChatTyping", (d: TypingSocketData) => {
    if (d.room == props.room_id) {
      //Vue.set
      state.people_typing[d.user] = d.typing
    }
  })

  const [{ people, people_deleted }, { data: r_avatars }] = await Promise.all([
    api(axiosClient(axios))
      .maps._roomId(props.room_id)
      .people.$get(),
    axiosDefault.get<{ [index: string]: string }>("/img/avatars_base64.json"),
  ])
  state.people = keyBy(people, "id")
  state.people_deleted = keyBy(people_deleted, "id")
  // console.log("r_people", r_people)
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
