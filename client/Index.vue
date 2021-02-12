<template>
  <div
    id="app"
    class="container"
    v-cloak
    v-show="logged_in"
    :class="{ dark: darkMode }"
  >
    <div style="margin: 15px">
      <div id="login-info" v-if="!!user">
        {{
          locale == "ja"
            ? `${user.name} (${user.email})としてログイン`
            : `Logged in as ${user.name} (${user.email})`
        }}
        <div style="float: right">
          <div
            class="buttons has-addons"
            style="float: left; margin-right: 10px"
          >
            <button
              class="button is-small"
              :class="{ 'is-primary': locale == 'en' }"
              @click="changeLocale('en')"
            >
              English
            </button>
            <button
              class="button is-small"
              :class="{ 'is-primary': locale == 'ja' }"
              @click="changeLocale('ja')"
            >
              日本語
            </button>
          </div>
          <button class="button is-small" @click="location.href = '/mypage'">
            {{ lang("mypage") }}
          </button>
          <button class="button is-small" @click="signOut">
            {{ lang("logout") }}
          </button>
        </div>
      </div>
      <div v-if="registered">
        <div v-if="loggedIn == 'Yes'">
          <h1 class="is-h1 title">{{ lang("list") }}</h1>
          <div
            id="message"
            v-show="message.show"
            :style="{ 'background-color': message.bgColor }"
          >
            <div id="message-close" @click="message.show = false">&times;</div>
            <span style="clear: both">
              {{ message.text }}
            </span>
          </div>
          <div v-if="rooms.length == 0">{{ lang("no_room") }}</div>
          <div v-else id="rooms">
            <a
              v-for="room in rooms"
              :key="room.id"
              class="room"
              :href="'/room?room_id=' + room.id"
            >
              <h2 :class="{ small: room.name.length >= 13 }">
                {{ room.name }}
              </h2>
              <img src="/img/field_thumbnail.png" alt="会場サムネイル" />
              <div style="margin-left: 30px">
                {{
                  locale == "ja"
                    ? `参加
                ${
                  room.num_people_joined == undefined
                    ? "N/A"
                    : room.num_people_joined
                }人，アクティブ ${room.num_people_active}人`
                    : `${
                        room.num_people_joined == undefined
                          ? "N/A"
                          : room.num_people_joined
                      } joined, ${room.num_people_active} active`
                }}<br />
                {{
                  locale == "ja"
                    ? `ポスター
                ${
                  room.poster_count == undefined ? "N/A" : room.poster_count
                }枚 /
                ${
                  room.poster_location_count == undefined
                    ? "N/A"
                    : room.poster_location_count
                }枠`
                    : `${
                        room.poster_count == undefined
                          ? "N/A"
                          : room.poster_count
                      } posters / ${
                        room.poster_location_count == undefined
                          ? "N/A"
                          : room.poster_location_count
                      } locations`
                }}
              </div>
            </a>
          </div>
          <div style="clear: both"></div>
          <div style="margin-top: 30px" id="create-room">
            <a v-if="user" href="/create_room" class="link">{{
              lang("create_room")
            }}</a>
          </div>
          <div style="margin-top: 30px">
            <a v-if="user && user.admin" href="/admin" class="link">{{
              lang("admin")
            }}</a>
          </div>
        </div>
      </div>
      <div v-else-if="required_action == 'register'">
        <p>メールアドレス確認済みです。</p>
        <a href="/register" class="link"> 登録へ進む</a>
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
        <a href="/" class="link"> ログイン画面に戻る</a>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, onMounted, toRefs } from "vue"

import { Room, RoomUpdateSocketData, UserId } from "../@types/types"

import axios from "axios"
import * as encryption from "./encryption"
import { deleteUserInfoOnLogout } from "./util"

