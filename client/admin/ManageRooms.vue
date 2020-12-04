<template>
  <div class="tab-content">
    <nav class="breadcrumb" aria-label="breadcrumbs">
      <ul>
        <li :class="{ 'is-active': !room && !new_room }">
          <a href="#rooms" @click="changeRoom(null)">会場</a>
        </li>
        <li v-if="room" :class="{ 'is-active': !room_subpage }">
          <a :href="'#rooms/' + room.id">{{ room.name }}</a>
        </li>
        <li v-if="room_subpage == 'chat'" :class="{ 'is-active': true }">
          <a>チャット</a>
        </li>
        <li v-if="room_subpage == 'posters'" :class="{ 'is-active': true }">
          <a>ポスター</a>
        </li>
        <li v-if="room_subpage == 'users'" :class="{ 'is-active': true }">
          <a>ユーザー</a>
        </li>
        <li v-if="new_room" :class="{ 'is-active': true }">
          <a>新規</a>
        </li>
      </ul>
    </nav>
    <table v-if="new_room">
      <tr>
        <td>マップ</td>

        <td>二次元のキャラクタ表記を含むYAML形式</td>
        <td>
          <form class="file_upload">
            <input
              accept="application/yaml"
              type="file"
              id="file"
              v-on:change="onFileChange('map.yaml', $event)"
            />
            <input
              type="submit"
              value="アップロード"
              :disabled="!files['map.yaml']"
              @click="submitClick('map.yaml')"
            />
          </form>
        </td>
      </tr>
    </table>

    <section id="room-list" v-if="!room && !new_room">
      <h1>{{admin_page ? '' : 'アクセス可能な'}}会場の一覧</h1>
      <div>
        <!-- <button class="button is-primary" @click="newRoom">新規作成</button> -->
              <a href="/create_room" class="button is-primary">新規作成</a>

      </div>
      <table class='table'>
        <thead>
          <tr>
            <th>ID</th>
            <th class="r1"></th>
            <th>名前</th>
            <th></th>
            <th>マップ</th>
            <th>{{admin_page ? '参加者数（入場／参加資格者）' : '入場者数'}}</th>
            <th>ポスター</th>
            <th>オーナー</th>
          </tr>
        </thead>
        <tr v-for="room in rooms" :key="room.id">
          <td>{{ room.id }}</td>
          <td class="r1"></td>
          <td>
                                  <a :href="'/room?room_id=' + room.id">{{
              room.name
            }}</a>
            
          </td>
                    <td>  
            <button class='button is-small' v-if="room.owner == myUserId || admin_page" :href="'#rooms/' + room.id" @click="changeRoom(room.id)">設定</button>

                      <button class='button is-small' v-if="room.owner == myUserId || admin_page" @click="deleteRoom(room.id)">削除</button></td>

          <td>
            {{ room.numCols * room.numRows }} マス（縦 {{ room.numCols }} x 横
            {{ room.numRows }}）
          </td>
          <td>
            <span v-if='admin_page'>
            {{ room.num_people_joined }} 人入場 /
            {{ room.num_people_with_access }} 人の参加資格者

            </span>
            <span v-else>{{ room.num_people_joined }}</span>
          </td>
          <td>
            {{ room.poster_count }} 枚 / {{ room.poster_location_count }} 枠
          </td>
          <td>{{ people[room.owner]?.name }}({{ room.owner }})</td>
        </tr>
      </table>
    </section>

    <div v-if="room" id="room-nav">
      <a :href="'#rooms/' + room.id" :class="{ active: !room_subpage }">概要</a>
      <a
        :href="'#rooms/' + room.id + '/map'"
        :class="{ active: room_subpage == 'map' }"
        >マップ</a
      >
      <a
        :href="'#rooms/' + room.id + '/users'"
        :class="{ active: room_subpage == 'users' }"
        >ユーザー</a
      >
      <a
        :href="'#rooms/' + room.id + '/posters'"
        :class="{ active: room_subpage == 'posters' }"
        >ポスター</a
      >
      <a
        :href="'#rooms/' + room.id + '/chat'"
        :class="{ active: room_subpage == 'chat' }"
        >チャット</a
      >
    </div>

    <div v-if="room && !room_subpage">
      <div>
        <section>
          <h1>会場の概要</h1>
          <h3>
            マップ：{{ room.numCols * room.numRows }}（縦{{ room.numCols }} x
            横{{ room.numRows }}）
          </h3>
          <h3>
            <a :href="'#rooms/' + room.id + '/users'">参加者</a>：
            {{ room.num_people_joined }} 人入場 /
            {{ room.num_people_with_access }} 人の参加資格者
          </h3>
          <h3>
            <a :href="'#rooms/' + room.id + '/posters'">ポスター</a>：
            {{ room.poster_count }}枚掲示/ {{ room.poster_location_count }}枠
          </h3>
          <h3>
            <a :href="'#rooms/' + room.id + '/chat'">チャット</a>：
            {{ Object.values(chatGroups).length }} グループ
          </h3>
        </section>
      </div>
      <div>
        <section>
          <h1>設定</h1>

          <div>
            アクセスコード：
            <span class="access-code">{{
              room.access_code?.code || "(なし)"
            }}</span>
            <input
              type="checkbox"
              name=""
              id="access-code-active"
              v-model="accessCodeActive"
              :disabled="!room.access_code"
            />
            <label for="access-code-active">有効</label>
            <button
              class="button is-primary is-small"
              @click="renewAccessCode(room.id)"
              style="margin-right: 5px;"
            >
              {{ room.access_code ? "更新" : "作成" }}
            </button>
            <button
              class="button is-danger is-small"
              @click="deleteAccessCode(room.id)"
              :disabled="!room.access_code"
            >
              削除
            </button>
          </div>
          <input
            type="checkbox"
            name=""
            id="room-config-allow-self-assign-poster"
            v-model="roomConfig.allowPosterAssignment"
          />
          <label for="room-config-allow-self-assign-poster"
            >ユーザーによるポスター板の確保・解放およびタイトルの編集を許可する</label
          ><br />
        </section>
      </div>
    </div>

    <section v-if="room && !room_subpage">
      <h1>アナウンス</h1>
      <div>
        <small>※HTMLも送信可能（危険なリンクなどを送らないように注意）</small>
      </div>
      <textarea cols="60" rows="2" id="announce-input" ref="announceText" />
      <button @click="submitAnnouncement">
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
        <button @click="askReload(false)">
          会場の参加者にリロードを依頼
        </button>
      </div>
      <div>
        <button @click="askReload(true)">
          会場の参加者を強制的にリロード
        </button>
      </div>
    </section>
    <ManageRoomPosters
      v-if="room && room_subpage == 'posters'"
      :myUserId="myUserId"
      :room="room"
      :peopleInRoom="peopleInRoom"
      :peopleHavingAccess="peopleHavingAccess"
      :posters="postersInRoom"
      :poster_cells="poster_cells"
    />
    <section v-if="room && room_subpage == 'map'">
      <h1>マップ</h1>
      <div>
        {{ room.numCols * room.numRows }}（縦{{ room.numCols }} x 横{{
          room.numRows
        }}）
      </div>
    </section>
    <section v-if="room && room_subpage == 'chat'">
      <h1>チャットグループ一覧</h1>
      <div v-if="chatGroupsSorted.length == 0">
        チャットなし
      </div>
      <div v-else>
        <table>
          <thead>
            <th>ID</th>
            <th>色</th>
            <th>参加者</th>
          </thead>
          <tbody>
            <tr id='chat-groups' v-for="g in chatGroupsSorted" :key="g.id"  >
              <td>{{ g.id }}</td>
              <td :style="{color: g.color}">{{ g.color }}</td>
              <td><span class='chat-user' v-for='u in g.users' :key="u">{{people[u].name}}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section v-if="room && room_subpage == 'users'">
      <h1>ユーザー一覧</h1>
      <div id="user-list-tools">
        <input
          type="text"
          id="search-user"
          @input="inputSearchUser"
          @compositionstart="searchUserTextComposition = true"
          @compositionend="searchUserTextComposition = false"
          @keydown.enter="inputSearchUser"
        />
        <span>{{ countSelected }}人を選択中</span>
        <button class="button is-primary is-small" @click='startAssignUserBatchDialog'>一括で追加</button>
        <button class="button is-primary is-small" @click='startAssignUserDialog'>追加</button>
        <button class="button is-danger is-small" @click="removeUser" :disabled="countSelected == 0">
          削除
        </button>
      </div>
      <div v-if="peopleHavingAccess.length == 0">
        参加資格者なし
      </div>
      <div v-else>
        <table>
          <thead>
            <th>
              <input
                type="checkbox"
                name=""
                id=""
                @change="checkAllWithAccess"
                ref="checkboxAllPeopleHavingAccess"
              />
            </th>
            <th>Email</th>
            <th>ID</th>
            <th>名前</th>
            <th>X座標</th>
            <th>Y座標</th>
          </thead>
          <tbody>
            <tr v-for="p in peopleHavingAccessFiltered" :key="p.id">
              <td>
                <input
                  type="checkbox"
                  name=""
                  id=""
                  :checked="selectedHavingAccess[p.email] == true"
                  @change="checkPersonWithAccess(p.email, $event)"
                />
              </td>
              <td>{{ p.email }}</td>
              <td :colspan="p.registered ? 1 : 2">{{ p.registered?.id || '（未入場または未登録）' }}</td>
              <td v-if="p.registered">{{ p.registered?.name }}</td>
              <td colspan='2' v-if="!p.in_room">（未入場）</td>
              <td v-if="p.in_room">{{ p.in_room.x }}</td>
              <td v-if="p.in_room">{{ p.in_room.y }}</td>
            </tr>
          </tbody>
        </table>
      </div>
       <div
      id="assign-user-dialog"
      class="modal"
      :class="{ 'is-active': assignUserDialog }"
       @keydown.esc="cancelAssignUserDialog"
    >
      <div
        class="modal-background"
        @click="assignUserDialog = false"
      ></div>
      <div class="modal-content">
        <h1>ユーザーの追加</h1>
        <div style="margin: 10px; line-height: 1.5em; vertical-align: top;">
          <label for="assign-user-email">Email</label>
          <input
            type="text"
            name=""
            id="assign-user-email"
            ref="assignUserEmail"
          /><br />
        </div>
        <div style="margin: 10px">
          <button
            class="button is-primary"
            @click="assignUser"
          >
            OK
          </button>
          <button class="button is-default" @click="cancelAssignUserDialog">
            キャンセル
          </button>
        </div>
      </div>
      <button
        class="modal-close is-large"
        aria-label="close"
        @click="assignUserDialog = false"
      ></button>
    </div>
      <div
      id="assign-user-batch-dialog"
      class="modal"
      :class="{ 'is-active': assignUserBatchDialog }"
      @keydown.esc="cancelAssignUserBatchDialog"
    >
      <div
        class="modal-background"
        @click="assignUserBatchDialog = false"
      ></div>
      <div class="modal-content">
        <h1>ユーザーの一括追加</h1>
        <div style="margin: 10px; line-height: 1.5em; vertical-align: top;">
          <p>
            CSVファイルを選択してください。
            <ul>
              <li>1行目は見出し行として無視されます。</li>
              <li>2行目以降，各行が1人のユーザーに対応します。</li>
              <li>Emailを1行ずつ入力してください。</li>
            </ul>
            
          </p>
          <input
            type="file"
            name=""
            id=""
            ref="assignUserFile"
            @change="onUserBatchFileChanged"
            accept="text/csv"
          />
        </div>
        <div id='user-assign-preview'>
          <table>
            <thead>
              <tr>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry,i) in userAssignment" :key="i" :class="{'is-invalid': !entry.valid}">
                <td>{{entry.email}}</td> 
              </tr>
            </tbody>
          </table>
        </div>
        <div style="margin: 10px">
          <button class="button is-primary" @click="assignUserBatch">
            送信
          </button>
          <button
            class="button is-default"
            @click="cancelAssignUserBatchDialog"
          >
            キャンセル
          </button>
        </div>
      </div>
      <button
        class="modal-close is-large"
        aria-label="close"
        @click="assignUserBatchDialog = false"
      ></button>
    </div>
    </section>
  </div>
