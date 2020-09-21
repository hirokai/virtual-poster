<template>
  <div>
    <h1>部屋</h1>
    <div>
      <table>
        <tr>
          <td>マップ</td>

          <td>二次元のキャラクタ表記を含むYAML形式</td>
          <td>
            <form class="file_upload">
              <input
                accept="application/yaml"
                type="file"
                id="file"
                v-on:change="onFileChange('map.yaml', $event)"
              />
              <input
                type="submit"
                value="アップロード"
                :disabled="!files['map.yaml']"
                @click="submitClick('map.yaml')"
              />
            </form>
          </td>
          <td>
            <button @click="downloadUrl('/admin/export/map.text', 'map.txt')">
              ダウンロード
            </button>
          </td>
        </tr>
      </table>

      <div>
        <h1>部屋一覧</h1>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>セル数</th>
              <th>ポスター</th>
              <th>削除</th>
            </tr>
          </thead>
          <tr v-for="room in rooms" :key="room.id">
            <td>{{ room.id }}</td>
            <td>
              <a :href="'/room?room_id=' + room.id">{{ room.name }}</a>
            </td>
            <td>
              {{ room.numCols * room.numRows }}（縦{{ room.numCols }} x 横{{
                room.numRows
              }}）
            </td>
            <td>{{ room.poster_count }} / {{ room.poster_location_count }}</td>
            <td><button @click="deleteRoom(room.id)">削除</button></td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { RoomId, Room } from "@/@types/types"
import { AxiosStatic } from "axios"
import { keyBy } from "../../common/util"
const API_ROOT = "/api"

import { defineComponent, reactive, onMounted, toRefs, PropType } from "vue"

export default defineComponent({
  props: {
    axios: {
      type: Function as PropType<AxiosStatic>,
      required: true,
    },
    idToken: {
      type: String,
    },
  },
  setup(props) {
    console.log(props)
    const state = reactive<{
      rooms: { [room_id: string]: Room }
      API_ROOT: string
      files: { [index: string]: File }
    }>({ rooms: {}, API_ROOT, files: {} })

    onMounted(() => {
      props.axios
        .get("/maps")
        .then(({ data }) => {
          state.rooms = keyBy(data, "id")
        })
        .catch(err => {
          console.error(err)
        })
    })
    const onFileChange = (name: string, e) => {
      //Vue.set
      state.files[name] = (e.target.files || e.dataTransfer.files)[0]
    }
    const submitClick = async (name: string) => {
      console.log("submitClick", state.files[name])
      try {
        const formData = new FormData()
        formData.append("file", state.files[name])
        const config = {
          headers: {
            "content-type": "multipart/form-data",
          },
        }
        const res = await props.axios.post(
          "/admin/import/" + name,
          formData,
          config
        )
        console.log(res.data)
        if (!res.data.ok) {
          alert("エラー。" + (res.data.error || ""))
        } else {
          try {
            const { data } = await props.axios.get("/maps")
            state.rooms = keyBy(data, "id")
            alert("登録完了")
          } catch (err) {
            console.log(err)
          }
        }
        return true
      } catch (error) {
        alert("ファイルの送信に失敗しました")
        return true
      }
    }

    const downloadFile = (filename: string, text: string): void => {
      const element = document.createElement("a")
      element.setAttribute(
        "href",
        "data:text/csv;charset=utf-8," + encodeURIComponent(text)
      )
      element.setAttribute("download", filename)

      element.style.display = "none"
      document.body.appendChild(element)

      element.click()

      document.body.removeChild(element)
    }

    const downloadUrl = async (url: string, filename: string) => {
      const data = (await props.axios.get(url)).data
      const text =
        typeof data == "string" ? data : JSON.stringify(data, null, 2)
      downloadFile(filename, text)
      return false
    }

    const deleteRoom = async (room_id: RoomId) => {
      try {
        const s = prompt(
          "本当に削除しますか？ 削除すると部屋と関連するポスター，コメントがすべて消去されます。削除する場合は部屋のIDを下記に入力してください。"
        )
        if (s != room_id) {
          return
        }
        const res = await props.axios.delete("/maps/" + room_id)
        console.log(res.data)
        if (res.data.ok) {
          //Vue.delete
          delete state.rooms[room_id]
        } else {
          alert("部屋の削除に失敗しました")
        }
      } catch (err) {
        alert("部屋の削除に失敗しました")
      }
    }
    return {
      ...toRefs(state),
      deleteRoom,
      onFileChange,
      downloadUrl,
      downloadFile,
      submitClick,
    }
  },
})
</script>

<style lang="css" scoped>
td:nth-child(1) {
  font-weight: bold;
  width: 150px;
}
td:nth-child(2) {
  width: 200px;
}
</style>
