<template>
  <div id="app" v-if="myself">
    <div>
      <div id="top-tools">
        <a style="margin-right: 10px;" :href="goback_path">マップに戻る</a>
        <button @click="signOut">ログアウト</button>
      </div>

      <h1>{{ myself.name }}さん</h1>
      <div class="info-entry">ユーザーID: {{ myUserId }}</div>
      <div class="info-entry">Email: {{ user ? user.email : "(不明)" }}</div>
      <!-- <div class="info-entry">歩数: {{ myself.stats.walking_steps }}</div> -->
      <div class="info-entry">
        表示名:
        <span v-if="editing.name">
          <input
            class="name-field"
            type="text"
            v-model="editing.name"
            @keydown.enter="saveName"
          />
          <span class="edit-btn" @click="saveName">OK</span>
          <span class="edit-btn" @click="editing.name = null">キャンセル</span>
        </span>
        <span v-else>
          <span class="name-field">{{ myself.name }} </span>
          <span class="edit-btn" @click="editing.name = myself.name">Edit</span>
        </span>
      </div>
      <span style="display:none;">{{ bgPosition }}</span>
      <!-- <div class="info-entry">
        話しかけた人:
        <span v-for="pid in myself.stats.people_encountered" :key="pid">
          {{ people[pid].name }}
        </span>
      </div> -->
      <div></div>
    </div>
    <div>
      <a
        v-for="this_tab in tabs"
        :key="this_tab.id"
        class="tab"
        :class="{ selected: tab == this_tab.id }"
        @click="tab = this_tab.id"
        >{{ this_tab.name }}</a
      >
    </div>
    <div id="tabs">
      <div v-if="tab == 'avatar'">
        <div>
          <div
            v-for="n in avatars"
            :key="n"
            alt=""
            class="avatar"
            width="38"
            :class="{ current: n == myself.avatar }"
            @click="clickAvatar(n)"
            @mouseenter="onMouseOverAvatar(n, true)"
            @mouseleave="onMouseOverAvatar(n, false)"
            :style="{
              'background-image': bgImage(n),
            }"
          />
          <div style="clear: both"></div>
          <p>画像は<a href="https://pipoya.net/sozai/">ぴぽや倉庫</a>を使用</p>
        </div>
      </div>
      <div v-if="tab == 'poster'">
        <div>ドラッグ＆ドロップでポスターを掲載（10 MB以内）</div>

        <div v-if="!posters">
          ポスターが見つかりません。
        </div>
        <div v-for="poster in posters" :key="poster.id" class="poster-entry">
          <div class="poster_title">
            <span>#{{ poster.poster_number }}: </span>
            <input
              v-if="editingTitle == poster.id"
              v-model="editingTitleText"
            />
            <span v-else>{{ poster.title }}</span>
            <div>
              <button
                v-if="editingTitle != poster.id"
                @click="
                  editingTitleText = poster.title
                  editingTitle = poster.id
                "
              >
                タイトルを変更
              </button>
              <button
                v-if="editingTitle == poster.id"
                @click="setTitle(poster.id)"
              >
                完了
              </button>
            </div>
          </div>
          <div
            v-if="!!poster"
            class="poster"
            :class="{ 'drag-hover': dragover[poster.id] }"
            @dragover.prevent
            @drop.prevent="onDrop($event, poster.id)"
            @dragover="dragover[poster.id] = true"
            @dragleave="dragover[poster.id] = false"
          >
            <img :src="dataURI[poster.id]" />
          </div>
          <button class="remove-poster" @click="removePosterFile(poster.id)">
            ポスター画像を削除
          </button>
          <button
            class="release-poster-slot"
            @click="releasePosterSlot(poster)"
          >
            ポスター枠を開放
          </button>
        </div>
      </div>

      <div v-if="tab == 'vote'">
        <h2>投票</h2>

        <div>
          事前にアナウンスした形式で，以下のボックスに投票内容を記入してください。
        </div>
        <div>
          <input type="text" v-model="vote.message" />
        </div>

        下記のボタンを押すと，投票のためのコードを取得します（ブラインド署名による匿名投票）。
        <br />
        投票コードの取得は一人１回のみです。<br />
        <button @click="blindSign" :disabled="vote.message_sent">
          投票コードの取得
        </button>

        <div v-if="vote.message_sent">
          <div style="margin: 30px 10px;">
            下記の内容を<a href="https://forms.gle/Cg4gbzSzYkhWXL2V6"
              >Googleフォーム</a
            >より送信してください（匿名で収集されます）。
          </div>
          <h3>投票内容</h3>
          <div id="vote-message">
            {{ vote.message_sent || "" }}
          </div>
          <h3>署名（投票コード）</h3>
          <div id="vote-unblinded">
            {{ vote.unblinded }}
          </div>
        </div>
      </div>
      <div v-if="tab == 'account'">
        <h2>アクセスコード</h2>
        <label for="access_code">アクセスコード</label>
        <input type="text" id="access_code" v-model="access_code" />
        <button @click="submitAccessCode(access_code)">送信</button>
        <h2>アカウント</h2>
        <div>
          <button class="btn-danger" @click="deleteAccount">
            アカウントの削除
          </button>
        </div>
        <h2>暗号化</h2>
        <div>
          個別のチャットはエンドツーエンド暗号化が可能です。<a
            href="https://ja.wikipedia.org/wiki/%E6%A5%95%E5%86%86%E6%9B%B2%E7%B7%9A%E3%83%87%E3%82%A3%E3%83%95%E3%82%A3%E3%83%BC%E3%83%BB%E3%83%98%E3%83%AB%E3%83%9E%E3%83%B3%E9%8D%B5%E5%85%B1%E6%9C%89"
            >楕円曲線ディフィー・ヘルマン鍵共有（ECDH）</a
          >および128ビット<a
            href="https://ja.wikipedia.org/wiki/Advanced_Encryption_Standard"
            >AES-GCM</a
          >を使用。<br />
        </div>
        <div>
          <h3>公開鍵</h3>

          <div class="keys">{{ publicKeyString }}</div>
          <h3>秘密鍵</h3>

          <div>
            <input
              type="checkbox"
              name=""
              v-model="enableEncryption"
              id="check-enable-encrypt"
              :disabled="!privateKeyString"
            /><label for="check-enable-encrypt"
              >エンドツーエンド暗号化を使用</label
            >
          </div>

          <div v-if="privateKeyString" style="height: 40px; margin: 10px;">
            秘密鍵が設定されています
          </div>
          <div
            class="danger"
            v-if="!privateKeyString"
            style="height: 40px; margin: 10px;"
          >
            <span style="margin-right: 10px;">秘密鍵がありません</span>
          </div>
          <button @click="setPrivateKey">
            秘密鍵を読み込み
          </button>
          <button
            :disabled="!privateKeyString"
            @click="showPrivKey = !showPrivKey"
          >
            秘密鍵を{{ showPrivKey ? "隠す" : "表示" }}
          </button>
          <pre id="mnemonic" v-if="showPrivKey">{{ privateKeyMnemonic }}</pre>
          <pre id="mnemonic" class="hidden" v-else
            >{{ privateKeyMnemonic }}
