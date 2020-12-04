<template>
  <div id="app-main" class="mobile" v-if="isMobile">
    <div id="mobile-menu">
      <div class="mobile-menu-item" @click="moveToPane('minimap')">
        <img src="/img/icon/world.png" width="96" alt="" />
        <div
          class="mobile-menu-item-active"
          v-if="mobilePane == 'minimap'"
        ></div>
      </div>
      <div class="mobile-menu-item" @click="moveToPane('map')">
        <img src="/img/icon/map.png" width="96" alt="" />
        <div class="mobile-menu-item-active" v-if="mobilePane == 'map'">
          &nbsp;
        </div>
      </div>
      <div class="mobile-menu-item" @click="moveToPane('chat')">
        <img src="/img/icon/chat.png" width="96" alt="" />
        <div class="mobile-menu-item-active" v-if="mobilePane == 'chat'"></div>
      </div>
      <div
        class="mobile-menu-item"
        :class="{ disabled: !posterLooking }"
        @click="moveToPane('poster')"
      >
        <img src="/img/icon/new-poster.png" width="96" alt="" />
        <div
          class="mobile-menu-item-active"
          v-if="mobilePane == 'poster'"
        ></div>
      </div>
      <div
        class="mobile-menu-item"
        :class="{ disabled: !posterLooking }"
        @click="moveToPane('poster_chat')"
      >
        <img src="/img/icon/feedback.png" width="96" alt="" />
        <div
          class="mobile-menu-item-active"
          v-if="mobilePane == 'poster_chat'"
        ></div>
      </div>
      <div class="mobile-menu-item" @click="moveToMypage('account')">
        <img src="/img/icon/settings.png" width="96" alt="" />
        <div
          class="mobile-menu-item-active"
          v-if="mobilePane == 'mypage'"
        ></div>
      </div>
    </div>
    <Map
      v-if="!!myself && mobilePane == 'map'"
      :myself="myself"
      :isMobile="isMobile"
      :hidden="hidden"
      :people="people"
      :posters="posters"
      :activePoster="posterLooking ? adjacentPoster : undefined"
      :cells="cellsMag"
      :center="center"
      :mapRadiusX="4"
      :mapRadiusY="7"
      :myChatGroup="myChatGroup"
      :chatGroups="chatGroups"
      :chatGroupOfUser="chatGroupOfUser"
      :selectedPos="selectedPos"
      :selectedUsers="selectedUsers"
      :people_typing="people_typing"
      :avatarImages="avatarImages"
      @select="updateSelectedPos"
      @hover="hoverOnCell"
      @dbl-click="dblClick"
      @upload-poster="uploadPoster"
      @input-arrow-key="inputArrowKey"
    />
    <MiniMap
      v-if="mobilePane == 'minimap'"
      :isMobile="isMobile"
      :hidden="hidden"
      :cells="hallMap"
      :center="center"
      :mapRadiusX="4"
      :mapRadiusY="7"
      :people="people"
      :chatGroups="chatGroups"
      :avatarImages="avatarImages"
      :people_typing="people_typing"
      :selectedPos="selectedPos"
      :visualStyle="visualStyle"
      @select="updateSelectedPos"
      @dbl-click="dblClick"
    />
    <ChatLocal
      ref="chatLocal"
      v-if="mobilePane == 'chat'"
      :axios="axios"
      :isMobile="isMobile"
      :myself="myself"
      :contentHidden="hidden"
      :comments="comments"
      :commentTree="commentTree"
      :events="chat_events"
      :people="people"
      :editingOld="editingOld"
      :chatGroup="myChatGroup ? chatGroups[myChatGroup].users : []"
      :inputFocused="inputFocused"
      :poster="botActive || !posterLooking ? null : adjacentPoster"
      :people_typing="people_typing"
      :enableEncryption="enableEncryption"
      :encryptionPossibleInChat="encryption_possible_in_chat"
      :darkMode="darkMode"
      :highlightUnread="highlightUnread"
      @leave-chat="leaveChat"
      @submit-comment="submitComment"
      @update-comment="sendOrUpdateComment"
      @delete-comment="deleteComment"
      @set-editing-old="setEditingOld"
      @onInputTextChange="onInputTextChange"
      @on-focus-input="onFocusInput"
      @set-encryption="setEncryption"
      @add-emoji-reaction="addEmojiReaction"
      @read-comment="readComment"
    />
    <Poster
      v-show="
        (mobilePane == 'poster' || mobilePane == 'poster_chat') && posterLooking
      "
      ref="posterComponent"
      :isMobile="isMobile"
      :mobilePane="mobilePane"
      :myself="myself"
      :poster="adjacentPoster"
      :uploadProgress="posterUploadProgress"
      :comments="posterComments"
      :commentTree="posterCommentTree"
      :people="people"
      :editingOld="editingOld"
      :posterChatGroup="posterChatGroup"
      :darkMode="darkMode"
      :highlightUnread="highlightUnreadPoster[posterLooking?.id] || {}"
      @submit-poster-comment="submitPosterComment"
      @update-poster-comment="updatePosterComment"
      @delete-comment="deletePosterComment"
      @set-editing-old="setEditingOld"
      @on-focus-input="onFocusInput"
      @upload-poster="uploadPoster"
      @add-emoji-reaction="addEmojiReaction"
      @read-comment="readPosterComment"
    />
    <div id="tools-on-map" v-if="mobilePane == 'map'">
      <button
        id="enter-poster-on-map"
        class="button is-primary"
        @click="enterPoster"
        v-if="adjacentPoster && !posterLooking"
      >
        ポスターを閲覧
      </button>
      <div id="poster-preview" v-if="adjacentPoster && !posterLooking">
        <span style="font-weight: bold"
          >{{ adjacentPoster.poster_number }}:
          {{
            people[adjacentPoster.author]
              ? people[adjacentPoster.author].name
              : ""
          }}</span
        >

        <br />
        {{ adjacentPoster.title }}
        <span id="access-log-notice" v-if="adjacentPoster.access_log">
          このポスターを閲覧すると<br />足あとが記録されます
        </span>
      </div>
      <button id="leave-chat-on-map" @click="leaveChat" v-if="myChatGroup">
        会話から離脱
      </button>
    </div>
    <button
      id="leave-poster-on-map"
      class="button is-primary"
      @click="leavePoster"
      v-if="posterLooking && (mobilePane == 'poster' || mobilePane == 'map')"
    >
      ポスターから離脱
    </button>
    <div id="message" :class="{ hide: message.hide }">
      <div id="message-close" @click="hideMessage">&times;</div>
      {{ message.text }}
    </div>
    <MyPage v-if="mobilePane == 'mypage'" />
  </div>

  <div
    id="app-main"
    v-if="!isMobile"
    :class="{ poster_active: posterLooking, mobile: isMobile, dark: darkMode }"
    @click="visibleNotification = false"
    v-cloak
  >
    <div
      id="header"
      :style="{
        opacity: isMobile ? 0.7 : 1,
        top: isMobile ? '0px' : undefined,
      }"
    >
      <div
        style="
          display: inline-block;
          width: 350px;
          height: 30px;
          overflow: hidden;
        "
      >
        <span>{{ roomName }}</span
        >：
        <span v-if="!!myself">
          {{ myself ? myself.name : "" }}さん
          <span id="login-info">({{ myUserId }}) </span>
        </span>
      </div>

      <span
        class="icon-link with-tool-tip"
        @mouseenter="setHoverWithDelay('leaveRoom')"
        @mouseleave="cancelHover"
        :class="{ hover: hoverElement == 'leaveRoom' }"
      >
        <img
          @click="leaveRoom"
          src="/img/icon/logout.png"
          width="25"
          height="25"
        />
        <div class="tooltip">部屋を退出</div>
      </span>

      <span
        class="icon-link with-tool-tip"
        @mouseenter="setHoverWithDelay('toggleNotification')"
        @mouseleave="cancelHover"
        :class="{ hover: hoverElement == 'toggleNotification' }"
      >
        <img
          id="toggle-notification"
          @click.stop="visibleNotification = !visibleNotification"
          :class="{ enabled: visibleNotification }"
          src="/img/icon/notification.png"
          width="25"
          height="25"
        />
        <div
          v-if="notifications.length > 0"
          class="badge"
          @click.stop="visibleNotification = !visibleNotification"
        >
          {{ notifications.length }}
        </div>

        <div class="tooltip">通知</div>
        <Notification
          v-if="visibleNotification && myself"
          :myself="myself"
          :visualStyle="visualStyle"
          :notifications="notifications"
          :posters="posters"
          @approach-poster="approachPoster"
          @highlight-unread-comments="highlightUnreadComments"
          @close="visibleNotification = false"
        />
      </span>

      <a
        class="icon-link with-tool-tip"
        :class="{ hover: hoverElement == 'mypage' }"
        :href="
          '/mypage?room=' +
            room_id +
            (debug_as
              ? '&debug_as=' + debug_as + '&debug_token=' + debug_token
              : '')
        "
        target="_blank"
        @mouseenter="setHoverWithDelay('mypage')"
        @mouseleave="cancelHover"
      >
        <img width="25" height="25" src="/img/icon/user.png" alt="マイページ" />
        <div class="tooltip">マイページ</div>
      </a>
      <a
        class="icon-link with-tool-tip"
        :class="{ hover: hoverElement == 'posterList' }"
        :href="'/poster_list?room_id=' + room_id"
        target="_blank"
        @mouseenter="setHoverWithDelay('posterList')"
        @mouseleave="cancelHover"
      >
        <img
          width="25"
          height="25"
          src="/img/icon/promotion.png"
          alt="ポスターリスト"
        />
        <div class="tooltip">ポスター一覧</div>
      </a>
      <span
        class="icon-link with-tool-tip"
        :class="{ hover: hoverElement == 'music', active: !!playingBGM }"
        @click="!playingBGM ? playBGM() : stopBGM()"
        @mouseenter="setHoverWithDelay('music')"
        @mouseleave="cancelHover"
      >
        <img
          id="music-icon"
          width="25"
          height="25"
          src="/img/icon/music.png"
          alt="BGM"
        />
        <div class="tooltip">BGM {{ playingBGM ? "ON" : "OFF" }}</div>
      </span>
      <img
        v-if="bot_mode"
        class="toolbar-icon"
        :class="{ disabled: !enableMiniMap }"
        @click="toggleBot"
        src="/img/icon/user.png"
        width="25"
        height="25"
      />
      <div style="clear: both"></div>
    </div>
    <div id="all-connection-status" v-if="!hidden">
      <span
        >会場に{{
          Object.values(people).filter(p => p.connected).length
        }}人が接続中</span
      >
    </div>
    <div id="connection-status" v-if="!hidden">
      <span v-if="socket_active" class="connected">接続されています</span>
      <span v-else class="disconnected">接続されていません</span>
    </div>
    <div
      id="announce"
      :class="{
        marquee: announcement && announcement.marquee,
        poster_active: posterLooking,
      }"
      :style="{ top: isMobile ? '530px' : undefined }"
    >
      <div
        class="marquee-inner"
        :style="{
          'animation-duration': (announcement ? announcement.period : 20) + 's',
        }"
        v-html="announcement ? announcement.text : ''"
      ></div>
    </div>
    <CellInfo
      :cell="cellOnHover.cell"
      :person="cellOnHover.person"
      :poster="selectedPoster"
    />
    <Map
      v-if="!botActive"
      v-show="!!myself"
      :myself="myself"
      :isMobile="isMobile"
      :hidden="hidden"
      :people="people"
      :posters="posters"
      :activePoster="posterLooking ? adjacentPoster : undefined"
      :cells="cellsMag"
      :center="center"
      :mapRadiusX="5"
      :mapRadiusY="5"
      :myChatGroup="myChatGroup"
      :chatGroups="chatGroups"
      :chatGroupOfUser="chatGroupOfUser"
      :selectedPos="selectedPos"
      :selectedUsers="selectedUsers"
      :people_typing="people_typing"
      :avatarImages="avatarImages"
      :visualStyle="visualStyle"
      @select="updateSelectedPos"
      @hover-on-cell="hoverOnCell"
      @dbl-click="dblClick"
      @upload-poster="uploadPoster"
      @input-arrow-key="inputArrowKey"
    />
    <MiniMap
      v-if="enableMiniMap && !botActive"
      v-show="!posterLooking"
      :isMobile="isMobile"
      :hidden="hidden"
      :cells="hallMap"
      :center="center"
      :mapRadiusX="5"
      :mapRadiusY="5"
      :people="people"
      :chatGroups="chatGroups"
      :avatarImages="avatarImages"
      :people_typing="people_typing"
      :selectedPos="selectedPos"
      :visualStyle="visualStyle"
      @select="updateSelectedPos"
      @dbl-click="dblClick"
    />
    <ChatLocal
      ref="chatLocal"
      v-show="isMobile ? !enableMiniMap && !posterLooking : true"
      :isMobile="isMobile"
      :axios="axios"
      :myself="myself"
      :contentHidden="hidden"
      :comments="comments"
      :commentTree="commentTree"
      :events="chat_events"
      :people="people"
      :editingOld="editingOld"
      :chatGroup="myChatGroup ? chatGroups[myChatGroup].users : []"
      :inputFocused="inputFocused"
      :poster="botActive || !posterLooking ? null : adjacentPoster"
      :people_typing="people_typing"
      :enableEncryption="enableEncryption"
      :encryptionPossibleInChat="encryption_possible_in_chat"
      :hoverElement="hoverElement"
      :highlightUnread="highlightUnread"
      @leave-chat="leaveChat"
      @submit-comment="submitComment"
      @update-comment="sendOrUpdateComment"
      @delete-comment="deleteComment"
      @set-editing-old="setEditingOld"
      @on-input-text-change="onInputTextChange"
      @on-focus-input="onFocusInput"
      @set-encryption="setEncryption"
      @add-emoji-reaction="addEmojiReaction"
      @set-hover-with-delay="setHoverWithDelay"
      @cancel-hover="cancelHover"
      @read-comment="readComment"
    />
    <Poster
      v-if="!botActive"
      ref="posterComponent"
      :isMobile="isMobile"
      :myself="myself"
      :axios="axios"
      :poster="posterLooking ? adjacentPoster : undefined"
      :comments="posterComments"
      :commentTree="posterCommentTree"
      :people="people"
      :editingOld="editingOld"
      :posterChatGroup="posterChatGroup"
      :darkMode="darkMode"
      :uploadProgress="posterUploadProgress"
      :highlightUnread="highlightUnreadPoster[posterLooking?.id] || {}"
      @submit-poster-comment="submitPosterComment"
      @update-poster-comment="updatePosterComment"
      @delete-comment="deletePosterComment"
      @set-editing-old="setEditingOld"
      @on-focus-input="onFocusInput"
      @upload-poster="uploadPoster"
      @add-emoji-reaction="addEmojiReaction"
      @read-comment="readPosterComment"
      v-show="posterLooking"
    />
    <div id="tools-on-map">
      <button
        id="enter-poster-on-map"
        @click="enterPoster"
        v-if="adjacentPoster && !posterLooking"
      >
        ポスターを閲覧
      </button>
      <div id="poster-preview" v-if="adjacentPoster && !posterLooking">
        <span style="font-weight: bold"
          >{{ adjacentPoster.poster_number }}:
          {{
            people[adjacentPoster.author]
              ? people[adjacentPoster.author].name
              : ""
          }}</span
        >

        <br />
        {{ adjacentPoster.title }}
        <span id="access-log-notice" v-if="adjacentPoster.access_log">
          このポスターを閲覧すると<br />足あとが記録されます
        </span>
      </div>
      <button
        id="leave-poster-on-map"
        @click="leavePoster"
        v-if="posterLooking"
      >
        ポスターから離脱
      </button>

      <button id="leave-chat-on-map" @click="leaveChat" v-if="myChatGroup">
        会話から離脱
      </button>
      <div id="message" :class="{ hide: message.hide }">
        <div id="message-close" @click="hideMessage">&times;</div>
        {{ message.text }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  reactive,
  onMounted,
  watch,
  ref,
  nextTick,
  toRefs,
  computed,
  PropType,
  ComputedRef,
} from "vue"

