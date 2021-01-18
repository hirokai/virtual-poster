import { admin } from "firebase-admin/lib/auth"
import Peer, { SfuRoom } from "skyway-js"
import { MeshRoom } from "skyway-js"
import { BatchMove } from "@/client/room/room_map_service"
import SocketIOClient from "socket.io-client"
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
  email?: string
  profiles?: {
    [key: string]: {
      last_updated: number
      content: string
      metadata?: any
    }
  }
}

export type PersonInMap = Person & {
  room: RoomId | null
  x: number
  y: number
  direction: Direction
  moving: boolean
  poster_viewing?: PosterId
  email?: string
}

// Used for map administration. This can be just reference to a future user stub with only email.
export type PersonWithMapAccess = {
  email: string
  registered?: {
    id: string
    avatar: string
    connected: boolean
    stats: PersonStat
    public_key?: string
    last_updated: number
    name: string
  }
  in_room?: {
    x: number
    y: number
    direction: Direction
    moving: boolean
    poster_viewing?: PosterId
  }
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
  poster_viewing?: PosterId | null
  stats?: PersonStat
  profiles?: {
    [key: string]: {
      last_updated: number
      content: string
      metadata?: any
    }
  }
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

export type PersonWithEmail = Person & { email: string }
export type PersonWithEmailRooms = Person & { email: string; rooms: RoomId[] }

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
  isMobile: boolean
}

type SocketMessageFromUser =
  | "Auth"
  | "Move"
  | "Subscribe"
  | "Unsubscribe"
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
  socket: SocketIOClient.Socket | MySocketObject | null
  peer: Peer | null
  skywayRoom: MeshRoom | SfuRoom | null
  people: { [index: string]: PersonInMap }
  enableEncryption: boolean
  avatarImages: { [index: string]: string }
  enableMiniMap: boolean
  posters: { [index: string]: Poster }
  posterComments: { [comment_id: string]: PosterCommentDecrypted }
  posterInputComment: string | undefined
  roomName: string
  hallMap: Cell[][]
  cols: number
  rows: number
  allow_poster_assignment: boolean
  keyQueue: { key: ArrowKey; timestamp: number } | null

  center: { x: number; y: number }

  comments: { [index: string]: ChatCommentDecrypted }
  chat_events: ChatEvent[]
  chatGroups: {
    [groupId: string]: ChatGroup
  }
  posterChatGroup: UserId[]

  botActive: boolean

  hidden: boolean

  composing: boolean
  inputFocused: boolean

  oneStepAccepted: boolean
  message: {
    text?: string
    hide: boolean
    color?: string
    timer?: number
  }

  personInfo: {
    person?: Person
    hide: boolean
    color?: string
    timer?: number
  }

  socket_active: boolean

  selectedUsers: Set<UserId>
  selectedPos: { x: number; y: number } | null
  cellOnHover: { cell?: Cell; person?: PersonInMap }

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

  reloadWaiting: boolean

  mobilePane: string

  visualStyle: VisualStyle
  darkMode: boolean

  hoverElementTimer?: number
  hoverElement?: string

  posterUploadProgress?: {
    file_type: "image/png" | "application/pdf"
    loaded: number
    total: number
  }
  visibleNotification: boolean
  notifications: NotificationEntry[]
  highlightUnread: { [comment_id: string]: boolean }
  highlightUnreadPoster: {
    [poster_id: string]: { [comment_id: string]: boolean }
  }

  playingBGM?: HTMLAudioElement

  posterContainerWidth: number
}

interface NotificationEntry {
  kind: "reply" | "new_comments" | "poster_comments"
  timestamp: number
  data?: any
}

interface NewCommentNotification extends NotificationEntry {
  kind: "new_comments"
  data: {
    count: number
  }
}

interface ReplyNotification extends NotificationEntry {
  kind: "reply"
  data: {
    user: UserId
  }
}

interface PosterCommentNotification extends NotificationEntry {
  kind: "poster_comments"
  data: {
    poster: PosterId
    count: number
  }
}

type Room = {
  id: RoomId
  numCols: number
  numRows: number
  name: string
  poster_location_count: number
  poster_count: number
  owner?: UserId
  access_code?: {
    code: string
    active: boolean
  }
  allow_poster_assignment?: boolean
  num_people_joined?: number
  num_people_with_access?: number
  num_people_active?: number
}

type AccessRule = {
  email: string
  resource?: string
  allow: boolean
}

