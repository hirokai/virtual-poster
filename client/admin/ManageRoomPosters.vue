<template>
  <section>
    <h5 class='title is-5'>ポスター一覧</h5>
    <div style="margin: 5px 0px;">
      <button
        class="button is-small"
        :class="{ 'is-primary': posterShowMode == 'table' }"
        @click="posterShowMode = 'table'"
      >
        テーブル表示
      </button>
      <button
        class="button is-small"
        :class="{ 'is-primary': posterShowMode == 'tile' }"
        @click="posterShowMode = 'tile'"
        style="margin-right: 10px;"
      >
        タイル表示
      </button>

      <input
        type="checkbox"
        name=""
        id="cb-show-all-poster-locations"
        v-model="showAllPosterLocations"
      />
      <label for="cb-show-all-poster-locations" style="margin-right: 20px;"
        >未割り当てのポスター枠も表示する</label
      >
      <button
        class="button is-small is-primary"
        @click="startAssignPosterBatchDialog"
        style="margin-right: 10px;"
      >
        一括で追加
      </button>
      <button class="button is-small" @click="refreshPosterFiles">
         {{refreshPosterFilesNow ? '確認中...' : '画像の再確認'}}
      </button>
    </div>
    <div v-if="posterShowMode == 'tile'">
      <div v-if="postersSorted.length == 0">
        ポスターなし
      </div>
      <div
        class="poster"
        v-for="poster in postersSorted"
        :key="poster.poster_number"
        @dragover.prevent
        @drop.prevent="
          poster.poster
            ? onDropPoster($event, poster.poster.id, 'tile')
            : undefined
        "
        :class="{
          'drag-hover': poster.poster
            ? dragOverPosterTile[poster.poster.id]
            : false,
        }"
        @dragenter.prevent="dragOverPosterTile[poster.poster?.id] = true"
        @dragleave.prevent="dragOverPosterTile[poster.poster.id] = false"
      >
        <div class="poster_info">
          <h2 class="poster_author">
            {{ poster.poster_number }} ({{ poster.x }},{{ poster.y }}):
            {{
              poster.poster
                ? peopleHavingAccessById[poster.poster.author]?.name
                : "（未割り当て）"
            }}
          </h2>
          <div class="poster_title">{{ poster.poster?.title }}</div>
        </div>
        <img :src="poster.poster?.file_url" />
      </div>
      <div style="clear:both"></div>
    </div>
    <div v-if="posterShowMode == 'table'">
      <table class="table">
        <thead>
          <tr>
            <th>ポスター枠の番号</th>
            <th>座標X</th>
            <th>Y</th>
            <th>ポスターID</th>
            <th>発表者</th>
            <th>タイトル</th>
            <th>画像</th>
            <th>割当／開放</th>
          </tr>
        </thead>
        <tbody v-if="postersSorted.length == 0">
          <tr>
            <td colspan="4">
              {{ showAllPosterLocations ? "ポスター枠なし" : "ポスターなし" }}
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-for="poster in postersSorted" :key="poster.id">
            <td>{{ poster.poster_number }}</td>
            <td>{{ poster.x }}</td>
            <td>{{ poster.y }}</td>
            <td>{{ poster.poster?.id || "（未割り当て）" }}</td>
            <td>
              <span v-if="poster.poster">{{
                peopleHavingAccessById[poster.poster.author]?.registered?.name || "（不明なユーザー）"
              }}</span>
            </td>
            <td>
              <div
                v-if="poster.poster?.id && editingPoster != poster.poster.id"
              >
                <span>{{ poster.poster?.title }}</span>
                <div class="table-column-tool"></div>
                <button
                  class="button is-small"
                  @click="startEditingPosterTitle(poster.poster.id)"
                  style="float: right"
                >
                  編集
                </button>
              </div>
              <div v-else-if="poster.poster">
                <input
                  class="poster-title-input"
                  type="text"
                  ref="PosterTitleInput"
                />
                <div class="table-column-tool">
                  <button
                    class="button is-small is-primary"
                    @click="finishEditingPosterTitle"
                  >
                    確定
                  </button>
                  <button
                    class="button is-small"
                    @click="cancelEditingPosterTitle"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </td>
            <td>
              {{
                poster.poster ? (poster.poster?.file_url ? "あり" : "なし") : ""
              }}
              <span v-if="poster.poster?.file_size">
              ({{ Math.round(poster.poster?.file_size / 1000).toLocaleString() }} kB)
              </span>
              <div
                v-if="poster.poster && !poster.poster?.file_url"
                class="button is-primary is-small"
                :class="{ dropping: dragOverUploadButton[poster.poster.id] }"
                @drop.prevent="onDropPoster($event, poster.poster.id, 'table')"
                @dragover.prevent
                @dragleave.prevent="
                  dragOverUploadButton[poster.poster.id] = false
                "
                @dragenter.prevent="
                  dragOverUploadButton[poster.poster.id] = true
                "
              >
                ファイルをドロップ
              </div>
              <button
                v-if="poster.poster && poster.poster?.file_url"
                class="remove-poster button is-danger is-small"
                @click="removePosterFile(poster.poster.id)"
              >
                画像を削除
              </button>
            </td>
            <td>
              <button
                v-if="poster.poster"
                class="release-poster-slot button is-danger is-small"
                @click="releasePosterSlot(poster.poster)"
              >
                ポスター枠を開放
              </button>
              <button
                v-else
                class="button is-primary is-small"
                @click="startAssignPosterDialog(poster)"
              >
                割り当て
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      id="assign-poster-dialog"
      class="modal"
      :class="{ 'is-active': assignPosterDialog != undefined }"
       @keydown.esc="cancelAssignPosterDialog"
    >
      <div
        class="modal-background"
        @click="assignPosterDialog = undefined"
      ></div>
      <div class="modal-content">
        <h1>ポスター枠の割り当て</h1>
        <div style="margin: 10px; line-height: 1.5em; vertical-align: top;">
          <label for="assign-poster-email">ユーザー</label>
          <input
            type="text"
            name=""
            id="assign-poster-email"
            ref="assignPosterUser"
            placeholder="ユーザー名, ID, Emailアドレスで検索"
            autocomplete="on"
            list="user-search-list"
          /><br />
          <datalist id='user-search-list'>
            <option v-for="s in userSearchList" :key="s">{{s}}</option>
            </datalist>  
          <label for="assign-poster-title">タイトル</label>
          <textarea
            name=""
            id="assign-poster-title"
            ref="assignPosterTitle"
          /><br />
        </div>
        <div style="margin: 10px">
          <button
            class="button is-primary"
            @click="assignPoster(assignPosterDialog)"
          >
            OK
          </button>
          <button class="button is-default" @click="cancelAssignPosterDialog">
            キャンセル
          </button>
        </div>
      </div>
      <button
        class="modal-close is-large"
        aria-label="close"
        @click="assignPosterDialog = undefined"
      ></button>
    </div>
    <div
      id="assign-poster-batch-dialog"
      class="modal"
      :class="{ 'is-active': assignPosterBatchDialog }"
    >
      <div
        class="modal-background"
        @click="assignPosterBatchDialog = false"
      ></div>
      <div class="modal-content" @keydown.esc="cancelAssignPosterBatchDialog"
