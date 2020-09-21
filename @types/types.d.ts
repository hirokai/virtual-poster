import { admin } from "firebase-admin/lib/auth"
import Peer, { SfuRoom } from "skyway-js"
import { MeshRoom } from "skyway-js"
import { BatchMove } from "../client/room_map_service"
export type Point = { x: number; y: number }

export type Direction = "none" | "up" | "left" | "right" | "down"

export type PersonPos = {
  x: number
  y: number
  direction: Direction
  room: RoomId
  user: UserId
}

export type Person = {
  id: string
  last_updated: number
  name: string
  avatar?: string
  connected?: boolean
  stats: PersonStat
  public_key?: string
}

export type PersonInMap = Person & {
  room: RoomId | null
  x: number
  y: number
  direction: Direction
  moving: boolean
}

export type PersonUpdate = {
  id: string
  last_updated: number
  room?: RoomId
  x?: number
  y?: number
  moving?: boolean
  direction?: Direction
  name?: string
  avatar?: string
  connected?: boolean
  stats?: PersonStat
  public_key?: string
}

export type PersonRDB = {
  id: UserId
  last_updated: number
  name: string
  avatar?: string
  email?: string
  role: "user" | "admin"
}

export type PersonWithEmail = Person & { email?: string }
export type PersonWithEmailRooms = Person & { email?: string; rooms: RoomId[] }

export type PersonStat = {
  walking_steps: number
  people_encountered: string[]
  chat_count: number
  chat_char_count: number
}

type RoomAppProps = {
  myUserId: UserId
  room_id: RoomId
  debug_as?: string
  debug_token?: string
  jwt_hash_initial?: string
}

type SocketMessageFromUser =
  | "Auth"
  | "Move"
  | "Subscribe"
  | "Active"
  | "ChatTyping"
  | "Direction"

declare class MySocketObject {
  listeners: Record<string, ((data: any) => void)[]>
  ws: WebSocket
  constructor(url: string)
  on(message: string, handler: (data: any) => void): void
  emit(message: SocketMessageFromUser, data: any): void
  connect(url: string): WebSocket
}

type Tree<T> = {
  node?: T
  children: Tree<T>[]
}

type RoomAppState = {
  socket: SocketIO.Socket | MySocketObject | null
  peer: Peer | null
  skywayRoom: MeshRoom | SfuRoom | null
  people: { [index: string]: PersonInMap }
  enableEncryption: boolean
  avatarImages: { [index: string]: string }
  enableMiniMap: boolean
  posters: { [index: string]: Poster }
  posterComments: { [comment_id: string]: ChatCommentDecrypted }
  posterInputComment: string | undefined
  hallMap: Cell[][]
  cols: number
  rows: number
  keyQueue: { key: ArrowKey; timestamp: number } | null

  center: { x: number; y: number }

  comments: { [index: string]: ChatCommentDecrypted }
  chatGroups: {
    [groupId: string]: ChatGroup
  }
  posterChatGroup: UserId[]

  posterLooking: boolean

  botActive: boolean

  hidden: boolean

  composing: boolean
  inputFocused: boolean

  oneStepAccepted: boolean
  message: {
    text?: string
    hide: boolean
    timer?: number
  }

  selectedUsers: Set<UserId>
  selectedPos: { x: number; y: number } | null

  editingOld: string | null

  connectedUsers: string[]

  announcement: {
    text: string
    marquee: boolean
    period: number
  } | null

  move_emitted: number | null
  batchMove?: BatchMove

  people_typing: { [index: string]: boolean }

  encryption_possible_in_chat: boolean

  privateKeyString: string | null
  privateKey: CryptoKey | null
  publicKeyString: string | null
  publicKey: CryptoKey | null
}

type Room = {
  id: RoomId
  numCols: number
  numRows: number
  name: string
  poster_location_count: number
  poster_count: number
}

type CellType = "grass" | "wall" | "water" | "poster" | "poster_seat" | "mud"

export type Cell = {
  id: MapCellId
  x: number
  y: number
  kind: CellType
  name?: string
  open: boolean
  poster_number?: number
  custom_image?: string
}

type PosterCell = Cell & {
  kind: "poster"
}

type MapCellRDB = {
  id: MapCellId
  room: RoomId
  x: number
  y: number
  kind: CellType
  poster_number: number | null
  custom_image: string | null
}

export type ChatComment = {
  id: string
  timestamp: number
  last_updated: number
  room: RoomId
  x: number
  y: number
  texts: CommentEncryptedEntry[]
  person: UserId
  kind: "poster" | "person"
  reply_to?: CommentId
}

type CommentEncryptedEntry = {
  encrypted: boolean
  to: UserId | PosterId
  text: string
}

