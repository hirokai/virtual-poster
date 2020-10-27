<template>
  <div id="minimap-container">
    <canvas
      id="minimap-canvas"
      :style="{
        opacity: hidden ? 0 : 1,
      }"
    >
    </canvas>
    <svg
      id="minimap"
      @dblclick="dblClick"
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
      }"
    >
      <g>
        <g
          v-for="person in people"
          :key="person.id"
          :transform="
            'translate (' + person.x * size + ' ' + person.y * size + ')'
          "
        >
          <image
            v-if="size >= 5"
            :xlink:href="
              avatarImages[
                person.avatar.split(':')[0] +
                  '-' +
                  (person.direction == 'none' ? 'down' : person.direction)
              ]
                ? 'data:image/png;base64,' +
                  avatarImages[
                    person.avatar.split(':')[0] +
                      '-' +
                      (person.direction == 'none' ? 'down' : person.direction)
                  ]
                : '/img/avatar/' +
                  person.avatar.split(':')[0] +
                  '-' +
                  person.direction +
                  '.png'
            "
            :style="{ opacity: person.connected ? 1 : 0.5 }"
            :width="'' + size + 'px'"
            :height="'' + size + 'px'"
          />
          <rect
            v-else
            :width="'' + size + 'px'"
            :height="'' + size + 'px'"
            :fill="person.connected ? 'red' : 'gray'"
            opacity="0.7"
            stroke="none"
          />
          <rect
            v-if="size >= 5 && people_typing[person.id]"
            class="typing-indicator"
            :width="'' + size + 'px'"
            :height="'' + size + 'px'"
            opacity="0.4"
          />
        </g>
      </g>
    </svg>
    <div
      id="minimap-area"
      :style="{
        opacity: hidden ? 0 : 1,
        left:
          '' +
          ((isMobile ? 10 : 8) + (this.center.x - mapRadiusX) * size) +
          'px',
        top:
          '' +
          ((isMobile ? 0 : 612) + (this.center.y - mapRadiusY) * size) +
          'px',
        width: size * (mapRadiusX * 2 + 1) + 'px',
        height: size * (mapRadiusY * 2 + 1) + 'px',
      }"
    ></div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  PropType,
  reactive,
  toRefs,
  watch,
  onMounted,
  nextTick,
  onUpdated,
} from "vue"
import { Cell, Point, ChatGroup, Person, Direction } from "@/@types/types"