import {
  RoomAppProps,
  RoomAppState,
  PersonInMap,
  Cell,
  Point,
  ArrowKey,
  ChatGroup,
  ChatCommentDecrypted,
  UserId,
  Poster as PosterTyp,
  PosterId,
  TypingSocketSendData,
  HttpMethod,
  CommentId,
  CommentEvent,
  PosterCommentDecrypted,
  VisualStyle,
  NewCommentNotification,
  PosterCommentNotification,
} from "@/@types/types"

import Map from "./Map.vue"
import MiniMap from "./MiniMap.vue"
import Poster from "./Poster.vue"
import CellInfo from "./CellInfo.vue"
import ChatLocal from "./ChatLocal.vue"
import Notification from "./Notification.vue"
import MyPage from "../mypage/MyPage.vue"

import { inRange, keyBy, sortBy } from "@/common/util"
import { formatTime, truncateComment } from "../util"

import { AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"
import io from "socket.io-client"
import { initPeopleService } from "./room_people_service"
import { getVisualStyle } from "../util"

const RELOAD_DELAY_MEAN = 2000

import {
  sendComment,
  updateComment,
  deleteComment,
  deletePosterComment,
  initChatService,
  chatGroupOfUser,
  myChatGroup as _myChatGroup,
  commentTree as _commentTree,
} from "./room_chat_service"

import {
  showMessage as showMessage_,
  moveByArrow,
  cellsMag,
  initMapService,
  dblClickHandler,
  enterPoster,
  playBGM as _playBGM,
  stopBGM as _stopBGM,
  posterLooking as _posterLooking,
} from "./room_map_service"

import {
  updatePosterComment,
  doSubmitPosterComment,
  adjacentPoster as _adjacentPoster,
  doUploadPoster,
  adjacentPosters,
  initPosterService,
} from "./room_poster_service"

import { addLatencyLog } from "./room_log_service"
import { MySocketObject } from "../socket"

const setupSocketHandlers = (
  props: RoomAppProps,
  state: RoomAppState,
  socket: SocketIOClient.Socket | MySocketObject
) => {
  // console.log("Setting up socket handlers for", socket)
  socket.on("disconnect", () => {
    state.socket_active = false
  })
  const onConnected = () => {
    console.log("Socket connected")
    state.socket_active = true
    socket.emit("Active", {
      room: props.room_id,
      user: props.myUserId,
      token: props.jwt_hash_initial || props.debug_token,
      debug_as: props.debug_as,
    })
    socket.emit("Subscribe", {
      channel: props.room_id,
      token: props.jwt_hash_initial,
    })
  }
  socket.on("connection", onConnected)
  socket.on("connect", onConnected)

  socket.on("auth_error", () => {
    console.log("socket auth_error")
  })

  socket.on("Greeting", d => {
    console.log("Greeting received.", d?.worker)
    // socket.emit("Active", { room: props.room_id, user: props.myUserId })
  })

  socket.on("Announce", d => {
    // console.log("socket announce", d)
    state.announcement = d
  })

  socket.on("map.reset", () => {
    console.log("map.reset not implemented")
    // reloadData()
  })
  socket.on("AppReload", (force: boolean) => {
    if (state.reloadWaiting) {
      return
    }
    state.reloadWaiting = true
    window.setTimeout(() => {
      if (
        force ||
        confirm("アプリケーションが更新されました。リロードしても良いですか？")
      ) {
        state.reloadWaiting = false

        location.reload()
      } else {
        state.reloadWaiting = false
      }
    }, Math.random() * RELOAD_DELAY_MEAN * 2)
  })
}

const ArrowKeyInterval = 100

export default defineComponent({
  components: {
    Map,
    MiniMap,
    Poster,
    CellInfo,
    ChatLocal,
    MyPage,
    Notification,
  },

  props: {
    room_id: {
      type: String,
      required: true,
    },
    myUserId: {
      type: String,
      required: true,
    },
    jwt_hash_initial: {
      type: String,
    },
    bot_mode: {
      type: Boolean,
      required: true,
    },
    debug_as: {
      type: String,
    },
    debug_token: {
      type: String,
    },
    axios: {
      type: Function as PropType<AxiosInstance>,
      required: true,
    },
    isMobile: {
      type: Boolean,
      required: true,
    },
    mobilePaneFromHash: {
      type: String,
    },
  },
  setup(props, context) {
    if (props.isMobile) {
      document.body.style.minWidth = "0px"
    }
    const client = api(axiosClient(props.axios))
    props.axios.interceptors.request.use(request => {
      request["ts"] = performance.now()
      return request
    })

    let REPORT_LATENCY = false

    props.axios.interceptors.response.use(response => {
      const latency = Math.round(
        Number(performance.now() - response.config["ts"])
      )
      const url = response.request.responseURL
      console.log()
      if (url.indexOf("/latency_report") == -1 && REPORT_LATENCY) {
        addLatencyLog(props.axios, {
          url,
          method: response.config.method as HttpMethod,
          latency,
          timestamp: Date.now(),
        })
      }
      console.log(
        "%c" +
          latency +
          "ms " +
          (response.config.method || "unknown").toUpperCase() +
          " " +
          response.status +
          " ",
        "color: green",
        response.request.responseURL
      )
      return response
    })

    if (!process.env.VUE_APP_SKYWAY_API_KEY) {
      console.warn("Skyway API key not set.")
    }

    const dark_local_storage =
      localStorage["virtual-poster:" + props.myUserId + ":config:dark_mode"]

    const state = reactive<RoomAppState>({
      socket: null as SocketIOClient.Socket | null,
      peer: null,
      skywayRoom: null,
      enableEncryption: false,
      avatarImages: {} as { [index: string]: string },

      enableMiniMap: !props.isMobile,

      people: {} as { [index: string]: PersonInMap },
      posters: {} as { [index: string]: PosterTyp },
      posterComments: {} as { [comment_id: string]: PosterCommentDecrypted },
      posterInputComment: "" as string | undefined,
      roomName: "",
      hallMap: [] as Cell[][],
      cols: 0,
      rows: 0,
      allow_poster_assignment: false,
      keyQueue: null as { key: ArrowKey; timestamp: number } | null,

      center: { x: 5, y: 5 },

      comments: {} as { [index: string]: ChatCommentDecrypted },
      chat_events: [],
      chatGroups: {} as {
        [groupId: string]: ChatGroup
      },
      posterChatGroup: [] as UserId[],

      botActive: false,

      hidden: true,

      composing: false,
      inputFocused: false,

      oneStepAccepted: false,
      message: { hide: true } as {
        text?: string
        hide: boolean
        timer?: number
      },

      socket_active: false,

      selectedUsers: new Set<UserId>(),
      selectedPos: null as { x: number; y: number } | null,
      cellOnHover: { cell: undefined, person: undefined },

      editingOld: null as string | null,

      connectedUsers: [] as string[],

      announcement: null as {
        text: string
        marquee: boolean
        period: number
      } | null,

      move_emitted: null as number | null,

      people_typing: {} as { [index: string]: boolean },

      encryption_possible_in_chat: true,

      privateKeyString: null as string | null,
      privateKey: null as CryptoKey | null,
      publicKeyString: null as string | null,
      publicKey: null as CryptoKey | null,

      reloadWaiting: false,

      mobilePane: "map",
      visualStyle: getVisualStyle(
        new URL(location.href).searchParams.get("style") ||
          localStorage[
            "virtual-poster:" + props.myUserId + ":config:map_visual_style"
          ] ||
          ""
      ),
      darkMode:
        dark_local_storage == "1"
          ? true
          : dark_local_storage == "0"
          ? false
          : window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches,
      hoverElementTimer: undefined,
      hoverElement: undefined,
      posterUploadProgress: undefined,
      visibleNotification: false,
      notifications: [],
      highlightUnread: {},
      highlightUnreadPoster: {},
      playingBGM: undefined,
    })

    props.axios.interceptors.request.use(config => {
      if (props.debug_as) {
        config.params = config.params || {}
        config.params["debug_as"] = props.debug_as
        config.params["debug_token"] = props.debug_token
        return config
      } else {
        return config
      }
    })

    // state.peer?.on("connection", d => {
    //   console.log("Skyway peer connection", d)
    // })

    // state.peer?.on("data", d => {
    //   console.log("Skyway peer data", d)
    // })

    const myself: ComputedRef<PersonInMap | undefined> = computed(
      (): PersonInMap => {
        return state.people[props.myUserId]
      }
    )

    const adjacentPoster = _adjacentPoster(props, state)

    const showMessage = showMessage_(props, state)

    const posterComponent = ref<typeof Poster>()

    const clearInput = () => {
      console.log("clearInput")
      context.emit("clear-chat-input")
    }

    const playBGM = _playBGM(props, state)
    const stopBGM = _stopBGM(state)

    const leavePoster = async () => {
      const poster_id = adjacentPoster.value!.id
      const r = await client.maps
        ._roomId(props.room_id)
        .posters._posterId(poster_id)
        .leave.$post()
      console.log("leavePoster results")
      if (r.ok) {
        state.posterComments = {}
        state.socket?.emit("Unsubscribe", {
          channel: poster_id,
        })
        if (props.isMobile) {
          state.mobilePane = "map"
        }
        state.highlightUnreadPoster = {}
        await nextTick(() => {
          if (state.playingBGM) {
            playBGM()
          }
        })
      } else {
        console.error("Leave poster failed")
      }
    }

    const myChatGroup = _myChatGroup(props, state)

    const sendOrUpdateComment = async (
      text: string,
      encrypting: boolean,
      to_users: UserId[],
      updating = false,
      reply_to?: { id: CommentId; depth: number }
    ) => {
      if (reply_to && reply_to.depth > 3) {
        console.warn("Reply depth too deep")
        return
      }
      let ok = false
      if (updating) {
        const r = await updateComment(
          props.axios,
          state.skywayRoom,
          props.room_id,
          text,
          encrypting,
          to_users,
          state.privateKey,
          state.people,
          state.editingOld!
        )
        ok = r.ok
      } else {
        const r = await sendComment(
          props.axios,
          state.skywayRoom,
          props.room_id,
          text,
          encrypting,
          to_users,
          state.privateKey,
          state.people,
          reply_to ? undefined : myChatGroup.value || undefined,
          reply_to?.id
        )
        ok = r.ok
      }

      if (ok) {
        ;(document.querySelector("#local-chat-input") as any)?.focus()
        clearInput()
        state.editingOld = null
      }
    }

    const submitComment = async (
      text: string,
      reply_to?: { id: CommentId; depth: number }
    ) => {
      console.log("submitComment", text, reply_to)
      if (state.editingOld) {
        await sendOrUpdateComment(
          text,
          state.enableEncryption,
          state.comments[state.editingOld].texts.map(t => t.to),
          true
        )
      } else {
        if (reply_to) {
          const to_users = state.comments[reply_to.id].texts.map(t => t.to)
          await sendOrUpdateComment(
            text,
            state.enableEncryption,
            to_users,
            false,
            reply_to
          )
        } else if (myChatGroup.value) {
          const to_users = state.chatGroups[myChatGroup.value].users
          await sendOrUpdateComment(
            text,
            state.enableEncryption,
            to_users,
            false
          )
        } else {
          return false
        }
        ;(document.querySelector("#local-chat-input") as any)?.focus()
      }
    }

    const inputArrowKey = (key: ArrowKey): boolean => {
      const me = myself.value
      if (!me) {
        return true //Prevent further key event handling
      }
      if (
        state.keyQueue &&
        Date.now() - state.keyQueue.timestamp <= ArrowKeyInterval
      ) {
        state.keyQueue = {
          key,
          timestamp: state.keyQueue.timestamp,
        }
        return true
      } else {
        const { error } = moveByArrow(props.axios, props, state, me, key)
        if (error == "during_chat") {
          showMessage("会話中は動けません。動くためには一度退出してください。")
        }
        state.keyQueue = { key, timestamp: Date.now() }
        return true
      }
    }

    const handleGlobalKeyDown = (ev: KeyboardEvent) => {
      if (
        [
          "ArrowRight",
          "ArrowUp",
          "ArrowLeft",
          "ArrowDown",
          "h",
          "j",
          "k",
          "l",
          "y",
          "u",
          "b",
          "n",
        ].indexOf(ev.key) != -1 &&
        !state.inputFocused
      ) {
        const key = ev.key as ArrowKey
        return inputArrowKey(key)
      } else {
        return false
      }
    }

    const submitPosterComment = async (
      text: string,
      reply_to: CommentEvent
    ) => {
      await doSubmitPosterComment(props.axios, props, state, text, reply_to)
    }

    onMounted(() => {
      window.addEventListener("storage", ev => {
        if (
          ev.key ==
          "virtual-poster:" + props.myUserId + ":config:dark_mode"
        ) {
          state.darkMode =
            ev.newValue == "1"
              ? true
              : ev.newValue == "0"
              ? false
              : window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches
        } else if (
          ev.key ==
          "virtual-poster:" + props.myUserId + ":config:map_visual_style"
        ) {
          state.visualStyle = getVisualStyle(
            new URL(location.href).searchParams.get("style") ||
              ev.newValue ||
              ""
          )
        } else if (
          ev.key ==
          "virtual-poster:" + props.myUserId + ":config:show_minimap"
        ) {
          state.enableMiniMap = ev.newValue != "0"
        }
      })
      const mm = window.matchMedia("(prefers-color-scheme: dark)")
      const f = e => {
        const v =
          localStorage["virtual-poster:" + props.myUserId + ":config:dark_mode"]
        if (!v) {
          state.darkMode = e.matches
        }
      }
      if (mm.addEventListener) {
        mm.addEventListener("change", f)
      } else if (mm.addListener) {
        mm.addListener(f)
      }

      window.addEventListener("keydown", ev => {
        const r = handleGlobalKeyDown(ev)
        if (r) {
          ev.preventDefault()
        }
      })

      const k = "virtual-poster:" + props.myUserId + ":report_latency"
      REPORT_LATENCY = localStorage[k] == "1"
      if (REPORT_LATENCY) {
        console.log(
          "Reporting latency enabled. This can be turned off by entering the following: " +
            "localStorage['" +
            k +
            "'] = '0'"
        )
      }
      ;(async () => {
        const data = await client.maps
          ._roomId(props.room_id)
          .enter.$post()
          .catch(() => {
            return {
              ok: false,
              status: "API error",
              socket_url: undefined,
              socket_protocol: undefined,
              public_key: undefined,
            }
          })
        if (!data.ok) {
          alert(
            "部屋に入れませんでした。" +
              (data.status == "NoAccess"
                ? " アクセス権がありません。"
                : data.status == "NoSpace"
                ? "スペースがありません。"
                : data.status == "DoesNotExist"
                ? "部屋が見つかりません。"
                : "")
          )
          location.href = "/"
          return
        }
        // let socket_url = "http://localhost:5000/"
        const socket_url = data.socket_url
        if (!socket_url) {
          alert("WebSocketの設定が見つかりません")
          location.href = "/"
          return
        }
        // console.log("Socket URL: " + socket_url)
        if (data.socket_protocol == "Socket.IO") {
          state.socket = io(socket_url, {
            transports: ["websocket"],
          })
        } else if (data.socket_protocol == "WebSocket") {
          let url
          if (
            socket_url.indexOf("http") != 0 &&
            socket_url.indexOf("ws") != 0
          ) {
            url =
              (location.protocol == "https:" ? "wss" : "ws") +
              "://" +
              location.host +
              socket_url
          } else {
            url = socket_url
          }
          state.socket = new MySocketObject(
            url,
            props,
            state,
            setupSocketHandlers
          )
        } else {
          console.error("Socket protocol not supported")
        }
        if (state.socket) {
          // console.log("Socket created:", state.socket)
        } else {
          console.error("Failed to make a socket.")
          return
        }

        setupSocketHandlers(
          props,
          state,
          state.socket as MySocketObject | SocketIOClient.Socket
        )
        // We have to get public keys of users first.
        await initPeopleService(props.axios, state.socket, props, state)
        // Then chat comments, map data, poster data.
        await Promise.all([
          initMapService(props.axios, state.socket, props, state),
          initChatService(
            props.axios,
            state.socket,
            props,
            state,
            adjacentPoster,
            data?.public_key
          ),
          initPosterService(
            props.axios,
            state.socket,
            props,
            state,
            adjacentPoster
          ),
        ])
        const other_users_encryptions = myChatGroup.value
          ? state.chatGroups[myChatGroup.value!].users
              .map(u => !!state.people[u]?.public_key)
              .every(a => a)
          : true

        state.encryption_possible_in_chat =
          !!state.privateKey && other_users_encryptions

        const me = myself.value
        if (me && me.x != undefined && me.y != undefined) {
          const poster_viewing = me.poster_viewing
          if (poster_viewing) {
            state.socket?.emit("Subscribe", { channel: poster_viewing })
          }
          state.center = {
            x: inRange(
              me.x,
              props.isMobile ? 4 : 5,
              state.cols - (props.isMobile ? 4 : 5) - 1
            ),
            y: inRange(
              me.y,
              props.isMobile ? 6 : 5,
              state.rows - (props.isMobile ? 6 : 5) - 1
            ),
          }
          state.hidden = false
        }
      })().catch(err => {
        console.error(err)
        // alert("部屋に入れませんでした。ホーム画面に戻ります。")
        // `location`.href = "/"
      })

      // window.setInterval(state.refreshToken, 1000 * 60 * 59)
    })

    watch(
      () => state.enableEncryption,
      () => {
        localStorage[
          "virtual-poster:" + props.myUserId + ":config:encryption"
        ] = state.enableEncryption ? "1" : "0"
      }
    )

    const leaveRoom = async () => {
      try {
        const r = await client.maps._roomId(props.room_id).leave.$post()
        if (r.ok) {
          location.href = "/"
        }
      } catch (err) {
        console.log(err)
      }
    }

    const onInputTextChange = () => {
      const me = myself.value
      if (!me) {
        return
      }
      const d: TypingSocketSendData = {
        user: me.id,
        room: props.room_id,
        typing: true,
      }
      if (!state.people_typing[props.myUserId]) {
        state.socket?.emit("ChatTyping", d)
        window.setTimeout(() => {
          const d2: TypingSocketSendData = {
            user: me.id,
            room: props.room_id,
            typing: false,
          }
          state.socket?.emit("ChatTyping", d2)
        }, 8000)
      }
    }
    const setEncryption = (enabled: boolean) => {
      if (state.privateKey) {
        state.enableEncryption = enabled
      }
    }

    const addEmojiReaction = async (
      cid: CommentId,
      reaction_id: CommentId,
      emoji: string,
      kind: "chat" | "poster"
    ) => {
      if (kind != "chat" && kind != "poster") {
        console.log("chat or poster must be specified")
        return
      }
      console.log("addEmojiReaction", cid, reaction_id, emoji)
      if (kind == "chat") {
        const c = state.comments[cid]
        if (!c) {
          console.log("Comment not found")
          return
        }
        if (
          c.reactions &&
          c.reactions[emoji] &&
          c.reactions[emoji][props.myUserId] != undefined
        ) {
          await client.comments._commentId(reaction_id).$delete()
        } else {
          const r = await client.comments._commentId(cid).reply.$post({
            body: c.texts.map(t => {
              return {
                encrypted: false,
                text: "\\reaction " + emoji,
                to: t.to,
              }
            }),
          })
          console.log("addEmojiReaction API result", r)
        }
      } else {
        const c: PosterCommentDecrypted = state.posterComments[cid]
        if (!c) {
          console.log("Comment not found")
          return
        }
        console.log("Reaction to poster comment", c)
        if (
          c.reactions &&
          c.reactions[emoji] &&
          c.reactions[emoji][props.myUserId] != undefined
        ) {
          await client.posters
            ._posterId(c.poster)
            .comments._commentId(reaction_id)
            .$delete()
        } else {
          const r = await client.posters
            ._posterId(c.poster)
            .comments._commentId(c.id)
            .reply.$post({ body: { text: "\\reaction " + emoji } })
          console.log("addEmojiReaction API result", r)
        }
      }
    }

    const hideMessage = () => {
      state.message.hide = true
    }

    const dblClick = async (p: Point) => {
      state.selectedPos = null
      await dblClickHandler(props, state, props.axios)(p)
    }

    const selected = computed((): Cell | undefined => {
      return state.selectedPos &&
        state.hallMap &&
        state.hallMap[state.selectedPos.y]
        ? state.hallMap[state.selectedPos.y][state.selectedPos.x]
        : undefined
    })

    const selectedPerson = computed((): PersonInMap | undefined => {
      const pos = state.selectedPos
      if (!pos) {
        return undefined
      } else {
        for (const uid of state.selectedUsers) {
          if (
            state.people[uid] &&
            state.people[uid].x == pos.x &&
            state.people[uid].y == pos.y
          ) {
            return state.people[uid]
          }
        }
        return undefined
      }
    })

    const selectedPoster = computed((): PosterTyp | undefined => {
      return selected.value
        ? keyBy(Object.values(state.posters), "location")[selected.value.id]
        : undefined
    })

    const updateSelectedPos = (pos: {
      x: number
      y: number
      event: MouseEvent
    }) => {
      console.log(pos, event)
      state.selectedPos = pos
      const person: PersonInMap | undefined = Object.values(state.people).find(
        person =>
          person.id != props.myUserId && person.x == pos.x && person.y == pos.y
      )
      if (
        person &&
        myself.value &&
        Math.abs(myself.value.x - person.x) <= 1 &&
        Math.abs(myself.value.y - person.y) <= 1
      ) {
        state.selectedUsers = new Set([person.id])
      } else {
        state.selectedUsers = new Set()
      }
    }

    const hoverOnCell = (p: { x: number; y: number; person?: PersonInMap }) => {
      state.cellOnHover = { cell: state.hallMap[p.y][p.x], person: p.person }
    }

    const uploadPoster = async (file: File, poster_id: string) => {
      await doUploadPoster(props.axios, state, file, poster_id)
    }

    const onFocusInput = (focused: boolean) => {
      console.log("on focus", focused)
      state.inputFocused = focused
    }
    const setEditingOld = (comment_id: string | null) => {
      state.editingOld = comment_id
    }

    const startBot = () => {
      REPORT_LATENCY = true
      state.botActive = true
      const me = myself.value
      if (!me) {
        alert("Myself not set")
        return
      }
      const id = window.setInterval(() => {
        const dir = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"][
          Math.floor(Math.random() * 4)
        ] as ArrowKey
        moveByArrow(props.axios, props, state, me, dir)
        if (!state.botActive) {
          window.clearInterval(id)
        }
      }, ArrowKeyInterval)
    }

    const toggleBot = () => {
      if (state.botActive) {
        state.botActive = false
        const k = "virtual-poster:" + props.myUserId + ":report_latency"
        REPORT_LATENCY = localStorage[k] == "1"
      } else {
        state.botActive = true
        startBot()
      }
    }

    const leaveChat = () => {
      const group_id = myChatGroup.value
      if (group_id) {
        client.maps
          ._roomId(props.room_id)
          .groups._groupId(group_id)
          .leave.$post()
          .then(data => {
            console.log(data)
            if (data.ok) {
              if (data.leftGroup) {
                //Vue.set
                state.chatGroups[group_id] = data.leftGroup
              }
              showMessage("会話から離脱しました。")
              state.encryption_possible_in_chat = !!state.privateKey
              //Vue.set
              state.people_typing[props.myUserId] = false
              if (state.skywayRoom) {
                state.skywayRoom.close()
                state.skywayRoom = null
              }
            } else {
              //
            }
          })
          .catch(err => {
            console.error(err)
          })
      }
    }

    const posterLooking = _posterLooking(props, state)

    const moveToPane = (pane: string) => {
      if ((pane == "poster" || pane == "poster_chat") && !posterLooking.value) {
        return
      }
      location.hash = pane
      state.mobilePane = pane
    }

    const moveToMypage = (tab: string) => {
      location.hash = "#" + tab
      state.mobilePane = "mypage"
    }

    if (props.isMobile) {
      if (["", "#"].indexOf(location.hash) != -1) {
        location.hash = "#map"
      } else if (["#account", "#avatar"].indexOf(location.hash) != -1) {
        state.mobilePane = "mypage"
      } else {
        state.mobilePane = location.hash.slice(1)
      }
    }

    const setHoverWithDelay = (item: string) => {
      state.hoverElementTimer = window.setTimeout(() => {
        state.hoverElement = item
      }, 400)
    }

    const cancelHover = () => {
      window.clearTimeout(state.hoverElementTimer)
      state.hoverElement = undefined
    }

    const readComment = (comment_id: CommentId, immediate?: boolean) => {
      if (!state.comments[comment_id]) {
        return
      }
      state.comments[comment_id].read = true
      setTimeout(
        () => {
          delete state.highlightUnread[comment_id]
          const count = Object.values(state.highlightUnread).filter(h => h)
            .length
          if (count == 0) {
            state.notifications = state.notifications.filter(
              n => n.kind != "new_comments"
            )
          } else {
            for (const n of state.notifications) {
              if (n.kind == "new_comments") {
                ;(n as NewCommentNotification).data.count = count
              }
            }
          }
        },
        immediate ? 0 : 2000
      )
      client.comments
        ._commentId(comment_id)
        .read.$post({ body: { read: true } })
        .then(() => {
          //
        })
        .catch(() => {
          //
        })
    }

    const readPosterComment = (
      poster_id: PosterId,
      comment_id: CommentId,
      immediate?: boolean
    ) => {
      if (!state.posterComments[comment_id]) {
        console.warn("readPosterComment() not found comment", comment_id)
        return
      }
      state.posterComments[comment_id].read = true
      setTimeout(
        () => {
          if (!state.highlightUnreadPoster[poster_id]) {
            console.error("highlightUnreadPoster undefined")
            return
          }
          delete state.highlightUnreadPoster[poster_id][comment_id]
          const count = Object.values(
            state.highlightUnreadPoster[poster_id]
          ).filter(h => h).length
          if (count == 0) {
            state.notifications = state.notifications.filter(
              n => !(n.kind == "poster_comments" && n.data.poster == poster_id)
            )
          } else {
            for (const n of state.notifications) {
              if (n.kind == "poster_comments" && n.data.poster == poster_id) {
                ;(n as PosterCommentNotification).data.count = count
              }
            }
          }
        },
        immediate ? 0 : 2000
      )
      client.comments
        ._commentId(comment_id)
        .read.$post({ body: { read: true } })
        .then(() => {
          //
        })
        .catch(() => {
          //
        })
    }

    const highlightUnreadComments = (scroll: boolean) => {
      const comments = sortBy(
        Object.values(state.comments).filter(
          c =>
            !c.read &&
            c.person != props.myUserId &&
            c.text_decrypted.indexOf("\\reaction ") != 0
        ),
        c => c.timestamp
      )
      if (comments.length == 0) {
        return
      }
      state.highlightUnread = {}
      for (const c of comments) {
        state.highlightUnread[c.id] = true
      }
      if (scroll) {
        // Scroll to a certain element
        const el = document.querySelector("#comment-entry-" + comments[0].id)
        const parent = document.querySelector("#chat-local-history")
        if (el && parent) {
          const br = el.getBoundingClientRect()
          const br2 = parent.getBoundingClientRect()
          console.log(el, br)
          parent.scrollBy({
            top: br.top - 100,
            left: 0,
            behavior: "smooth",
          })
        }
      }
    }

    const highlightUnreadPosterComments = (
      poster_id: PosterId,
      scroll: boolean
    ) => {
      const comments = sortBy(
        Object.values(state.posterComments).filter(
          c =>
            !c.read &&
            c.person != props.myUserId &&
            c.text_decrypted.indexOf("\\reaction ") != 0
        ),
        c => c.timestamp
      )
      if (comments.length == 0) {
        console.warn("No comment to highlight", state.posterComments)
        return
      }
      state.highlightUnreadPoster = {}
      state.highlightUnreadPoster[poster_id] = {}
      for (const c of comments) {
        state.highlightUnreadPoster[poster_id][c.id] = true
      }
      if (scroll) {
        // Scroll to a certain element
        const el = document.querySelector(
          "#poster-comment-entry-" + comments[0].id
        )
        const parent = document.querySelector("#poster-comments-container")

        if (el && parent) {
          const br = el.getBoundingClientRect()
          const br2 = parent.getBoundingClientRect()
          console.log(el, br)
          parent.scrollBy({
            top: br.top - 100,
            left: 0,
            behavior: "smooth",
          })
        }
      }
    }

    const sleepAsync = (delay_millisec: number) => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve()
        }, delay_millisec)
      })
    }

    const approachPoster = async (poster_id: PosterId) => {
      console.log("approachPoster", poster_id)
      if (posterLooking.value && posterLooking.value != poster_id) {
        await leavePoster()
        await sleepAsync(500)
        await dblClick(state.posters[poster_id])
      } else if (posterLooking.value && posterLooking.value == poster_id) {
        //
      } else {
        await dblClick(state.posters[poster_id])
      }

      highlightUnreadPosterComments(poster_id, true)
    }

    watch(
      () => state.comments,
      async (nv, ov) => {
        if (Object.values(ov).length == 0) {
          highlightUnreadComments(false)
        }
      }
    )
    return {
      ...toRefs(state),
      formatTime,
      truncateComment,
      commentTree: _commentTree(state, "chat"),
      posterCommentTree: _commentTree(state, "poster"),
      hoverOnCell,
      leaveRoom,
      setEncryption,
      addEmojiReaction,
      adjacentPosters,
      selectedPoster,
      leaveChat,
      uploadPoster,
      deleteComment: deleteComment(props.axios),
      deletePosterComment: deletePosterComment(props.axios),
      onInputTextChange,
      cellsMag: cellsMag(state, props.isMobile ? 4 : 5, props.isMobile ? 6 : 5),
      hideMessage,
      dblClick,
      toggleBot,
      setEditingOld,
      onFocusInput,
      updateSelectedPos,
      sendOrUpdateComment,
      submitComment,
      submitPosterComment,
      selected,
      inputArrowKey,
      myChatGroup,
      adjacentPoster,
      posterLooking: posterLooking,
      myself,
      updatePosterComment,
      chatGroupOfUser: chatGroupOfUser(state),
      selectedPerson,
      posterComponent,
      enterPoster: enterPoster(props.axios, props, state),
      leavePoster,
      moveToPane,
      moveToMypage,
      setHoverWithDelay,
      cancelHover,
      readComment,
      readPosterComment,
      highlightUnreadComments,
      playBGM: playBGM,
      stopBGM: stopBGM,
      approachPoster,
    }
  },
})
</script>

