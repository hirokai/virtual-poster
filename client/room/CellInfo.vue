<template>
  <div id="cell-info">
    <span v-if="cell">
      <span v-if="cell" id="cell-position">{{ cell.x }}-{{ cell.y }}</span>
      <span v-if="cell && person">
        {{ person.name }}
      </span>
      <span v-else-if="cell && !person && cell.kind == 'poster'">{{
        "ポスター板"
      }}</span>
      <span v-else-if="cell && !person && cell.kind == 'wall'">{{
        locale == "ja" ? "壁" : "Wall"
      }}</span>
      <span v-else-if="cell && !person && cell.kind == 'mud'">{{
        locale == "ja" ? "土" : "Mud"
      }}</span>
      <span v-else-if="cell && !person && cell.kind == 'water'">{{
        locale == "ja" ? "水" : "Water"
      }}</span>
      <span v-else-if="cell && !person && cell.kind == 'grass'">{{
        locale == "ja" ? "草地" : "Grass"
      }}</span>
      <span v-else-if="cell && !person && cell.kind == 'poster_seat'">{{
        locale == "ja" ? "ポスター席" : "Poster seat"
      }}</span>
      <span v-else>{{ locale == "ja" ? "その他" : "Other" }}</span>
    </span>
    <span v-if="cell && cell.link_url"
      >({{ locale == "ja" ? "リンク" : "Link" }}
      {{
        cell.link_url.slice(0, 30) + (cell.link_url.length > 30 ? "..." : "")
      }})</span
    >
  </div>
</template>

<script lang="ts">
import { Cell, Person, Poster } from "@/@types/types"

import { defineComponent, PropType } from "vue"

export default defineComponent({
  props: {
    cell: {
      type: Object as PropType<Cell>,
    },
    person: {
      type: Object as PropType<Person>,
    },
    poster: {
      type: Object as PropType<Poster>,
    },
    locale: {
      type: String as PropType<"ja" | "en">,
      required: true,
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
  font-size: 10px;
  height: 15px;
  z-index: 100;
}
</style>
