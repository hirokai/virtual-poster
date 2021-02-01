<template>
  <div :class="{ dark: darkMode, mobile: isMobile }" :style="cssVars">
    <transition :name="isMobile ? '' : 'fade'">
      <div
        id="poster-container"
        v-show="poster && (!isMobile || mobilePane == 'poster')"
        :class="{ mobile: isMobile }"
        @resize="onResizePosterContainer"
      >
        <h2 :class="{ me: isMyPoster }" id="poster-title">
          <span class="number_author"
            >{{ poster ? "#" + poster.poster_number + ": " : "" }}
            {{
              poster
                ? people[poster.author]
                  ? people[poster.author].name
                  : ""
                : ""
            }}:</span
          >
          {{ poster ? poster.title : "" }}
        </h2>
        <div id="poster-tools" :class="{ me: isMyPoster }">
          <img
            @click="zoomIn"
            class="toolbar-icon"
            src="/img/icon/zoom-in.png"
            width="25"
            height="25"
          />
          <img
            @click="zoomOut"
            class="toolbar-icon"
            src="/img/icon/zoom-out.png"
            width="25"
            height="25"
          />
          <img
            @click="zoomFit"
            class="toolbar-icon"
            src="/img/icon/maximize.png"
            width="25"
            height="25"
          />
          <img
            @click="editPoster"
            v-if="isMyPoster"
            class="toolbar-icon"
            src="/img/icon/edit.png"
            width="25"
            height="25"
            style="margin-right: 5px"
          />
        </div>
        <div
          id="poster"
          ref="posterImage"
          :class="{ inactive: !poster }"
          :style="{
            'background-image': offline_disallowed
              ? ''
              : 'url(' + posterDataURI + ')',
            'background-position': '' + imagePos.x + 'px ' + imagePos.y + 'px',
            'background-size': '' + imageMag * 100 + '%',
          }"
          @mouseup="mouseUpPoster"
          @mousedown="mouseDownPoster"
          @mousemove="mouseMovePoster"
        >
          <div
            id="poster-notfound"
            v-if="!!poster && posterStatus == 'not_found' && poster.author"
            :class="{ dragover: dragOver }"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="poster ? onDropMyPoster($event, poster.id) : ''"
          >
            {{
              locale == "ja"
                ? `${
                    people[poster.author]
                      ? people[poster.author].name
                      : "（不明）"
                  }さんのポスター`
                : `${
                    people[poster.author]
                      ? people[poster.author].name
                      : "(unknown)"
                  }'s poster`
            }}
            {{}}<br />（{{
              locale == "ja"
                ? "ポスター板の場所が確保されていますが"
                : "Poster board is taken, but"
            }}<br />{{
              locale == "ja"
                ? "画像はアップロードされていません。"
                : "poster is not uploaded."
            }}）
            <div class="note" v-if="isMyPoster && isMobile">
              {{
                locale == "ja"
                  ? "マイページ（画面上部の人型のアイコン）→ポスターからアップロードしてください。"
                  : "Upload your poster from Preferences page."
              }}
            </div>
            <div class="note" v-if="isMyPoster && !isMobile && !uploadProgress">
              {{
                locale == "ja"
                  ? "以下のいずれかの方法でファイル（PNGあるいはPDF）を"
                  : "Upload your poster by any of the following options"
              }}<br />{{ locale == "ja" ? "アップロードできます。" : "" }}
              <ol>
                <li>
                  {{
                    locale == "ja"
                      ? "この枠内にPNG（推奨）またはPDFをドラッグ＆ドロップする"
                      : "Drag & drop a PNG (recommended) or PDF into this frame"
                  }}
                </li>
                <li>
                  {{
                    locale == "ja"
                      ? "マップ中の木札のアイコンにドラッグ（赤枠が表示されます）＆ドロップする"
                      : "Drag & drop a file to a wood post in the map"
                  }}
                </li>
                <li>
                  {{
                    locale == "ja"
                      ? "マイページ（画面上部の人型のアイコン）→ポスター でドラッグ＆ドロップする"
                      : "Drag & drop a file in Preferences -> Posters"
                  }}
                </li>
              </ol>
            </div>
            <div
              class="poster-upload-progress"
              v-if="
                isMyPoster &&
                !isMobile &&
                uploadProgress &&
                (uploadProgress.loaded != uploadProgress.total ||
                  uploadProgress.file_type == 'image/png')
              "
            >
              {{ uploadProgress.loaded }} / {{ uploadProgress.total }}
              {{ lang("bytes") }}（{{
                Math.round(
                  (uploadProgress.loaded / uploadProgress.total) * 100
                )
              }}%）
            </div>
            <div
              class="poster-upload-progress"
              v-if="
                isMyPoster &&
                !isMobile &&
                uploadProgress &&
                uploadProgress.loaded == uploadProgress.total &&
                uploadProgress.file_type == 'application/pdf'
              "
            >
              PDFからPNGへの変換中...
            </div>
          </div>
          <div
            id="poster-notfound"
            v-if="offline_disallowed"
            :class="{ dragover: dragOver }"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="poster ? onDropMyPoster($event, poster.id) : ''"
          >
            {{
              people[poster.author] ? people[poster.author].name : "（不明）"
            }}
            {{ locale == "ja" ? "さんのポスター" : "'s poster" }}<br />{{
              locale == "ja"
                ? "（発表者がオフラインのため閲覧できません）"
                : "(You cannot view this poster when the author is offline.)"
            }}
          </div>
          <div
            id="poster-notfound"
            v-if="!!poster && posterStatus == 'checking' && poster.author"
          >
            {{
              locale == "ja"
                ? `${
                    people[poster.author]
                      ? people[poster.author].name
                      : "（不明）"
                  }さんのポスターをロード中`
                : `Loading ${
                    people[poster.author]
                      ? people[poster.author].name
                      : "(unknown)"
                  }'s poster`
            }}...{{
              posterDownloadProgress
                ? "（" + Math.floor(posterDownloadProgress * 100) + "%）"
                : ""
            }}
          </div>
          <div id="poster-inactive" v-if="!poster">
            {{ lang("near_to_poster") }}
          </div>
          <div id="detail"></div>
        </div>
      </div>
    </transition>
    <transition :name="isMobile ? '' : 'fade'">
      <h3
        id="poster-comment-title"
        v-if="poster && (!isMobile || mobilePane == 'poster_chat')"
      >
        {{ lang("poster_comments") }}
      </h3>
    </transition>
    <transition :name="isMobile ? '' : 'fade'">
      <div
        id="poster-comments-container"
        class="chat-container"
        :class="{ poster_active: !!poster }"
        :style="{
          width: isMobile ? '100vw' : undefined,
          top: isMobile ? '0px' : undefined,
          bottom: isMobile ? '' : '' + (102 + numInputRows * 20) + 'px',
          height: isMobile
            ? 'calc(100vh - 100vw / 6 - 100px - 20px * ' + numInputRows + ')'
            : '',
        }"
        v-if="poster && (!isMobile || mobilePane == 'poster_chat')"
      >
        <div id="poster-comments" @scroll="onScroll">
          <div
            v-for="c in posterCommentHistory"
            class="poster-comment-entry comment-entry"
            :class="{
              replying: replying && replying.id == c.id,
              editing: editingOld && c.id == editingOld,
              highlight: !c.read,
            }"
            :key="c.timestamp + c.person + c.to + c.kind"
            :id="'poster-comment-entry-' + c.id"
            @mouseenter="$emit('read-comment', poster.id, c.id, true)"
          >
            <MyPicker
              v-if="showEmojiPicker && showEmojiPicker == c.id"
              :locale="locale"
              @select="emoji => selectEmoji(c, emoji)"
              @close-emoji-picker="showEmojiPicker = undefined"
            />
            <div
              v-if="c.event == 'comment'"
              :style="{
                'margin-left': '' + inRange(c.__depth - 1, 0, 5) * 30 + 'px',
              }"
            >
              <div class="local-entry-header">
                <span class="comment-name">{{
                  people[c.person]?.name || "名前不明" + JSON.stringify(c)
                }}</span>
                <span class="comment-time">{{ formatTime(c.timestamp) }}</span>

                <span
                  class="comment-entry-tool"
                  id="show_emoji_picker"
                  @click="clickShowEmoji(c)"
                >
                  😀
                </span>
                <span
                  v-if="c.__depth <= 3"
                  class="comment-entry-tool"
                  @click="startReply(c)"
                  >{{ lang("reply") }}</span
                >
                <span
                  class="comment-entry-tool"
                  @click="speechText(c.text_decrypted || '')"
                  >{{ lang("dictate") }}</span
                >
                <span
                  v-if="myself && c.person == myself.id"
                  class="comment-entry-tool comment-delete"
                  @click="$emit('delete-comment', poster.id, c.id)"
                  >{{ lang("delete") }}</span
                >
                <span
                  v-if="myself && c.person == myself.id"
                  class="comment-entry-tool comment-edit"
                  @click="startUpdateComment(c.id)"
                  >{{ lang("edit") }}</span
                >
              </div>

              <div
                class="comment-content"
                v-html="c.text_decrypted?.replace(/[\r\n]/g, '<br>')"
              ></div>
              <div
                class="reactions"
                v-if="c.reactions && Object.keys(c.reactions).length > 0"
              >
                <span
                  :class="{
                    'reaction-entry': true,
                    'my-reaction': !!r[myself.id],
                  }"
                  v-for="(r, reaction) in c.reactions"
                  :key="reaction"
                  @click="clickReaction(c, r[myself.id], reaction)"
                  >{{ reaction }}
                  <span class="count">{{ Object.keys(r).length }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
    <div
      id="poster-chat-input-container"
      class="chat-input-container"
      :class="{ replying: !!replying, editing: !!editingOld }"
      v-if="poster && (!isMobile || mobilePane == 'poster_chat')"
    >
      <textarea
        ref="PosterCommentInput"
        id="poster-chat-input"
        :rows="numInputRows"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        @input="onInput"
        @focus="$emit('on-focus-input', true)"
        @blur="$emit('on-focus-input', false)"
        @keydown.enter="onKeyDownEnterPosterCommentInput"
        :placeholder="lang('shift_enter_send')"
      ></textarea>
      <button
        id="submit-poster-comment"
        @click="clickSubmit"
        :disabled="!PosterCommentInput || PosterCommentInput.value?.value == ''"
      >
        <img
          class="icon"
          src="/img/icon/right-arrow.png"
          :alt="editingOld ? lang('save') : lang('send')"
        />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {
  Poster as PosterTyp,
  Point,
  Person,
  CommentId,
  ChatCommentDecrypted,
  CommentHistoryEntry,
  CommentEvent,
  DateEvent,
  Tree,
} from "@/@types/types"
import { inRange, flattenTree } from "@/common/util"
import axiosDefault from "axios"
import { countLines, formatTime } from "../util"
import { sameDate, formatDate } from "./room_chat_service"
import { AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"

const API_ROOT = "/api"
const axios = axiosDefault.create()
axios.defaults.baseURL = API_ROOT

import {
  defineComponent,
  reactive,
  watch,
  toRefs,
  ref,
  computed,
  PropType,
  onMounted,
  nextTick,
} from "vue"

import MyPicker from "./MyPicker.vue"
import { PosterId } from "@/api/@types"

const drawWaterMark = async (
  image_base64: string,
  myself: Person,
  density: number,
  maxWidth: number,
  maxHeight: number
): Promise<string> => {
  console.log("drawWaterMark!")
  const image = document.createElement("img")
  image.src = image_base64
  return new Promise(resolve => {
    image.addEventListener("load", () => {
      // document.body.appendChild(image)
      const canvas = document.createElement("canvas")
      const width = Math.min(
        maxWidth,
        (maxHeight * image.naturalWidth) / image.naturalHeight
      )
      const height = Math.min(
        maxHeight,
        (maxWidth * image.naturalHeight) / image.naturalWidth
      )
      const maxImageWidth = 2100
      canvas.width = maxImageWidth
      canvas.height = (image.naturalHeight * maxImageWidth) / image.naturalWidth
      const context = canvas.getContext("2d")
      if (!context) {
        resolve(image_base64)
      } else {
        context.drawImage(
          image,
          0,
          0,
          image.naturalWidth,
          image.naturalHeight,
          0,
          0,
          canvas.width,
          canvas.height
        )
        context.font = "60px Sans-Serif"
        context.fillStyle = `rgba(0,0,255,${density / 100})`
        const d = new Date()
        for (let i = 0; i < 10; i++) {
          for (let j = 0; j < 2; j++) {
            context.fillText(
              "閲覧者： " + myself.name + "(" + myself.id + ")",
              j * 1200,
              i * 400 + j * 200
            )
            context.fillText(
              "閲覧日： " +
                d.getFullYear() +
                "年" +
                (1 + d.getMonth()) +
                "月" +
                d.getDate() +
                "日",
              j * 1200,
              i * 400 + 70 + j * 200
            )
          }
        }
        resolve(canvas.toDataURL())
      }
    })
  })
}

export default defineComponent({
  components: {
    MyPicker,
  },
  props: {
    locale: {
      type: String as PropType<"ja" | "en">,
      required: true,
    },
    poster: {
      type: Object as PropType<PosterTyp>,
    },
    people: {
      type: Object as PropType<{ [index: string]: Person }>,
      required: true,
    },
    editingOld: {
      type: String,
    },
    myself: {
      type: Object as PropType<Person>,
    },
    comments: {
      type: Object as PropType<{ [index: string]: ChatCommentDecrypted }>,
      required: true,
    },
    commentTree: {
      type: Object as PropType<Tree<ChatCommentDecrypted>>,
      required: true,
    },
    isMobile: {
      type: Boolean,
      required: true,
    },
    mobilePane: {
      type: String,
    },
    axios: {
      type: Function as PropType<AxiosInstance>,
      required: true,
    },
    uploadProgress: {
      type: Object as PropType<{ loaded: number; total: number }>,
    },
    darkMode: {
      type: Boolean,
      required: true,
    },
    highlightUnread: {
      type: Object as PropType<{ [comment_id: string]: boolean }>,
      required: true,
    },
    mapCellSize: {
      type: Number,
      required: true,
    },
  },
  emits: [
    "set-poster-container-width",
    "set-editing-old",
    "upload-poster",
    "submit-poster-comment",
    "add-emoji-reaction",
    "read-comment",
    "set-poster",
  ],
  setup(props, context) {
    const state = reactive({
      posterDataURI: "",
      posterStatus: "unknown" as
        | "unknown"
        | "inactive"
        | "checking"
        | "found"
        | "not_found",
      prevPos: { x: 0, y: 0 },
      delta: { x: 0, y: 0 },
      imagePos: { x: 0, y: 0 },
      mouseDown: false,
      imageMag: 1,
      imageMags: [0.1, 0.2, 0.3, 0.5, 0.67, 1, 1.2, 1.5, 2, 3, 4, 5],
      imageMagIndex: 5,
      dragOver: false,
      voice: null as SpeechSynthesisVoice | null,
      composing: false,
      showEmojiPicker: undefined as CommentId | undefined,
      replying: undefined as CommentEvent | undefined,
      showDateEvent: false,
      numInputRows: 1,
      posterDownloadProgress: undefined as number | undefined,
      initialScrollDone: true, //Stub
      visibleComments: {} as { [comment_id: string]: boolean },
    })

    const lang = (key: string): string => {
      const message: {
        [key in string]: { [key in "ja" | "en"]: string }
      } = {
        reply: {
          ja: "返信",
          en: "Reply",
        },
        dictate: {
          ja: "読み上げ",
          en: "Read",
        },
        delete: {
          ja: "削除",
          en: "Delete",
        },
        edit: {
          ja: "編集",
          en: "Edit",
        },
        send: {
          ja: "送信",
          en: "Send",
        },

        save: {
          ja: "保存",
          en: "Save",
        },
        shift_enter_send: {
          ja: "Shift+Enterでポスターにコメント",
          en: "Shift+Enter to comment on the poster",
        },
        poster_comments: {
          ja: "ポスターへのコメント",
          en: "Comments on the poster",
        },
        near_to_poster: {
          ja: "ポスターに近づくと表示されます",
          en: "Get closer to show a poster",
        },
        file_too_large: {
          ja: "ファイルサイズを10MB以下にしてください。",
          en: "File size must be less than 10 MB.",
        },
        bytes: {
          ja: "バイト",
          en: "bytes",
        },
      }
      return message[key][props.locale]
    }

    const isMyPoster = computed(() => {
      return !!props.poster?.author && props.poster?.author == props.myself?.id
    })

    const PosterCommentInput = ref<HTMLTextAreaElement>()
    const posterCommentHistory = computed((): CommentHistoryEntry[] => {
      const comments = flattenTree(props.commentTree).map(c => {
        return {
          ...c,
          event: "comment",
          encrypted_for_all: false,
        } as CommentEvent
      })
      console.log("posterCommentHistory comments", props.commentTree, comments)

      if (!state.showDateEvent) {
        return comments
      } else {
        const comments_with_date: CommentHistoryEntry[] = []
        if (comments.length > 0) {
          comments_with_date.push({
            event: "new_date",
            date_str: formatDate(comments[0].timestamp),
          } as DateEvent)
        }
        let prev_toplevel = 0
        for (let i = 0; i < comments.length; i++) {
          const toplevel = comments[i].__depth == 1
          if (
            toplevel &&
            !sameDate(comments[prev_toplevel].timestamp, comments[i].timestamp)
          ) {
            comments_with_date.push({
              event: "new_date",
              date_str: formatDate(comments[i].timestamp),
              timestamp: comments[i].timestamp - 1,
            } as DateEvent)
          }
          comments_with_date.push(comments[i])
          if (toplevel) {
            prev_toplevel = i
          }
        }

        return comments_with_date
      }
    })

    const offline_disallowed = computed(() => {
      return (
        !!props.poster &&
        props.poster.author_online_only &&
        !props.people[props.poster.author].connected &&
        !!props.poster.author
      )
    })

    const startUpdateComment = (cid: string) => {
      context.emit("set-editing-old", cid)
      state.replying = undefined
      if (!PosterCommentInput.value) {
        console.error("Poster comment textarea ref not found")
        return
      }
      PosterCommentInput.value.value = props.comments[cid].text_decrypted
      PosterCommentInput.value.focus()
    }
    watch(
      () => [props.poster?.last_updated, props.poster?.file_url],
      async () => {
        const client = api(axiosClient(props.axios))
        console.log("watch poster invoked", props.poster)
        state.posterStatus = "checking"
        let signed_file_url: string | undefined = undefined
        if (props.poster && props.poster?.file_url == "not_disclosed") {
          const r = await client.posters
            ._posterId(props.poster.id)
            .file_url.$get()
          signed_file_url = r.url
        }
        // console.log(signed_file_url)
        if (
          props.poster &&
          (signed_file_url || props.poster?.file_url != "not_disclosed")
        ) {
          if (state.posterDownloadProgress != undefined) {
            return
          }
          state.posterDownloadProgress = 0
          axiosDefault({
            method: "GET",
            url: signed_file_url || props.poster.file_url,
            responseType: "arraybuffer",
            onDownloadProgress: progressEvent => {
              // console.log(
              //   progressEvent.loaded,
              //   progressEvent.total,
              //   progressEvent
              // )
              state.posterDownloadProgress =
                progressEvent.loaded / progressEvent.total
            },
          })
            .then(res => {
              console.log(res)
              state.posterStatus = res.status == 404 ? "not_found" : "found"
              state.posterDownloadProgress = undefined
              if (state.posterStatus == "found") {
                const image =
                  "data:image/png;base64," +
                  btoa(
                    new Uint8Array(res.data).reduce(
                      (d, byte) => d + String.fromCharCode(byte),
                      ""
                    )
                  )
                if (props.poster?.watermark) {
                  const w = document.querySelector("#poster")?.clientWidth || 0
                  const h = document.querySelector("#poster")?.clientHeight || 0
                  drawWaterMark(
                    image,
                    props.myself!,
                    props.poster.watermark,
                    w,
                    h
                  )
                    .then(img => {
                      state.posterDataURI = img
                    })
                    .catch(err => {
                      //
                    })
                } else {
                  state.posterDataURI = image
                }
              }
            })
            .catch(() => {
              console.log("not found poster")
              state.posterDownloadProgress = undefined
              state.posterStatus = "not_found"
              state.posterDataURI = ""
            })
        } else {
          state.posterStatus = "inactive"
          state.posterDataURI = ""
        }
      }
    )

    const onInput = async ev => {
      if (!PosterCommentInput.value) {
        console.error("Poster comment textarea ref not found")
        state.numInputRows = 1
      } else if (PosterCommentInput.value.value == "") {
        state.numInputRows = 1
      } else {
        const c = countLines(PosterCommentInput.value)
        state.numInputRows = Math.min(c, 15)
      }
    }

    const speechText = (text: string) => {
      window.speechSynthesis.cancel()

      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = "ja-JP"
      window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices()
        // console.log(voices)
        for (const voice of voices) {
          if (voice.lang == "ja-JP") {
            console.log(utter)
            console.log(voice)
            state.voice = voice
            utter.voice = voice
            break
          }
        }
      }
      const voices = window.speechSynthesis.getVoices()
      state.voice = voices.filter(v => v.lang == "ja-JP")[0]
      utter.voice = state.voice
      console.log(voices.filter(v => v.lang == "ja-JP"))

      window.speechSynthesis.speak(utter)
    }

    const clearInput = () => {
      if (!PosterCommentInput.value) {
        console.error("Poster comment textarea ref not found")
        return
      }
      PosterCommentInput.value.value = ""
    }

    const posterImage = ref<Element>()

    const zoomIn = () => {
      const idx = inRange(
        state.imageMagIndex + 1,
        0,
        state.imageMags.length - 1
      )
      state.imageMag = state.imageMags[idx]
      state.imageMagIndex = idx
    }

    const zoomOut = () => {
      const idx = inRange(
        state.imageMagIndex - 1,
        0,
        state.imageMags.length - 1
      )
      state.imageMag = state.imageMags[idx]
      state.imageMagIndex = idx
    }

    const zoomFit = () => {
      state.imageMagIndex = state.imageMags.indexOf(1)
      state.imageMag = 1
      state.imagePos.x = 0
      state.imagePos.y = 0
    }

    const movePosterImage = (delta: Point) => {
      const el = posterImage.value
      if (el) {
        state.imagePos.x = inRange(
          state.imagePos.x + delta.x,
          -state.imageMag * el.clientWidth + el.clientWidth * 0.1,
          el.clientWidth * 0.9
        )
        state.imagePos.y = inRange(
          state.imagePos.y + delta.y,
          -state.imageMag * el.clientHeight + el.clientHeight * 0.1,
          el.clientHeight * 0.9
        )
      }
    }
    const mouseDownPoster = (ev: MouseEvent) => {
      state.mouseDown = true
      state.prevPos = { x: ev.x, y: ev.y }
    }
    const mouseUpPoster = () => {
      state.mouseDown = false
    }
    const mouseMovePoster = (ev: MouseEvent) => {
      if (state.mouseDown) {
        const delta: Point = {
          x: ev.x - state.prevPos.x,
          y: ev.y - state.prevPos.y,
        }
        state.prevPos = { x: ev.x, y: ev.y }
        movePosterImage(delta)
      }
    }

    const mouseWheelPoster = (ev: MouseWheelEvent) => {
      console.log(ev.deltaMode, ev.deltaX, ev.deltaY)
      state.imageMag = inRange(state.imageMag + ev.deltaY * 0.01, 0.3, 3)
    }

    const onDropMyPoster = (event, poster_id) => {
      state.dragOver = false
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
      } else if (file.size >= 10e6) {
        console.error("File size loo large")
        alert(lang("file_too_large"))
      } else {
        context.emit("upload-poster", file, poster_id)
      }
    }

    const clickSubmit = () => {
      const text = PosterCommentInput.value?.value
      if (!text) {
        console.warn("Empty text")
        return
      }
      context.emit("submit-poster-comment", text, state.replying)
      PosterCommentInput.value!.value = ""
      state.numInputRows = 1
    }

    const onKeyDownEnterPosterCommentInput = (ev: KeyboardEvent) => {
      // console.log(ev);
      if (ev.shiftKey) {
        if (state.composing) {
          state.composing = false
        } else {
          clickSubmit()
          ev.preventDefault()
          return true
        }
        return false
      }
    }

    const clickShowEmoji = (c: ChatCommentDecrypted) => {
      state.showEmojiPicker = state.showEmojiPicker == c.id ? undefined : c.id
    }

    const selectEmoji = (c: ChatCommentDecrypted, emoji: any) => {
      const me = props.myself
      if (!me) {
        console.error("Myself not set")
        return
      }
      console.log(emoji)
      const reaction: string = emoji.native
      const reaction_id: string | undefined = c.reactions
        ? c.reactions[reaction]
          ? c.reactions[reaction][me.id]
          : undefined
        : undefined
      context.emit("add-emoji-reaction", c.id, reaction_id, reaction, "poster")
      state.showEmojiPicker = undefined
    }

    const clickReaction = (
      c: ChatCommentDecrypted,
      reaction_id: CommentId,
      reaction: string
    ) => {
      context.emit("add-emoji-reaction", c.id, reaction_id, reaction, "poster")
    }

    const startReply = (c: CommentEvent) => {
      console.log("startReply", c)
      state.replying = c
      context.emit("set-editing-old", undefined)
      if (!PosterCommentInput.value) {
        console.error("Poster comment textarea ref not found")
        return
      }
      PosterCommentInput.value.value = ""
      PosterCommentInput.value.focus()
    }

    onMounted(() => {
      const elem = document.getElementById("poster-container")
      if (!elem) {
        return
      }
      const observer = new MutationObserver(() => {
        const width = elem.getBoundingClientRect().width
        const height = elem.getBoundingClientRect().height
        context.emit("set-poster-container-width", width)
      })
      observer.observe(elem, {
        attributes: true,
        attributeFilter: ["style"],
      })
    })

    watch(
      () => props.editingOld,
      (comment_id: string | undefined) => {
        if (comment_id && PosterCommentInput.value) {
          const c = countLines(PosterCommentInput.value)
          state.numInputRows = Math.min(c, 15)
        }
      }
    )

    const editPoster = async (poster_id: PosterId) => {
      if (!props.poster) {
        return
      }
      const title = prompt(
        props.locale == "ja"
          ? "ポスターのタイトルを入力してください"
          : "Enter poster title"
      )
      if (title != null) {
        const client = api(axiosClient(axios))
        const data = await client.posters
          ._posterId(props.poster.id)
          .$patch({ body: { title } })
        if (data.ok) {
          await nextTick(() => {
            //Vue.set
            context.emit("set-poster", props.poster!.id, {
              ...props.poster,
              title,
            })
          })
        }
      }
    }

    const onScroll = async (ev: Event) => {
      if (!state.initialScrollDone) {
        return
      }
      //https://stackoverflow.com/a/21627295
      const visibleY = (el1: Element) => {
        let rect = el1.getBoundingClientRect()
        const top = rect.top
        const height = rect.height
        let el = el1.parentNode
        if (!el) {
          return false
        }
        // Check if bottom of the element is off the page
        if (rect.bottom < 0) return false
        // Check its within the document viewport
        if (top > document.documentElement.clientHeight) return false
        do {
          rect = (el as Element).getBoundingClientRect()
          if (top <= rect.bottom === false) return false
          // Check if the element is out of view due to a container scrolling
          if (top + height <= rect.top) return false
          el = el.parentNode
        } while (el && el != document.body)
        return true
      }

      for (const c of Object.values(props.comments)) {
        const el = document.querySelector("#poster-comment-entry-" + c.id)
        const parent = document.querySelector("#poster-comments-container")

        if (el && parent) {
          const visible = visibleY(el)
          const old_visible = props.comments[c.id].read
          if (visible != old_visible) {
            state.visibleComments[c.id] = visible
            if (visible) {
              context.emit("read-comment", props.poster?.id, c.id)
            }
            // console.log(c.id, visible, c.text_decrypted)
          }
        } else {
          // console.warn(`${c.id} element not found`) //Probably reaction icon
        }
      }
    }

    const onResizePosterContainer = ev => {
      console.log("resize poster container", ev)
    }

    const cssVars = reactive({
      "--cell_size": computed(() => {
        return "" + props.mapCellSize + "px"
      }),
    })

    return {
      ...toRefs(state),
      isMyPoster,
      PosterCommentInput,
      formatTime,
      offline_disallowed,
      mouseDownPoster,
      mouseUpPoster,
      mouseMovePoster,
      mouseWheelPoster,
      startUpdateComment,
      posterCommentHistory,
      clickSubmit,
      clearInput,
      speechText,
      zoomIn,
      zoomOut,
      zoomFit,
      posterImage,
      onDropMyPoster,
      onKeyDownEnterPosterCommentInput,
      clickShowEmoji,
      selectEmoji,
      clickReaction,
      startReply,
      inRange,
      onInput,
      onScroll,
      onResizePosterContainer,
      editPoster,
      lang,
      cssVars,
    }
  },
})
</script>

