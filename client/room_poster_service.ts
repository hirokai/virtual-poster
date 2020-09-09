import Vue from "vue"
import { computed, ComputedRef, set } from "@vue/composition-api"

import {
  RoomAppState,
  RoomAppProps,
  Poster,
  ChatComment,
  MySocketObject,
} from "../@types/types"
import { keyBy } from "../common/util"
import { AxiosStatic, AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "../api/$api"
import { SocketIO } from "socket.io-client"

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

export const activePoster = (
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

export const updatePosterComment = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  poster_id: string,
  comment_id: string,
  text: string
): void => {
  console.log("updatePosterComment")
  state.posterInputComment = text
  state.editingOld = null
  const client = api(axiosClient(axios))
  client.posters
    ._posterId(poster_id)
    .comments._commentId(comment_id)
    .$patch({ body: { comment: text } })
    .then(data => {
      console.log("updateComment done", data)
      clearInputPoster(state)
      ;(document.querySelector("#poster-chat-input") as any)?.focus()
    })
    .catch(err => {
      console.log(err)
    })
}

export const sendPosterComment = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  text: string
): void => {
  const pid = adjacentPosters(props, state).value[0]?.id
  if (!pid) {
    return
  }
  console.log("Poster to comment on:", pid)
  const client = api(axiosClient(axios))
  client.posters
    ._posterId(pid)
    .comments.$post({
      body: {
        user_id: props.myUserId,
        comment: text,
      },
    })
    .then(data => {
      console.log("sendPosterComment done", data)
      state.posterInputComment = ""
    })
    .catch(() => {
      //
    })
}

export const doSubmitPosterComment = (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  text: string
): void => {
  if (state.editingOld) {
    const poster_id = activePoster(props, state).value?.id
    if (poster_id) {
      updatePosterComment(
        axios,
        props,
        state,
        poster_id,
        state.editingOld,
        text
      )
    }
  } else {
    sendPosterComment(axios, props, state, text)
    clearInputPoster(state)
    ;(document.querySelector("#poster-chat-input") as any)?.focus()
  }
}

export const doUploadPoster = (
  axios: AxiosStatic | AxiosInstance,
  file: File,
  poster_id: string
): void => {
  console.log(file, poster_id)
  const fd = new FormData()
  fd.append("file", file)
  console.log(fd)
  axios
    .post<{ ok: boolean; poster?: Poster }>(
      "/posters/" + poster_id + "/file",
      fd
    )
    .then(({ data }) => {
      console.log(data)
    })
    .catch(err => {
      console.error(err)
    })
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
    Vue.set(state.posters, d.id, d)
    Vue.set(state.hallMap[d.y], d.x, {
      ...state.hallMap[d.y][d.x],
      poster_number: d.poster_number,
    })
  })
  socket.on("PosterComment", (d: ChatComment) => {
    console.log("PosterComment", d)
    const pid = activePoster.value?.id
    const to_s = d.texts.map(t => t.to)
    if (pid && to_s.indexOf(pid) != -1) {
      set(state.posterComments, d.id, d)
    }
  })
  socket.on("poster.comment.remove", (comment_id: string) => {
    console.log("poster.comment.remove", comment_id)
    Vue.delete(state.posterComments, comment_id)
  })
  const posters = await client.maps._roomId(props.room_id).posters.$get()
  state.posters = keyBy(posters, "id")
  return true
}
