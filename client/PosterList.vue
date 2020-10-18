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
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="poster in postersSorted" :key="poster.id" class="poster_row">
          <td>{{ poster.poster_number }}</td>
          <td>{{ poster.x }}</td>
          <td>{{ poster.y }}</td>
          <td>
            {{ people[poster.author] ? people[poster.author].name : "" }}
          </td>
          <td>
            {{ poster.title }}
          </td>
          <td><button @click="clickMove(poster.id)">移動</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, onMounted, toRefs, computed } from "vue"
import {
  Person,
  PersonInMap,
  PersonUpdate,
  RoomId,
  Poster as PosterTyp,
  Room,
  PosterId,
  Poster,
} from "../@types/types"

import axios from "axios"
import axiosClient from "@aspida/axios"
import api from "../api/$api"
const client = api(axiosClient(axios))
import jsSHA from "jssha"

import { keyBy, sortBy } from "../common/util"
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
  setup() {
    const client = api(axiosClient(axios))
    const state = reactive({
      rooms: {} as { [index: string]: Room },
      room_id: room_id as RoomId,
      people: {} as { [index: string]: PersonInMap },
      posters: {} as { [index: string]: PosterTyp },
      inputText: "",
      inputFocused: false,
    })
    const setPerson = (d: PersonUpdate) => {
      console.log("setPerson", d)
      const p = state.people[d.id]
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
      }
      //Vue.set
      state.people[d.id] = person
    }

    const loadData = () => {
      if (!room_id) {
        alert("部屋IDが指定されていません")
        return
      }
      Promise.all([
        client.maps.$get(),
        client.maps._roomId(room_id).people.$get(),
        client.maps._roomId(room_id).posters.$get(),
      ])
        .then(([r_rooms, r_people, r_posters]) => {
          state.people = keyBy(
            r_people.filter(p => {
              return p.x != undefined && p.y != undefined
            }),
            "id"
          )
          console.log("posters", r_posters)
          state.posters = keyBy(r_posters, "id")
          state.rooms = keyBy(r_rooms, "id")
        })
        .catch(err => {
          console.log("load error", err)
          // alert("マップまたはその他のデータが見つかりません。")
        })
    }
    const postersSorted = computed(() => {
      return sortBy(Object.values(state.posters), p => p.poster_number)
    })

    const user_id = localStorage["virtual-poster:user_id"]

    const myself = computed(
      (): Person => {
        return state.people[user_id]
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
      const name = localStorage["virtual-poster:name"]
      const user_id = localStorage["virtual-poster:user_id"]
      const email = localStorage["virtual-poster:email"]

      client.socket_url
        .$get()
        .then(data => {
          const url = data.socket_url as string
          const socket = io(url)
          if (!socket) {
            console.error("Socket connection failed.")
            return
          }
          socket.on("connect", () => {
            socket?.emit("Active", {
              room: "::mypage",
              user: user_id,
              token: localStorage["virtual-poster:jwt_hash"] as
                | string
                | undefined,
            })
            socket?.emit("Subscribe", {
              channel: room_id,
            })
            console.log("Connected")
          })
          socket.on("Poster", (p: Poster) => {
            //Vue.set
            state.posters[p.id] = p
          })
          socket.on("PosterRemove", (pid: PosterId) => {
            //Vue.delete
            delete state.posters[pid]
          })
          socket.on("connection", () => {
            console.log("SOCKET CONNECTED")
          })
          socket.on("PersonUpdate", (ds: PersonUpdate[]) => {
            console.log("socket PersonUpdate", ds)
            for (const d of ds) {
              setPerson(d)
            }
          })
        })
        .catch(err => {
          console.error(err)
        })
      loadData()
    })
    const clickMove = async (pid: PosterId) => {
      const r = await client.maps
        ._roomId(room_id!)
        .posters._posterId(pid)
        .approach.$post()
      console.log(r)
    }
    return { ...toRefs(state), postersSorted, myself, uploadPoster, clickMove }
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

tr.poster_row {
  cursor: pointer;
}

th {
  text-align: left;
}
</style>