</pre
          >
          <span class="danger"
            >秘密鍵はこの端末のブラウザ内部のみに保管されています。<br />ブラウザを再インストールするなどして秘密鍵を無くすと暗号化したチャットの内容は全て読めなくなります。</span
          >秘密鍵を安全な（人から見られない，また，紛失しない）場所にコピーして保存してください。
        </div>
      </div>
      <div v-if="tab == 'help'">
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
    </div>
  </div>
</template>
<script lang="ts">
import Vue from "vue"
import {
  defineComponent,
  reactive,
  watch,
  onMounted,
  computed,
  toRefs,
  set,
} from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

import axiosDefault from "axios"
import axiosClient from "@aspida/axios"
import api from "../api/$api"

import {
  Person,
  PersonUpdate,
  Poster,
  PosterId,
  UserId,
  PersonWithEmail,
} from "../@types/types"
import { keyBy, difference, range, chunk } from "../common/util"
import io from "socket.io-client"
import * as firebase from "firebase/app"
import "firebase/auth"
import * as encryption from "./encryption"
import * as BlindSignature from "blind-signatures"
import jsbn from "jsbn"
import firebaseConfig from "../firebaseConfig"
import { deleteUserInfoOnLogout } from "./util"
const BigInteger = jsbn.BigInteger

