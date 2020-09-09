<template>
  <div>
    <div id="poster-container">
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
          'background-image':
            'url(data:image/png;base64,' + posterDataURI + ')',
          'background-position': '' + imagePos.x + 'px ' + imagePos.y + 'px',
          'background-size': '' + imageMag * 100 + '%',
        }"
        @mouseup="mouseUpPoster"
        @mousedown="mouseDownPoster"
        @mousemove="mouseMovePoster"
        @mousewheel="mouseWheelPoster"
      >
        <div
          id="poster-notfound"
          v-if="!!poster && posterStatus == 'not_found' && poster.author"
        >
          {{
            people[poster.author] ? people[poster.author].name : "（不明）"
          }}さんのポスター（未アップロード）
          <div class="note" v-if="poster.author == myself.id">
            アップロードするには，マップ中の木札のアイコンにPNGまたはPDFを<br />ドラッグ＆ドロップするか，マイページ（人型のアイコン）を開きます。
          </div>
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
      <div
        id="poster-help"
        v-show="imageMag == 1 && imagePos.x == 0 && imagePos.y == 0"
      >
        表示のスクロール：マウスのドラッグ。拡大縮小：ホイール（Mac:
        トラックパッドの2本指スクロール）
      </div>
    </div>
    <div id="poster-comments-container">
      <h3>ポスターにコメント書き込み</h3>
      <div id="poster-chat-input-container">
        <textarea
          ref="input"
          id="poster-chat-input"
          v-model="inputText"
          :rows="numInputRows"
          @compositionstart="composing = true"
          @compositionend="composing = false"
          @focus="$emit('on-focus-input', true)"
          @blur="$emit('on-focus-input', false)"
          placeholder="Shift+Enterで送信"
        ></textarea>
        <button
          id="submit-poster-comment"
          @click="$emit('submit-poster-comment', inputText)"
        >
          {{ editingOld ? "保存" : "送信" }}
        </button>
      </div>
      <div id="poster-comments">
        <div
          v-for="c in comments_sorted"
          class="poster-comment-entry"
          :key="c.timestamp + c.person + c.to + c.kind"
        >
          <span class="comment-name">{{ people[c.person].name }}</span>
          <span class="comment-time">{{ formatTime(c.timestamp) }}</span>
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
          <span
            class="comment-content"
            v-html="c.text_decrypted.replace(/[\r\n]/g, '<br>')"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { CommonMixin } from "./util"
import {
  Poster as PosterTyp,
  Point,
  Person,
  ChatCommentDecrypted,
} from "../../@types/types"
import { inRange, sortBy } from "../../common/util"
import axiosDefault from "axios"

import Vue from "vue"
import {
  defineComponent,
  reactive,
  watch,
  toRefs,
  ref,
  computed,
  PropType,
} from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

const API_ROOT = "/api"
const axios = axiosDefault.create({
  baseURL: API_ROOT,
})

export default defineComponent({
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
    inputFromParent: {
      type: String,
    },
  },
  setup(props, context) {
    const state = reactive({
      //FIXME: Stub
      numInputRows: 1,
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
    })
    const comments_sorted = computed(() => {
      return sortBy(Object.values(props.comments), c => c.timestamp)
    })
    const startUpdateComment = (cid: string) => {
      context.emit("set-editing-old", cid)
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
      () => props.inputFromParent,
      () => {
        if (props.inputFromParent) {
          state.inputText = props.inputFromParent
        } else {
          state.inputText = ""
        }
      }
    )
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

    const posterImage = ref<Element>()

    const clearInput = () => {
      state.inputText = ""
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
      // console.log(ev)
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

    return {
      ...toRefs(state),
      mouseDownPoster,
      mouseUpPoster,
      mouseMovePoster,
      mouseWheelPoster,
      startUpdateComment,
      comments_sorted,
      clearInput,
      ...CommonMixin,
    }
  },
})
</script>

<style lang="css">
#poster.inactive {
  background: #ccc;
}
#poster-notfound {
  padding-top: 300px;
  text-align: center;
}

#poster-notfound .note {
  font-size: 14px;
}

#poster-inactive {
  padding-top: 300px;
  text-align: center;
}

div#poster-container {
  position: absolute;
  background: white;
  right: 10px;
  top: 0px;
  min-width: 600px;
  min-height: 780px;
  width: calc(95vh / 1.4);
  height: 95vh;
  z-index: 200;
}

@media (max-width: 1270px) {
  div#poster-container {
    left: 550px;
  }
}

div#poster {
  cursor: grab;
  background: #ccc;
  background-size: 200%;
  background-repeat: no-repeat;
  filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.7));
  width: 100%;
  height: calc(100% - 5px);
  transition: 0.3s linear background-color;
}

div#poster > img {
  max-width: 100%;
  max-height: 100%;
  margin: 0px;
}

div#poster-comments-container {
  border: 1px solid #888;
  position: absolute;
  left: 8px;
  top: 613px;
  width: 526px;
  min-height: 100px;
  height: calc(100% - 633px);
  overflow: scroll;
  font-size: 12px;
  background: white;
}

div#poster-comments {
  margin: 20px 0px 0px 0px;
}

h3 {
  margin: 0px;
}

#poster-help {
  position: absolute;
  right: 10px;
  bottom: -20px;
  font-size: 12px;
}
</style>
