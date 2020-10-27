import { computed, ComputedRef, nextTick, watch } from "vue"

import {
  RoomAppState,
  RoomAppProps,
  Poster,
  MySocketObject,
  PosterId,
  CommentEvent,
  PosterCommentDecrypted,
} from "@/@types/types"
import { keyBy } from "@/common/util"
import { AxiosStatic, AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"
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
  text: string,
  reply_to?: CommentEvent
): Promise<void> => {
  const pid = adjacentPoster(props, state).value?.id
  if (!pid) {
    return
  }
  const client = api(axiosClient(axios))
  if (reply_to) {
    const r = await client.posters
      ._posterId(pid)
      .comments._commentId(reply_to.id)
      .reply.$post({ body: { text } })
    console.log("sendPosterComment (reply) done", r)
    if (r.ok) {
      state.posterInputComment = ""
    }
  } else {
    const r = await client.posters._posterId(pid).comments.$post({
      body: {
        user_id: props.myUserId,
        comment: text,
      },
    })
    console.log("sendPosterComment done", r)
    if (r.ok) {
      state.posterInputComment = ""
    }
  }
}

export const doSubmitPosterComment = async (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  text: string,
  reply_to?: CommentEvent
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
    await sendPosterComment(axios, props, state, text, reply_to)
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
  socket.on("PosterComment", async (d: PosterCommentDecrypted) => {
    console.log("PosterComment socket", d)
    if (activePoster.value && d.poster == activePoster.value.id) {
      //Vue.set
      state.posterComments[d.id] = d
      await nextTick(() => {
        const el = document.querySelector("#poster-comments")
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      })
    }
    if (!state.posterComments[d.id]) {
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
  })
  const posters = await client.maps._roomId(props.room_id).posters.$get()
  state.posters = keyBy(posters, "id")

  const pid = state.people[props.myUserId]?.poster_viewing
  if (pid) {
    if (pid) {
      const r1 = await client.posters._posterId(pid).file_url.$get()
      if (r1.ok && r1.url) {
        state.posters[pid].file_url = r1.url
      }
      console.log("poster comment loading")
      const data = await client.posters._posterId(pid).comments.$get()
      watch(
        () => state.people[props.myUserId]?.poster_viewing,
        async () => {
          console.log("poster_viewing changed")
          const pid = state.people[props.myUserId]?.poster_viewing
          if (pid) {
            const data = await client.posters._posterId(pid).comments.$get()
            state.posterComments = keyBy(data, "id")
          } else {
            state.posterComments = {}
          }
        }
      )
      state.posterComments = keyBy(data, "id")
    } else {
      state.posterComments = {}
    }
  } else {
    watch(
      () => state.people[props.myUserId]?.poster_viewing,
      async () => {
        console.log("poster_viewing changed")
        const pid = state.people[props.myUserId]?.poster_viewing
        if (pid) {
          const data = await client.posters._posterId(pid).comments.$get()
          state.posterComments = keyBy(data, "id")
        } else {
          state.posterComments = {}
        }
      }
    )
  }

  return true
}
