import { createApp } from "vue"
import Room from "./Room.vue"
import * as firebase from "firebase/app"
import "firebase/auth"
import axiosDefault from "axios"
import { UserId, RoomId } from "../@types/types"
import firebaseConfig from "../firebaseConfig"

const url = new URL(location.href)

const isMobile = !!JSON.parse(url.searchParams.get("mobile") || "false")
const mobile_agent = !!navigator.userAgent.match(/iPhone|Android.+Mobile/)
if (!isMobile && mobile_agent) {
  url.searchParams.set("mobile", "true")
  location.href = url.toString()
}

const API_ROOT = "/api"
const axios = axiosDefault.create({
  baseURL: API_ROOT,
})

firebase.initializeApp(firebaseConfig)
window.firebase = firebase

const room_id: RoomId | null = url.searchParams.get("room_id")
if (!room_id) {
  alert("Room IDが不正です。")
  location.href = "/"
}

const debug_as: UserId | undefined =
  url.searchParams.get("debug_as") || undefined
const debug_token: string | undefined =
  url.searchParams.get("debug_token") || undefined

const bot_mode = url.searchParams.get("bot_mode") == "1"

  // firebase.auth().onAuthStateChanged(user => {
;(async () => {
  const user = { emailVerified: true, email: "hoge" }
  // console.log("User:", user, debug_as)
  if (debug_as) {
    console.log("Initializing debug mode...", debug_as)
    const propsData = {
      room_id,
      debug_as,
      debug_token,
      myUserId: debug_as,
      user,
      bot_mode,
      idToken: "",
      axios,
      isMobile,
    }
    createApp(Room, propsData).mount("#app")

    return
  }
  if (!user) {
    location.href = "/login"
  } else {
    if (!user.emailVerified) {
      firebase.auth().languageCode = "ja"

      console.log("Verification email sent")
      location.href = "/"
    } else {
      const user_id: string | undefined = localStorage["virtual-poster:user_id"]
      const jwt_hash_initial: string | undefined =
        localStorage["virtual-poster:jwt_hash"]
      const data = { ok: true, user_id }
      if (!data.ok) {
        console.log("User auth failed")
      } else {
        const propsData = {
          room_id,
          myUserId: data.user_id,
          user: user,
          bot_mode: bot_mode,
          jwt_hash_initial,
          axios,
          isMobile,
        }
        console.log("Initializing...", data, user?.email, propsData)
        // app.$props.socket = app.$mount("#app")
        createApp(Room, propsData).mount("#app")
      }
    }
  }
})().catch(err => {
  console.log(err)
})
// })
