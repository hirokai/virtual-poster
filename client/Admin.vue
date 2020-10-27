<template>
  <div id="app" v-cloak>
    <div v-if="user">
      Email: {{ user.email }} <br />
      User ID: {{ myUserId || "N/A" }}
    </div>
    <div v-else>未ログイン</div>
    <div><button @click="signOut">Sign out</button></div>
    <div id="last_updated">
      {{ lastUpdated ? new Date(lastUpdated) : "最終更新日不明" }}
      <button @click="reload">Reload</button>
    </div>
    <div v-if="loggedIn">
      <a
        v-for="this_tab in tabs"
        :key="this_tab.id"
        class="tab"
        :class="{ selected: tab == this_tab.id }"
        @click="tab = this_tab.id"
        >{{ this_tab.name }}</a
      >
    </div>
    <div id="tabs" v-if="loggedIn">
      <div v-if="tab == 'announce'">
        <h1>アナウンス</h1>
        <select name="" id="" v-model="announceRoom">
          <option value="">部屋を選択</option>
          <option :value="room.id" v-for="room in rooms" :key="room.id">{{
            room.name
          }}</option>
          <option value="">----</option>
          <option value="__all__">すべての部屋</option>
        </select>
        <div>
          <small>※HTMLも送信可能（危険なリンクなどを送らないように注意）</small>
        </div>
        <textarea cols="60" rows="2" id="announce-input" ref="announceText" />
        <button @click="submitAnnouncement" :disabled="announceRoom == ''">
          送信
        </button>
        <div>
          <label for="marquee">文字を流す</label>
          <input type="checkbox" id="marquee" v-model="announceMarquee" /><br />
          <label for="marquee-period" :disabled="!announceMarquee"
            >周期 [秒]</label
          >
          <input
            type="number"
            max="60"
            min="3"
            id="marquee-period"
            :disabled="!announceMarquee"
            v-model="announceMarqueePeriod"
          />
        </div>
        <div>
          <button @click="askReload" :disabled="announceRoom == ''">
            会場の参加者にリロードを依頼
          </button>
        </div>
      </div>
      <div v-if="tab == 'groups'">
        <h1>チャットグループ</h1>
        <table>
          <thead>
            <tr>
              <th>グループID</th>
              <th>部屋</th>
              <th>色</th>
              <th>ユーザー</th>
              <th>位置</th>
            </tr>
          </thead>
          <tr v-for="(v, k) in chatGroups" :key="k">
            <td>{{ k }}</td>
            <td>{{ v.room }}</td>
            <td :style="{ color: v.color }">
              {{ v.color }}
            </td>
            <td>
              {{ (v.users || []).map(u => (people[u] ? people[u].name : u)) }}
            </td>
            <td>
              <span class="user-pos" v-for="u in v.users" :key="u.id">
                <span>{{ people[u] ? people[u].x : "" }}</span>
                <span>{{ people[u] ? people[u].y : "" }}</span>
              </span>
            </td>
          </tr>
        </table>
      </div>
      <Manage v-if="tab == 'manage'" :axios="axios" :idToken="idToken" />
      <ManageRooms v-if="tab == 'rooms'" :axios="axios" :idToken="idToken" />
      <MemberList
        v-if="tab == 'people'"
        :axios="axios"
        :idToken="idToken"
        :people="people"
        :rooms="rooms"
        :debug_token="debug_token"
        @loadData="reload"
      />
      <ManagePosters
        v-if="tab == 'posters'"
        :axios="axios"
        :idToken="idToken"
        :rooms="rooms"
        :posters="posters"
        :people="people"
        :jwt_hash="jwt_hash"
        @update-poster="updatePoster"
      />
      <div v-if="tab == 'socket'">
        <h1>Socket.IO</h1>
        <div id="socket-history">
          <div v-for="e in socketHistory" :key="e.time_since_start">
            <span>{{ e.timestamp }}</span>
            <span>{{ e.msg }}</span>
            <span>{{ e.data }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import axios from "axios"
import {
  Person,
  PersonWithEmail,
  ChatGroup,
  Poster,
  RoomId,
  ActiveUsersSocketData,
} from "../@types/types"

import { decodeMoved } from "../common/util"
import { AxiosInstance } from "axios"

import {
  defineComponent,
  reactive,
  onMounted,
  watch,
  toRefs,
  computed,
  ref,
} from "vue"

import Manage from "./admin/Manage.vue"
import ManageRooms from "./admin/ManageRooms.vue"
import MemberList from "./admin/MemberList.vue"
import ManagePosters from "./admin/ManagePosters.vue"

import { keyBy, difference, flatten, pickBy } from "../common/util"
import io from "socket.io-client"
const API_ROOT = "/api"
axios.defaults.baseURL = API_ROOT

import axiosClient from "@aspida/axios"
import api from "../api/$api"

const url = new URL(location.href)
const tab = url.hash.slice(1) || "people"
location.hash = "#" + tab
let socket: SocketIO.Socket | null = null

import jsSHA from "jssha"
import { deleteUserInfoOnLogout } from "./util"

export default defineComponent({
  components: {
    Manage,
    ManageRooms,
    MemberList,
    ManagePosters,
  },
  setup() {
    const state = reactive<{
      chatGroups: { [index: string]: ChatGroup }
      jwt_hash: string
      lastUpdated: number | null
      people: { [index: string]: PersonWithEmail }
      posters: { [index: string]: Poster }
      inputText: string
      rooms: { [room_id: string]: { id: RoomId; name: string } }
      loggedIn: boolean
      myUserId: string | null
      idToken: string | null
      user: { name?: string; user_id?: string; email?: string }
      announceMarquee: boolean
      announceMarqueePeriod: number
      debug_token: string
      axios: AxiosInstance
      socketHistory: {
        msg: string
        data: any
        time_since_start: number
        timestamp: number
      }[]
      tab: string
      tabs: { id: string; name: string }[]
      announceRoom: RoomId
    }>({
      jwt_hash: "",
      tab: tab,
      chatGroups: {},
      lastUpdated: null,
      people: {},
      posters: {},
      inputText: "",
      rooms: {},
      loggedIn: false,
      myUserId: null,
      idToken: null,
      user: {},
      axios,
      announceMarquee: false,
      announceMarqueePeriod: 20,
      debug_token: "",
      socketHistory: [],
      tabs: [
        { id: "rooms", name: "部屋" },
        { id: "people", name: "メンバー" },
        { id: "groups", name: "チャット" },
        { id: "socket", name: "通信" },
        { id: "announce", name: "アナウンス" },
        { id: "posters", name: "ポスター" },
      ],
      announceRoom: "",
    })

    const announceText = ref<HTMLInputElement>()

    const submitAnnouncement = () => {
      const d = {
        room: state.announceRoom,
        marquee: state.announceMarquee,
        text: announceText.value?.value,
        period: state.announceMarqueePeriod,
      }
      console.log("submitAnnouncement", d)
      socket?.emit("make_announcement", d)
    }

    const askReload = () => {
      if (state.announceRoom != "") {
        socket?.emit("AskReload", state.announceRoom)
      }
    }

    const setPerson = (p: {
      id: string
      name?: string
      last_updated: number
      email?: string
    }) => {
      const obj = pickBy(p)
      //Vue.set
      state.people[p.id] = { ...state.people[p.id], ...obj }
    }
    const on_socket_move = (s: string) => {
      const pos = decodeMoved(s)
      console.log("socket moved", pos)
      // this.$set(this.people[uid], "x", x)
      // this.$set(this.people[uid], "y", y)
      // this.$set(this.people[uid], "direction", direction)
    }

    const on_socket = (msg: string, data: any) => {
      console.log("socket", msg, data)
      const client = api(axiosClient(axios))
      state.socketHistory.push({
        msg,
        data,
        time_since_start: window.performance.now(),
        timestamp: Date.now(),
      })
      if (msg == "moved_multi") {
        const ss = (data as string).split(";")
        for (const s of ss) {
          on_socket_move(s)
        }
      } else if (msg == "moved") {
        on_socket_move(data as string)
      } else if (msg == "person") {
        const p = data as Person
        client.people
          ._userId(p.id)
          .$get({ query: { email: true } })
          .then(data => {
            setPerson(data as PersonWithEmail)
          })
          .catch(console.error)
      } else if (msg == "person_multi") {
        const ps = data as Person[]
        const ids_concat = ps.map(p => p.id).join(",")
        client.people_multi
          ._userIds(ids_concat)
          .$get({ query: { email: true } })
          .then(p1 => {
            console.log("get people", p1)
            for (const p of p1) {
              setPerson(p)
            }
          })
          .catch(console.error)
      } else if (msg == "group") {
        const group = data as ChatGroup
        //Vue.set
        state.chatGroups[group.id] = group
      } else if (msg == "group.remove") {
        const group_id = data as string
        //Vue.delete
        delete state.chatGroups[group_id]
      } else if (msg == "poster") {
        const poster = data as Poster
        console.log(poster)
        //Vue.set
        state.posters[poster.id] = poster
      } else if (msg == "posters.reset") {
        //
      } else if (msg == "active_users") {
        console.log("socket", msg, data)
        const ds = data as ActiveUsersSocketData
        for (const d of ds) {
          const person: Person = {
            ...state.people[d.user],
            connected: d.active,
          }
          //Vue.set
          state.people[d.user] = person
        }
      }
    }

    const signOut = async () => {
      const client = api(axiosClient(axios))
      const r = await client.logout.$post()
      if (r.ok) {
        console.log("Signed out")
        deleteUserInfoOnLogout()
        location.href = "/login"
      } else {
        console.log("Did not sign out")
      }
    }

    const reload = async () => {
      state.lastUpdated = Date.now()
      const client = api(axiosClient(axios))
      const data_r = await client.maps.$get()
      state.rooms = keyBy(data_r, "id")
      const [data_p, data_g, data_posters] = await Promise.all([
        client.people.$get({ query: { email: true } }),
        client.groups.$get(),
        client.posters.$get(),
      ])
      state.people = keyBy(data_p, "id")
      console.log(state.people)
      const jwt_hash: string | undefined =
        localStorage["virtual-poster:jwt_hash"]
      if (jwt_hash) {
        for (const room of Object.keys(state.rooms)) {
          socket?.emit("Active", {
            user: state.myUserId,
            room,
            token: jwt_hash,
          })
        }
      }
      state.chatGroups = keyBy(data_g, "id")
      state.posters = keyBy(data_posters, "id")
    }

    const updatePoster = (poster: Poster) => {
      state.posters[poster.id] = poster
    }

    const notInChat = computed(() => {
      const inChat = flatten(
        Object.values(state.chatGroups).map(g => g.users)
      ).map(u => state.people[u]?.name)
      return difference(
        Object.values(state.people).map(p => p.name),
        inChat
      )
    })

    watch(
      () => state.tab,
      (newTab: string) => {
        location.hash = newTab
      }
    )

    onMounted(() => {
      const client = api(axiosClient(axios))
      client.socket_url
        .$get()
        .then(data => {
          socket = io(data.socket_url, {
            path: "/socket.io",
            transports: ["websocket"],
          })
          if (!socket) {
            console.error("Socket connection failed.")
            return
          }
          for (const k of [
            "Person",
            "group",
            "group.remove",
            "comment",
            "active_users",
            "poster",
            "Moved",
          ]) {
            socket.on(k, d => {
              on_socket(k, d)
            })
          }
        })
        .catch(err => {
          console.error(err)
        })
      ;(async () => {
        const user = {
          name: localStorage["virtual-poster:name"],
          user_id: localStorage["virtual-poster:user_id"],
          email: localStorage["virtual-poster:email"],
        }
        state.user = user
        console.warn("User:", user)
        const client = api(axiosClient(axios))
        const data = await client.debug_token.$get()
        state.debug_token = data.debug_token
        state.myUserId = user.user_id || null
        await reload()
        state.loggedIn = !!user
      })().catch(err => {
        console.error(err)
      })
    })
    return {
      API_ROOT,
      ...toRefs(state),
      reload,
      notInChat,
      signOut,
      submitAnnouncement,
      updatePoster,
      announceText,
      askReload,
    }
  },
})
</script>
<style lang="css">
[v-cloak] {
  display: none;
}
h1 {
  font-size: 20px;
}

h2 {
  font-size: 14px;
  margin: 12px 0px 2px 0px;
}

#tabs h2 {
  font-size: 14px;
}

