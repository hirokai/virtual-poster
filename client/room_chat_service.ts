import Vue from "vue"
import { computed, ComputedRef } from "@vue/composition-api"

import {
  UserId,
  RoomId,
  CommentId,
  ChatCommentDecrypted,
  ChatComment,
  RoomAppState,
  RoomAppProps,
  PosterId,
  Poster,
  ChatGroup,
  ChatGroupId,
  Person,
  MySocketObject,
  CommentEncryptedEntry,
} from "../@types/types"
import { every, find, findIndex, keyBy, compact, uniq } from "lodash-es"
import * as encryption from "./encryption"
import { AxiosStatic, AxiosInstance } from "axios"
import { MeshRoom, SfuRoom } from "skyway-js"
import { SocketIO } from "socket.io-client"

export async function doSendOrUpdateComment(
  axios: AxiosStatic | AxiosInstance,
  skywayRoom: MeshRoom | SfuRoom | null,
  room_id: RoomId,
  text: string,
  encrypting: boolean,
  to_users: UserId[],
  privateKey: CryptoKey | null,
  public_keys: { [user_id: string]: { public_key?: string } },
  editingOld?: CommentId
): Promise<{ ok: boolean; data?: any }> {
  const comments_encrypted: CommentEncryptedEntry[] = []
  if (encrypting && !privateKey) {
    console.log("Private key import failed")
    return { ok: false }
  }
  for (const u of to_users) {
    const k = public_keys[u].public_key
    if (k) {
      const pub = await encryption.importPublicKey(k, true)
      // console.log(to_users, u, k, pub)
      if (encrypting && privateKey && pub) {
        const comment = encrypting
          ? await encryption.encrypt_str(pub, privateKey, text)
          : text
        const e = {
          to: u,
          text: comment,
          encrypted: true,
        }
        comments_encrypted.push(e)
      } else {
        const e = { to: u, text, encrypted: false }
        comments_encrypted.push(e)
      }
    } else {
      const e = { to: u, text, encrypted: false }
      comments_encrypted.push(e)
    }
  }
  console.log(comments_encrypted)
  if (!editingOld) {
    const { data } = await axios.post("/maps/" + room_id + "/comments", {
      comments_encrypted,
      room_id: room_id,
    })
    console.log(data)
    if (skywayRoom) {
      skywayRoom.send({
        comments_encrypted,
        room_id: room_id,
      })
    }
    return { ok: true, data }
  } else {
    const { data } = await axios.patch("/comments/" + editingOld, {
      comments: comments_encrypted,
      room_id: room_id,
    })
    return { ok: true, data }
  }
}

export const deleteComment = (axios: AxiosStatic | AxiosInstance) => (
  comment_id: string
): void => {
  console.log(comment_id)
  axios
    .delete("/comments/" + comment_id)
    .then(r => {
      console.log(r.data)
    })
    .catch(e => {
      console.error(e)
    })
}

export const decryptIfNeeded = async (
  myUserId: string,
  public_keys: { [user_id: string]: { public_key?: string } },
  comment_: ChatComment,
  prv: CryptoKey | null
): Promise<{
  text: string | null
  encrypted?: boolean
  ok: boolean
  error?: string
}> => {
  const comment = comment_ as ChatComment
  const to_me_idx = findIndex(comment.texts, t => t.to == myUserId)
  if (to_me_idx == -1) {
    return { text: null, ok: false, error: "Does not have a message to me" }
  }
  const text_for_me = comment.texts[to_me_idx]
  console.log("decryptIfNeeded", {
    public_keys: JSON.parse(JSON.stringify(public_keys)),
  })
  if (!text_for_me.encrypted) {
    return { text: text_for_me.text, encrypted: false, ok: true }
  }
  if (!prv) {
    return {
      text: text_for_me.text,
      encrypted: true,
      ok: false,
      error: "My private key not found",
    }
  }
  const pub_str = public_keys[comment.person]?.public_key
  if (!pub_str) {
    console.warn(
      "Sender's public key not found",
      comment.person,
      public_keys[comment.person],
      pub_str
    )
    return {
      text: text_for_me.text,
      encrypted: true,
      ok: false,
      error: "Sender's public key not found (sender: " + comment.person + ")",
    }
  }
  const pub = await encryption.importPublicKey(pub_str, true)
  if (!pub) {
    return {
      text: text_for_me.text,
      encrypted: true,
      ok: false,
      error: "Public key import failed",
    }
  }
  const dec_str = await encryption.decrypt_str(pub, prv, text_for_me.text)
  return {
    text: dec_str,
    encrypted: true,
    ok: !!dec_str,
    error: dec_str ? undefined : "Decryption failed",
  }
}

