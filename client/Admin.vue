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
        <p>HTMLも送信可能（危険なリンクなどを送らないように注意）</p>
        <textarea cols="60" rows="2" id="announce-input" v-model="inputText" />
        <button @click="submitAnnouncement">送信</button>
        <div>
          <label for="marquee">文字を流す</label>
          <input type="checkbox" id="marquee" v-model="announceMarquee" /><br />
          <label for="marquee-period">周期 [秒]</label>
          <input
            type="number"
            max="60"
            min="3"
            id="marquee-period"
            v-model="announceMarqueePeriod"
          />
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
} from "vue"

import Manage from "./admin/Manage.vue"
import ManageRooms from "./admin/ManageRooms.vue"
import MemberList from "./admin/MemberList.vue"
import ManagePosters from "./admin/ManagePosters.vue"
import firebaseConfig from "../firebaseConfig"

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

import * as firebase from "firebase/app"
import "firebase/auth"
import jsSHA from "jssha"

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
      user: firebase.User | null
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
      user: null,
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
    })

    const submitAnnouncement = () => {
      console.log("submitAnnouncement")
      socket?.emit("make_announcement", {
        marquee: state.announceMarquee,
        text: state.inputText,
        period: state.announceMarqueePeriod,
      })
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

    const signOut = () => {
      firebase
        .auth()
        .signOut()
        .then(() => {
          console.log("signed out")
        })
        .catch(err => {
          console.error(err)
        })
    }

    const reload = () => {
      state.lastUpdated = Date.now()
      ;(async () => {
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
        for (const room of Object.keys(state.rooms)) {
          socket?.emit("active", { user: state.myUserId, room })
        }
        state.chatGroups = keyBy(data_g, "id")
        state.posters = keyBy(data_posters, "id")
      })().catch(err => {
        console.error(err)
      })
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
          socket = io(data.socket_url, { path: "/socket.io" })
          if (!socket) {
            console.error("Socket connection failed.")
            return
          }
          for (const k of [
            "person",
            "person_multi",
            "group",
            "group.remove",
            "comment",
            "active_users",
            "poster",
            "moved",
            "moved_multi",
          ]) {
            socket.on(k, d => {
              on_socket(k, d)
            })
          }
        })
        .catch(err => {
          console.error(err)
        })

      firebase.initializeApp(firebaseConfig)

      // console.log("User", firebase.auth().currentUser)

      firebase.auth().onAuthStateChanged(user => {
        ;(async () => {
          console.log("onAuthStateChanged", user)
          state.user = user
          if (!user) {
            location.href = "/login"
          } else {
            const idToken = await user.getIdToken()
            state.idToken = idToken
            const shaObj = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" })
            shaObj.update(idToken)
            state.jwt_hash = shaObj.getHash("HEX")
            axios.defaults.headers.common = {
              Authorization: `Bearer ${idToken}`,
            }
            const client = api(axiosClient(axios))
            const data = await client.id_token.$post({
              body: { token: idToken, debug_from: "Admin" },
            })
            if (!data.ok) {
              alert("再ログインが必要です。リロードします。")
              location.reload()
            }
            console.log(data)
            if (!data.admin) {
              alert("管理者専用ページです")
              location.href = "/"
            }
            if (!data.debug_token) {
              alert("デバッグトークンが見つかりません")
              return
            }
            state.debug_token = data.debug_token
            state.myUserId = data.user_id || null
            reload()
          }
          state.loggedIn = !!user
        })().catch(err => {
          console.error(err)
        })
      })
      window.setInterval(() => {
        console.log("Refreshing token", new Date())
        const user = firebase.auth().currentUser
        if (user) {
          console.log("user", user)
          ;(async () => {
            const idToken = await user.getIdToken()
            console.log(
              "New token (the last shown):",
              idToken.slice(idToken.length - 20)
            )
            state.idToken = idToken
            let success = false
            while (!success) {
              const client = api(axiosClient(axios))
              const data = await client.id_token
                .$post({ body: { token: idToken, debug_from: "Admin timer" } })
                .catch(err => {
                  console.log(err)
                  return null
                })
              success = !!data
              if (success) {
                console.log("Refresh token OK")
              } else {
                const wait = 5
                console.log(`Retrying in ${wait} s`)
                await new Promise(resolve => setTimeout(resolve, wait * 1000))
              }
            }
          })().catch(err => {
            console.error(err)
          })
        }
      }, 1000 * 60 * 59)
    })
    return {
      API_ROOT,
      ...toRefs(state),
      reload,
      notInChat,
      signOut,
      submitAnnouncement,
      updatePoster,
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