<style lang="css" scoped>
@import url("https://fonts.googleapis.com/css2?family=Lato&display=swap");
@import url("./chat.css");

h3 {
  font-size: 14px;
}
#poster.inactive {
  background: #ccc;
}
#poster-notfound {
  height: 100%;
  padding-top: 300px;
  text-align: center;
}

.mobile #poster-notfound {
  padding-top: 10vh;
  width: 90vw;
}

#poster-notfound.dragover {
  background: #cec;
}

#poster-notfound .note {
  font-size: 14px;
  text-align: left;
  margin-top: 30px;
  margin-left: 60px;
}

#poster-inactive {
  padding-top: 300px;
  text-align: center;
}

div#poster-container {
  position: absolute;
  background: white;
  left: calc(var(--cell_size) * 11 + 12px);
  top: 0px;
  min-width: 400px;
  min-height: 600px;
  width: calc(95vh / 1.4);
  max-width: calc(100vw - var(--cell_size) * 11 - 22px - 200px);
  height: calc(100vh - 20px);
  z-index: 200;
  resize: horizontal;
  overflow: hidden;
}

.dark div#poster-container {
  background: black;
}

#app-main.mobile div#poster-container {
  left: 0px;
  top: 0vw;
  min-height: 0px;
  width: 100%;
  height: calc(100vh - 100vw / 6 - 15vw);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s 0.5s linear;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

