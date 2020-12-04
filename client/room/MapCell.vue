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
    @dblclick="$emit('dbl-click', { x: cell.x, y: cell.y })"
    @click="$emit('select', { x: cell.x, y: cell.y, event: $event })"
    @mouseenter="$emit('hover-cell', true, { x: cell.x, y: cell.y })"
    @mouseleave="$emit('hover-cell', false, { x: cell.x, y: cell.y })"
  >
    <image
      xlink:href="/img/map/kusa.png"
      width="48px"
      height="48px"
      v-if="pictureStyle"
    />
    <rect
      class="poster-name"
      v-if="cell.kind == 'poster' && abstractStyle"
      width="46px"
      y="28px"
      height="18px"
      opacity="0.4"
      fill="white"
    />
    <image
      v-if="cell.kind == 'poster_seat' && pictureStyle"
      xlink:href="/img/map/kusa_red.png"
      width="48px"
      height="48px"
    />
    <rect
      v-if="cell.kind == 'poster_seat' && abstractStyle"
      x="0"
      y="0"
      width="48px"
      height="48px"
      fill="#A8A735"
    />
    <rect
      v-if="
        cell.kind == 'poster' &&
        !(poster && myself && poster.author == myself.id) &&
        abstractStyle
      "
      x="0"
      y="0"
      width="48px"
      height="48px"
      fill="#7E7353"
    />
    <rect
      class="poster-name"
      v-if="
        cell.kind == 'poster' &&
        !person &&
        poster &&
        poster.author &&
        pictureStyle
      "
      width="46px"
      y="28px"
      height="18px"
      opacity="0.4"
      fill="white"
    />

    <image
      class="poster"
      v-if="
        cell.kind == 'poster' &&
        !(poster && myself && poster.author == myself.id) &&
        pictureStyle
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
      v-if="poster && myself && poster.author == myself.id && pictureStyle"
      xlink:href="/img/map/post.png"
      width="48px"
      height="48px"
      @dragover.prevent="onDragOverMyPoster"
      @dragleave.prevent="onDragLeaveMyPoster"
      @drop.prevent="poster ? onDropMyPoster($event, poster.id) : ''"
    />
    <rect
      :class="{ poster_self: true, drag_over: dragOver }"
      v-if="poster && myself && poster.author == myself.id && abstractStyle"
      width="48px"
      height="48px"
      fill="#7E7353"
      @dragover.prevent="onDragOverMyPoster"
      @dragleave.prevent="onDragLeaveMyPoster"
      @drop.prevent="poster ? onDropMyPoster($event, poster.id) : ''"
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

    <!-- <image
      v-if="cell.kind == 'grass' && pictureStyle"
      xlink:href="/img/map/kusa.png"
      width="48px"
      height="48px"
    /> -->
    <rect
      v-if="cell.kind == 'grass' && abstractStyle"
      x="0"
      y="0"
      width="48px"
      height="48px"
      fill="#8DAC4B"
    />
    <image
      v-if="cell.kind == 'water' && pictureStyle"
      xlink:href="/img/map/water.png"
      width="48px"
      height="48px"
    />
    <rect
      v-if="cell.kind == 'water' && abstractStyle"
      x="0"
      y="0"
      width="48px"
      height="48px"
      fill="#6D8793"
    />
    <image
      v-if="cell.kind == 'mud' && pictureStyle"
      xlink:href="/img/map/mud.png"
      width="48px"
      height="48px"
    />
    <rect
      v-if="cell.kind == 'mud' && abstractStyle"
      x="0"
      y="0"
      width="48px"
      height="48px"
      fill="#8D894E"
    />
    <image
      v-if="cell.kind == 'wall' && pictureStyle"
      xlink:href="/img/map/yama.png"
      width="48px"
      height="48px"
    />
    <rect
      v-if="cell.kind == 'wall' && abstractStyle"
      x="0"
      y="0"
      width="48px"
      height="48px"
      fill="#959174"
    />
  </g>
</template>

<script lang="ts">
import { Cell, Person, Poster, VisualStyle } from "@/@types/types"

import { defineComponent, reactive, toRefs, PropType, computed } from "vue"

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
    visualStyle: {
      type: String as PropType<VisualStyle>,
      required: true,
    },
  },
  setup(props, context) {
    const state = reactive({
      dragOver: false,
    })

    const abstractStyle = computed(() => {
      return (
        props.visualStyle == "abstract" ||
        props.visualStyle == "abstract_monochrome"
      )
    })

    const pictureStyle = computed(() => {
      return props.visualStyle == "monochrome" || props.visualStyle == "default"
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
        context.emit("upload-poster", file, poster_id)
      }
    }
    return {
      ...toRefs(state),
      onDragOverMyPoster,
      onDragLeaveMyPoster,
      onDropMyPoster,
      abstractStyle,
      pictureStyle,
    }
  },
})
</script>

<style lang="css">
g.cell {
  cursor: pointer;
}

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
