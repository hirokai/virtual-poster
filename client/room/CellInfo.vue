<template>
  <div id="cell-info" style="font-size: 10px; height: 15px;">
    <span v-if="cell">
      <span v-if="cell" id="cell-position">{{ cell.x }}-{{ cell.y }}</span>
      <span v-if="cell && person">
        {{ person.name + (cell.kind == "poster" ? "（ポスター発表中）" : "") }}
        {{ person.stats.walking_steps + "歩" }}, 計
        {{ person.stats.people_encountered.length + "人と会話" }}
      </span>
      <span v-else-if="cell && !person && cell.kind == 'poster'">{{
        "ポスター（" + cell.name + "）"
      }}</span>
      <span v-else-if="cell && !person && cell.kind == 'wall'">壁</span>
      <span v-else-if="cell && !person && cell.kind == 'mud'">地面（土）</span>
      <span v-else-if="cell && !person && cell.kind == 'water'">池</span>
      <span v-else-if="cell && !person && cell.kind == 'grass'"
        >地面（草）</span
      >
      <span v-else-if="cell && !person && cell.kind == 'poster_seat'"
        >ポスター席</span
      >
      <span v-else>その他</span>
    </span>
    <span> </span>
  </div>
</template>

<script lang="ts">
import { Cell, Person } from "../../@types/types"

import Vue from "vue"
import { defineComponent, PropType } from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

export default defineComponent({
  props: {
    cell: {
      type: Object as PropType<Cell>,
    },
    person: {
      type: Object as PropType<Person>,
    },
  },
  setup() {
    return {}
  },
})
</script>

<style lang="css">
#selected-position {
  display: inline-block;
  width: 30px;
}

#cell-info {
  position: absolute;
  top: 33px;
  left: 10px;
}
</style>
