import Vue from "vue"
import PosterList from "./PosterList.vue"
import * as firebase from "firebase/app"
import "firebase/auth"
import axios from "axios"
import { PostIdTokenResponse } from "@/@types/types"

Vue.config.productionTip = true

const API_ROOT = "/api"
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

firebase.auth().onAuthStateChanged(user => {
  ;(async () => {
    console.log("User:", user)
    if (!user) {
      location.href = "/index"
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
        console.log("Already registered")
        axios.defaults.headers.common = {
          Authorization: `Bearer ${idToken}`,
        }
        const { data: data1 } = await axios.get("/socket_url")
        const socketURL = data1.socket_url
        const { data } = await axios.post<PostIdTokenResponse>("/id_token", {
          token: idToken,
          debug_from: "poster_list",
        })
        if (!data.ok) {
          console.log("User auth failed")
        } else {
          console.log("Initializing...", data, user)
          const propsData = {
            myUserId: data.user_id,
            idToken,
            socketURL,
          }
          new Vue<typeof PosterList>({
            render: h => h(PosterList, { props: propsData }),
            el: "#app",
          })
        }
      }
    }
  })().catch(err => {
    console.log(err)
  })
})
