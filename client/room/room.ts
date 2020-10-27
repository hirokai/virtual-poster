import { createApp } from "vue"
import Room from "./Room.vue"
import axiosDefault from "axios"
import { UserId, RoomId } from "@/@types/types"

const url = new URL(location.href)

const forceMobileOn = url.searchParams.get("mobile") == "true"
const forceMobileOff = url.searchParams.get("mobile") == "false"
const mobilePane = location.hash != "" ? location.hash : undefined

const mobile_agent = !!navigator.userAgent.match(/iPhone|Android.+Mobile/)
let isMobile: boolean
if (forceMobileOn) {
  isMobile = true
} else if (forceMobileOff) {
  isMobile = false
} else if (mobile_agent) {
  isMobile = true
} else {
  isMobile = false
}

const API_ROOT = "/api"
const axios = axiosDefault.create({
  baseURL: API_ROOT,
})

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
      mobilePaneFromHash: mobilePane,
    }
    createApp(Room, propsData).mount("#app")

    return
  }
  if (!user) {
    location.href = "/login"
  } else {
    if (!user.emailVerified) {
      console.log("Verification email sent")
      alert(
        "確認のメールを送信しました。メールボックスをチェックしてください。"
      )
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
          bot_mode: bot_mode,
          jwt_hash_initial,
          axios,
          isMobile: false, //Temporarily disable, as it is broken
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
