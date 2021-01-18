<template>
  <div id="minimap-container">
    <canvas
      id="minimap-canvas"
      :style="{
        opacity: hidden ? 0 : 1,
      }"
      :class="{ monochrome: monochromeStyle }"
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
      :class="{ monochrome: monochromeStyle }"
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
            v-if="size >= 5 && pictureStyle"
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
          <circle
            v-if="size >= 5 && abstractStyle"
            :style="{ opacity: person.connected ? 1 : 0.5 }"
            :fill="abstractColorOfAvatar(person.avatar)"
            :cx="size / 2"
            :cy="size / 2"
            :r="'' + size / 2 + 'px'"
            :stroke="monochromeStyle ? 'black' : ''"
            :stroke-width="monochromeStyle ? '1px' : ''"
            :stroke-dasharray="
              monochromeStyle ? (person.connected ? '' : '2') : ''
            "
          />
          <path
            v-if="size >= 5 && abstractStyle && person.direction != 'none'"
            :style="{ opacity: 0.3 }"
            :d="
              'M0,0 L0,-' +
              size / 2 +
              ' A' +
              size / 2 +
              ',' +
              size / 2 +
              ' 0 0,1 0,' +
              size / 2 +
              'z'
            "
            fill="#000"
            class="person-abstract-front"
            :transform="
              'translate(' +
              size / 2 +
              ', ' +
              size / 2 +
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
            v-if="size < 5"
            :width="'' + size + 'px'"
            :height="'' + size + 'px'"
            :fill="person.connected ? 'red' : 'gray'"
            opacity="0.7"
            stroke="none"
          />
          <rect
            v-if="person.poster_viewing"
            fill="#994c15"
            :width="'' + size + 'px'"
            :height="'' + size + 'px'"
            opacity="0.5"
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
      <g id="minimap-area">
        <rect
          fill="none"
          :style="{
            stroke: 'blue',
            'stroke-width': 1.5,
            'stroke-opacity': hidden ? 0 : 1,
            x: '' + ((this.center.x - mapRadiusX) * size + 1) + 'px',
            y: '' + ((this.center.y - mapRadiusY) * size + 1) + 'px',
            width: size * (mapRadiusX * 2 + 1) - 2 + 'px',
            height: size * (mapRadiusY * 2 + 1) - 2 + 'px',
          }"
        ></rect>
      </g>
    </svg>
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
  computed,
} from "vue"
import {
  Cell,
  Point,
  ChatGroup,
  Person,
  Direction,
  VisualStyle,
} from "@/@types/types"
import { abstractColorOfAvatar } from "./util"
import { Poster } from "@/api/@types"
import { compact, flatten, keyBy } from "@/common/util"