export type ChatCommentDecrypted = {
  id: string
  timestamp: number
  last_updated: number
  room: RoomId
  x: number
  y: number
  text_decrypted: string
  texts: {
    encrypted: boolean
    to: UserId | PosterId
  }[]
  person: UserId
  kind: "poster" | "person"
  reply_to?: CommentId
  reactions?: {
    [reaction: string]: { [user_id: string]: CommentId }
  }
}

export type ChatGroup = {
  id: ChatGroupId
  room: RoomId
  users: UserId[]
  color: string
  kind: "poster" | "people"
}

export type ChatGroupRDB = {
  id: ChatGroupId
  room: RoomId
  name?: string
  last_updated: string
  location?: MapCellId
  color?: string
  users?: string
  kind: "poster" | "people"
}

export type Poster = {
  id: string
  last_updated: number
  title?: string
  author: UserId
  room: RoomId
  location: MapCellId
  file_url: string
  poster_number?: number
  x: number
  y: number
}

export type Announcement = {
  room: RoomId
  text: string
  marquee: boolean
  period: number
}

export type Contact = { id: UserId | PosterId | ChatGroupId; kind: string }

export type ArrowKey = "ArrowRight" | "ArrowUp" | "ArrowLeft" | "ArrowDown"

type PostIdTokenResponse = {
  ok: boolean
  updated: boolean
  token_actual?: string
  error?: string
  user_id?: UserId
  name?: string
  admin?: boolean
  public_key?: string
  debug_token?: string
  registered?: "registered" | "can_register" | "should_verify"
}

type RegisterResponse = {
  ok: boolean
  user?: PersonWithEmail
  error?: string
}

export type MapEnterResponse = {
  ok: boolean
  status?: string
  public_key?: string
  socket_url?: string
  socket_protocol?: "Socket.IO" | "WebSocket"
}

export type MapRoomResponse = {
  cells: Cell[][]
  numCols: number
  numRows: number
}

export type ChatGroupsResponse = {
  [groupId: string]: { users: UserId[]; color: string }
}

type OpType =
  | "move"
  | "active"
  | "announce"
  | "disconnect"
  | "direction"
  | "comment.new"
  | "comment.update"
  | "comment.delete"
  | "groups.join"
  | "groups.leave"

export interface UserOperationLog {
  userId?: UserId
  operation: OpType
  data: any
}

type ChatGroupId = string
type UserId = string
type CommentId = string
type PosterId = string
type RoomId = string
type MapCellId = string

declare global {
  namespace Express {
    export interface Request {
      decoded?: admin.auth.DecodedIdToken
      requester?: string
      requester_type?: "admin" | "user" | null
    }
  }
}

type MyDecodedIdToken = {
  email: string
  exp: number
  iss: string
}

export type PosDir = {
  x: number
  y: number
  direction: Direction
}

type MoveErrorSocketData = {
  pos?: PosDir
  user_id: UserId
  error: string
}

type MoveSocketData = {
  x: number
  y: number
  room: RoomId
  user: UserId
  token?: string
  debug_as?: UserId
}

type DirectionSendSocket = {
  user: UserId
  room: RoomId
  direction: Direction
  token: string
  debug_as?: UserId
}

type AuthSocket = {
  jwt_hash: string
  user: UserId
}

type GroupSocketData = {
  id: UserId
  room: RoomId
  users: UserId[]
  color: string
}

type TryToMoveResult = {
  position?: Point
  direction?: Direction
  group_left?: ChatGroup
  group_joined?: ChatGroup
  group_removed?: ChatGroupId
}

type TypingSocketSendData = {
  room: RoomId
  user: UserId
  typing: boolean
  token?: string
  debug_as?: UserId
}

type TypingSocketData = {
  room: RoomId
  user: UserId
  typing: boolean
}

type ActiveUsersSocketData = {
  room: RoomId
  user: UserId
  active: boolean
}[]

type EmitCommand =
  | "Announce"
  | "Person"
  | "PersonNew"
  | "PersonUpdate"
  | "PersonRemove"
  | "AuthError"
  | "Moved"
  | "MoveError"
  | "Group"
  | "GroupRemove"
  | "Comment"
  | "CommentRemove"
  | "PosterComment"
  | "PosterCommentRemove"
  | "PosterReset"
  | "Poster"
  | "PosterRemove"
  | "MapReset"
  | "ActiveUsers"
  | "ChatTyping"
  | "MoveRequest"

interface Emitter {
  emit(msg: EmitCommand, data?: any): void
  to(channel: string): this
}
// | SocketIO.Socket
// | SocketIO.Server
// | SocketIO.Namespace
// | SocketIOEmitter
// | HTTPEmitter

type HttpMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "DELETE"
  | "PUT"
  | "OPTIONS"
  | "PATCH"
  | "LINK"
  | "UNLINK"
