import Vue from "vue"
import { computed, ComputedRef, set } from "@vue/composition-api"

import {
  RoomAppState,
  RoomAppProps,
  Poster,
  ChatComment,
  MySocketObject,
} from "../../@types/types"
import _ from "lodash-es"
import { AxiosStatic } from "axios"

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
  axios: AxiosStatic,
  props: RoomAppProps,
  state: RoomAppState,
  poster_id: string,
  comment_id: string,
  text: string
): void => {
  state.posterInputComment = text
  state.editingOld = null
  axios
    .patch("/posters/" + poster_id + "/comments/" + comment_id, {
      comment: text,
    })
    .then(res => {
      console.log("updateComment done", res.data)
      clearInputPoster(state)
      ;(document.querySelector("#poster-chat-input") as any)?.focus()
    })
    .catch(err => {
      console.log(err)
    })
}

export const sendPosterComment = (
  axios: AxiosStatic,
  props: RoomAppProps,
  state: RoomAppState,
  text: string
): void => {
  const pid = adjacentPosters(props, state).value[0]?.id
  if (!pid) {
    return
  }
  console.log("Poster to comment on:", pid)
  axios
    .post("/posters/" + pid + "/comments", {
      user_id: props.myUserId,
      comment: text,
      room_id: props.room_id,
    })
    .then(res => {
      console.log("sendPosterComment done", res.data)
    })
    .catch(() => {
      //
    })
}

export const doSubmitPosterComment = (
  axios: AxiosStatic,
  props: RoomAppProps,
  state: RoomAppState,
  text: string
): void => {
  //   console.log("submitPosterComment", text, axios.defaults.headers.common)
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
  axios: AxiosStatic,
  file: File,
  poster_id: string
): void => {
  console.log(file, poster_id)
  const fd = new FormData()
  fd.append("file", file)
  console.log(fd)

  axios
    .post("/posters/" + poster_id + "/file", fd)
    .then(({ data }) => {
      console.log(data)
    })
    .catch(err => {
      console.error(err)
    })
}

export const initPosterService = async (
  axios: AxiosStatic,
  socket: SocketIO.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState,
  activePoster: ComputedRef<Poster | undefined>
): Promise<boolean> => {
  socket.on("poster", (d: Poster) => {
    console.log("socket poster", d)
    Vue.set(state.posters, d.id, d)
  })
  socket.on("poster.comment", (d: ChatComment) => {
    console.log("poster.comment", d)
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
  const { data: posters } = await axios.get<Poster[]>(
    "/maps/" + props.room_id + "/posters"
  )
  state.posters = _.keyBy(posters, "id")
  return true
}
