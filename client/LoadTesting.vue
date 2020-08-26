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
import Vue from "vue"
import {
  Person,
  Point,
  ChatComment,
  ArrowKey,
  MapRoomResponse,
  UserId,
  ChatGroup,
  PersonWithEmail,
  Poster,
} from "../@types/types"

import { findRoute, decodeMoved } from "../common/util"

import axios from "axios"
import _ from "lodash-es"
import io from "socket.io-client"
import * as firebase from "firebase/app"
import "firebase/auth"
import jsSHA from "jssha"

const PRODUCTION = process.env.NODE_ENV == "production"
const API_ROOT = PRODUCTION ? "/api" : "http://localhost:3000/api"
axios.defaults.baseURL = API_ROOT

const SOCKET_URL = PRODUCTION
  ? "https://posters.coi-conference.org" + ":5000"
  : "http://localhost:5000"
const socket = io(SOCKET_URL, { path: "/socket.io" })

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

export default class App extends Vue {
  people: { [index: string]: Person } = {}
  idToken: string | null = null
  jwt_hash = ""
  room_id = "default"
  lastUpdated: number | null = null
  user: firebase.User | null = null
  hallMap: MapRoomResponse = { cells: [], numCols: 0, numRows: 0 }
  posters: { [index: string]: Poster } = {}
  connectedUsers: string[] = []
  hidden = true
  comments: { [index: string]: ChatComment } = {}
  chatGroups: {
    [groupId: string]: ChatGroup
  } = {}
  myUserId: string | null = null
  started: {
    randomOneStepMove: Set<UserId>
    randomBatchMove: Set<UserId>
  } = { randomOneStepMove: new Set(), randomBatchMove: new Set() }
  announcement: { text: string; marquee: boolean; period: number } | null = null
  keyQueue: { key: ArrowKey; timestamp: number } | null = null
  timers: { [key: string]: NodeJS.Timeout } = {}
  points: { [index: string]: Point[] | null } = {}
  point_idx: { [index: string]: number } = {}
  axios = axios
  mounted(): void {
    const firebaseConfig = {
      apiKey: "AIzaSyC6-xLMRmgbrr_7vJLLk9WZUrXiUkskWT4",
      authDomain: "coi-conf.firebaseapp.com",
      databaseURL: "https://coi-conf.firebaseio.com",
      projectId: "coi-conf",
      storageBucket: "coi-conf.appspot.com",
      messagingSenderId: "648033256432",
      appId: "1:648033256432:web:17b78f6d2ffe5913979335",
      measurementId: "G-23RL5BGH9D",
    }
    firebase.initializeApp(firebaseConfig)

    // console.log("User", firebase.auth().currentUser)

    firebase.auth().onAuthStateChanged(user => {
      ;(async () => {
        console.log("onAuthStateChanged", user)
        this.user = user
        if (!user) {
          location.href = "/"
        } else {
          const idToken = await user.getIdToken()
          this.idToken = idToken
          const shaObj = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" })
          shaObj.update(idToken)
          this.jwt_hash = shaObj.getHash("HEX")
          axios.defaults.headers.common = {
            Authorization: `Bearer ${idToken}`,
          }
          const { data } = await axios.post("/id_token", {
            token: idToken,
            debug_from: "LoadTesting",
          })
          console.log(data)
          if (!data.ok) {
            location.reload()
          }
          if (!data.admin) {
            location.href = "/"
          }
          this.myUserId = data.user_id
          this.reload()
        }
      })().catch(err => {
        console.error(err)
      })
    })

    socket.on("person", d => {
      console.log("socket person", d)
      this.$set(this.people, d.id, d)
    })
    socket.on("moved", (s: string) => {
      this.on_socket_move(s)
    })
    socket.on("moved_multi", (s: string) => {
      const ss = s.split(";")
      for (const s of ss) {
        this.on_socket_move(s)
      }
    })
  }
  checkUser(uid: UserId, start: boolean, kind: "batch" | "step"): void {
    if (start) {
      this.startRandomMove([uid], kind)
    } else {
      this.stopRandomMove([uid])
    }
  }
  startRandomMoveForAll(kind: "batch" | "step"): void {
    const uids = _.difference(
      Object.keys(this.people),
      this.myUserId ? [this.myUserId] : []
    )
    this.startRandomMove(uids, kind)
  }
  on_socket_move(s: string): void {
    // console.log("socket moved", s)
    const pos = decodeMoved(s, this.room_id)
    if (
      !pos ||
      !this.people ||
      !this.hallMap ||
      pos.y >= this.hallMap.cells.length ||
      pos.x >= this.hallMap.cells[0].length
    ) {
      return
    }

    const p = this.people[pos.user]
    if (p) {
      this.$set(this.people, p.id, {
        ...p,
        x: pos.x,
        y: pos.y,
        direction: pos.direction,
      })
    }
  }
  setLiveObjects(x: number, y: number, objects: string[]): void {
    this.$set(this.hallMap.cells[y][x], "objects", objects)
  }

