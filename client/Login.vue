<template>
  <div class="container" id="app" v-cloak>
    <div class="columns">
      <div class="column is-full">
        <h1 class="title is-3">{{ lang("title") }}</h1>
        <div v-if="nextAction == undefined">
          <div id="firebaseui-auth-container"></div>
        </div>
        <div v-else-if="nextAction == 'verify'">
          <h2>
            {{
              locale == "ja"
                ? user.email +
                  "に送られたメールの確認用リンクをクリックしてください。（しばらく経ってもメールが届かない場合は，迷惑メールフォルダを確認してください。）"
                : `Click on the verification link in the email sent to ${user.email}. (If you don't receive the email after a while, please check your spam folder.)`
            }}
          </h2>
          <div>
            <a href="#" @click="checkVerification">{{ lang("proceed") }}</a>
          </div>
          <div>{{ verifyStatus }}</div>
        </div>
        <div class="columns">
          <div class="column is-one-third"></div>
          <div class="column is-one-third">
            <div
              class="buttons has-addons"
              style="
                margin: 30px auto;
                text-align: center;
                display: inline-block;
              "
            >
              <button
                class="button is-small"
                :class="{ 'is-info': locale == 'en' }"
                @click="changeLocale('en')"
              >
                English
              </button>
              <button
                class="button is-small"
                :class="{ 'is-info': locale == 'ja' }"
                @click="changeLocale('ja')"
              >
                日本語
              </button>
            </div>
          </div>
          <div class="column is-one-third"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import axiosDefault from "axios"
import * as firebase from "firebase/app"
import "firebase/auth"
import * as firebaseui from "firebaseui"
import jsSHA from "jssha"

import { onMounted, toRefs, defineComponent, reactive, watch } from "vue"

import { setUserInfo, deleteUserInfoOnLogout } from "./util"

import axiosClient from "@aspida/axios"
import api from "../api/$api"

const API_ROOT = "/api"
const axios = axiosDefault.create({ baseURL: API_ROOT })

export default defineComponent({
  props: {
    firebaseConfig: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const state = reactive({
      user: null as firebase.User | null,
      verifyStatus: "",
      nextAction: undefined as "register" | "verify" | undefined,
      register_name: "",
      access_code: "",
      locale: (navigator.language == "ja" ? "ja" : "en") as "en" | "ja",
    })

    const lang = (key: string): string => {
      const message: {
        [key in ui_literals]: { [key in "ja" | "en"]: string }
      } = {
        title: {
          ja: "バーチャルポスターセッション",
          en: "Virtual poster session",
        },
        proceed: {
          ja: "クリック後，続行",
          en: "Click to proceed",
        },
      }
      return message[key][state.locale]
    }

    const changeLocale = (l: "en" | "ja") => {
      state.locale = l
    }

    document.title = lang("title")

    watch(
      () => state.locale,
      () => {
        document.title = lang("title")
      }
    )

    type ui_literals = "title" | "proceed"

    // This is correct. User ID saved in localStorage must be deleted.
    deleteUserInfoOnLogout()

    const checkVerification = async () => {
      state.user = await firebase.auth().currentUser
      if (state.user) {
        await state.user.reload()
      }
      if (state.user && state.user.emailVerified) {
        location.href = "/register"
      } else {
        state.verifyStatus = "メールリンクが未確認です。"
      }
    }

    onMounted(() => {
      const access_code = new URL(location.href).searchParams.get("code")
      firebase.initializeApp(props.firebaseConfig)
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
                  const client = api(axiosClient(axios))
                  client.id_token
                    .$post({ body: { token: idToken, force: true } })
                    .then(data => {
                      const email = state.user?.email
                      if (!email) {
                        return
                      }
                      const shaObj = new jsSHA("SHA-256", "TEXT", {
                        encoding: "UTF8",
                      })
                      shaObj.update(idToken)
                      const jwt_hash = shaObj.getHash("HEX")
                      localStorage["virtual-poster:jwt_hash"] = jwt_hash
                      if (data.registered == "can_register") {
                        state.nextAction = "register"
                        localStorage["virtual-poster:email"] = email
                        location.href =
                          "/register" +
                          (access_code ? "?code=" + access_code : "")
                      } else if (
                        data.registered == "registered" &&
                        data.user_id &&
                        data.admin != undefined
                      ) {
                        state.nextAction = undefined
                        setUserInfo(data.user_id, email, data.admin)
                        localStorage["virtual-poster:name"] = data.name
                        location.href =
                          "/" + (access_code ? "?code=" + access_code : "")
                      } else {
                        console.warn("Cannot register by user", data)
                        alert(
                          "登録されていません。管理者に登録を依頼してください"
                        )
                      }
                    })
                    .catch(err => {
                      console.error(err)
                    })
                })
              } else {
                state.nextAction = "verify"
                localStorage["virtual-poster:email"] = state.user.email
                const url = new URL(location.href)
                const actionCodeSettings = {
                  url: url.origin + "/register",
                }
                state.user
                  .sendEmailVerification(actionCodeSettings)
                  .then(() => {
                    console.log("Verification email sent")
                  })
                  .catch(function (error) {
                    console.error(error)
                  })
              }

              // return state.user.emailVerified
              return false
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
        // signInSuccessUrl: "/",
        tosUrl: "<your-tos-url>",
        privacyPolicyUrl: function () {
          window.location.assign("<your-privacy-policy-url>")
        },
      }
      const ui = new firebaseui.auth.AuthUI(firebase.auth())
      ui.start("#firebaseui-auth-container", uiConfig)
      firebase.auth().onAuthStateChanged(user => {
        state.user = user
      })
    })

    return {
      ...toRefs(state),
      checkVerification,
      lang,
      changeLocale,
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