type CellType = "grass" | "wall" | "water" | "poster" | "poster_seat" | "mud"

export type Cell = {
  id: MapCellId
  x: number
  y: number
  kind: CellType
  open: boolean
  name?: string
  poster_number?: number
  custom_image?: string
  link_url?: string
  no_initial_position?: boolean
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
  link_url: string | null
}

export interface CommentHistoryEntry {
  event: string
  timestamp: number
}

export interface ChatEventInComment extends CommentHistoryEntry {
  event: "event"
  person: UserId
  event_type:
    | "new"
    | "join"
    | "add"
    | "leave"
    | "kick"
    | "dissolve"
    | "start_overhear"
    | "end_overhear"
    | "set_private"
  event_data: Record<string, any>
}

export interface CommentEvent extends CommentHistoryEntry {
  event: "comment"
  encrypted_for_all: boolean
  id: string
  last_updated: number
  x: number
  y: number
  text_decrypted: string
  texts: {
    to: UserId
  }[]
  person: UserId
  __depth: number
  reactions?: {
    [reaction: string]: { [user_id: string]: CommentId }
  }
}

export interface DateEvent extends CommentHistoryEntry {
  event: "new_date"
  date_str: string
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
  read?: boolean
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
  read: boolean
}

export type PosterCommentDecrypted = {
  id: string
  timestamp: number
  last_updated: number
  room: RoomId
  x: number
  y: number
  poster: PosterId
  person: UserId
  text_decrypted: string
  reply_to?: CommentId
  reactions?: {
    [reaction: string]: { [user_id: string]: CommentId }
  }
  read?: boolean
}

export type ChatGroup = {
  id: ChatGroupId
  room: RoomId
  users: UserId[]
  color: string
  kind: "poster" | "people"
  last_updated: number
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

type ChatEvent = {
  kind: "event"
  room: RoomId
  group: ChatGroupId
  person: UserId
  event_type: string
  event_data?: Record<string, any>
  timestamp: number
}

export type Poster = {
  id: string
  last_updated: number
  title?: string
  author: UserId
  room: RoomId
  location: MapCellId
  file_url?: string
  poster_number: number
  x: number
  y: number
  access_log: boolean
  author_online_only: boolean
  file_size?: number
}

export type Announcement = {
  room: RoomId
  text: string
  marquee: boolean
  period: number
}

export type Contact = { id: UserId | PosterId | ChatGroupId; kind: string }

export type ArrowKey =
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowLeft"
  | "ArrowDown"
  | "h"
  | "j"
  | "k"
  | "l"
  | "y"
  | "u"
  | "b"
  | "n"

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
  room: RoomId
  direction: Direction
}

type AuthSocket = {
  jwt_hash: string
  user: UserId
}

type RoomUpdateSocketData = {
  id: RoomId
  allow_poster_assignment?: boolean
  poster_count?: number
  num_people_joined?: number
  num_people_active?: number
  num_people_with_access?: number
}

type GroupSocketData = {
  id: UserId
  room: RoomId
  users: UserId[]
  color: string
}

type TryToMoveResult = {
  room: RoomId
  user: UserId
  position?: Point
  direction?: Direction
  group_left?: ChatGroup
  group_joined?: ChatGroup
  group_removed?: ChatGroupId
  poster_left?: PosterId
}

type TypingSocketSendData = {
  room: RoomId
  user: UserId
  typing: boolean
}

type TypingSocketData = {
  room: RoomId
  user: UserId
  typing: boolean
}

type ActiveUsersSocketData = {
  users: {
    room: RoomId
    user: UserId
    active: boolean
  }[]
  count: { [room_id: string]: number }
}

export type ChatEventSocketData = {
  group_id: ChatGroupId
  event_type:
    | "new"
    | "join"
    | "add"
    | "leave"
    | "kick"
    | "dissolve"
    | "start_overhear"
    | "end_overhear"
    | "set_private"
  event_data?: any
}

export type AppNotification =
  | "Announce"
  | "Room"
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
  | "ChatEvent"
  | "PosterComment"
  | "PosterCommentRemove"
  | "PosterReset"
  | "Poster"
  | "PosterRemove"
  | "Notification"
  | "MapReset"
  | "ActiveUsers"
  | "ChatTyping"
  | "MoveRequest"
  | "AppReload"

interface Emitter {
  emit(msg: AppNotification, data?: any): void
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

type VisualStyle = "default" | "abstract" | "monochrome" | "abstract_monochrome"
