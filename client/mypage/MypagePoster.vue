<template>
  <div class="tab-content">
    <h5 class="title is-5"></h5>
    <div v-if="!posters">{{ lang("no_poster") }}</div>
    <div class="box" v-for="poster in posters" :key="poster.id">
      <div class="columns is-desktop">
        <div class="column is-one-third">
          <div
            v-if="!!poster && rooms[poster.room]?.allow_poster_assignment"
            class="poster-img"
            :class="{ 'drag-hover': dragover[poster.id] }"
            @dragover.prevent
            @drop.prevent="onDrop($event, poster.id)"
            @dragover="dragover[poster.id] = true"
            @dragleave="dragover[poster.id] = false"
          >
            <figure class="image is-3x5">
              <img
                v-if="poster.file_url"
                :src="dataURI[poster.id]"
                alt="Image"
              />
              <div
                class="poster-upload-progress"
                v-else-if="
                  uploadingPosterId == poster.id &&
                  posterUploadProgress &&
                  (posterUploadProgress.loaded < posterUploadProgress.total ||
                    posterUploadProgress.file_type == 'image/png')
                "
              >
                {{ posterUploadProgress.loaded }} /
                {{ posterUploadProgress.total }} バイト（{{
                  Math.round(
                    (posterUploadProgress.loaded / posterUploadProgress.total) *
                      100
                  )
                }}%）
              </div>
              <div
                class="poster-upload-progress"
                v-else-if="
                  uploadingPosterId == poster.id &&
                  posterUploadProgress &&
                  posterUploadProgress.loaded == posterUploadProgress.total &&
                  posterUploadProgress.file_type == 'application/pdf'
                "
              >
                {{ lang("converting") }}...
              </div>

              <span v-else>{{ lang("no_image") }}</span>
            </figure>
          </div>
          <div
            v-if="!!poster && !rooms[poster.room]?.allow_poster_assignment"
            class="poster-img"
          >
            <figure class="image is-3x5">
              <img
                v-if="poster.file_url"
                :src="dataURI[poster.id]"
                alt="Image"
              />
              <span v-else>{{ lang("no_image") }}</span>
            </figure>
          </div>
          <small
            class="poster-image-note"
            v-if="rooms[poster.room]?.allow_poster_assignment"
            >{{ lang("drop_image") }}</small
          >
          <small class="poster-image-note" v-else>{{
            lang("cannot_change")
          }}</small>
        </div>
        <div class="column is-two-thirds">
          <div class="poster_title">
            <small>
              <span class="room">{{ rooms[poster.room].name }}</span
              ><span class="poster-number">#{{ poster.poster_number }}: </span>
            </small>
            <br />
            <input
              ref="inputTitle"
              id="input-title"
              v-if="editingTitle == poster.id"
              type="text"
              @keydown.enter="$event.keyCode == 13 ? setTitle(poster) : null"
            />
            <div class="text" v-else>
              {{
                !poster.title || poster.title == "" ? "(無題)" : poster.title
              }}
            </div>
            <div>
              <button
                v-if="
                  editingTitle != poster.id &&
                  rooms[poster.room]?.allow_poster_assignment
                "
                @click="onClickEditTitle(poster)"
                class="button is-primary is-small"
              >
                {{ lang("change_title") }}
              </button>
              <button
                v-if="editingTitle == poster.id"
                @click="setTitle(poster)"
                class="button is-primary is-small"
              >
                完了
              </button>
            </div>
          </div>
          <div class="poster-settings">
            <div>
              <input
                type="checkbox"
                name=""
                :id="'only-online-' + poster.id"
                v-model="poster.author_online_only"
                @change="
                  onChangeToggle(
                    'author_online_only',
                    poster.id,
                    $event.target.checked
                  )
                "
              />
              <label :for="'only-online-' + poster.id">{{
                lang("hide_offline")
              }}</label>
            </div>
            <div>
              <input
                type="checkbox"
                name=""
                :id="'access-log-' + poster.id"
                v-model="poster.access_log"
                @change="
                  onChangeToggle('access_log', poster.id, $event.target.checked)
                "
              />
              <label :for="'access-log-' + poster.id">{{
                lang("visit_history")
              }}</label>
            </div>
            <div>
              <input
                type="checkbox"
                name=""
                :id="'watermark-' + poster.id"
                v-model="hasWatermark[poster.id]"
                @change="
                  onChangeToggle('watermark', poster.id, $event.target.checked)
                "
              />
              <label :for="'watermark-' + poster.id">{{
                lang("watermark")
              }}</label>
            </div>
          </div>

          <div class="poster-logs">
            <h5 class="title is-5" style="margin-bottom: 3px">
              {{ lang("history") }}
            </h5>
            <div class="poster-logs-entries">
              <ul>
                <li
                  v-for="history in view_history[poster.id]"
                  :key="'' + history.user_id + '-' + history.joined_time"
                >
                  {{ people[history.user_id].name }}
                  {{ formatTime(new Date(history.last_active)) }}
                </li>
              </ul>
            </div>
          </div>
          <button
            class="remove-poster button is-danger"
            @click="removePosterFile(poster.id)"
            :disabled="!poster.file_url"
            v-if="rooms[poster.room]?.allow_poster_assignment"
          >
            {{ lang("delete_image") }}
          </button>
          <button
            v-if="rooms[poster.room]?.allow_poster_assignment"
            class="release-poster-slot button is-danger"
            @click="releasePosterSlot(poster)"
          >
            {{ lang("release_slot") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  reactive,
  toRefs,
  PropType,
  watch,
  ref,
  nextTick,
  onMounted,
} from "vue"
import { Poster, PosterId, Room, UserId, PersonWithEmail } from "@/@types/types"
import { formatTime } from "../util"
import axiosDefault from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"
import { doUploadPoster } from "../room/room_poster_service"
import { Person } from "@/api/@types"
const API_ROOT = "/api"
const axios = axiosDefault.create()
axios.defaults.baseURL = API_ROOT
const client = api(axiosClient(axios))

export default defineComponent({
  props: {
    locale: {
      type: String,
      enum: ["ja", "en"],
      required: true,
    },
    posters: {
      type: Array as PropType<Poster[]>,
      required: true,
    },
    people: { type: Object as PropType<{ [index: string]: PersonWithEmail }> },
    myself: { type: Object as PropType<Person>, required: true },
    rooms: {
      type: Object as PropType<{ [room_id: string]: Room }>,
      required: true,
    },
    lastLoaded: {
      type: Number,
      required: true,
    },
    view_history: {
      type: Object as PropType<{
        [index: string]: { user_id: UserId; joined_time: number }[]
      }>,
      required: true,
    },
  },
  setup(props, context) {
    const state = reactive({
      dragover: {} as { [poster_id: string]: boolean },
      dataURI: {} as { [poster_id: string]: string },
      editingTitle: null as PosterId | null,

      posterUploadProgress: undefined as
        | {
            file_type: "image/png" | "application/pdf"
            loaded: number
            total: number
          }
        | undefined,
      uploadingPosterId: undefined as string | undefined,
      hasWatermark: {} as { [poster_id: string]: boolean },
    })

    const lang = (key: string): string => {
      const message: {
        [key in string]: { [key in "ja" | "en"]: string }
      } = {
        no_poster: {
          ja: "ポスターがありません。",
          en: "You have no poster.",
        },
        converting: {
          ja: "PDFからPNGへの変換中",
          en: "Converting from PDF to PNG",
        },
        no_image: {
          ja: "画像なし",
          en: "No image",
        },
        change_title: {
          ja: "タイトルを変更",
          en: "Change title",
        },
        delete_image: {
          ja: "画像を削除",
          en: "Delete image",
        },
        release_slot: {
          ja: "ポスター枠を開放",
          en: "Release poster slot",
        },
        drop_image: {
          ja:
            "枠内にPNG（推奨）あるいはPDFをドラッグ＆ドロップでポスターを掲載（10 MB以内）",
          en:
            "Drag and drop a poster PNG (recommended) or PDF file (up to 10 MB) into the frame",
        },
        cannot_change: {
          ja: "会場のオーナーの設定により，画像やタイトルの変更はできません",
          en:
            "The room owner does not allow users to change images and titles.",
        },
        hide_offline: {
          ja: "自分がオフラインの時にポスター画像を隠す",
          en: "Hide the poster image when you are offline",
        },
        visit_history: {
          ja: "足あと（閲覧記録）を記録・公開する",
          en: "Record and disclose the access log",
        },
        watermark: {
          ja: "閲覧時に透かしを表示させる",
          en: "Show watermarks",
        },
        history: {
          ja: "ポスターの閲覧履歴",
          en: "Access log",
        },
        file_type: {
          ja: "ファイル形式はPDFあるいはPNGのみ対応しています。",
          en: "Only PDF and PNG files are supported.",
        },
        file_size: {
          ja: "ファイルサイズを10MB以下にしてください。",
          en: "File size must be less than 10 MB.",
        },
        uploaded: {
          ja: "ポスター画像をアップロードしました。",
          en: "Poster image was uploaded.",
        },
      }
      return message[key][props.locale]
    }

    for (const p of props.posters) {
      console.log(p)
      if (p.watermark) {
        state.hasWatermark[p.id] = true
      }
    }

    const inputTitle = ref<HTMLInputElement>()
    const setTitle = async (poster: Poster) => {
      const title = inputTitle.value?.value
      const data = await client.posters
        ._posterId(poster.id)
        .$patch({ body: { title } })
      if (data.ok) {
        await nextTick(() => {
          //Vue.set
          context.emit("set-poster", poster.id, { ...poster, title })
        })
        await nextTick(() => {
          state.editingTitle = null
        })
      }
    }

    const onClickEditTitle = async (poster: Poster) => {
      state.editingTitle = poster.id
      await nextTick(() => {
        console.log("onClickEditTitle", inputTitle.value)
        if (inputTitle.value) {
          inputTitle.value.value = poster.title || ""
          inputTitle.value.focus()
        }
      })
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
        alert(lang("file_type"))
      } else if (file.size >= 10e6) {
        console.error("File size loo large")
        alert(lang("file_size"))
      } else {
        const fd = new FormData() //★②
        fd.append("file", file)
        console.log(fd)

        const poster = props.posters.find(p => p.id == poster_id)
        context.emit("set-poster", poster_id, {
          ...poster,
          file_url: undefined,
        })

        state.uploadingPosterId = poster_id
        const data = await doUploadPoster(
          props.myself.id,
          axios,
          state,
          file,
          poster_id
        )
        state.uploadingPosterId = undefined
        const url = (await client.posters._posterId(poster_id).file_url.$get())
          .url

        context.emit("set-poster", poster_id, {
          ...props.posters[poster_id],
          file_url: url,
          last_updated: Date.now(),
        })
        if (url) {
          state.dataURI[poster_id] = url
        }

        alert(lang("uploaded"))
      }
    }

    const loadPosterImages = async () => {
      let loaded_any = false
      for (const poster of Object.values(props.posters)) {
        console.log(
          "loadPosterImages",
          poster,
          props.lastLoaded,
          poster.last_updated
        )
        // if (props.lastLoaded > poster.last_updated) {
        //   continue
        // }
        loaded_any = true
        console.log("Loading poster")
        let url: string | undefined = poster.file_url
        if (url == "not_disclosed") {
          url = (await client.posters._posterId(poster.id).file_url.$get()).url
        }
        // if (!url) {
        //   url = "/api/posters/" + poster.id + "/file"
        // }
        console.log("get poster ", poster.id, url)
        if (url) {
          state.dataURI[poster.id] = url
        }
      }
      if (loaded_any) {
        context.emit("update-last-loaded", Date.now())
      }
    }

    onMounted(async () => {
      await loadPosterImages()
    })

    watch(
      () => props.posters,
      async () => {
        for (const p of props.posters) {
          console.log(p)
          if (p.watermark) {
            state.hasWatermark[p.id] = true
          }
        }

        await loadPosterImages()
      }
    )

    const removePosterFile = async (poster_id: PosterId) => {
      const data = await client.posters._posterId(poster_id).file.$delete()
      console.log(data)
      if (data.ok && data.poster) {
        context.emit("set-poster", data.poster.id, data.poster)
        state.dataURI[data.poster.id] = ""
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

    const onChangeToggle = async (
      key: "access_log" | "author_online_only" | "watermark",
      pid,
      flag
    ) => {
      const body =
        key == "access_log"
          ? { access_log: flag }
          : key == "author_online_only"
          ? { author_online_only: flag }
          : { watermark: flag ? 7 : 0 }
      await client.posters._posterId(pid).patch({
        body,
      })
    }

    return {
      ...toRefs(state),
      formatTime,
      onDrop,
      removePosterFile,
      onClickEditTitle,
      inputTitle,
      setTitle,
      releasePosterSlot,
      onChangeToggle,
      lang,
    }
  },
})
</script>

<style lang="css" scoped>
/* @import "../../node_modules/bulma/css/bulma.css"; */

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
  width: calc(100% - 400px);
  margin: 10px;
}

.poster_author {
  margin: 0px;
}

.poster_title {
  margin: 0px;
  height: 80px;
}

.poster_title .text {
  font-weight: bold;
  margin: 3px 0px 0px 4px;
}

.poster-entry .room,
.poster-entry .poster-number {
  font-size: 12px;
}

button.remove-poster {
  margin: 10px 10px 10px 0px;
}

button.release-poster-slot {
  margin: 10px 10px 10px 0px;
}
.poster-logs-entries {
  border: 1px solid #ccc;
  height: 190px;
  overflow-y: scroll;
  font-size: 14px;
}

.poster-logs-entries ul {
  margin: 0px;
}

.box {
  background: rgb(237, 237, 237);
}

#input-title {
  width: 100%;
  min-width: 100px;
  font-size: 16px;
  height: 24px;
}

.poster-settings {
  margin: 10px 0px;
  line-height: 1.2em;
}
</style>
