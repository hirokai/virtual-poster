<template>
  <div id="app" v-cloak>
    <div>
      <button @click="startRandomMoveForAll('step')">
        ステップ：全員
      </button>
      <button @click="startRandomMoveForAll('batch')">
        バッチ：全員
      </button>
      <button
        :disabled="!started.randomOneStepMove && !started.randomBatchMove"
        @click="stopAll"
      >
        停止
      </button>
    </div>
    <div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>名前</th>
            <th>X</th>
            <th>Y</th>
            <th>ステップ</th>
            <th>バッチ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in people" :key="p.id" :class="{ moving: p.moving }">
            <td>{{ p.id }}</td>
            <td>{{ p.name }}</td>
            <td>{{ p.x }}</td>
            <td>{{ p.y }}</td>
            <td>
              <div class="sample2Area makeImg">
                <input
                  type="checkbox"
                  :id="'sample2check-' + p.id"
                  :checked="started.randomOneStepMove.has(p.id)"
                  @change="checkUser(p.id, $event.target.checked, 'step')"
                />
                <label :for="'sample2check-' + p.id">
                  <div></div>
                </label>
              </div>
            </td>
            <td>
              <div class="sample2Area makeImg">
                <input
                  type="checkbox"
                  :id="'batch-sample2check-' + p.id"
                  :checked="started.randomBatchMove.has(p.id)"
                  @change="checkUser(p.id, $event.target.checked, 'batch')"
                />
                <label :for="'batch-sample2check-' + p.id">
                  <div></div>
                </label>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, onMounted } from "vue"
import {
  PersonInMap,
  Point,
  ChatComment,
  ArrowKey,
  Cell,
  UserId,
  RoomId,
  ChatGroup,
  Poster,
} from "../@types/types"

import { findRoute, decodeMoved } from "../common/util"

import axios from "axios"
import axiosClient from "@aspida/axios"
import api from "../api/$api"
const client = api(axiosClient(axios))

import { difference, keyBy, randomInt } from "../common/util"
import io from "socket.io-client"
import * as firebase from "firebase/app"
import "firebase/auth"
import jsSHA from "jssha"
import firebaseConfig from "../firebaseConfig"

const url = new URL(location.href)
const room_id: RoomId | undefined = url.searchParams.get("room_id") || undefined

const unionSet = function<T>(setA: Set<T>, setB: Set<T>) {
  const union = new Set(setA)
  for (const elem of setB) {
    union.add(elem)
  }
  return union
}

const diffSet = function<T>(setA: Set<T>, setB: Set<T>) {
  const diff = new Set(setA)
  for (const elem of setB) {
    diff.delete(elem)
  }
  return diff
}

