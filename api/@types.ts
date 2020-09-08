/* eslint-disable */
export type debug_token = {
  debug_token?: string
}

export type debug_as = {
  debug_as?: string
}

export type Person = {
  id: string
  name: string
  last_updated: number
  public_key?: string
}

export type PersonWithEmail = {
  id: string
  name: string
  last_updated: number
  email?: string
  public_key?: string
  stats: PersonStat
}

export type Cell = {
  id: string
  x: number
  y: number
  kind: 'grass' | 'wall' | 'water' | 'poster' | 'poster_seat' | 'mud'
  open: boolean
}

export type ChatGroup = {
  id: ChatGroupId
  room: RoomId
  users: UserId[]
  color: string
  kind: 'poster' | 'people'
}

export type UserId = string

export type PosterId = string

export type ChatGroupId = string

export type RoomId = string

export type ChatCommentDecrypted = {
  id: string
  timestamp: number
  last_updated: number
  room: RoomId
  x: number
  y: number
  encrypted: boolean[]
  person: UserId
  text_decrypted: string
  texts: {
    encrypted: boolean

    to: UserId | PosterId
  }[]
  kind: 'poster' | 'person'
}

export type CommentEncrypted = {
  to: string
  text: string
  encrypted: boolean
}

export type ChatComment = {
  id: string
  timestamp: number
  last_updated: number
  room: RoomId
  x: number
  y: number
  person: UserId
  kind: 'poster' | 'person'
  texts: CommentEncrypted[]
}

export type Poster = {
  id: PosterId
  last_updated: number
  title?: string
  author: UserId
  room: RoomId
  location: string
  poster_number?: number
  x: number
  y: number
  file_url: string
}

export type PersonInMap = {
  id: string
  room: string
  x: number
  y: number
  direction: 'up' | 'down' | 'left' | 'right' | 'none'
  name: string
  last_updated: number
  moving: boolean
  stats: PersonStat
}

export type PersonStat = {
  walking_steps: number
  people_encountered: string[]
  chat_count: number
  chat_char_count: number
}
