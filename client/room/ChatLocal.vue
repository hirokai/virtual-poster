<template>
  <div
    id="chat-local"
    class="chat-container"
    :style="{
      width: isMobile
        ? 'calc(100vw - 20px)'
        : poster
        ? 'calc(100% - max(68vh,570px) - 569px)'
        : 'calc(100% - 570px)',
      left: isMobile
        ? '10px'
        : poster
        ? 'calc(550px + max(400px, 95vh / 1.4))'
        : '550px',
      top: isMobile ? '-10px' : undefined,
      height: isMobile ? 'calc(100% - 20vw)' : undefined,
    }"
  >
    <div
      id="chat-local-input-container"
      class="chat-input-container"
      :class="{ replying: !!replying, editing: !!editingOld }"
    >
      <textarea
        id="local-chat-input"
        ref="ChatInput"
        :rows="numInputRows"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        @input="onInput"
        @keydown.enter="onKeyDownEnterChatInput($event)"
        @focus="$emit('on-focus-input', true)"
        @blur="$emit('on-focus-input', false)"
        placeholder="Shift+Enterで送信"
        :disabled="
          !replying && !editingOld && (!chatGroup || chatGroup.length == 0)
        "
      ></textarea>

      <span
        id="show-encrypt"
        :class="{
          disabled: !enableEncryption,
          impossible: !encryptionPossibleInChat,
        }"
        ><img
          class="encrypt-icon"
          src="/img/icon/lock-152879_1280.png"
          alt="暗号化"
          @click="$emit('set-encryption', !enableEncryption)"
      /></span>
      <button
        id="submit"
        @click="clickSubmit(localCommentHistory[replying?.id]?.__depth)"
        :disabled="
          (!replying && !editingOld && (!chatGroup || chatGroup.length == 0)) ||
            ChatInput.value?.value == ''
        "
      >
        <img
          class="icon"
          src="/img/icon/enter-arrow.png"
          alt="保存"
          v-if="editingOld"
        />
        <img class="icon" src="/img/icon/right-arrow.png" alt="送信" v-else />
      </button>
      <button
        v-if="is_chrome"
        id="dictation"
        class="chat-tool-button"
        :class="{ running: dictation.running }"
        @click="toggleDictation"
        :disabled="!editingOld && (!chatGroup || chatGroup.length == 0)"
      >
        <img
          class="icon"
          id="voice-input"
          src="/img/icon/microphone.png"
          :alt="dictation.running ? '音声入力中' : '音声入力'"
        />
        <span v-if="dictation.running">入力中</span>
      </button>
      <button
        id="leave-chat"
        class="chat-tool-button"
        @click="$emit('leave-chat')"
        :disabled="!chatGroup || chatGroup.length == 0"
      >
        <img class="icon" src="/img/icon/departures.png" alt="会話から離脱" />
      </button>
      <button
        v-if="replying"
        id="abort-reply"
        class="chat-tool-button"
        @click="replying = undefined"
      >
        返信中止
      </button>
      <h2>
        <div
          id="participants"
          v-if="!replying && chatGroup && chatGroup.length > 0"
        >
          <span :style="{ color: editingOld ? 'red' : 'black' }"
            >{{ editingOld ? "編集中" : "" }} 会話の参加者：
          </span>
          <span
            class="person-in-local"
            v-for="p in replying
              ? comments[replying.id].texts.map(t => t.to)
              : chatGroup"
            :key="p"
            :class="{ typing: people_typing[p] }"
          >
            {{ people[p] ? people[p].name : "" }}
          </span>
        </div>
        <div id="participants" v-else-if="!!replying">
          <span>返信あて先： </span>
          <span
            class="person-in-local"
            v-for="t in notSender(myself.id, comments[replying.id].texts)"
            :key="t.to"
            :class="{ typing: people_typing[t.to] }"
          >
            {{ people[t.to] ? people[t.to].name : "" }}
          </span>
        </div>
        <div id="participants" v-else>
          会話に参加していません
        </div>
      </h2>
    </div>
    <div
      class="chat-history"
      id="chat-local-history"
      :style="{
        height: 'calc(100% - ' + (142 + numInputRows * 20) + 'px)',
      }"
    >
      <div
        v-for="c in localCommentHistory"
        :key="'' + c.timestamp + c.person + c.to + c.kind"
        :class="{
          'comment-entry': c.event == 'comment',
          'date-entry': c.event == 'new_date',
          replying: replying && c.id == replying.id,
          editing: editingOld && c.id == editingOld,
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
        <div v-if="c.event == 'event'" class="chat_event">
          <span>
            <span v-if="c.event_type == 'new'">
              {{ formatTime(c.timestamp) }}: チャットが開始されました：
              {{
                [c.event_data.from_user]
                  .concat(c.event_data.to_users)
                  .map(u => people[u]?.name)
                  .filter(Boolean)
                  .join(",")
              }}
            </span>
            <span v-else-if="c.event_type == 'dissolve'">
              {{ formatTime(c.timestamp) }}: チャットは解散しました
            </span>
            <span
              v-else-if="
                c.event_type == 'join' && c.event_data?.from_user == myself.id
              "
            >
              {{ formatTime(c.timestamp) }}: チャットに参加しました
            </span>
            <span v-else-if="c.event_type == 'join'" class="gray">
              {{ formatTime(c.timestamp) }}: チャットに{{
                people[c.event_data.from_user]?.name
              }}が加わりました
            </span>
            <span
              v-else-if="
                c.event_type == 'add' && c.event_data.from_user == myself.id
              "
              class="gray"
            >
              {{ formatTime(c.timestamp) }}:
              {{ people[c.event_data.to_user].name }}をチャットに加えました
            </span>
            <span v-else-if="c.event_type == 'add'" class="gray">
              {{ formatTime(c.timestamp) }}:
              {{ people[c.event_data.to_user].name }}が{{
                people[c.event_data.from_user].name
              }}によりチャットに加えられました
            </span>
            <span
              v-else-if="
                c.event_type == 'leave' && c.event_data.left_user == myself.id
              "
            >
              {{ formatTime(c.timestamp) }}: チャットから離脱しました
            </span>
            <span v-else-if="c.event_type == 'leave'" class="gray">
              {{ formatTime(c.timestamp) }}:
              {{
                people[c.event_data.left_user].name
              }}がチャットから離脱しました
            </span>
            <span v-else-if="c.event_type == 'kick'" class="gray">
              {{ formatTime(c.timestamp) }}:
              {{ people[c.event_data.left_user].name }}が{{
                people[c.person].name
              }}によりチャットから退出されられました
            </span>
            <span v-else>
              {{ formatTime(c.timestamp) }}: （不明なイベント
              {{ c.event_type }}）</span
            >
          </span>
        </div>
        <div
          v-if="c.event == 'comment'"
          :style="{
            'margin-left': '' + inRange(c.__depth - 1, 0, 5) * 30 + 'px',
            replying: replying?.id == c.id,
          }"
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
          <div class="local-entry-content">
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
  CommentHistoryEntry,
  CommentEvent,
  DateEvent,
  ChatEvent,
} from "@/@types/types"
import { countLines, formatTime } from "../util"
import { flattenTree, inRange, sortBy } from "@/common/util"