h1 {
  font-size: 20px;
}

#last_updated {
  float: right;
}
#last_updated + div {
  clear: both;
}
table {
  width: 90%;
}
.user-pos {
  font-size: 12px;
  display: inline-block;
  width: 80px;
}

.user-pos > span {
  display: inline-block;
  text-align: right;
  width: 30px;
}
textarea {
  /* width: 500px; */
  font-size: 20px;
}
#marquee-period {
  width: 80px;
  font-size: 20px;
}
table {
  font-size: 14px;
}
th {
  text-align: left;
}
table,
th,
td {
  border-collapse: collapse;
  margin: 0px;
  border-top: black solid 1px;
  border-bottom: black solid 1px;
}

.error {
  color: red;
}

#socket-history {
  font-size: 10px;
  height: 400px;
  overflow: scroll;
}
#socket-history div span {
  margin: 3px 10px;
}
.tab {
  font-size: 16px;
  font-weight: bold;
  display: inline-block;
  cursor: pointer;
  width: 120px;
  margin: 3px;
  padding: 5px;
  border-top: 1px solid black;
  border-left: 1px solid black;
  border-right: 1px solid black;
  border-radius: 5px 5px 0px 0px;
}

.tab.selected {
  border-top: 2px solid black;
  border-left: 2px solid black;
  border-right: 2px solid black;
  background: #99f;
}

label[disabled="true"] {
  color: #999;
}

.r0 {
  width: 40px;
}

.r0.show-on-hover > span.show-on-hover-child {
  visibility: hidden;
  cursor: pointer;
}

.r0.show-on-hover:hover > span.show-on-hover-child {
  visibility: visible;
}

.r1 {
  font-size: 12px;
  width: 60px;
}

.r2 {
  font-weight: bold;
  width: 120px;
}

.r3 {
  width: 120px;
}

.r4,
.r5 {
  width: 40px;
}

div.poster {
  border: 1px solid black;
  width: 210px;
  height: 297px;
  margin: 10px;
  float: left;
}

div.poster img {
  max-width: 100%;
  max-height: 100%;
}

.poster_info {
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.2);
  width: 208px;
  background: rgba(255, 255, 255, 0.5);
}

.poster_author {
  margin: 0px;
}

.poster_title {
  margin: 0px;
}

#people input {
  width: 90%;
}

.edit-btn {
  cursor: pointer;
  font-size: 12px;
  border: 1px #555 solid;
  border-radius: 3px;
  padding: 2px;
}

.file_upload {
  border: 1px solid #444;
  margin: 10px;
  padding: 10px;
  width: 400px;
}
</style>