#poster-container h2 {
  display: inline-block;
  height: 40px;
  width: calc(100% - 100px);
}

#poster-container h2.me {
  width: calc(100% - 130px);
}

.number_author {
  font-weight: bold;
}

div#poster-comments-container {
  position: absolute;
  top: calc(var(--cell_size) * 11 + 94px);
  left: 8px;
  width: calc(var(--cell_size) * 11);
  min-height: 100px;
  overflow: scroll;
  font-size: 12px;
  background: white;
  border: 1px solid #888;
  border-radius: 4px;
}

.dark div#poster-comments-container {
  background: black;
}

.mobile div#poster-comments-container {
  top: 0px;
  left: 0px;
  width: 100vw;
  font-size: 27px;
  background: white;
  border: 1px solid #888;
  border-radius: 4px;
}

.mobile #poster-title {
  margin-top: 15vw;
}

div#poster-comments-container.poster_active {
  top: calc(var(--cell_size) * 5 + 100px);
}

h3#poster-comment-title {
  position: absolute;
  top: calc(var(--cell_size) * 5 + 80px);
  left: 10px;
}

.mobile h3#poster-comment-title {
  position: absolute;
  top: 0px;
  left: 10vw;
}

div#poster-comments {
  margin: 0px 0px 0px 0px;
}

