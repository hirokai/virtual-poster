<template>
  <div id="app" v-cloak v-show="logged_in">
    <div id="login-info" v-if="!!user">
      {{ user.name }}({{ user.email }})としてログイン
      <button class="btn" @click="location.href = '/mypage'">マイページ</button>
      <button class="btn" @click="signOut">ログアウト</button>
    </div>
    <div v-if="registered">
      <div v-if="loggedIn == 'Yes'">
        <h1>会場の一覧</h1>
        <div id="rooms">
          <a
            v-for="room in rooms"
            :key="room.id"
            class="room"
            :href="'/room?room_id=' + room.id"
          >
            <h2 :class="{ small: room.name.length >= 13 }">{{ room.name }}</h2>
            <img src="/img/field_thumbnail.png" alt="会場サムネイル" />
          </a>
        </div>
        <div style="clear:both"></div>
        <div style="margin-top: 30px" id="create-room">
          <a v-if="user" href="/create_room">新しく会場を作成する</a>
        </div>
        <div style="margin-top: 30px">
          <a v-if="user && user.admin" href="/admin">管理画面</a>
        </div>
      </div>
    </div>
    <div v-else-if="required_action == 'register'">
      <p>メールアドレス確認済みです。</p>
      <a href="/register"> 登録へ進む</a>
    </div>
    <div v-else-if="required_action == 'verify'">
      Emailアドレス（{{
        user.email
      }}）に確認のメールを送信しました。メールに記載されたリンクをクリックしてユーザー登録を完了してください。
      <br />
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
import { defineComponent, reactive, onMounted, toRefs } from "vue"

import { Room, UserId } from "../@types/types"

import axios from "axios"
import * as encryption from "./encryption"
import { deleteUserInfoOnLogout } from "./util"

import axiosClient from "@aspida/axios"
import api from "../api/$api"

const API_ROOT = "/api"
axios.defaults.baseURL = API_ROOT

const url = new URL(location.href)

const debug_as: UserId | undefined =
  url.searchParams.get("debug_as") || undefined
const debug_token: string | undefined =
  url.searchParams.get("debug_token") || undefined

const logged_in = !!JSON.parse(url.searchParams.get("logged_in") || "false")
export default defineComponent({
  setup() {
    const name = localStorage["virtual-poster:name"]
    const user_id = localStorage["virtual-poster:user_id"]
    const email = localStorage["virtual-poster:email"]
    const admin = localStorage["virtual-poster:admin"] == "1"
    if (!name || !user_id || !email) {
      console.warn("Not logged in.", user_id, email, name)
      location.href = "/login"
    }
    const state = reactive({
      myUserId: null as string | null,
      user: { name, user_id, email, admin } as {
        name: string
        email: string
        user_id: string
        admin: boolean
      } | null,
      loggedIn: (logged_in ? "Yes" : "Unknown") as "Yes" | "No" | "Unknown",
      admin: false,
      registered: true,
      rooms: [] as Room[],
      required_action: undefined as undefined | "register" | "verify",
      logged_in: false,
    })
    const isMobile = !!navigator.userAgent.match(/iPhone|Android.+Mobile/)

    onMounted(() => {
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
      const client = api(axiosClient(axios))
      ;(async () => {
        console.log("User:", state.user)
        if (debug_as && debug_token) {
          console.log("Initializing debug mode...", debug_as)
          state.myUserId = debug_as
          state.rooms = await client.maps.$get()
          state.loggedIn = "Yes"
          const data = await client.id_token.$post({
            body: { token: "DEBUG_BYPASS", debug_from: "Index" },
          })
          console.log("/id_token result", data)

          state.myUserId = data.user_id || null
          if (data.ok) {
            state.admin = data.admin || false
            state.rooms = await client.maps.$get()
            state.logged_in = true
          } else {
            state.registered = false
            console.log("User auth failed")
            location.reload()
          }
          return
        }
        if (!state.user) {
          state.loggedIn = "No"
          location.href = "/login"
        } else {
          state.loggedIn = "Yes"
          console.log("Already registered", state.user)
          state.myUserId = state.user.user_id
          if (state.myUserId) {
            localStorage["virtual-poster:user_id"] = state.myUserId
          }
          state.rooms = await client.maps.$get().catch(err => {
            console.log(err)
            if (err.response.status == 403) {
              location.href = "/login"
            }
            return []
          })
          const data = await client.public_key.$get()
          console.log("/public_key result", data)

          await encryption.setupEncryption(
            axios,
            state.myUserId,
            data.public_key
          )
          state.logged_in = true

          /*
          const shaObj = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" })
          shaObj.update(idToken)
          const jwt_hash = shaObj.getHash("HEX")
          localStorage["virtual-poster:jwt_hash"] = jwt_hash
          */
        }
      })().catch(err => {
        console.log(err)
      })
    })

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

    const enterRoom = (room_id: string) => {
      location.href = "/room?room_id=" + room_id
    }
    return { ...toRefs(state), signOut, enterRoom, location, isMobile }
  },
})
</script>

<style>
/* https://jajaaan.co.jp/css/button/ */
*,
*:before,
*:after {
  -webkit-box-sizing: inherit;
  box-sizing: inherit;
}

html {
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  font-size: 62.5%;
}

.btn,
a.btn,
button.btn {
  font-size: 1.6rem;
  /* font-weight: 700; */
  line-height: 1.5;
  position: relative;
  display: inline-block;
  padding: 0.1rem 1rem;
  cursor: pointer;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-transition: all 0.3s;
  transition: all 0.3s;
  text-align: center;
  vertical-align: middle;
  text-decoration: none;
  letter-spacing: 0.1em;
  color: #212529;
  border-radius: 0.5rem;

  background-color: #ccc;
  border: 1px #777 solid;
}

body {
  font-family: Loto, "YuGothic", sans-serif;
  margin: 15px;
  font-size: 14px;
}

h1 {
  margin: 0px;
  line-height: 1;
}

#login-info {
  background: #f3f3ff;
  height: 45px;
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0px;
}

.room {
  width: 260px;
  height: 200px;
  border-radius: 8px;
  background: #eee;
  cursor: pointer;
  float: left;
  margin: 10px 15px 10px 0px;
  padding: 10px;
  text-decoration: none;
}

.room {
  color: black;
}

.room:hover {
  filter: drop-shadow(2px 2px 1px #ccc);
}

.room h2 {
  font-size: 21px;
  display: block;
  position: relative;
  text-align: center;
  margin: 0px;
  padding: 0px;
  height: 32px;
}

.room h2.small {
  font-size: 14px;
}

.room img {
  max-width: 300px;
  max-height: 140px;
  margin: auto;
  display: block;
}

#login-info button {
  font-size: 14px;
  margin-right: 10px;
  vertical-align: 1px;
}

#create-room {
}

[v-cloak] {
  display: none;
}
</style>