  reload(): void {
    this.lastUpdated = Date.now()
    ;(async () => {
      const [
        { data: data_p },
        { data: data_g },
        { data: data_m },
        { data: data_posters },
      ] = await Promise.all([
        axios.get<{ [index: string]: PersonWithEmail }>("/people?email=true"),
        axios.get<{ [index: string]: ChatGroup }>("/groups"),
        axios.get<MapRoomResponse>("/maps/" + this.room_id),
        axios.get<Poster[]>("/posters"),
      ])
      this.people = _.keyBy(data_p, "id")
      this.chatGroups = data_g
      this.hallMap = data_m
      this.posters = _.keyBy(data_posters, "id")
    })().catch(err => {
      console.error(err)
    })
  }
  stopAll(): void {
    this.started.randomOneStepMove = new Set()
    this.started.randomBatchMove = new Set()
  }
  moveTo(user_id: UserId, to: Point): void {
    console.log("moveTo", user_id, to)
    const person = this.people[user_id]
    const from = { x: person.x, y: person.y }
    if (!to) {
      console.error("moveTo point missing")
      return
    }
    if (to.x < 0 || to.y < 0) {
      console.error("moveTo: ", to, "out of range")
      return
    }
    delete this.timers[user_id]
    if (Math.abs(from.x - to.x) <= 1 && Math.abs(from.y - to.y) <= 1) {
      socket.emit("move", { ...to, user: person.id, token: this.jwt_hash })
      this.$set(this.people[user_id], "moving", false)
    } else {
      const ti = Date.now()
      this.points[user_id] = findRoute(
        user_id,
        this.hallMap.cells,
        Object.values(this.people),
        from,
        to
      )
      const tf = Date.now()
      if (!this.points[user_id]) {
        console.info("No route was found.")
        return
      }
      console.log(
        `Finding route of ${this.points[user_id]?.length} points, in ${tf -
          ti} ms (${user_id})`
      )
      console.debug("# of points on route", this.points[user_id]?.length)
      // const group = await model.chat.getGroupOfUser(user_id)
      // if (group) {
      //   await model.chat.leaveChat(user_id)
      // }
      this.point_idx[user_id] = 0
      this.$set(this.people[user_id], "moving", true)
      if (this.timers[user_id]) {
        clearInterval(this.timers[user_id])
        console.log("Timer ID deleted: ", this.timers[user_id])
        delete this.timers[user_id]
      }
      this.timers[user_id] = setInterval(() => {
        this.point_idx[user_id] += 1
        const to_step = (this.points[user_id] || {})[this.point_idx[user_id]]
        console.log(this.point_idx[user_id], this.points[user_id]?.length)
        if (this.point_idx[user_id] >= (this.points[user_id]?.length || 0)) {
          console.log("Batch move done.")
          this.$set(this.people[user_id], "moving", false)
          clearInterval(this.timers[user_id])
          console.log("Timer ID deleted: ", this.timers[user_id])
          return
        }
        if (!to_step) {
          console.error(
            "moveTo(): point missing, aborting",
            this.point_idx[user_id]
          )
          this.$set(this.people[user_id], "moving", false)
          this.points[user_id] = null
          clearInterval(this.timers[user_id])
          console.log("Timer ID deleted: ", this.timers[user_id])
          delete this.timers[user_id]
          return
        }
        socket.emit("move", {
          ...to_step,
          user: user_id,
          token: this.jwt_hash,
        })
      }, 500)
      console.log("Timer ID created: ", this.timers[user_id])
    }
  }
  canMoveTo(p: Point): boolean {
    if (
      p.x < 0 ||
      p.y < 0 ||
      p.x >= this.hallMap.numCols ||
      p.y >= this.hallMap.numRows
    ) {
      return false
    }

    return true
  }
  startRandomMove(uids: UserId[], kind: "batch" | "step"): void {
    console.log("startRandomMove", uids)
    if (kind == "batch") {
      this.started.randomBatchMove = unionSet(
        this.started.randomBatchMove,
        new Set(uids)
      )
      this.started.randomOneStepMove = diffSet(
        this.started.randomOneStepMove,
        new Set(uids)
      )
    } else {
      this.started.randomOneStepMove = unionSet(
        this.started.randomOneStepMove,
        new Set(uids)
      )
      this.started.randomBatchMove = diffSet(
        this.started.randomBatchMove,
        new Set(uids)
      )
    }
    const moveRandom = (user_id: UserId, kind: "batch" | "step"): boolean => {
      if (kind == "batch" && !this.started.randomBatchMove.has(user_id)) {
        return false
      }
      if (kind == "step" && !this.started.randomOneStepMove.has(user_id)) {
        return false
      }
      const p = this.people[user_id]
      let nx = -1
      let ny = -1
      let count = 0
      if (kind == "batch") {
        while (!this.canMoveTo({ x: nx, y: ny })) {
          nx = _.random(0, this.hallMap.numCols)
          ny = _.random(0, this.hallMap.numRows)
          count += 1
          if (count >= 100) {
            throw "Move failed 100 times."
          }
        }
      } else {
        while (!this.canMoveTo({ x: nx, y: ny })) {
          nx = p.x + _.random(-1, 1)
          ny = p.y + _.random(-1, 1)
          count += 1
          if (count >= 100) {
            throw "Move failed 100 times."
          }
        }
      }
      this.moveTo(user_id, { x: nx, y: ny })
      return true
    }
    const loop = (kind: "batch" | "step", user_id: UserId) => {
      console.log("loop", user_id, kind)
      const [minInterval, maxInterval] =
        kind == "batch" ? [1000, 5000] : [200, 200]
      const rand =
        Math.round(Math.random() * (maxInterval - minInterval)) + minInterval
      const active =
        (kind == "batch" && this.started.randomBatchMove.has(user_id)) ||
        (kind == "step" && this.started.randomOneStepMove.has(user_id))
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
        console.log("Move aborted", user_id, kind, "Reason: Stopped by client")
      }
    }
    for (const u of uids) {
      loop(kind, u)
    }
  }
  stopRandomMove(uids: UserId[]): void {
    for (const uid of uids) {
      this.started.randomOneStepMove.delete(uid)
      this.started.randomBatchMove.delete(uid)
    }
  }
}
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
