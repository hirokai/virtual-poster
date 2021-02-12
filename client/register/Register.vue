<template>
  <div id="app" v-cloak>
    <h1 class="title is-4">{{ lang("title") }}</h1>
    <div>
      <h2>{{ lang("enter_info") }}</h2>
      <div>
        <label for="register-email">Email</label>
        <input type="text" id="register-email" v-model="email" disabled />
        <br />
        <label for="register-name">{{ lang("name") }}</label>
        <input
          type="text"
          id="register-name"
          v-model="register_name"
          :disabled="loginReady"
        />
        <br />
        <label for="access-code" style="display: none">アクセスコード</label>
        <input
          type="text"
          id="access-code"
          v-model="access_code"
          :disabled="loginReady"
          style="display: none"
        />
        <button
          class="button is-primary"
          id="submit"
          @click="submitRegistration"
          :disabled="loginReady"
        >
          {{ lang("register") }}
        </button>
        <transition name="fade">
          <div v-if="loginReady" id="register-done">{{ lang("complete") }}</div>
        </transition>
      </div>
      <transition name="fade-2"
        ><div v-if="loginReady">
          <div>
            <h5 class="title is-5">{{ lang("instruction") }}</h5>
            <p style="font-size: 14px; line-height: 1; margin: 0px">
              {{ lang("instruction_note") }}
            </p>
            <ul>
              <li>
                {{ lang("help_move") }}
              </li>
              <li>
                {{ lang("help_chat") }}
              </li>
              <li>{{ lang("help_poster") }}</li>
              <li>
                {{ lang("help_take_poster") }}
              </li>
              <li>
                {{ lang("help_placing_poster") }}
              </li>
              <li>
                {{ lang("help_remove_poster") }}
              </li>
            </ul>
          </div>
          <a :href="'/?code=' + access_code" id="go-to-home" class="btn">{{
            lang("start")
          }}</a>
        </div>
      </transition>

      <div>{{ verifyStatus }}</div>

      <div
        class="buttons has-addons"
        style="float: left; margin: 30px 10px 0px 0px"
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
  </div>
</template>

<script lang="ts">
import {
  onMounted,
  toRefs,
  computed,
  defineComponent,
  reactive,
  watch,
} from "vue"
import axiosDefault from "axios"
import * as firebase from "firebase/app"
import "firebase/auth"

import * as encryption from "../encryption"
import { chunk } from "@/common/util"

const API_ROOT = "/api"
const axios = axiosDefault.create({ baseURL: API_ROOT })

import axiosClient from "@aspida/axios"
import api from "@/api/$api"
const client = api(axiosClient(axios))

export default defineComponent({
  props: {
    firebaseConfig: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const state = reactive({
      email: localStorage["virtual-poster:email"] as string | undefined,
      user: null as any | null,
      verifyStatus: "",
      nextAction: undefined as "register" | "verify" | undefined,
      register_name: localStorage["virtual-poster:name"] || "",
      access_code: new URL(location.href).searchParams.get("code") || "",
      show_key: false,
      loginReady: localStorage["virtual-poster:user_id"] != undefined,
      prv_mnemonic: undefined as string | undefined,
      locale: (navigator.language == "ja" ? "ja" : "en") as "en" | "ja",
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
        title: {
          ja: "ユーザー登録 - バーチャルポスターセッション",
          en: "Registration - Virtual poster session",
        },
        instruction: {
          ja: "簡単な使い方",
          en: "How to use",
        },
        help_move: {
          ja:
            "移動：カーソルキー，hjklキー（それぞれ左，下，上，右），yubnキー（左上，右上，左下，右下）で移動。あるいは画面上の矢印ボタンで移動。",
          en:
            "Move: Use the cursor keys, hjkl keys (left, down, up, and right, respectively), and yubn keys (upper left, upper right, lower left, and lower right, respectively) to move. Or use the arrow buttons on the screen to move.",
        },
        help_chat: {
          ja:
            "会話： 人をダブルクリックして開始。隣りにいる人であれば途中からメンバーを追加可能。「会話から離脱」を押して終了。鍵アイコンをクリックして黒くすると会話を暗号化。",
          en:
            'Chat: Double-click on a person to start. You can add members from the middle of the conversation as long as they are next to you. Click "Leave conversation" to end. Click on the key icon to turn it black to encrypt the conversation.',
        },
        help_poster: {
          ja:
            "ポスター： 隣のマスに行き，「ポスターを閲覧」を押すとポスターを表示，コメント書き込み・閲覧可能。",
          en:
            'Poster: Go to the adjacent cell and click on "View Poster" to view the poster and write comments.',
        },
        help_take_poster: {
          ja:
            "ポスター板の確保： 空いているポスター板（木札のアイコン）をダブルクリック（会場管理者が許可している場合のみ）。",
          en:
            "Taking a poster board: Double-click on an empty poster board (wooden tag icon) (only if the room owner allows it).",
        },
        help_placing_poster: {
          ja:
            "ポスター画像の掲示： 自分のポスター板にPNGまたはPDFをドラッグ＆ドロップするか，マイページ（人型のアイコン）からアップロード。",
          en:
            "Uploading poster image: Drag and drop the PNG or PDF file onto your poster board, or upload it from Preferences (the human icon).",
        },
        help_remove_poster: {
          ja: "ポスターの撤去： マイページで「ポスター画像を削除」をクリック。",
          en: "Removing a poster: Click 'Delete Poster' in Preferences",
        },
        enter_info: {
          ja: "表示する名前を入力してください。後でいつでも変えられます。",
          en: "Enter your display name below. You can change it later.",
        },
        name: {
          ja: "名前",
          en: "Name",
        },
        register: {
          ja: "登録",
          en: "Register",
        },
        complete: {
          ja: "登録が完了しました",
          en: "Registration is complete.",
        },
        start: {
          ja: "ホーム画面に移動して利用開始",
          en: "Go to home to start",
        },
        instruction_note: {
          ja:
            "※ マイページ（マップ画面よりアクセス可能）にも記載されています。",
          en:
            "* You can also find this on Help tab on Preferences page (accessible from the map screen).",
        },
      }
      return message[key][state.locale]
    }
    document.title = lang("title")

    watch(
      () => state.locale,
      () => {
        document.title = lang("title")
      }
    )

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
      firebase.initializeApp(props.firebaseConfig)
      firebase.auth().onAuthStateChanged(user => {
        state.user = user
      })
    })

    console.log("state", state)
    const submitRegistration = async () => {
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
      } else if (data.error?.indexOf("Access code is invalid") != -1) {
        alert(
          "アクセスコードが正しくありません。修正するか，アクセスコード無しで登録してください。"
        )
      } else if (data.error?.indexOf("User name already exists") != -1) {
        alert(
          "このユーザー名は既に登録されています。別の名前を選択してください。"
        )
      } else {
        alert(
          `エラーが発生しました： 登録情報： ${{
            email: state.user.email,
            name: state.register_name,
            access_code: state.access_code.slice(0, 5) + "...",
          }} エラー${data.error || "不明なエラー"}`
        )
      }
    }
    return {
      ...toRefs(state),
      checkVerification,
      submitRegistration,
      prv_mnemonic_formatted,
      lang,
      changeLocale,
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

#submit {
  margin-top: 10px;
  margin-left: 325px;
  width: 100px;
  height: 30px;
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