export default defineComponent({
  setup: () => {
    const state = reactive({
      socketURL: null as string | null,
      socket: null as SocketIO.Socket | null,
      people: {} as { [index: string]: PersonInMap },
      idToken: null as string | null,
      jwt_hash: "",
      room_id: room_id,
      lastUpdated: null as number | null,
      user: null as firebase.User | null,
      hallMap: { cells: [] as Cell[][], numCols: 0, numRows: 0 },
      posters: {} as { [index: string]: Poster },
      connectedUsers: [] as string[],
      hidden: true,
      comments: {} as { [index: string]: ChatComment },
      chatGroups: {} as {
        [groupId: string]: ChatGroup
      },
      myUserId: null as string | null,
      started: { randomOneStepMove: new Set(), randomBatchMove: new Set() } as {
        randomOneStepMove: Set<UserId>
        randomBatchMove: Set<UserId>
      },
      announcement: null as {
        text: string
        marquee: boolean
        period: number
      } | null,
      keyQueue: null as { key: ArrowKey; timestamp: number } | null,
      timers: {} as { [key: string]: NodeJS.Timeout },
      points: {} as { [index: string]: Point[] | null },
      point_idx: {} as { [index: string]: number },
      axios: axios,
    })

    const on_socket_move = (s: string): void => {
      // console.log("socket moved", s)
      const pos = decodeMoved(s, state.room_id)
      if (
        !pos ||
        !state.people ||
        !state.hallMap ||
        pos.y >= state.hallMap.cells.length ||
        pos.x >= state.hallMap.cells[0].length
      ) {
        return
      }

      const p = state.people[pos.user]
      if (p) {
        //Vue.set
        state.people[p.id] = {
          ...p,
          x: pos.x,
          y: pos.y,
          direction: pos.direction,
        }
      }
    }

    const reload = (): void => {
      state.lastUpdated = Date.now()
      if (!state.room_id) {
        alert("部屋IDが指定されていません")
        return
      }
      ;(async () => {
        const [data_p, data_g, data_m, data_posters] = await Promise.all([
          client.maps._roomId(state.room_id!).people.$get(),
          client.groups.$get(),
          client.maps._roomId(state.room_id!).$get(),
          client.posters.$get(),
        ])
        state.people = keyBy(data_p, "id")
        state.chatGroups = keyBy(data_g, "id")
        state.hallMap = data_m
        state.posters = keyBy(data_posters, "id")
      })().catch(err => {
        console.error(err)
      })
    }

    onMounted(() => {
      firebase.initializeApp(firebaseConfig)

      // console.log("User", firebase.auth().currentUser)

      firebase.auth().onAuthStateChanged(user => {
        ;(async () => {
          console.log("onAuthStateChanged", user)
          state.user = user
          if (!user) {
            location.href = "/"
          } else {
            const idToken = await user.getIdToken()
            state.idToken = idToken
            const shaObj = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" })
            shaObj.update(idToken)
            state.jwt_hash = shaObj.getHash("HEX")
            axios.defaults.headers.common = {
              Authorization: `Bearer ${idToken}`,
            }

            state.socketURL =
              (await client.socket_url.$get()).socket_url || null

            state.socket = io(state.socketURL, {
              path: "/socket.io",
              transports: ["websocket"],
            })
            if (!state.socket) {
              console.error("Socket IO init error")
              return
            }
            state.socket.on("person", (d: PersonInMap) => {
              console.log("socket person", d)
              //Vue.set
              state.people[d.id] = d
            })
            state.socket.on("moved", (s: string) => {
              on_socket_move(s)
            })
            state.socket.on("moved_multi", (s: string) => {
              const ss = s.split(";")
              for (const s of ss) {
                on_socket_move(s)
              }
            })

            const data = await client.id_token.$post({
              body: {
                token: idToken,
                debug_from: "LoadTesting",
              },
            })
            console.log(data)
            if (!data.ok) {
              location.reload()
            }
            if (!data.admin) {
              location.href = "/"
            }
            state.myUserId = data.user_id || null
            reload()
          }
        })().catch(err => {
          console.error(err)
        })
      })
    })

    const startRandomMove = (uids: UserId[], kind: "batch" | "step"): void => {
      console.log("startRandomMove", uids)
      if (kind == "batch") {
        state.started.randomBatchMove = unionSet(
          state.started.randomBatchMove,
          new Set(uids)
        )
        state.started.randomOneStepMove = diffSet(
          state.started.randomOneStepMove,
          new Set(uids)
        )
      } else {
        state.started.randomOneStepMove = unionSet(
          state.started.randomOneStepMove,
          new Set(uids)
        )
        state.started.randomBatchMove = diffSet(
          state.started.randomBatchMove,
          new Set(uids)
        )
      }

      const canMoveTo = (p: Point): boolean => {
        if (
          p.x < 0 ||
          p.y < 0 ||
          p.x >= state.hallMap.numCols ||
          p.y >= state.hallMap.numRows
        ) {
          return false
        }

        return true
      }

      const moveTo = (user_id: UserId, to: Point): void => {
        console.log("moveTo", user_id, to)
        const person = state.people[user_id]
        const from = { x: person.x, y: person.y }
        if (!to) {
          console.error("moveTo point missing")
          return
        }
        if (to.x < 0 || to.y < 0) {
          console.error("moveTo: ", to, "out of range")
          return
        }
        delete state.timers[user_id]
        if (Math.abs(from.x - to.x) <= 1 && Math.abs(from.y - to.y) <= 1) {
          state.socket!.emit("move", {
            ...to,
            user: person.id,
            token: state.jwt_hash,
          })
          //Vue.set
          state.people[user_id].moving = false
        } else {
          const ti = Date.now()
          state.points[user_id] = findRoute(
            user_id,
            state.hallMap.cells,
            Object.values(state.people),
            from,
            to
          )
          const tf = Date.now()
          if (!state.points[user_id]) {
            console.info("No route was found.")
            return
          }
          console.log(
            `Finding route of ${state.points[user_id]?.length} points, in ${tf -
              ti} ms (${user_id})`
          )
          console.debug("# of points on route", state.points[user_id]?.length)
          // const group = await model.chat.getGroupOfUser(user_id)
          // if (group) {
          //   await model.chat.leaveChat(user_id)
          // }
          state.point_idx[user_id] = 0
          //Vue.set
          state.people[user_id].moving = true
          if (state.timers[user_id]) {
            clearInterval(state.timers[user_id])
            console.log("Timer ID deleted: ", state.timers[user_id])
            delete state.timers[user_id]
          }
          state.timers[user_id] = setInterval(() => {
            state.point_idx[user_id] += 1
            const to_step = (state.points[user_id] || {})[
              state.point_idx[user_id]
            ]
            console.log(state.point_idx[user_id], state.points[user_id]?.length)
            if (
              state.point_idx[user_id] >= (state.points[user_id]?.length || 0)
            ) {
              console.log("Batch move done.")
              //Vue.set
              state.people[user_id].moving = false
              clearInterval(state.timers[user_id])
              console.log("Timer ID deleted: ", state.timers[user_id])
              return
            }
            if (!to_step) {
              console.error(
                "moveTo(): point missing, aborting",
                state.point_idx[user_id]
              )
              //Vue.set
              state.people[user_id].moving = false
              state.points[user_id] = null
              clearInterval(state.timers[user_id])
              console.log("Timer ID deleted: ", state.timers[user_id])
              delete state.timers[user_id]
              return
            }
            state.socket!.emit("move", {
              ...to_step,
              user: user_id,
              token: state.jwt_hash,
            })
          }, 500)
          console.log("Timer ID created: ", state.timers[user_id])
        }
      }

      const moveRandom = (user_id: UserId, kind: "batch" | "step"): boolean => {
        if (kind == "batch" && !state.started.randomBatchMove.has(user_id)) {
          return false
        }
        if (kind == "step" && !state.started.randomOneStepMove.has(user_id)) {
          return false
        }
        const p = state.people[user_id]
        let nx = -1
        let ny = -1
        let count = 0
        if (kind == "batch") {
          while (!canMoveTo({ x: nx, y: ny })) {
            nx = randomInt(0, state.hallMap.numCols)
            ny = randomInt(0, state.hallMap.numRows)
            count += 1
            if (count >= 100) {
              throw "Move failed 100 times."
            }
          }
        } else {
          while (!canMoveTo({ x: nx, y: ny })) {
            nx = p.x + randomInt(-1, 1)
            ny = p.y + randomInt(-1, 1)
            count += 1
            if (count >= 100) {
              throw "Move failed 100 times."
            }
          }
        }
        moveTo(user_id, { x: nx, y: ny })
        return true
      }

      const loop = (kind: "batch" | "step", user_id: UserId) => {
        console.log("loop", user_id, kind)
        const [minInterval, maxInterval] =
          kind == "batch" ? [1000, 5000] : [200, 200]
        const rand =
          Math.round(Math.random() * (maxInterval - minInterval)) + minInterval
        const active =
          (kind == "batch" && state.started.randomBatchMove.has(user_id)) ||
          (kind == "step" && state.started.randomOneStepMove.has(user_id))
        if (active) {
          const action = function() {
            let r = false
            try {
              moveRandom(user_id, kind)
              r = true
            } catch (err) {
              console.log("Move aborted", user_id, kind, "Reason: " + err)
            }
            if (r) {
              loop(kind, user_id)
            }
          }
          // action()
          setTimeout(action, rand)
        } else {
          console.log(
            "Move aborted",
            user_id,
            kind,
            "Reason: Stopped by client"
          )
        }
      }

      for (const u of uids) {
        loop(kind, u)
      }
    }

    const stopRandomMove = (uids: UserId[]): void => {
      for (const uid of uids) {
        state.started.randomOneStepMove.delete(uid)
        state.started.randomBatchMove.delete(uid)
      }
    }

    const checkUser = (
      uid: UserId,
      start: boolean,
      kind: "batch" | "step"
    ): void => {
      if (start) {
        startRandomMove([uid], kind)
      } else {
        stopRandomMove([uid])
      }
    }
    const startRandomMoveForAll = (kind: "batch" | "step"): void => {
      const uids = difference(
        Object.keys(state.people),
        state.myUserId ? [state.myUserId] : []
      )
      startRandomMove(uids, kind)
    }

    const stopAll = (): void => {
      state.started.randomOneStepMove = new Set()
      state.started.randomBatchMove = new Set()
    }

    return { ...toRefs(state), startRandomMoveForAll, checkUser, stopAll }
  },
})
</script>