>
        <h1>ポスター枠の一括割当て</h1>
        <div style="margin: 10px; line-height: 1.5em; vertical-align: top;">
          <p>
            CSVファイルを選択してください。
            <ul>
              <li>1行目は見出し行として無視されます。</li>
              <li>2行目以降，各行が一つのポスターに対応します。</li>
              <li>各列は左から順に，ポスター枠の番号，発表者（Email・ユーザーID・名前のいずれかの完全一致），タイトルの順です。</li>
            </ul>
            
          </p>
          <input
            type="file"
            name=""
            id=""
            ref="assignPosterBatchFile"
            @change="onPosterBatchFileChanged"
            accept="text/csv"
          />
        </div>
        <div id='poster-assign-preview'>
          <table>
            <thead>
              <tr>
                <th>番号</th>
                <th>ユーザー</th>
                <th>タイトル</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry,i) in posterAssignment" :key="i" :class="{'is-invalid': !entry.valid}">
                <td>{{entry.poster_number}}</td> 
                <td>{{peopleHavingAccessById[entry.user].name}}（{{entry.user}}）</td>
                <td>{{entry.title}}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="margin: 10px">
          <button class="button is-primary" @click="assignPosterBatch">
            送信
          </button>
          <button
            class="button is-default"
            @click="cancelAssignPosterBatchDialog"
          >
            キャンセル
          </button>
        </div>
      </div>
      <button
        class="modal-close is-large"
        aria-label="close"
        @click="assignPosterBatchDialog = false"
      ></button>
    </div>
  </section>
