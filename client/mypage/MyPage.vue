<template>
  <div id="app" v-if="myself" class="columns">
    <!-- <div>
      <div id="top-tools">
        <a style="margin-right: 10px;" :href="goback_path">マップに戻る</a>
        <button @click="signOut">ログアウト</button>
      </div>
    </div> -->
    <div class="column">
      <span style="display: none">{{ bgPosition }}</span>
      <div class="tabs">
        <ul>
          <li
            class="tab"
            :class="{ 'is-active': tab == this_tab.id }"
            v-for="this_tab in tabs"
            :key="this_tab.id"
            @click="tab = this_tab.id"
          >
            <a>{{ this_tab.name }}</a>
          </li>
        </ul>
      </div>
      <div id="tabs">
        <ManageRooms
          v-if="tab == 'rooms'"
          :myUserId="myUserId"
          :axios="axios"
          :socket="socket"
          :people="people"
          :rooms="rooms"
          :room="tab_sub ? rooms[tab_sub] : undefined"
          :room_subpage="tab_sub_sub"
          :new_room="tab_sub == 'new'"
          @reload-rooms="reloadRooms"
          @delete-room="deleteRoom"
          @change-room="changeRoom"
          @make-announcement="doSubmitAnnouncement"
          @ask-reload="askReload"
          @renew-access-code="renewAccessCode"
          @delete-access-code="deleteAccessCode"
        />
        <div class="tab-content" id="tab-map" v-if="tab == 'style'">
          <section>
            <div style="font-size: 80%; margin: 10px 0px">
              下記の設定は端末に保存されます
            </div>
            <h5 class="title is-5">表示設定</h5>
            <h6 class="title is-6">全体</h6>
            <div>
              <span style="vertical-align: -7px">ダークモード</span>
              <button
                class="button"
                :class="{ 'is-primary': !darkModeUnset && darkMode }"
                @click="setDarkMode(true)"
              >
                ON
              </button>
              <button
                class="button"
                :class="{ 'is-primary': !darkModeUnset && !darkMode }"
                @click="setDarkMode(false)"
              >
                OFF
              </button>
              <button
                class="button"
                :class="{ 'is-primary': darkModeUnset }"
                @click="setDarkMode(undefined)"
              >
                OSの設定に合わせる
              </button>
            </div>
            <h6 class="title is-6">マップ</h6>
            <div>
              <span style="vertical-align: -7px">マップの表示</span>
              <button
                class="button"
                :class="{ 'is-primary': mapVisualStyle == n[0] }"
                v-for="n in [
                  ['default', 'デフォルト'],
                  ['abstract', '抽象'],
                  ['monochrome', 'モノクロ'],
                  ['abstract_monochrome', '抽象・モノクロ'],
                ]"
                :key="n[0]"
                @click="setStyle(n[0])"
              >
                {{ n[1] }}
              </button>
            </div>
            <div>
              <input
                type="checkbox"
                name=""
                id="config-show-minimap"
                v-model="enableMiniMap"
              />
              <label for="config-show-minimap">ミニマップを表示する</label>
            </div>
            <h6 class="title is-6">チャット</h6>
            <div>
              <input
                type="checkbox"
                name=""
                id="config-show-empty-sessions"
                v-model="showEmptySessions"
              />
              <label for="config-show-empty-sessions"
                >会話が無かったセッション（開始〜解散）を表示する</label
              >
            </div>
          </section>
        </div>
        <div
          class="tab-content"
          id="tab-map"
          v-if="tab == 'rooms' && tab_sub == undefined"
        >
          <section>
            <h5 class="title is-5">アクセスコード</h5>
            <label for="access_code">アクセスコード</label>
            <input
              type="text"
              id="access_code"
              ref="AccessCodeInput"
              style="width: 300px; margin-right: 10px"
            />
            <button @click="submitAccessCode" class="button is-primary">
              送信
            </button>
            <h3>注意</h3>
            <ul>
              <li>
                会場に参加すると，会場のオーナーにメールアドレスが開示されます。
              </li>
            </ul>
          </section>
        </div>
        <MypagePoster
          v-if="tab == 'poster'"
          :posters="postersSorted"
          :people="people"
          :rooms="rooms"
          :lastLoaded="lastLoaded"
          :view_history="view_history"
          @set-poster="setPoster"
          @delete-poster="deletePoster"
          @update-last-loaded="updateLastLoaded"
        />
        <div v-if="tab == 'vote'" class="tab-content">
          <h5 class="title is-5">投票</h5>

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
            <div style="margin: 30px 10px">
              下記の内容を（Googleフォームやオンライン掲示板を用いて）匿名で送信してください。
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
        <div class="tab-content" id="tab-account" v-if="tab == 'account'">
          <section>
            <h5 class="title is-5">基本情報</h5>
            <!-- <div class="info-entry">歩数: {{ myself.stats.walking_steps }}</div> -->
            <div class="info-entry">
              表示名:
              <span v-if="editing.name">
                <input
                  class="name-field"
                  type="text"
                  ref="inputName"
                  @keydown.enter="saveName"
                />
                <span class="edit-btn" @click="saveName">OK</span>
                <span class="edit-btn" @click="editing.name = null"
                  >キャンセル</span
                >
              </span>
              <span v-else>
                <span class="name-field">{{ myself.name }} </span>
                <span class="edit-btn" @click="startEditingName">Edit</span>
              </span>
            </div>
            <div class="info-entry">ユーザーID: {{ myUserId }}</div>
            <div class="info-entry">
              Email: {{ user ? user.email : "(不明)" }}
            </div>
            <!-- <div class="info-entry">
        話しかけた人:
        <span v-for="pid in myself.stats.people_encountered" :key="pid">
          {{ people[pid].name }}
        </span>
      </div> -->
          </section>
          <section>
            <h5 class="title is-5">アバター</h5>

            <div
              v-for="n in avatars"
              :key="n"
              alt=""
              class="avatar"
              width="38"
              :class="{ current: n == myself.avatar.split(':')[0] }"
              @click="clickAvatar(n)"
              @mouseenter="onMouseOverAvatar(n, true)"
              @mouseleave="onMouseOverAvatar(n, false)"
              :style="{
                'background-image': bgImage(n),
              }"
            />
            <div style="clear: both"></div>
            <p>
              画像は<a href="https://pipoya.net/sozai/">ぴぽや倉庫</a>を使用
            </p>
          </section>
          <section>
            <h5 class="title is-5">名前の表示色</h5>
            <div
              v-for="color in name_colors"
              :key="color"
              class="name-color"
              :class="{ current: color == myself.avatar.split(':')[1] }"
              :style="{ background: color }"
              @click="clickNameColor(color)"
            ></div>
            <div style="clear: both"></div>
            <div>
              <input
                type="checkbox"
                name=""
                v-model="displayNameBold"
                id="check-name-bold"
              /><label for="check-name-bold">太字にする</label>
            </div>
          </section>
          <section>
            <h5 class="title is-5">ログのエクスポート</h5>
            <button class="button is-primary" @click="exportLog">
              エクスポート
            </button>
          </section>

          <section>
            <h5 class="title is-5">暗号化</h5>
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

              <div v-if="privateKeyString" style="height: 40px; margin: 10px">
                秘密鍵が設定されています
              </div>
              <div
                class="danger"
                v-if="!privateKeyString"
                style="height: 40px; margin: 10px"
              >
                <span style="margin-right: 10px">秘密鍵がありません</span>
              </div>
              <div style="margin-bottom: 10px">
                <button class="button is-primary" @click="setPrivateKey">
                  秘密鍵を読み込み
                </button>
                <button
                  style="margin-left: 10px"
                  :disabled="!privateKeyString"
                  class="button is-primary"
                  @click="showPrivKey = !showPrivKey"
                >
                  秘密鍵を{{ showPrivKey ? "隠す" : "表示" }}
                </button>
              </div>
              <pre id="mnemonic" v-if="showPrivKey">{{
                privateKeyMnemonic
              }}</pre>
              <pre id="mnemonic" class="hidden" v-else
                >{{ privateKeyMnemonic }}