<style>
@font-face {
  font-family: "PixelMplus";
  src: url(/PixelMplus12-Regular.ttf);
}

body {
  font-family: Loto, "YuGothic", sans-serif;
}

#help {
  font-size: 12px;
}

h2 {
  font-size: 14px;
  margin-bottom: 0px;
}

[v-cloak] {
  display: none;
}

.moving {
  color: red;
}

/* https://webparts.cman.jp/button/onoff/ */
/* === ボタンを表示するエリア ============================== */
.sample2Area {
  margin: auto; /* 中央寄せ           */
  width: 50px; /* ボタンの横幅       */
}

/* === チェックボックス ==================================== */
.sample2Area input[type="checkbox"] {
  display: none; /* チェックボックス非表示 */
}

/* === チェックボックスのラベル（標準） ==================== */
.sample2Area label {
  display: block; /* ボックス要素に変更 */
  box-sizing: border-box; /* 枠線を含んだサイズ */
  text-align: left; /* 文字位置は中央     */
  border: 2px solid #78bd78; /* 枠線               */
  border-radius: 3px; /* 角丸               */
  line-height: 1; /* 1行の高さ          */
  height: 25px; /* ボタンの高さ       */
}

/* === 移動BOX（標準） ===================================== */
.sample2Area div {
  display: inline-block;
  height: 21px; /* ボタンの高さ       */
  width: 50%; /* ボタンの高さ       */
  background: #ddd; /* 背景色             */
  transition: 0.3s; /* ゆっくり変化       */
}

/* === ON側のチェックボックスの移動BOX（ONのとき） ========= */
.sample2Area input:checked + label > div {
  transform: translateX(100%); /* BOXを右に移動      */
  background: #78bd78; /* 背景色             */
}
</style>
