<template>
  <div id="notification-pane" @click.stop>
    <h1 class="is-1">{{ lang("notification") }}</h1>
    <div v-if="Object.keys(notifications).length == 0">{{ lang("none") }}</div>
    <div class="notification-entry" v-for="(n, i) in notifications" :key="i">
      <hr v-if="i > 0" />
      <div
        v-if="n.kind == 'new_chat_comments'"
        @click="highlightUnreadComments"
      >
        <div class="header">{{ formatTime(n.timestamp, locale) }}</div>
        {{ n.data?.comments.length }} {{ locale == "ja" ? "件の" : ""
        }}<span style="color: rgb(255, 174, 22); font-weight: bold"
          >{{ locale == "ja" ? "" : "You have "
          }}{{
            locale == "ja"
              ? "未読コメント"
              : n.data?.comments.length > 1
              ? "unread comments"
              : "unread comment"
          }}</span
        >{{ locale == "ja" ? "があります。" : "" }}<br />
        <small style="line-height: 0.7em">{{ lang("unread_note") }}</small>
        <div
          class="notification-close"
          @click="$emit('remove-notification', n.id)"
        >
          &times;
        </div>
      </div>
      <div
        v-else-if="n.kind == 'reply_chat_comments'"
        @click="highlightUnreadComments"
      >
        <div class="header">{{ formatTime(n.timestamp, locale) }}</div>
        {{ n.data?.comments.length }} {{ locale == "ja" ? "件の" : ""
        }}<span style="color: rgb(255, 174, 22); font-weight: bold"
          >{{ locale == "ja" ? "" : "You have "
          }}{{
            locale == "ja"
              ? "未読の返信"
              : n.data?.comments.length > 1
              ? "unread replies"
              : "unread reply"
          }}</span
        >{{ locale == "ja" ? "があります。" : "" }}<br />
        <small style="line-height: 0.7em">{{ lang("unread_note") }}</small>
        <div
          class="notification-close"
          @click="$emit('remove-notification', n.id)"
        >
          &times;
        </div>
      </div>
      <div
        v-else-if="n.kind == 'new_poster_comments'"
        @click="$emit('approach-poster', n.data.poster, true)"
      >
        {{
          locale == "ja"
            ? `${
                posters[n.data.poster]?.author == myself.id ? "自分の" : ""
              }ポスター（${posters[n.data.poster]?.poster_number}番）に${
                n.data.comments.length
              }件のコメントがあります。`
            : `You have ${n.data.comments.length} comment${
                n.data.comments.length > 1 ? "s" : ""
              } on ${
                posters[n.data.poster]?.author == myself.id ? "your " : ""
              } poster #${posters[n.data.poster]?.poster_number}.`
        }}
        <div
          class="notification-close"
          @click="$emit('remove-notification', n.id)"
        >
          &times;
        </div>
      </div>
      <div
        v-else-if="n.kind == 'reply_poster_comments'"
        @click="$emit('approach-poster', n.data.poster, true)"
      >
        {{
          locale == "ja"
            ? `${
                posters[n.data.poster]?.author == myself.id ? "自分の" : ""
              }ポスター（${posters[n.data.poster]?.poster_number}番）に${
                n.data.comments.length
              }件の返信があります。`
            : `You have ${n.data.comments.length} comment${
                n.data.comments.length > 1 ? "s" : ""
              } on ${
                posters[n.data.poster]?.author == myself.id ? "your " : ""
              } poster #${posters[n.data.poster]?.poster_number}.`
        }}
        <div
          class="notification-close"
          @click="$emit('remove-notification', n.id)"
        >
          &times;
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { formatTime } from "../util"

import { defineComponent, PropType, reactive, toRefs } from "vue"
import {
  VisualStyle,
  PersonInMap,
  NotificationEntry,
  Poster,
} from "@/@types/types"

export default defineComponent({
  emits: ["approach-poster", "highlight-unread-comments", "close"],
  props: {
    myself: {
      type: Object as PropType<PersonInMap>,
      required: true,
    },
    notifications: {
      type: Object as PropType<{
        [notification_id: string]: NotificationEntry
      }>,
      required: true,
    },
    visualStyle: {
      type: String as PropType<VisualStyle>,
      required: true,
    },
    posters: {
      type: Object as PropType<{ [poster_id: string]: Poster }>,
      required: true,
    },
    locale: {
      type: String as PropType<"ja" | "en">,
      required: true,
    },
  },
  setup(props, context) {
    const state = reactive({})

    const highlightUnreadComments = () => {
      context.emit("close")
      context.emit("highlight-unread-comments", true)
    }

    const lang = (key: string): string => {
      const message: {
        [key in string]: { [key in "ja" | "en"]: string }
      } = {
        notification: {
          ja: "通知",
          en: "Notification",
        },
        none: {
          ja: "通知はありません",
          en: "No notification",
        },
        unread_note: {
          ja:
            "オレンジ色の未読コメントまでスクロールするか，マウスをホーバーすると既読になります",
          en:
            "Scroll to the orange unread comments or hover your mouse over to mark them as read.",
        },
      }
      return message[key][props.locale]
    }

    return {
      ...toRefs(state),
      highlightUnreadComments,
      formatTime,
      lang,
    }
  },
})
</script>

<style lang="css" scoped>
#notification-pane {
  position: absolute;
  top: 30px;
  left: 450px;
  width: 300px;
  /* right: 40px;
  width: max(calc(100vw - 500px), 200px); */
  /* height: calc(100vh - 50px); */
  height: 300px;
  background: white;
  border: 1px solid black;
  filter: drop-shadow(2px 1px 2px #8f8f8f);
  -webkit-filter: drop-shadow(2px 1px 2px #8f8f8f);
  -moz-filter: drop-shadow(2px 1px 2px #8f8f8f);
  z-index: 1000;
}

.dark #notification-pane {
  background: #333;
}

hr {
  margin: 0px;
}

.notification-entry > div {
  border-radius: 5px;
  margin: 5px;
  padding: 10px;
}
.notification-entry:hover > div {
  background: #ccc;
}

h1 {
  font-weight: bold;
  font-size: 18px;
}

.header {
  font-size: 14px;
}

.notification-close {
  float: right;
  height: 20px;
  width: 20px;
}
.notification-close:hover {
  font-weight: bold;
}
</style>