</pre
              >
              <span class="danger" v-if="privateKeyString"
                >秘密鍵はこの端末のブラウザ内部のみに保管されています。<br />ブラウザを再インストールするなどして秘密鍵を無くすと暗号化したチャットの内容は全て読めなくなります。</span
              >秘密鍵を安全な（人から見られない，また，紛失しない）場所にコピーして保存してください。
            </div>
          </section>
          <section>
            <h5 class="title is-5">アカウントの削除</h5>
            <div>
              <button class="button is-danger" @click="deleteAccount">
                アカウントの削除
              </button>
            </div>
          </section>
        </div>
        <div v-if="tab == 'help'" class="tab-content">
          <h5 class="title is-5">簡単な使い方</h5>
          <p style="font-size: 14px; line-height: 1; margin: 0px">
            ※ マイページ（マップ画面よりアクセス可能）にも記載されています。
          </p>
          <ul>
            <li>
              移動：
              カーソルキー，hjklキー（それぞれ左，下，上，右），yubnキー（左上，右上，左下，右下）で移動。あるいは画面上の矢印ボタンで移動。
            </li>
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
  </div>
</template>
<script lang="ts">
import {
  defineComponent,
  reactive,
  watch,
  onMounted,
  computed,
  toRefs,
  nextTick,
  ref,
} from "vue"

