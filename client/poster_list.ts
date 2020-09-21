import { createApp } from "vue"
import PosterList from "./PosterList.vue"
import * as firebase from "firebase/app"
import "firebase/auth"
import axios from "axios"
import { PostIdTokenResponse } from "@/@types/types"
import firebaseConfig from "../firebaseConfig"

const API_ROOT = "/api"
axios.defaults.baseURL = API_ROOT

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
          createApp({
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
