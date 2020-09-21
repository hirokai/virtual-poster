import { computed, ComputedRef, nextTick } from "vue"

import {
  RoomAppState,
  RoomAppProps,
  Poster,
  MySocketObject,
  PosterId,
} from "../@types/types"
import { keyBy } from "../common/util"
import { AxiosStatic, AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "../api/$api"
import { SocketIO } from "socket.io-client"
import { ChatCommentDecrypted } from "@/api/@types"

export const adjacentPosters = (
  props: RoomAppProps,
  state: RoomAppState
): ComputedRef<Poster[]> =>
  computed((): Poster[] => {
    const me = state.people[props.myUserId]
    if (!me) {
      return []
    }
    const posters = Object.values(state.posters).filter(c => {
      return Math.abs(c.x - me.x) <= 1 && Math.abs(c.y - me.y) <= 1
    })
    return posters
  })

export const adjacentPoster = (
  props: RoomAppProps,
  state: RoomAppState
): ComputedRef<Poster | undefined> =>
  computed((): Poster | undefined => {
    const adj = adjacentPosters(props, state).value
    return adj.length > 0 ? adj[0] : undefined
  })

const clearInputPoster = (state: RoomAppState) => {
  state.posterInputComment = undefined
}

export const updatePosterComment = async (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  poster_id: string,
  comment_id: string,
  text: string
): Promise<void> => {
  console.log("updatePosterComment")
  state.posterInputComment = text
  state.editingOld = null
  const client = api(axiosClient(axios))
  try {
    const data = await client.posters
      ._posterId(poster_id)
      .comments._commentId(comment_id)
      .$patch({ body: { comment: text } })
    console.log("updateComment done", data)
    clearInputPoster(state)
    ;(document.querySelector("#poster-chat-input") as any)?.focus()
  } catch (err) {
    console.log(err)
  }
}

export const sendPosterComment = async (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  text: string
): Promise<void> => {
  const pid = adjacentPoster(props, state).value?.id
  if (!pid) {
    return
  }
  console.log("Poster to comment on:", pid)
  const client = api(axiosClient(axios))
  const data = await client.posters._posterId(pid).comments.$post({
    body: {
      user_id: props.myUserId,
      comment: text,
    },
  })
  console.log("sendPosterComment done", data)
  state.posterInputComment = ""
}

export const doSubmitPosterComment = async (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  text: string
): Promise<void> => {
  if (state.editingOld) {
    const poster_id = adjacentPoster(props, state).value?.id
    if (poster_id) {
      await updatePosterComment(
        axios,
        props,
        state,
        poster_id,
        state.editingOld,
        text
      )
    }
  } else {
    await sendPosterComment(axios, props, state, text)
    clearInputPoster(state)
    ;(document.querySelector("#poster-chat-input") as any)?.focus()
  }
}

export const doUploadPoster = async (
  axios: AxiosStatic | AxiosInstance,
  file: File,
  poster_id: string
): Promise<void> => {
  console.log(file, poster_id)
  const fd = new FormData()
  fd.append("file", file)
  console.log(fd)
  const { data } = await axios.post<{ ok: boolean; poster?: Poster }>(
    "/posters/" + poster_id + "/file",
    fd
  )
  console.log(data)
}

export const initPosterService = async (
  axios: AxiosStatic | AxiosInstance,
  socket: SocketIO.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState,
  activePoster: ComputedRef<Poster | undefined>
): Promise<boolean> => {
  const client = api(axiosClient(axios))
  socket.on("Poster", (d: Poster) => {
    console.log("socket Poster", d)
    //Vue.set
    state.posters[d.id] = d
    //Vue.set
    state.hallMap[d.y][d.x] = {
      ...state.hallMap[d.y][d.x],
      poster_number: d.poster_number,
    }
  })
  socket.on("PosterComment", async (d: ChatCommentDecrypted) => {
    console.log("PosterComment", d)
    const pid = activePoster.value?.id
    const to_s = d.texts.map(t => t.to)
    const scroll = !state.posterComments[d.id]
    if (pid && to_s.indexOf(pid) != -1) {
      //Vue.set
      state.posterComments[d.id] = d
    }
    if (scroll) {
      await nextTick(() => {
        const el = document.querySelector("#poster-comments-container")
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      })
    }
  })
  socket.on("poster.comment.remove", (comment_id: string) => {
    console.log("poster.comment.remove", comment_id)
    //Vue.delete
    delete state.posterComments[comment_id]
  })

  socket.on("PosterRemove", (poster_id: PosterId) => {
    const pid = adjacentPoster(props, state).value?.id
    //Vue.delete
    delete state.posters[poster_id]
    console.log("PosterRemove", pid, poster_id)
    if (pid == poster_id) {
      state.posterLooking = false
    }
  })
  const posters = await client.maps._roomId(props.room_id).posters.$get()
  state.posters = keyBy(posters, "id")
  return true
}
