<template>
  <RoomMobile
    v-if="isMobile"
    :posterLooking="posterLooking"
    :myself="myself"
    :adjacentPoster="adjacentPoster"
    :locale="locale"
    :people="people"
    :posterComments="posterComments"
    :posterCommentTree="posterCommentTree"
    :roomAppState="roomAppState"
    :isMobile="isMobile"
    :cellVisibility="cellVisibility"
    :hidden="hidden"
    :posters="posters"
    :activePoster="posterLooking ? adjacentPoster : undefined"
    :cellsMag="cellsMag"
    :center="center"
    :mapRadiusX="5"
    :mapRadiusY="5"
    :myChatGroup="myChatGroup"
    :chatGroups="chatGroups"
    :chatGroupOfUser="chatGroupOfUser"
    :selectedPos="selectedPos"
    :selectedUsers="selectedUsers"
    :personInFront="personInFront"
    :objectCellInFront="objectCellInFront"
    :people_typing="people_typing"
    :avatarImages="avatarImages"
    :visualStyle="visualStyle"
    @start-chat-in-front="startChatInFront"
    @select="updateSelectedPos"
    @enter-poster="enterPoster"
    @leave-poster="leavePoster"
    @hover-on-cell="hoverOnCell"
    @dbl-click="dblClick"
    :uploadPoster="uploadPoster"
    @input-arrow-key="inputArrowKey"
    :contentHidden="hidden"
    :comments="comments"
    :commentTree="commentTree"
    :events="chat_events"
    :editingOld="editingOld"
    :chatGroup="myChatGroup ? chatGroups[myChatGroup].users : []"
    :inputFocused="inputFocused"
    :poster="botActive || !posterLooking ? null : adjacentPoster"
    :enableEncryption="enableEncryption"
    :encryptionPossibleInChat="encryption_possible_in_chat"
    :hoverElement="hoverElement"
    :highlightUnread="highlightUnread"
    :posterContainerWidth="posterContainerWidth"
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
    :axios="axios"
    :posterChatGroup="posterChatGroup"
    :darkMode="darkMode"
    :uploadProgress="posterUploadProgress"
    :highlightUnreadPoster="highlightUnreadPoster[posterLooking?.id] || {}"
    :submitPosterComment="submitPosterComment"
    :updatePosterComment="updatePosterComment"
    :deletePosterComment="deletePosterComment"
    @read-poster-comment="readPosterComment"
    @set-poster-container-width="setPosterContainerWidth"
    @set-poster="setPoster"
  />
  <div
    id="app-main"
    v-if="!isMobile"
    :class="{ poster_active: posterLooking, mobile: isMobile, dark: darkMode }"
    @click="visibleNotification = false"
    v-cloak
    :style="cssVars"
  >
    <div
      id="header"
      :style="{
        opacity: isMobile ? 0.7 : 1,
        top: isMobile ? '0px' : undefined,
      }"
    >
      <div id="page-title-info">
        <span style="font-weight: bold">{{ room?.name }}</span
        >：
        <span v-if="!!myself">
          {{ myself ? myself.name : "" }}{{ locale == "ja" ? "さん" : "" }}
        </span>
      </div>

      <span
        class="icon-link with-tool-tip right"
        @mouseenter="setHoverWithDelay('leaveRoom')"
        @mouseleave="cancelHover"
        :class="{ hover: hoverElement == 'leaveRoom' }"
      >
        <img
          @click="leaveRoom"
          src="/img/icon/logout.png"
          width="25"
          height="25"
          :alt="lang('leave_room')"
        />
        <div class="tooltip">{{ lang("leave_room") }}</div>
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

        <div class="tooltip">{{ lang("notification") }}</div>
        <Notification
          v-if="visibleNotification && myself"
          :locale="locale"
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
        <img
          width="25"
          height="25"
          src="/img/icon/user.png"
          :alt="lang('mypage')"
        />
        <div class="tooltip">{{ lang("mypage") }}</div>
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
          :alt="lang('poster_list')"
        />
        <div class="tooltip">{{ lang("poster_list") }}</div>
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
      <span>{{
        locale == "ja"
          ? `会場に${
              Object.values(people).filter(p => p.connected).length
            }人が接続中`
          : `${Object.values(people).filter(p => p.connected).length} ${
              Object.values(people).filter(p => p.connected).length > 1
                ? "people"
                : "person"
            } online`
      }}</span>
    </div>
    <div id="connection-status" v-if="!hidden">
      <span v-if="socket_active" class="connected">{{
        lang("connected")
      }}</span>
      <span v-else class="disconnected">{{ lang("disconnected") }}</span>
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
      :locale="locale"
    />
    <Map
      v-if="!botActive"
      v-show="!!myself"
      :myself="myself"
      :isMobile="isMobile"
      :cellVisibility="cellVisibility"
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
      :personInFront="personInFront"
      :objectCellInFront="objectCellInFront"
      :people_typing="people_typing"
      :avatarImages="avatarImages"
      :cellSize="mapCellSize"
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
      :room="room"
      :isMobile="isMobile"
      :cellVisibility="cellVisibility"
      :hidden="hidden"
      :cells="hallMap"
      :mainMapCellSize="mapCellSize"
      :center="center"
      :mapRadiusX="5"
      :mapRadiusY="5"
      :people="people"
      :posters="posters"
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
      :locale="locale"
      :axios="axios"
      :myself="myself"
      :contentHidden="hidden"
      :comments="comments"
      :mapCellSize="mapCellSize"
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
      :posterContainerWidth="posterContainerWidth"
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
      v-show="posterLooking"
      ref="posterComponent"
      :locale="locale"
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
      :mapCellSize="mapCellSize"
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
      @set-poster-container-width="setPosterContainerWidth"
      @set-poster="setPoster"
    />
    <div
      id="message"
      :class="{ hide: message.hide }"
      :style="{
        background: message.color,
      }"
    >
      <div id="message-close" @click="hideMessage">&times;</div>
      {{ message.text }}
    </div>
    <div
      id="person-info"
      v-if="personInfo.person"
      :class="{ hide: personInfo.hide }"
      :style="{
        background: personInfo.color,
      }"
    >
      <div id="person-info-close" @click="hidePersonInfo">&times;</div>
      <div
        v-if="personInfo.person.profiles?.display_name_full?.content"
        style="font-weight: bold; font-size: 14px"
      >
        {{ personInfo.person.profiles?.display_name_full?.content }} （{{
          personInfo.person.name
        }}）
      </div>
      <div v-else style="font-weight: bold; font-size: 14px">
        {{ personInfo.person.name }}
      </div>
      <div
        style="font-weight: bold; font-size: 14px"
        v-if="personInfo.person.profiles?.affiliation"
      >
        {{ personInfo.person.profiles.affiliation.content }}
      </div>
      <div
        v-for="[k, v] in Object.entries(personInfo.person.profiles)"
        :key="k"
      >
        <span
          v-if="
            ['url', 'url2', 'url3'].indexOf(k) >= 0 &&
            v.content.indexOf('http') == 0
          "
          style="font-size: 12px"
        >
          <div style="font-weight: bold">
            {{ showProfileKind(k, undefined, locale)
            }}{{
              v.metadata?.description ? ": " + v.metadata?.description : ""
            }}
          </div>
          <div>
            <a :href="v.content" target="_blank">{{
              v.content.length > 60
                ? v.content.slice(0, 30) +
                  "..." +
                  v.content.slice(v.content.length - 30, v.content.length)
                : v.content
            }}</a>
          </div>
        </span>
      </div>
    </div>
    <div
      id="object-info"
      v-if="!objectInfo.hide"
      :class="{ hide: objectInfo.hide }"
      :style="{
        background: objectInfo.color,
      }"
    >
      <div id="object-info-close" @click="hideObjectInfo">&times;</div>
      <div style="font-weight: bold; font-size: 14px">
        <div v-if="objectInfo.text">{{ objectInfo.text }}</div>
        <div v-if="objectInfo.url">
          URL: <a :href="objectInfo.url">{{ objectInfo.url }}</a>
        </div>
      </div>
    </div>
    <div id="tools-on-map">
      <button
        id="enter-poster-on-map"
        class="map-tool-pos2"
        @click="enterPoster"
        v-if="adjacentPoster && !posterLooking"
      >
        {{ lang("view_poster") }}
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
          {{
            locale == "ja"
              ? "このポスターを閲覧すると，足あとが記録されます"
              : "This poster records the access log of visitors."
          }}
        </span>
      </div>
      <button
        id="leave-poster-on-map"
        class="map-tool-pos2"
        @click="leavePoster"
        v-if="posterLooking"
      >
        {{ lang("leave_poster") }}
      </button>
      <button
        id="start-chat-on-map"
        class="map-tool-pos1"
        @click="startChatInFront"
        v-if="!myChatGroup && personInFront"
      >
        {{ lang("start_chat") }}
      </button>
      <button
        id="view-info-person-on-map"
        class="map-tool-pos2"
        @click="viewInfoPersonInFront"
        v-if="!myChatGroup && personInFront"
        :class="{ 'poster-adjacent': adjacentPoster }"
      >
        {{ lang("profile") }}
      </button>
      <button
        id="view-info-object-on-map"
        class="map-tool-pos1"
        @click="viewInfoObjectInFront"
        v-if="!adjacentPoster && objectCellInFront"
      >
        {{ lang("view_object") }}
      </button>
      <button
        id="leave-chat-on-map"
        class="map-tool-pos1"
        @click="leaveChat"
        v-if="myChatGroup"
      >
        {{ lang("leave_chat") }}
      </button>
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
  CellVisibility,
} from "@/@types/types"