export default defineComponent({
  components: {
    // MiniMapCell,
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
    mapRadiusX: {
      type: Number,
      required: true,
    },
    mapRadiusY: {
      type: Number,
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
    const state = reactive({
      size:
        props.cells.length == 0
          ? 0
          : Math.floor(
              Math.max(
                1,
                Math.min(
                  528 / props.cells[0].length,
                  (window.innerHeight - 612 - 8) / props.cells.length
                )
              )
            ),
    })
    let rtime
    let timeout = false
    const delta = 200

    watch([props.cells], () => {
      state.size =
        props.cells.length == 0
          ? 0
          : Math.floor(
              Math.max(
                1,
                Math.min(
                  528 / props.cells[0].length,
                  (window.innerHeight - 612 - 8) / props.cells.length
                )
              )
            )
    })

    function resizeend() {
      if (Date.now() - rtime < delta) {
        setTimeout(resizeend, delta)
      } else {
        timeout = false
        state.size =
          props.cells.length == 0
            ? 1
            : Math.floor(
                Math.max(
                  1,
                  Math.min(
                    528 / props.cells[0].length,
                    (window.innerHeight - 612 - 8) / props.cells.length
                  )
                )
              )
      }
    }

    onUpdated(async () => {
      await nextTick(() => {
        resizeend()
      })
    })

    window.onresize = () => {
      rtime = Date.now()
      if (timeout === false) {
        timeout = true
        setTimeout(resizeend, delta)
      }
    }

    const select = (p: Point) => {
      context.emit("select", p)
    }

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
    const dblClick = (ev: MouseEvent) => {
      console.log(ev)
      const p: Point = {
        x: Math.floor(ev.offsetX / state.size),
        y: Math.floor(ev.offsetY / state.size),
      }
      context.emit("dbl-click", p)
      ev.stopPropagation()
    }
    const drawMap = async () => {
      const ti = performance.now()
      const canvas = document.getElementById(
        "minimap-canvas"
      ) as HTMLCanvasElement

      const s = state.size
      canvas.height = s * props.cells.length
      canvas.width = s * (props.cells[0] || []).length

      // const s = 3.5
      console.log("Minimap cell size", s, props.cells.length)
      // Draw a image.
      const loadImage = (url: string, size: number) => {
        const img = new Image()
        return new Promise<HTMLCanvasElement>(resolve => {
          img.onload = () => {
            const offscreenCanvas = document.createElement("canvas")
            // document.body.appendChild(offscreenCanvas)
            offscreenCanvas.width = Math.ceil(size)
            offscreenCanvas.height = Math.ceil(size)
            const ctx = offscreenCanvas.getContext("2d")!
            ctx.drawImage(img, 0, 0, size, size)
            resolve(offscreenCanvas)
          }
          img.src = url
        })
      }
      const ps = [
        "/img/map/kusa.png",
        "/img/map/yama.png",
        "/img/map/water.png",
        "/img/map/kusa_red.png",
        "/img/map/mud.png",
        "/img/map/post.png",
      ].map(u => loadImage(u, s))
      const imgs = await Promise.all(ps)

      console.log("Map size", props.cells[0]?.length, props.cells.length)
      const ctx = canvas.getContext("2d")!
      for (const y in props.cells) {
        for (const x in props.cells[y]) {
          // console.log(+x, +y)
          const sx = s
          const sy = s
          if (props.cells[y][x].kind == "grass") {
            ctx.drawImage(imgs[0], +x * sx, +y * sy) // Draw the image at (20, 10).
          } else if (props.cells[y][x].kind == "wall") {
            ctx.drawImage(imgs[0], +x * sx, +y * sy) // Draw the image at (20, 10).
            ctx.drawImage(imgs[1], +x * sx, +y * sy) // Draw the image at (20, 10).
          } else if (props.cells[y][x].kind == "water") {
            ctx.drawImage(imgs[2], +x * sx, +y * sy) // Draw the image at (20, 10).
          } else if (props.cells[y][x].kind == "poster_seat") {
            ctx.drawImage(imgs[3], +x * sx, +y * sy) // Draw the image at (20, 10).
          } else if (props.cells[y][x].kind == "mud") {
            ctx.drawImage(imgs[4], +x * sx, +y * sy) // Draw the image at (20, 10).
          } else if (props.cells[y][x].kind == "poster") {
            ctx.drawImage(imgs[0], +x * sx, +y * sy) // Draw the image at (20, 10).
            ctx.drawImage(imgs[5], +x * sx, +y * sy) // Draw the image at (20, 10).
          }
        }
      }
      const tf = performance.now()
      console.log(
        "%c" + "Drawing done " + (tf - ti).toFixed(2) + "ms",
        "color: green"
      )
    }

    watch(
      () => [state.size, props.cells],
      async (newValues, oldValues) => {
        if (state.size > 0) {
          console.log("watch", state.size, props.cells)
          await drawMap()
        }
      }
    )
    onMounted(async () => {
      // await drawMap()
    })

    return {
      ...toRefs(state),
      dblClick,
      moveTo,
      select,
      personImgOffset,
      personImgClipPath,
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

.mobile svg#minimap {
  top: 0px;
  left: 8px;
}

#minimap-area {
  transition: opacity 0.3s linear;
}

canvas#minimap-canvas {
  position: absolute;
  top: 612px;
  left: 8px;
  transition: opacity 0.3s linear;
  /* border: 2px solid #ccc; */
}

.mobile canvas#minimap-canvas {
  /* max-height: calc(100vh - 100vw / 6); */
  /* max-width: calc(100vh); */

  top: 0px;
  left: 8px;
}
</style>
