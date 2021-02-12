<template>
  <div id="menu-on-map" v-if="mode == 'menu'">
    <h1>{{ breadcrumbs }}</h1>
    <ul>
      <li
        v-for="(item, i) in getItemAt(items, cursor.slice(0, cursor.length - 1))
          ?.children"
        :key="item"
        :class="{
          active: i == cursor[cursor.length - 1],
          disabled: item.children.length == 0 && !item.node.action,
        }"
      >
        {{ item.node.text }}
      </li>
    </ul>
  </div>
  <div id="menu-on-map" v-else-if="mode == 'info_person'">
    <h1>ユーザーの情報</h1>
    <div
      v-if="personInfo.person.profiles?.display_name_full?.content"
      style="font-weight: bold; font-size: 14px"
    >
      {{ personInfo.person.profiles?.display_name_full?.content }} （{{
        personInfo.person.name
      }}）
    </div>
    <div v-else style="font-weight: bold; font-size: 14px">
      {{ personInfo.person.name }}
    </div>
    <div
      style="font-weight: bold; font-size: 14px"
      v-if="personInfo.person.profiles?.affiliation"
    >
      {{ personInfo.person.profiles.affiliation.content }}
    </div>
    <div v-for="[k, v] in Object.entries(personInfo.person.profiles)" :key="k">
      <span
        v-if="
          ['url', 'url2', 'url3'].indexOf(k) >= 0 &&
          v.content.indexOf('http') == 0
        "
        style="font-size: 12px"
      >
        <div style="font-weight: bold">
          {{ showProfileKind(k, undefined, locale)
          }}{{ v.metadata?.description ? ": " + v.metadata?.description : "" }}
        </div>
        <div>
          <a :href="v.content" target="_blank">{{
            v.content.length > 60
              ? v.content.slice(0, 30) +
                "..." +
                v.content.slice(v.content.length - 30, v.content.length)
              : v.content
          }}</a>
        </div>
      </span>
    </div>
  </div>
  <div id="menu-on-map" class="status" v-else-if="mode == 'info_status'">
    <h1>{{ breadcrumbs }}</h1>
    <h1>自分のステータス</h1>
    <div class="status-entry">歩数: {{ myself.stats.walking_steps }}</div>
    <div class="status-entry">
      閲覧したポスター: {{ myself.stats.viewed_posters }} 枚
    </div>
    <div class="status-entry">
      会話した人数:
      {{ myself.stats.people_encountered.length }}
    </div>
    <div class="status-entry">
      探索済み: {{ visibleCellPercentage }} &percnt;
    </div>

    <!-- <div class="status-entry">
      会話の回数:
      {{ myself.stats.chat_count }}
    </div> -->
  </div>
  <div id="menu-on-map" v-else-if="mode == 'info_object'">
    <h1>{{ breadcrumbs }}</h1>
    <h1>物体の情報</h1>
    <div style="font-weight: bold; font-size: 14px">
      <div v-if="objectInfo.text">{{ objectInfo.text }}</div>
      <div v-if="objectInfo.url">
        URL: <a :href="objectInfo.url">{{ objectInfo.url }}</a>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { formatTime } from "../util"
import { flatten, getItemAt } from "../../common/util"

import { computed, defineComponent, PropType, reactive, toRefs } from "vue"
import { VisualStyle, PersonInMap, Tree, CellVisibility } from "@/@types/types"
import { Person } from "@/api/@types"
import { showProfileKind } from "@/common/util"

export default defineComponent({
  emits: ["approach-poster", "highlight-unread-comments", "close"],
  props: {
    myself: {
      type: Object as PropType<PersonInMap>,
    },
    visualStyle: {
      type: String as PropType<VisualStyle>,
      required: true,
    },
    locale: {
      type: String as PropType<"ja" | "en">,
      required: true,
    },
    items: {
      type: Object as PropType<Tree<{ text: string; action?: string }>>,
      required: true,
    },
    mode: {
      type: String as PropType<"menu" | "info_object" | "info_person">,
      required: true,
    },
    cursor: {
      type: Array as PropType<number[]>,
      required: true,
    },
    personInfo: {
      type: Object as PropType<{
        person?: Person
        hide: boolean
        color?: string
        timer?: number
      }>,
      required: true,
    },

    objectInfo: {
      type: Object as PropType<{
        text: string
        url: string
        hide: boolean
        color?: string
        timer?: number
      }>,
      required: true,
    },
    cellVisibility: {
      type: Array as PropType<CellVisibility[][]>,
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
    const breadcrumbs = computed(() => {
      const f = (
        items: Tree<{ text: string }>,
        cursor: number[],
        s: string
      ) => {
        const item = items.children[cursor[0]]
        if (cursor.length == 1) {
          return s
        } else {
          return f(item, cursor.slice(1), s + " > " + item.node?.text)
        }
      }
      return f(props.items, props.cursor, "") || ">"
    })

    const visibleCellPercentage = computed(() => {
      const cells = flatten(props.cellVisibility)
      const visibleCount = cells.filter(c => c != "not_visited").length
      return Math.floor((visibleCount / cells.length) * 100)
    })

    return {
      ...toRefs(state),
      highlightUnreadComments,
      formatTime,
      lang,
      getItemAt,
      breadcrumbs,
      showProfileKind,
      visibleCellPercentage,
    }
  },
})
</script>

<style lang="css" scoped>
div#menu-on-map {
  position: absolute;
  word-break: break-all;
  top: calc(50px + var(--cell_size) * 11 - 178px);
  left: calc(var(--cell_size) * 0.5 + 8px);
  width: calc(var(--cell_size) * 10);
  height: 160px;
  font-size: 12px;
  padding: 8px;
  background: rgba(200, 200, 255, 0.9);
  box-shadow: 2px 2px 2px #8c8;
  z-index: 100;
  /* animation: opacity 1s linear; */
}

div#menu-on-map.status {
  top: calc(50px + var(--cell_size) * 11 - 278px);
  height: 260px;
}
.poster_active div#menu-on-map {
  top: calc(50px + var(--cell_size) * 5 - 178px);
}

.poster_active div#menu-on-map.status {
  top: calc(50px + var(--cell_size) * 5 - 278px);
  height: 260px;
}

li {
  font-size: 20px;
}
li.active {
  font-weight: bold;
}
li.disabled {
  color: #888;
}

.status-entry {
  font-weight: bold;
  font-size: 20px;
}
</style>