export const newComment = (
  props: RoomAppProps,
  state: RoomAppState,
  d: ChatComment,
  activePoster?: PosterId
): void => {
  console.log("newComment", d)
  if (state.enableEncryption && !state.privateKey) {
    console.warn("Private key not set.")
    return
  }
  decryptIfNeeded(props.myUserId, state.people, d, state.privateKey)
    .then(r => {
      console.log("new (or updated) comment decrypt", r)
      const d2: ChatCommentDecrypted = {
        ...d,
        texts: d.texts.map(a => {
          return { to: a.to, encrypted: a.encrypted }
        }),
        text_decrypted: r.text || "（暗号化）",
      }
      if (
        d2.kind == "poster" &&
        activePoster &&
        d2.texts.map(t => t.to).indexOf(activePoster) != -1
      ) {
        Vue.set(state.posterComments, d.id, d)
      }

      Vue.set(state.comments, d.id, d2)
      Vue.nextTick(() => {
        let el = document.querySelector("#chat-local-history")
        if (el) {
          el.scrollTop = el.scrollHeight
        }
        el = document.querySelector("#poster-comments")
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      })
    })
    .catch(console.error)
}

export const chatGroupOfUser = (
  state: RoomAppState
): ComputedRef<{ [userId: string]: ChatGroupId }> =>
  computed((): {
    [userId: string]: ChatGroupId
  } => {
    const obj: { [userId: string]: ChatGroupId } = {}
    for (const g of Object.values(state.chatGroups)) {
      for (const u of g.users) {
        obj[u] = g.id
      }
    }
    return obj
  })

export const startChat = async (
  props: RoomAppProps,
  state: RoomAppState,
  axios: AxiosStatic | AxiosInstance
): Promise<{ group: ChatGroup; encryption_possible: boolean } | undefined> => {
  const to_users: UserId[] = Array.from(state.selectedUsers)
  if (to_users.length == 0) {
    return undefined
  }
  const to_groups: ChatGroupId[] = uniq(
    compact(to_users.map(u => chatGroupOfUser(state).value[u]))
  )
  if (to_groups.length > 1) {
    // Multiple groups
    state.selectedUsers.clear()
    return undefined
  }
  if (state.batchMoveTimer) {
    clearInterval(state.batchMoveTimer)
  }
  if (to_groups.length == 1) {
    const { data } = await axios.post(
      "/maps/" + props.room_id + "/groups/" + to_groups[0] + "/join"
    )
    const group: ChatGroup = data.joinedGroup
    const encryption_possible = every(
      group.users.map(uid => !!state.people[uid]?.public_key)
    )
    console.log("join result", data)
    return { group, encryption_possible }
  } else {
    const { data } = await axios.post("/maps/" + props.room_id + "/groups", {
      fromUser: props.myUserId,
      toUsers: to_users,
    })
    console.log(data)
    const group: ChatGroup = data.group
    const encryption_possible = every(
      group.users.map(uid => !!state.people[uid]?.public_key)
    )
    return { group, encryption_possible }
  }
}

export const myChatGroup = (
  props: RoomAppProps,
  state: RoomAppState
): ComputedRef<ChatGroupId | null> =>
  computed((): ChatGroupId | null => {
    const g = find(Object.values(state.chatGroups), g => {
      return g.users.indexOf(props.myUserId) != -1
    })
    return g?.id || null
  })

export const inviteToChat = async (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  p: Person
): Promise<ChatGroup | undefined> => {
  const { data } = await axios.post(
    "/maps/" +
      props.room_id +
      "/groups/" +
      myChatGroup(props, state).value +
      "/people",
    { user_id: p.id }
  )
  console.log("invite result", data)
  if (data.ok) {
    const group: ChatGroup = data.joinedGroup
    return group
  } else {
    return undefined
  }
}

