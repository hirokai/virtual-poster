<template>
  <div id="app-main" v-cloak>
    <div id="header">
      <span v-if="!!myself">
        {{ myself ? myself.name : "" }}さん
        <span id="login-info">({{ myUserId }})</span>
      </span>

      <img
        class="toolbar-icon"
        @click="signOut"
        src="/img/logout.png"
        width="25px"
        height="25px"
      />

      <a
        class="icon-link"
        :href="
          '/mypage?room=' +
            room_id +
            (debug_as
              ? '&debug_as=' + debug_as + '&debug_token=' + debug_token
              : '')
        "
        target="_blank"
      >
        <img width="25px" height="25px" src="/img/user.png" alt="マイページ" />
      </a>
      <a
        class="icon-link"
        :href="'/poster_list?room_id=' + room_id"
        target="_blank"
      >
        <img
          width="25px"
          height="25px"
          src="/img/promotion.png"
          alt="ポスターリスト"
        />
      </a>
      <img
        class="toolbar-icon"
        :class="{ disabled: !enableMiniMap }"
        @click="enableMiniMap = !enableMiniMap"
        src="/img/globe.png"
        alt="マップのON/OFF"
        width="25px"
        height="25px"
      />
      <img
        v-if="bot_mode"
        class="toolbar-icon"
        :class="{ disabled: !enableMiniMap }"
        @click="toggleBot"
        src="/img/user.png"
        width="25px"
        height="25px"
      />
      <div style="clear:both;"></div>
    </div>
    <div
      id="announce"
      :class="{ marquee: announcement && announcement.marquee }"
    >
      <div
        class="marquee-inner"
        :style="{
          'animation-duration': (announcement ? announcement.period : 20) + 's',
        }"
        v-html="announcement ? announcement.text : ''"
      ></div>
    </div>
    <CellInfo :cell="selected" :person="selectedPerson" />
    <Map
      v-if="!botActive"
      v-show="!!myself"
      :myself="myself"
      :hidden="hidden"
      :people="people"
      :posters="posters"
      :cells="cellsMag"
      :center="center"
      :myChatGroup="myChatGroup"
      :chatGroups="chatGroups"
      :chatGroupOfUser="chatGroupOfUser"
      :selectedPos="selectedPos"
      :selectedUsers="selectedUsers"
      :people_typing="people_typing"
      :avatarImages="avatarImages"
      @select="updateSelectedPos"
      @dblClick="dblClick"
      @uploadPoster="uploadPoster"
      @inputArrowKey="inputArrowKey"
    />
    <MiniMap
      v-if="enableMiniMap && !botActive"
      v-show="!activePoster"
      :hidden="hidden"
      :cells="hallMap"
      :center="center"
      :people="people"
      :chatGroups="chatGroups"
      :avatarImages="avatarImages"
      :people_typing="people_typing"
      :selectedPos="selectedPos"
      @select="updateSelectedPos"
      @dblClick="dblClick"
    />
    <ChatLocal
      ref="chatLocal"
      :inputTextFromParent="''"
      :myself="myself"
      :contentHidden="hidden"
      :comments="comments"
      :people="people"
      :editingOld="editingOld"
      :chatGroup="myChatGroup ? chatGroups[myChatGroup].users : []"
      :inputFocused="inputFocused"
      :poster="botActive ? null : activePoster"
      :people_typing="people_typing"
      :enableEncryption="enableEncryption"
      :encryptionPossibleInChat="encryption_possible_in_chat"
      @leave-chat="leaveChat"
      @submit-comment="submitComment"
      @update-comment="sendOrUpdateComment"
      @delete-comment="deleteComment"
      @set-editing-old="setEditingOld"
      @onInputTextChange="onInputTextChange"
      @on-focus-input="onFocusInput"
      @set-encryption="setEncryption"
    />
    <Poster
      v-if="!botActive"
      ref="posterComponent"
      :myself="myself"
      :poster="activePoster"
      :comments="posterComments"
      :people="people"
      :editingOld="editingOld"
      :posterChatGroup="posterChatGroup"
      :inputFromParent="posterInputComment"
      @submit-poster-comment="submitPosterComment"
      @update-poster-comment="updatePosterComment"
      @delete-comment="deleteComment"
      @set-editing-old="setEditingOld"
      v-show="activePoster"
    />
    <button
      id="leave-chat-on-map"
      @click="leaveChat"
      :disabled="!myChatGroup"
      v-show="myChatGroup"
    >
      会話から離脱
    </button>
    <div id="message" :class="{ hide: message.hide }">
      <div id="message-close" @click="hideMessage">&times;</div>
      {{ message.text }}
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue"
import {
  defineComponent,
  reactive,
  onMounted,
  watch,
  ref,
  toRefs,
  computed,
  PropType,
  ComputedRef,
} from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)
import {
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
  SocketMessageFromUser,
  HttpMethod,
} from "../@types/types"

