<template>
  <div id="app-main" v-cloak>
    <h1>{{ room ? room.name : "読込中..." }}: ポスターリスト</h1>
    <table>
      <thead>
        <tr>
          <th>番号</th>
          <th>X座標</th>
          <th>Y座標</th>
          <th>発表者</th>
          <th>タイトル</th>
          <th v-if="posterAwardSelection">ポスター賞応募</th>
          <th>画像</th>
          <th>足あと記録</th>
          <th>閲覧済</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="6">読込中</td>
        </tr>
        <tr v-else-if="postersSorted.length == 0">
          <td colspan="6">ポスターはありません</td>
        </tr>
        <tr
          v-for="poster in postersSorted"
          :key="poster.id"
          class="poster_row"
          :class="{ not_visited: !visibleRegion(poster) }"
        >
          <td>{{ poster.poster_number }}</td>
          <td>
            {{ visibleRegion(poster) ? poster.x : "?" }}
          </td>
          <td>
            {{ visibleRegion(poster) ? poster.y : "?" }}
          </td>
          <td>
            {{
              visibleRegion(poster)
                ? people[poster.author]
                  ? people[poster.author].name
                  : ""
                : "?"
            }}
          </td>
          <td>
            {{
              visibleRegion(poster)
                ? poster.title
                : "未探索のエリアです（探索すると詳細が表示されます）"
            }}
          </td>
          <td v-if="visibleRegion(poster) && posterAwardSelection">
            <span
              v-if="poster.metadata?.poster_award_nominated"
              style="color: rgb(0, 133, 205); font-size: 18px"
              >&#x2714;</span
            >
          </td>
          <td v-if="visibleRegion(poster)">
            <span v-if="poster.file_url" style="color: #0c0; font-size: 18px"
              >&#x2714;</span
            >
            <span
              v-if="poster.file_url && poster.file_size != undefined"
              style="float: right; font-size: 80%; vertical-align: 0px"
            >
              ({{ Math.round(poster.file_size / 1000).toLocaleString() }} kB)
            </span>
          </td>
          <td v-else>&nbsp;</td>
          <td v-if="visibleRegion(poster)">
            <span
              v-if="poster.access_log"
              style="color: orange; font-weight: bold"
              >記録あり</span
            >
          </td>
          <td v-else>&nbsp;</td>
          <span
            v-if="visibleRegion(poster) && poster.viewed"
            style="color: #0c0; font-size: 18px"
            >&#x2714;</span
          >
          <td v-else>&nbsp;</td>
          <td v-if="visibleRegion(poster)">
            <button class="button is-small" @click="clickMove(poster.id)">
              移動
            </button>
          </td>
          <td v-else>&nbsp;</td>
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
  MinimapVisibility,
  CellVisibility,
  Point,
} from "../@types/types"

import axios from "axios"
import axiosClient from "@aspida/axios"
import api from "../api/$api"

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
      loading: true,
      people: {} as { [index: string]: PersonInMap },
      posters: {} as { [index: string]: PosterTyp },
      inputText: "",
      inputFocused: false,
      room: {} as {
        name?: string
        move_log?: boolean
        allow_poster_assignment?: boolean
        minimap_visibility?: MinimapVisibility
      },
      //FIXME: This should be variable
      viewDistance: 5,
      cellVisibility: [] as CellVisibility[][],
    })
    const setPerson = (d: PersonUpdate) => {
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

    const loadData = async () => {
      if (!room_id) {
        alert("部屋IDが指定されていません")
        state.loading = false
        return
      }
      const [data_meta, r_people, r_posters, data] = await Promise.all([
        client.maps._roomId(room_id).$get(),
        client.maps._roomId(room_id).people.$get(),
        client.maps._roomId(room_id).posters.$get(),
        client.maps._roomId(room_id).cells.$get(),
      ])
      state.people = keyBy(
        r_people.filter(p => {
          return p.x != undefined && p.y != undefined
        }),
        "id"
      )
      state.posters = keyBy(r_posters, "id")
      state.loading = false

      state.room = {
        allow_poster_assignment: data_meta.allow_poster_assignment,
        move_log: data_meta.move_log,
        minimap_visibility: data_meta.minimap_visibility,
        name: data_meta.name,
      }

      state.cellVisibility = data.cells.map(row => {
        return row.map(() => {
          return "not_visited"
        })
      })

      for (const row of data.cells) {
        for (const c of row) {
          if (c.visited == "visited") {
            const max_y = Math.min(
              data_meta.numRows - 1,
              c.y + state.viewDistance
            )
            const max_x = Math.min(
              data_meta.numCols - 1,
              c.x + state.viewDistance
            )
            for (
              let y = Math.max(0, c.y - state.viewDistance);
              y <= max_y;
              y++
            ) {
              for (
                let x = Math.max(0, c.x - state.viewDistance);
                x <= max_x;
                x++
              ) {
                state.cellVisibility[y][x] = "visible"
              }
            }
            state.cellVisibility[c.y][c.x] = "visited"
          }
        }
      }
    }
    const postersSorted = computed(() => {
      return sortBy(Object.values(state.posters), p => p.poster_number)
    })

    const posterAwardSelection = computed(() => {
      return (
        Object.values(state.posters).filter(
          p => p.metadata?.poster_award_nominated
        ).length > 0
      )
    })

    const user_id = localStorage["virtual-poster:user_id"]

    const myself = computed(
      (): Person => {
        return state.people[user_id]
      }
    )

    onMounted(async () => {
      const user_id = localStorage["virtual-poster:user_id"]

      const data = await client.socket_url.$get()
      const url = data.socket_url as string
      const socket = io(url, { transports: ["websocket"] })
      if (!socket) {
        console.error("Socket connection failed.")
        return
      }
      socket.on("connect", () => {
        socket?.emit("Active", {
          room: "::mypage",
          user: user_id,
          token: localStorage["virtual-poster:jwt_hash"] as string | undefined,
        })
        socket?.emit("Active", {
          room: room_id,
          user: user_id,
          token: localStorage["virtual-poster:jwt_hash"] as string | undefined,
        })
        // socket?.emit("Subscribe", {
        //   channel: room_id,
        // })
        console.log("Socket connected")
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
        console.log("Socket connected")
      })
      socket.on("PersonUpdate", (ds: PersonUpdate[]) => {
        console.log("socket PersonUpdate", ds)
        for (const d of ds) {
          setPerson(d)
        }
      })
      await loadData()
    })

    const visibleRegion = (p: Point): boolean => {
      if (state.room.minimap_visibility == "all_initial") {
        return true
      }
      const v = state.cellVisibility[p.y][p.x]
      return v == "visited" || v == "visible" || v == "action_done"
    }

    const clickMove = async (pid: PosterId) => {
      const r = await client.maps
        ._roomId(room_id!)
        .posters._posterId(pid)
        .approach.$post()
      console.log(r)
    }
    return {
      ...toRefs(state),
      postersSorted,
      myself,
      clickMove,
      visibleRegion,
      posterAwardSelection,
    }
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

.poster_row.not_visited {
  color: #999;
}
</style>