export const initChatService = async (
  axios: AxiosStatic | AxiosInstance,
  socket: SocketIO.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState,
  activePoster: ComputedRef<Poster | undefined>,
  public_key_from_server: string | undefined
): Promise<boolean> => {
  try {
    const r = await encryption.setupEncryption(
      axios,
      props.myUserId,
      public_key_from_server
    )
    if (r.prv && r.pub) {
      state.privateKeyString = r.prv
      state.publicKeyString = r.pub
      state.publicKey = await encryption.importPublicKey(r.pub, true)
      if (state.publicKey) {
        const r2 = await encryption.importPrivateKeyJwk(
          JSON.parse(r.prv),
          state.publicKey,
          true
        )
        if (r2) {
          state.privateKey = r2.key
        }
      }
    }
    if (!r.ok) {
      // alert(
      //   "秘密鍵が設定されていません。暗号化メッセージが正しく読めません。マイページでインポートしてください。"
      // )
      // location.href = "/mypage?room=" + props.room_id + "#encrypt"
    }
  } catch (err1) {
    console.error(err1)
    // alert(
    //   "秘密鍵が設定されていません。暗号化メッセージが正しく読めません。マイページでインポートしてください。"
    // )
    // location.href = "/mypage?room=" + props.room_id + "#encrypt"
  }
  socket.on("Comment", (d: ChatComment) => {
    const pid = activePoster.value?.id
    console.log("comment", d)
    if (d.room == props.room_id) {
      newComment(props, state, d, pid)
    }
  })
  socket.on("CommentRemove", (comment_id: string) => {
    console.log("CommentRemove", comment_id, state.comments[comment_id])
    Vue.delete(state.comments, comment_id)
  })

  socket.on("PosterCommentRemove", (comment_id: string) => {
    console.log(
      "PosterCommentRemove",
      comment_id,
      state.posterComments[comment_id]
    )
    Vue.delete(state.posterComments, comment_id)
  })

  socket.on("Group", d => {
    console.log("socket group", d)
    Vue.set(state.chatGroups, d.id, d)
    const group = myChatGroup(props, state).value
    console.log("myChatGroup", group)
    if (group) {
      if (!state.skywayRoom) {
        state.skywayRoom = state.peer?.joinRoom(group) as MeshRoom | SfuRoom
        state.skywayRoom.on("open", () => {
          if (state.skywayRoom) {
            state.skywayRoom.send({
              msg: `Thanks for adding. I'm ${props.myUserId}.`,
            })
          }
          state.skywayRoom!.on("data", data => {
            console.log("%c" + JSON.stringify(data.data), "color: purple")
          })
        })
      }
    } else {
      if (state.skywayRoom) {
        state.skywayRoom.close()
        state.skywayRoom = null
      }
    }
  })
  socket.on("GroupRemove", id => {
    console.log("GroupRemove", id)
    Vue.delete(state.chatGroups, id)
    const group = myChatGroup(props, state).value
    if (!group) {
      if (state.skywayRoom) {
        state.skywayRoom.close()
        state.skywayRoom = null
      }
    }
  })

  const [{ data: comments }, { data: groups }] = await Promise.all([
    axios.get<ChatComment[]>("/maps/" + props.room_id + "/comments"),
    axios.get<ChatGroup[]>("/maps/" + props.room_id + "/groups"),
  ])
  state.chatGroups = keyBy(groups, "id")

  const decrypted: ChatCommentDecrypted[] = []
  for (const c of comments) {
    const r = await decryptIfNeeded(
      props.myUserId,
      state.people,
      c,
      state.privateKey
    )
    console.log("decryptIfNeeded() result", r)
    const comment_decr: ChatCommentDecrypted = {
      id: c.id,
      timestamp: c.timestamp,
      last_updated: c.last_updated,
      text_decrypted: r.ok && r.text ? r.text : "（暗号化）",
      texts: c.texts.map(t => {
        return { to: t.to, encrypted: t.encrypted }
      }),
      room: c.room,
      x: c.x,
      y: c.y,
      person: c.person,
      kind: c.kind,
    }
    // comment.encrypted = r.encrypted || false
    decrypted.push(comment_decr)
  }
  state.comments = keyBy(decrypted, "id")
  return true
}