</template>

<script lang="ts">
import * as Papa from "papaparse"
import {
  Room,
  Poster,
  PosterId,
  ChatGroup,
  PersonWithMapAccess,
} from "@/@types/types"
import axiosDefault from "axios"
import { flatten, keyBy, keyByFunc, sortBy } from "@/common/util"
const API_ROOT = "/api"
const axios = axiosDefault.create({ baseURL: API_ROOT })

import axiosClient from "@aspida/axios"
import api from "@/api/$api"

import {
  defineComponent,
  reactive,
  toRefs,
  PropType,
  computed,
  watch,
  ref,
  nextTick,
} from "vue"
import { Cell, PersonInMap, UserId } from "@/api/@types"
import { findUser2 } from "../util"
import { doUploadPoster } from "../room/room_poster_service"

export default defineComponent({
  props: {
    myUserId: {
      type: String,
      required: true,
    },
    locale: {
      type: String,
      enum: ["ja", "en"],
      required: true,
    },
    room: {
      type: Object as PropType<Room>,
      required: true,
    },
    peopleInRoom: {
      type: Object as PropType<{ [index: string]: PersonInMap }>,
      required: true,
    },
    peopleHavingAccess: {
      type: Array as PropType<PersonWithMapAccess[]>,
      required: true,
    },
    posters: {
      type: Object as PropType<{ [poster_id: string]: Poster }>,
      required: true,
    },
    poster_cells: {
      type: Array as PropType<Cell[]>,
      required: true,
    },
  },

  setup(props, context) {
    const state = reactive({
      peopleInRoom: {} as { [user_id: string]: PersonInMap },
      API_ROOT,
      files: {} as { [index: string]: File },
      file_urls: {} as { [poster_id: string]: string },
      dragover: {} as { [poster_id: string]: boolean },
      chatGroups: {} as { [group_id: string]: ChatGroup },
      posterShowMode: (localStorage[
        `virtual-poster:${props.myUserId}:config:admin:posterShowMode`
      ] == "table"
        ? "table"
        : "tile") as "tile" | "table",
      editingPoster: null as PosterId | null,
      announceMarquee: false,
      announceMarqueePeriod: 20,
      roomConfig: {
        allowPosterAssignment: props.room?.allow_poster_assignment,
      },
      peopleWithAccessAllChecked: false as boolean | undefined,
      selectedHavingAccess: {} as { [user_id: string]: boolean },
      searchUserText: null as string | null,
      searchUserTextComposition: false,
      showAllPosterLocations:
        localStorage[
          `virtual-poster:${props.myUserId}:config:admin:showAllPosterLocations`
        ] == "1",
      assignPosterDialog: undefined as number | undefined,
      assignPosterBatchDialog: false,
      posterBatchAssignCsvData: undefined as string | undefined,
      posterAssignment: [] as {
        valid: boolean
        poster_number: number
        user: UserId
        title?: string
      }[],
      accessCodeActive: false,
      dragOverUploadButton: {} as { [poster_id: string]: boolean },
      dragOverPosterTile: {} as { [poster_id: string]: boolean },
      refreshPosterFilesNow: false,
      posterUploadProgress: undefined as
        | {
            file_type: "image/png" | "application/pdf"
            loaded: number
            total: number
          }
        | undefined,
    })

    const client = api(axiosClient(axios))

    const peopleHavingAccessById = computed(() => {
      return keyByFunc(props.peopleHavingAccess, p => p.registered?.id || "NA")
    })

    const refreshPosterFiles = async () => {
      const timer = setTimeout(() => {
        state.refreshPosterFilesNow = true
      }, 200)
      try {
        const r = await client.maps
          ._roomId(props.room.id)
          .posters.refresh_files.$post()
        state.refreshPosterFilesNow = false
        clearTimeout(timer)
        if (!r.ok) {
          alert("ポスターファイルの確認に失敗: " + (r.error || "(N/A)"))
        }
      } catch (err) {
        state.refreshPosterFilesNow = false
        alert("ポスターファイルの確認に失敗: " + (err || "(N/A)"))
      }
    }

    const assignPosterBatchFile = ref<HTMLInputElement>()

    const startAssignPosterBatchDialog = async () => {
      state.assignPosterBatchDialog = true
      await nextTick(() => {
        assignPosterBatchFile.value?.focus()
      })
    }

    const cancelAssignPosterBatchDialog = () => {
      state.assignPosterBatchDialog = false
    }

    const assignPosterBatch = async () => {
      const post_data = state.posterAssignment
        .filter(a => a.valid)
        .map(a => {
          return {
            poster_number: a.poster_number,
            user: a.user,
            title: a.title,
          }
        })
      const r = await client.maps
        ._roomId(props.room.id)
        .poster_slots_multi.$post({ body: { posters: post_data } })
      if (r.ok) {
        alert(`${r.added?.length}件を割り当てました。`)
      } else {
        alert(
          `ポスターの割当てでエラーが発生しました（${r.added?.length}件追加，${r.error_entries?.length}エラー）`
        )
      }
      state.assignPosterBatchDialog = false
    }

    const onPosterBatchFileChanged = async ev => {
      const file: File = (ev.target.files || ev.dataTransfer.files)[0]
      if (file.type != "text/csv") {
        return
      }
      const reader = new FileReader()
      reader.onload = e => {
        state.posterBatchAssignCsvData = (e.target?.result || undefined) as
          | string
          | undefined
        if (state.posterBatchAssignCsvData) {
          state.posterAssignment = []
          const data = Papa.parse(state.posterBatchAssignCsvData)
          if (data.data && data.data.length > 0) {
            for (const r of data.data.slice(1) as string[][]) {
              if (r.length == 1 && r[0] == "") {
                continue
              }
              const poster_number = parseInt(r[0])
              if (isNaN(poster_number)) {
                state.posterAssignment.push({
                  valid: false,
                  poster_number,
                  user: "NA",
                  title: "NA",
                })
                continue
              }
              const user_search_txt: string | undefined = r[1]
              if (!user_search_txt) {
                state.posterAssignment.push({
                  valid: false,
                  poster_number,
                  user: "見つかりません： NA",
                  title: "NA",
                })
                continue
              }
              const user = findUser2(props.peopleHavingAccess, user_search_txt)
              if (!user) {
                state.posterAssignment.push({
                  valid: false,
                  poster_number,
                  user: "見つかりません： " + user_search_txt,
                  title: "NA",
                })
                continue
              }
              const title = !r[2] ? undefined : r[2]
              state.posterAssignment.push({
                valid: true,
                poster_number,
                user,
                title,
              })
            }
          }
        }
      }
      reader.readAsText(file)
    }

    const assignPosterUser = ref<HTMLInputElement>()
    const assignPosterTitle = ref<HTMLTextAreaElement>()

    const cancelAssignPosterDialog = () => {
      assignPosterTitle.value!.value = ""
      assignPosterUser.value!.value = ""
      state.assignPosterDialog = undefined
    }

    const assignPoster = async (poster_number: number) => {
      const title = assignPosterTitle.value?.value
      const search_txt = assignPosterUser.value?.value
      console.log(title, search_txt)
      if (!title || !search_txt) {
        return
      }
      let user_id: UserId | undefined
      if (peopleHavingAccessById.value[search_txt]) {
        user_id = search_txt
      }
      if (!user_id) {
        user_id = props.peopleHavingAccess.find(p => p.email == search_txt)
          ?.registered?.id
      }
      if (!user_id) {
        user_id = props.peopleHavingAccess.find(
          p => p.registered?.name == search_txt
        )?.registered?.id
      }
      if (!user_id) {
        alert("ユーザーが見つかりません。")
        return
      }
      const r = await client.maps
        ._roomId(props.room.id)
        .poster_slots._posterNumber(poster_number)
        .$post({ body: { title, user_id } })
      console.log("assignPoster result", r)
      state.assignPosterDialog = undefined
    }

    const removePosterFile = async (poster_id: PosterId) => {
      if (!confirm("本当に画像を削除していいですか？ 取り消せません。")) {
        return
      }
      const data = await client.posters._posterId(poster_id).file.$delete()
      console.log(data)
      if (data.ok && data.poster) {
        context.emit("set-poster", data.poster.id, data.poster)
      }
    }

    const releasePosterSlot = async (poster: Poster) => {
      if (
        !confirm(
          "本当に開放しますか？ 開放するとポスターへのコメントもすべて削除されます。一度開放すると取り消すことは出来ません。"
        )
      ) {
        return
      }
      const num = poster.poster_number
      if (!num) {
        return
      }
      const r = await client.maps
        ._roomId(poster.room)
        .poster_slots._posterNumber(num)
        .$delete()
      if (r.ok) {
        context.emit("delete-poster", poster.id)
      }
    }

    type PosterListEntry = {
      poster_number: number
      x: number
      y: number
      poster?: Poster
    }

    const postersSorted = computed((): PosterListEntry[] => {
      const postersByLocation = keyBy(Object.values(props.posters), "location")
      if (state.showAllPosterLocations) {
        return props.poster_cells.map(c => {
          return {
            poster_number: c.poster_number!,
            x: c.x,
            y: c.y,
            poster: postersByLocation[c.id],
          }
        })
      } else {
        return sortBy(
          Object.values(props.posters).filter(
            p => p.author && p.room == props.room?.id
          ),
          p => p.poster_number
        ).map(p => {
          return { poster_number: p.poster_number!, x: p.x, y: p.y, poster: p }
        })
      }
    })

    const PosterTitleInput = ref<HTMLInputElement>()

    const startEditingPosterTitle = async (poster_id: PosterId) => {
      state.editingPoster = poster_id
      await nextTick(() => {
        const el = PosterTitleInput.value
        const t = props.posters[poster_id].title
        if (el && t) {
          el.value = t
        }
      })
    }

    const finishEditingPosterTitle = async () => {
      const el = PosterTitleInput.value
      if (state.editingPoster && el) {
        const new_title = el.value
        const p = props.posters[state.editingPoster]
        const r = await client.posters
          ._posterId(p.id)
          .$patch({ body: { title: new_title } })
        state.editingPoster = null
        console.log("patch result", r)
        if (r.ok) {
          context.emit("update-poster", { ...p, title: new_title })
        }
      }
    }

    const cancelEditingPosterTitle = async () => {
      state.editingPoster = null
    }

    const onDropPoster = async (
      event: any,
      poster_id: PosterId,
      source: "tile" | "table"
    ) => {
      const fileList: File[] = event.target.files
        ? event.target.files
        : event.dataTransfer.files
      if (source == "tile") {
        state.dragOverPosterTile[poster_id] = false
      } else {
        state.dragOverUploadButton[poster_id] = false
      }
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
        alert("ファイルはPNGかPDFのみです")
      } else if (file.size >= 10e6) {
        alert("ファイルが>10 MBです")
      } else {
        await doUploadPoster(props.myUserId, axios, state, file, poster_id)
        context.emit("update-poster", {
          ...props.posters[poster_id],
          last_updated: Date.now(),
        })
      }
    }

    watch(
      () => state.showAllPosterLocations,
      () => {
        localStorage[
          `virtual-poster:${props.myUserId}:config:admin:showAllPosterLocations`
        ] = state.showAllPosterLocations ? "1" : "0"
      }
    )

    watch(
      () => state.posterShowMode,
      () => {
        localStorage[
          `virtual-poster:${props.myUserId}:config:admin:posterShowMode`
        ] = state.posterShowMode
      }
    )

    function transposeArray<T>(array: T[][]): T[][] {
      if (!array[0]) {
        return []
      }
      const arrayLength = array.length
      const newArray: T[][] = []
      for (let i = 0; i < array.length; i++) {
        newArray.push([])
      }

      for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < arrayLength; j++) {
          newArray[j].push(array[i][j])
        }
      }

      return newArray
    }

    const startAssignPosterDialog = async (poster: PosterListEntry) => {
      state.assignPosterDialog = poster.poster_number
      await nextTick(() => {
        assignPosterUser.value?.focus()
      })
    }

    const userSearchList = computed(() => {
      return flatten(
        transposeArray(
          props.peopleHavingAccess
            .filter(p => p.registered)
            .map(p => [p.email, p.registered!.name, p.registered!.id])
        )
      )
    })

    return {
      ...toRefs(state),
      peopleHavingAccessById,
      postersSorted,
      refreshPosterFiles,
      assignPoster,
      assignPosterUser,
      assignPosterTitle,
      startAssignPosterDialog,
      cancelAssignPosterDialog,
      userSearchList,
      assignPosterBatch,
      onPosterBatchFileChanged,
      startAssignPosterBatchDialog,
      cancelAssignPosterBatchDialog,
      assignPosterBatchFile,
      removePosterFile,
      releasePosterSlot,
      startEditingPosterTitle,
      finishEditingPosterTitle,
      cancelEditingPosterTitle,
      PosterTitleInput,
      onDropPoster,
    }
  },
})
</script>
<style lang="css">
div.poster {
  border: 1px solid black;
  width: 210px;
  height: 297px;
  margin: 10px;
  float: left;
}

