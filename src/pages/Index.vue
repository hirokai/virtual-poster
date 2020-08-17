<template>
  <div id="app" v-cloak>
    <div id="login-info" v-if="!!user">
      {{ user.displayName }}({{ user.email }})としてログイン
      <button @click="signOut">ログアウト</button>
    </div>
    <div v-if="registered">
      <div v-if="loggedIn == 'Yes'">
        <h1>ようこそ</h1>
        <div id="rooms">
          <a
            v-for="room in rooms"
            :key="room.id"
            class="room"
            :href="'/room?room_id=' + room.id"
          >
            <h2>{{ room.name }}</h2>
            <img src="/img/field_thumbnail.png" alt="会場サムネイル" />
          </a>
        </div>
        <div style="clear:both"></div>
      </div>
      <div v-if="admin">
        <a href="/admin">管理画面</a>
      </div>
    </div>
    <div v-else>
      このEmailアドレス（{{ user.email }}）はユーザー登録されていません。
      <br />
      管理者に連絡してユーザー登録してください。
      <a href="/"> ログイン画面に戻る</a>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue"
import {
  defineComponent,
  reactive,
  onMounted,
  toRefs,
} from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

import { Room, UserId } from "../../@types/types"

import axios from "axios"
import * as firebase from "firebase/app"
import "firebase/auth"

const PRODUCTION = process.env.NODE_ENV == "production"
const API_ROOT = PRODUCTION ? "/api" : "http://localhost:3000/api"
axios.defaults.baseURL = API_ROOT

const url = new URL(location.href)

const debug_as: UserId | undefined =
  url.searchParams.get("debug_as") || undefined
const debug_token: string | undefined =
  url.searchParams.get("debug_token") || undefined

const logged_in = !!JSON.parse(url.searchParams.get("logged_in") || "false")
export default defineComponent({
  setup() {
    const state = reactive<{
      myUserId: string | null
      user: firebase.User | null
      loggedIn: "Yes" | "No" | "Unknown"
      admin: boolean
      registered: boolean
      rooms: Room[]
    }>({
      myUserId: null,
      user: null,
      loggedIn: logged_in ? "Yes" : "Unknown",
      admin: false,
      registered: true,
      rooms: [],
    })
    onMounted(() => {
      const firebaseConfig = {
        apiKey: "AIzaSyC6-xLMRmgbrr_7vJLLk9WZUrXiUkskWT4",
        authDomain: "coi-conf.firebaseapp.com",
        databaseURL: "https://coi-conf.firebaseio.com",
        projectId: "coi-conf",
        storageBucket: "coi-conf.appspot.com",
        messagingSenderId: "648033256432",
        appId: "1:648033256432:web:17b78f6d2ffe5913979335",
        measurementId: "G-23RL5BGH9D",
      }
      axios.interceptors.request.use(config => {
        if (debug_as && debug_token) {
          config.params = config.params || {}
          config.params["debug_as"] = debug_as
          config.params["debug_token"] = debug_token
          return config
        } else {
          return config
        }
      })

      firebase.initializeApp(firebaseConfig)
      window.firebase = firebase

      firebase.auth().onAuthStateChanged(user => {
        ;(async () => {
          console.log("User:", user)
          if (debug_as && debug_token) {
            console.log("Initializing debug mode...", debug_as)
            state.myUserId = debug_as
            const r = await axios.get("/maps")
            console.log("/maps result", r)
            state.rooms = r.data
            state.loggedIn = "Yes"
            const { data } = await axios.post("/id_token", {
              token: "DEBUG_BYPASS",
              debug_from: "Index",
            })
            console.log("/id_token result", data)
            state.myUserId = data.user_id
            if (data.ok) {
              state.admin = data.admin
              const r = await axios.get("/maps")
              state.rooms = r.data
            } else {
              state.registered = false
              console.log("User auth failed")
              location.reload()
            }
            return
          }
          if (!user) {
            state.loggedIn = "No"
            location.href = "/login"
          } else {
            await 1
            state.user = user
            state.loggedIn = "Yes"

            const idToken = await user.getIdToken()
            if (!user.emailVerified) {
              location.href = "/login"
            } else {
              console.log("Already registered")
              axios.defaults.headers.common = {
                Authorization: `Bearer ${idToken}`,
              }
              const { data } = await axios.post("/id_token", {
                token: idToken,
              })
              console.log("/id_token result", data)
              state.myUserId = data.user_id
              if (data.ok) {
                state.admin = data.admin
                const r = await axios.get("/maps")
                state.rooms = r.data
              } else {
                state.registered = false
                console.log("User auth failed")
              }
            }
          }
        })().catch(err => {
          console.log(err)
        })
      })
    })
    const signOut = () => {
      firebase
        .auth()
        .signOut()
        .then(() => {
          console.log("signed out")
          location.href = "/login"
        })
        .catch(err => {
          console.error(err)
        })
    }
    const enterRoom = (room_id: string) => {
      location.href = "/room?room_id=" + room_id
    }
    return { ...toRefs(state), signOut, enterRoom }
  },
})
</script>

<style>
body {
  font-family: Loto, "YuGothic", sans-serif;
}
#login-info {
  background: #eeeeff;
  height: 25px;
  padding: 10px;
}

.room {
  width: 200px;
  height: 170px;
  border-radius: 10px;
  background: #eee;
  cursor: pointer;
  float: left;
  margin: 10px;
  text-decoration: none;
}

.room:visited {
  color: black;
}

.room:hover {
  filter: drop-shadow(2px 2px 1px #ccc);
}

.room h2 {
  display: block;
  position: relative;
  text-align: center;
  margin: 0px;
}

.room img {
  max-width: 180px;
  max-height: 150px;
  margin: auto;
  display: block;
}
</style>
