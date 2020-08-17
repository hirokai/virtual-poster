import { admin } from "firebase-admin/lib/auth"
import Peer, { SfuRoom } from "skyway-js"
import { MeshRoom } from "skyway-js"
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
  room: RoomId | null
  x: number
  y: number
  direction: Direction
  moving: boolean
  name: string
  avatar?: string
  connected?: boolean
  stats: PersonStat
  public_key?: string
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
  idToken: string
}

declare class MySocketObject {
  listeners: Record<string, ((data: any) => void)[]>
  ws: WebSocket
  constructor (url: string)
  on (message: string, handler: (data: any) => void): void
  emit (message: string, data: any): void
  connect (url: string): WebSocket
}

type RoomAppState = {
  socket: SocketIO.Socket | MySocketObject | null
  peer: Peer
  skywayRoom: MeshRoom | SfuRoom | null
  people: { [index: string]: Person }
  enableEncryption: boolean
  avatarImages: { [index: string]: string }
  enableMiniMap: boolean
  posters: { [index: string]: Poster }
  posterComments: { [comment_id: string]: ChatComment }
  posterInputComment: string | undefined
  hallMap: Cell[][]
  cols: number
  rows: number
  keyQueue: { key: ArrowKey; timestamp: number } | null

  center: { x: number; y: number }

  comments: { [index: string]: ChatComment }
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
    timer?: number
  }

  selectedUsers: Set<UserId>
  selectedPos: { x: number; y: number } | null
  chatAfterMove: UserId | PosterId | null

  editingOld: string | null

  connectedUsers: string[]

  announcement: {
    text: string
    marquee: boolean
    period: number
  } | null

  move_emitted: number | null
  batchMovePoints: Point[]
  batchMoveTimer: NodeJS.Timeout | null
  liveMapChangedAfterMove: boolean

  people_typing: { [index: string]: boolean }

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
  encrypted: boolean[]
  person: UserId
  text: string
  to: (UserId | PosterId)[]
  kind: "poster" | "person"
}

export type ChatCommentEncrypted = {
  id: string
  timestamp: number
  last_updated: number
  room: RoomId
  x: number
  y: number
  texts: CommentEncrypted[]
  person: UserId
  kind: "poster" | "person"
}

type CommentEncrypted = {
  to_user: UserId
  text: string
  encrypted: boolean
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

export type MapEnterResponse = {
  ok: boolean
  status?: string
  public_key?: string
  socket_url?: string
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
  token: string
  debug_as?: UserId
}

type DirectionSendSocket = {
  user: UserId
  room: RoomId
  direction: Direction
  token: string
  debug_as?: UserId
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
  token: string
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
