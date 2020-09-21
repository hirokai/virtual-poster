<template>
  <div>
    <h1>データのダウンロード・アップロード</h1>
    <p>アップロードするとデータを全て置き換えます</p>
    <div>
      <table>
        <tr>
          <td>マップ</td>

          <td>二次元のキャラクタ表記のテキストファイル</td>
          <td>
            <form class="file_upload">
              <input
                accept="text/plain"
                type="file"
                id="file"
                v-on:change="onFileChange('map.text', $event)"
              />
              <input
                type="submit"
                value="アップロード"
                :disabled="!files['map.text']"
                @click="submitClick('map.text')"
              />
            </form>
          </td>
          <td>
            <button @click="downloadUrl('/admin/export/map.text', 'map.txt')">
              ダウンロード
            </button>
          </td>
        </tr>
        <tr>
          <td>メンバー</td>

          <td>
            CSV
          </td>
          <td>
            <form class="file_upload">
              <input
                type="file"
                accept="text/csv"
                id="file"
                v-on:change="onFileChange('people', $event)"
              />
              <input
                type="submit"
                value="アップロード"
                :disabled="!files['people']"
                @click="submitClick('people')"
              />
            </form>
          </td>
          <td>
            <button @click="downloadUrl('/admin/export/people', 'people.json')">
              ダウンロード
            </button>
          </td>
        </tr>

        <tr>
          <td rowspan="2">ポスター</td>
          <td>JSON</td>
          <td>
            <form class="file_upload">
              <input
                type="file"
                id="file"
                accept="application/json"
                v-on:change="onFileChange('posters', $event)"
              />
              <input
                type="submit"
                value="JSONをアップロード"
                :disabled="!files['posters']"
                @click="submitClick('posters')"
              />
            </form>
          </td>
          <td>
            <button
              @click="downloadUrl('/admin/export/posters', 'posters.json')"
            >
              ダウンロード
            </button>
          </td>
        </tr>
        <tr>
          <td>CSV</td>
          <td>
            <form class="file_upload">
              <input
                type="file"
                id="file"
                accept="text/csv"
                v-on:change="onFileChange('posters.csv', $event)"
              />
              <input
                type="submit"
                value="CSVをアップロード"
                :disabled="!files['posters.csv']"
                @click="submitClick('posters.csv')"
              />
              <button @click="downloadPosterListTemplate">
                雛形CSVをダウンロード
              </button>
              <div>カラム：名前，ユーザーID，タイトル。先頭行はカラム名。</div>
            </form>
          </td>
          <td></td>
        </tr>
        <tr>
          <td>コメント</td>
          <td>JSON</td>
          <td>
            <form class="file_upload">
              <input
                type="file"
                id="file"
                accept="application/json"
                v-on:change="onFileChange('comments', $event)"
              />
              <input
                type="submit"
                value="アップロード"
                :disabled="!files['comments']"
                @click="submitClick('comments')"
              />
            </form>
          </td>
          <td>
            <button
              @click="downloadUrl('/admin/export/comments', 'comments.json')"
            >
              ダウンロード
            </button>
          </td>
        </tr>
        <tr>
          <td>チャットグループ</td>
          <td>JSON</td>
          <td>
            <form class="file_upload">
              <input
                type="file"
                id="file"
                accept="application/json"
                v-on:change="onFileChange('groups', $event)"
              />
              <input
                type="submit"
                :disabled="!files['groups']"
                value="アップロード"
                @click="submitClick('groups')"
              />
            </form>
          </td>
          <td>
            <button @click="downloadUrl('/admin/export/groups', 'groups.json')">
              ダウンロード
            </button>
          </td>
        </tr>
      </table>
    </div>

    <div>
      <h2></h2>
    </div>
    <div>
      <h2></h2>
    </div>
  </div>
</template>

<script lang="ts">
import { AxiosStatic } from "axios"
import { Person } from "@/@types/types"
const API_ROOT = "/api"

import { defineComponent, reactive, toRefs, PropType } from "vue"
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
    const state = reactive<{
      API_ROOT: string
      files: { [index: string]: File }
    }>({
      API_ROOT,
      files: {},
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
          alert("登録完了")
        }
        return false
      } catch (error) {
        alert("ファイルの送信に失敗しました")
        return false
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
    const downloadPosterListTemplate = async () => {
      const people: Person[] = (await props.axios.get("/people/")).data
      const text =
        "User ID,名前,タイトル\n" +
        people.map(p => p.id + "," + p.name + ",").join("\n")
      const filename = "template_poster_list.csv"
      downloadFile(filename, text)
    }
    const downloadUrl = async (url: string, filename: string) => {
      const data = (await props.axios.get(url)).data
      const text =
        typeof data == "string" ? data : JSON.stringify(data, null, 2)
      downloadFile(filename, text)
      return false
    }

    return {
      ...toRefs(state),
      downloadPosterListTemplate,
      downloadUrl,
      downloadFile,
      onFileChange,
      submitClick,
    }
  },
})
</script>

<style lang="css">
td:nth-child(1) {
  font-weight: bold;
  width: 150px;
}
td:nth-child(2) {
  width: 200px;
}
</style>
