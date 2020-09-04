<template>
  <div id="app-main" v-cloak>
    <h1>
      {{ rooms[room_id] ? rooms[room_id].name : "読込中..." }}: ポスターリスト
    </h1>
    <table>
      <thead>
        <tr>
          <th>番号</th>
          <th>X座標</th>
          <th>Y座標</th>
          <th>発表者</th>
          <th>タイトル</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="poster in postersSorted" :key="poster.id">
          <td>{{ poster.poster_number }}</td>
          <td>{{ poster.x }}</td>
          <td>{{ poster.y }}</td>
          <td>
            {{ people[poster.author] ? people[poster.author].name : "" }}
          </td>
          <td>
            {{ poster.title }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import Vue from "vue"
import {
  defineComponent,
  reactive,
  onMounted,
  set,
  toRefs,
  computed,
} from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)
import {
  Person,
  PersonUpdate,
  RoomId,
  Poster as PosterTyp,
  Room,
} from "../@types/types"

import axios from "axios"
import { AxiosResponse } from "axios"
import _ from "lodash-es"
import io from "socket.io-client"

const API_ROOT = "/api"

axios.defaults.baseURL = API_ROOT

const url = new URL(location.href)
const room_id: RoomId | null = url.searchParams.get("room_id")
if (!room_id) {
  alert("Room IDが不正です。")
  location.href = "/"
}

export default defineComponent({
  props: {
    myUserId: {
      type: String,
      required: true,
    },
    idToken: {
      type: String,
      required: true,
    },
    socketURL: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const state = reactive({
      rooms: {} as { [index: string]: Room },
      room_id: room_id as RoomId,
      socket: io(props.socketURL, { path: "/socket.io" }) as SocketIO.Socket,
      people: {} as { [index: string]: Person },
      posters: {} as { [index: string]: PosterTyp },
      inputText: "",
      inputFocused: false,
    })
    axios.defaults.headers.common = {
      Authorization: `Bearer ${props.idToken}`,
    }
    const loadData = () => {
      Promise.all([
        axios.get<Room[]>("/maps"),
        axios.get<Person[]>("/maps/" + room_id + "/people"),
        axios.get<PosterTyp[]>("/maps/" + room_id + "/posters"),
      ])
        .then(
          ([{ data: r_rooms }, { data: r_people }, { data: r_posters }]: [
            AxiosResponse<Room[]>,
            AxiosResponse<Person[]>,
            AxiosResponse<PosterTyp[]>
          ]) => {
            state.people = _.keyBy(
              _.filter(r_people, p => {
                return p.x != undefined && p.y != undefined
              }),
              "id"
            )
            console.log("posters", r_posters)
            state.posters = _.keyBy(r_posters, "id")
            state.rooms = _.keyBy(r_rooms, "id")
          }
        )
        .catch(err => {
          console.log("load error", err)
          // alert("マップまたはその他のデータが見つかりません。")
        })
    }
    const postersSorted = computed(() => {
      return _.sortBy(Object.values(state.posters), p => p.poster_number)
    })

    const setPerson = (d: PersonUpdate) => {
      console.log("setPerson", d)
      const p = state.people[d.id]
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
      set(state.people, d.id, person)
    }
    const myself = computed(
      (): Person => {
        return state.people[props.myUserId]
      }
    )
    const uploadPoster = (file: File, poster_id: string) => {
      console.log(file, poster_id)
      const fd = new FormData()
      fd.append("file", file)
      console.log("uploadPoster", fd)

      axios
        .post("/posters/" + poster_id + "/file", fd, {
          headers: { "content-type": "multipart/form-data" },
        })
        .then(({ data }) => {
          console.log(data)
        })
        .catch(err => {
          console.error(err)
        })
    }
    onMounted(() => {
      const socket = state.socket
      if (!socket) {
        alert("Socket connection failed")
        return
      }
      window["socket"] = state.socket

      loadData()
      socket.on("person", d => {
        console.log("socket person", d.name)
        setPerson(d)
      })
      socket.on("person_multi", ds => {
        console.log("socket people", ds.length)
        for (const d of ds) {
          setPerson(d)
        }
      })
      socket.on("poster", (d: PosterTyp) => {
        console.log("socket poster", d)
        set(state.posters, d.id, d)
      })

      socket.on("greeting", () => {
        socket.emit("active", props.myUserId)
      })
    })
    return { ...toRefs(state), postersSorted, myself, uploadPoster }
  },
})
</script>

<style>
@font-face {
  font-family: "PixelMplus";
  src: url(/PixelMplus12-Regular.ttf);
}

/* @import url("cell.css"); */

body {
  font-family: "YuGothic", Loto, sans-serif;
  min-width: 1220px;
}

h1 {
  font-size: 24px;
}

tr:nth-child(even) {
  background: #eee;
}
tr:nth-child(odd) {
  background: #fff;
}

th {
  text-align: left;
}
</style>