const API_ROOT = "/api"
const axios = axiosDefault.create()
axios.defaults.baseURL = API_ROOT
const client = api(axiosClient(axios))

axios.interceptors.response.use(
  response => {
    return response
  },
  error => {
    if (403 === error.response.status) {
      deleteUserInfoOnLogout()
      location.href = "/login"
    }
  }
)

const url = new URL(location.href)
const tab = url.hash.slice(1) || "avatar"

const page_from: string | undefined = url.searchParams.get("room") || undefined

const debug_as: UserId | null = url.searchParams.get("debug_as") || null
const debug_token: string | undefined =
  url.searchParams.get("debug_token") || undefined

console.log({ debug_as, debug_token })
location.hash = "#" + tab

let socket: SocketIO.Socket | null = null

const bgPositions: string[] = ["down", "left", "up", "right"]

export default defineComponent({
  setup: () => {
    firebase.initializeApp(firebaseConfig)
    const myUserId = ""
    const name = localStorage["virtual-poster:name"]
    const user_id = localStorage["virtual-poster:user_id"]
    const email = localStorage["virtual-poster:email"]
    if (!(name && user_id && email)) {
      location.href = "/login"
    }
    const goback_path =
      (page_from ? "/room?room_id=" + page_from : "/") +
      (debug_as
        ? (page_from ? "&" : "?") +
          "debug_as=" +
          debug_as +
          "&debug_token=" +
          debug_token
        : "")
    const state = reactive({
      tab,
      user: { name, user_id, email } as {
        name: string
        email: string
        user_id: string
      } | null,
      myUserId: myUserId,
      debug_as,
      debug_token,
      jwt_hash: localStorage["virtual-poster:jwt_hash"] as string | undefined,

      people: {} as { [index: string]: PersonWithEmail },
      posters: {} as { [index: string]: Poster },
      files: {} as { [index: string]: File },
      lastLoaded: -1,

      editingTitle: null as PosterId | null,
      editingTitleText: "",

      editing: { name: null } as { name: string | null },

      dataURI: {} as { [poster_id: string]: string },

      lastUpdated: null as number | null,
      tabs: [
        { id: "avatar", name: "アバター" },
        { id: "poster", name: "ポスター" },
        { id: "vote", name: "投票" },
        { id: "account", name: "アカウント" },
        { id: "help", name: "使い方" },
      ],

      bgPosition: bgPositions[0],
      mouseOnAvatar: {} as { [index: string]: boolean },
      dragover: {} as { [poster_id: string]: boolean },
      count: 0,

      access_code: "",

      enableEncryption: false,
      showPrivKey: false,

      privateKeyString: null as string | null,
      privateKey: null as CryptoKey | null,
      privateKeyMnemonic: null as string | null,
      publicKeyString: null as string | null,
      publicKey: null as CryptoKey | null,

      Alice: {
        message: "1",
        N: null as string | null,
        E: null as string | null,
        r: null,
        signed: null,
        unblinded: null,
      },
      vote: {
        unblinded:
          localStorage["virtual-poster:" + myUserId + ":vote:unblinded"] || "",
        blinded:
          localStorage["virtual-poster:" + myUserId + ":vote:blinded"] || "",
        message:
          localStorage["virtual-poster:" + myUserId + ":vote:message_sent"] ||
          "",
        message_sent: null,
      } as {
        unblinded: string
        blinded: string
        message: string
        message_sent: string | null
      },
      avatarImages: {} as { [index: string]: string },
    })

    const myself = computed((): Person | null => {
      return state.myUserId ? state.people[state.myUserId] : null
    })

    const bgImage = (n: string) => {
      if (myself.value) {
        const data_url =
          state.avatarImages[
            n + "-" + (state.mouseOnAvatar[n] ? state.bgPosition : "down")
          ]
        return data_url ? "url('data:image/png;base64," + data_url + "')" : ""
      } else {
        return ""
      }
    }

    const setupEncryption = async (
      pub_str_from_server: string | null
    ): Promise<boolean> => {
      state.enableEncryption =
        localStorage[
          "virtual-poster:" + state.myUserId + ":config:encryption"
        ] != "0"
      let pub_str_local: string | null =
        localStorage["virtual-poster:" + state.myUserId + ":public_key_spki"]
      if (pub_str_from_server && !pub_str_local) {
        pub_str_local = pub_str_from_server
        localStorage[
          "virtual-poster:" + state.myUserId + ":public_key_spki"
        ] = pub_str_from_server
      }
      const prv_str_local = {
        jwk: (localStorage[
          "virtual-poster:" + state.myUserId + ":private_key_jwk"
        ] || null) as string | null,
        pkcs8: (localStorage["virtual-poster:private_key:" + state.myUserId] ||
          null) as string | null,
      }

      if (pub_str_from_server) {
        state.publicKeyString = pub_str_from_server
      } else {
        if (pub_str_local) {
          console.log(
            "Public key does NOT exist on server, but found in localStorage."
          )
          console.log("Public key found in localStorage")
          const data = await client.public_key.$post({
            body: {
              key: pub_str_local,
            },
          })
          console.log("/public_key", data)
          state.publicKeyString = pub_str_local
        } else {
          console.log(
            "Public key NOT found either on server or client. Generating key pair and send a public key to server."
          )
          const { ok, pub_str, prv_str } = await encryption.generateAndSendKeys(
            axios,
            state.myUserId,
            false
          )
          console.log("generateAndSendKeys()", ok)
          if (!ok || !pub_str || !prv_str) {
            console.error("Key generation failed")
            return false
          }
          prv_str_local.jwk = prv_str
          state.publicKeyString = pub_str
          state.privateKeyString = prv_str
        }
      }
      if (prv_str_local.jwk) {
        state.privateKeyString = prv_str_local.jwk
        const pub = await encryption.importPublicKey(state.publicKeyString)
        if (!pub) {
          console.error("Public key import failed")
          return false
        }
        const obj = JSON.parse(prv_str_local.jwk)
        const prv = await encryption.importPrivateKeyJwk(obj, pub, true)
        if (!prv) {
          console.error("Private key import failed")
          return false
        }
        state.privateKey = prv.key
        state.privateKeyMnemonic = chunk(prv.mnemonic.split(" "), 6)
          .map(c => c.join(" "))
          .join("\n")
      } else if (prv_str_local.pkcs8) {
        //Converting existing private key to JWK format.
        const prv = await encryption.importPrivateKeyPKCS(
          prv_str_local.pkcs8,
          true
        )
        state.privateKey = prv
        prv_str_local.jwk = await encryption.exportPrivateKeyJwk(prv)
        localStorage["virtual-poster:" + state.myUserId + ":private_key_jwk"] =
          prv_str_local.jwk
        state.privateKeyString = prv_str_local.jwk
      }
      return true
    }

    const reload = () => {
      state.lastUpdated = Date.now()
      ;(async () => {
        const [
          data_p,
          data_poster,
          { public_key: pub_str_from_server },
        ] = await Promise.all([
          client.people.$get(),
          client.people._userId(state.myUserId).posters.$get(),
          client.public_key.$get(),
        ])
        state.people = keyBy(data_p, "id")
        state.posters = keyBy(data_poster.posters || [], "id")
        state.privateKey =
          localStorage[
            "virtual-poster:" + state.myUserId + ":private_key_jwk"
          ] || localStorage["virtual-poster:private_key:" + state.myUserId]
        await setupEncryption(pub_str_from_server || null)
      })().catch(err => {
        console.error(err)
      })
    }
    const clickAvatar = async (n: string) => {
      const data = await client.people
        ._userId(state.myUserId)
        .$patch({ body: { avatar: n } })
      if (data.ok) {
        Vue.set(state.people[state.myUserId], "avatar", n)
      }
    }
    const setPerson = (d: PersonUpdate) => {
      console.log("setPerson", d)
      const p = state.people[d.id]
      const person: Person = {
        id: d.id,
        name: d.name || p.name,
        last_updated: d.last_updated,
        avatar: d.avatar || p.avatar,
        stats: d.stats || p.stats,
      }
      set(state.people, d.id, person)
    }
    const saveName = async (ev: KeyboardEvent & MouseEvent) => {
      if (ev.keyCode && ev.keyCode !== 13) return
      const new_name = state.editing.name
      if (!new_name) {
        alert("表示名を入力してください。")
        state.editing.name = null
        return
      }
      console.log(state.myUserId, new_name)
      if (new_name.length > 8) {
        alert("表示名は8文字以内にしてください。")
        state.editing.name = null
        return
      }
      const data = await client.people
        ._userId(state.myUserId)
        .$patch({ body: { name: new_name } })
      console.log(data)
      set(state.people[state.myUserId], "name", new_name)
      state.editing.name = null
    }
    const signOut = async () => {
      await firebase.auth().signOut()
      console.log("Firebase signed out")
      await client.logout.$post()
      console.log("App signed out")
      deleteUserInfoOnLogout()
      location.href = "/login"
    }
    const setTitle = async (pid: PosterId) => {
      const title = state.editingTitleText
      const data = await client.posters
        ._posterId(pid)
        .$patch({ body: { title } })
      if (data.ok) {
        Vue.nextTick(() => {
          Vue.set(state.posters[pid], "title", title)
        })
        Vue.nextTick(() => {
          state.editingTitle = null
        })
      }
    }
    const onDrop = async (event: any, poster_id: PosterId) => {
      state.dragover[poster_id] = false
      const fileList: File[] = event.target.files
        ? event.target.files
        : event.dataTransfer.files
      if (fileList.length == 0) {
        return false
      }
      const files: File[] = []
      for (let i = 0; i < fileList.length; i++) {
        files.push(fileList[i])
      }
      console.log(files)

      const file = files[0]
      if (!file) {
        console.error("File not found")
      } else if (file.type != "image/png" && file.type != "application/pdf") {
        console.error("File type invalid")
        alert("ファイル形式はPDFあるいはPNGのみ対応しています。")
      } else if (file.size >= 10e6) {
        console.error("File size loo large")
        alert("ファイルサイズを10MB以下にしてください。")
      } else {
        const fd = new FormData() //★②
        fd.append("file", file)
        console.log(fd)

        const { data } = await axios.post("/posters/" + poster_id + "/file", fd)
        console.log(data)
        set(state.posters, poster_id, data.poster)
      }
    }
    const removePosterFile = async (poster_id: PosterId) => {
      const data = await client.posters._posterId(poster_id).file.$delete()
      console.log(data)
      if (data.ok && data.poster) {
        set(state.posters, data.poster.id, data.poster)
        set(state.dataURI, data.poster.id, "")
      }
    }

    onMounted(() => {
      client.socket_url
        .$get()
        .then(data => {
          const url = data.socket_url as string
          socket = io(url)
          if (!socket) {
            console.error("Socket connection failed.")
            return
          }
          socket.on("connect", () => {
            socket?.emit("Active", {
              room: "::mypage",
              user: state.myUserId,
              token: state.jwt_hash,
            })
            console.log("Connected")
          })
          socket.on("person", d => {
            setPerson(d)
          })
          socket.on("person_multi", ds => {
            console.log("socket people", ds.length)
            for (const d of ds) {
              setPerson(d)
            }
          })
          socket.on("Poster", (p: Poster) => {
            Vue.set(state.posters, p.id, p)
          })
          socket.on("PosterRemove", (pid: PosterId) => {
            Vue.delete(state.posters, pid)
          })
        })
        .catch(err => {
          console.error(err)
        })

      axios.interceptors.request.use(config => {
        if (debug_as && debug_token) {
          config.params = config.params || {}
          config.params["debug_as"] = debug_as
          config.params["debug_token"] = debug_token
          return config
        } else {
          return config
        }
      })
      axiosDefault
        .get("/img/avatars_base64.json")
        .then(({ data }) => {
          console.log(data)
          state.avatarImages = data
        })
        .catch(console.error)
      ;(async () => {
        // console.log("User:", user, state.debug_as)
        if (state.debug_as && state.debug_token) {
          console.log("Initializing debug mode...", state.debug_as)
          state.myUserId = state.debug_as
          state.privateKey =
            localStorage[
              "virtual-poster:" + state.myUserId + ":private_key_jwk"
            ] || null
          state.enableEncryption =
            localStorage[
              "virtual-poster:" + state.myUserId + ":config:encryption"
            ] != "0"
              ? localStorage[
                  "virtual-poster:" + state.myUserId + "config:encryption"
                ] == "1"
              : false
          reload()
          return
        }
        if (!state.user) {
          // location.href = "/login?page=index"
          // state.loggedIn = "No"
          location.href = "/"
        } else {
          // state.loggedIn = "Yes"

          state.myUserId = user_id
          // console.log("Already registered:", user_id)

          state.privateKey =
            localStorage[
              "virtual-poster:" + state.myUserId + ":private_key_jwk"
            ] || null

          state.enableEncryption =
            localStorage[
              "virtual-poster:" + state.myUserId + ":config:encryption"
            ] != "0"

          reload()
        }
      })().catch(console.error)

      window.setInterval(() => {
        state.count += 1
        if (state.count >= bgPositions.length) {
          state.count = 0
        }
        state.bgPosition = bgPositions[state.count]
      }, 500)
    })
    watch(
      () => state.enableEncryption,
      () => {
        localStorage[
          "virtual-poster:" + state.myUserId + ":config:encryption"
        ] = state.enableEncryption ? "1" : "0"
      }
    )
    watch(
      () => state.posters,
      () => {
        for (const poster of Object.values(state.posters)) {
          console.log("get poster ", poster.id)
          if (state.lastLoaded > poster.last_updated) {
            continue
          }
          const url = poster.file_url
          console.log
          axiosDefault({
            method: "GET",
            responseType: "arraybuffer",
            url,
          })
            .then(({ data }) => {
              const image = btoa(
                new Uint8Array(data).reduce(
                  (d, byte) => d + String.fromCharCode(byte),
                  ""
                )
              )
              set(state.dataURI, poster.id, "data:image/png;base64," + image)
            })
            .catch(() => {
              //
            })
        }
        state.lastLoaded = Date.now()
      }
    )
    watch(
      () => state.tab,
      (newTab: string) => {
        location.replace("#" + newTab)
      }
    )
    const onMouseOverAvatar = (n: string, b: boolean) => {
      state.mouseOnAvatar[n] = b
      // console.log("mouse", n, b, state.mouseOnAvatar)
    }
    const setPrivateKey = () => {
      const prv_str_to_import = prompt("秘密鍵のパスフレーズを入力してください")
      console.log("prv_str_to_import", prv_str_to_import)
      if (!prv_str_to_import) {
        return
      }

      if (!prv_str_to_import || !state.publicKeyString) {
        console.log("Either key missing")
      } else {
        ;(async (prv_key_str: string, pub_key_str: string) => {
          try {
            console.log("Start importing")
            const { key: prv_d, error } = encryption.fromMnemonic(prv_key_str)
            if (!prv_d) {
              alert("パスフレーズを読み込めませんでした: " + error)
              return
            }
            const pub = await encryption.importPublicKey(pub_key_str, true)
            if (!pub) {
              alert("公開鍵が正しくないため，インポートできませんでした")
              return
            }
            console.log("pub_key_str", pub_key_str)
            const prv_key_obj: JsonWebKey = await encryption.exportPublicKeyJwk(
              pub
            )
            prv_key_obj.d = prv_d
            prv_key_obj.key_ops = ["deriveKey", "deriveBits"]
            console.log(prv_key_obj)
            try {
              const prv = await encryption.importPrivateKeyJwk(
                prv_key_obj,
                pub,
                true
              )
              console.log("Imported private key", prv)
              if (!prv) {
                alert(
                  "秘密鍵と公開鍵が適合しないため，インポートできませんでした"
                )
                return
              }
              state.privateKeyString = await encryption.exportPrivateKeyJwk(
                prv.key
              )
              state.privateKeyMnemonic = chunk(prv.mnemonic.split(" "), 6)
                .map(c => c.join(" "))
                .join("\n")

              localStorage[
                "virtual-poster:" + state.myUserId + ":private_key_jwk"
              ] = state.privateKeyString
              alert("秘密鍵をインポートしました")
            } catch (err1) {
              console.error(err1)
              alert("秘密鍵が正しくないため，インポートできませんでした")
              return
            }
          } catch (err) {
            console.error(err)
          }
        })(prv_str_to_import, state.publicKeyString).catch(err => {
          console.error(err)
        })
      }
    }

    const validateVote = (s: string): boolean => {
      try {
        const v = parseInt(s)
        return !isNaN(v)
      } catch (err) {
        console.error(err)
        return false
      }
    }
    const blindSign = async () => {
      state.vote.message = state.vote.message.trim()
      if (!validateVote(state.vote.message)) {
        alert("入力できるのは数値のみです。")
        return
      }
      state.Alice.message = state.vote.message
      console.log("Signing")
      console.log("Message:", state.Alice.message)

      const data = await client.blind_sign.key_pair.$get()
      console.log("blind key pair", data)
      state.Alice.N = data.N
      state.Alice.E = data.E
      const { blinded, r } = BlindSignature.blind({
        message: state.vote.message,
        N: state.Alice.N,
        E: state.Alice.E,
      }) // Alice blinds message
      state.Alice.r = r
      console.log("blinded", blinded, blinded.toString())
      console.log(blinded.compareTo(new BigInteger(blinded.toString())))
      const data2 = await client.blind_sign.sign.$post({
        body: {
          blinded: blinded.toString(),
        },
      })
      if (!data2.ok) {
        alert("投票コード取得済みです")
        set(
          state.vote,
          "message_sent",
          localStorage[
            "virtual-poster:" + state.myUserId + ":vote:message_sent"
          ] || ""
        )
        set(
          state.vote,
          "unblinded",
          localStorage[
            "virtual-poster:" + state.myUserId + ":vote:unblinded"
          ] || ""
        )
        return
      }

      // Bob sends signed to Alice
      state.Alice.signed = new BigInteger(data2.signed)

      console.log("Signed", state.Alice.signed)

      const unblinded = BlindSignature.unblind({
        signed: state.Alice.signed,
        N: state.Alice.N,
        r: state.Alice.r,
      }) // Alice unblinds
      state.Alice.unblinded = unblinded
      console.log("unblinded", unblinded)

      // Alice verifies
      const result = BlindSignature.verify({
        unblinded: state.Alice.unblinded,
        N: state.Alice.N,
        E: state.Alice.E,
        message: state.vote.message,
      })
      if (result) {
        console.log("Alice: Signatures verify!")
        set(state.vote, "unblinded", unblinded)
        set(state.vote, "message_sent", state.vote.message)
      } else {
        console.log("Alice: Invalid signature")
        alert("投票コードが取得できませんでした。")
      }

      localStorage[
        "virtual-poster:" + state.myUserId + ":vote:unblinded"
      ] = unblinded.toString()
      localStorage[
        "virtual-poster:" + state.myUserId + ":vote:blinded"
      ] = blinded.toString()
      localStorage["virtual-poster:" + state.myUserId + ":vote:message_sent"] =
        state.vote.message

      // Alice sends Bob unblinded signature and original message
      const data3 = await client.blind_sign.verify.$get({
        query: {
          unblinded: unblinded.toString(),
          message: state.vote.message,
        },
      })
      console.log("Blind signature verification", data3, unblinded.toString())
    }

    const deleteAccount = async () => {
      const r = confirm(
        "アカウントを削除します。一旦削除すると取り消せません。本当にいいですか？"
      )
      if (!r) {
        return
      }
      const { data } = await axios.delete("/people/" + state.myUserId)
      console.log("delete account result", r)
      if (data.ok) {
        localStorage.removeItem("virtual-poster:user_id")
        localStorage.removeItem("virtual-poster:email")
        localStorage.removeItem("virtual-poster:name")
        localStorage.removeItem("virtual-poster:admin")

        var arr = [] as string[]
        for (let i = 0; i < localStorage.length; i++) {
          if (
            localStorage.key(i)?.indexOf("virtual-poster:" + state.myUserId) ==
            0
          ) {
            const k = localStorage.key(i)
            if (k) {
              arr.push(k)
            }
          }
        }

        // Iterate over arr and remove the items by key
        for (var i = 0; i < arr.length; i++) {
          localStorage.removeItem(arr[i])
        }
        location.href = "/login"
      }
    }

    const submitAccessCode = async (code: string) => {
      const r = await client.people
        ._userId(state.myUserId)
        .access_code.$post({ body: { access_code: code } })
      console.log(r)
      if (!r.ok) {
        const idx = r.error?.indexOf("Access code is invalid")
        if (idx && idx >= 0) {
          alert("アクセスコードが正しくありません。")
        } else {
          alert("エラー（すでにアクセスできるマップの可能性）")
        }
      }
    }

    const releasePosterSlot = async (poster: Poster) => {
      const num = poster.poster_number
      if (!num) {
        return
      }
      await client.maps
        ._roomId(poster.room)
        .poster_slots._posterNumber(num)
        .$delete()
    }

    return {
      ...toRefs(state),
      onMouseOverAvatar,
      validateVote,
      setupEncryption,
      deleteAccount,
      setPrivateKey,
      blindSign,
      bgImage,
      signOut,
      reload,
      setTitle,
      clickAvatar,
      saveName,
      onDrop,
      removePosterFile,
      releasePosterSlot,
      goback_path,
      avatars: difference(range(1, 31), [20]).map(n => {
        return n.toString().padStart(3, "0")
      }),
      page_from,
      myself,
      submitAccessCode,
    }
  },
})
</script>
<style lang="css">
body {
  font-size: 16px;
}