#submit-poster-comment {
  margin-left: 0px;
}

.mobile #submit-poster-comment {
  margin: 0px 3px 0px 5px;
  vertical-align: 6px;
  width: 50px;
}

.comment-edit,
.comment-delete {
  cursor: pointer;
}

div#poster {
  min-width: 400px;
  /* width: calc((100vh - 52px) / 1.414); */
  min-height: 560px;
  height: calc(100vh - 52px);
  cursor: grab;
  background: #ccc;
  background-size: 200%;
  background-repeat: no-repeat;
  filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.7));
  max-width: 100%;
  max-height: calc(100% - 5px);
  transition: 0.3s linear background-color;
}

.mobile div#poster {
  bottom: calc(100vw / 6 * 0.7);
  height: calc(100vh - 100vw / 6 * 0.7 - 40px);
  top: 40px;
  left: 0px;
  right: 0px;
  cursor: grab;
  background: #ccc;
  background-size: 200%;
  background-repeat: no-repeat;
  filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.7));
  max-width: 100%;
  max-height: calc(100% - 5px);
  transition: 0.3s linear background-color;
}

.dark div#poster {
  background: #444;
  color: #ddd;
}

.mobile div#poster {
  height: calc(100vh - 100vw / 6 - 15vw - 21px);
  min-height: 0px;
}

