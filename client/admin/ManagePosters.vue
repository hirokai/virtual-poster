<template>
  <div>
    <h1>ポスター</h1>
    <div class="room-posters" v-for="room in rooms" :key="room.id">
      <h3>{{ room.name }}</h3>
      <div>{{ room.poster_location_count }} スロット</div>
      <div>
        <form class="file_upload">
          <input
            accept="text/plain"
            type="file"
            id="file"
            v-on:change="onFileChange(room.id, $event)"
          />
          <input
            type="submit"
            value="アップロード"
            :disabled="!files[room.id]"
            @click="submitClick(room.id)"
          />
        </form>
      </div>
      <div v-if="postersSorted[room.id].length == 0">
        ポスターなし
      </div>
      <div
        class="poster"
        v-for="poster in postersSorted[room.id]"
        :key="poster.id"
        @dragover.prevent
        @drop.prevent="onDropPoster($event, poster.id)"
      >
        <div class="poster_info" v-if="!!people[poster.author]">
          <h2 class="poster_author">
            {{ poster.poster_number }} ({{ poster.x }},{{ poster.y }}):
            {{ people[poster.author].name }}
          </h2>
          <div class="poster_title">{{ poster.title }}</div>
        </div>
        <img :src="'data:image/png;base64,' + (dataURI[poster.id] || '')" />
      </div>
      <div style="clear:both"></div>
    </div>
  </div>
</template>

<script lang="ts">
import { Room, Poster, PosterId, PersonWithEmail } from "@/@types/types"
import { AxiosStatic } from "axios"
import { sortBy } from "../../common/util"

import Vue from "vue"
import {
  defineComponent,
  reactive,
  computed,
  watch,
  set,
  toRefs,
  PropType,
} from "@vue/composition-api"
import VueCompositionApi from "@vue/composition-api"
Vue.use(VueCompositionApi)

export default defineComponent({
  props: {
    axios: {
      type: Function as PropType<AxiosStatic>,
      required: true,
    },
    idToken: {
      type: String,
    },
    jwt_hash: {
      required: true,
      type: String,
    },
    posters: {
      type: Object as PropType<{ [poster_id: string]: Poster }>,
      required: true,
    },
    rooms: {
      type: Object as PropType<{
        [room_id: string]: Room
      }>,
      required: true,
    },
    people: {
      type: Object as PropType<{ [index: string]: PersonWithEmail }>,
      required: true,
    },
  },
  setup(props) {
    const state = reactive({
      files: {} as { [index: string]: File },
      dataURI: {} as { [poster_id: string]: string },
      lastLoaded: -1,
    })
    const onFileChange = (name: string, e) => {
      set(state.files, name, (e.target.files || e.dataTransfer.files)[0])
    }
    const submitClick = async (room_id: string) => {
      console.log("submitClick", state.files[room_id])
      try {
        const formData = new FormData()
        formData.append("file", state.files[room_id])
        const config = {
          headers: {
            "content-type": "multipart/form-data",
          },
        }
        const res = await props.axios.post(
          "/admin/import/maps/" + room_id + "/poster_locations",
          formData,
          config
        )
        console.log(res.data)
        if (!res.data.ok || !res.data.poster_assigned) {
          alert("エラー。" + (res.data.error || ""))
        } else if (res.data.poster_assigned.length == 0) {
          alert(
            "登録が0件。おそらくエラー（すでに記載の番号のポスターが指定済みなど）"
          )
        } else {
          alert("" + res.data.poster_assigned.length + "件登録完了")
        }
        return false
      } catch (error) {
        alert("ファイルの送信に失敗しました")
        return false
      }
    }

    watch(
      () => props.posters,
      () => {
        //deep
        for (const poster of Object.values(props.posters)) {
          console.log("get poster ", poster.id)
          if (state.lastLoaded > poster.last_updated) {
            continue
          }
          props
            .axios({
              method: "GET",
              responseType: "arraybuffer",
              url: "/posters/" + poster.id + "/file",
            })
            .then(({ data }) => {
              const image = btoa(
                new Uint8Array(data).reduce(
                  (d, byte) => d + String.fromCharCode(byte),
                  ""
                )
              )
              set(state.dataURI, poster.id, image)
            })
            .catch(() => {
              //
            })
        }
        state.lastLoaded = Date.now()
      }
    )
    const postersSorted = computed((): { [room_id: string]: Poster[] } => {
      const res: { [room_id: string]: Poster[] } = {}
      for (const r of Object.keys(props.rooms)) {
        res[r] = sortBy(
          Object.values(props.posters).filter(p => p.author && p.room == r),
          p => p.poster_number
        )
      }
      return res
    })

    const onDropPoster = (event: any, poster_id: PosterId) => {
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
        alert("ファイルはPNGかPDFのみです")
      } else if (file.size >= 10e6) {
        alert("ファイルが>10 MBです")
      } else {
        const fd = new FormData() //★②
        fd.append("file", file)
        console.log("onDropPoster", fd)

        props.axios
          .post("/posters/" + poster_id + "/file", fd, {
            headers: { "content-type": "multipart/form-data" },
          })
          .then(({ data }) => {
            console.log(data)
            if (data.ok) {
              set(props.posters, data.poster.id, data.poster)
            }
          })
          .catch(err => {
            console.error(err)
          })
      }
    }

    return {
      ...toRefs(state),
      onFileChange,
      onDropPoster,
      postersSorted,
      submitClick,
    }
  },
})
</script>