import axiosDefault from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"

import {
  Person,
  PersonUpdate,
  Poster,
  PosterId,
  UserId,
  Room,
  Announcement,
  RoomUpdateSocketData,
  VisualStyle,
} from "@/@types/types"
import { keyBy, difference, range, chunk } from "@/common/util"
import io from "socket.io-client"
import * as encryption from "../encryption"
import * as BlindSignature from "blind-signatures"
import jsbn from "jsbn"
import { deleteUserInfoOnLogout, formatTime, getVisualStyle } from "../util"
import { decryptIfNeeded } from "../room/room_chat_service"
import MypagePoster from "./MypagePoster.vue"
import ManageRooms from "../admin/ManageRooms.vue"
import { RoomId } from "@/api/@types"

const BigInteger = jsbn.BigInteger

const API_ROOT = "/api"

const RELOAD_DELAY_MEAN = 2000

const url = new URL(location.href)
const hash_path = url.hash.slice(1).split("/")
const tab = hash_path[0] || "account"
const tab_sub = hash_path[1]
const tab_sub_sub = hash_path[2]

const page_from: string | undefined = url.searchParams.get("room") || undefined

const debug_as: UserId | null = url.searchParams.get("debug_as") || null
const debug_token: string | undefined =
  url.searchParams.get("debug_token") || undefined

// console.log({ debug_as, debug_token })
const hash = url.hash.slice(1) || "account"
location.hash = "#" + hash

let socket: SocketIOClient.Socket | null = null

const bgPositions: string[] = ["down", "left", "up", "right"]

function download(filename, text) {
  const element = document.createElement("a")
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  )
  element.setAttribute("download", filename)

  element.style.display = "none"
  document.body.appendChild(element)

  element.click()

  document.body.removeChild(element)
}