</template>

<script lang="ts">
import * as Papa from "papaparse"
import {
  RoomId,
  Room,
  Poster,
  PosterId,
  ChatGroup,
  PersonWithEmailRooms,
  AccessRule,
  PersonWithMapAccess,
  RoomUpdateSocketData,
} from "@/@types/types"
import axiosDefault from "axios"
import { AxiosStatic } from "axios"
import { flatten, keyBy, keyByFunc, sortBy } from "@/common/util"
const API_ROOT = "/api"
const axios = axiosDefault.create({ baseURL: API_ROOT })
import axiosClient from "@aspida/axios"
import api from "@/api/$api"
import {
  defineComponent,
  reactive,
  onMounted,
  toRefs,
  PropType,
  computed,
  watch,
  ref,
  nextTick,
} from "vue"
import {
  Cell,
  ChatGroupId,
  PersonInMap,
  PersonWithEmail,
  UserId,
} from "@/api/@types"
import ManageRoomPosters from "./ManageRoomPosters.vue"
import { findUser } from "../util"

export default defineComponent({
  components: {
    ManageRoomPosters,
  },
  props: {
    admin_page: {
      type: Boolean,
    },
    myUserId: {
      type: String,
      required: true,
    },
    axios: {
      type: Function as PropType<AxiosStatic>,
      required: true,
    },
    socket: {
      type: Object as PropType<SocketIOClient.Socket>,
      required: true,
    },
    rooms: {
      type: Object as PropType<{ [room_id: string]: Room }>,
      required: true,
    },
    room: {
      type: Object as PropType<Room>,
    },
    room_subpage: {
      type: String,
    },
    new_room: {
      type: Boolean,
      required: true,
    },
    people: {
      type: Object as PropType<{ [index: string]: PersonWithEmailRooms }>,
      required: true,
    },
  },
  emits: [
    "reload-rooms",
    "delete-room",
    "change-room",
    "make-announcement",
    "ask-reload",
    "renew-access-code",
    "delete-access-code",
  ],
  setup(props, context) {
    const client = api(axiosClient(axios))
    const state = reactive({
      peopleInRoom: {} as { [user_id: string]: PersonInMap },
      peopleHavingAccess: [] as PersonWithMapAccess[],
      API_ROOT,
      postersInRoom: {} as { [poster_id: string]: Poster },
      files: {} as { [index: string]: File },
      file_urls: {} as { [poster_id: string]: string },
      dragover: {} as { [poster_id: string]: boolean },
      chatGroups: {} as { [group_id: string]: ChatGroup },
      announceMarquee: false,
      announceMarqueePeriod: 20,
      roomConfig: {
        allowPosterAssignment: props.room?.allow_poster_assignment,
      },
      peopleWithAccessAllChecked: false as boolean | undefined,
      selectedHavingAccess: {} as { [email: string]: boolean },
      searchUserText: null as string | null,
      searchUserTextComposition: false,
      poster_cells: [] as Cell[],
      accessCodeActive: false,
      assignUserDialog: false,
      assignUserBatchDialog: false,
      userAssignment: [] as {
        valid: boolean
        email: string
        name: string
        register?: boolean
        enter?: boolean
      }[],
    })

    const chatGroupsSorted = computed(() => {
      return sortBy(Object.values(state.chatGroups), g => g.timestamp)
    })

    const loadPeopleInMap = async () => {
      const room_id = props.room?.id
      if (!room_id) {
        console.warn("Room ID empty")
        return
      }
      state.peopleInRoom = keyBy(
        await client.maps
          ._roomId(room_id)
          .people.$get({ query: { email: true } }),
        "id"
      )
      const peopleByEmail = keyByFunc(Object.values(props.people), p => p.email)
      const peopleInRoomByEmail = keyByFunc(
        Object.values(state.peopleInRoom),
        p => p.email || "NA"
      )
      const allowed_emails = (
        await client.maps._roomId(room_id).people_allowed.$get()
      ).people

      state.peopleHavingAccess = sortBy(
        allowed_emails,
        p => "" + (peopleInRoomByEmail[p.email] ? 0 : 1) + ":" + p.email
      ).map(p => {
        const p3 = peopleInRoomByEmail[p.email]
        const p1 = peopleByEmail[p.email] || props.people[p3?.id]
        const p2: PersonInMap | undefined = peopleInRoomByEmail[p.email]
        if (p1) {
          return {
            email: p.email,
            registered: {
              id: p1.id,
              avatar: p1.avatar!,
              connected: p1.connected!,
              stats: p1.stats,
              public_key: p1.public_key,
              last_updated: p1.last_updated,
              name: p1.name,
            },
            in_room: p2
              ? {
                  x: p2.x,
                  y: p2.y,
                  direction: p2.direction,
                  moving: p2.moving,
                  poster_vieweing: p2.poster_viewing,
                }
              : undefined,
          }
        } else {
          return { email: p.email }
        }
      })
    }

    const loadChatGroups = async () => {
      const room_id = props.room?.id
      if (room_id) {
        const groups = await client.maps._roomId(room_id).groups.$get()
        state.chatGroups = keyBy(groups, "id")
      } else {
        state.chatGroups = {}
      }
    }
    props.socket?.on("Group", (g: ChatGroup) => {
      state.chatGroups[g.id] = g
    })
    props.socket?.on("GroupRemove", (gid: ChatGroupId) => {
      delete state.chatGroups[gid]
    })

    const loadPosterLocations = async (room_id: RoomId) => {
      console.log("loadPosterLocations()")
      const r = await client.maps._roomId(room_id).$get()
      state.poster_cells = flatten(r.cells).filter(
        c => c.poster_number != undefined
      )
      state.postersInRoom = keyBy(
        await client.maps._roomId(room_id).posters.$get(),
        "id"
      )
      for (const p of Object.values(state.postersInRoom)) {
        if (p.file_url == "not_disclosed") {
          p.file_url =
            (await client.posters._posterId(p.id).file_url.$get()).url ||
            p.file_url
        }
        // if (p.file_url) {
        //   p.file_url += "?timestamp=" + p.last_updated  //CloudFront gives error
        // }
      }
    }

    const loadRoom = async (room: Room) => {
      if (room) {
        state.accessCodeActive = !!room.access_code?.active
        state.roomConfig.allowPosterAssignment = room.allow_poster_assignment

        await loadChatGroups()
        await loadPeopleInMap()
        await loadPosterLocations(room.id)
      }
    }

    onMounted(async () => {
      const room_id = props.room?.id
      if (room_id) {
        await loadRoom(props.rooms[room_id])
      }
    })

    const onFileChange = (name: string, e) => {
      //Vue.set
      state.files[name] = (e.target.files || e.dataTransfer.files)[0]
    }
    const submitClick = async (name: string) => {
      console.log("submitClick", state.files[name])
      try {
        const formData = new FormData()
        formData.append("file", state.files[name])
        const config = {
          headers: {
            "content-type": "multipart/form-data",
          },
        }
        const res = await props.axios.post(
          "/admin/import/" + name,
          formData,
          config
        )
        console.log(res.data)
        if (!res.data.ok) {
          alert("エラー。" + (res.data.error || ""))
        } else {
          try {
            context.emit("reload-rooms")
            alert("登録完了")
          } catch (err) {
            console.log(err)
          }
        }
        return true
      } catch (error) {
        alert("ファイルの送信に失敗しました")
        return true
      }
    }

    const downloadFile = (filename: string, text: string): void => {
      const element = document.createElement("a")
      element.setAttribute(
        "href",
        "data:text/csv;charset=utf-8," + encodeURIComponent(text)
      )
      element.setAttribute("download", filename)

      element.style.display = "none"
      document.body.appendChild(element)

      element.click()

      document.body.removeChild(element)
    }

    const downloadUrl = async (url: string, filename: string) => {
      const data = (await props.axios.get(url)).data
      const text =
        typeof data == "string" ? data : JSON.stringify(data, null, 2)
      downloadFile(filename, text)
      return false
    }

    const deleteRoom = async (room_id: RoomId) => {
      const room_name = props.rooms[room_id].name
      try {
        const s = prompt(
          "「" +
            room_name +
            "」を本当に削除しますか？ 削除すると部屋と関連するポスター，コメントがすべて消去されます。削除する場合は部屋のIDを下記に入力してください。"
        )
        if (s != room_id) {
          return
        }
        const res = await props.axios.delete("/maps/" + room_id)
        console.log(res.data)
        if (res.data.ok) {
          context.emit("delete-room", room_id)
          alert("部屋「" + room_name + "」が削除されました")
        } else {
          alert("部屋の削除に失敗しました")
        }
      } catch (err) {
        alert("部屋の削除に失敗しました")
      }
    }

    const changeRoom = (room_id: RoomId) => {
      context.emit("change-room", room_id)
    }

    const newRoom = () => {
      context.emit("change-room", "new")
    }

    const announceText = ref<HTMLInputElement>()

    const submitAnnouncement = () => {
      const room = props.room?.id
      if (!room) {
        console.error("Room is not selected")
        return
      }
      const d = {
        room,
        marquee: state.announceMarquee,
        text: announceText.value?.value,
        period: state.announceMarqueePeriod,
      }
      console.log("submitAnnouncement", d)
      context.emit("make-announcement", d)
    }

    const askReload = (force: boolean) => {
      if (props.room) {
        context.emit("ask-reload", { room_id: props.room.id, force })
      }
    }

    const renewAccessCode = async (room_id: RoomId) => {
      context.emit("renew-access-code", room_id)
    }

    const deleteAccessCode = async (room_id: RoomId) => {
      context.emit("delete-access-code", room_id)
    }

    const peopleHavingAccessFiltered = computed(() => {
      const t = state.searchUserText
      if (!t) {
        return state.peopleHavingAccess
      }
      return state.peopleHavingAccess.filter(p => {
        return (
          p.email?.indexOf(t) != -1 ||
          (p["id"]
            ? p.registered?.id.indexOf(t) != -1 ||
              p.registered?.name.indexOf(t) != -1
            : false)
        )
      })
    })

    const checkAllWithAccess = ev => {
      const checked = ev.target.checked
      state.peopleWithAccessAllChecked = checked
      if (!ev.target.indeterminate) {
        for (const p of state.peopleHavingAccess) {
          state.selectedHavingAccess[p.email!] = false
        }
        for (const p of peopleHavingAccessFiltered.value) {
          state.selectedHavingAccess[p.email!] = checked
        }
      }
    }

    const countSelected = computed(() => {
      return Object.values(state.selectedHavingAccess).filter(b => b).length
    })

    const checkboxAllPeopleHavingAccess = ref<HTMLInputElement>()

    const checkPersonWithAccess = (email: string, ev) => {
      const checked = ev.target.checked
      console.log("checkPersonWithAccess", email, checked)
      state.selectedHavingAccess[email] = checked
      checkboxAllPeopleHavingAccess.value!.indeterminate = true
    }

    const inputSearchUser = ev => {
      if (!state.searchUserTextComposition) {
        state.searchUserText = ev.target.value
      }
    }

    const removeUser = async () => {
      const room_id = props.room?.id
      if (!room_id) {
        console.error("Room is not defined")
        return
      }
      const user_emails: string[] = []
      for (const p of state.peopleHavingAccess) {
        if (state.selectedHavingAccess[p.email!]) {
          user_emails.push(p.email!)
        }
      }
      if (user_emails.length == 0) {
        return
      }
      if (!confirm("削除して良いですか？取り消せません")) {
        return
      }
      const users_set = new Set(user_emails)
      const peopleInRoomByEmail = keyBy(
        Object.values(state.peopleInRoom),
        "email"
      )
      for (const email of user_emails) {
        const uid = peopleInRoomByEmail[email]?.id as string | undefined
        if (uid) {
          const r = await client.maps
            ._roomId(room_id)
            .people._userId(uid)
            .$delete()
          if (!r.ok) {
            console.error("removeUser() error", r.error)
            users_set.delete(email)
          }
        } else {
          //Only email address stub, not registered user.
          const r = await client.maps
            ._roomId(room_id)
            .people_allowed._email(email)
            .$delete()
          if (!r.ok) {
            console.error("removeUser() error", r.error)
            users_set.delete(email)
          }
        }
      }

      state.peopleHavingAccess = state.peopleHavingAccess.filter(
        p => !users_set.has(p.email)
      )
      for (const e of users_set) {
        delete state.selectedHavingAccess[e]
      }
    }

    const assignUserEmail = ref<HTMLInputElement>()

    const startAssignUserDialog = async () => {
      state.assignUserDialog = true
      await nextTick(() => {
        assignUserEmail.value?.focus()
      })
    }

    const cancelAssignUserDialog = () => {
      state.assignUserDialog = false
      assignUserEmail.value!.value = ""
    }

    const assignUser = async () => {
      const email = assignUserEmail.value?.value
      if (!email) {
        return
      }
      const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

      const is_email = re.test(email.toLowerCase())
      if (!is_email) {
        if (!confirm("Emailアドレスが正しくないようです。続けますか？")) {
          return
        }
      }
      const r = await client.maps
        ._roomId(props.room!.id)
        .people_allowed.$post({ body: { email } })
      state.assignUserDialog = false
      assignUserEmail.value!.value = ""
      await loadPeopleInMap()
    }

    const assignUserBatch = async () => {
      const people = state.userAssignment
        .filter(u => u.valid)
        .map(u => {
          return { email: u.email, assign_position: false }
        })
      const r = await client.maps
        ._roomId(props.room!.id)
        .people_multi.$post({ body: { people } })
      state.assignUserBatchDialog = false
      await loadPeopleInMap()
    }

    const assignUserFile = ref<HTMLInputElement>()

    const startAssignUserBatchDialog = async () => {
      state.assignUserBatchDialog = true
      await nextTick(() => {
        assignUserFile.value?.focus()
      })
    }

    const cancelAssignUserBatchDialog = () => {
      state.userAssignment = []
      state.assignUserBatchDialog = false
    }

    const onUserBatchFileChanged = ev => {
      const file: File = (ev.target.files || ev.dataTransfer.files)[0]
      console.log(file)
      if (file.type != "text/csv") {
        return
      }
      const reader = new FileReader()
      reader.onload = e => {
        const csv_data = (e.target?.result || undefined) as string | undefined
        if (csv_data) {
          state.userAssignment = []
          const data = Papa.parse(csv_data)
          if (data.data && data.data.length > 0) {
            console.log(data.data.slice(1))
            for (const r of data.data.slice(1) as string[][]) {
              if (r.length == 1 && r[0] == "") {
                continue
              }
              const email: string | undefined = r[0]
              const name: string | undefined = r[1]
              const register: boolean | undefined =
                r[2] == "1" ? true : r[2] == "0" ? false : undefined
              const enter: boolean | undefined =
                r[3] == "1" ? true : r[2] == "0" ? false : undefined
              state.userAssignment.push({
                valid: true,
                name,
                email,
                register,
                enter,
              })
            }
          }
        }
      }
      reader.readAsText(file)
    }

    props.socket.on("Poster", async (p: Poster) => {
      if (p.file_url == "not_disclosed") {
        p.file_url =
          (await client.posters._posterId(p.id).file_url.$get()).url ||
          p.file_url
      }
      if (p.file_url) {
        p.file_url += "?timestamp=" + p.last_updated
      }
      state.postersInRoom[p.id] = p
    })

    props.socket.on("PosterRemove", (pid: PosterId) => {
      delete state.postersInRoom[pid]
    })

    watch(
      () => [state.roomConfig],
      async () => {
        const room = props.room
        if (!room) {
          console.error("Room is not defined")
          return
        }
        const rules: AccessRule[] = [{ email: "*", allow: false }]
        const r = await client.maps._roomId(room.id).$patch({
          body: {
            allow_poster_assignment: state.roomConfig.allowPosterAssignment,
          },
        })
      },
      { deep: true }
    )

    watch(
      () => props.room,
      async () => {
        console.log("props.room changed")
        const room = props.room
        if (room) {
          await loadRoom(room)
        }
      },
      { deep: true }
    )

    watch(
      () => state.accessCodeActive,
      async () => {
        const room = props.room
        if (!room) {
          return
        }
        await client.maps
          ._roomId(room.id)
          .access_code._accessCode(room.access_code!.code)
          .$patch({ body: { active: state.accessCodeActive } })
      }
    )

    return {
      ...toRefs(state),
      deleteRoom,
      onFileChange,
      downloadUrl,
      downloadFile,
      submitClick,
      changeRoom,
      newRoom,
      chatGroupsSorted,
      announceText,
      submitAnnouncement,
      askReload,
      renewAccessCode,
      deleteAccessCode,
      checkAllWithAccess,
      checkPersonWithAccess,
      checkboxAllPeopleHavingAccess,
      inputSearchUser,
      peopleHavingAccessFiltered,
      countSelected,
      removeUser,
      assignUserEmail,
      startAssignUserDialog,
      cancelAssignUserDialog,
      assignUser,
      startAssignUserBatchDialog,
      cancelAssignUserBatchDialog,
      assignUserFile,
      onUserBatchFileChanged,
      assignUserBatch,
    }
  },
})
</script>

<style lang="css">
.tab-content section {
  border: 1px solid #ccc;
  border-radius: 3px;
  margin: 10px 0px;
  padding: 10px;
}

#room-list td:nth-child(1) {
  font-weight: bold;
  width: 50px;
}

#room-list td:nth-child(2) {
  width: 150px;
}

div.table-column-tool {
  float: right;
}

#room-nav a {
  font-size: 14px;
  margin: 0px 5px;
}
#room-nav a.active {
  color: black;
  font-weight: bold;
  cursor: default;
}
span.access-code {
  display: inline-block;
  width: 150px;
}

#user-list-tools {
  margin: 10px 0px;
}
#user-list-tools button {
  margin: 0px 5px;
}

#search-user {
  font-size: 18px;
}

.chat-user {
  margin-right: 10px;
}

#chat-groups:nth-child(1) {
  width: 100px;
}
#chat-groups:nth-child(2) {
  width: 100px;
}
</style>
