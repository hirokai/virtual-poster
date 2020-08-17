import Vue from "vue"
import { computed, ComputedRef, watch } from "@vue/composition-api"
import { isPosterId } from "../common/util"

import {
  UserId,
  RoomId,
  CommentId,
  ChatComment,
  ChatCommentEncrypted,
  RoomAppState,
  RoomAppProps,
  PosterId,
  Poster,
  ChatGroup,
  ChatGroupId,
  Person,
  MySocketObject,
} from "../../@types/types"
import _ from "lodash-es"
import * as encryption from "./encryption"
import { AxiosStatic } from "axios"
import { MeshRoom, SfuRoom } from "skyway-js"

export async function doSendOrUpdateComment(
  axios: AxiosStatic,
  skywayRoom: MeshRoom | SfuRoom | null,
  room_id: RoomId,
  text: string,
  encrypting: boolean,
  to_users: UserId[],
  privateKey: CryptoKey | null,
  public_keys: { [user_id: string]: { public_key?: string } },
  editingOld?: CommentId
): Promise<{ ok: boolean; data?: any }> {
  const comments_encrypted: {
    to_user: UserId
    text: string
    encrypted: boolean
  }[] = []
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
        const e = { to_user: u, text: comment, encrypted: true }
        comments_encrypted.push(e)
      } else {
        const e = { to_user: u, text, encrypted: false }
        comments_encrypted.push(e)
      }
    } else {
      const e = { to_user: u, text, encrypted: false }
      comments_encrypted.push(e)
    }
  }
  console.log(comments_encrypted)
  if (!editingOld) {
    const { data } = await axios.post("/maps/" + room_id + "/comments", {
      comments_encrypted,
      room_id: room_id,
    })
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

export const deleteComment = (axios: AxiosStatic) => (
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
  comment_: ChatComment | ChatCommentEncrypted,
  prv: CryptoKey | null
): Promise<{ text: string | null; encrypted?: boolean; ok: boolean }> => {
  if (comment_["text"]) {
    //ChatComment
    const comment = comment_ as ChatComment
    const to_me_idx = _.indexOf(comment.to, myUserId)
    if (to_me_idx == -1) {
      return { text: comment.text, ok: false }
    }
    // console.log("decryptIfNeeded", comment.encrypted)
    if (!comment.encrypted[to_me_idx]) {
      return { text: comment.text, encrypted: false, ok: true }
    }
    if (!prv) {
      return { text: comment.text, encrypted: true, ok: false }
    }
    const pub_str = public_keys[comment.person].public_key
    if (!pub_str) {
      return { text: comment.text, encrypted: true, ok: false }
    }
    const pub = await encryption.importPublicKey(pub_str, true)
    if (!pub) {
      return { text: comment.text, encrypted: true, ok: false }
    }
    const dec_str = await encryption.decrypt_str(pub, prv, comment.text)
    return { text: dec_str, encrypted: true, ok: !!dec_str }
  } else {
    //ChatCommentEncrypted
    const comment = comment_ as ChatCommentEncrypted
    const c_for_me = _.find(comment.texts, t => {
      return isPosterId(t.to_user) || t.to_user == myUserId
    })
    if (!c_for_me) {
      //Not a message for me
      return { ok: false, text: null }
    }
    if (!c_for_me.encrypted) {
      return { ok: true, encrypted: false, text: c_for_me.text }
    }
    if (!prv) {
      return { text: null, encrypted: true, ok: false }
    }
    const pub_str = public_keys[comment.person].public_key
    if (!pub_str) {
      return { ok: false, encrypted: true, text: null }
    }
    const pub = await encryption.importPublicKey(pub_str, true)
    if (!pub) {
      return { text: c_for_me.text, encrypted: true, ok: false }
    }
    const dec_str = await encryption.decrypt_str(pub, prv, c_for_me.text)
    return { text: dec_str, ok: true, encrypted: true }
  }
}

export const newComment = (
  props: RoomAppProps,
  state: RoomAppState,
  d: ChatCommentEncrypted,
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
      const d2: ChatComment = {
        ...d,
        to: d.texts.map(a => a.to_user),
        text: r.text || "（暗号化）",
        encrypted: d.texts.map(a => a.encrypted),
      }
      if (
        d2.kind == "poster" &&
        activePoster &&
        d2.to.indexOf(activePoster) != -1
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
  axios: AxiosStatic
): Promise<ChatGroup | undefined> => {
  const to_users: UserId[] = Array.from(state.selectedUsers)
  if (to_users.length == 0) {
    return undefined
  }
  const to_groups: ChatGroupId[] = _.uniq(
    _.compact(to_users.map(u => chatGroupOfUser(state).value[u]))
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
    console.log("join result", data)
    return group
  } else {
    const { data } = await axios.post("/maps/" + props.room_id + "/groups", {
      fromUser: props.myUserId,
      toUsers: to_users,
    })
    console.log(data)
    const group: ChatGroup = data.group
    return group
  }
}

export const myChatGroup = (
  props: RoomAppProps,
  state: RoomAppState
): ComputedRef<ChatGroupId | null> =>
  computed((): ChatGroupId | null => {
    const g = _.find(Object.values(state.chatGroups), g => {
      return g.users.indexOf(props.myUserId) != -1
    })
    return g?.id || null
  })

export const inviteToChat = async (
  axios: AxiosStatic,
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
  axios: AxiosStatic,
  socket: SocketIO.Socket | MySocketObject,
  props: RoomAppProps,
  state: RoomAppState,
  activePoster: ComputedRef<Poster | undefined>
): Promise<boolean> => {
  socket.on("comment", (d: ChatCommentEncrypted) => {
    const pid = activePoster.value?.id
    console.log("comment", d)
    if (d.room == props.room_id) {
      newComment(props, state, d, pid)
    }
  })
  socket.on("comment.remove", (comment_id: string) => {
    console.log("comment.remove", comment_id)
    Vue.delete(state.comments, comment_id)
  })

  socket.on("group", d => {
    console.log("socket group", d)
    Vue.set(state.chatGroups, d.id, d)
    const group = myChatGroup(props, state).value
    console.log("myChatGroup", group)
    if (group) {
      if (!state.skywayRoom) {
        state.skywayRoom = state.peer.joinRoom(group) as MeshRoom | SfuRoom
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
  socket.on("group.remove", id => {
    console.log("group.remove", id)
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
  state.chatGroups = _.keyBy(groups, "id")

  const decrypted: ChatComment[] = []
  for (const comment of comments) {
    if (state.privateKey) {
      const r = await decryptIfNeeded(
        props.myUserId,
        state.people,
        comment,
        state.privateKey
      )
      comment.text = r.text || comment.text
      // comment.encrypted = r.encrypted || false
    }
    decrypted.push(comment)
  }
  state.comments = _.keyBy(decrypted, "id")
  return true
}

export const setupEncryption = async (
  axios: AxiosStatic,
  props: RoomAppProps,
  state: RoomAppState,
  pub_str_from_server: string | null
): Promise<boolean> => {
  state.enableEncryption =
    localStorage["virtual-poster:" + props.myUserId + ":config:encryption"] ==
    "1"
  let pub_str_local: string | null =
    localStorage["virtual-poster:" + props.myUserId + ":public_key_spki"]
  if (pub_str_from_server && !pub_str_local) {
    pub_str_local = pub_str_from_server
    localStorage[
      "virtual-poster:" + props.myUserId + ":public_key_spki"
    ] = pub_str_from_server
  }
  const prv_str_local = {
    jwk: (localStorage[
      "virtual-poster:" + props.myUserId + ":private_key_jwk"
    ] || null) as string | null,
    pkcs8: (localStorage["virtual-poster:private_key:" + props.myUserId] ||
      null) as string | null,
  }

  if (pub_str_from_server) {
    state.publicKeyString = pub_str_from_server
  } else {
    if (pub_str_local) {
      console.log(
        "Public key does NOT exist on server, but found in localStorage."
      )
      console.log("Public key found in localStorage")
      const { data } = await axios.post("/public_key", {
        key: pub_str_local,
      })
      console.log("/public_key", data)
      state.publicKeyString = pub_str_local
    } else {
      console.log(
        "Public key NOT found either on server or client. Generating key pair and send a public key to server."
      )
      const { ok, pub_str, prv_str } = await encryption.generateAndSendKeys(
        axios,
        props.myUserId,
        false
      )
      console.log("generateAndSendKeys()", ok)
      if (!ok || !pub_str || !prv_str) {
        console.error("Key generation failed")
        return false
      }
      prv_str_local.jwk = prv_str
      state.publicKeyString = pub_str
      state.privateKeyString = prv_str
    }
  }
  if (prv_str_local.jwk) {
    state.privateKeyString = prv_str_local.jwk
    const pub = await encryption.importPublicKey(state.publicKeyString)
    if (!pub) {
      console.error("Public key import failed")
      return false
    }
    const obj = JSON.parse(prv_str_local.jwk)
    const prv = await encryption.importPrivateKeyJwk(obj, pub, true)
    if (!prv) {
      console.error("Private key import failed")
      return false
    }
    state.privateKey = prv
    return true
  } else if (prv_str_local.pkcs8) {
    //Converting existing private key to JWK format.
    const prv = await encryption.importPrivateKeyPKCS(prv_str_local.pkcs8, true)
    state.privateKey = prv
    prv_str_local.jwk = await encryption.exportPrivateKeyJwk(prv)
    localStorage["virtual-poster:" + props.myUserId + ":private_key_jwk"] =
      prv_str_local.jwk
    state.privateKeyString = prv_str_local.jwk
    return true
  }
  return false
}
