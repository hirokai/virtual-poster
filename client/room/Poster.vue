<template>
  <div>
    <transition name="fade">
      <div id="poster-container" v-if="poster">
        <h2>
          {{
            poster
              ? people[poster.author]
                ? people[poster.author].name
                : ""
              : ""
          }}: {{ poster ? poster.title : "" }}
        </h2>
        <div
          id="poster"
          ref="posterImage"
          :class="{ inactive: !poster }"
          :style="{
            'background-image': offline_disallowed
              ? ''
              : 'url(data:image/png;base64,' + posterDataURI + ')',
            'background-position': '' + imagePos.x + 'px ' + imagePos.y + 'px',
            'background-size': '' + imageMag * 100 + '%',
          }"
          @mouseup="mouseUpPoster"
          @mousedown="mouseDownPoster"
          @mousemove="mouseMovePoster"
        >
          <div id="poster-tools">
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
          </div>
          <div
            id="poster-notfound"
            v-if="!!poster && posterStatus == 'not_found' && poster.author"
            :class="{ dragover: dragOver }"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="poster ? onDropMyPoster($event, poster.id) : ''"
          >
            {{
              people[poster.author] ? people[poster.author].name : "（不明）"
            }}さんのポスター<br />（ポスター板の場所が確保されていますが<br />画像はアップロードされていません。）
            <div class="note" v-if="poster.author == myself.id">
              以下のいずれかの方法でファイル（PNGあるいはPDF）を<br />アップロードできます。
              <ul>
                <li>この枠内にPNGまたはPDFをドラッグ＆ドロップする</li>
                <li>マップ中の木札のアイコンにドラッグ＆ドロップする</li>
                <li>
                  マイページ（画面上部の人型のアイコン）→ポスター で<br />ドラッグ＆ドロップする
                </li>
              </ul>
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
            }}さんのポスター<br />（発表者がオフラインのため閲覧できません）
          </div>
          <div
            id="poster-notfound"
            v-if="!!poster && posterStatus == 'checking' && poster.author"
          >
            {{
              people[poster.author] ? people[poster.author].name : "（不明）"
            }}さんのポスターをロード中...
          </div>
          <div id="poster-inactive" v-if="!poster">
            ポスターに近づくと表示されます
          </div>
          <div id="detail"></div>
        </div>
      </div>
    </transition>
    <transition name="fade">
      <h3 id="poster-comment-title" v-if="poster">ポスターへのコメント</h3>
    </transition>
    <transition name="fade">
      <div
        id="poster-comments-container"
        class="chat-container"
        :class="{ poster_active: !!poster }"
        :style="{
          width: isMobile ? '520px' : undefined,
          bottom: '' + (102 + numInputRows * 20) + 'px',
        }"
        v-if="poster"
      >
        <div id="poster-comments">
          <div
            v-for="c in posterCommentHistory"
            class="poster-comment-entry comment-entry"
            :class="{
              replying: replying && replying.id == c.id,
              editing: editingOld && c.id == editingOld,
            }"
            :key="c.timestamp + c.person + c.to + c.kind"
          >
            <MyPicker
              v-if="showEmojiPicker && showEmojiPicker == c.id"
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
                  >返信</span
                >
                <span
                  class="comment-entry-tool"
                  @click="speechText(c.text_decrypted || '')"
                  >読み上げ</span
                >
                <span
                  v-if="myself && c.person == myself.id"
                  class="comment-entry-tool comment-delete"
                  @click="$emit('delete-comment', poster.id, c.id)"
                  >削除</span
                >
                <span
                  v-if="myself && c.person == myself.id"
                  class="comment-entry-tool comment-edit"
                  @click="startUpdateComment(c.id)"
                  >編集</span
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
    >
      <textarea
        ref="input"
        id="poster-chat-input"
        v-model="inputText"
        :rows="numInputRows"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        @focus="$emit('on-focus-input', true)"
        @blur="$emit('on-focus-input', false)"
        @keydown.enter="onKeyDownEnterPosterCommentInput"
        placeholder="Shift+Enterでポスターにコメント"
      ></textarea>
      <button
        id="submit-poster-comment"
        @click="$emit('submit-poster-comment', inputText, replying)"
        :disabled="inputText == ''"
      >
        <img
          class="icon"
          src="/img/icon/right-arrow.png"
          :alt="editingOld ? '保存' : '送信'"
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

import {
  defineComponent,
  reactive,
  watch,
  toRefs,
  ref,
  computed,
  PropType,
} from "vue"