import { sameDate, formatDate } from "./room_chat_service"

import {
  defineComponent,
  reactive,
  watch,
  toRefs,
  computed,
  PropType,
  nextTick,
  ref,
} from "vue"

import MyPicker from "./MyPicker.vue"
// import data from "../../emoji-mart-vue-fast/data/all.json"
// import { Picker, EmojiIndex } from "../../emoji-mart-vue-fast/src"
// import "../../emoji-mart-vue-fast/css/emoji-mart.css"

// const emojiIndex = new EmojiIndex(data)

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
    events: {
      type: Array as PropType<ChatEvent[]>,
      required: true,
    },
    isMobile: {
      type: Boolean,
      required: true,
    },
  },
  setup(props, context) {
    const state = reactive({
      composing: false,
      voice: null as SpeechSynthesisVoice | null,
      inputTextWithoutDictation: undefined as string | undefined,
      dictation: {
        running: false,
        text: undefined as string | undefined,
      },
      recognition: null as any | null,
      showEmojiPicker: undefined as CommentId | undefined,
      replying: undefined as CommentEvent | undefined,
      numInputRows: 1,
    })
    const ChatInput = ref<HTMLTextAreaElement>()

    const onInput = async ev => {
      const text = ev.target.value
      console.log("watch ChatInput", text)
      if (!text || text == "") {
        state.numInputRows = 1
      }
      const c = countLines(ev.target)
      console.log("countLines", c)
      state.numInputRows = Math.min(c, 15)
      context.emit("onInputTextChange")
    }

    watch(
      () => state.numInputRows,
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

      const events = sortBy(
        props.events.map(e => {
          return { ...e, event: "event" }
        }) as CommentHistoryEntry[],
        c => c.timestamp
      )
      const comments_and_events: CommentHistoryEntry[] = []
      let event_idx = 0
      for (const c of comments) {
        if (c.__depth == 1) {
          for (
            ;
            event_idx < events.length &&
            events[event_idx].timestamp < c.timestamp;
            event_idx++
          ) {
            comments_and_events.push(events[event_idx])
          }
        }
        comments_and_events.push(c)
      }
      for (; event_idx < events.length; event_idx++) {
        comments_and_events.push(events[event_idx])
      }

      const comments_with_date: CommentHistoryEntry[] = []
      if (comments_and_events.length > 0) {
        comments_with_date.push({
          event: "new_date",
          date_str: formatDate(comments_and_events[0].timestamp),
        } as DateEvent)
      }
      let prev_toplevel = 0
      for (let i = 0; i < comments_and_events.length; i++) {
        const toplevel =
          comments_and_events[i]?.event == "comment"
            ? (comments_and_events[i] as CommentEvent).__depth == 1
            : true
        if (
          toplevel &&
          comments_and_events[i] &&
          !sameDate(
            comments_and_events[prev_toplevel]?.timestamp,
            comments_and_events[i]?.timestamp
          )
        ) {
          const d = new Date(comments_and_events[i].timestamp)
          d.setHours(0)
          d.setMinutes(0)
          d.setSeconds(0)
          d.setMilliseconds(0)
          comments_with_date.push({
            event: "new_date",
            date_str: formatDate(comments_and_events[i].timestamp),
            timestamp: d.valueOf(),
          } as DateEvent)
        }
        comments_with_date.push(comments_and_events[i])
        if (toplevel) {
          prev_toplevel = i
        }
      }
      // for (const e of props.events) {
      //   comments_with_date.push({ ...e, event: "event" })
      // }

      return comments_with_date // sortBy(comments_with_date, c => c.timestamp)
    })

    const clearInput = () => {
      if (!ChatInput.value) {
        console.error("Textarea ref not found")
        return
      }
      ChatInput.value.value = ""
    }

    const startUpdateComment = (cid: string) => {
      context.emit("set-editing-old", cid)
      state.replying = undefined
      if (!ChatInput.value) {
        console.error("Textarea ref not found")
        return
      }
      ChatInput.value.value = props.comments[cid].text_decrypted
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
      const text = ChatInput.value?.value
      console.log("Starting dictation")
      state.inputTextWithoutDictation = text || ""
      state.dictation.running = true

      const SpeechRecognition = webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      state.recognition = recognition
      recognition.interimResults = true
      recognition.lang = "ja-JP"

      recognition.onresult = event => {
        const text = event.results[0][0].transcript
        //Vue.set
        state.dictation.text = text
        const ta = ChatInput.value
        if (!ta) {
          console.error("Textarea ref not found")
          return
        }
        ta.value = state.inputTextWithoutDictation + text
        if (event.results[0].isFinal) {
          ta.value += "。"
        }
        console.log(event.results[0][0].transcript, event.results[0])
      }
      recognition.onend = () => {
        console.log("Ended")
        const ta = ChatInput.value
        if (!ta) {
          console.error("Textarea ref not found")
          return
        }
        state.inputTextWithoutDictation = ta.value
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

    const is_chrome = !!window["chrome"]

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
      context.emit("add-emoji-reaction", c.id, reaction_id, reaction, "chat")
      state.showEmojiPicker = undefined
    }

    const clickReaction = (
      c: ChatCommentDecrypted,
      reaction_id: CommentId,
      reaction: string
    ) => {
      context.emit("add-emoji-reaction", c.id, reaction_id, reaction, "chat")
    }

    const startReply = (c: CommentEvent) => {
      console.log("startReply", c)
      state.replying = c
      context.emit("set-editing-old", undefined)
      if (!ChatInput.value) {
        console.error("Textarea ref not found")
        return
      }
      ChatInput.value.value = ""

      ChatInput.value.focus()
    }

    const clickSubmit = () => {
      if (!ChatInput.value) {
        console.error("Textarea ref not found")
        return
      }
      context.emit(
        "submit-comment",
        ChatInput.value.value,
        state.replying
          ? {
              id: state.replying.id,
              depth: state.replying.__depth,
            }
          : undefined
      )
      ChatInput.value.value = ""
      state.numInputRows = 1
    }

    const onKeyDownEnterChatInput = (ev: KeyboardEvent) => {
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

    return {
      ...toRefs(state),
      ChatInput,
      formatTime,
      localCommentHistory,
      onInput,
      onKeyDownEnterChatInput,
      clearInput,
      startUpdateComment,
      speechText,
      toggleDictation,
      is_chrome,
      notSender,
      // emojiIndex,
      clickShowEmoji,
      selectEmoji,
      clickReaction,
      clickSubmit,
      startReply,
      inRange,
    }
  },
})
</script>

<style lang="css" scoped>
@import url("https://fonts.googleapis.com/css2?family=Lato&display=swap");
@import url("./chat.css");

#participants {
  display: inline-block;
  font-size: 12px;
  margin: 0px 0px 5px 10px;
}

#chat-local {
  position: absolute;
  top: 10px;
  min-width: 250px;
  height: calc(100% - 20px);
}

#chat-local-input-container {
  box-sizing: border-box;
  position: absolute;
  bottom: 10px;
  width: 100%;
  z-index: 100 !important;
}

#chat-local-history {
  position: absolute;
  top: 22px;
  margin-bottom: 100px;
  height: calc(100% - 152px);
  width: 100%;
  border: 1px solid #888;
  border-radius: 4px;
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

.person-in-local.typing {
  color: blue;
  font-weight: bold;
  animation-name: glowing_text;
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
  float: right;
  margin-right: 10px;
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

.chat_event {
  font-size: 12px;
  font-style: italic;
}
.chat_event .gray {
  color: #999;
}

.encrypt-icon {
  height: 25px;
}
</style>