<style lang="css">
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

@media (max-width: 600px) {
  html {
    position: fixed;
    height: 100%;
    overflow: hidden;
  }

  body {
    margin: 0px;
    width: 100vw;
    height: 100vh;
    overflow-y: scroll;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }
}

@font-face {
  font-family: "PixelMplus";
  src: url(/PixelMplus12-Regular.ttf);
}

/* @import url("cell.css"); */

body {
  font-family: "YuGothic", Loto, sans-serif;
  min-width: 800px;
  margin: 0px !important;
}

#app-main {
  height: 100vh;
}

#app-main.dark {
  background: black;
  color: #eee;
}

#header {
  background: white;
  z-index: 100;
  width: 528px;
  height: 38px;
  margin: 0px;
  /* background: #ccc; */
}

.dark #header {
  background: black;
}

#help {
  font-size: 12px;
}

h2 {
  font-size: 14px;
  margin-bottom: 0px;
}

[v-cloak] {
  display: none;
}

#announce {
  box-sizing: border-box;
  position: absolute;
  left: 8px;
  top: 580px;
  width: 528px;
  height: 25px;
  background: black;
  color: yellow;
  /* font-family: PixelMplus; */
  font-size: 14px;
  /* padding: 3px 0px 0px 3px; */
  overflow: hidden;
  /* transition: top 0.5s; */
}

