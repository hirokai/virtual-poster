<template>
  <div id="app" v-cloak>
    <h1>バーチャルポスターセッション</h1>
    <div>
      <div id="firebaseui-auth-container"></div>
    </div>
    <div v-if="waitingVerification">
      <h2>
        {{ user.email }}に送られたメールの確認用リンクをクリックしてください。
      </h2>
      <div>
        <a href="#" @click="checkVerification">クリック後，続行</a>
      </div>
      <div>{{ verifyStatus }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import {} from "../@types/types"

import { onMounted, toRefs } from "@vue/composition-api"
import axios from "axios"
import * as firebase from "firebase/app"
import "firebase/auth"
import * as firebaseui from "firebaseui"

import Vue from "vue"
import { defineComponent, reactive } from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

const ROOT_URL = process.env.VUE_APP_ROOT_URL || "http://localhost:8080"

const PRODUCTION = process.env.NODE_ENV == "production"
const API_ROOT = PRODUCTION ? "/api" : "http://localhost:3000/api"
axios.defaults.baseURL = API_ROOT

export default defineComponent({
  setup() {
    const state = reactive<{
      user: any | null
      waitingVerification: boolean
      verifyStatus: string
    }>({
      user: null,
      waitingVerification: false,
      verifyStatus: "",
    })

    const checkVerification = () => {
      console.log(state.user)
      if (state.user && state.user.emailVerified) {
        location.href = "/"
      } else {
        state.verifyStatus = "メールリンクが未確認です。"
      }
    }

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
      firebase.initializeApp(firebaseConfig)
      const uiConfig: firebaseui.auth.Config = {
        callbacks: {
          signInSuccessWithAuthResult: authResult => {
            state.user = authResult.user
            if (!state.user) {
              return false
            } else {
              console.log("Email verified:", state.user.emailVerified)
              if (!state.user.emailVerified) {
                state.waitingVerification = true
                const actionCodeSettings = {
                  url: ROOT_URL + "/",
                }
                state.user
                  .sendEmailVerification(actionCodeSettings)
                  .then(() => {
                    console.log("Verification email sent")
                  })
                  .catch(function(error) {
                    console.error(error)
                  })
              }
              return state.user.emailVerified
            }
          },
        },
        signInOptions: [
          {
            provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            customParameters: {
              prompt: "select_account",
            },
          },
          firebase.auth.EmailAuthProvider.PROVIDER_ID,
        ],
        signInSuccessUrl: "/",
        tosUrl: "<your-tos-url>",
        privacyPolicyUrl: function() {
          window.location.assign("<your-privacy-policy-url>")
        },
      }
      const ui = new firebaseui.auth.AuthUI(firebase.auth())
      ui.start("#firebaseui-auth-container", uiConfig)
      firebase.auth().onAuthStateChanged(user => {
        state.user = user
      })
    })

    console.log("state", state)
    return {
      ...toRefs(state),
      checkVerification,
    }
  },
})
</script>

<style>
h1 {
  display: block;
  margin: auto;
  text-align: center;
}
body {
  font-family: Loto, "YuGothic", sans-serif;
}
#login-info {
  background: #eeeeff;
  height: 25px;
  padding: 10px;
}
</style>
