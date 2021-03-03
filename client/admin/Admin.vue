<template>
  <div id="app" v-cloak>
    <div>
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
    </div>
    <div id="tabs">
      <div v-if="tab == 'announce'">
        <h1>アナウンス</h1>
        <select name="" id="" v-model="announceRoom">
          <option value="">部屋を選択</option>
          <option :value="room.id" v-for="room in rooms" :key="room.id">
            {{ room.name }}
          </option>
          <option value="">----</option>
          <option value="__all__">すべての部屋</option>
        </select>
        <div>
          <small>※HTMLも送信可能（危険なリンクなどを送らないように注意）</small>
        </div>
        <textarea cols="60" rows="2" id="announce-input" ref="announceText" />
        <button @click="submitAnnouncement" :disabled="announceRoom == ''">
          送信
        </button>
        <div>
          <label for="marquee">文字を流す</label>
          <input type="checkbox" id="marquee" v-model="announceMarquee" /><br />
          <label for="marquee-period" :disabled="!announceMarquee"
            >周期 [秒]</label
          >
          <input
            type="number"
            max="60"
            min="3"
            id="marquee-period"
            :disabled="!announceMarquee"
            v-model="announceMarqueePeriod"
          />
        </div>
        <div>
          <button
            @click="askReload({ room_id: announceRoom, force: false })"
            :disabled="announceRoom == ''"
          >
            会場の参加者にリロードを依頼
          </button>
        </div>
        <div>
          <button
            @click="askReload({ room_id: announceRoom, force: true })"
            :disabled="announceRoom == ''"
          >
            会場の参加者を強制的にリロード
          </button>
        </div>
      </div>
      <ManageRooms
        v-if="tab == 'rooms'"
        :locale="locale"
        :admin_page="true"
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
      <ManageUsers
        class="tab-content"
        v-if="tab == 'people'"
        :locale="locale"
        :axios="axios"
        :idToken="idToken"
        :people="people"
        :rooms="rooms"
        :debug_token="debug_token"
        @loadData="reload"
      />
      <div v-if="tab == 'socket'" class="tab-content">
        <h1>通信ログ</h1>
        <div id="socket-history">
          <div v-for="e in socketHistory" :key="e.time_since_start">
            <span>{{ e.timestamp }}</span>
            <span>{{ e.msg }}</span>
            <span>{{ e.data }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import axios from "axios"
import {
  Person,
  PersonWithEmail,
  UserId,
  RoomId,
  ActiveUsersSocketData,
  Announcement,
  AppEvent,
  Room,
  PersonUpdate,
  RoomUpdateSocketData,
} from "@/@types/types"

import { decodeMoved } from "@/common/util"
import { AxiosInstance } from "axios"

import {
  defineComponent,
  reactive,
  onMounted,
  watch,
  toRefs,
  ref,
  PropType,
} from "vue"

import ManageRooms from "./ManageRooms.vue"
import ManageUsers from "./ManageUsers.vue"

import {
  createAccessCode,
  deleteAccessCode,
  reloadRoomMetadata,
  renewAccessCode,
} from "./admin_room_service"

import { keyBy } from "@/common/util"
const API_ROOT = "/api"
axios.defaults.baseURL = API_ROOT

import axiosClient from "@aspida/axios"
import api from "@/api/$api"

const url = new URL(location.href)
const tab = url.hash.slice(1) || "people"
location.hash = "#" + tab

import { deleteUserInfoOnLogout } from "../util"

export default defineComponent({
  components: {
    ManageRooms,
    ManageUsers,
  },
  props: {
    socket: {
      type: Object as PropType<SocketIOClient.Socket>,
      required: true,
    },
  },
  setup(props) {
    const client = api(axiosClient(axios))

    const myUserId: string | undefined = localStorage["virtual-poster:user_id"]
    if (!myUserId) {
      location.href = "/login"
    }

    const state = reactive({
      jwt_hash: "",
      tab: tab.split("/")[0] as string | undefined,
      tab_sub: tab.split("/")[1] as string | undefined,
      tab_sub_sub: tab.split("/")[2] as string | undefined,
      lastUpdated: null as number | null,
      people: {} as { [index: string]: PersonWithEmail },
      inputText: "",
      rooms: {} as { [room_id: string]: Room },
      loggedIn: false,
      myUserId,
      idToken: null as string | null,
      user: {} as { name?: string; user_id?: string; email?: string },
      axios: axios as AxiosInstance,
      announceMarquee: false,
      announceMarqueePeriod: 20,
      debug_token: "",
      socketHistory: [] as {
        msg: string
        data: any
        time_since_start: number
        timestamp: number
      }[],
      tabs: [
        { id: "rooms", name: "会場" },
        { id: "people", name: "メンバー" },
        { id: "announce", name: "アナウンス" },
        { id: "socket", name: "通信" },
      ] as { id: string; name: string }[],
      announceRoom: "" as RoomId,
      locale: (localStorage[`virtual-poster:${myUserId}:config:locale`] ||
        "ja") as "ja" | "en",
    })

    const announceText = ref<HTMLInputElement>()

    const doSubmitAnnouncement = (d: Announcement) => {
      props.socket.emit("make_announcement", d)
    }

    const submitAnnouncement = () => {
      const room = state.announceRoom
      const text = announceText.value?.value
      if (!room || !text) {
        console.error("Announce data invalid")
        return
      }
      const d = {
        room,
        marquee: state.announceMarquee,
        text,
        period: state.announceMarqueePeriod,
      }
      console.log("submitAnnouncement", d)
      doSubmitAnnouncement(d)
    }

    const askReload = (d: { room_id: RoomId; force: boolean }) => {
      props.socket.emit("AskReload", d)
    }

    const on_socket_move = (s: string) => {
      const pos = decodeMoved(s)
      console.log("socket moved", pos)
      // this.$set(this.people[uid], "x", x)
      // this.$set(this.people[uid], "y", y)
      // this.$set(this.people[uid], "direction", direction)
    }

    const updatePerson = (d: PersonUpdate) => {
      console.log("updatePerson", d)
      const p = state.people[d.id]
      if (!p) {
        console.warn("User not found (probably new user)")
        return
      }
      const person: PersonWithEmail = {
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

    const on_socket = (msg: AppEvent, data: any) => {
      // console.log("socket", msg, data)
      state.socketHistory.push({
        msg,
        data,
        time_since_start: window.performance.now(),
        timestamp: Date.now(),
      })
      if (msg == "PersonUpdate") {
        const ps = data as PersonUpdate[]
        for (const p of ps) {
          updatePerson(p)
        }
      } else if (msg == "ActiveUsers") {
        const ds = data as ActiveUsersSocketData
        for (const d of ds.users) {
          const person: Person = {
            ...state.people[d.user],
            connected: d.active,
          }
          state.people[d.user] = {
            ...person,
            email: state.people[d.user].email,
          }
        }
      } else if (msg == "Room") {
        const d = data as RoomUpdateSocketData
        console.log("socket", msg, d)
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
        if (d.num_people_with_access != undefined) {
          room.num_people_with_access = d.num_people_with_access
        }
        if (d.num_people_active != undefined) {
          room.num_people_active = d.num_people_active
        }
      }
    }

    const signOut = async () => {
      const r = await client.logout.$post()
      if (r.ok) {
        console.log("Signed out")
        deleteUserInfoOnLogout()
        location.href = "/login"
      } else {
        console.log("Did not sign out")
      }
    }

    const reloadRooms = async () => {
      state.rooms = keyBy(await client.maps.$get(), "id")
    }

    const reload = async () => {
      state.lastUpdated = Date.now()
      const data_r = await client.maps.$get()
      state.rooms = keyBy(data_r, "id")
      const data_p = (await client.people.$get({
        query: { email: true },
      })) as PersonWithEmail[]
      state.people = keyBy(data_p, "id")
      // console.log(state.people)
      const jwt_hash: string | undefined =
        localStorage["virtual-poster:jwt_hash"]
      if (jwt_hash) {
        props.socket.emit("Active", {
          user: state.myUserId,
          room: "::admin",
          token: jwt_hash,
          observe_only: true,
        })
        for (const room of Object.keys(state.rooms)) {
          props.socket.emit("Active", {
            user: state.myUserId,
            room,
            token: jwt_hash,
            observe_only: true,
          })
        }
      }
    }
    watch(
      () => state.tab,
      (newTab: string | undefined) => {
        if (newTab) {
          location.hash = newTab
        }
      }
    )

    onMounted(async () => {
      window.onhashchange = () => {
        console.log("hash changed")
        const hash = location.hash.slice(1)
        state.tab = hash.split("/")[0]
        state.tab_sub = hash.split("/")[1]
        state.tab_sub_sub = hash.split("/")[2]
      }
      for (const k of [
        "Announce",
        "Room",
        "Person",
        "PersonNew",
        "PersonUpdate",
        "PersonRemove",
        "AuthError",
        "Moved",
        "MoveError",
        "Group",
        "GroupRemove",
        "Comment",
        "CommentRemove",
        "ChatEvent",
        "PosterComment",
        "PosterCommentRemove",
        "PosterReset",
        "Poster",
        "PosterRemove",
        "MapReset",
        "ActiveUsers",
        "ChatTyping",
        "MoveRequest",
        "AppReload",
      ]) {
        props.socket.on(k, d => {
          on_socket(k as AppEvent, d)
        })
      }

      const user = {
        name: localStorage["virtual-poster:name"],
        user_id: localStorage["virtual-poster:user_id"],
        email: localStorage["virtual-poster:email"],
      }
      state.user = user
      const data2 = await client.debug_token.$get()
      state.debug_token = data2.debug_token
      state.myUserId = user.user_id || null
      await reload()
      state.loggedIn = !!user
    })

    const changeRoom = (room_id: RoomId | null) => {
      if (!room_id) {
        location.href = "#rooms"
        state.tab_sub = undefined
      } else {
        location.href = "#rooms/" + room_id
        state.tab_sub = room_id
      }
    }

    const deleteRoom = (room_id: RoomId) => {
      delete state.rooms[room_id]
    }

    return {
      API_ROOT,
      ...toRefs(state),
      reload,
      signOut,
      submitAnnouncement,
      doSubmitAnnouncement,
      announceText,
      askReload,
      changeRoom,
      createAccessCode: createAccessCode(state),
      renewAccessCode: renewAccessCode(state),
      deleteAccessCode: deleteAccessCode(state),
      reloadRoomMetadata: reloadRoomMetadata(state),
      reloadRooms,
      deleteRoom,
    }
  },
})
</script>
<style lang="css">
[v-cloak] {
  display: none;
}
h1 {
  font-size: 20px;
}
/* 
h2 {
  font-size: 14px;
  margin: 12px 0px 2px 0px;
} */

.tab-content {
  margin: 10px;
}

.tab-content >>> section {
  border: 1px solid #ccc;
  border-radius: 3px;
  margin: 10px 0px;
  padding: 10px;
}

#last_updated {
  float: right;
}
#last_updated + div {
  clear: both;
}
table {
  width: 90%;
}
.user-pos {
  font-size: 12px;
  display: inline-block;
  width: 80px;
}

.user-pos > span {
  display: inline-block;
  text-align: right;
  width: 30px;
}
textarea {
  /* width: 500px; */
  font-size: 20px;
}
#marquee-period {
  width: 80px;
  font-size: 20px;
}
table {
  font-size: 14px;
}
th {
  text-align: left;
}
table,
th,
td {
  border-collapse: collapse;
  margin: 0px;
  border-top: black solid 1px;
  border-bottom: black solid 1px;
}

.error {
  color: red;
}

#socket-history {
  background: #eee;
  font-size: 10px;
  height: 100vh;
  overflow: scroll;
}
#socket-history div span {
  margin: 3px 10px;
}

label[disabled="true"] {
  color: #999;
}

.r0 {
  width: 40px;
}

.r0.show-on-hover > span.show-on-hover-child {
  visibility: hidden;
  cursor: pointer;
}

.r0.show-on-hover:hover > span.show-on-hover-child {
  visibility: visible;
}

.r1 {
  font-size: 12px;
  width: 60px;
}

.r2 {
  font-weight: bold;
  width: 120px;
}

.r3 {
  width: 120px;
}

.r4,
.r5 {
  width: 40px;
}

#people input {
  width: 90%;
}

.edit-btn {
  cursor: pointer;
  font-size: 12px;
  border: 1px #555 solid;
  border-radius: 3px;
  padding: 2px;
}

.file_upload {
  border: 1px solid #444;
  margin: 10px;
  padding: 10px;
  width: 400px;
}
</style>