.dark #announce {
  background: #222;
}

#announce.poster_active {
  top: 293px;
  transition: top 0.5s 0.5s;
}

#announce a {
  color: inherit;
}

button#leave-chat-on-map {
  position: absolute;
  width: 120px;
  height: 26px;
  left: 400px;
  top: 60px;
}

button#enter-poster-on-map {
  position: absolute;
  width: 150px;
  height: 26px;
  left: 370px;
  top: 90px;
}

.mobile button#enter-poster-on-map,
.mobile button#leave-poster-on-map {
  font-size: 27px;
  left: 10vw;
  top: 10px;
  width: 80vw;
  /* right: 10px; */
  height: 40px;
}

div#poster-preview {
  position: absolute;
  padding: 8px;
  width: 180px;
  /* height: 100px; */
  left: 340px;
  top: 120px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.6);
}

.mobile div#poster-preview {
  left: 10vw;
  width: 80vw;
}

button#leave-poster-on-map {
  position: absolute;
  width: 150px;
  height: 26px;
  left: 370px;
  top: 90px;
}

#access-log-notice {
  font-size: 12px;
  color: rgb(205, 130, 0);
  font-weight: bold;
  line-height: 1.2em;
  display: inline-block;
  margin: 0px;
}

.user-select {
  margin: 0px 10px;
}

