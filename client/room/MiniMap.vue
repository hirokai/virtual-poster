<template>
  <div>
    <svg
      id="minimap"
      :style="{
        opacity: hidden ? 0 : 1,
        height: '' + size * cells.length + 'px',
        width: '' + size * (cells[0] ? cells[0].length : 0) + 'px',
        'clip-path':
          'polygon( 0px 0px, 0px calc(' +
          size +
          ' * ' +
          cells.length +
          ') px, ' +
          (cells[0] ? cells[0].length : 0) * size +
          'px calc(' +
          size +
          ' * ' +
          cells.length +
          ') px, ' +
          (cells[0] ? cells[0].length : 0) * size +
          'px 0px)',
        top: isMobile ? '560px' : undefined,
      }"
    >
      <g v-for="(row, yi) in cells" :key="yi">
        <MiniMapCell
          v-for="(cell, xi) in row"
          :cell="cell"
          :key="xi"
          :left="cell.x * size"
          :top="cell.y * size"
          :selected="false"
          :chat="false"
          :chat_color="'pink'"
          @select="select"
          @dbl-click="dblClick"
        />
      </g>
      <g>
        <g
          v-for="person in people"
          :key="person.id"
          :transform="
            'translate (' + person.x * size + ' ' + person.y * size + ')'
          "
        >
          <image
            :xlink:href="
              avatarImages[
                person.avatar +
                  '-' +
                  (person.direction == 'none' ? 'down' : person.direction)
              ]
                ? 'data:image/png;base64,' +
                  avatarImages[
                    person.avatar +
                      '-' +
                      (person.direction == 'none' ? 'down' : person.direction)
                  ]
                : ''
            "
            :style="{ opacity: person.connected ? 1 : 0.5 }"
            :width="'' + size + 'px'"
            :height="'' + size + 'px'"
          />
          <rect
            class="typing-indicator"
            :width="'' + size + 'px'"
            :height="'' + size + 'px'"
            opacity="0.4"
            v-if="people_typing[person.id]"
          />
          <!-- <rect
            v-if="cell.contact || cell.chat || cell.chat_color"
            class="minimap-outline"
            x="1"
            y="1"
            width="7"
            height="7"
            rx="1px"
            fill="none"
            stroke-width="1"
            :stroke="cell.chat_color || 'rgba(0,0,255,0.3)'"
          /> -->
        </g>
      </g>
    </svg>
    <div
      id="minimap-area"
      :style="{
        left: 8 + (this.center.x - 5) * size + 'px',
        top: 612 + (this.center.y - 5) * size + 'px',
        width: size * 11 - 1 + 'px',
        height: size * 11 - 1 + 'px',
      }"
    ></div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, computed } from "vue"
import { Cell, Point, ChatGroup, Person, Direction } from "../../@types/types"
import MiniMapCell from "./MiniMapCell.vue"

export default defineComponent({
  components: {
    MiniMapCell,
  },
  props: {
    people_typing: {
      type: Object as PropType<{ [index: string]: boolean }>,
      required: true,
    },
    avatarImages: {
      type: Object as PropType<{ [index: string]: string }>,
      required: true,
    },
    hidden: {
      type: Boolean,
      required: true,
    },
    cells: {
      type: Array as PropType<Cell[][]>,
      required: true,
    },
    people: {
      type: Object as PropType<{ [index: string]: Person }>,
      required: true,
    },
    selectedPos: {
      type: Object as PropType<{ x: number; y: number }>,
    },
    center: {
      type: Object as PropType<{ x: number; y: number }>,
      required: true,
    },
    chatGroups: {
      type: Object as PropType<{ [index: string]: ChatGroup }>,
      required: true,
    },
    isMobile: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, context) {
    const dblClick = (p: Point) => {
      context.emit("dblClick", p)
    }
    const select = (p: Point) => {
      context.emit("select", p)
    }
    const size = computed(() => {
      return Math.floor(
        528 / (props.cells.length > 0 ? props.cells[0].length : 500 / 9)
      )
    })
    const personImgOffset = (direction: Direction): string => {
      if (direction == "left") {
        return -8 + "px"
      } else if (direction == "up") {
        return -24 + "px"
      } else if (direction == "right") {
        return -16 + "px"
      } else if (direction == "down") {
        return 0 + "px"
      } else if (direction == "none") {
        return 0 + "px"
      }
      return ""
    }
    const personImgClipPath = (direction: Direction): string => {
      if (direction == "left") {
        return "polygon(0px 8px, 0px 16px, 8px 16px, 8px 8px)"
      } else if (direction == "up") {
        return "polygon(0px 24px, 0px 32px, 8px 32px, 8px 24px)"
      } else if (direction == "right") {
        return "polygon(0px 16px, 0px 24px, 8px 24px, 8px 16px)"
      } else if (direction == "down") {
        return "polygon(0px 0px, 0px 8px, 8px 8px, 8px 0px)"
      } else if (direction == "none") {
        return "polygon(0px 0px, 0px 8px, 8px 8px, 8px 0px)"
      }
      return ""
    }

    return {
      dblClick,
      moveTo,
      select,
      personImgOffset,
      personImgClipPath,
      size,
    }
  },
})
</script>

<style lang="css">
svg#minimap {
  position: absolute;
  top: 612px;
  left: 8px;
  user-select: none;
  transition: opacity 0.5s linear;
}
</style>