import RoomMobile from "./RoomMobile.vue"

import Map from "./Map.vue"
import MiniMap from "./MiniMap.vue"
import Poster from "./Poster.vue"
import CellInfo from "./CellInfo.vue"
import ChatLocal from "./ChatLocal.vue"
import Notification from "./Notification.vue"

import { inRange, keyBy, sortBy, showProfileKind } from "@/common/util"
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
  startChat,
} from "./room_chat_service"

import {
  showMessage as showMessage_,
  showPersonInfo as showPersonInfo_,
  showObjectInfo as showObjectInfo_,
  moveByArrow,
  cellsMag,
  initMapService,
  dblClickHandler,
  enterPoster,
  playBGM as _playBGM,
  stopBGM as _stopBGM,
  posterLooking as _posterLooking,
  personInFront as _personInFront,
  objectCellInFront as _objectCellInFront,
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
    console.log("Greeting received.", d)
  })

  socket.on("Announce", d => {
    state.announcement = d
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
    Notification,
    RoomMobile,
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

    const dark_local_storage =
      localStorage["virtual-poster:" + props.myUserId + ":config:dark_mode"]

    const state = reactive<RoomAppState>({
      socket: null as SocketIOClient.Socket | null,
      enableEncryption:
        localStorage[
          "virtual-poster:" + props.myUserId + ":config:encryption"
        ] == "1",
      avatarImages: {} as { [index: string]: string },

      enableMiniMap: !props.isMobile,

      people: {} as { [index: string]: PersonInMap },
      posters: {} as { [index: string]: PosterTyp },
      posterComments: {} as { [comment_id: string]: PosterCommentDecrypted },
      posterInputComment: "" as string | undefined,
      hallMap: [] as Cell[][],

      cellVisibility: [] as CellVisibility[][],

      cols: 0,
      rows: 0,

      room: {
        name: "",
        allow_poster_assignment: false,
        move_log: false,
        minimap_visibility: "all_initial",
      },

      viewDistance: 5,

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
      message: { hide: true },
      personInfo: { hide: true },
      objectInfo: { url: "", text: "", hide: true },

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
      mapCellSize:
        parseInt(
          localStorage[
            "virtual-poster:" + props.myUserId + ":config:map_cell_size"
          ]
        ) || 48,
      hoverElementTimer: undefined,
      hoverElement: undefined,
      posterUploadProgress: undefined,
      visibleNotification: false,
      notifications: [],
      highlightUnread: {},
      highlightUnreadPoster: {},
      playingBGM: undefined,
      posterContainerWidth: 0,
      locale:
        localStorage["virtual-poster:" + props.myUserId + ":config:locale"] ||
        "ja",
    })

    document.title =
      state.locale == "ja"
        ? "バーチャルポスターセッション"
        : "Virtual poster session"

    watch(
      () => [state.locale, state.room?.name],
      () => {
        document.title =
          state.locale == "ja"
            ? (state.room?.name ? state.room?.name + " - " : "") +
              "バーチャルポスターセッション"
            : (state.room?.name ? state.room?.name + " - " : "") +
              "Virtual poster session"
      }
    )

    const lang = (key: string): string => {
      const message: {
        [key in string]: { [key in "ja" | "en"]: string }
      } = {
        start_chat: {
          ja: "会話を始める",
          en: "Start chat",
        },
        leave_chat: {
          ja: "会話から離脱",
          en: "Leave chat",
        },
        view_poster: {
          ja: "ポスターを閲覧",
          en: "View poster",
        },

        leave_poster: {
          ja: "ポスターから離脱",
          en: "Leave poster",
        },
        left_chat: {
          ja: "会話から離脱しました。",
          en: "You left the chat.",
        },
        profile: {
          ja: "プロフィール",
          en: "Profile",
        },
        view_object: {
          ja: "調べる",
          en: "Inspect",
        },
        connected: {
          ja: "接続されています",
          en: "Connected",
        },
        disconnected: {
          ja: "接続されていません",
          en: "Disconnected",
        },
        poster_list: {
          ja: "ポスター一覧",
          en: "List of posters",
        },
        mypage: {
          ja: "マイページ",
          en: "Preferences",
        },
        notification: {
          ja: "通知",
          en: "Notification",
        },
        leave_room: {
          ja: "部屋を退出",
          en: "Leave room",
        },
      }
      return message[key][state.locale]
    }

    props.axios.interceptors.request.use(config => {
      if (props.debug_token) {
        config.params = config.params || {}
        config.params["debug_as"] = props.debug_as
        config.params["debug_token"] = props.debug_token
        return config
      } else {
        return config
      }
    })

    const myself: ComputedRef<PersonInMap | undefined> = computed(
      (): PersonInMap => {
        return state.people[props.myUserId]
      }
    )

    const adjacentPoster = _adjacentPoster(props, state)

    const showMessage = showMessage_(props, state)

    const posterLooking = _posterLooking(props, state)

    const personInFront = _personInFront(props, state)

    const objectCellInFront = _objectCellInFront(props, state)

    const showPersonInfo = showPersonInfo_(props, state)

    const showObjectInfo = showObjectInfo_(props, state)

    const myChatGroup = _myChatGroup(props, state)

    const viewInfoPersonInFront = async () => {
      const p1 = personInFront.value
      if (!p1) {
        return
      }
      const p = await client.people._userId(p1.id).$get()
      console.log("viewInfoPersonInFront", p)

      showPersonInfo(p, 30 * 1000)
    }

    const viewInfoObjectInFront = async () => {
      const c = objectCellInFront.value
      if (!c) {
        return
      }
      showObjectInfo(c, 30 * 1000)
    }

    const startChatInFront = async () => {
      const p = personInFront.value
      if (myChatGroup.value || !p) {
        return
      }
      state.selectedUsers.clear()
      state.selectedUsers.add(p.id)
      const r = await startChat(props, state, props.axios)
      if (r) {
        console.log(r)
        showMessage(
          state.locale == "ja" ? "会話を開始しました" : "You started chat."
        )
      }
      const el = document.querySelector(
        "#local-chat-input"
      ) as HTMLTextAreaElement
      if (el) {
        el.focus()
      }
    }

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

    const updateSelectedPos = (
      pos: {
        x: number
        y: number
        event: MouseEvent
      } | null
    ) => {
      state.selectedPos = pos
      if (!pos) {
        state.selectedUsers?.clear()
        return
      }
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
        state.selectedUsers?.clear()
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
        updateSelectedPos(null)
        const { error } = moveByArrow(props.axios, props, state, me, key)
        if (error == "during_chat") {
          showMessage("会話中は動けません。動くためには一度退出してください。")
        }
        state.keyQueue = { key, timestamp: Date.now() }
        return true
      }
    }

    const inputSpaceKey = () => {
      if (objectCellInFront.value) {
        if (state.objectInfo.text) {
          state.objectInfo.hide = true
          state.objectInfo.text = ""
        } else {
          viewInfoObjectInFront()
            .then(() => {
              //
            })
            .catch(() => {
              //
            })
        }
      } else if (personInFront.value) {
        if (state.personInfo.person) {
          state.personInfo.hide = true
          state.personInfo.person = undefined
        } else {
          viewInfoPersonInFront()
            .then(() => {
              //
            })
            .catch(() => {
              //
            })
        }
      }
    }

    const inputEnterKey = () => {
      console.log("input Enter", adjacentPoster.value, posterLooking.value)
      if (adjacentPoster.value && !posterLooking.value) {
        enterPoster(props.axios, props, state)()
          .then(() => {
            //
          })
          .catch(() => {
            //
          })
      } else if (personInFront.value) {
        startChatInFront()
          .then(() => {
            //
          })
          .catch(() => {
            //
          })
      }
    }

    const inputEscKey = () => {
      if (posterLooking.value) {
        leavePoster()
          .then(() => {
            //
          })
          .catch(() => {
            //
          })
      }
    }

    const handleGlobalKeyDown = (ev: KeyboardEvent) => {
      if (state.inputFocused) {
        return
      }
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
        ].indexOf(ev.key) != -1
      ) {
        const key = ev.key as ArrowKey
        return inputArrowKey(key)
      } else if (ev.key == " ") {
        return inputSpaceKey()
      } else if (ev.key == "Enter") {
        return inputEnterKey()
      } else if (ev.key == "Escape") {
        return inputEscKey()
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
        } else if (
          ev.key ==
          "virtual-poster:" + props.myUserId + ":config:encryption"
        ) {
          state.enableEncryption = ev.newValue == "1"
        } else if (
          ev.key ==
          "virtual-poster:" + props.myUserId + ":config:locale"
        ) {
          state.locale =
            ev.newValue == "ja" ? "ja" : ev.newValue == "en" ? "en" : "ja"
        } else if (
          ev.key ==
          "virtual-poster:" + props.myUserId + ":config:map_cell_size"
        ) {
          const v = parseInt(ev.newValue || "0")
          state.mapCellSize = isNaN(v) ? 48 : v
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
              status: "APIError",
              socket_url: undefined,
              socket_protocol: undefined,
              public_key: undefined,
            }
          })
        if (!data.ok) {
          alert(
            (state.locale == "ja"
              ? "部屋に入れませんでした。"
              : "Could not enter the room: ") +
              (data.status == "NoAccess"
                ? state.locale == "ja"
                  ? "アクセス権がありません。"
                  : "Access not granted"
                : data.status == "NoSpace"
                ? state.locale == "ja"
                  ? "スペースがありません。"
                  : "No open space in the map"
                : data.status == "DoesNotExist"
                ? state.locale == "ja"
                  ? "部屋が見つかりません。"
                  : "Room is not found"
                : data.status == "APIError"
                ? state.locale == "ja"
                  ? "サーバーに接続できません。少し待ってページをリロードしてください。"
                  : "Cannot connect to the server. Wait and reload later."
                : "")
          )
          if (data.status != "APIError") {
            location.href = "/"
          }
          return
        }
        // let socket_url = "http://localhost:5000/"
        const socket_url = data.socket_url
        if (!socket_url) {
          alert(
            state.locale == "ja"
              ? "WebSocketの設定が見つかりません"
              : "WebSocket configuration not found"
          )
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
              props.isMobile ? 4 : state.viewDistance,
              state.cols - (props.isMobile ? 4 : state.viewDistance) - 1
            ),
            y: inRange(
              me.y,
              props.isMobile ? 6 : state.viewDistance,
              state.rows - (props.isMobile ? 6 : state.viewDistance) - 1
            ),
          }
          const max_y = Math.min(
            state.rows - 1,
            state.center.y + state.viewDistance
          )
          const max_x = Math.min(
            state.cols - 1,
            state.center.x + state.viewDistance
          )
          for (
            let y = Math.max(0, me.y - state.viewDistance);
            y <= max_y;
            y++
          ) {
            for (
              let x = Math.max(0, me.x - state.viewDistance);
              x <= max_x;
              x++
            ) {
              state.cellVisibility[y][x] = "visible"
            }
          }
          state.cellVisibility[me.y][me.x] = "visited"
          state.hidden = false
        }
      })().catch(err => {
        console.error(err)
      })
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

    const hidePersonInfo = () => {
      state.personInfo.hide = true
    }

    const hideObjectInfo = () => {
      state.objectInfo.hide = true
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

    const hoverOnCell = (p: { x: number; y: number; person?: PersonInMap }) => {
      state.cellOnHover.cell = state.hallMap[p.y][p.x]
      state.cellOnHover.person = p.person
    }

    const uploadPoster = async (file: File, poster_id: string) => {
      await doUploadPoster(props.myUserId, props.axios, state, file, poster_id)
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
      updateSelectedPos(null)
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
          .chat_groups._groupId(group_id)
          .leave.$post()
          .then(data => {
            console.log(data)
            if (data.ok) {
              if (data.leftGroup) {
                //Vue.set
                state.chatGroups[group_id] = data.leftGroup
              }
              showMessage(lang("left_chat"))
              state.encryption_possible_in_chat = !!state.privateKey
              //Vue.set
              state.people_typing[props.myUserId] = false
            } else {
              //
            }
          })
          .catch(err => {
            console.error(err)
          })
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
      if (state.comments[comment_id].read) {
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
            console.error(
              "highlightUnreadPoster undefined",
              state.highlightUnreadPoster
            )
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
      return new Promise<void>(resolve => {
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

    const setPoster = (pid: PosterId, poster: PosterTyp) => {
      state.posters[pid] = poster
    }

    const setPosterContainerWidth = (w: number) => {
      console.log("setPosterContainerWidth", w)
      state.posterContainerWidth = w
    }

    watch(
      () => state.comments,
      async (nv, ov) => {
        if (Object.values(ov).length == 0) {
          highlightUnreadComments(false)
        }
      }
    )

    const cssVars = reactive({
      "--cell_size": computed(() => {
        return "" + state.mapCellSize + "px"
      }),
    })

    const mapCalculatedProps = {
      personInFront,
      objectCellInFront,
      selectedPerson,
    }
    const mapEventHandlers = {
      personInFront,
      objectCellInFront,
    }
    const posterEventHandlers = {
      setPoster,
      uploadPoster,
      updatePosterComment,
      approachPoster,
    }
    return {
      ...toRefs(state),
      roomAppState: state,
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
      deleteComment: deleteComment(props.axios),
      deletePosterComment: deletePosterComment(props.axios),
      onInputTextChange,
      cellsMag: cellsMag(state, props.isMobile ? 4 : 5, props.isMobile ? 6 : 5),
      hideMessage,
      hidePersonInfo,
      hideObjectInfo,
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
      chatGroupOfUser: chatGroupOfUser(state),

      posterComponent,
      enterPoster: enterPoster(props.axios, props, state),
      leavePoster,
      setHoverWithDelay,
      cancelHover,
      readComment,
      readPosterComment,
      highlightUnreadComments,
      playBGM: playBGM,
      stopBGM: stopBGM,
      setPosterContainerWidth,
      startChatInFront,
      viewInfoPersonInFront,
      viewInfoObjectInFront,
      showProfileKind,
      lang,
      ...mapCalculatedProps,
      ...mapEventHandlers,
      ...posterEventHandlers,
      cssVars,
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
  position: absolute;
  padding: 0px;
  background: white;
  z-index: 100;
  left: 8px;
  width: calc(var(--cell_size) * 11);
  height: 38px;
  margin: 0px;
  /* background: #ccc; */
}

.dark #header {
  background: black;
}

#page-title-info {
  display: inline-block;
  width: calc(var(--cell_size) * 11 - 188px);
  height: 30px;
  overflow: hidden;
  font-size: 13px;
  margin: 2px 0px 0px 7px;
  line-height: 1.2em;
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
  top: calc(var(--cell_size) * 11 + 52px);
  width: calc(var(--cell_size) * 11);
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
  top: calc(var(--cell_size) * 5 + 53px);
  transition: top 0.5s 0.5s;
}

#announce a {
  color: inherit;
}

button#leave-chat-on-map {
  width: 120px;
}

button#start-chat-on-map {
  width: 120px;
}

