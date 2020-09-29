import { computed, ComputedRef, nextTick } from "vue"

import {
  UserId,
  RoomId,
  CommentId,
  PosterId,
  ChatCommentDecrypted,
  ChatComment,
  RoomAppState,
  RoomAppProps,
  Poster,
  ChatGroup,
  ChatGroupId,
  Person,
  MySocketObject,
  CommentEncryptedEntry,
  Tree,
} from "../@types/types"
import { keyBy, compact, sortTree } from "../common/util"
import * as encryption from "./encryption"
import { AxiosStatic, AxiosInstance } from "axios"
import { MeshRoom, SfuRoom } from "skyway-js"
import { SocketIO } from "socket.io-client"
import Peer from "skyway-js"

import axiosClient from "@aspida/axios"
import api from "../api/$api"

export const sameDate = (a: number, b: number): boolean => {
  const ta = new Date(a)
  const tb = new Date(b)
  return (
    ta.getFullYear() == tb.getFullYear() &&
    ta.getMonth() == tb.getMonth() &&
    ta.getDate() == tb.getDate()
  )
}

export const formatDate = (t: number): string => {
  const t1 = new Date(t)
  const show_year = t1.getFullYear() != new Date().getFullYear()
  return (
    "" +
    (show_year ? t1.getFullYear() + "年" : "") +
    (t1.getMonth() + 1) +
    "月" +
    t1.getDate() +
    "日 (" +
    ["日", "月", "火", "水", "木", "金", "土"][t1.getDay()] +
    ")"
  )
}

