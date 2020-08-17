<template>
  <g
    class="cell"
    :class="{
      wall: cell.kind == 'wall',
      mud: cell.kind == 'mud',
      water: cell.kind == 'water',
      poster: cell.kind == 'poster',
      poster_seat: cell.kind == 'poster_seat',
      selected: selected,
    }"
    :data-x="cell.x"
    :data-y="cell.y"
    :transform="'translate (' + left + ' ' + top + ')'"
    :style="{
      width: 48 + 'px',
      height: 48 + 'px',
    }"
    @dblclick="$emit('dblClick', { x: cell.x, y: cell.y })"
    @click="$emit('select', { x: cell.x, y: cell.y, event: $event })"
  >
    <image
      v-if="cell.kind == 'poster_seat'"
      xlink:href="/img/map/kusa_red.png"
      width="48px"
      height="48px"
    />
    <image v-else xlink:href="/img/map/kusa.png" width="48px" height="48px" />
    <rect
      class="poster-name"
      v-if="cell.kind == 'poster' && !person && poster && poster.author"
      width="46px"
      y="28px"
      height="18px"
      opacity="0.4"
      fill="white"
    />
    <text
      class="poster-name"
      v-if="
        cell.kind == 'poster' &&
          !person &&
          poster &&
          poster.author &&
          people[poster.author]
      "
      x="24px"
      y="44px"
      :style="{
        'font-size': 16,
        'font-weight': 'bold',
      }"
      dominant-baseline="bottom"
      text-anchor="middle"
      >{{ poster.poster_number }}</text
    >
    <image
      class="poster"
      v-if="
        cell.kind == 'poster' &&
          !(poster && myself && poster.author == myself.id)
      "
      :xlink:href="'/img/map/' + (cell.custom_image || 'post.png')"
      width="48px"
      height="48px"
    />
    <rect
      v-if="poster && myself && poster.author == myself.id && dragOver"
      x="1"
      y="1"
      width="46"
      height="46"
      stroke="red"
      stroke-width="2"
      fill="none"
    />
    <image
      :class="{ poster_self: true, drag_over: dragOver }"
      v-if="poster && myself && poster.author == myself.id"
      xlink:href="/img/map/post.png"
      width="48px"
      height="48px"
      @dragover.prevent="onDragOverMyPoster"
      @dragleave.prevent="onDragLeaveMyPoster"
      @drop.prevent="poster ? onDropMyPoster($event, poster.id) : ''"
    />

    <image
      v-if="cell.kind == 'grass'"
      xlink:href="/img/map/kusa.png"
      width="48px"
      height="48px"
    />
    <image
      v-if="cell.kind == 'water'"
      xlink:href="/img/map/water.png"
      width="48px"
      height="48px"
    />
    <image
      v-if="cell.kind == 'mud'"
      xlink:href="/img/map/mud.png"
      width="48px"
      height="48px"
    />
    <image
      v-if="cell.kind == 'wall'"
      xlink:href="/img/map/yama.png"
      width="48px"
      height="48px"
    />
  </g>
</template>

<script lang="ts">
import { Cell, Person, Poster } from "../../../@types/types"

import Vue from "vue"
import {
  defineComponent,
  reactive,
  toRefs,
  PropType,
} from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

export default defineComponent({
  // @Prop() public myself!: Person

  props: {
    people: {
      type: Object as PropType<{ [index: string]: Person }>,
      required: true,
    },
    myself: {
      type: Object as PropType<Person>,
    },
    poster: {
      type: Object as PropType<Poster>,
    },
    person: {
      type: Object as PropType<Person>,
    },
    selected: {
      type: Boolean,
      required: true,
    },
    cell: {
      type: Object as PropType<Cell>,
      required: true,
    },
    left: {
      type: Number,
      required: true,
    },
    top: {
      type: Number,
      required: true,
    },
  },
  setup(props, context) {
    const state = reactive({
      dragOver: false,
    })

    const onDragOverMyPoster = () => {
      state.dragOver = true
    }
    const onDragLeaveMyPoster = () => {
      state.dragOver = false
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
        context.emit("uploadPoster", file, poster_id)
      }
    }
    return {
      ...toRefs(state),
      onDragOverMyPoster,
      onDragLeaveMyPoster,
      onDropMyPoster,
    }
  },
})
</script>

<style lang="css">
.presenter .person-name {
  fill: red;
}

.cell.contact rect.outline {
  /* outline: 2px solid rgba(0, 0, 255, 0.3);
  box-shadow: 0 0 0 -2px rgba(0, 0, 255, 0.3); */
  border-radius: 10px;

  /* outline-offset: -2px; */
}

:hover .cell.outline-selected {
  fill: blue;
}
</style>