import axiosClient from "@aspida/axios"
import api from "../api/$api"
import io from "socket.io-client"
import { RoomId } from "@/api/@types"

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
    const access_code = new URL(location.href).searchParams.get("code")

    const name = localStorage["virtual-poster:name"]
    const user_id = localStorage["virtual-poster:user_id"]
    const email = localStorage["virtual-poster:email"]
    const admin = localStorage["virtual-poster:admin"] == "1"
    if (!name || !user_id || !email) {
      console.warn("Not logged in.", user_id, email, name)
      location.href = "/login" + (access_code ? "?code=" + access_code : "")
    }
    const dark_local_storage =
      localStorage["virtual-poster:" + user_id + ":config:dark_mode"]
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
      socket: undefined as SocketIOClient.Socket | undefined,
      socket_active: false,
      darkMode:
        dark_local_storage == "1"
          ? true
          : dark_local_storage == "0"
          ? false
          : window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches,
      locale: (navigator.language == "ja" ? "ja" : "en") as "en" | "ja",
      message: {
        text: "",
        show: false,
        bgColor: "#fff",
      },
    })

    const changeLocale = (l: "en" | "ja") => {
      state.locale = l
      if (state.user) {
        localStorage[`virtual-poster:${state.user.user_id}:config:locale`] = l
      }
    }

    const lang = (key: string): string => {
      const message: {
        [key in string]: { [key in "ja" | "en"]: string }
      } = {
        mypage: {
          ja: "マイページ",
          en: "Preferences",
        },
        logout: {
          ja: "ログアウト",
          en: "Logout",
        },
        list: {
          ja: "会場の一覧",
          en: "List of Rooms",
        },
        no_room: {
          ja: "アクセス可能な会場なし",
          en: "No available room",
        },
        create_room: {
          ja: "新しく会場を作成する",
          en: "Create a room",
        },
        admin: {
          ja: "管理画面",
          en: "Admin",
        },
      }
      return message[key][state.locale]
    }

    const isMobile = !!navigator.userAgent.match(/iPhone|Android.+Mobile/)

    const client = api(axiosClient(axios))

    onMounted(async () => {
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
      if (debug_as && debug_token) {
        console.log("Initializing debug mode...", debug_as)
        state.myUserId = debug_as
        state.rooms = await client.maps.$get()
        state.loggedIn = "Yes"
        const data = await client.id_token.$post({
          body: { token: "DEBUG_BYPASS", debug_from: "Index" },
        })

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
        location.href = "/login" + (access_code ? "?code=" + access_code : "")
      } else {
        const locale_config =
          localStorage[`virtual-poster:${state.user.user_id}:config:locale`]
        if (locale_config) {
          state.locale = locale_config
        } else {
          localStorage[`virtual-poster:${state.user.user_id}:config:locale`] =
            state.locale
        }

        state.socket = io("/", {
          transports: ["websocket"],
        })
        state.socket.on("Room", (d: RoomUpdateSocketData) => {
          const room = state.rooms.find(r => r.id == d.id)
          if (room) {
            if (d.allow_poster_assignment != undefined) {
              room.allow_poster_assignment = d.allow_poster_assignment
            }
            if (d.poster_count != undefined) {
              room.poster_count = d.poster_count
            }
            if (d.num_people_joined != undefined) {
              room.num_people_joined = d.num_people_joined
            }
            if (d.num_people_active != undefined) {
              room.num_people_active = d.num_people_active
            }
          }
        })
        const onConnected = () => {
          const socket = state.socket!
          console.log("Socket connected")
          state.socket_active = true
          socket.emit("Active", {
            room: "::index",
            user: state.myUserId,
          })
          // socket.emit("Subscribe", {
          //   channel: "::index",
          // })
        }
        state.socket.on("connection", onConnected)
        state.socket.on("connect", onConnected)
        state.loggedIn = "Yes"
        console.log("Already registered", state.user)
        state.myUserId = state.user.user_id
        if (state.myUserId) {
          localStorage["virtual-poster:user_id"] = state.myUserId
        }
        let access_code_added: RoomId[] | undefined = undefined
        let primary_room: RoomId | undefined = undefined
        if (access_code) {
          const r = await client.people
            ._userId(user_id)
            .access_code.$post({ body: { access_code } })
          if (r.error == "Access code is invalid") {
            state.message.text =
              "URLで指定された会場は現在利用できません（有効期間外であるなどの理由）。後ほど再度お試しください。"
            state.message.bgColor = "#fee"
            state.message.show = true
          }
          access_code_added = r.added
          primary_room = r.primary_room
        }
        state.rooms = await client.maps.$get().catch(err => {
          console.log(err)
          if (err.response.status == 403) {
            location.href =
              "/login" + (access_code ? "?code=" + access_code : "")
          }
          return []
        })
        const data = await client.public_key.$get()

        await encryption.setupEncryption(axios, state.myUserId, data.public_key)
        state.logged_in = true

        if (primary_room) {
          location.href = "/room?room_id=" + primary_room
        }
        /*
        if (access_code_added) {
          if (access_code_added.length > 0) {
            alert(
              "アクセスコードにより，部屋へのアクセスが追加されました：" +
                access_code_added
                  .map(rid => state.rooms.find(r => r.id == rid)?.name)
                  .filter(Boolean)
                  .join("，")
            )
          } else {
            alert("何も追加されませんでした。")
          }
        }
        */

        /*
          const shaObj = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" })
          shaObj.update(idToken)
          const jwt_hash = shaObj.getHash("HEX")
          localStorage["virtual-poster:jwt_hash"] = jwt_hash
          */
      }
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

    onMounted(() => {
      window.addEventListener("storage", ev => {
        if (ev.key == "virtual-poster:" + user_id + ":config:dark_mode") {
          state.darkMode =
            ev.newValue == "1"
              ? true
              : ev.newValue == "0"
              ? false
              : window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches
        }
      })
      const mm = window.matchMedia("(prefers-color-scheme: dark)")
      const f = e => {
        const v =
          localStorage["virtual-poster:" + user_id + ":config:dark_mode"]
        if (!v) {
          state.darkMode = e.matches
        }
      }
      if (mm.addEventListener) {
        mm.addEventListener("change", f)
      } else if (mm.addListener) {
        mm.addListener(f)
      }
    })
    return {
      ...toRefs(state),
      signOut,
      enterRoom,
      location,
      isMobile,
      lang,
      changeLocale,
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
}

.btn,
a.btn,
button.btn {
  /* font-size: 1.6rem; */
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
  font-size: 14px;
  margin: 0px;
}

#app {
  position: absolute;
  margin: 0px;
  top: 0px;
  padding: 0px;
  height: 100vh;
  width: 100vw;
}

#app.dark {
  background: black;
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

.dark #login-info {
  background: rgb(179, 94, 179);
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

.dark .room {
  background: #ccc;
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
  max-height: 120px;
  margin: auto;
  display: block;
}

#create-room {
}

a.link:visited {
  color: rgb(218, 24, 218);
}

.btn-lang {
  height: 28px;
  font-size: 12px;
}

#message {
  min-height: 40px;
  border-radius: 5px;
  padding: 7px;
  font-size: 16px;
}

#message-close {
  float: right;
  cursor: pointer;
  border: 1px solid #ccc;
  height: 20px;
  width: 20px;
  font-size: 15px;
  padding: 0px 0px 0px 1px;
}

[v-cloak] {
  display: none;
}
</style>
