<template>
  <div id="app" v-if="myself" class="columns" :class="{ dark: darkMode }">
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
          >
            <a :href="'#' + this_tab.id">{{ this_tab.name }}</a>
          </li>
        </ul>
      </div>
      <div id="tabs">
        <ManageRooms
          v-if="tab == 'rooms'"
          :locale="locale"
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
          @create-access-code="createAccessCode"
          @renew-access-code="renewAccessCode"
          @delete-access-code="deleteAccessCode"
          @reload-room-metadata="reloadRoomMetadata"
        />
        <div class="tab-content" id="tab-display" v-if="tab == 'display'">
          <section>
            <div style="font-size: 80%; margin: 10px 0px">
              {{ lang("display_1") }}
            </div>
            <h5 class="title is-5">{{ lang("display_settings") }}</h5>
            <h6 class="title is-6">{{ lang("common") }}</h6>
            <div>
              <div class="buttons has-addons">
                <span style="margin-right: 10px; vertical-align: 20px">{{
                  lang("language")
                }}</span>
                <button
                  class="button"
                  :class="{ 'is-primary': locale == 'en' }"
                  @click="changeLocale('en')"
                >
                  English
                </button>
                <button
                  class="button"
                  :class="{ 'is-primary': locale == 'ja' }"
                  @click="changeLocale('ja')"
                >
                  日本語
                </button>
              </div>
              <div class="buttons has-addons">
                <span style="margin-right: 10px; vertical-align: 20px">{{
                  lang("dark_mode")
                }}</span>
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
                  {{ lang("adjust_os") }}
                </button>
              </div>
            </div>
            <h6 class="title is-6">{{ lang("map") }}</h6>
            <div class="buttons has-addons">
              <span style="margin-right: 10px">{{ lang("map_style") }}</span>
              <button
                class="button"
                :class="{ 'is-primary': mapVisualStyle == n[0] }"
                v-for="n in [
                  ['default', lang('default')],
                  ['abstract', lang('abstract')],
                  ['monochrome', lang('monochrome')],
                  ['abstract_monochrome', lang('abs_monochro')],
                ]"
                :key="n[0]"
                @click="setStyle(n[0])"
              >
                {{ n[1] }}
              </button>
            </div>
            <div class="buttons has-addons">
              <span style="margin-right: 10px">{{ lang("show_size") }}</span>
              <button
                class="button"
                :class="{ 'is-primary': mapCellSize == n[0] }"
                v-for="n in [
                  [48, '大'],
                  [40, '中'],
                  [30, '小'],
                ]"
                :key="n[1]"
                @click="setMapCellSize(n[0])"
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
              <label for="config-show-minimap">{{
                lang("show_minimap")
              }}</label>
            </div>
            <h6 class="title is-6">{{ lang("chat") }}</h6>
            <div>
              <input
                type="checkbox"
                name=""
                id="config-show-empty-sessions"
                v-model="showEmptySessions"
              />
              <label for="config-show-empty-sessions">{{
                lang("show_all_sessions")
              }}</label>
            </div>
          </section>
        </div>
        <div
          class="tab-content"
          id="tab-notification"
          v-if="tab == 'notification'"
        >
          <section>
            <h5 class="title is-5">{{ lang("notification_settings") }}</h5>
            <section v-for="room in rooms" :key="room.id">
              <h5 class="title is-6">{{ lang("room") }}: {{ room.name }}</h5>
              <div class="buttons has-addons">
                <span style="margin-right: 10px; vertical-align: 20px">{{
                  lang("unread_notification")
                }}</span>
                <!-- <button
                  class="button"
                  :class="{ 'is-primary': notification.interval[room.id] == 5 }"
                  @click="changeNotificationInterval(room.id, 5)"
                >
                  5分
                </button>
                <button
                  class="button"
                  :class="{
                    'is-primary': notification.interval[room.id] == 10,
                  }"
                  @click="changeNotificationInterval(room.id, 10)"
                >
                  10分
                </button>
                <button
                  class="button"
                  :class="{
                    'is-primary': notification.interval[room.id] == 30,
                  }"
                  @click="changeNotificationInterval(room.id, 30)"
                >
                  30分
                </button> -->
                <button
                  class="button"
                  :class="{
                    'is-primary': notification.interval[room.id] == 60,
                  }"
                  @click="changeNotificationInterval(room.id, 60)"
                >
                  1時間
                </button>
                <button
                  class="button"
                  :class="{
                    'is-primary': notification.interval[room.id] == 360,
                  }"
                  @click="changeNotificationInterval(room.id, 360)"
                >
                  6時間
                </button>
                <button
                  class="button"
                  :class="{
                    'is-primary': notification.interval[room.id] == 1440,
                  }"
                  @click="changeNotificationInterval(room.id, 1440)"
                >
                  24時間
                </button>
                <button
                  class="button"
                  :class="{
                    'is-primary': notification.interval[room.id] == -1,
                  }"
                  @click="changeNotificationInterval(room.id, -1)"
                >
                  通知しない
                </button>
              </div>
              <div>{{ explainNotificationInterval }}</div>
            </section>
          </section>
        </div>
        <div
          class="tab-content"
          id="tab-map"
          v-if="tab == 'rooms' && tab_sub == undefined"
        >
          <section style="display: none">
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
                会場に参加すると，会場の管理者にメールアドレスが開示されます。
              </li>
            </ul>
          </section>
        </div>
        <MypagePoster
          v-if="tab == 'poster' && myself"
          :locale="locale"
          :posters="postersSorted"
          :myself="myself"
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
            <h5 class="title is-5">{{ lang("basic_profile") }}</h5>
            <div class="info-entry">
              <span class="key">{{ lang("user_id") }}</span> {{ myUserId }}
            </div>
            <div class="info-entry">
              <span class="key">Email</span> {{ user ? user.email : "(不明)" }}
            </div>
            <div class="info-entry">
              <span class="key">{{ lang("name_short") }}</span>
              <span v-if="editing.name">
                <input
                  class="name-field"
                  type="text"
                  ref="inputName"
                  @keydown.enter="saveName"
                /><br />
                <button class="edit-btn" @click="saveName">OK</button>
                <button class="edit-btn" @click="editing.name = button">
                  {{ lang("cancel") }}
                </button>
              </span>
              <span v-else>
                <span class="name-field">{{ myself.name }} </span>
                <button class="edit-btn" @click="startEditingName">
                  {{ lang("edit") }}
                </button>
              </span>
            </div>
            <div
              class="info-entry"
              v-for="[profile, key] in myProfilesOrdered"
              :key="key"
            >
              <span class="key" v-if="!hasDescription(key)">{{
                showProfileKind(key, profile, locale)
              }}</span>
              <span v-if="editingProfile[key] && hasDescription(key)">
                <div class="profile-row">
                  <label
                    class="profile-title"
                    :for="'profile-' + key + '-input'"
                    >{{ showProfileKind(key, profile, locale) }}</label
                  >
                  <input class="input-profile" ref="inputProfile" /><br />
                </div>
                <div class="profile-row">
                  <label
                    class="profile-title"
                    :for="'profile-' + key + '-description-input'"
                  >
                    {{ lang("description") }}
                  </label>
                  <input
                    type="text"
                    class="input-profile"
                    ref="inputProfileDescription"
                    :id="'profile-' + key + '-description-input'"
                  />
                </div>
                <div class="profile-row">
                  <button class="edit-btn" @click="saveProfile(key, $event)">
                    OK
                  </button>
                  <button class="edit-btn" @click="delete editingProfile[key]">
                    {{ lang("cancel") }}
                  </button>
                </div>
              </span>
              <span v-else-if="editingProfile[key]">
                <div class="profile-row">
                  <input class="input-profile" ref="inputProfile" />
                </div>
                <div class="profile-row">
                  <button class="edit-btn" @click="saveProfile(key, $event)">
                    OK
                  </button>
                  <button class="edit-btn" @click="delete editingProfile[key]">
                    {{ lang("cancel") }}
                  </button>
                </div>
              </span>
              <span v-else-if="hasDescription(key)">
                <div class="profile-row">
                  <span class="profile-title">{{
                    showProfileKind(key, profile, locale)
                  }}</span>
                  <span class="profile-value">{{ profile.content }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-title">{{ lang("description") }} </span>
                  <span class="profile-value">
                    {{ profile.metadata?.description }}
                  </span>
                </div>
                <div class="profile-row">
                  <button class="edit-btn" @click="startEditingProfile(key)">
                    {{ lang("edit") }}
                  </button>
                </div>
              </span>

              <span v-else class="show-profile">
                <div class="profile-row">
                  <span>{{ profile.content }}</span>
                  <button class="edit-btn" @click="startEditingProfile(key)">
                    {{ lang("edit") }}
                  </button>
                </div>
              </span>
            </div>

            <!-- <div class="info-entry">
        話しかけた人:
        <span v-for="pid in myself.stats.people_encountered" :key="pid">
          {{ people[pid].name }}
        </span>
      </div> -->
          </section>
          <section>
            <h5 class="title is-5">{{ lang("avatar") }}</h5>

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
            <h5 class="title is-5">{{ lang("name_color") }}</h5>
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
              /><label for="check-name-bold">{{ lang("make_bold") }}</label>
            </div>
          </section>
          <section>
            <h5 class="title is-5">{{ lang("export_log") }}</h5>
            <button class="button is-primary" @click="exportLogHtml">
              {{ lang("export_html") }}
            </button>
            <button
              class="button is-primary"
              @click="exportLog"
              style="margin-left: 10px"
            >
              {{ lang("export_json") }}
            </button>
          </section>

          <section>
            <h5 class="title is-5">{{ lang("encryption") }}</h5>
            <div>
              {{ lang("encryption_desc1") }}
              {{ locale == "ja" ? `` : `` }}
              <a
                :href="
                  locale == 'ja'
                    ? 'https://ja.wikipedia.org/wiki/%E6%A5%95%E5%86%86%E6%9B%B2%E7%B7%9A%E3%83%87%E3%82%A3%E3%83%95%E3%82%A3%E3%83%BC%E3%83%BB%E3%83%98%E3%83%AB%E3%83%9E%E3%83%B3%E9%8D%B5%E5%85%B1%E6%9C%89'
                    : 'https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman'
                "
                >{{ lang("ecdh") }}</a
              >
              {{ lang("and") }} {{ lang("128bit") }}
              <a
                href="https://ja.wikipedia.org/wiki/Advanced_Encryption_Standard"
                >AES-GCM</a
              >
              {{ locale == "ja" ? "を使用。" : "are used." }}<br />
            </div>
            <div>
              <h3>{{ lang("public_key") }}</h3>

              <div class="keys">{{ publicKeyString }}</div>
              <h3>{{ lang("private_key") }}</h3>

              <div>
                <input
                  type="checkbox"
                  name=""
                  v-model="enableEncryption"
                  id="check-enable-encrypt"
                  :disabled="!privateKeyString"
                /><label for="check-enable-encrypt">{{
                  lang("use_e2ee")
                }}</label>
              </div>

              <div v-if="privateKeyString" style="height: 40px; margin: 10px">
                秘密鍵が設定されています
              </div>
              <div
                class="danger"
                v-if="!privateKeyString"
                style="height: 40px; margin: 10px"
              >
                <span style="margin-right: 10px">{{ lang("no_pk") }}</span>
              </div>
              <div style="margin-bottom: 10px">
                <button class="button is-primary" @click="setPrivateKey">
                  {{ lang("load_pk") }}
                </button>
                <button
                  style="margin-left: 10px"
                  :disabled="!privateKeyString"
                  class="button is-primary"
                  @click="showPrivKey = !showPrivKey"
                >
                  {{
                    locale == "ja"
                      ? `秘密鍵を${showPrivKey ? "隠す" : "表示"}`
                      : `${showPrivKey ? "Hide" : "Show"} private key`
                  }}
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
                >{{ lang("priv_1") }}<br />
                {{ lang("priv_2") }}</span
              ><br />
              {{ lang("priv_3") }}
            </div>
          </section>
          <section>
            <h5 class="title is-5">{{ lang("delete_account") }}</h5>
            <div>
              <button class="button is-danger" @click="deleteAccount">
                {{ lang("delete_account") }}
              </button>
            </div>
          </section>
        </div>
        <div v-if="tab == 'help'" class="tab-content">
          <h5 class="title is-5">{{ lang("instruction") }}</h5>
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
  Poster,
  PosterId,
  UserId,
  Room,
  Announcement,
  RoomUpdateSocketData,
  VisualStyle,
  PersonUpdate,
  MyPageState,
} from "@/@types/types"
import {
  keyBy,
  difference,
  range,
  chunk,
  showProfileKind,
  decodeMoved,
} from "@/common/util"
import io from "socket.io-client"
import * as encryption from "../encryption"
import * as BlindSignature from "blind-signatures"
import jsbn from "jsbn"
import { deleteUserInfoOnLogout, formatTime, getVisualStyle } from "../util"
import { decryptIfNeeded } from "../room/room_chat_service"
import { exportLog, exportLogHtml } from "./mypage_service"
import MypagePoster from "./MypagePoster.vue"
import ManageRooms from "../admin/ManageRooms.vue"
import { RoomId } from "@/api/@types"

