<template>
  <div>
    <h1>メンバー</h1>
    <table>
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
              v-on:change="onFileChange('people.csv', $event)"
            />
            <input
              type="submit"
              value="アップロード"
              :disabled="!files['people.csv']"
              @click="submitClick('people.csv')"
            />
          </form>
        </td>
        <td>
          <button
            @click="downloadUrl('/admin/export/people.csv', 'people.csv')"
          >
            ダウンロード
          </button>
        </td>
      </tr>
    </table>

    <div>
      <h2>フィルタ</h2>
      <div>
        <span>表示数：</span><span>{{ peopleFiltered.length }}</span>
      </div>
      <div>
        <span>部屋</span>
        <ul class="filter-item">
          <li
            :class="{ selected: selected_rooms['::all'] }"
            @click="toggleRoom('::all')"
          >
            すべて
          </li>
          <li
            v-for="room in rooms"
            :key="room.id"
            :class="{ selected: selected_rooms[room.id] }"
            @click="toggleRoom(room.id)"
          >
            {{ room.name }}
          </li>
        </ul>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th></th>
          <th>ユーザーID</th>
          <th>名前</th>
          <th>Email</th>
          <th>部屋</th>
          <th>接続中</th>
          <th>公開鍵</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="person in peopleFiltered"
          :key="person.id"
          :class="{ connected: person.connected }"
        >
          <td class="r0 show-on-hover">
            <span
              v-if="!editing.person"
              class="show-on-hover-child edit-btn"
              @click="editPerson(person.id)"
              >{{ "Edit" }}</span
            >
            <span
              v-if="editing.person && editing.person.id == person.id"
              class="edit-btn"
              @click="finishEditPerson(true)"
              >{{ "OK" }}
            </span>
            <span
              v-if="editing.person && editing.person.id == person.id"
              class="edit-btn"
              @click="finishEditPerson(false)"
              >{{ "キャンセル" }}
            </span>
          </td>
          <td class="r1">{{ person.id }}</td>
          <td class="r2">
            <div v-if="editing.person && editing.person.id == person.id">
              <input v-model="editing.person.name" />
            </div>
            <div v-else>
              {{ person.name }}
            </div>
          </td>
          <td class="r3">
            <div v-if="editing.person && editing.person.id == person.id">
              <input v-model="editing.person.email" />
            </div>
            <div v-else>
              {{ person.email }}
            </div>
          </td>
          <td>
            <span v-for="room in person.rooms" :key="room">
              <a
                :href="
                  '/room?room_id=' +
                    room +
                    '&debug_as=' +
                    person.id +
                    '&debug_token=' +
                    debug_token +
                    '&bot_mode=1'
                "
                >{{ room }}</a
              >
            </span>
          </td>
          <td class="r4">
            {{ person.connected ? "Yes" : "" }}
          </td>
          <td class="r5">
            {{ person.public_key }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { mapValues, intersection } from "@/common/util"

import { AxiosStatic } from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"

import { PersonWithEmailRooms, RoomId } from "@/@types/types"

import {
  defineComponent,
  reactive,
  PropType,
  SetupContext,
  toRefs,
  watch,
} from "vue"

export default defineComponent({
  props: {
    axios: {
      type: Function as PropType<AxiosStatic>,
      required: true,
    },
    people: {
      type: Object as PropType<{ [index: string]: PersonWithEmailRooms }>,
      required: true,
    },
    idToken: {
      type: String,
    },
    debug_token: {
      type: String,
      required: true,
    },
    rooms: {
      type: Object as PropType<{
        [room_id: string]: { id: string; name: string }
      }>,
    },
  },
  setup(props, context: SetupContext) {
    const state = reactive({
      files: {} as { [index: string]: File },
      editing: { person: null as PersonWithEmailRooms | null },
      selected_rooms: (props.rooms
        ? mapValues(props.rooms, () => true)
        : {}) as {
        [room_id: string]: boolean
      },
      peopleFiltered: Object.values(props.people),
    })
    const client = api(axiosClient(props.axios))
    const editPerson = (user_id: string) => {
      const p = props.people[user_id]
      state.editing.person = JSON.parse(JSON.stringify(p))
    }
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
          context.emit("loadData")
        }
        return false
      } catch (error) {
        alert("ファイルの送信に失敗しました")
        return false
      }
    }

    const finishEditPerson = async (ok: boolean) => {
      if (ok && state.editing.person) {
        const old_p = props.people[state.editing.person.id]
        const p = state.editing.person
        const obj: {
          name?: string
          email?: string
          x?: number
          y?: number
        } = {}
        if (p.name && old_p.name != p.name) {
          obj.name = p.name
        }
        if (p.email && old_p.email != p.email) {
          obj.email = p.email
        }
        console.log(old_p, p, " -> putting", obj)
        await client.people
          ._userId(state.editing.person.id)
          .$patch({ body: obj })
      }
      state.editing.person = null
    }

    const toggleRoom = (room_id: RoomId) => {
      if (state.selected_rooms[room_id]) {
        //Vue.delete
        delete state.selected_rooms[room_id]
      } else {
        //Vue.set
        state.selected_rooms[room_id] = true
      }
    }
    watch(
      () => {
        return [props.people, state.selected_rooms]
      },
      () => {
        state.peopleFiltered = state.selected_rooms["::all"]
          ? Object.values(props.people)
          : Object.values(props.people).filter(p => {
              return (
                intersection([
                  p.rooms,
                  Object.keys(state.selected_rooms).filter(k => {
                    return state.selected_rooms[k]
                  }),
                ]).length > 0
              )
            })
      }
    )

    return {
      ...toRefs(state),
      editPerson,
      finishEditPerson,
      onFileChange,
      submitClick,
      toggleRoom,
    }
  },
})
</script>

<style lang="css">
.connected {
  background: #eef;
}
.filter-item li {
  cursor: pointer;
  display: inline-block;
  margin-right: 10px;
  background: #777;
  padding: 5px;
  border-radius: 4px;
}
.filter-item li.selected {
  display: inline-block;
  margin-right: 10px;
  background: #f88;
  padding: 5px;
  border-radius: 4px;
}
</style>
