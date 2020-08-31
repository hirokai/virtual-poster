<template>
  <g
    class="cell mini"
    :class="{
      wall: cell.kind == 'wall',
      mud: cell.kind == 'mud',
      water: cell.kind == 'water',
      poster: cell.kind == 'poster',
    }"
    :transform="'translate (' + left + ' ' + top + ')'"
    :style="{
      width: 9 + 'px',
      height: 9 + 'px',
    }"
    @dblclick="$emit('dbl-click', { x: cell.x, y: cell.y })"
    @click="$emit('select', { x: cell.x, y: cell.y }, $event)"
  >
    <image xlink:href="/img/map/kusa.png" width="9px" height="9px" />
    <image
      v-if="cell.kind == 'poster'"
      :xlink:href="'/img/map/' + (cell.custom_image || 'post.png')"
      width="9px"
      height="9px"
    />
    <image
      v-if="cell.kind == 'water'"
      xlink:href="/img/map/water.png"
      width="9px"
      height="9px"
    />
    <image
      v-if="cell.kind == 'mud'"
      xlink:href="/img/map/mud.png"
      width="9px"
      height="9px"
    />
    <image
      v-if="cell.kind == 'wall'"
      xlink:href="/img/map/yama.png"
      width="9px"
      height="9px"
    />
    <rect
      v-if="chat"
      class="minimap-outline"
      x="1"
      y="1"
      width="7"
      height="7"
      rx="1px"
      fill="none"
      stroke-width="1"
      :stroke="chat_color || 'rgba(0,0,255,0.3)'"
    />
  </g>
</template>

<script lang="ts">
import { Cell } from "../../@types/types"

import Vue from "vue"
import { defineComponent, PropType } from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

export default defineComponent({
  props: {
    chat: {
      type: Boolean,
      required: true,
    },
    chat_color: {
      type: String,
      required: true,
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
})
</script>

<style lang="css"></style>

},