export default defineComponent({
  components: {
    MypagePoster,
    ManageRooms,
  },
  setup: () => {
    const axios = axiosDefault.create({ baseURL: API_ROOT })
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

    const name = localStorage["virtual-poster:name"]
    const user_id = localStorage["virtual-poster:user_id"]
    const email = localStorage["virtual-poster:email"]
    const myUserId = debug_as || user_id
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
      axios,
      socket: undefined as SocketIOClient.Socket | undefined,
      tab: tab as string,
      tab_sub: undefined as string | undefined,
      tab_sub_sub: tab_sub_sub as string | undefined,
      user: { name, user_id, email } as {
        name: string
        email: string
        user_id: string
      } | null,
      myUserId: myUserId,
      debug_as,
      debug_token,
      jwt_hash: localStorage["virtual-poster:jwt_hash"] as string | undefined,

      rooms: {} as { [index: string]: Room },
      people: {} as { [index: string]: Person },
      posters: {} as { [index: string]: Poster },
      files: {} as { [index: string]: File },
      lastLoaded: -1,

      access_log: {} as { [index: string]: boolean },
      online_only: {} as { [index: string]: boolean },
      view_history: {} as {
        [index: string]: { user_id: UserId; joined_time: number }[]
      },

      editing: { name: null } as { name: string | null },

      lastUpdated: null as number | null,
      tabs: [
        { id: "account", name: "アカウント" },
        { id: "style", name: "表示設定" },
        { id: "rooms", name: "会場" },
        { id: "poster", name: "ポスター" },
        { id: "vote", name: "投票" },
        { id: "help", name: "使い方" },
      ],

      bgPosition: bgPositions[0],
      mouseOnAvatar: {} as { [index: string]: boolean },
      count: 0,

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
      allowedMaps: [] as Room[],
      ownedMaps: [] as Room[],
      displayNameBold: false,
      reloadWaiting: false,
      mapVisualStyle: getVisualStyle(
        localStorage["virtual-poster:" + myUserId + ":config:map_visual_style"]
      ) as VisualStyle,
      darkMode:
        localStorage["virtual-poster:" + myUserId + ":config:dark_mode"] == "1",
      darkModeUnset:
        localStorage["virtual-poster:" + myUserId + ":config:dark_mode"] ==
        null,
      enableMiniMap:
        localStorage["virtual-poster:" + myUserId + ":config:show_minimap"] !=
        "0",
      showEmptySessions:
        localStorage[
          "virtual-poster:" + myUserId + ":config:show_empty_sessions"
        ] != "0",
    })

    const name_colors = [
      "black",
      "red",
      "blue",
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf",
    ]

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

    const reload = async () => {
      state.lastUpdated = Date.now()
      const [
        data_p,
        data_poster,
        { public_key: pub_str_from_server },
        data_r,
      ] = await Promise.all([
        client.people.$get(),
        client.people._userId(state.myUserId).posters.$get(),
        client.public_key.$get(),
        client.maps.$get(),
      ])
      state.people = keyBy(data_p, "id") as { [user_id: string]: Person }
      state.posters = keyBy(data_poster.posters || [], "id")
      state.rooms = keyBy(data_r, "id")
      const jwt_hash: string | undefined =
        localStorage["virtual-poster:jwt_hash"]
      for (const room of data_r) {
        if (room.owner == state.myUserId)
          state.socket?.emit("Active", {
            user: state.myUserId,
            room: room.id,
            token: jwt_hash,
            observe_only: true,
          })
      }

      state.ownedMaps = data_r.filter(r => r.owner == state.myUserId)
      state.privateKey =
        localStorage["virtual-poster:" + state.myUserId + ":private_key_jwk"] ||
        localStorage["virtual-poster:private_key:" + state.myUserId]
      await setupEncryption(pub_str_from_server || null)
      for (const p of data_poster.posters || []) {
        const h = await client.maps
          ._roomId(p.room)
          .posters._posterId(p.id)
          .history.$get()
        state.view_history[p.id] = h
      }
    }

    const postersSorted = computed(() => {
      return Object.values(state.posters).sort((a, b) => {
        return (
          (a.room > b.room ? 10 : a.room == b.room ? 0 : -10) +
          (a.poster_number > b.poster_number
            ? 1
            : a.poster_number == b.poster_number
            ? 0
            : -1)
        )
      })
    })

    const updateLastLoaded = (t: number) => {
      state.lastLoaded = t
    }

    const clickAvatar = async (n: string) => {
      const ts = state.people[state.myUserId].avatar?.split(":") || []
      const icon = n
      const color = ts[1] || "black"
      const bold = ts[2] || ""
      const new_avatar = `${icon}:${color}:${bold}`
      const data = await client.people
        ._userId(state.myUserId)
        .$patch({ body: { avatar: new_avatar } })
      if (data.ok) {
        //Vue.set
        state.people[state.myUserId].avatar = new_avatar
      }
    }

    const clickNameColor = async (c: string) => {
      const ts = state.people[state.myUserId].avatar?.split(":") || []
      const icon = ts[0]
      const color = c
      const bold = ts[2] || ""
      if (
        icon.indexOf(":") != -1 ||
        color.indexOf(":") != -1 ||
        bold.indexOf(":") != -1
      ) {
        console.error("Invalid character in avatar")
        return
      }
      const new_avatar = `${icon}:${color}:${bold}`
      const data = await client.people
        ._userId(state.myUserId)
        .$patch({ body: { avatar: new_avatar } })
      if (data.ok) {
        //Vue.set
        state.people[state.myUserId].avatar = new_avatar
      }
    }

    watch(
      () => state.displayNameBold,
      async (b: boolean) => {
        const avatar = state.people[state.myUserId]?.avatar
        if (avatar) {
          const ts = avatar.split(":")
          const avatar_icon = ts[0]
          const avatar_name_color = ts[1] || "black"
          const avatar_name_bold = b
          const new_avatar = `${avatar_icon}:${avatar_name_color}:${
            avatar_name_bold ? "bold" : ""
          }`
          const data = await client.people
            ._userId(state.myUserId)
            .$patch({ body: { avatar: new_avatar } })
          if (data.ok) {
            //Vue.set
            state.people[state.myUserId].avatar = new_avatar
          }
        }
      }
    )

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
      //Vue.set
      state.people[d.id] = person
    }
    const inputName = ref<HTMLInputElement>()

    const startEditingName = async () => {
      state.editing.name = myself.value?.name || null
      await nextTick(() => {
        inputName.value!.value = myself.value?.name || ""
      })
    }

    const saveName = async (ev: KeyboardEvent & MouseEvent) => {
      if (ev.keyCode && ev.keyCode !== 13) return
      const new_name = inputName.value?.value
      if (!new_name) {
        alert("表示名を入力してください。")
        state.editing.name = null
        return
      }
      console.log(state.myUserId, new_name)
      if (new_name.length > 10) {
        alert("表示名は10文字以内にしてください。")
        state.editing.name = null
        return
      }
      const data = await client.people
        ._userId(state.myUserId)
        .$patch({ body: { name: new_name } })
      console.log(data)
      //Vue.set
      state.people[state.myUserId].name = new_name
      state.editing.name = null
    }

    const signOut = async () => {
      const client = api(axiosClient(axios))
      const r = await client.logout.$post()
      if (r.ok) {
        console.log("Signed out")
        deleteUserInfoOnLogout()
        location.href = "/login"
      } else {
        console.log("Did not sign out")
      }
    }

    watch(
      () => state.tab_sub,
      (v: string | undefined) => {
        console.log("tab_sub changed", v)
      }
    )

    watch(
      () => state.enableMiniMap,
      newValue => {
        localStorage[
          "virtual-poster:" + state.myUserId + ":config:show_minimap"
        ] = newValue ? "1" : "0"
      }
    )

    watch(
      () => state.showEmptySessions,
      newValue => {
        localStorage[
          "virtual-poster:" + state.myUserId + ":config:show_empty_sessions"
        ] = newValue ? "1" : "0"
      }
    )

    onMounted(async () => {
      state.tab_sub = tab_sub

      window.onhashchange = () => {
        console.log("onhashchange()")
        const hash = location.hash.slice(1)
        state.tab = hash.split("/")[0]
        state.tab_sub = hash.split("/")[1]
        state.tab_sub_sub = hash.split("/")[2]
      }
      const data = await client.socket_url.$get()
      const url = data.socket_url as string
      socket = io(url, { transports: ["websocket"] })
      state.socket = socket
      if (!socket) {
        console.error("Socket connection failed.")
        return
      }
      socket.on("connect", () => {
        socket?.emit("Active", {
          room: "::mypage",
          user: state.myUserId,
          token: state.jwt_hash,
          observe_only: true,
        })
        console.log("Connected")
      })

      socket.on("Room", async (d: RoomUpdateSocketData) => {
        const room = state.rooms[d.id]
        if (!room) {
          return
        }
        if (d.allow_poster_assignment != undefined) {
          room.allow_poster_assignment = d.allow_poster_assignment
        }
        if (d.poster_count != undefined) {
          room.poster_count = d.poster_count
        }
        if (d.num_people_joined != undefined) {
          room.num_people_joined = d.num_people_joined
        }
        if (d.num_people_active != undefined) {
          room.num_people_active = d.num_people_active
        }
      })

      socket.on("Poster", (p: Poster) => {
        //Vue.set
        state.posters[p.id] = p
      })
      socket.on("PosterRemove", (pid: PosterId) => {
        //Vue.delete
        delete state.posters[pid]
      })
      socket.on("Poster", (p: Poster) => {
        //Vue.set
        state.posters[p.id] = p
      })
      socket.on("AppReload", (force: boolean) => {
        if (state.reloadWaiting) {
          return
        }
        state.reloadWaiting = true
        window.setTimeout(() => {
          if (
            force ||
            confirm(
              "アプリケーションが更新されました。リロードしても良いですか？"
            )
          ) {
            state.reloadWaiting = false

            location.reload()
          } else {
            state.reloadWaiting = false
          }
        }, Math.random() * RELOAD_DELAY_MEAN * 2)
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
      const { data: data2 } = await axiosDefault.get("/img/avatars_base64.json")
      console.log(data2)
      state.avatarImages = data2

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
        await reload()
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

        await reload()
      }

      window.setInterval(() => {
        if (state.tab == "avatar") {
          state.count += 1
          if (state.count >= bgPositions.length) {
            state.count = 0
          }
          state.bgPosition = bgPositions[state.count]
        }
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
      () => state.tab,
      (newTab: string) => {
        console.log(newTab)
        location.hash = "#" + newTab
      }
    )
    const setPoster = (pid: PosterId, poster: Poster) => {
      state.posters[pid] = poster
    }
    const deletePoster = (pid: PosterId) => {
      delete state.posters[pid]
    }
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
        //Vue.set
        state.vote.message_sent =
          localStorage[
            "virtual-poster:" + state.myUserId + ":vote:message_sent"
          ] || ""
        //Vue.set
        state.vote.unblinded =
          localStorage[
            "virtual-poster:" + state.myUserId + ":vote:unblinded"
          ] || ""
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
        //Vue.set
        state.vote.unblinded = unblinded
        //Vue.set
        state.vote.message_sent = state.vote.message
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
        "アカウントを削除します。すべての書き込み，ポスター，作成した部屋などが削除されます。一旦削除すると取り消せません。本当にいいですか？"
      )
      if (!r) {
        return
      }
      const { data } = await axios.delete("/people/" + state.myUserId)
      console.log("delete account result", data)
      if (data.ok) {
        localStorage.removeItem("virtual-poster:user_id")
        localStorage.removeItem("virtual-poster:email")
        localStorage.removeItem("virtual-poster:name")
        localStorage.removeItem("virtual-poster:admin")

        const arr = [] as string[]
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
        for (let i = 0; i < arr.length; i++) {
          localStorage.removeItem(arr[i])
        }
        location.href = "/login"
      }
    }

    const AccessCodeInput = ref<HTMLInputElement>()

    const submitAccessCode = async () => {
      const access_code = AccessCodeInput.value?.value
      if (!access_code) {
        console.warn("Cannot find access code")
        return
      }
      const r = await client.people
        ._userId(state.myUserId)
        .access_code.$post({ body: { access_code } })
      console.log(r)
      if (!r.ok) {
        const idx = r.error?.indexOf("Access code is invalid")
        if (idx && idx >= 0) {
          alert("アクセスコードが正しくありません。")
        }
      }
      if (!r.added || r.added.length == 0) {
        alert("何も追加されませんでした")
      } else {
        alert("追加されました")
        if (AccessCodeInput.value) {
          AccessCodeInput.value.value = ""
        }
      }
    }

    const deleteRoom = async room_id => {
      delete state.rooms[room_id]
    }

    const exportLog = async () => {
      const myUserId = state.myUserId
      if (myUserId) {
        const comments_all = await client.people
          ._userId(state.myUserId)
          .comments.$get()

        const comments: any[] = []
        // Start file download.
        for (const c of comments_all) {
          const r = await decryptIfNeeded(
            myUserId,
            state.people,
            c,
            state.privateKey
          )
          if (r.text) {
            comments.push({
              id: c.id,
              room: c.room,
              text_decrypted: r.text,
              timestamp: c.timestamp,
              x: c.x,
              y: c.y,
              last_updated: c.last_updated,
              recipients: c.texts.map(t => t.to),
              // texts: c.texts,
              person: c.person,
              kind: c.kind,
            })
          }
        }
        download("export_log.json", JSON.stringify(comments))
      }
    }

    const reloadRooms = async () => {
      state.rooms = keyBy(await client.maps.$get(), "id")
    }

    const changeRoom = (room_id: RoomId | null) => {
      if (!room_id) {
        location.href = "#rooms"
        state.tab_sub = undefined
      } else {
        location.href = "#rooms/" + room_id
        state.tab_sub = room_id
      }
    }

    const renewAccessCode = async (room_id: RoomId) => {
      if (
        state.rooms[room_id].access_code &&
        !confirm(
          "アクセスコードを更新しますか？ 古いコードは使えなくなります。"
        )
      ) {
        return
      }
      const r = await client.maps._roomId(room_id).access_code.renew.$post()
      if (r.code && r.active != undefined) {
        state.rooms[room_id].access_code = { code: r.code, active: r.active }
      }
    }

    const deleteAccessCode = async (room_id: RoomId) => {
      if (
        !confirm(
          "アクセスコードを削除しますか？ 削除するとコードは使えなくなります。"
        )
      ) {
        return
      }
      const r = await client.maps._roomId(room_id).access_code.$delete()
      if (r.ok) {
        state.rooms[room_id].access_code = undefined
        alert("アクセスコードを削除しました")
      } else {
        console.error(r.error)
        alert("アクセスコードの削除に失敗しました")
      }
    }

    const doSubmitAnnouncement = (d: Announcement) => {
      state.socket?.emit("make_announcement", d)
    }

    const askReload = (d: { room_id: RoomId; force: boolean }) => {
      state.socket?.emit("AskReload", d)
    }

    const setDarkMode = (is_dark?: boolean) => {
      if (is_dark == undefined) {
        localStorage.removeItem(
          "virtual-poster:" + state.myUserId + ":config:dark_mode"
        )
        state.darkMode =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        state.darkModeUnset = true
      } else {
        localStorage[
          "virtual-poster:" + state.myUserId + ":config:dark_mode"
        ] = is_dark ? "1" : "0"
        state.darkMode = is_dark
        state.darkModeUnset = false
      }
    }

    const setStyle = (n: VisualStyle) => {
      localStorage[
        "virtual-poster:" + state.myUserId + ":config:map_visual_style"
      ] = n
      state.mapVisualStyle = n
    }

    return {
      ...toRefs(state),
      name_colors,
      formatTime,
      postersSorted,
      onMouseOverAvatar,
      validateVote,
      setupEncryption,
      deleteAccount,
      setPrivateKey,
      blindSign,
      bgImage,
      signOut,
      reload,
      clickAvatar,
      clickNameColor,
      inputName,
      startEditingName,
      saveName,
      setPoster,
      deletePoster,
      updateLastLoaded,
      goback_path,
      avatars: difference(range(1, 31), [20]).map(n => {
        return n.toString().padStart(3, "0")
      }),
      page_from,
      myself,
      submitAccessCode,
      exportLog,
      AccessCodeInput,
      reloadRooms,
      deleteRoom,
      changeRoom,
      doSubmitAnnouncement,
      askReload,
      renewAccessCode,
      deleteAccessCode,
      setDarkMode,
      setStyle,
    }
  },
})
</script>
<style lang="css" scoped>
/* @import "../../node_modules/bulma/css/bulma.css"; */

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