import {
  createAccessCode,
  deleteAccessCode,
  reloadRoomMetadata,
  renewAccessCode,
} from "../admin/admin_room_service"

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

export default defineComponent({
  components: {
    MypagePoster,
    ManageRooms,
  },
  props: {
    isMobile: {
      type: Boolean,
    },
    moveToPane: {
      type: Function,
    },
  },
  setup: props => {
    const axios = axiosDefault.create({ baseURL: API_ROOT })
    const client = api(axiosClient(axios))

    const name = localStorage["virtual-poster:name"]
    const user_id = localStorage["virtual-poster:user_id"]
    const email = localStorage["virtual-poster:email"]
    const myUserId: string = debug_as || user_id
    if (!(name && myUserId && email)) {
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
    const state = reactive<MyPageState>({
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
      myself: null as Person | null,
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

      editingProfile: {} as { [key: string]: boolean },

      lastUpdated: null as number | null,

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
      locale: (localStorage[`virtual-poster:${myUserId}:config:locale`] ||
        "ja") as "ja" | "en",
      mapCellSize: 48,
      notification: {
        interval: {} as { [room_id: string]: number },
      },
    })

    const tabs = computed(() => {
      return state.locale == "ja"
        ? [
            { id: "account", name: "アカウント" },
            { id: "display", name: "表示" },
            // { id: "notification", name: "通知" },
            { id: "rooms", name: "会場" },
            { id: "poster", name: "ポスター" },
            // { id: "vote", name: "投票" },
            { id: "help", name: "使い方" },
          ]
        : [
            { id: "account", name: "Account" },
            { id: "display", name: "Display" },
            // { id: "notification", name: "Notification" },
            { id: "rooms", name: "Rooms" },
            { id: "poster", name: "Posters" },
            // { id: "vote", name: "Vote" },
            { id: "help", name: "Help" },
          ]
    })

    const changeLocale = (l: "en" | "ja") => {
      state.locale = l
      if (state.user) {
        localStorage[`virtual-poster:${state.user.user_id}:config:locale`] = l
      }
    }

    const setMapCellSize = (n: number) => {
      if (state.user) {
        state.mapCellSize = n
        localStorage[
          `virtual-poster:${state.user.user_id}:config:map_cell_size`
        ] = "" + n
      }
    }

    document.title = state.locale == "ja" ? "マイページ" : "Preferences"

    watch(
      () => state.locale,
      () => {
        document.title = state.locale == "ja" ? "マイページ" : "Preferences"
      }
    )

    const lang = (key: string): string => {
      const message: {
        [key in string]: { [key in "ja" | "en"]: string }
      } = {
        basic_profile: {
          ja: "基本情報・プロフィール",
          en: "Basic information",
        },
        edit: {
          ja: "編集",
          en: "Edit",
        },
        description: {
          ja: "説明",
          en: "Note",
        },
        avatar: {
          ja: "アバター",
          en: "Avatar",
        },
        chat: {
          ja: "チャット",
          en: "Chat",
        },
        name_short: {
          ja: "表示名（短縮）",
          en: "Display name",
        },
        user_id: {
          ja: "ユーザーID",
          en: "User ID",
        },
        name_color: {
          ja: "名前の表示色",
          en: "Name color",
        },
        make_bold: {
          ja: "太字にする",
          en: "Bold font",
        },
        export_log: {
          ja: "ログのエクスポート",
          en: "Export log",
        },
        export: {
          ja: "エクスポート",
          en: "Export",
        },
        export_json: {
          ja: "JSON形式でエクスポート",
          en: "Export as JSON",
        },
        export_html: {
          ja: "HTML形式でエクスポート",
          en: "Export as HTML",
        },
        encryption: {
          ja: "暗号化",
          en: "Encryption",
        },
        encryption_desc1: {
          ja: "チャットはエンドツーエンド暗号化が可能です。",
          en: "End-to-end encryption of chat is possible.",
        },
        ecdh: {
          ja: "楕円曲線ディフィー・ヘルマン鍵共有（ECDH）",
          en: "Elliptic-curve Diffie–Hellman",
        },
        and: {
          ja: "および",
          en: "and",
        },
        "128bit": {
          ja: "128ビット",
          en: "128-bit",
        },
        delete_account: {
          ja: "アカウントの削除",
          en: "Delete account",
        },
        delete_confirm: {
          ja:
            "アカウントを削除します。すべての書き込み，ポスター，作成した部屋などが削除されます。一旦削除すると取り消せません。本当にいいですか？",
          en:
            "Deleting your account will delete all of your posts, posters, and rooms you have created. Once you delete your account, it cannot be undone. Are you sure you want to proceed?",
        },
        delete_failed: {
          ja:
            "アカウントの削除ができませんでした。管理者に連絡して手動で削除を依頼してください。",
          en:
            "The account could not be deleted. Please contact your administrator and request a manual deletion.",
        },
        cancel: {
          ja: "キャンセル",
          en: "Cancel",
        },
        public_key: {
          ja: "公開鍵",
          en: "Public key",
        },
        private_key: {
          ja: "秘密鍵",
          en: "Private key",
        },
        use_e2ee: {
          ja: "エンドツーエンド暗号化を使用",
          en: "Use end-to-end encryption",
        },
        no_pk: {
          ja: "秘密鍵がありません",
          en: "Private key is missing",
        },
        load_pk: {
          ja: "秘密鍵を読み込み",
          en: "Load private key",
        },
        priv_1: {
          ja: "秘密鍵はこの端末のブラウザ内部のみに保管されています。",
          en:
            "The private key is stored only inside the browser of this device.",
        },
        priv_2: {
          ja:
            "If you lose your private key, for example by reinstalling your browser, all encrypted chat contents will be unreadable.",
          en: "",
        },
        priv_3: {
          ja:
            "秘密鍵を安全な（人から見られない，また，紛失しない）場所にコピーして保存してください。",
          en:
            "Keep a copy of your private key in a safe place (where it cannot be seen or lost).",
        },
        display_1: {
          ja: "下記の設定は端末に保存されます（端末ごとに設定が異なります）。",
          en:
            "The following settings will be saved in the device (settings will be different for each device).",
        },
        display_settings: {
          ja: "表示設定",
          en: "Display settings",
        },
        language: {
          ja: "表示言語",
          en: "Language",
        },
        dark_mode: {
          ja: "ダークモード",
          en: "Dark mode",
        },
        common: {
          ja: "全体",
          en: "General",
        },
        adjust_os: {
          ja: "OSの設定に合わせる",
          en: "Follow OS settings",
        },
        map: {
          ja: "マップ",
          en: "Map",
        },
        show_size: {
          ja: "表示サイズ",
          en: "Size",
        },
        map_style: {
          ja: "マップの表示",
          en: "Style",
        },
        default: {
          ja: "デフォルト",
          en: "Default",
        },
        abstract: {
          ja: "抽象",
          en: "Abstract",
        },
        monochrome: {
          ja: "モノクロ",
          en: "Grayscale",
        },
        abs_monochro: {
          ja: "抽象・モノクロ",
          en: "Grayscale, monochrome",
        },
        show_minimap: {
          ja: "ミニマップを表示する",
          en: "Show minimap",
        },
        show_all_sessions: {
          ja:
            "チャットウィンドウ中に会話が無かったセッション（開始〜解散）を表示する",
          en:
            "Show sessions where there was no conversation (start to end) in the chat window.",
        },
        enter_name: {
          ja: "表示名を入力してください。",
          en: "Enter name",
        },
        use_short_name: {
          ja: "表示名は10文字以内にしてください。",
          en: "Display name must be no more than 10 characters.",
        },
        bad_url: {
          ja: "URLが正しくありません",
          en: "Invalid URL",
        },
        enter_priv: {
          ja: "秘密鍵のパスフレーズを入力してください",
          en: "Enter the passphrase for a private key",
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
            "ポスター画像の掲示： 自分のポスター板にPNG（推奨）またはPDFをドラッグ＆ドロップするか，マイページ（人型のアイコン）からアップロード。",
          en:
            "Uploading poster image: Drag and drop the PNG (recommended) or PDF file onto your poster board, or upload it from Preferences (the human icon).",
        },
        help_remove_poster: {
          ja: "ポスターの撤去： マイページで「ポスター画像を削除」をクリック。",
          en: "Removing a poster: Click 'Delete Poster' in Preferences",
        },
        notification_settings: {
          ja: "通知設定",
          en: "Notification settings",
        },
        unread_notification: {
          ja: "未読のコメントの通知までの時間",
          en: "Notify unread comments after",
        },
        room: {
          ja: "会場",
          en: "Room",
        },
      }
      return message[key][state.locale]
    }

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

    if (state.myUserId) {
      client.people
        ._userId(state.myUserId)
        .$get()
        .then(d => {
          state.myself = d
        })
        .catch(() => {
          //
        })
    }

    watch<UserId | null>(
      () => state.myUserId,
      async () => {
        state.myself = state.myUserId
          ? await client.people._userId(state.myUserId).$get()
          : null
      }
    )

    const bgImage = (n: string) => {
      if (state.myself) {
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
      const is_myself_admin =
        state.myself?.role == "owner" || state.myself?.role == "admin"
      const [
        data_p,
        data_poster,
        { public_key: pub_str_from_server },
        data_r,
      ] = await Promise.all([
        client.people.$get({ query: { email: is_myself_admin } }),
        client.people._userId(state.myUserId).posters.$get(),
        client.public_key.$get(),
        client.maps.$get(),
      ])
      state.people = keyBy(data_p, "id") as { [user_id: string]: Person }
      state.posters = keyBy(data_poster.posters || [], "id")
      state.rooms = keyBy(data_r, "id")
      for (const room of data_r) {
        state.notification.interval[room.id] = 10
      }
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

    const inputName = ref<HTMLInputElement>()

    const startEditingName = async () => {
      state.editing.name = state.myself?.name || null
      await nextTick(() => {
        inputName.value!.value = state.myself?.name || ""
      })
    }

    const saveName = async (ev: KeyboardEvent & MouseEvent) => {
      if (ev.keyCode && ev.keyCode !== 13) return
      const new_name = inputName.value?.value
      if (!new_name) {
        alert(lang("enter_name"))
        state.editing.name = null
        return
      }
      console.log(state.myUserId, new_name)
      if (new_name.length > 10) {
        alert(lang("use_short_name"))
        state.editing.name = null
        return
      }
      const data = await client.people
        ._userId(state.myUserId)
        .$patch({ body: { name: new_name } })
      console.log(data)
      state.people[state.myUserId].name = new_name
      state.myself!.name = new_name
      state.editing.name = null
    }

    const inputProfile = ref<HTMLInputElement>()
    const inputProfileDescription = ref<HTMLInputElement>()

    const startEditingProfile = async (key: string) => {
      const me = state.myself
      if (!me) {
        return
      }
      for (const k of Object.keys(state.editingProfile)) {
        state.editingProfile[k] = false
      }
      state.editingProfile[key] = true
      await nextTick(() => {
        inputProfile.value!.value = me.profiles![key].content || ""
        if (inputProfileDescription.value) {
          inputProfileDescription.value!.value =
            me.profiles![key].metadata?.description || ""
        }
      })
    }

    const saveProfile = async (
      profile_key: string,
      ev: KeyboardEvent & MouseEvent
    ) => {
      if (ev.keyCode && ev.keyCode !== 13) {
        return
      }
      const new_value = inputProfile.value!.value.trim()
      const new_description = inputProfileDescription.value?.value
      // if (!new_value) {
      //   alert("文字を入力してください。")
      //   state.editing.name = null
      //   return
      // }
      if (["url", "url2", "url3"].indexOf(profile_key) >= 0) {
        if (
          new_value != "" &&
          new_value.indexOf("http://") != 0 &&
          new_value.indexOf("https://") != 0
        ) {
          alert(lang("bad_url"))
          return
        }
      }
      console.log(state.myUserId, new_value)
      const obj: { [key: string]: any } = {}
      obj[profile_key] = { content: new_value }
      if (new_description) {
        obj[profile_key].description = new_description
      }
      const data = await client.people
        ._userId(state.myUserId)
        .$patch({ body: obj })
      console.log(data)
      state.myself!.profiles![profile_key].content = new_value
      state.myself!.profiles![profile_key].metadata = {
        description: new_description,
      }
      delete state.editingProfile[profile_key]
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

      if (props.isMobile) {
        window.onhashchange = () => {
          console.log("onhashchange() mobile")
          const hash = location.hash.slice(1)
          if (hash != "mypage" && props.moveToPane) {
            props.moveToPane(hash)
          } else {
            state.tab = hash.split("/")[1]
            state.tab_sub = hash.split("/")[2]
            state.tab_sub_sub = hash.split("/")[3]
          }
        }
      } else {
        window.onhashchange = () => {
          console.log("onhashchange()")
          const hash = location.hash.slice(1)
          state.tab = hash.split("/")[0]
          state.tab_sub = hash.split("/")[1]
          state.tab_sub_sub = hash.split("/")[2]
        }
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

      socket.on("PersonUpdate", (ds: PersonUpdate[]) => {
        console.log("PersonUpdate", ds)
        for (const d of ds) {
          const p: Person = state.people[d.id]
          if (!p) {
            console.warn("User not found (probably new user)")
            continue
          }
          const person: Person = {
            id: d.id,
            name: d.name || p.name,
            last_updated: d.last_updated,
            avatar: d.avatar || p.avatar,
            profiles: d.profiles || p.profiles,
            public_key: d.public_key || p.public_key,
            email: p.email,
            connected: d.connected != undefined ? d.connected : p.connected,
          }
          state.people[d.id] = person
        }
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

      window.addEventListener("storage", ev => {
        if (
          ev.key ==
          "virtual-poster:" + state.myUserId + ":config:dark_mode"
        ) {
          console.log(ev.newValue, state.darkMode)
          state.darkModeUnset = ev.newValue == null
          state.darkMode =
            ev.newValue == "1"
              ? true
              : ev.newValue == "0"
              ? false
              : window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches
          console.log(state.darkMode)
        } else if (
          ev.key ==
          "virtual-poster:" + state.myUserId + ":config:map_visual_style"
        ) {
          state.mapVisualStyle = getVisualStyle(
            new URL(location.href).searchParams.get("style") ||
              ev.newValue ||
              ""
          )
        } else if (
          ev.key ==
          "virtual-poster:" + state.myUserId + ":config:show_minimap"
        ) {
          state.enableMiniMap = ev.newValue != "0"
        } else if (
          ev.key ==
          "virtual-poster:" + state.myUserId + ":config:encryption"
        ) {
          state.enableEncryption = ev.newValue == "1"
        } else if (
          ev.key ==
          "virtual-poster:" + state.myUserId + ":config:locale"
        ) {
          state.locale =
            ev.newValue == "ja" ? "ja" : ev.newValue == "en" ? "en" : "ja"
        } else if (
          ev.key ==
          "virtual-poster:" + state.myUserId + ":config:map_cell_size"
        ) {
          state.mapCellSize = ev.newValue ? parseInt(ev.newValue) : 48
        }
      })

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

    // watch(
    //   () => state.tab,
    //   (newTab: string) => {
    //     console.log(newTab)
    //     location.hash = "#" + newTab
    //   }
    // )
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
      const prv_str_to_import = prompt(lang("enter_priv"))
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

    const changeNotificationInterval = (
      room_id: RoomId,
      interval_minutes: number
    ) => {
      state.notification.interval[room_id] = interval_minutes
    }

    const explainNotificationInterval = computed(() => {
      const res: { [room_id: string]: string } = {}
      for (const room_id of Object.keys(state.rooms)) {
        const f = (t: number) => {
          return (
            (t >= 60 ? t / 60 : t) +
            (t >= 60
              ? state.locale == "ja"
                ? "時間"
                : "hours"
              : state.locale == "ja"
              ? "分間"
              : "minutes")
          )
        }
        if (state.notification.interval[room_id] < 0) {
          return state.locale == "ja"
            ? "新着コメントは通知されません。"
            : "Notification on new comments is never sent."
        }
        return state.locale == "ja"
          ? `新着コメントが${f(
              state.notification.interval[room_id]
            )}未読の場合はメールで通知が届きます。`
          : `Notification is sent if new comments are unread for ${f(
              state.notification.interval[room_id]
            )}.`
      }
    })

    const deleteAccount = async () => {
      const r = confirm(lang("delete_confirm"))
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
      } else {
        alert(lang("delete_failed"))
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

    const hasDescription = (key: string) => {
      return ["url", "url2", "url3"].indexOf(key) >= 0
    }

    const myProfilesOrdered = computed(() => {
      const me = state.myself
      if (!me) {
        return []
      } else {
        const keyIndex = (k: string): number => {
          if (k == "display_name_short") {
            return 10
          } else if (k == "display_name_full") {
            return 20
          } else if (k == "affiliation") {
            return 25
          } else if (k == "url") {
            return 31
          } else if (k == "url2") {
            return 32
          } else if (k == "url3") {
            return 33
          } else {
            return 100
          }
        }
        const ps = Object.entries(me.profiles || {}).map<
          [{ content: string; last_updated: number; metadata?: any }, string]
        >(([k, v]) => {
          return [v, k]
        })
        ps.sort((a, b) => {
          return keyIndex(a[1]) - keyIndex(b[1])
        })
        return ps
      }
    })

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
      startEditingProfile,
      inputProfile,
      inputProfileDescription,
      saveProfile,
      setPoster,
      deletePoster,
      updateLastLoaded,
      goback_path,
      avatars: difference(range(1, 31), [20]).map(n => {
        return n.toString().padStart(3, "0")
      }),
      page_from,
      submitAccessCode,
      exportLog: exportLog(axios, state),
      exportLogHtml: exportLogHtml(axios, state),
      AccessCodeInput,
      reloadRooms,
      deleteRoom,
      changeRoom,
      doSubmitAnnouncement,
      askReload,
      createAccessCode: createAccessCode(state),
      renewAccessCode: renewAccessCode(state),
      deleteAccessCode: deleteAccessCode(state),
      reloadRoomMetadata: reloadRoomMetadata(state),
      setDarkMode,
      setStyle,
      showProfileKind,
      hasDescription,
      myProfilesOrdered,
      changeLocale,
      lang,
      tabs,
      setMapCellSize,
      changeNotificationInterval,
      explainNotificationInterval,
    }
  },
})
</script>
<style lang="css" scoped>
/* @import "../../node_modules/bulma/css/bulma.css"; */

#app {
  height: 100%;
  min-height: 105vh;
}

.dark {
  background: black;
  color: #eee;
}

.dark .title {
  color: #eee;
}

.dark .tabs a {
  color: #ccc;
}

.dark >>> table,
.dark >>> table th {
  background-color: black !important;
  color: #eee;
}

.dark >>> .breadcrumb li a,
.dark >>> .title {
  color: #eee;
}

.dark >>> .box {
  background-color: #333;
  color: #eee;
}

.dark >>> #room-nav a.active {
  color: white;
  font-weight: bold;
  cursor: default;
}

.dark >>> .poster {
  border: 1px solid #ccc;
}

#top-tools {
  float: right;
}
.info-entry {
  min-height: 30px;
  padding: 0px 10px;
  border: 1px solid #eee;
  border-radius: 3px;
  margin: 10px 0px;
  vertical-align: baseline;
}

.info-entry .key {
  font-weight: bold;
  display: inline-block;
  min-width: 130px;
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
  padding: 2px 6px;
  margin-right: 4px;
  margin-left: 5px;
  height: 25px;
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

.input-profile {
  width: calc(100% - 300px);
}

.show-profile {
  word-break: break-all;
}

.profile-row {
  min-height: 30px;
}

.profile-title {
  display: inline-block;
  width: 100px;
  font-weight: bold;
}

.profile-value {
  word-break: break-all;
}
</style>
