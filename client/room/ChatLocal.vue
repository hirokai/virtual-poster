<template>
  <div
    id="chat-local"
    :style="{
      width: poster
        ? 'calc(100% - max(68vh,600px) - 600px)'
        : 'calc(100% -  600px)',
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
      <button v-if="is_chrome" id="dictation" @click="toggleDictation">
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
        会話に参加していません
      </h2>
    </div>
    <div
      class="chat-history"
      id="chat-local-history"
      :style="{ height: 'calc(100% - ' + (120 + numInputRows * 22) + 'px)' }"
    >
      <div
        v-for="c in localCommentHistory"
        :key="c.timestamp + c.person + c.to + c.kind"
        class="comment-entry"
        :class="{ hidden: contentHidden }"
      >
        <div class="local-entry-header">
          <span class="comment-name">
            {{ people[c.person] ? people[c.person].name : null }}
          </span>
          <span class="comment-time">{{ formatTime(c.timestamp) }}</span>
          <span class="comment-recipients">
            &#x27a1;

            <span class="recipient" v-for="t in c.texts" :key="t.to">
              {{ people[t.to] ? people[t.to].name : "" }}
              <span v-if="t.encrypted">&#x1F512; </span>
            </span>
          </span>
          <span
            v-if="myself && c.person == myself.id"
            class="comment-delete"
            @click="$emit('delete-comment', c.id)"
            >削除</span
          >
          <span
            v-if="myself && c.person == myself.id"
            class="comment-edit"
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
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  Person,
  ChatCommentDecrypted,
  Poster as PosterTyp,
} from "../../@types/types"
import { CommonMixin } from "./util"
import { countLines } from "../util"
import { sortBy } from "../../common/util"

import Vue from "vue"
import {
  defineComponent,
  reactive,
  watch,
  toRefs,
  computed,
  PropType,
} from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

export default defineComponent({
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
        Vue.nextTick(() => {
          let el = document.querySelector("#chat-local-history")
          if (el) {
            el.scrollTop = el.scrollHeight
          }
          el = document.querySelector("#poster-comments")
          if (el) {
            el.scrollTop = el.scrollHeight
          }
        })
      }
    )
    const localCommentHistory = computed((): ChatCommentDecrypted[] => {
      return sortBy<ChatCommentDecrypted>(
        Object.values(props.comments).filter(c => {
          return c.kind == "person"
        }),
        (c: ChatCommentDecrypted) => {
          return c.timestamp
        }
      )
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

    interface IWindow extends Window {
      webkitSpeechRecognition: any
    }

    const { webkitSpeechRecognition }: IWindow = <IWindow>(window as any)

    const toggleDictation = () => {
      if (!state.dictation.running) {
        startDictation()
      } else {
        stopDictation()
      }
    }

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
        Vue.set(state.dictation, "text", text)
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

    context.parent?.$on("clear-chat-input", ev => {
      state.inputText = ""
    })

    const is_chrome = !!window["chrome"]

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
    }
  },
})
</script>

<style lang="css">
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
}
.comment-entry:hover {
  background: #eee;
}

.comment-delete,
.comment-edit {
  float: right;
  display: block;
  font-size: 12px;
  cursor: pointer;
  width: 30px;
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

textarea {
  white-space: pre-wrap;
  font-size: 16px;
  line-height: 20px;
  width: calc(100% - 10px);
  margin-top: 10px;
  margin-bottom: 10px;
  resize: none;
  display: inline-block;
  vertical-align: -12px;
  z-index: 100 !important;
}

.person-in-local {
  margin-right: 10px;
}

.person-in-local.typing {
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

.recipient {
  margin: 0px 5px;
}

.comment-entry.hidden {
  opacity: 0;
  transition: opacity 0.5s linear;
}
</style>
