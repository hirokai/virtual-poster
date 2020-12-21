<template>
  <div id="notification-pane" @click.stop>
    <h1 class="is-1">通知</h1>
    <div v-if="notifications.length == 0">通知はありません</div>
    <div class="notification-entry" v-for="(n, i) in notifications" :key="i">
      <hr v-if="i > 0" />
      <div v-if="n.kind == 'new_comments'" @click="highlightUnreadComments">
        <div class="header">{{ formatTime(n.timestamp) }}</div>
        {{ n.data?.count }}件の<span
          style="color: rgb(255, 174, 22); font-weight: bold"
          >未読コメント</span
        >があります。<br />
        <small style="line-height: 0.7em"
          >オレンジ色の未読コメントまでスクロールするか，マウスをホーバーすると既読になります</small
        >
      </div>
      <div
        v-if="n.kind == 'poster_comments'"
        @click="$emit('approach-poster', n.data.poster)"
      >
        {{
          posters[n.data.poster]?.author == myself.id ? "自分の" : ""
        }}ポスター（{{ posters[n.data.poster]?.poster_number }}番）に{{
          n.data.count
        }}件のコメントがあります。
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
      type: Array as PropType<NotificationEntry[]>,
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
  },
  setup(props, context) {
    const state = reactive({})

    const highlightUnreadComments = () => {
      context.emit("close")
      context.emit("highlight-unread-comments", true)
    }

    return {
      ...toRefs(state),
      highlightUnreadComments,
      formatTime,
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
</style>
