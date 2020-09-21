<template>
  <svg
    id="cells"
    :style="cssVars"
    :class="{ small: !!activePoster, normal: goBackToNormal }"
    viewBox="0 0 528 528"
  >
    <g v-for="(row, yi) in cells" :key="yi" :data-y="row[0].y">
      <MapCell
        v-for="(cell, xi) in row"
        :cell="cell"
        :myself="myself"
        :people="people"
        :poster="poster(cell)"
        :key="'' + xi + '.' + yi"
        :selected="
          !!selectedPos && cell.x == selectedPos.x && cell.y == selectedPos.y
        "
        :left="(cell.x - center.x + 5) * 48"
        :top="(cell.y - center.y + 5) * 48"
        @select="select"
        @dbl-click="dblClick"
        @upload-poster="uploadPoster"
      />
    </g>
    <g id="person-cells">
      <MapCellPerson
        v-for="person in peopleInMagMap"
        :key="person.id + ':' + person.name"
        :person="person"
        :myself="!!myself && myself.id == person.id"
        :left="(person.x - center.x + 5) * 48"
        :top="(person.y - center.y + 5) * 48"
        :chat="!!chatGroupOfUser[person.id]"
        :typing="!!people_typing[person.id]"
        :selected="
          !!selectedPos &&
            person.x == selectedPos.x &&
            person.y == selectedPos.y
        "
        :selectedUser="selectedUsers.has(person.id)"
        :chat_color="
          chatGroupOfUser[person.id]
            ? chatGroups[chatGroupOfUser[person.id]].color
            : undefined
        "
        :avatarImages="avatarImages"
        @select="select"
        @dbl-click="dblClick"
      />
    </g>
    <g id="controller" @mousedown="clickController" opacity="0.8">
      <g id="レイヤー_1-2" data-name="レイヤー 1">
        <polygon
          class="cls-3"
          points="96 48 96 0 48 0 48 48 0 48 0 96 48 96 96 96 144 96 144 48 96 48"
          transform="translate (1 1)"
          fill="none"
          filter="url(#drop-shadow)"
        />
        <polygon
          class="cls-1"
          points="96 48 96 0 48 0 48 48 0 48 0 96 48 96 96 96 144 96 144 48 96 48"
        />
      </g>
      <g>
        <polygon
          class="cls-2"
          points="71.91 10.225 59.485 22.65 67.723 22.65 67.723 37.775 76.277 37.775 76.277 22.65 84.515 22.65 71.91 10.225"
        />
        <polygon
          class="cls-2"
          points="76.277 73.351 76.277 58.225 67.723 58.225 67.723 73.351 59.485 73.351 72.09 85.775 84.515 73.351 76.277 73.351"
        />
        <polygon
          class="cls-2"
          points="134.819 72.954 122.394 60.529 122.394 68.767 107.268 68.767 107.268 77.32 122.394 77.32 122.394 85.558 134.819 72.954"
        />
        <polygon
          class="cls-2"
          points="21.606 68.767 21.606 60.529 9.181 73.134 21.606 85.558 21.606 77.32 36.732 77.32 36.732 68.767 21.606 68.767"
        />
      </g>

      <filter id="drop-shadow">
        <!-- 図形の影をSourceAlphaで取得、ぼかす-->
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"></feGaussianBlur>
      </filter>
    </g>
  </svg>
</template>

<script lang="ts">
import {
  defineComponent,
  reactive,
  watch,
  toRefs,
  computed,
  PropType,
} from "vue"
import {
  Cell,
  Point,
  ChatGroup,
  ChatGroupId,
  PersonInMap,
  Poster,
  PosterId,
  UserId,
  ArrowKey,
} from "../../@types/types"
import MapCell from "./MapCell.vue"
import MapCellPerson from "./MapCellPerson.vue"
import { keyBy } from "../../common/util"

