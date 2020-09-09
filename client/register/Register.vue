<template>
  <div id="app" v-cloak>
    <h1>ユーザー登録 - バーチャルポスターセッション</h1>
    <div>
      <h2>
        ユーザー情報を入力してください。
      </h2>
      <div>
        <label for="register-email">Email</label>
        <input type="text" id="register-email" v-model="email" disabled />
        <br />
        <label for="register-name">名前</label>
        <input
          type="text"
          id="register-name"
          v-model="register_name"
          :disabled="loginReady"
        />
        <br />
        <label for="access-code">アクセスコード</label>
        <input
          type="text"
          id="access-code"
          v-model="access_code"
          :disabled="loginReady"
        />
        <button @click="submitRegistration" :disabled="loginReady">登録</button>
        <transition name="fade">
          <div v-if="loginReady" id="register-done">
            登録が完了しました
          </div>
        </transition>
      </div>
      <transition name="fade-2">
        <div v-if="loginReady">
          <h2>秘密鍵パスフレーズ</h2>
          <p id="explain-key">
            このパスフレーズはチャットのエンドツーエンド暗号化に使用されます。<br />
            紛失しない，人に見られない場所に保管してください。<br />
            この端末のみに保存されるため，他の端末からアプリケーションを利用する場合には再度入力が必要です。<br />
            ※同じ端末であれば，パスフレーズはマイページの「アカウント」タブからいつでも確認できます。
          </p>
          <button @click="show_key = !show_key">
            秘密鍵を{{ show_key ? "隠す" : "表示する" }}
          </button>
          <pre id="mnemonic" v-if="show_key">{{ prv_mnemonic_formatted }}</pre>
          <pre id="mnemonic" class="hidden" v-else
            >{{ prv_mnemonic_formatted }}
