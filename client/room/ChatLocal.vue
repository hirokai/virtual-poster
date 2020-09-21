<template>
  <div
    id="chat-local"
    :style="{
      width: isMobile
        ? '510px'
        : poster
        ? 'calc(100% - max(68vh,600px) - 600px)'
        : 'calc(100% -  600px)',
      left: isMobile ? '10px' : undefined,
      top: isMobile ? '550px' : undefined,
      height: isMobile ? 'calc(100% - 550px)' : undefined,
    }"
  >
    <div id="chat-input-container">
      <textarea
        id="local-chat-input"
        ref="input"
        v-model="inputText"
        :rows="numInputRows"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        @focus="$emit('on-focus-input', true)"
        @blur="$emit('on-focus-input', false)"
        placeholder="Shift+Enterで送信"
        :disabled="!editingOld && (!chatGroup || chatGroup.length == 0)"
      ></textarea>

      <span
        id="show-encrypt"
        :class="{
          disabled: !enableEncryption,
          impossible: !encryptionPossibleInChat,
        }"
        ><img
          src="/img/lock-152879_1280.png"
          height="30px"
          alt="暗号化"
          @click="$emit('set-encryption', !enableEncryption)"
      /></span>
      <button
        id="submit"
        @click="$emit('submit-comment', inputText)"
        :disabled="!editingOld && (!chatGroup || chatGroup.length == 0)"
      >
        {{ editingOld ? "保存" : "送信" }}
      </button>
      <button
        v-if="is_chrome"
        id="dictation"
        :class="{ running: dictation.running }"
        @click="toggleDictation"
        :disabled="!editingOld && (!chatGroup || chatGroup.length == 0)"
      >
        {{ dictation.running ? "音声入力中" : "音声入力" }}
      </button>

      <button
        id="leave-chat"
        @click="$emit('leave-chat')"
        :disabled="!chatGroup || chatGroup.length == 0"
      >
        会話から離脱
      </button>
      <h2 v-if="chatGroup && chatGroup.length > 0">
        <div id="participants">
          <span>会話の参加者：</span>
          <span
            class="person-in-local"
            v-for="p in chatGroup"
            :key="p"
            :class="{ typing: people_typing[p] }"
          >
            {{ people[p] ? people[p].name : "" }}
          </span>
        </div>
      </h2>
      <h2 v-else>
        <div id="participants">
          会話に参加していません
        </div>
      </h2>
    </div>
    <div
      class="chat-history"
      id="chat-local-history"
      :style="{ height: 'calc(100% - ' + (120 + numInputRows * 22) + 'px)' }"
    >
      <div
        v-for="c in localCommentHistory"
        :key="'' + c.timestamp + c.person + c.to + c.kind"
        :class="{
          'comment-entry': c.event == 'comment',
          'date-entry': c.event == 'comment',
          hidden: contentHidden,
        }"
      >
        <!-- <Picker
          v-if="showEmojiPicker && showEmojiPicker == c.id"
          set="apple"
          style="position: absolute"
          :data="emojiIndex"
          @select="emoji => selectEmoji(c, emoji)"
        /> -->
        <MyPicker
          v-if="showEmojiPicker && showEmojiPicker == c.id"
          @select="emoji => selectEmoji(c, emoji)"
          @close-emoji-picker="showEmojiPicker = undefined"
        />
        <div v-if="c.event == 'new_date'" class="date_event">
          <hr />
          <span> {{ c.date_str }} </span>
        </div>
        <div
          v-if="c.event == 'comment'"
          :style="{ 'margin-left': '' + (c.__depth - 1) * 20 + 'px' }"
        >
          <div class="local-entry-header">
            <span class="comment-name">
              {{ people[c.person] ? people[c.person].name : null }}
            </span>
            <span class="comment-time">{{ formatTime(c.timestamp) }}</span>
            <span class="comment-recipients">
              &#x27a1;
              <span
                class="recipient"
                v-for="t in notSender(c.person, c.texts)"
                :key="t.to"
              >
                {{ people[t.to] ? people[t.to].name : "" }}
              </span>
              <span v-if="c.encrypted_for_all">&#x1F512; </span>
            </span>
            <span
              class="comment-entry-tool"
              id="show_emoji_picker"
              @click="clickShowEmoji(c)"
            >
              😀
            </span>
            <span
              class="comment-entry-tool"
              @click="speechText(c.text_decrypted || '')"
              >読み上げ</span
            >
            <span
              v-if="myself && c.person == myself.id"
              class="comment-entry-tool comment-delete"
              @click="$emit('delete-comment', c.id)"
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
            class="local-entry-content"
            @dblclick="speechText(c.text_decrypted || '')"
          >
            <span
              class="comment-content"
              v-html="(c.text_decrypted || '').replace(/[\r\n]/g, '<br>')"
            ></span>
          </div>
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
</template>