export default defineComponent({
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
    posters: {
      type: Object as PropType<{ [index: string]: Poster }>,
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
    visualStyle: {
      type: String as PropType<VisualStyle>,
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

    const abstractStyle = computed(() => {
      return (
        props.visualStyle == "abstract" ||
        props.visualStyle == "abstract_monochrome"
      )
    })

    const pictureStyle = computed(() => {
      return props.visualStyle == "monochrome" || props.visualStyle == "default"
    })

    const posterByCellId = computed((): { [index: string]: Poster } => {
      return keyBy(Object.values(props.posters || {}), "location")
    })

    const imgs: { [image_name: string]: HTMLCanvasElement } = {}

    const loadImage = (
      url: string,
      size: number
    ): Promise<HTMLCanvasElement | undefined> => {
      const img = new Image()
      return new Promise<HTMLCanvasElement | undefined>(resolve => {
        img.onload = () => {
          const offscreenCanvas = document.createElement("canvas")
          // document.body.appendChild(offscreenCanvas)
          offscreenCanvas.width = Math.ceil(size)
          offscreenCanvas.height = Math.ceil(size)
          const ctx = offscreenCanvas.getContext("2d")!
          ctx.drawImage(img, 0, 0, size, size)
          resolve(offscreenCanvas)
        }
        img.onerror = () => {
          resolve(undefined)
        }
        img.src = url
      })
    }

    const drawMap = async () => {
      console.log("drawMap()", imgs)
      const ti = performance.now()
      const canvas = document.getElementById(
        "minimap-canvas"
      ) as HTMLCanvasElement

      const s = state.size
      canvas.height = s * props.cells.length
      canvas.width = s * (props.cells[0] || []).length

      // const s = 3.5
      // console.log("Minimap cell size", s, props.cells.length)
      if (pictureStyle.value) {
        // Draw a image.

        // console.log("Map size", props.cells[0]?.length, props.cells.length)
        const ctx = canvas.getContext("2d")!
        ctx.font = "bold " + s * 0.7 + "px 'sans-serif'"
        ctx.textAlign = "center"
        for (const y in props.cells) {
          for (const x in props.cells[y]) {
            // console.log(+x, +y)
            const sx = s
            const sy = s
            const c = props.cells[y][x]
            if (c.kind == "grass") {
              const img_bg = imgs["kusa.png"]
              if (img_bg) {
                ctx.drawImage(img_bg, +x * sx, +y * sy)
              }
              const img = c.custom_image ? imgs[c.custom_image] : undefined
              if (img) {
                ctx.drawImage(img, +x * sx, +y * sy)
              }
            } else if (c.kind == "wall") {
              ctx.drawImage(imgs["kusa.png"], +x * sx, +y * sy)
              const img = imgs[c.custom_image || "yama.png"]
              if (img) {
                ctx.drawImage(img, +x * sx, +y * sy)
              }
            } else if (c.kind == "water") {
              const img_bg = imgs["water.png"]
              if (img_bg) {
                ctx.drawImage(img_bg, +x * sx, +y * sy)
              }
              const img = c.custom_image ? imgs[c.custom_image] : undefined
              if (img) {
                ctx.drawImage(img, +x * sx, +y * sy)
              }
            } else if (c.kind == "poster_seat") {
              const img_bg = imgs["kusa_red.png"]
              if (img_bg) {
                ctx.drawImage(img_bg, +x * sx, +y * sy)
              }
              const img = c.custom_image ? imgs[c.custom_image] : undefined
              if (img) {
                ctx.drawImage(img, +x * sx, +y * sy)
              }
            } else if (c.kind == "mud") {
              const img_bg = imgs["mud.png"]
              if (img_bg) {
                ctx.drawImage(img_bg, +x * sx, +y * sy)
              }
              const img = c.custom_image ? imgs[c.custom_image] : undefined
              if (img) {
                ctx.drawImage(img, +x * sx, +y * sy)
              }
            } else if (c.kind == "poster") {
              ctx.drawImage(imgs["kusa.png"], +x * sx, +y * sy)
              const poster = posterByCellId.value[c.id]
              const img = imgs[c.custom_image || "post.png"]
              if (poster) {
                if (img) {
                  ctx.globalAlpha = 0.5
                  ctx.drawImage(img, +x * sx, +y * sy)
                  ctx.globalAlpha = 1
                }
                ctx.fillText(
                  "" + c.poster_number,
                  +x * sx + sx / 2,
                  +y * sy + 5 + sy / 2
                )
              } else {
                if (img) {
                  ctx.drawImage(img, +x * sx, +y * sy)
                }
              }
            }
          }
        }
      } else {
        const ctx = canvas.getContext("2d")!
        ctx.font = "bold " + s * 0.7 + "px 'sans-serif'"
        ctx.textAlign = "center"
        const colors = {
          grass: "#8DAC4B",
          wall: "#959174",
          water: "#6D8793",
          mud: "#8D894E",
          poster_seat: "#A8A735",
          poster: "#7E7353",
        }
        for (const y in props.cells) {
          for (const x in props.cells[y]) {
            const c = props.cells[y][x]
            // console.log(+x, +y)
            const sx = s
            const sy = s
            ctx.fillStyle = colors[c.kind] || "rgba(0,0,0,0)"
            ctx.fillRect(+x * sx, +y * sy, s, s)
            if (c.kind == "poster") {
              const poster = posterByCellId.value[c.id]
              console.log(
                poster ? "poster" : "No poster",
                poster,
                posterByCellId.value
              )
              if (poster) {
                ctx.fillStyle = "rgba(0,0,0)"
                console.log(
                  "fillText",
                  "" + c.poster_number,
                  +x * sx + sx / 2,
                  +y * sy + 5 + sy / 2
                )
                ctx.fillText(
                  "" + c.poster_number,
                  +x * sx + sx / 2,
                  +y * sy + 5 + sy / 2
                )
              }
            }
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
      () => [state.size, props.cells, props.visualStyle, props.posters],
      async (newValues, oldValues) => {
        if (state.size > 0) {
          if (oldValues[0] != newValues[0]) {
            const image_names = [
              "kusa.png",
              "yama.png",
              "water.png",
              "mud.png",
              "kusa_red.png",
              "post.png",
            ].concat(
              compact(
                flatten(props.cells).map(c => {
                  return c.custom_image
                })
              )
            )
            console.log("Loading images", state.size, image_names)

            const ps = image_names
              .map(n => {
                return "/img/map/" + n
              })
              .map(u => loadImage(u, newValues[0] as number))
            const imgs_list = await Promise.all(ps)
            for (let i = 0; i < image_names.length; i++) {
              const img = imgs_list[i]
              if (img) {
                imgs[image_names[i]] = img
              }
            }
          }
          await requestAnimationFrame(drawMap)
        }
      },
      { deep: true }
    )
    // onMounted(async () => {
    //   await drawMap()
    // })

    const monochromeStyle = computed(() => {
      return (
        props.visualStyle == "monochrome" ||
        props.visualStyle == "abstract_monochrome"
      )
    })

    return {
      ...toRefs(state),
      dblClick,
      moveTo,
      select,
      personImgOffset,
      personImgClipPath,
      abstractStyle,
      pictureStyle,
      abstractColorOfAvatar,
      monochromeStyle,
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

.dark svg#minimap:not(.monochrome) {
  filter: brightness(0.6) contrast(1.2);
}

svg#minimap.monochrome {
  filter: saturate(0);
}

.dark svg#minimap.monochrome {
  filter: saturate(0) brightness(0.6) contrast(1.2);
}

.mobile svg#minimap {
  top: 0px;
  left: 8px;
}

#minimap-area {
  transition: opacity 0.3s linear;
  position: absolute;
  border: blue 1px solid;
  position: absolute;
}

canvas#minimap-canvas {
  position: absolute;
  top: 612px;
  left: 8px;
  transition: opacity 0.3s linear;
  /* border: 2px solid #ccc; */
}

canvas#minimap-canvas.monochrome {
  filter: saturate(0);
}

.dark canvas#minimap-canvas.monochrome {
  filter: saturate(0) brightness(0.6) contrast(1.2);
}

.dark canvas#minimap-canvas {
  filter: brightness(0.6) contrast(1.2);
}

.mobile canvas#minimap-canvas {
  /* max-height: calc(100vh - 100vw / 6); */
  /* max-width: calc(100vh); */

  top: 0px;
  left: 8px;
}
</style>
