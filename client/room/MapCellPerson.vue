<template>
  <g
    class="cell"
    :class="{
      self: myself,
      connected: person.connected,
      chat: !!chat,
      selected: selected,
      selected_user: selectedUser,
      up: person.direction == 'up',
      left: person.direction == 'left',
      down: person.direction == 'down',
      right: person.direction == 'right',
    }"
    :data-x="person.x"
    :data-y="person.y"
    :transform="'translate (' + left + ' ' + top + ')'"
    :style="{
      width: '' + cellSize + 'px',
      height: '' + cellSize + 'px',
    }"
    @dblclick="$emit('dbl-click', { x: person.x, y: person.y })"
    @click="$emit('select', { x: person.x, y: person.y, event: $event })"
    @mouseenter="
      $emit('hover-cell', true, { x: person.x, y: person.y, person })
    "
    @mouseleave="
      $emit('hover-cell', false, { x: person.x, y: person.y, person })
    "
  >
    <image
      v-if="pictureStyle"
      :style="{ opacity: person.connected ? 1 : 0.3 }"
      :xlink:href="avatarImage"
      :width="'' + cellSize + 'px'"
      :height="'' + cellSize + 'px'"
    />
    <circle
      v-if="abstractStyle"
      :style="{ opacity: person.connected ? 1 : 0.3 }"
      :cx="cellSize / 2"
      :cy="cellSize / 2"
      :r="cellSize / 2"
      :fill="abstractColorOfAvatar(person.avatar)"
      :stroke="monochromeStyle ? 'black' : ''"
      :stroke-width="monochromeStyle ? '' + cellSize / 24 + 'px' : ''"
      :stroke-dasharray="
        monochromeStyle ? (person.connected ? '' : '' + cellSize / 16) : ''
      "
    />
    <path
      v-if="abstractStyle && person.direction != 'none'"
      :style="{ opacity: 0.3 }"
      :d="
        'M0,0 L0,-' +
          cellSize / 2 +
          ' A' +
          cellSize / 2 +
          ',' +
          cellSize / 2 +
          ' 0 0,1 0,' +
          cellSize / 2 +
          'z'
      "
      fill="#000"
      class="person-abstract-front"
      :transform="
        'translate(' +
          cellSize / 2 +
          ', ' +
          cellSize / 2 +
          ') rotate(' +
          (person.direction == 'up'
            ? 90
            : person.direction == 'left'
            ? 0
            : person.direction == 'down'
            ? -90
            : person.direction == 'right'
            ? 180
            : 0) +
          ')'
      "
    />
    <rect
      v-if="chat || chat_color"
      class="outline"
      x="1"
      y="1"
      :width="'' + (cellSize - 2) + 'px'"
      :height="'' + (cellSize - 2) + 'px'"
      rx="5px"
      fill="none"
      stroke-width="2"
      :stroke="chat_color || 'rgba(0,0,255,0.3)'"
    />
    <rect
      v-if="selectedUser && !(chat || chat_color)"
      class="outline-selected"
      x="1"
      y="1"
      :width="'' + (cellSize - 2) + 'px'"
      :height="'' + (cellSize - 2) + 'px'"
      :rx="'' + (cellSize * 5) / 48 + 'px'"
      fill="none"
      stroke-width="2"
      stroke="#444"
    />
    <rect
      v-if="selected && !(chat || chat_color)"
      class="outline-selected-main"
      x="1"
      y="1"
      :width="'' + (cellSize - 2) + 'px'"
      :height="'' + (cellSize - 2) + 'px'"
      :rx="'' + (cellSize * 5) / 48 + 'px'"
      fill="none"
      stroke-width="2"
      stroke="blue"
    />
    <rect
      v-if="person.poster_viewing"
      x="0"
      y="0"
      :width="'' + (cellSize - 2) + 'px'"
      :height="'' + (cellSize - 2) + 'px'"
      fill="#994c15"
      opacity="0.5"
    />
    <rect
      :y="'' + (cellSize * 28) / 48 + 'px'"
      :width="'' + (cellSize - 2) + 'px'"
      :height="'' + (cellSize * 18) / 48 + 'px'"
      opacity="0.4"
      fill="white"
    />
    <text
      class="person-name"
      :style="{
        'font-size':
          person.name.length >= 5
            ? (cellSize * 10) / 48
            : person.name.length >= 4
            ? (cellSize * 12) / 48
            : (cellSize * 14) / 48,
        'font-weight':
          person.avatar?.split(':')[2] == 'bold' ? 'bold' : 'normal',
      }"
      :fill="person.avatar?.split(':')[1] || 'black'"
      :x="'' + (cellSize * 24) / 48 + 'px'"
      :y="'' + (cellSize * 44) / 48 + 'px'"
      dominant-baseline="bottom"
      text-anchor="middle"
      >{{ person.name }}</text
    >
    <rect
      class="typing-indicator"
      :width="'' + cellSize + 'px'"
      :height="'' + cellSize + 'px'"
      opacity="0.4"
      v-if="typing"
    />
  </g>
</template>

<script lang="ts">
import { PersonInMap, VisualStyle } from "@/@types/types"
import { defineComponent, reactive, computed, PropType, toRefs } from "vue"
import { abstractColorOfAvatar } from "./util"

export default defineComponent({
  props: {
    typing: {
      type: Boolean,
      required: true,
    },
    myself: {
      type: Boolean,
      required: true,
    },
    person: {
      type: Object as PropType<PersonInMap>,
      required: true,
    },
    avatarImages: {
      type: Object as PropType<{ [index: string]: string }>,
      required: true,
    },
    chat: {
      type: Boolean,
      required: true,
    },
    chat_color: {
      type: String,
    },
    selected: {
      type: Boolean,
      required: true,
    },
    selectedUser: {
      type: Boolean,
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
    cellSize: {
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

    const avatarImage = computed(() => {
      const avatar = props.person.avatar
      const dir =
        props.person.direction == "none" ? "down" : props.person.direction
      const data_url = avatar
        ? props.avatarImages[avatar.split(":")[0] + "-" + dir]
        : undefined
      return data_url && avatar
        ? "data:image/png;base64," + data_url
        : "/img/avatar/" + avatar?.split(":")[0] + "-" + dir + ".png"
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

    const abstractStyle = computed(() => {
      return (
        props.visualStyle == "abstract" ||
        props.visualStyle == "abstract_monochrome"
      )
    })

    const pictureStyle = computed(() => {
      return props.visualStyle == "monochrome" || props.visualStyle == "default"
    })

    const monochromeStyle = computed(() => {
      return (
        props.visualStyle == "monochrome" ||
        props.visualStyle == "abstract_monochrome"
      )
    })

    return {
      ...toRefs(state),
      avatarImage,
      onDragOverMyPoster,
      onDragLeaveMyPoster,
      onDropMyPoster,
      abstractColorOfAvatar,
      abstractStyle,
      pictureStyle,
      monochromeStyle,
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

@keyframes glowing {
  0% {
    opacity: 0.2;
  }
  100% {
    opacity: 0.4;
  }
}

.typing-indicator {
  animation-name: glowing;
  animation-duration: 0.8s;
  animation-direction: alternate;
  animation-iteration-count: infinite;

  fill: #f64;
}

.person-abstract-front {
  filter: saturate(1.3);
}
</style>