<script lang="ts">
import {
  Person,
  ChatCommentDecrypted,
  Poster as PosterTyp,
  UserId,
  CommentId,
  Tree,
} from "../../@types/types"
import { CommonMixin } from "./util"
import { countLines } from "../util"
import { flattenTree } from "../../common/util"

import {
  defineComponent,
  reactive,
  watch,
  toRefs,
  computed,
  PropType,
  nextTick,
} from "vue"

import MyPicker from "./MyPicker.vue"
// import data from "../../emoji-mart-vue-fast/data/all.json"
// import { Picker, EmojiIndex } from "../../emoji-mart-vue-fast/src"
// import "../../emoji-mart-vue-fast/css/emoji-mart.css"

// const emojiIndex = new EmojiIndex(data)

interface CommentHistoryEntry {
  event: string
  timestamp: number
}

interface CommentEvent extends CommentHistoryEntry {
  event: "comment"
  encrypted_for_all: boolean
  id: string
  last_updated: number
  x: number
  y: number
  text_decrypted: string
  texts: {
    to: UserId
  }[]
  person: UserId
  __depth: number
  reactions?: {
    [reaction: string]: { [user_id: string]: CommentId }
  }
}

interface DateEvent extends CommentHistoryEntry {
  event: "new_date"
  date_str: string
}