import Map from "./room/Map.vue"
import MiniMap from "./room/MiniMap.vue"
import Poster from "./room/Poster.vue"
import CellInfo from "./room/CellInfo.vue"
import ChatLocal from "./room/ChatLocal.vue"
import { inRange, getClosestAdjacentPoints, isAdjacent } from "../common/util"

import axiosDefault, { AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "../api/$api"

import io from "socket.io-client"
import { keyBy } from "../common/util"
import * as firebase from "firebase/app"
import "firebase/auth"
import * as encryption from "./encryption"
import jsSHA from "jssha"
import Peer from "skyway-js"
import { MeshRoom, SfuRoom } from "skyway-js"

import { initPeopleService } from "./room_people_service"

import {
  doSendOrUpdateComment,
  deleteComment,
  initChatService,
  startChat,
  chatGroupOfUser,
  inviteToChat,
  myChatGroup as _myChatGroup,
} from "./room_chat_service"

import {
  moveTo,
  personAt,
  posterAt,
  moveByArrow,
  cellsMag,
  initMapService,
} from "./room_map_service"

import {
  updatePosterComment,
  doSubmitPosterComment,
  activePoster as _activePoster,
  doUploadPoster,
  adjacentPosters,
  initPosterService,
} from "./room_poster_service"

import { addLatencyLog } from "./room_log_service"

import { deleteUserInfoOnLogout } from "./util"

class MySocketObject {
  listeners: Record<string, ((data: any) => void)[]> = {}
  ws: WebSocket

  constructor(url: string) {
    this.ws = this.connect(url)
    this.ws.onmessage = d => {
      const dat = JSON.parse(d.data)
      console.log("WebSocket received: ", dat)
      const msg = dat.type
      for (const listener of this.listeners[msg] || []) {
        listener(dat)
      }
    }
    this.ws.onopen = () => {
      this.listeners["connected"][0](null)
    }
  }
  on(message: string, handler: (data: any) => void) {
    if (!this.listeners[message]) {
      this.listeners[message] = []
    }
    this.listeners[message].push(handler)
  }
  emit(message: SocketMessageFromUser, data: any) {
    if (message == "Move") {
      this.ws.send(JSON.stringify({ Move: data }))
    } else if (message == "Active") {
      this.ws.send(JSON.stringify({ Active: data }))
    } else if (message == "Subscribe") {
      this.ws.send(
        JSON.stringify({
          Subscribe: { channel: data.channel, token: data.token },
        })
      )
    }
  }
  connect(url: string): WebSocket {
    console.log("Connecting WS: ", url)
    var ws = new WebSocket(url)
    ws.onopen = () => {
      console.log("WebSocket server connected")
    }

    ws.onclose = ev => {
      console.log(
        "Socket is closed. Reconnect will be attempted in 5 seconds.",
        ev.reason
      )
      setTimeout(() => {
        this.connect(url)
      }, 5000)
    }

    ws.onerror = err => {
      console.error("Socket encountered error: ", err, "Closing socket")
      ws.close()
    }
    return ws
  }
}

const ArrowKeyInterval = 200

export default defineComponent({
  components: {
    Map,
    MiniMap,
    Poster,
    CellInfo,
    ChatLocal,
  },

  /*
  editingOldPoster: string | null = null
  talking = false
*/

  /*
  @Prop() public idToken!: string
  @Prop() public axios!: AxiosStatic | AxiosInstance
*/
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
  },
  setup(props, context) {
    const axios = props.axios
    const client = api(axiosClient(axios))
    axios.interceptors.request.use(request => {
      request["ts"] = performance.now()
      return request
    })

    let REPORT_LATENCY = false

    axios.interceptors.response.use(response => {
      const latency = Math.round(
        Number(performance.now() - response.config["ts"])
      )
      const url = response.request.responseURL
      console.log()
      if (url.indexOf("/latency_report") == -1 && REPORT_LATENCY) {
        addLatencyLog(axios, {
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

    console.log(props)
    // axios.defaults.headers.common = {
    //   Authorization: `Bearer ${props.idToken}`,
    // }

    if (!process.env.VUE_APP_SKYWAY_API_KEY) {
      console.warn("Skyway API key not set.")
    }

    const state = reactive<RoomAppState>({
      socket: null as SocketIO.Socket | null,
      peer: null,
      skywayRoom: null,
      enableEncryption: false,
      avatarImages: {} as { [index: string]: string },

      enableMiniMap: true,

      people: {} as { [index: string]: PersonInMap },
      posters: {} as { [index: string]: PosterTyp },
      posterComments: {} as { [comment_id: string]: ChatCommentDecrypted },
      posterInputComment: "" as string | undefined,
      hallMap: [] as Cell[][],
      cols: 0,
      rows: 0,
      keyQueue: null as { key: ArrowKey; timestamp: number } | null,

      center: { x: 5, y: 5 },

      comments: {} as { [index: string]: ChatCommentDecrypted },
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

      selectedUsers: new Set<UserId>(),
      selectedPos: null as { x: number; y: number } | null,
      chatAfterMove: null as UserId | PosterId | null,

      editingOld: null as string | null,

      connectedUsers: [] as string[],

      announcement: null as {
        text: string
        marquee: boolean
        period: number
      } | null,

      move_emitted: null as number | null,
      batchMovePoints: [] as Point[],
      batchMoveTimer: null as NodeJS.Timeout | null,
      liveMapChangedAfterMove: false,

      people_typing: {} as { [index: string]: boolean },

      encryption_possible_in_chat: true,

      privateKeyString: null as string | null,
      privateKey: null as CryptoKey | null,
      publicKeyString: null as string | null,
      publicKey: null as CryptoKey | null,
    })
    axios.interceptors.request.use(config => {
      if (props.debug_as) {
        config.params = config.params || {}
        config.params["debug_as"] = props.debug_as
        config.params["debug_token"] = props.debug_token
        return config
      } else {
        return config
      }
    })
    axios.interceptors.response.use(
      response => {
        return response
      },
      error => {
        if (403 === error.response.status) {
          ;(async () => {
            const user = firebase.auth().currentUser
            if (user) {
              const token = await user.getIdToken(true)
              const data = await client.id_token.$post({ body: { token } })

              if (data.updated) {
                console.log("/id_token result", data)
                const shaObj = new jsSHA("SHA-256", "TEXT", {
                  encoding: "UTF8",
                })
                shaObj.update(token)
                const jwt_hash = shaObj.getHash("HEX")
                localStorage["virtual-poster:jwt_hash"] = jwt_hash
              }
            }
          })().catch(err => {
            //
          })
        }
      }
    )

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

    const activePoster = _activePoster(props, state)

    const showMessage = (msg: string, timeout = 5000) => {
      Vue.set(state.message, "text", msg)
      Vue.set(state.message, "hide", false)
      state.message.hide = false
      if (state.message.timer) {
        window.clearTimeout(state.message.timer)
        Vue.set(state.message, "timer", undefined)
      }
      if (timeout > 0) {
        Vue.set(
          state.message,
          "timer",
          window.setTimeout(() => {
            if (state.message) {
              Vue.set(state.message, "hide", true)
              Vue.set(state.message, "text", "")
            }
          }, timeout)
        )
      }
    }

    watch(
      () => activePoster.value,
      (poster: PosterTyp | undefined) => {
        if (poster) {
          client.posters
            ._posterId(poster.id)
            .comments.$get()
            .then(data => {
              state.posterComments = keyBy(data, "id")
            })
            .catch(err => console.error(err))
        }
      }
    )

    const posterComponent = ref<typeof Poster>()

    const clearInput = () => {
      console.log("clearInput")
      context.emit("clear-chat-input")
    }

    const setupSocketHandlers = (socket: SocketIO.Socket | MySocketObject) => {
      console.log("Setting up socket handlers")
      socket.on("connection", () => {
        console.log("Socket connected")
        socket.emit("Active", {
          room: props.room_id,
          user: props.myUserId,
          token: props.jwt_hash_initial,
        })
        socket.emit("Subscribe", {
          channel: props.room_id,
          token: props.jwt_hash_initial,
        })
      })
      socket.on("auth_error", () => {
        console.log("socket auth_error")
      })

      socket.on("greeting", () => {
        console.log("Greeting received.")
        socket.emit("Active", { room: props.room_id, user: props.myUserId })
      })

      socket.on("announce", d => {
        console.log("socket announce", d)
        state.announcement = d
      })

      socket.on("map.reset", () => {
        console.log("map.reset not implemented")
        // reloadData()
      })
      socket.on("app.reload", () => {
        if (
          confirm(
            "アプリケーションが更新されました。リロードしても良いですか？"
          )
        ) {
          location.reload()
        }
      })
      socket.on("app.reload.silent", () => {
        location.reload()
      })
    }

    const sendOrUpdateComment = async (
      text: string,
      encrypting: boolean,
      to_users: UserId[],
      updating = false
    ) => {
      const { ok } = await doSendOrUpdateComment(
        axios,
        state.skywayRoom,
        props.room_id,
        text,
        encrypting,
        to_users,
        state.privateKey,
        state.people,
        updating ? state.editingOld || undefined : undefined,
        myChatGroup.value || undefined
      )
      if (ok) {
        ;(document.querySelector("#local-chat-input") as any)?.focus()
        clearInput()
        state.editingOld = null
      }
    }

    const myChatGroup = _myChatGroup(props, state)

    const submitComment = async (text: string) => {
      console.log("submitComment", text)
      if (state.editingOld) {
        await sendOrUpdateComment(
          text,
          state.enableEncryption,
          state.comments[state.editingOld].texts.map(t => t.to),
          true
        )
      } else {
        if (!myChatGroup.value) {
          return
        }
        const to_users = state.chatGroups[myChatGroup.value].users
        await sendOrUpdateComment(text, state.enableEncryption, to_users)
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
        const { error } = moveByArrow(axios, props, state, me, key)
        if (error == "during_chat") {
          showMessage("会話中は動けません。動くためには一度退出してください。")
        }
        state.keyQueue = { key, timestamp: Date.now() }
        return true
      }
    }
    const handleGlobalKeyDown = (ev: KeyboardEvent) => {
      if (
        ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"].indexOf(ev.key) !=
          -1 &&
        !state.inputFocused
      ) {
        const key = ev.key as ArrowKey
        return inputArrowKey(key)
      } else {
        return false
      }
    }

    const submitPosterComment = (t: string) => {
      doSubmitPosterComment(axios, props, state, t)
    }

    onMounted(() => {
      console.log("onMounted")
      window.addEventListener("keydown", ev => {
        // console.log(ev);
        if (document.activeElement?.tagName.toLowerCase() === "textarea") {
          if (ev.key == "Enter" && ev.shiftKey) {
            if (state.composing) {
              state.composing = false
            } else {
              const t: HTMLTextAreaElement = ev.target as HTMLTextAreaElement
              if (t?.id == "local-chat-input") {
                submitComment(t.value)
                  .then(() => {
                    //
                  })
                  .catch(() => {
                    //
                  })
                // Vue.nextTick(() => {
                //   console.log('nextTick')
                //   app.clearInput()
              } else if (t?.id == "poster-chat-input") {
                doSubmitPosterComment(axios, props, state, t.value)
              }
            }
            ev.preventDefault()

            return true
          }
        }
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
          .catch(() => null)
        console.log("enter result", data)
        if (!data || !data.ok) {
          alert("部屋に入れませんでした")
          location.href = "/"
          return
        }
        // let socket_url = "http://localhost:5000/"
        let socket_url = data.socket_url
        if (!socket_url) {
          alert("WebSocketの設定が見つかりません")
          location.href = "/"
          return
        }
        console.log("Socket URL: " + socket_url)
        if (data.socket_protocol == "Socket.IO") {
          state.socket = io(socket_url)
        } else if (data.socket_protocol == "WebSocket") {
          state.socket = new MySocketObject(socket_url)
        } else {
          console.error("Socket protocol not supported")
        }
        if (!state.socket) {
          console.error("Failed to make a socket.")
          return
        }

        setupSocketHandlers(state.socket)
        // We have to get public keys of users first.
        await initPeopleService(axios, state.socket, props, state)
        // Then chat comments, map data, poster data.
        await Promise.all([
          initMapService(axios, state.socket, props, state),
          initChatService(
            axios,
            state.socket,
            props,
            state,
            activePoster,
            data?.public_key
          ),
          initPosterService(axios, state.socket, props, state, activePoster),
        ])
        const other_users_encryptions = myChatGroup.value
          ? state.chatGroups[myChatGroup.value!].users
              .map(u => !!state.people[u]?.public_key)
              .every(a => a)
          : true

        state.encryption_possible_in_chat =
          !!state.privateKey && other_users_encryptions

        state.hidden = false

        const me = myself.value
        if (me && me.x && me.y) {
          state.center = {
            x: inRange(me.x, 5, state.cols - 6),
            y: inRange(me.y, 5, state.rows - 6),
          }
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

    const signOut = () => {
      if (!confirm("ログアウトしますか？")) {
        return
      }
      deleteUserInfoOnLogout()
      firebase
        .auth()
        .signOut()
        .then(() => {
          console.log("Firebase signed out")
          client.logout
            .$post()
            .then(() => {
              console.log("App signed out")
              location.href = "/login"
            })
            .catch(err => {
              console.error(err)
            })
        })
        .catch(err => {
          console.error(err)
        })
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
        debug_as: props.debug_as,
      }
      if (!state.people_typing[props.myUserId]) {
        state.socket?.emit("ChatTyping", d)
        window.setTimeout(() => {
          const d2: TypingSocketSendData = {
            user: me.id,
            room: props.room_id,
            typing: false,
            debug_as: props.debug_as,
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

    const hideMessage = () => {
      state.message.hide = true
    }

    const dblClick = async (p: Point) => {
      const me = myself.value
      if (!me) {
        return
      }
      const poster = posterAt(state.posters, p)
      const person = poster ? undefined : personAt(state.people, p)
      if (myChatGroup.value) {
        if (person && isAdjacent(me, person)) {
          inviteToChat(axios, props, state, person)
            .then(group => {
              if (group) {
                showMessage(
                  "会話に加わりました。参加者：" +
                    group.users.map(u => state.people[u].name).join(",")
                )
                state.selectedUsers.clear()
              }
            })
            .catch(err => {
              console.error(err)
            })
        } else {
          showMessage(
            "会話中は動けません。動くためには会話を終了してください。"
          )
        }
        return
      }
      const poster_location = state.hallMap[p.y][p.x].poster_number

      console.log("dblCliked", person, poster, poster_location)

      if (state.people_typing[props.myUserId]) {
        const d: TypingSocketSendData = {
          user: me.id,
          room: props.room_id,
          typing: false,
          token: props.jwt_hash_initial,
          debug_as: props.debug_as,
        }
        state.socket?.emit("ChatTyping", d)
      }

      if (!poster && poster_location != undefined) {
        const r = confirm("このポスター板を確保しますか？")
        if (!r) {
          return
        }
        const data = await client.maps
          ._roomId(props.room_id)
          .take_slot._posterLocation(poster_location)
        console.log("take poster result", data)
      }

      if (person || poster) {
        if (Math.abs(p.x - me.x) <= 1 && Math.abs(p.y - me.y) <= 1) {
          if (person) {
            state.selectedUsers.add(person.id)
            startChat(props, state, axios)
              .then(d => {
                if (d) {
                  const group = d.group
                  state.encryption_possible_in_chat =
                    !!state.privateKey && d.encryption_possible
                  state.selectedUsers.clear()
                }
                //
              })
              .catch(() => {
                //
              })
          } else if (poster) {
            state.selectedUsers.clear()
          }
        } else {
          const dps = getClosestAdjacentPoints({ x: me.x, y: me.y }, p)
          state.chatAfterMove = person ? person.id : poster ? poster.id : null
          // Try to move to an adjacent open until it succeeds.
          for (const p1 of dps) {
            const r = moveTo(
              axios,
              props,
              state,
              me,
              p1,
              group => {
                if (group) {
                  showMessage(
                    "会話に加わりました。参加者：" +
                      group.users.map(u => state.people[u].name).join(",")
                  )
                }
              },
              person?.id
            )
            if (r) {
              break
            }
          }
        }
      } else {
        state.selectedUsers.clear()
        moveTo(axios, props, state, me, p)
      }
    }

    const selected = computed((): Cell | undefined => {
      return state.selectedPos &&
        state.hallMap &&
        state.hallMap[state.selectedPos.y]
        ? state.hallMap[state.selectedPos.y][state.selectedPos.x]
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

    const uploadPoster = (file: File, poster_id: string) => {
      doUploadPoster(axios, file, poster_id)
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
        moveByArrow(axios, props, state, me, dir)
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
                Vue.set(state.chatGroups, group_id, data.leftGroup)
              }
              showMessage("会話から離脱しました。")
              state.encryption_possible_in_chat = !!state.privateKey
              Vue.set(state.people_typing, props.myUserId, false)
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

    const selectedPerson = computed((): PersonInMap | undefined => {
      const pos = state.selectedPos
      if (!pos) {
        return undefined
      } else {
        for (const uid of state.selectedUsers) {
          if (state.people[uid].x == pos.x && state.people[uid].y == pos.y) {
            return state.people[uid]
          }
        }
        return undefined
      }
    })

    return {
      ...toRefs(state),
      signOut,
      setEncryption,
      adjacentPosters,
      leaveChat,
      uploadPoster,
      deleteComment: deleteComment(axios),
      onInputTextChange,
      cellsMag: cellsMag(state),
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
      activePoster,
      myself,
      updatePosterComment,
      chatGroupOfUser: chatGroupOfUser(state),
      selectedPerson,
      posterComponent,
    }
  },
})
</script>

<style>
@font-face {
  font-family: "PixelMplus";
  src: url(/PixelMplus12-Regular.ttf);
}

/* @import url("cell.css"); */

body {
  font-family: "YuGothic", Loto, sans-serif;
  min-width: 1220px;
}

#header {
  width: 528px;
  height: 40px;
  /* background: #ccc; */
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

.user-select {
  margin: 0px 10px;
}

.comment-entry {
  line-height: 1em;
  word-break: break-all;
}

.comment-name {
  font-size: 11px;
  color: #1d1c1d;
  font-weight: 900;
}

.comment-time {
  font-size: 10px;
  color: #616061;
}

.comment-recipients {
  font-size: 11px;
  color: #1d1c1d;
}

.comment-content {
  font-size: 12px;
  color: #1d1c1d;
  line-height: 1.3em;
}

svg#cells {
  position: absolute;
  left: 8px;
  top: 50px;
  height: 528px;
  width: 528px;
  user-select: none;
  transition: opacity 0.5s linear;
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
  float: right;
  margin: 4px 5px 0px 5px;
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
</style>
