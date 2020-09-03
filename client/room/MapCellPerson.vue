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
      width: 48 + 'px',
      height: 48 + 'px',
    }"
    @dblclick="$emit('dbl-click', { x: person.x, y: person.y })"
    @click="$emit('select', { x: person.x, y: person.y, event: $event })"
  >
    <image
      :style="{ opacity: person.connected ? 1 : 0.3 }"
      :xlink:href="avatarImage"
      width="48px"
      height="48px"
    />
    <rect
      v-if="chat || chat_color"
      class="outline"
      x="1"
      y="1"
      width="46"
      height="46"
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
      width="46"
      height="46"
      rx="5px"
      fill="none"
      stroke-width="2"
      stroke="#444"
    />
    <rect
      v-if="selected && !(chat || chat_color)"
      class="outline-selected-main"
      x="1"
      y="1"
      width="46"
      height="46"
      rx="5px"
      fill="none"
      stroke-width="2"
      stroke="blue"
    />
    <rect width="46px" y="28px" height="18px" opacity="0.4" fill="white" />
    <text
      class="person-name"
      :style="{
        'font-size':
          person.name.length >= 5 ? 10 : person.name.length >= 4 ? 12 : 14,
      }"
      x="24px"
      y="44px"
      dominant-baseline="bottom"
      text-anchor="middle"
      >{{ person.name }}</text
    >
    <rect
      class="typing-indicator"
      width="48px"
      height="48px"
      opacity="0.4"
      v-if="typing"
    />
  </g>
</template>

<script lang="ts">
import { Person } from "../../@types/types"
import Vue from "vue"
import {
  defineComponent,
  reactive,
  computed,
  PropType,
  toRefs,
} from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

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
      type: Object as PropType<Person>,
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
  },
  setup(props, context) {
    const state = reactive({
      dragOver: false,
    })

    const avatarImage = computed(() => {
      const dir =
        props.person.direction == "none" ? "down" : props.person.direction
      const data_url = props.avatarImages[props.person.avatar + "-" + dir]
      return data_url ? "data:image/png;base64," + data_url : "N/A"
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
      avatarImage,
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
</style>