#minimap-area {
  position: absolute;
  border: blue 1px solid;
}

#chat-indicator {
  display: inline-block;
  width: 120px;
  color: gray;
}

#chat-indicator.on {
  color: blue;
  font-weight: bold;
}

/* https://qiita.com/nissuk/items/7d5545a9f6177ff965dc */
/** マーキーさせたい部分 */
.marquee {
  overflow: hidden;
  position: relative;
}
/* マーキーの内容部分の高さ確保 */
.marquee::after {
  content: "";
  white-space: nowrap;
  display: inline-block;
}
/* マーキーさせたい部分(内側) */
.marquee > .marquee-inner {
  position: absolute;
  top: 700;
  white-space: nowrap;
  animation-name: marquee;
  animation-timing-function: linear;
  animation-duration: 20s;
  animation-iteration-count: infinite;
}
/* マウスオーバーでマーキーストップ */
.marquee > .marquee-inner:hover {
  animation-play-state: paused;
  cursor: default;
}
/** マーキーアニメーション */
@keyframes marquee {
  0% {
    left: 100%;
    transform: translate(0);
  }
  100% {
    left: 0;
    transform: translate(-100%);
  }
}

#login-info {
  font-size: 10px;
  margin-left: 7px;
}

#login-button {
  float: right;
}