div.poster.drag-hover {
  border: 3px solid red;
  background: lightblue;
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
  margin: 0px;
}

div.poster-img {
  border: 1px solid black;
  /* width: 280px; */
  /* height: calc(280px * 1.414); */
  min-height: 300px;
  max-height: 600px;
  top: 80px;
  margin: 10px;
}

div.poster-img.drag-hover {
  border: #99f 3px solid;
  box-sizing: border-box;
}

div.poster-img img {
  /* width: auto; */
  max-width: 400px;
  max-height: 550px;
}

.poster-image-note {
  margin: 0px 0px 0px 10px;
}

.poster_info {
  /* position: absolute; */
  width: 180px;
  margin: 10px;
}

.poster_author {
  margin: 0px;
}

.poster_title {
  margin: 0px;
  height: 80px;
  font-size: 14px;
}

.poster_title .text {
  font-weight: bold;
  margin: 3px 0px 0px 4px;
}

.poster-entry .room,
.poster-entry .poster-number {
  font-size: 12px;
}

input.poster-title-input {
  width: 100%;
}

.modal .modal-content {
  background: white;
  box-shadow: 0px 8px 16px -2px rgba(10, 10, 10, 0.1),
    0px 0px 0px 1px rgba(10, 10, 10, 0.02);
  padding: 30px;
}

#assign-poster-dialog .modal-content h1 {
  font-weight: bold;
  font-size: 20px;
}

#assign-poster-dialog .modal-background {
  background: rgba(0, 0, 0, 0.2);
}

#assign-poster-dialog label {
  display: inline-block;
  width: 100px;
}

#assign-poster-dialog input[type="text"],
#assign-poster-dialog textarea {
  width: 400px;
}

div.dropping {
  background: orange !important;
}

#poster-assign-preview {
  max-height: 300px;
  overflow: scroll;
}

#poster-assign-preview tr.is-invalid {
  color: red;
}
</style>