export default defineComponent({
  components: {
    // Picker,
    MyPicker,
  },
  props: {
    poster: {
      type: Object as PropType<PosterTyp>,
    },
    people_typing: {
      type: Object as PropType<{ [user_id: string]: boolean }>,
      required: true,
    },
    contentHidden: {
      type: Boolean,
      required: true,
    },
    chatGroup: {
      type: Array as PropType<string[]>,
    },
    inputTextFromParent: {
      type: String,
      required: true,
    },
    people: {
      type: Object as PropType<{ [index: string]: Person }>,
      required: true,
    },
    editingOld: {
      type: String,
    },
    enableEncryption: {
      type: Boolean,
      required: true,
    },
    encryptionPossibleInChat: {
      type: Boolean,
      required: true,
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
      inputText: "",
      voice: null as SpeechSynthesisVoice | null,
      inputTextWithoutDictation: undefined as string | undefined,
      dictation: {
        running: false,
        text: undefined as string | undefined,
      },
      recognition: null as any | null,
      showEmojiPicker: undefined as CommentId | undefined,
    })
    const numInputRows = computed((): number => {
      if (state.inputText == "") {
        return 1
      }
      const el = document.querySelector(
        "#local-chat-input"
      ) as HTMLTextAreaElement
      if (el) {
        const c = countLines(el)
        console.log("countLines", c)
        return Math.min(c, 15)
      } else {
        return 0
      }
    })
    watch(
      () => state.inputText,
      (t: string) => {
        context.emit("onInputTextChange", t)
      }
    )
    watch(
      () => props.inputTextFromParent,
      (t: string) => {
        state.inputText = t
      }
    )
    watch(
      () => numInputRows.value,
      () => {
        nextTick(() => {
          let el = document.querySelector("#chat-local-history")
          if (el) {
            el.scrollTop = el.scrollHeight
          }
          el = document.querySelector("#poster-comments")
          if (el) {
            el.scrollTop = el.scrollHeight
          }
        })
          .then(() => {
            //
          })
          .catch(() => {
            //
          })
      }
    )

    const sameDate = (a: number, b: number): boolean => {
      const ta = new Date(a)
      const tb = new Date(b)
      return (
        ta.getFullYear() == tb.getFullYear() &&
        ta.getMonth() == tb.getMonth() &&
        ta.getDate() == tb.getDate()
      )
    }

    const formatDate = (t: number): string => {
      const t1 = new Date(t)
      const show_year = t1.getFullYear() != new Date().getFullYear()
      return (
        "" +
        (show_year ? t1.getFullYear() + "年" : "") +
        (t1.getMonth() + 1) +
        "月" +
        t1.getDate() +
        "日 (" +
        ["日", "月", "火", "水", "木", "金", "土"][t1.getDay()] +
        ")"
      )
    }

    const localCommentHistory = computed((): CommentHistoryEntry[] => {
      const comments = flattenTree(props.commentTree)
        .filter(c => {
          return c.kind == "person"
        })
        .map(c => {
          return {
            ...c,
            event: "comment",
            encrypted_for_all: c.texts.every(t => t.encrypted),
          } as CommentEvent
        })

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
    })

    const clearInput = () => {
      state.inputText = ""
    }

    const startUpdateComment = (cid: string) => {
      context.emit("set-editing-old", cid)
      state.inputText = props.comments[cid].text_decrypted
      const el = document.querySelector(
        "#local-chat-input"
      ) as HTMLTextAreaElement
      if (el) {
        el.value = props.comments[cid].text_decrypted
        el.focus()
      }
    }

    interface SpeechWindow extends Window {
      webkitSpeechRecognition: any
    }

    const {
      webkitSpeechRecognition,
    }: SpeechWindow = (window as any) as SpeechWindow

    const startDictation = () => {
      if (state.dictation.running) {
        return
      }
      console.log("Starting dictation")
      state.inputTextWithoutDictation = state.inputText
      state.dictation.running = true

      const SpeechRecognition = webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      state.recognition = recognition
      recognition.interimResults = true

      recognition.onresult = event => {
        const text = event.results[0][0].transcript
        //Vue.set
        state.dictation.text = text
        state.inputText = state.inputTextWithoutDictation + text
        if (event.results[0].isFinal) {
          state.inputText += "。"
        }
        console.log(event.results[0][0].transcript, event.results[0])
      }
      recognition.onend = () => {
        console.log("Ended")
        state.inputTextWithoutDictation = state.inputText
        if (state.dictation.running) {
          recognition.start()
        }
      }

      recognition.start()
    }

    const stopDictation = () => {
      state.dictation.running = false
      console.log("stopDictation", state.recognition)
      state.recognition.stop()
      state.recognition = undefined
    }

    const toggleDictation = () => {
      if (!state.dictation.running) {
        startDictation()
      } else {
        stopDictation()
      }
    }

    const notSender = (
      person: UserId,
      texts: { to: UserId }[]
    ): { to: UserId }[] => {
      return texts.filter(t => t.to != person)
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

    context["parent"]?.$on("clear-chat-input", () => {
      state.inputText = ""
    })

    const is_chrome = !!window["chrome"]

    const clickShowEmoji = (c: ChatCommentDecrypted) => {
      state.showEmojiPicker = state.showEmojiPicker ? undefined : c.id
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
      context.emit("add-emoji-reaction", c.id, reaction_id, reaction)
      state.showEmojiPicker = undefined
    }

    const clickReaction = (
      c: ChatCommentDecrypted,
      reaction_id: CommentId,
      reaction: string
    ) => {
      context.emit("add-emoji-reaction", c.id, reaction_id, reaction)
    }

    return {
      ...toRefs(state),
      ...CommonMixin,
      localCommentHistory,
      clearInput,
      startUpdateComment,
      numInputRows,
      speechText,
      toggleDictation,
      is_chrome,
      notSender,
      // emojiIndex,
      clickShowEmoji,
      selectEmoji,
      clickReaction,
    }
  },
})
</script>

<style lang="css">
@import url("https://fonts.googleapis.com/css2?family=Lato&display=swap");
#participants {
  display: inline-block;
  font-size: 12px;
  margin: 0px;
}

#chat-local {
  position: absolute;
  top: 10px;
  left: 550px;
  min-width: 250px;
  width: calc(100% - 68vh - 600px);
  height: calc(100% - 20px);
  font-family: "Lato", sans-serif;
}