import MyPicker from "./MyPicker.vue"

export default defineComponent({
  components: {
    MyPicker,
  },
  props: {
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
  },
  setup(props, context) {
    const state = reactive({
      posterDataURI: "",
      inputText: "",
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
    })
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
      state.inputText = props.comments[cid].text_decrypted
      const el = document.querySelector(
        "#poster-chat-input"
      ) as HTMLTextAreaElement
      if (el) {
        el.value = state.inputText
        el.focus()
      }
    }
    watch(
      () => [props.poster, props.poster?.last_updated],
      () => {
        console.log("watch poster invoked", props.poster)
        state.posterStatus = "checking"
        if (props.poster) {
          axiosDefault({
            method: "GET",
            url: props.poster.file_url,
            responseType: "arraybuffer",
          })
            .then(res => {
              console.log(res)
              state.posterStatus = res.status == 404 ? "not_found" : "found"
              if (state.posterStatus == "found") {
                const image = btoa(
                  new Uint8Array(res.data).reduce(
                    (d, byte) => d + String.fromCharCode(byte),
                    ""
                  )
                )
                state.posterDataURI = image
              }
            })
            .catch(() => {
              console.log("not found poster")
              state.posterStatus = "not_found"
              state.posterDataURI = ""
            })
        } else {
          state.posterStatus = "inactive"
          state.posterDataURI = ""
        }
      }
    )

    const numInputRows = computed((): number => {
      if (state.inputText == "") {
        return 1
      }
      const el = document.querySelector(
        "#poster-chat-input"
      ) as HTMLTextAreaElement
      if (el) {
        const c = countLines(el)
        console.log("countLines", c)
        return Math.min(c, 15)
      } else {
        return 0
      }
    })

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
      state.inputText = ""
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
      } else {
        context.emit("upload-poster", file, poster_id)
      }
    }

    const onKeyDownEnterPosterCommentInput = (ev: KeyboardEvent) => {
      // console.log(ev);
      if (ev.shiftKey) {
        if (state.composing) {
          state.composing = false
        } else {
          context.emit("submit-poster-comment", state.inputText, state.replying)
          ev.preventDefault()
          state.inputText = ""
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
      state.inputText = ""
      const el = document.querySelector(
        "#poster-chat-input"
      ) as HTMLTextAreaElement
      if (el) {
        el.value = state.inputText
        el.focus()
      }
    }

    return {
      ...toRefs(state),
      formatTime,
      offline_disallowed,
      mouseDownPoster,
      mouseUpPoster,
      mouseMovePoster,
      mouseWheelPoster,
      startUpdateComment,
      posterCommentHistory,
      clearInput,
      speechText,
      numInputRows,
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
  left: 540px;
  top: 0px;
  min-width: 400px;
  min-height: 600px;
  width: calc(95vh / 1.4);
  height: calc(100vh - 20px);
  z-index: 200;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s 0.5s linear;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

div#poster {
  min-width: 400px;
  width: calc((100vh - 52px) / 1.414);
  min-height: 560px;
  height: calc(100vh - 52px);
}

div#poster-comments-container {
  position: absolute;
  top: 622px;
  left: 8px;
  width: 528px;
  min-height: 100px;
  overflow: scroll;
  font-size: 12px;
  background: white;
  border: 1px solid #888;
  border-radius: 4px;
}

div#poster-comments-container.poster_active {
  top: 340px;
}

h3#poster-comment-title {
  position: absolute;
  top: 320px;
  left: 10px;
}

div#poster-comments {
  margin: 0px 0px 0px 0px;
}

#submit-poster-comment {
  margin-left: 0px;
}

.mobile div#poster-comments-container {
  height: calc(100% - 580px);
  top: 560px;
}

.mobile div#poster-comments-container.poster_active {
  top: 280px;
  height: calc(100% - 400px);
}

.comment-edit,
.comment-delete {
  cursor: pointer;
}

div#poster {
  cursor: grab;
  background: #ccc;
  background-size: 200%;
  background-repeat: no-repeat;
  filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.7));
  max-width: 100%;
  max-height: calc(100% - 5px);
  transition: 0.3s linear background-color;
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

#poster-chat-input-container {
  position: absolute;
  bottom: 20px;
  width: 528px;
  z-index: 100 !important;
  padding: 10px;
}

.comment-content {
  padding: 0px 10px;
}

#poster-tools .toolbar-icon {
  opacity: 0.5;
  margin: 0px 3px;
}
</style>