div#poster > img {
  max-width: 100%;
  max-height: 100%;
  margin: 0px;
}

h3 {
  margin: 0px;
}

#poster-help {
  position: absolute;
  right: 10px;
  bottom: -50px;
  font-size: 12px;
}

textarea#poster-chat-input {
  white-space: pre-wrap;
  font-size: 16px;
  font-family: "Lato", sans-serif;

  line-height: 20px;
  width: 100%;
  /* height: 28px; */
  margin: 0px 0px 10px 0px;
  resize: none;
  display: inline-block;
  vertical-align: -12px;
  padding: 8px;
  z-index: 100 !important;
}

.mobile textarea#poster-chat-input {
  white-space: pre-wrap;
  font-size: 16px;
  font-family: "Lato", sans-serif;

  line-height: 20px;
  width: calc(100% - 60px);
  /* height: 28px; */
  margin: 0px 0px 10px 0px;
  resize: none;
  display: inline-block;
  vertical-align: -12px;
  padding: 8px;
  z-index: 100 !important;
}

#poster-chat-input-container {
  position: absolute;
  left: 8px;
  bottom: 20px;
  width: 527px;
  z-index: 100 !important;
  padding: 10px;
}

#app-main.mobile #poster-chat-input-container {
  bottom: 10vw;
  width: 95%;
}

.comment-content {
  padding: 0px 10px;
}

#poster-tools {
  position: absolute;
  right: 0px;
  top: 8px;
  width: 100px;
  height: 30px;
  float: right;
}

.mobile #poster-tools {
  right: 30px;
  top: 10px;
  z-index: 100;
}

#poster-tools.me {
  width: 140px;
}

#poster-tools .toolbar-icon {
  /* opacity: 0.5; */
  margin: 0px 3px;
}
</style>