</pre
          >
          <div>
            <h2>簡単な使い方</h2>
            <p style="font-size: 14px; line-height: 1; margin: 0px;">
              ※ マイページ（マップ画面よりアクセス可能）にも記載されています。
            </p>
            <ul>
              <li>移動： カーソルキーあるいは画面上の矢印ボタンで移動。</li>
              <li>
                会話：
                人をダブルクリックして開始。隣りにいる人であれば途中からメンバーを追加可能。「会話から離脱」を押して終了。鍵アイコンをクリックして黒くすると会話を暗号化。
              </li>
              <li>
                ポスター：
                隣のマスに行くとポスターを表示，コメント書き込み・閲覧可能。
              </li>
              <li>
                ポスター板の確保：
                空いているポスター板（木札のアイコン）をダブルクリック（会場管理者が許可している場合のみ）。
              </li>
              <li>
                ポスターの掲示：
                自分のポスター板にPNGまたはPDFをドラッグ＆ドロップするか，マイページ（人型のアイコン）からアップロード。
              </li>
              <li>
                ポスターの撤去： マイページで「ポスター画像を削除」をクリック
              </li>
            </ul>
          </div>
          <a href="/" id="go-to-home" class="btn"
            >ホーム画面に移動して利用開始</a
          >
        </div>
      </transition>

      <div>{{ verifyStatus }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import firebaseConfig from "../../firebaseConfig"

import { onMounted, toRefs, computed } from "@vue/composition-api"
import axios from "axios"
import * as firebase from "firebase/app"
import "firebase/auth"

import Vue from "vue"
import { defineComponent, reactive } from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
import * as encryption from "../encryption"
import { chunk } from "../../common/util"

Vue.use(VueCompositionApi)

const API_ROOT = "/api"
axios.defaults.baseURL = API_ROOT

import axiosClient from "@aspida/axios"
import api from "../../api/$api"
const client = api(axiosClient(axios))

export default defineComponent({
  setup() {
    const state = reactive({
      email: localStorage["virtual-poster:email"] as string | undefined,
      user: null as any | null,
      verifyStatus: "",
      nextAction: undefined as "register" | "verify" | undefined,
      register_name: localStorage["virtual-poster:name"] || "",
      access_code: "",
      show_key: false,
      loginReady: localStorage["virtual-poster:user_id"] != undefined,
      prv_mnemonic: undefined as string | undefined,
    })
    const user_id = localStorage["virtual-poster:user_id"] as string | undefined
    const prv_local_str: string | undefined = user_id
      ? localStorage["virtual-poster:" + user_id + ":private_key_jwk"]
      : undefined
    if (prv_local_str) {
      const prv_local: JsonWebKey = JSON.parse(prv_local_str)
      if (prv_local.d) {
        state.prv_mnemonic = encryption.getMnemonic(prv_local.d)
      }
    }
    const prv_mnemonic_formatted = computed(() => {
      return state.prv_mnemonic
        ? chunk(state.prv_mnemonic.split(" "), 6)
            .map(c => c.join(" "))
            .join("\n")
        : ""
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
      firebase.initializeApp(firebaseConfig)
      const uiConfig: firebaseui.auth.Config = {
        callbacks: {
          signInSuccessWithAuthResult: authResult => {
            state.user = authResult.user
            if (state.register_name == "") {
              state.register_name = authResult.user.displayName
            }
            if (!state.user) {
              return false
            } else {
              console.log("Email verified:", state.user.emailVerified)
              if (state.user.emailVerified) {
                authResult.user.getIdToken(true).then(idToken => {
                  axios.defaults.headers.common = {
                    Authorization: `Bearer ${idToken}`,
                  }
                  client.id_token
                    .$post({ body: { token: idToken } })
                    .then(data => {
                      console.log("/id_token result", data)
                      if (data.registered == "can_register") {
                        state.nextAction = "register"
                        location.href = "/register"
                      } else if (data.registered == "registered") {
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
                  url: "/register",
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
      firebase.auth().onAuthStateChanged(user => {
        state.user = user
      })
    })

    console.log("state", state)
    const submitRegistration = async ev => {
      console.log(state.register_name)
      const data = await client.register.$post({
        body: {
          email: state.user.email,
          name: state.register_name,
          access_code: state.access_code,
        },
      })
      console.log("/register result", data)
      if (data.ok && data.user) {
        localStorage["virtual-poster:name"] = data.user.name
        localStorage["virtual-poster:user_id"] = data.user.id
        const r2 = await encryption.setupEncryption(
          axios,
          data.user.id,
          data.user.public_key
        )
        state.loginReady = true
        state.prv_mnemonic = r2.prv_mnemonic
      } else if (data.error?.indexOf("Email already exists") == 0) {
        alert(
          "このEmailアドレスのアカウントは既に登録されています。ホーム画面に移動します。"
        )
        location.href = "/"
      }
    }
    return {
      ...toRefs(state),
      checkVerification,
      submitRegistration,
      prv_mnemonic_formatted,
    }
  },
})
</script>

<style>
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

h1 {
  display: block;
  /* margin: auto; */
  /* text-align: center; */
}
h2 {
  margin: 10px 0px 5px 0px;
}
body {
  font-family: Loto, "YuGothic", sans-serif;
  margin: 20px;
}
#login-info {
  background: #eeeeff;
  height: 25px;
  padding: 10px;
}

#mnemonic {
  font-family: "Courier New", Courier, monospace;
  font-size: 21px;
  border: 1px solid black;
  padding: 10px;
  height: 120px;
  width: 700px;
}

#mnemonic.hidden {
  color: transparent;
  /* background: #ccc; */
  text-shadow: 0 0 16px rgba(0, 0, 0, 0.9);
}

#register-done {
  color: blue;
  font-weight: bold;
  margin-left: 180px;
}

input {
  width: 300px;
  height: 24px;
  font-size: 21px;
}

label {
  display: inline-block;
  text-align: right;
  width: 120px;
  margin-right: 5px;
}

#go-to-home {
  margin-top: 25px;
  display: block;
  font-weight: bold;
  font-size: 21px;
  width: 700px;
  /* height: 30px; */
  background: #cfc;
  text-align: center;
}

#go-to-home:hover {
  background: rgb(80, 240, 80);
}

#explain-key {
  font-size: 18px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.fade-2-enter-active,
.fade-2-leave-active {
  transition: opacity 0.5s;
  transition-delay: 1s;
}
.fade-2-enter,
.fade-2-leave-to {
  opacity: 0;
}
</style>