#top-tools {
  float: right;
}
.info-entry {
  height: 30px;
  padding: 0px;
  vertical-align: baseline;
}
h1 {
  font-size: 24px;
  margin: 0px;
}
.tab {
  font-size: 16px;
  font-weight: bold;
  display: inline-block;
  cursor: pointer;
  width: 120px;
  margin: 3px;
  padding: 5px;
  border-top: 1px solid black;
  border-left: 1px solid black;
  border-right: 1px solid black;
  border-radius: 5px 5px 0px 0px;
}

.tab.selected {
  border-top: 2px solid black;
  border-left: 2px solid black;
  border-right: 2px solid black;
  background: #99f;
}

div.avatar {
  background-size: 48px;
  background-repeat: no-repeat;
  width: 50px;
  height: 50px;
  float: left;
  margin: 8px;
  box-sizing: border-box;

  cursor: pointer;
}

div.avatar:hover {
  border: rgba(0, 0, 255, 0.4) 2px solid;
}

div.avatar.current {
  border: blue 2px solid;
}

.edit-btn {
  cursor: pointer;
  font-size: 12px;
  border: 1px #555 solid;
  border-radius: 3px;
  padding: 2px;
}
.name-field {
  font-size: 16px;
  width: 300px;
  margin: 5px;
  box-sizing: border-box;
  display: inline-block;
}
input {
  height: 24px;
}