button#view-info-person-on-map {
  width: 120px;
}

button#view-info-person-on-map.poster-adjacent {
  right: calc(var(--cell_size) * 12 / 48 + 130px);
  top: 60px;
}

button#view-info-object-on-map {
  width: 120px;
}

button.map-tool-pos1 {
  position: absolute;
  width: 150px;
  height: 26px;
  right: calc(var(--cell_size) * 12 / 48);
  top: 60px;
}

button.map-tool-pos2 {
  position: absolute;
  width: 150px;
  height: 26px;
  right: calc(var(--cell_size) * 12 / 48);
  top: 90px;
}

div#poster-preview {
  position: absolute;
  padding: 8px;
  width: 180px;
  /* height: 100px; */
  right: calc(var(--cell_size) * 12 / 48);
  top: 120px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.6);
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
  left: calc(var(--cell_size) * 11 - 188px);
  font-weight: bold;
  font-size: 10px;
}

#connection-status {
  position: absolute;
  top: 35px;
  left: calc(var(--cell_size) * 11 - 78px);
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
  top: calc(50px + var(--cell_size) * 11 - 78px);
  left: calc(var(--cell_size) * 0.5 + 8px);
  width: calc(var(--cell_size) * 10);
  height: 60px;
  font-size: 12px;
  padding: 8px;
  background: rgba(234, 252, 243, 0.7);
  box-shadow: 2px 2px 2px #8c8;
  /* animation: opacity 1s linear; */
  z-index: 100;
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