h4 {
  margin: 0px;
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

.name-color {
  float: left;
  width: 40px;
  height: 40px;
  padding: 0px;
  margin: 5px;
  cursor: pointer;
  border-radius: 5px;
}

div.name-color.current {
  border: black 4px solid;
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
  /* width: 300px; */
  margin: 5px;
  box-sizing: border-box;
  display: inline-block;
}

input {
  height: 24px;
}

.keys {
  margin-top: 10px;
  max-width: 800px;
  word-break: break-all;
  font-family: Courier, monospace;
}

div.poster-entry {
  border: black 1px solid;
  border-radius: 3px;
  width: calc(100% - 100px);
  height: 430px;
  margin: 10px;
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

#mnemonic {
  font-family: "Courier New", Courier, monospace;
  font-size: 21px;
  word-break: normal;
  border: 1px solid black;
  padding: 10px;
  height: 120px;
  max-width: 700px;
  line-height: 1.2em;
}

#mnemonic.hidden {
  color: transparent;
  /* background: #ccc; */
  text-shadow: 0 0 16px rgba(0, 0, 0, 0.9);
}

.tab-content {
  margin: 10px;
}

.tab-content > section {
  border: 1px solid #ccc;
  border-radius: 3px;
  margin: 10px 0px;
  padding: 10px;
}

.room-entry {
  margin: 10px;
  padding: 10px;
  border: 1px solid #ccc;
}

.room-entry button {
  float: right;
}

.is-6 {
  margin-top: 10px;
  margin-bottom: 0px;
}
</style>