#all-connection-status {
  position: absolute;
  top: 35px;
  left: 300px;
  font-weight: bold;
  font-size: 10px;
}

#connection-status {
  position: absolute;
  top: 35px;
  left: 450px;
  font-weight: bold;
  font-size: 10px;
}

#connection-status .connected {
  color: green;
}

#connection-status .disconnected {
  color: red;
}

#start-chat {
  position: absolute;
  top: 110px;
  left: 430px;
}

#message {
  position: absolute;
  top: 500px;
  left: 100px;
  width: 350px;
  height: 60px;
  font-size: 12px;
  padding: 8px;
  background: rgba(234, 252, 243, 0.4);
  box-shadow: 2px 2px 2px #8c8;
  /* animation: opacity 1s linear; */
}

.poster_active #message {
  top: 215px;
}

#message.hide {
  display: none;
  /* animation: opacity 1s linear; */
}
#message-close {
  border: 1px solid black;
  font-size: 14px !important ;
  font-weight: bold !important;
  float: right;
  cursor: pointer;
}

.icon-link {
  cursor: pointer;
  float: right;
  margin: 4px 5px 0px 5px;
}

.dark .icon-link img {
  filter: invert(80%);
}

.active #music-icon {
  filter: invert(35%) sepia(26%) saturate(3910%) hue-rotate(222deg)
    brightness(108%) contrast(100%);
}