#person-info {
  position: absolute;
  word-break: break-all;
  top: calc(50px + var(--cell_size) * 11 - 178px);
  left: calc(var(--cell_size) * 0.5 + 8px);
  width: calc(var(--cell_size) * 10);
  height: 160px;
  font-size: 12px;
  padding: 8px;
  background: rgba(200, 200, 255, 0.9);
  box-shadow: 2px 2px 2px #8c8;
  z-index: 100;
  /* animation: opacity 1s linear; */
}

#person-info-close {
  border: 1px solid black;
  font-size: 14px !important ;
  font-weight: bold !important;
  float: right;
  cursor: pointer;
}

#person-info.hide {
  display: none;
}

#object-info {
  position: absolute;
  word-break: break-all;
  top: calc(50px + var(--cell_size) * 11 - 178px);
  left: calc(var(--cell_size) * 0.5 + 8px);
  width: calc(var(--cell_size) * 10);
  height: 160px;
  font-size: 12px;
  padding: 8px;
  background: rgba(200, 200, 255, 0.9);
  box-shadow: 2px 2px 2px #8c8;
  z-index: 100;
}

#object-info-close {
  border: 1px solid black;
  font-size: 14px !important ;
  font-weight: bold !important;
  float: right;
  cursor: pointer;
}

#object-info.hide {
  display: none;
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

#tools-on-map {
  position: absolute;
  top: 0px;
  left: calc(var(--cell_size) * 11);
  width: 0px;
  height: calc(200px);
  z-index: 10;
}

#tools-on-map > * {
  z-index: 100;
}

.with-tool-tip .tooltip {
  position: absolute;
  display: none;
  background: black;
  border-radius: 5px;
  padding: 5px;
  color: white;
  z-index: 300;
}

.with-tool-tip.right .tooltip {
  position: absolute;
  right: 0px;
  display: none;
  background: black;
  border-radius: 5px;
  padding: 5px;
  color: white;
  z-index: 300;
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
