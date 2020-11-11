<template>
  <div id="app" v-cloak v-show="logged_in">
    <div v-if="registered">
      <div v-if="loggedIn == 'Yes'">
        <a href="/">トップページに戻る</a>

        <h1>会場を作成する</h1>
        <div>
          <h2>会場のオーナー</h2>
          {{ user.name }} ({{ user.email }})
          <div>
            <h2>会場の種類を選択</h2>
            <div
              class="room-kind-entry"
              :class="{ active: roomKind == room.kind }"
              v-for="room in room_templates"
              :key="room.kind"
              @click="selectKind(room.kind)"
            >
              <h3>{{ room.name }}</h3>
              <div>{{ room.description || "" }}</div>
            </div>
            <div style="clear:both"></div>
          </div>
          <div>
            <h2>会場の名前</h2>
            <input type="text" ref="roomName" />
          </div>
          <div>
            <h2>設定</h2>
            <input
              type="checkbox"
              name=""
              id="new-room-config-allow-self-assign-poster"
              v-model="allowPosterAssignment"
            />
            <label for="new-room-config-allow-self-assign-poster"
              >ユーザーによるポスター板の確保・解放およびタイトルの編集を許可する</label
            >
          </div>
          <div>
            <h3>注意</h3>
            <ul>
              <li>
                部屋の作成者のメールアドレスは，部屋の参加者に対して表示されます。
              </li>
              <li>
                作成した会場の削除はマイページの「マップ」タブから可能です。
              </li>
            </ul>
            <button class="btn" id="submit" @click="submit">作成する</button>
            <p>
              {{ result?.message }}
              <br />
              <a v-if="result?.ok != undefined" href="/mypage#rooms"
                >マイページに戻る</a
              >
            </p>
          </div>
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
import { defineComponent, reactive, onMounted, toRefs, ref } from "vue"

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

type RoomTemplate = {
  name: string
  kind: "small" | "medium" | "large"
  description?: string
}

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
      room_templates: [
        {
          name: "小さい会場",
          kind: "small",
          description: "20 x 20マス，ポスター板16ヶ所の会場です",
        },
        {
          name: "中くらいの会場",
          kind: "medium",
          description: "55 x 42マス，ポスター板68ヶ所の会場です",
        },
        {
          name: "大きな会場",
          kind: "large",
          description: "161 x 88マス，ポスター板408ヶ所の会場です",
        },
      ] as RoomTemplate[],
      roomName: "",
      roomKind: "small",
      allowPosterAssignment: true,
      result: { ok: undefined as boolean | undefined, message: "" },
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

    const selectKind = (kind: string) => {
      state.roomKind = kind
    }

    const roomName = ref<HTMLInputElement>()
    const submit = async () => {
      const client = api(axiosClient(axios))
      const name = roomName.value?.value
      if (!name) {
        state.result.ok = false
        state.result.message = "部屋の名前を入力してください"
        return
      }
      const r = await client.maps.$post({
        body: {
          name,
          template: state.roomKind,
          allow_poster_assignment: state.allowPosterAssignment,
        },
      })
      if (r.ok) {
        state.result.message = "部屋が作成されました。"
        state.result.ok = true
        // location.href = "/mypage#rooms"
      } else {
        state.result.ok = false
        const detail =
          r.error == "Room name already exists"
            ? "すでに同じ名前の部屋が存在します。"
            : ""
        state.result.message = "部屋が作成できませんでした。" + detail
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

    const enterRoom = (room_id: string) => {
      location.href = "/room?room_id=" + room_id
    }

    return {
      ...toRefs(state),
      signOut,
      enterRoom,
      location,
      isMobile,
      submit,
      selectKind,
      roomName,
    }
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

.room-kind-entry {
  background: #ccc;
  width: 200px;
  height: 150px;
  margin: 10px;
  padding: 20px;
  float: left;
  cursor: pointer;
}

.room-kind-entry.active {
  border: 2px solid blue;
}

input[type="text"] {
  width: 300px;
  height: 24px;
  font-size: 21px;
}

#submit {
  margin: 20px 0px 20px 0px;
}

[v-cloak] {
  display: none;
}
</style>
