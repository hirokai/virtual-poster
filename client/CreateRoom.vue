<template>
  <div id="app" v-cloak v-show="logged_in">
    <div v-if="registered">
      <div v-if="loggedIn == 'Yes'">
        <a href="/">トップページに戻る</a>

        <h1>会場を作成する</h1>
        <div>
          <h2>会場のオーナー</h2>
          {{ user.name }} ({{ user.email }})
          <div>
            <h2>会場の種類を選択</h2>
            <div
              class="room-kind-entry"
              :class="{ active: roomKind == room.kind }"
              v-for="room in room_templates"
              :key="room.kind"
              @click="selectKind(room.kind)"
            >
              <h3>{{ room.name }}</h3>
              <div>{{ room.description || "" }}</div>
            </div>
            <div
              class="room-kind-entry"
              :class="{
                active: roomKind == 'custom',
                dragover: dragoverCustom,
              }"
              @click="selectKind('custom')"
              @dragover.prevent
              @drop.prevent="onDrop"
              @dragover="dragoverCustom = true"
              @dragleave="dragoverCustom = false"
            >
              <h3>カスタム</h3>
              <div>
                自作のレイアウトをドラッグ＆ドロップでアップロードします
              </div>
            </div>
            <div style="clear: both"></div>
          </div>
          <div>
            <h2>レイアウト</h2>
            <div v-if="room_info">
              <div>
                横{{ room_info.numCols }} x 縦{{ room_info.numRows }} （計{{
                  room_info.numCells
                }}マス）
              </div>
              <div>
                <h4 class="title is-4">セル</h4>
                <table class="table">
                  <thead>
                    <tr>
                      <th>セル名</th>
                      <th>種類</th>
                      <th>カスタム画像</th>
                      <th>URL</th>
                      <th>マスの数</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(v, k) in room_info.cellTable" :key="k">
                      <td>{{ k }}</td>
                      <td>{{ v.kind }}</td>
                      <td>{{ v.custom_image }}</td>
                      <td>{{ v.link_url }}</td>
                      <td>{{ numCellsByCellTypeId(k) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="room_info.regions">
                <h4 class="title is-4">領域</h4>
                <table class="table">
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>説明</th>
                      <th>座標 左上</th>
                      <th>座標 右下</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="v in room_info.regions" :key="v.name">
                      <td>{{ v.name }}</td>
                      <td>{{ v.description }}</td>
                      <td>{{ v.rect.x1 }}, {{ v.rect.y1 }}</td>
                      <td>{{ v.rect.x2 }}, {{ v.rect.y2 }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="room_info.permissions">
                <h4 class="title is-4">ルール</h4>
                <table class="table">
                  <thead>
                    <tr>
                      <th>グループ</th>
                      <th>領域</th>
                      <th>アクション</th>
                      <th>許可</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="v in room_info.permissions"
                      :key="
                        v.group_names + ':' + v.region_names + ':' + v.operation
                      "
                    >
                      <td>{{ v.group_names.join(", ") }}</td>
                      <td>{{ v.region_names.join(", ") }}</td>
                      <td>{{ v.operation }}</td>
                      <td>
                        {{
                          v.allow == "allow"
                            ? "OK"
                            : v.allow == "disallow"
                            ? "NG"
                            : "(invalid)"
                        }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <span v-else-if="roomKind == 'custom'"
              >（ファイルを上記の枠内にドラッグすると情報が表示されます）</span
            >
            <span v-else>情報がありません</span>
          </div>
          <div>
            <h2>会場の名前</h2>
            <input type="text" ref="roomName" style="margin-left: 10px" />
          </div>
          <div>
            <h2>設定</h2>
            <input
              type="checkbox"
              name=""
              id="new-room-config-allow-self-assign-poster"
              v-model="allowPosterAssignment"
              style="margin-left: 10px"
            />
            <label for="new-room-config-allow-self-assign-poster"
              >ユーザーによるポスター板の確保・解放およびタイトルの編集を許可する</label
            >
            <br />
            <input
              type="checkbox"
              name=""
              id="new-room-config-hide-unvisited"
              v-model="hideUnvisited"
              style="margin-left: 10px"
            />
            <label for="new-room-config-hide-unvisited"
              >マップの未探索の部分を隠す</label
            >
          </div>
          <div>
            <h3>備考</h3>
            <ul>
              <li>
                部屋の作成者のメールアドレスが，部屋の参加者に対して表示されます。
              </li>
              <li>
                作成した会場の削除や設定変更はマイページの「マップ」タブから可能です。
              </li>
            </ul>
            <button class="btn" id="submit" @click="submit">作成する</button>
            <p>
              {{ result?.message }}
              <br />
              <a
                v-if="result?.room_id"
                :href="'/room?room_id=' + result.room_id"
                >作成した会場に行く</a
              >
              <a v-if="result?.ok != undefined" href="/">トップページに戻る</a>
            </p>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="required_action == 'register'">
      <p>メールアドレス確認済みです。</p>
      <a href="/register"> 登録へ進む</a>
    </div>
    <div v-else-if="required_action == 'verify'">
      Emailアドレス（{{
        user.email
      }}）に確認のメールを送信しました。メールに記載されたリンクをクリックしてユーザー登録を完了してください。
      <br />
    </div>
    <div v-else>
      このEmailアドレス（{{ user.email }}）はユーザー登録されていません。
      <br />
      管理者に連絡してユーザー登録してください。
      <a href="/"> ログイン画面に戻る</a>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, onMounted, toRefs, ref } from "vue"

import {
  Cell,
  CellType,
  MinimapVisibility,
  Room,
  UserId,
} from "../@types/types"

import axios from "axios"
import * as encryption from "./encryption"
import { deleteUserInfoOnLogout } from "./util"

import axiosClient from "@aspida/axios"
import api from "../api/$api"
import { loadCustomMapCsv } from "@/common/maps"
import { flatten } from "@/common/util"
import { RoomId } from "@/api/@types"

const API_ROOT = "/api"
axios.defaults.baseURL = API_ROOT

const url = new URL(location.href)

const debug_as: UserId | undefined =
  url.searchParams.get("debug_as") || undefined
const debug_token: string | undefined =
  url.searchParams.get("debug_token") || undefined

type RoomTemplate = {
  name: string
  kind: "small" | "medium" | "large"
  description?: string
}

const logged_in = !!JSON.parse(url.searchParams.get("logged_in") || "false")
export default defineComponent({
  setup() {
    const user_name = localStorage["virtual-poster:name"]
    const user_id = localStorage["virtual-poster:user_id"]
    const email = localStorage["virtual-poster:email"]
    const admin = localStorage["virtual-poster:admin"] == "1"
    if (!user_name || !user_id || !email) {
      console.warn("Not logged in.", user_id, email, name)
      location.href = "/login"
    }

    const roomInfoTable: {
      [name: string]: {
        numCols: number
        numRows: number
        numCells: number
        cellTable: {
          [name: string]: { kind: CellType; custom_image?: string }
        }
        cells: (Cell & { cell_type_id: string })[][]
        userGroups: { name: string; description?: string }[]
        regions?: {
          name: string
          description?: string
          rect: { x1: number; y1: number; x2: number; y2: number }
        }[]
        permissions?: {
          group_names: string[]
          region_names: string[]
          operation: "poster_paste" | "drop_area"
          allow: "allow" | "disallow"
        }[]
      }
    } = {
      small: {
        numCols: 20,
        numRows: 20,
        numCells: 20 * 20,
        cellTable: {},
        cells: [],
        userGroups: [],
      }, //FIXME: cell data needs to be filled
      medium: {
        numCols: 55,
        numRows: 42,
        numCells: 55 * 42,
        cellTable: {},
        cells: [],
        userGroups: [],
      },
      large: {
        numCols: 161,
        numRows: 82,
        numCells: 161 * 82,
        cellTable: {},
        cells: [],
        userGroups: [],
      },
    }

    const state = reactive({
      myUserId: null as string | null,
      user: { name: user_name, user_id, email, admin } as {
        name: string
        email: string
        user_id: string
        admin: boolean
      } | null,
      loggedIn: (logged_in ? "Yes" : "Unknown") as "Yes" | "No" | "Unknown",
      admin: false,
      registered: true,
      rooms: [] as Room[],
      required_action: undefined as undefined | "register" | "verify",
      logged_in: false,
      room_templates: [
        {
          name: "小さい会場",
          kind: "small",
          description: "20 x 20マス，ポスター板16ヶ所の会場です",
        },
        {
          name: "中くらいの会場",
          kind: "medium",
          description: "55 x 42マス，ポスター板68ヶ所の会場です",
        },
        {
          name: "大きな会場",
          kind: "large",
          description: "161 x 88マス，ポスター板408ヶ所の会場です",
        },
      ] as RoomTemplate[],
      roomName: "",
      roomKind: "small",
      allowPosterAssignment: true,
      minimapVisibility: undefined as MinimapVisibility | undefined,
      result: {
        ok: undefined as boolean | undefined,
        message: "",
        room_id: undefined as RoomId | undefined,
      },
      dragoverCustom: false,
      csv_str: undefined as string | undefined,
      room_info: roomInfoTable["small"] as
        | {
            numCols: number
            numRows: number
            numCells: number
            cellTable: {
              [name: string]: { kind: CellType; custom_image?: string }
            }
            cells: (Cell & { cell_type_id: string })[][]
            userGroups?: { name: string; description?: string }[]
            regions?: {
              name: string
              description?: string
              rect: { x1: number; y1: number; x2: number; y2: number }
            }[]
            permissions?: {
              group_names: string[]
              region_names: string[]
              operation: "poster_paste" | "drop_area"
              allow: "allow" | "disallow"
            }[]
          }
        | undefined,
    })
    const isMobile = !!navigator.userAgent.match(/iPhone|Android.+Mobile/)

    onMounted(() => {
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
      const client = api(axiosClient(axios))
      ;(async () => {
        if (debug_as && debug_token) {
          console.log("Initializing debug mode...", debug_as)
          state.myUserId = debug_as
          state.rooms = await client.maps.$get()
          state.loggedIn = "Yes"
          const data = await client.id_token.$post({
            body: { token: "DEBUG_BYPASS", debug_from: "Index" },
          })

          state.myUserId = data.user_id || null
          if (data.ok) {
            state.admin = data.admin || false
            state.rooms = await client.maps.$get()
            state.logged_in = true
          } else {
            state.registered = false
            console.log("User auth failed")
            location.reload()
          }
          return
        }
        if (!state.user) {
          state.loggedIn = "No"
          location.href = "/login"
        } else {
          state.loggedIn = "Yes"
          console.log("Already registered", state.user)
          state.myUserId = state.user.user_id
          if (state.myUserId) {
            localStorage["virtual-poster:user_id"] = state.myUserId
          }
          state.rooms = await client.maps.$get().catch(err => {
            console.log(err)
            if (err.response.status == 403) {
              location.href = "/login"
            }
            return []
          })
          const data = await client.public_key.$get()
          console.log("/public_key result", data)

          await encryption.setupEncryption(
            axios,
            state.myUserId,
            data.public_key
          )
          state.logged_in = true

          /*
          const shaObj = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" })
          shaObj.update(idToken)
          const jwt_hash = shaObj.getHash("HEX")
          localStorage["virtual-poster:jwt_hash"] = jwt_hash
          */
        }
      })().catch(err => {
        console.log(err)
      })
    })

    const selectKind = (kind: string) => {
      state.roomKind = kind
      state.room_info = roomInfoTable[kind]
    }

    const numCellsByCellTypeId = (cell_type_id: string) => {
      return flatten(state.room_info?.cells || []).filter(
        c => c.cell_type_id == cell_type_id
      ).length
    }

    const roomName = ref<HTMLInputElement>()
    const submit = async () => {
      const client = api(axiosClient(axios))
      const name = roomName.value?.value
      if (!name) {
        state.result.ok = false
        state.result.message = "部屋の名前を入力してください"
        return
      }
      const r = await client.maps.$post({
        body: {
          name,
          template: state.roomKind == "custom" ? undefined : state.roomKind,
          data: state.roomKind == "custom" ? state.csv_str : undefined,
          allow_poster_assignment: state.allowPosterAssignment,
          minimap_visibility: state.minimapVisibility,
        },
      })
      if (r.ok && r.room_id) {
        state.result.message = "部屋が作成されました。"

        state.result.ok = true
        state.result.room_id = r.room_id
        // location.href = "/mypage#rooms"
      } else {
        state.result.ok = false
        const detail =
          r.error == "Room name already exists"
            ? "すでに同じ名前の部屋が存在します。"
            : ""
        state.result.message = "部屋が作成できませんでした。" + detail
      }
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

    const enterRoom = (room_id: string) => {
      location.href = "/room?room_id=" + room_id
    }

    const onDrop = async (event: any) => {
      state.dragoverCustom = false
      state.roomKind = "custom"
      const client = api(axiosClient(axios))
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
      } else if (file.type != "text/csv") {
        console.error("File type invalid")
        alert("ファイルはCSVファイルのみです")
      } else if (file.size >= 10e6) {
        alert("ファイルが10 MB以下にしてください")
      } else {
        const fileReader = new FileReader()
        fileReader.onload = async event => {
          const csv_str = event.target!.result as string
          const r = loadCustomMapCsv(csv_str)
          console.log(r)
          if (r) {
            if (r.name) {
              roomName.value!.value = r.name
            }
            if (r.allowPosterAssignment != undefined) {
              state.allowPosterAssignment = r.allowPosterAssignment
            }
            if (r.minimapVisibility != undefined) {
              state.minimapVisibility = r.minimapVisibility
            }
            roomInfoTable["custom"] = {
              numRows: r.numRows,
              numCols: r.numCols,
              numCells: r.numCells,
              cellTable: r.cell_table,
              cells: r.cells,
              userGroups: r.userGroups || [],
              regions: r.regions,
              permissions: r.permissions,
            }
            state.room_info = roomInfoTable["custom"]

            state.csv_str = csv_str
            // await client.maps.$post({
            //   body: { name, data: csv_str },
            // })
          }
        }
        fileReader.readAsText(file)
      }
    }

    return {
      ...toRefs(state),
      signOut,
      enterRoom,
      location,
      isMobile,
      submit,
      selectKind,
      roomName,
      numCellsByCellTypeId,
      onDrop,
    }
  },
})
</script>

<style>
/* https://jajaaan.co.jp/css/button/ */
*,
*:before,
*:after {
  -webkit-box-sizing: inherit;
  box-sizing: inherit;
}

html {
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  font-size: 62.5%;
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

body {
  font-family: Loto, "YuGothic", sans-serif;
  margin: 15px;
  font-size: 14px;
}

.room-kind-entry {
  background: #ccc;
  width: 200px;
  height: 150px;
  margin: 10px;
  padding: 20px;
  float: left;
  cursor: pointer;
}

.room-kind-entry.active {
  border: 2px solid blue;
}

.room-kind-entry.dragover {
  background: rgb(156, 191, 156);
}

input[type="text"] {
  width: 300px;
  height: 24px;
  font-size: 21px;
}

#submit {
  margin: 20px 0px 20px 0px;
}

[v-cloak] {
  display: none;
}
</style>