.toolbar-icon {
  border: 1px solid black;
  border-radius: 3px;
  padding: 3px;
  cursor: pointer;
  margin: 0px 12px;
  float: right;
}

.toolbar-icon.disabled {
  opacity: 0.3;
}

#app-main.mobile {
  height: 100%;
  margin: 0px 0px calc(100vw / 6) 0px;
}

#mobile-menu {
  position: fixed;
  width: 100%;
  height: calc(100vw / 6 + 5px);
  margin: 0px;
  top: calc(100vh - 100vw / 6);
  z-index: 100;
}

.mobile-menu-item {
  background: #bbb;
  width: calc(100vw / 6);
  height: 105%;
  margin: 0px;
  margin-bottom: 30px;
  float: left;
}

.mobile-menu-item img {
  width: 10vw;
  margin: calc((100vw / 6 - 10vw) / 2);
  display: block;
  text-align: center;
}

.mobile-menu-item.disabled img {
  opacity: 0.3;
}

.mobile-menu-item-active {
  position: absolute;
  background: #33f;
  width: calc(100vw / 6);
  height: calc(100vw / 6 / 10);
  bottom: 0px;
}

#tools-on-map {
  position: absolute;
  top: 0px;
  left: 0px;
  height: calc(200px);
  z-index: 10;
}

.with-tool-tip .tooltip {
  position: absolute;
  display: none;
  background: black;
  border-radius: 5px;
  padding: 5px;
  color: white;
  z-index: 100;
}

.with-tool-tip.hover .tooltip {
  display: block;
}

#toggle-notification.enabled {
  filter: invert(35%) sepia(26%) saturate(3910%) hue-rotate(222deg)
    brightness(108%) contrast(100%);
}

.badge {
  position: relative;
  top: -20px;
  left: 10px;
  font-size: 12px;
  background: rgb(255, 76, 63);
  color: white;
  width: 18px;
  height: 18px;
  text-align: center;
  line-height: 18px;
  border-radius: 50%;
  box-shadow: 0 0 1px #333;
}
</style>
