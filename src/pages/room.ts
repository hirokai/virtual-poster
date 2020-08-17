import Vue from "vue"
import Room from "./Room.vue"
import * as firebase from "firebase/app"
import "firebase/auth"
import axios from "axios"
import { UserId, RoomId } from "../../@types/types"

Vue.config.productionTip = true

const PRODUCTION = process.env.NODE_ENV == "production"
const API_ROOT = PRODUCTION ? "/api" : "http://localhost:3000/api"
axios.defaults.baseURL = API_ROOT

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

firebase.initializeApp(firebaseConfig)
window.firebase = firebase

const url = new URL(location.href)
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

declare module "vue/types/vue" {
  interface Vue {
    composing: boolean
    submitComment(s: string): void
    submitPosterComment(s: string): void
    handleGlobalKeyDown(ev: KeyboardEvent): boolean
  }
}

firebase.auth().onAuthStateChanged(user => {
  ;(async () => {
    console.log("User:", user, debug_as)
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
      }
      new Vue({
        render: h => h(Room, { props: propsData }),
        el: "#app",
      })
      return
    }
    if (!user) {
      location.href = "/login"
    } else {
      const idToken = await user.getIdToken()
      if (!user.emailVerified) {
        firebase.auth().languageCode = "ja"
        await user.sendEmailVerification().catch(function(error) {
          console.error(error)
        })
        console.log("Verification email sent")
        location.href = "/"
      } else {
        // console.log("Already registered")
        axios.defaults.headers.common = {
          Authorization: `Bearer ${idToken}`,
        }
        const { data } = await axios.post("/id_token", {
          token: idToken,
          debug_from: "room",
        })
        if (!data.ok) {
          console.log("User auth failed")
        } else {
          const propsData = {
            room_id,
            myUserId: data.user_id,
            user: user,
            bot_mode: bot_mode,
            idToken,
            axios,
          }
          console.log("Initializing...", data, user?.email, propsData)
          // app.$props.socket = app.$mount("#app")
          new Vue<typeof Room>({
            render: h => h(Room, { props: propsData }),
            el: "#app",
          })
        }
      }
    }
  })().catch(err => {
    console.log(err)
  })
})