async function makeEncrypted(
  to_users: UserId[],
  privateKey: CryptoKey | null,
  public_keys: { [user_id: string]: { public_key?: string } },
  encrypting: boolean,
  text: string
) {
  const comments_encrypted: CommentEncryptedEntry[] = []
  for (const u of to_users) {
    const k = public_keys[u]?.public_key
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
  return comments_encrypted
}

export async function sendComment(
  axios: AxiosStatic | AxiosInstance,
  skywayRoom: MeshRoom | SfuRoom | null,
  room_id: RoomId,
  text: string,
  encrypting: boolean,
  to_users: UserId[],
  privateKey: CryptoKey | null,
  public_keys: { [user_id: string]: { public_key?: string } },
  groupId?: ChatGroupId,
  reply_to?: CommentId
): Promise<{ ok: boolean; data?: any }> {
  const client = api(axiosClient(axios))
  if (encrypting && !privateKey) {
    console.log("Private key import failed")
    return { ok: false }
  }
  const comments_encrypted = await makeEncrypted(
    to_users,
    privateKey,
    public_keys,
    encrypting,
    text
  )
  console.log(comments_encrypted)
  if (reply_to) {
    await client.comments
      ._commentId(reply_to)
      .reply.$post({ body: comments_encrypted })
    return { ok: true }
  } else if (groupId) {
    const data = await client.maps
      ._roomId(room_id)
      .groups._groupId(groupId)
      .comments.$post({
        body: comments_encrypted,
      })
    console.log(data)
    if (skywayRoom) {
      skywayRoom.send({
        comments_encrypted,
        room_id: room_id,
      })
    } else {
      return { ok: true, data }
    }
  }

  return { ok: false }
}

export async function updateComment(
  axios: AxiosStatic | AxiosInstance,
  skywayRoom: MeshRoom | SfuRoom | null,
  room_id: RoomId,
  text: string,
  encrypting: boolean,
  to_users: UserId[],
  privateKey: CryptoKey | null,
  public_keys: { [user_id: string]: { public_key?: string } },
  editingOld: CommentId
): Promise<{ ok: boolean; data?: any }> {
  const client = api(axiosClient(axios))
  if (encrypting && !privateKey) {
    console.log("Private key import failed")
    return { ok: false }
  }
  const comments_encrypted = await makeEncrypted(
    to_users,
    privateKey,
    public_keys,
    encrypting,
    text
  )
  console.log(comments_encrypted)

  const data = await client.comments._commentId(editingOld).$patch({
    body: {
      comments: comments_encrypted,
    },
  })
  return { ok: true, data }
}

export const deleteComment = (axios: AxiosStatic | AxiosInstance) => async (
  comment_id: string
): Promise<void> => {
  try {
    const client = api(axiosClient(axios))
    const r = await client.comments._commentId(comment_id).$delete()
    console.log(r)
  } catch (e) {
    console.error(e)
  }
}

export const deletePosterComment = (
  axios: AxiosStatic | AxiosInstance
) => async (poster_id: PosterId, comment_id: CommentId): Promise<void> => {
  try {
    const client = api(axiosClient(axios))
    const r = await client.posters
      ._posterId(poster_id)
      .comments._commentId(comment_id)
      .$delete()
    console.log(r)
  } catch (e) {
    console.error(e)
  }
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
  const to_me_idx = comment.texts.findIndex(t => t.to == myUserId)
  if (to_me_idx == -1) {
    return { text: null, ok: false, error: "Does not have a message to me" }
  }
  const text_for_me = comment.texts[to_me_idx]
  // console.log("decryptIfNeeded", {
  //   public_keys: JSON.parse(JSON.stringify(public_keys)),
  // })
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

export const newComment = async (
  props: RoomAppProps,
  state: RoomAppState,
  d: ChatComment
): Promise<void> => {
  console.log("newComment", d)
  if (state.enableEncryption && !state.privateKey) {
    console.warn("Private key not set.")
    return
  }
  try {
    const r = await decryptIfNeeded(
      props.myUserId,
      state.people,
      d,
      state.privateKey
    )
    console.log("new (or updated) comment decrypt", r)
    const d2: ChatCommentDecrypted = {
      ...d,
      texts: d.texts.map(a => {
        return { to: a.to, encrypted: a.encrypted }
      }),
      text_decrypted: r.text || "（暗号化）",
    }

    const is_new_latest = !state.comments[d.id] && !d2.reply_to
    //Vue.set
    state.comments[d.id] = d2
    if (is_new_latest) {
      await nextTick(() => {
        const el = document.querySelector("#chat-local-history")
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      })
    }
  } catch (err) {
    console.error(err)
  }
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
  const client = api(axiosClient(axios))
  const to_users: UserId[] = Array.from(state.selectedUsers)
  if (to_users.length == 0) {
    return undefined
  }
  const to_groups: ChatGroupId[] = [
    ...new Set(compact(to_users.map(u => chatGroupOfUser(state).value[u]))),
  ]
  if (to_groups.length > 1) {
    // Multiple groups
    state.selectedUsers.clear()
    return undefined
  }
  if (state.batchMove) {
    state.batchMove.stop()
  }
  if (to_groups.length == 1) {
    const data = await client.maps
      ._roomId(props.room_id)
      .groups._groupId(to_groups[0])
      .join.$post()
    const group: ChatGroup | undefined = data.joinedGroup
    if (!group) {
      return undefined
    }
    const encryption_possible = group.users
      .map(uid => !!state.people[uid]?.public_key)
      .every(a => a)
    console.log("join result", data)
    return { group, encryption_possible }
  } else {
    const data = await client.maps._roomId(props.room_id).groups.$post({
      body: {
        fromUser: props.myUserId,
        toUsers: to_users,
      },
    })
    console.log(data)
    const group: ChatGroup | undefined = data.group
    if (!group) {
      return undefined
    }
    const encryption_possible = group.users
      .map(uid => !!state.people[uid]?.public_key)
      .every(a => a)
    return { group, encryption_possible }
  }
}

export const myChatGroup = (
  props: RoomAppProps,
  state: RoomAppState
): ComputedRef<ChatGroupId | null> =>
  computed((): ChatGroupId | null => {
    const g = Object.values(state.chatGroups).find(g => {
      return g.users?.indexOf(props.myUserId) >= 0
    })
    return g?.id || null
  })

export const inviteToChat = async (
  axios: AxiosStatic | AxiosInstance,
  props: RoomAppProps,
  state: RoomAppState,
  p: Person
): Promise<ChatGroup | undefined> => {
  const client = api(axiosClient(axios))
  const group_id = myChatGroup(props, state).value
  if (!group_id) {
    return undefined
  }
  const data = await client.maps
    ._roomId(props.room_id)
    .groups._groupId(group_id)
    .people.$post({ body: { userId: p.id } })

  console.log("invite result", data)
  if (data.ok) {
    return data.joinedGroup
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
  socket.on("Comment", async (d: ChatComment) => {
    console.log("Comment socket", d)
    if (d.room == props.room_id) {
      await newComment(props, state, d)
    }
  })
  socket.on("CommentRemove", (comment_id: string) => {
    console.log("CommentRemove", comment_id, state.comments[comment_id])
    //Vue.delete
    delete state.comments[comment_id]
  })

  socket.on("PosterCommentRemove", (comment_id: string) => {
    console.log(
      "PosterCommentRemove",
      comment_id,
      state.posterComments[comment_id]
    )
    //Vue.delete
    delete state.posterComments[comment_id]
  })

  socket.on("Group", d => {
    console.log("socket group", d)
    // Vue.set
    state.chatGroups[d.id] = d
    const group = myChatGroup(props, state).value
    console.log("myChatGroup", group)
    if (group) {
      if (!state.skywayRoom) {
        if (!state.peer) {
          console.log("Peer is null! Making...")

          state.peer = new Peer(props.myUserId + "-" + Date.now(), {
            key: process.env.VUE_APP_SKYWAY_API_KEY || "",
          })
        }
        console.log("Peer is: ", state.peer)
        state.peer.on("open", peerId => {
          console.log("Peer ID: ", peerId)
          state.skywayRoom = state.peer!.joinRoom(group) as MeshRoom | SfuRoom
          state.skywayRoom.on("open", () => {
            console.log("Skyway Room OPEN")
            state.skywayRoom!.on("data", data => {
              console.log(data)
            })
            state.skywayRoom!.send({
              msg: "Hello from " + props.myUserId,
            })
            if (state.skywayRoom) {
              state.skywayRoom.send({
                msg: `Thanks for adding. I'm ${props.myUserId}.`,
              })
            }
            state.skywayRoom!.on("data", data => {
              console.log("%c" + JSON.stringify(data.data), "color: purple")
            })
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
    // Vue.delete
    delete state.chatGroups[id]
    const group = myChatGroup(props, state).value
    if (!group) {
      if (state.skywayRoom) {
        state.skywayRoom.close()
        state.skywayRoom = null
      }
    }
  })

  const client = api(axiosClient(axios))

  const [comments, groups] = await Promise.all([
    client.maps._roomId(props.room_id).comments.$get(),
    client.maps._roomId(props.room_id).groups.$get(),
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
    // console.log("decryptIfNeeded() result", r)
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
      reply_to: c.reply_to,
    }
    // comment.encrypted = r.encrypted || false
    decrypted.push(comment_decr)
  }
  state.comments = keyBy(decrypted, "id")
  return true
}

export function countItems(
  vs: { reaction: string; user: UserId; id: CommentId }[]
): {
  [reaction: string]: { [user_id: string]: CommentId }
} {
  const obj = {} as {
    [reaction: string]: { [user_id: string]: CommentId }
  }
  for (const v of vs) {
    if (obj[v.reaction] == undefined) {
      obj[v.reaction] = {}
    }
    obj[v.reaction][v.user] = v.id
  }
  return obj
}

function summarizeReactions<T extends DecryptedCommentCommon>(
  tree: Tree<T>
): void {
  for (const c of tree.children) {
    summarizeReactions(c)
  }
  const ss = tree.children
    .map(c => {
      if (c.node) {
        const txt = c.node.text_decrypted
        const m = txt.match(/^\\reaction (\S+)$/)
        return m ? { reaction: m[1], user: c.node.person, id: c.node.id } : null
      } else {
        return null
      }
    })
    .filter(Boolean) as { reaction: string; user: UserId; id: CommentId }[]
  if (tree.node) {
    tree.node.reactions = countItems(ss)
    tree.children = tree.children.filter(c => {
      const txt = c.node?.text_decrypted
      const m = txt ? txt.match(/^\\reaction (\S+)$/) : null
      return !m
    })
  }
}

interface DecryptedCommentCommon {
  id: CommentId
  reply_to?: CommentId
  timestamp: number
  text_decrypted: string
  person: UserId
  reactions?: {
    [reaction: string]: { [user_id: string]: CommentId }
  }
}

export const commentTree = (
  state: RoomAppState,
  kind: "chat" | "poster"
): ComputedRef<Tree<DecryptedCommentCommon>> =>
  computed(
    (): Tree<DecryptedCommentCommon> => {
      const nodes: { [comment_id: string]: Tree<DecryptedCommentCommon> } = {}
      const findOrMakeNode = (
        c: DecryptedCommentCommon
      ): { node: Tree<DecryptedCommentCommon>; created: boolean } => {
        const node = nodes[c.id]
        if (node) {
          return { node, created: false }
        } else {
          const node: Tree<DecryptedCommentCommon> = { node: c, children: [] }
          nodes[c.id] = node
          return { node, created: true }
        }
      }
      const tree: Tree<DecryptedCommentCommon> = { children: [] }
      for (const c of Object.values(
        kind == "chat" ? state.comments : state.posterComments
      )) {
        if (!c.reply_to) {
          const { node } = findOrMakeNode(c)
          if (!tree.children.find(child => child.node?.id == c.id)) {
            tree.children.push(node)
          }
        } else {
          const p: DecryptedCommentCommon | undefined =
            kind == "chat"
              ? state.comments[c.reply_to]
              : state.posterComments[c.reply_to]
          if (p) {
            const { node: node_parent } = findOrMakeNode(p)
            const { node } = findOrMakeNode(c)
            node_parent.children.push(node)
            if (
              !p.reply_to &&
              !tree.children.find(child => child.node?.id == p.id)
            ) {
              tree.children.push(node_parent)
            }
          } else {
            console.log("reply_to parent not found. This must be a bug.")
          }
        }
      }
      summarizeReactions(tree)
      sortTree(tree, (a, b) =>
        a.timestamp < b.timestamp ? -1 : a.timestamp == b.timestamp ? 0 : 1
      )
      console.log("commentTree", tree)
      return tree
    }
  )