#chat-input-container {
  position: absolute;
  bottom: 10px;
  background: white;
  width: 100%;
  border: 1px solid #ccc;
  z-index: 100 !important;
  box-shadow: 1px 1px 2px #222;
}

#chat-local-history {
  position: absolute;
  top: 10px;
  margin-bottom: 100px;
  /* min-height: 580px; */
  height: calc(100% - 120px);
  width: 100%;
  /* width: 790px; */
  /* z-index: -100; */
  border: 1px solid #888;
  border-radius: 4px;
}

.comment-entry {
  padding: 0px 10px;
}
.comment-entry:hover {
  background: #eee;
}

.comment-entry-tool {
  float: right;
  display: block;
  font-size: 12px;
  cursor: pointer;
  visibility: hidden;
  margin: 0px 4px;
}

.comment-entry:hover .comment-entry-tool {
  visibility: visible;
}

.comment-delete {
  color: red;
}

.chat-history {
  overflow: scroll;
  border: 1px solid black;
}

.chat-history > p {
  margin: 0px;
}

textarea#local-chat-input {
  white-space: pre-wrap;
  font-size: 16px;
  font-family: "Lato", sans-serif;

  line-height: 20px;
  width: calc(100% - 20px);
  /* height: 28px; */
  margin: 10px 10px 10px 10px;
  resize: none;
  display: inline-block;
  vertical-align: -12px;
  padding: 8px;
  z-index: 100 !important;
}

.person-in-local {
  margin-right: 10px;
}

button#dictation.running {
  font-weight: bold;
  animation-name: glowing_bg;
  animation-duration: 2s;
  animation-direction: normal;
  animation-iteration-count: infinite;
}

@keyframes glowing_bg {
  0% {
    color: red;
  }
  50% {
    color: #faa;
  }
  100% {
    color: red;
  }
}

button#submit {
  width: 60px;
  height: 26px;
  margin-left: 10px;
  vertical-align: 7px;
}

button#dictation {
  width: 90px;
  height: 26px;
  margin-left: 10px;
  vertical-align: 7px;
}

button#show_emoji_picker {
  font-size: 20px;
  width: 40px;
  height: 26px;
  margin-left: 10px;
  vertical-align: -1px;
}

.person-in-local.typing {
  color: blue;
  font-weight: bold;
  animation-name: glowing_text;
  animation-duration: 2s;
  animation-direction: normal;
  animation-iteration-count: infinite;
}

@keyframes glowing_text {
  0% {
    color: red;
  }
  50% {
    color: #faa;
  }
  100% {
    color: red;
  }
}

button#leave-chat {
  width: 120px;
  height: 26px;
  margin-left: 20px;
  vertical-align: 7px;
}
#show-encrypt {
  margin: 0px;
}
#show-encrypt img {
  margin: 0px 0px -2px 10px;
  cursor: pointer;
}

#show-encrypt.disabled img {
  opacity: 0.3;
}

#show-encrypt.impossible img {
  opacity: 0.4;
  filter: invert(15%) sepia(95%) saturate(6932%) hue-rotate(358deg)
    brightness(95%) contrast(112%);
}

.comment-recipients {
  margin-left: 5px;
}
.recipient {
  margin: 0px 3px;
}

.comment-entry.hidden {
  opacity: 0;
  transition: opacity 0.5s linear;
}

.date_event {
  text-align: center;
  font-size: 12px;
}

.date_event span {
  display: block;
  margin: -10px auto 0px auto;
  background: white;
  width: 150px;
  border: 1px solid black;
  border-radius: 5px;
  text-align: center;
}

.date_event hr {
  margin: 10px 0px 0px 0px;
  background-color: #888;
  height: 1px;
  border: 0;
}

.reactions {
  height: 20px;
}

.reaction-entry {
  cursor: pointer;
  font-size: 14px;
  background-color: rgba(29, 28, 29, 0.04);
  border-radius: 6px;
  margin: 0px 3px;
  padding: 1px 3px;
}

.my-reaction {
  background: rgba(29, 155, 209, 0.1);
  box-shadow: rgb(29, 155, 209) 0px 0px 0px 0.8px inset;
}

.reaction-entry .count {
  font-size: 10px;
}
</style>