h2 {
  margin: 0px;
}
.keys {
  margin-top: 10px;
  max-width: 800px;
  word-break: break-all;
  font-family: Courier, monospace;
}

div.poster-entry {
  border: black 1px solid;
  width: 440px;
  height: 750px;
  float: left;
}

.danger {
  color: #f44;
  font-weight: bold;
}

#vote-unblinded {
  width: 80%;
  word-break: break-all;
  font-family: "Courier New", Courier, monospace;
}

div.poster {
  border: 1px solid black;
  width: 420px;
  height: 594px;
  top: 80px;
  margin: 10px;
}

div.poster.drag-hover {
  border: #99f 3px solid;
  box-sizing: border-box;
}

div.poster img {
  max-width: 100%;
  max-height: 100%;
}

.poster_info {
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.2);
  width: 208px;
  background: rgba(255, 255, 255, 0.5);
}

.poster_author {
  margin: 0px;
}

.poster_title {
  margin: 10px;
  height: 80px;
}

button.remove-poster {
  position: relative;
  left: 10px;
  bottom: 1px;
}

button.release-poster-slot {
  position: relative;
  left: 100px;
  bottom: 1px;
}

.btn-danger {
  background: red;
}

#mnemonic {
  font-family: "Courier New", Courier, monospace;
  font-size: 21px;
  word-break: normal;
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
</style>
