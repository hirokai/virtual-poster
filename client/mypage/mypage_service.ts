import { AxiosStatic, AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"

import { UserId, RoomId, MyPageState, ChatEvent } from "@/@types/types"
import {
  decryptIfNeeded,
  formatDate,
  processCommentsAndEvents,
} from "../room/room_chat_service"
import { ChatComment } from "@/api/@types"

export function download(filename: string, text: string) {
  const element = document.createElement("a")
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  )
  element.setAttribute("download", filename)

  element.style.display = "none"
  document.body.appendChild(element)

  element.click()

  document.body.removeChild(element)
}

export const exportLog = (
  axios: AxiosStatic | AxiosInstance,
  state: MyPageState
) => async () => {
  const client = api(axiosClient(axios))
  const myUserId = state.myUserId
  if (myUserId) {
    const comments_all = await client.people
      ._userId(state.myUserId)
      .comments.$get()

    const uidToObj = (uid: UserId) => {
      const obj = { id: uid }
      const name = state.people[uid]?.name
      if (name) {
        obj["name"] = name
      }
      return obj
    }

    const ridToObj = (rid: RoomId) => {
      const obj = { id: rid }
      const name = state.rooms[rid]?.name
      if (name) {
        obj["name"] = name
      }
      return obj
    }

    const comments: any[] = []
    // Start file download.
    for (const c of comments_all) {
      if (c.kind == "person" || c.kind == "poster") {
        try {
          const r = await decryptIfNeeded(
            myUserId,
            state.people,
            c,
            state.privateKey
          )
          console.log({ r })
          const text = r.text || "(復号化できません)"
          comments.push({
            id: c.id,
            room: ridToObj(c.room),
            text_decrypted: text,
            timestamp: c.timestamp,
            x: c.x,
            y: c.y,
            last_updated: c.last_updated,
            recipients: c.texts.map(t => uidToObj(t.to)),
            // texts: c.texts,
            person: uidToObj(c.person),
            kind: c.kind,
          })
        } catch (err) {
          //
        }
      } else {
        // events
        const c1 = c as ChatEvent
        comments.push({
          kind: c1.kind,
          room: ridToObj(c1.room),
          group: c1.group,
          person: uidToObj(c1.person),
          event_type: c1.event_type,
          event_data: c1.event_data,
          timestamp: c.timestamp,
        })
      }
    }
    download("export_log.json", JSON.stringify(comments, null, 2))
  }
}

export const exportLogHtml = (
  axios: AxiosStatic | AxiosInstance,
  state: MyPageState
) => async () => {
  const client = api(axiosClient(axios))
  const myUserId = state.myUserId
  if (myUserId) {
    const comments_all = await client.people
      ._userId(state.myUserId)
      .comments.$get()
    comments_all.sort((a, b) => a.timestamp - b.timestamp)

    const { events, comments_decrypted } = await processCommentsAndEvents(
      comments_all,
      state.people,
      state.myUserId,
      state.privateKey
    )

    const html = document.createElement("html")
    const pre = document.createElement("pre")
    for (const c of comments_all) {
      const div = document.createElement("div")
      div.style.cssText = "background: pink; margin: 10px;"
      const d1 = document.createElement("div")
      d1.innerHTML = formatDate(c.timestamp)
      div.append(d1)
      if (c["id"]) {
        const c1 = c as ChatComment
        const r = await decryptIfNeeded(
          state.myUserId,
          state.people,
          c1,
          state.privateKey
        )
        const d2 = document.createElement("div")
        d2.innerHTML = formatDate(c.timestamp)
        div.append(d2)
        const d3 = document.createElement("div")
        d3.innerHTML = c1.texts[0].text
        div.append(d3)
        html.append(div)
      }
    }
    download("export_log.html", html.outerHTML)
  }
}
11