export default defineComponent({
  components: {
    MapCell,
    MapCellPerson,
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
    chatGroupOfUser: {
      type: Object as PropType<{ [userId: string]: ChatGroupId }>,
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
      type: Object as PropType<{ [index: string]: PersonInMap }>,
      required: true,
    },
    selectedUsers: {
      type: Set as PropType<Set<UserId>>,
      required: true,
    },
    selectedPos: {
      type: Object as PropType<{ x: number; y: number }>,
    },
    center: {
      type: Object as PropType<{ x: number; y: number }>,
      required: true,
    },
    posters: {
      type: Object as PropType<{ [index: string]: Poster }>,
      required: true,
    },
    myself: {
      type: Object as PropType<PersonInMap>,
    },
    chatGroups: {
      type: Object as PropType<{ [index: string]: ChatGroup }>,
      required: true,
    },
    isMobile: {
      type: Boolean,
      required: true,
    },
    activePoster: {
      type: Object as PropType<Poster>,
    },
  },
  setup(props, context) {
    const state = reactive({
      goBackToNormal: false,
    })
    const select = (p: Point) => {
      context.emit("select", p)
    }
    const uploadPoster = (file: File, poster_id: PosterId) => {
      context.emit("upload-poster", file, poster_id)
    }
    const personAt = (pos: Point): PersonInMap | undefined => {
      return Object.values(props.people).find(p => {
        return p.x == pos.x && p.y == pos.y
      })
    }
    const peopleInMagMap = computed((): PersonInMap[] => {
      return Object.values(props.people).filter(p => {
        return (
          Math.abs(p.x - props.center.x) <= 5 &&
          Math.abs(p.y - props.center.y) <= 5
        )
      })
    })
    const posterByCellId = computed((): { [index: string]: Poster } => {
      return keyBy(Object.values(props.posters), "location")
    })
    const dblClick = (p: Point) => {
      console.log("dblClick", p)
      context.emit("dblClick", p)
    }
    const poster = (cell: Cell): Poster | null => {
      return posterByCellId.value[cell.id]
    }
    const pressArrowButton = (key: ArrowKey) => {
      context.emit("inputArrowKey", key)
    }
    const clickController = event => {
      const scale = props.activePoster ? 0.6 : 1
      const x = event.layerX - 384 * scale
      const y = event.layerY - 432 * scale
      if (y <= 48 * scale) {
        pressArrowButton("ArrowUp")
      } else if (x < 48 * scale) {
        pressArrowButton("ArrowLeft")
      } else if (x < 96 * scale) {
        pressArrowButton("ArrowDown")
      } else {
        pressArrowButton("ArrowRight")
      }
    }

    const cssVars = reactive({
      opacity: computed(() => {
        return props.hidden ? 0 : 1
      }),
      "--map_y_offset": computed(() => {
        return props.myself ? 3 + props.myself.y - props.center.y : 3
      }),
      "--controller_y": computed(() => {
        return (
          "" +
          48 * ((props.myself?.y || props.center.y) - props.center.y + 6) +
          "px"
        )
      }),
      top: props.isMobile ? "0px" : undefined,
      left: props.isMobile ? "3px" : undefined,
    })

    watch(
      () => !!props.activePoster,
      () => {
        if (!props.activePoster) {
          state.goBackToNormal = true
        }
      }
    )

    const isSelectedUser = (cell: Cell) => {
      return props.selectedUsers.has(
        personAt({ x: cell.x, y: cell.y })?.id || "null"
      )
    }
    return {
      ...toRefs(state),
      dblClick,
      poster,
      clickController,
      posterByCellId,
      uploadPoster,
      isSelectedUser,
      peopleInMagMap,
      select,
      personAt,
      cssVars,
    }
  },
})
</script>

<style lang="css">
:root {
  --map_scale_normal: 1;
  --map_scale_small: 0.5;
}

svg#cells {
  position: absolute;
  left: 8px;
  top: 50px;
  height: calc(48px * 11);
  width: calc(48px * 11);
  user-select: none;
  /* transform: translate(0px, 0px) scale(0.8); */
  transition: opacity 0.3s linear;
  z-index: -1;
}

svg#cells.normal {
  animation-name: svg_scale_back;
  animation-duration: 1s;
  animation-direction: normal;
  animation-fill-mode: forwards;
}

svg#cells.small {
  animation-name: svg_scale;
  animation-duration: 1s;
  animation-direction: normal;
  animation-fill-mode: forwards;
}

svg#cells #controller {
  transform: translate(384px, 432px);
  animation-name: controller_translate_rev;
  animation-duration: 1s;
  animation-direction: normal;
  animation-fill-mode: forwards;
}

svg#cells.small #controller {
  animation-name: controller_translate;
  animation-duration: 1s;
  animation-direction: normal;
  animation-fill-mode: forwards;
}

@keyframes controller_translate {
  0% {
    transform: translate(384px, 432px);
  }
  50% {
    transform: translate(384px, var(--controller_y));
  }
  100% {
    transform: translate(384px, var(--controller_y));
  }
}

@keyframes controller_translate_rev {
  0% {
    transform: translate(384px, var(--controller_y));
  }
  50% {
    transform: translate(384px, var(--controller_y));
  }
  100% {
    transform: translate(384px, 432px);
  }
}

@keyframes svg_scale {
  0% {
    transform: translate(0px, 0px) scale(var(--map_scale_normal));
    clip-path: polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%);
  }
  50% {
    transform: translate(0px, 0px) scale(var(--map_scale_normal));
    clip-path: polygon(
      0% calc(48px * var(--map_y_offset)),
      0% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * var(--map_y_offset))
    );
  }
  100% {
    transform: translate(0px, calc(-48px * var(--map_y_offset)))
      scale(var(--map_scale_normal));
    clip-path: polygon(
      0% calc(48px * var(--map_y_offset)),
      0% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * var(--map_y_offset))
    );
  }
}

@keyframes svg_scale_back {
  0% {
    transform: translate(0px, calc(-48px * var(--map_y_offset)))
      scale(var(--map_scale_normal));
    clip-path: polygon(
      0% calc(48px * var(--map_y_offset)),
      0% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * var(--map_y_offset))
    );
    -webkit-clip-path: polygon(
      0% calc(48px * var(--map_y_offset)),
      0% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * var(--map_y_offset))
    );
  }
  50% {
    transform: translate(0px, 0px) scale(var(--map_scale_normal));
    clip-path: polygon(
      0% calc(48px * var(--map_y_offset)),
      0% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * var(--map_y_offset))
    );
    -webkit-clip-path: polygon(
      0% calc(48px * var(--map_y_offset)),
      0% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * (var(--map_y_offset) + 5)),
      100% calc(48px * var(--map_y_offset))
    );
  }
  100% {
    transform: translate(0px, 0px) scale(var(--map_scale_normal));
    clip-path: polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%);
    -webkit-clip-path: polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%);
  }
}

#controller polygon {
  cursor: pointer;
}

.cls-1 {
  fill: #555;
}

.cls-3 {
  stroke: #222;
  stroke-width: 3px;
  fill: "none";
}
.cls-2 {
  fill: white;
}
</style>
