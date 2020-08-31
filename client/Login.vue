<template>
  <div id="app" v-cloak>
    <h1>バーチャルポスターセッション</h1>
    <div v-if="nextAction == undefined">
      <div id="firebaseui-auth-container"></div>
    </div>
    <div v-else-if="nextAction == 'verify'">
      <h2>
        {{ user.email }}に送られたメールの確認用リンクをクリックしてください。
      </h2>
      <div>
        <a href="#" @click="checkVerification">クリック後，続行</a>
      </div>
      <div>{{ verifyStatus }}</div>
    </div>
    <div v-else-if="nextAction == 'register'">
      <h2>
        ユーザー情報を入力してください。
      </h2>
      <div>
        <dir>Email: {{ user.email }}</dir>
        <label for="">名前</label>
        <input type="text" id="register-name" v-model="register_name" />
        <label for="">アクセスコード</label>
        <input type="text" id="access-code" v-model="access_code" />
        <button @click="submitRegistration">登録</button>
      </div>
      <div>{{ verifyStatus }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import { PostIdTokenResponse } from "../@types/types"

import { onMounted, toRefs } from "@vue/composition-api"
import axios from "axios"
import * as firebase from "firebase/app"
import "firebase/auth"
import * as firebaseui from "firebaseui"

import Vue from "vue"
import { defineComponent, reactive } from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"

Vue.use(VueCompositionApi)

const API_ROOT = "/api"
axios.defaults.baseURL = API_ROOT

export default defineComponent({
  setup() {
    const state = reactive({
      user: null as any | null,
      verifyStatus: "",
      nextAction: undefined as "register" | "verify" | undefined,
      register_name: "",
      access_code: "",
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
              if (state.user.emailVerified) {
                authResult.user.getIdToken(true).then(idToken => {
                  axios.defaults.headers.common = {
                    Authorization: `Bearer ${idToken}`,
                  }
                  axios
                    .post<PostIdTokenResponse>("/id_token", {
                      token: idToken,
                    })
                    .then(data => {
                      console.log("/id_token result", data)
                      if (data.data.registered == "can_register") {
                        state.nextAction = "register"
                      } else if (data.data.registered == "registered") {
                        state.nextAction = undefined
                        location.href = "/"
                      }
                    })
                    .catch(err => {
                      console.error(err)
                    })
                })
              } else {
                state.nextAction = "verify"
                const actionCodeSettings = {
                  url: "/",
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
    const submitRegistration = ev => {
      console.log(state.register_name)
      axios
        .post("/register", {
          email: state.user.email,
          name: state.register_name,
          access_code: state.access_code,
        })
        .then(({ data }) => {
          console.log("/register result", data)
          if (data.ok) {
            location.href = "/"
          }
        })
        .catch(err => {
          console.error(err)
        })
    }
    return {
      ...toRefs(state),
      checkVerification,
      submitRegistration,
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
