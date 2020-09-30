import {
  Cell,
  Point,
  Person,
  Poster,
  PersonInMap,
  ChatGroup,
  UserId,
  ChatGroupId,
  Direction,
  RoomId,
  PersonPos,
  Tree,
  AppNotification,
} from "@/@types/types"
import fromPairs from "lodash/fromPairs"
import minBy from "lodash/minBy"
import groupBy from "lodash/groupBy"

import * as bunyan from "bunyan"
const log = bunyan.createLogger({ name: "util", src: true, level: 1 })

// Native
function sortByHelper<T>(keyFunc: (T) => number) {
  return (a: T, b: T) =>
    keyFunc(a) > keyFunc(b) ? 1 : keyFunc(b) > keyFunc(a) ? -1 : 0
}

// The native sort modifies the array in place. `_.orderBy` and `_.sortBy` do not, so we use `.concat()` to
// copy the array, then sort.
export function sortBy<T>(vs: T[], keyFunc: (T) => number): T[] {
  return vs.concat().sort(sortByHelper(keyFunc))
}

export function chunk<T>(input, size: number): T[][] {
  return input.reduce((arr, item, idx) => {
    return idx % size === 0
      ? [...arr, [item]]
      : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]]
  }, [])
}

export const randomInt = (a = 1, b = 0): number => {
  const lower = Math.ceil(Math.min(a, b))
  const upper = Math.floor(Math.max(a, b))
  return Math.floor(lower + Math.random() * (upper - lower))
}

export function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, i) => i + from)
}

export function compact<T>(vs: T[]): T[] {
  return vs.filter(Boolean)
}

export function intersection<T>(vss: T[][]): T[] {
  return vss.reduce(function(a, b) {
    return a.filter(function(value) {
      return b.includes(value)
    })
  })
}

export function mapValues<A, B>(
  vs: { [index: string]: A },
  f: (A) => B
): { [index: string]: B } {
  const res = {} as { [index: string]: B }
  for (const k in vs) {
    res[k] = f(vs[k])
  }
  return res
}

export const mkKey = (room_id: RoomId, x: number, y: number): string => {
  return room_id + ":" + x + "." + y
}

export const getPos = (
  s: string
): { room: RoomId; x: number; y: number } | null => {
  try {
    const [room, xy] = s.split(":")
    const [x, y] = xy.split(".").map(parseInt)
    return { x, y, room }
  } catch {
    return null
  }
}

export function isOpenCell(c: Cell) {
  return c.kind == "grass" || c.kind == "poster_seat" || c.kind == "mud"
}

export function encodeMoved(d: PersonPos, room = false): string {
  const dir = d.direction[0]
  return (room
    ? [d.room, d.user, d.x, d.y, dir]
    : [d.user, d.x, d.y, dir]
  ).join(",")
}

export function decodeMoved(s: string, roomDefault?: string): PersonPos | null {
  if (roomDefault) {
    const [user, x_, y_, dir_] = s.split(",")
    const direction: Direction | undefined = {
      u: "up",
      d: "down",
      l: "left",
      r: "right",
      n: "none",
    }[dir_]
    const [x, y] = [x_, y_].map(s => parseInt(s))
    if (!direction || isNaN(x) || isNaN(y)) {
      return null
    } else {
      return {
        room: roomDefault,
        user,
        x,
        y,
        direction: direction as Direction,
      }
    }
  } else {
    const [room, user, x_, y_, dir_] = s.split(",")
    const direction: Direction | undefined = {
      u: "up",
      d: "down",
      l: "left",
      r: "right",
      n: "none",
    }[dir_]
    const [x, y] = [x_, y_].map(s => parseInt(s))
    if (!direction || isNaN(x) || isNaN(y)) {
      return null
    } else {
      return { room, user, x, y, direction: direction as Direction }
    }
  }
}

export function isUserId(s: string): boolean {
  return s[0] == "U"
}

export function isPosterId(s: string): boolean {
  return s[0] == "P"
}
// https://stackoverflow.com/questions/21900713/finding-all-connected-components-of-an-undirected-graph
// Breadth First Search function
// v is the source vertex
// all_pairs is the input array, which contains length 2 arrays
// visited is a dictionary for keeping track of whether a node is visited
function bfs(v: string, all_pairs, visited) {
  const q: string[] = []
  const current_group: string[] = []
  let pair: string[]
  const length_all_pairs = all_pairs.length
  q.push(v)
  while (q.length > 0) {
    v = q.shift() || ""
    if (!visited[v]) {
      visited[v] = true
      current_group.push(v)
      // go through the input array to find vertices that are
      // directly adjacent to the current vertex, and put them
      // onto the queue
      for (let i = 0; i < length_all_pairs; i += 1) {
        pair = all_pairs[i]
        if (pair[0] === v && !visited[pair[1]]) {
          q.push(pair[1])
        } else if (pair[1] === v && !visited[pair[0]]) {
          q.push(pair[0])
        }
      }
    }
  }
  // return everything in the current "group"
  return current_group
}

export function findPairs(
  peopleMap: (UserId | null)[][],
  user_id: string | null,
  include_me: boolean,
  include_solo: boolean
): UserId[][] {
  const pairs: UserId[][] = []
  if (peopleMap.length == 0) {
    return []
  }
  const numRows = peopleMap.length
  const numCols = peopleMap[0].length
  for (let y = 1; y < numRows; y++) {
    for (let x = 1; x < numCols; x++) {
      const a = peopleMap[y][x]
      if (a && (include_me || a != user_id)) {
        if (include_solo) {
          pairs.push([a, a])
        }
        const b = peopleMap[y][x - 1]
        if (b && (include_me || b != user_id)) {
          if (include_solo) {
            pairs.push([b, b])
          }
          pairs.push([a, b])
        }
        const c = peopleMap[y - 1][x]
        if (c && (include_me || c != user_id)) {
          if (include_solo) {
            pairs.push([c, c])
          }
          pairs.push([a, c])
        }
      }
    }
  }
  return pairs
}

export function findGroups(pairs: string[][]): string[][] {
  const groups: string[][] = []
  let u: string, v: string, src: string | null, current_pair: string[]
  const visited: { [index: string]: boolean } = {}

  // main loop - find any unvisited vertex from the input array and
  // treat it as the source, then perform a breadth first search from
  // it. All vertices visited from this search belong to the same group
  for (let i = 0, length = pairs.length; i < length; i += 1) {
    current_pair = pairs[i]
    u = current_pair[0]
    v = current_pair[1]
    src = null
    if (!visited[u]) {
      src = u
    } else if (!visited[v]) {
      src = v
    }
    if (src) {
      // there is an unvisited vertex in this pair.
      // perform a breadth first search, and push the resulting
      // group onto the list of all groups
      groups.push(bfs(src, pairs, visited))
    }
  }
  return groups
}

export function mkRouteGraph(
  user_id: string,
  staticMap: Cell[][],
  people: PersonInMap[],
  range_?: { xmin: number; xmax: number; ymin: number; ymax: number }
): { vertices: string[]; edges: { a: string; b: string; cost: number }[] } {
  const rows = staticMap.length
  const cols = staticMap[0].length
  const range = range_ || { xmin: 0, ymin: 0, xmax: cols - 1, ymax: rows - 1 }
  console.debug("range", range)
  const f = (c: { x: number; y: number }) => "" + c.x + "," + c.y
  const vertices: string[] = []
  const edges: { a: string; b: string; cost: number }[] = []
  const people_map: Set<string> = new Set()
  for (const p of people) {
    if (p.id != user_id && p.x) {
      people_map.add("" + p.x + "." + p.y)
    }
  }
  for (
    let y = Math.max(0, range.ymin);
    y <= Math.min(rows - 1, range.ymax);
    y++
  ) {
    for (
      let x = Math.max(0, range.xmin);
      x <= Math.min(cols - 1, range.xmax);
      x++
    ) {
      const a = staticMap[y][x]
      if (
        a &&
        ["mud", "grass", "poster_seat"].includes(a.kind) &&
        !people_map.has("" + x + "." + y)
      ) {
        vertices.push(f(a))
        const ds = [
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, 0],
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]
        ds.filter(d => {
          const x = a.x + d[0]
          const y = a.y + d[1]
          if (
            !(
              range.xmin <= x &&
              x <= range.xmax &&
              range.ymin <= y &&
              y <= range.ymax
            )
          ) {
            return false
          }
          if (!staticMap[y] || !staticMap[y][x]) {
            // log.debug("Null cell", user_id, x, y, liveMap)
            return false
          }
          const c = staticMap[y][x]
          return (
            ["mud", "grass", "poster_seat"].includes(c.kind) &&
            !people_map.has("" + x + "." + y)
          )
        }).forEach(d => {
          const x = a.x + d[0]
          const y = a.y + d[1]
          const ca = staticMap[a.y][a.x]
          const cb = staticMap[y][x]
          const cost =
            ca.kind == "poster_seat" || cb.kind == "poster_seat"
              ? 10
              : d[0] == 0 || d[1] == 0
              ? 1
              : 3
          edges.push({
            a: f(a),
            b: f({ x, y }),
            cost,
          })
          edges.push({
            a: f({ x, y }),
            b: f(a),
            cost,
          })
        })
      }
    }
  }
  return { vertices, edges }
}

export function findRoute(
  user_id: string,
  staticMap: Cell[][],
  people: PersonInMap[],
  from: Point,
  to: Point,
  searchMargin?: number
): Point[] | null {
  try {
    const f = (c: { x: number; y: number }) => "" + c.x + "," + c.y
    const f_inv = (s: string) => {
      const ts = s.split(",")
      return { x: parseInt(ts[0]), y: parseInt(ts[1]) }
    }
    const s = f(from)
    const searchRange = searchMargin
      ? {
          xmin: Math.min(from.x, to.x) - searchMargin,
          xmax: Math.max(from.x, to.x) + searchMargin,
          ymin: Math.min(from.y, to.y) - searchMargin,
          ymax: Math.max(from.y, to.y) + searchMargin,
        }
      : undefined
    const { vertices, edges } = mkRouteGraph(
      user_id,
      staticMap,
      people,
      searchRange
    )
    const edges_all: {
      [index: string]: { to: string; cost: number }[]
    } = mapValues(groupBy(edges, "a"), vs => {
      return vs.map(v => {
        return { to: v.b, cost: v.cost }
      })
    })
    const d: { [index: string]: number } = fromPairs(
      vertices.map(v => (v == s ? [v, 0] : [v, 1000000]))
    )
    d[s] = 0
    const prev: { [index: string]: string } = {}
    const Q: { [index: string]: boolean } = fromPairs(
      vertices.map(v => [v, true])
    )

    while (Object.keys(Q).length > 0) {
      const u = minBy(Object.keys(Q), v => d[v])
      if (u) {
        delete Q[u]
        const es = edges_all[u]
        if (es) {
          es.forEach(e => {
            const v = e.to
            if (d[v] > d[u] + e.cost) {
              d[v] = d[u] + e.cost
              prev[v] = u
            }
          })
        } else {
          // log.debug(`Edges from ${u} not found`)
        }
      }
    }
    const ps: Point[] = []
    let p: string = f(to)
    let count = 0
    while (p != f(from)) {
      ps.unshift(f_inv(p))
      p = prev[p]
      if (!p) {
        console.warn("Link tracing failed.")
        return null
      }
      count += 1
      if (count >= 10000) {
        console.warn("Path is too long. Aborting.")
        return null
      }
    }
    ps.unshift(from)
    return ps
  } catch (e) {
    log.error(e)
    return null
  }
}

export function lookingAt(me: PersonInMap): Point | null {
  let [x, y] = [0, 0]
  if (me.x == undefined || me.y == undefined || me.direction == undefined) {
    return null
  }
  if (me.direction == "left") {
    x = me.x - 1
    y = me.y
  } else if (me.direction == "right") {
    x = me.x + 1
    y = me.y
  } else if (me.direction == "up") {
    x = me.x
    y = me.y - 1
  } else if (me.direction == "down") {
    x = me.x
    y = me.y + 1
  }
  return { x, y }
}

export const personAt = (
  people: { [user_id: string]: PersonInMap },
  pos: Point
): PersonInMap | undefined => {
  return Object.values(people).find(p => {
    return p.x == pos.x && p.y == pos.y
  })
}

export const posterAt = (
  posters: { [id: string]: Poster },
  pos: Point
): Poster | undefined => {
  return Object.values(posters).find(p => {
    return p.x == pos.x && p.y == pos.y
  })
}

export function getGroupIdOfUser(
  user_id: UserId,
  groups: ChatGroup[]
): ChatGroupId | undefined {
  return groups.find(g => g.users.indexOf(user_id) != -1)?.id
}

export function findAdjacentChatGroup(
  people: { [index: string]: PersonInMap },
  groups: { [index: string]: ChatGroup },
  me: PersonInMap
): { id: UserId; kind: "person" }[] {
  const la = lookingAt(me)
  const la_person = la ? personAt(people, la) : null
  if (la_person) {
    const group_id = getGroupIdOfUser(me.id, Object.values(groups))
    if (group_id) {
      const peopleInSameGroup: UserId[] = groups[group_id].users
      return peopleInSameGroup.map(pid => {
        return { id: pid, kind: "person" }
      })
    } else {
      return []
    }
  }
  return []
}

export function getClosestAdjacentPoints(myself: Point, p: Point): Point[] {
  const ds1 = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]
  const ds2 = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]
  const ds = sortBy(ds1, d => {
    return (p.x + d[0] - myself.x) ** 2 + (p.y + d[1] - myself.y) ** 2
  }).concat(
    sortBy(ds2, d => {
      return (p.x + d[0] - myself.x) ** 2 + (p.y + d[1] - myself.y) ** 2
    })
  )
  return ds.map(d => {
    return { x: p.x + d[0], y: p.y + d[1] }
  })
}

export function isAdjacent(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1
}

export function inRange(v: number, min: number, max: number): number {
  return Math.max(Math.min(v, max), min)
}

export function calcDirection(from: Point, to: Point): Direction {
  if (from.x == to.x) {
    if (from.y > to.y) {
      return "up"
    } else if (from.y < to.y) {
      return "down"
    } else {
      return "none"
    }
  } else if (from.x > to.x) {
    return "left"
  } else {
    return "right"
  }
}

export function allPointsConnected(points: Point[]): boolean {
  log.debug("allPointsConnected", points)
  function find_adjacent(a: Point, ps: Point[]): Point | undefined {
    for (const p1 of ps) {
      if (
        (p1.x != a.x || p1.y != a.y) && // Not self
        Math.abs(p1.x - a.x) <= 1 &&
        Math.abs(p1.y - a.y) <= 1
      ) {
        return p1
      }
    }
    return undefined
  }
  for (const p of points) {
    if (!find_adjacent(p, points)) {
      return false
    }
  }
  return true
}

export function keyBy<T>(array: T[], key: string): { [index: string]: T } {
  return (array || []).reduce((r, x) => ({ ...r, [key ? x[key] : x]: x }), {})
}

export function difference<T>(a: T[], b: T[]): T[] {
  return [a, b].reduce((a, b) => a.filter(c => !b.includes(c)))
}

export function flatten<T>(vs: T[][]): T[] {
  return vs.reduce((a, b) => a.concat(b), [])
}

export function pickBy<T>(object: {
  [index: string]: T | undefined | null
}): { [index: string]: T } {
  const obj = {}
  for (const key in object) {
    if (object[key]) {
      obj[key] = object[key]
    }
  }
  return obj
}

export function flattenTree<T>(
  root: Tree<T>,
  depth = 0
): (T & { __depth: number })[] {
  return (root.node ? [{ ...root.node, __depth: depth }] : []).concat(
    root.children.map(c => flattenTree<T>(c, depth + 1)).flat()
  )
}

export function sortTree<T>(tree: Tree<T>, cmp: (a: T, b: T) => number): void {
  for (const c of tree.children) {
    sortTree(c, cmp)
  }
  tree.children.sort((a, b) =>
    !a.node ? -1 : !b.node ? 1 : cmp(a.node, b.node)
  )
}

// On REST server, encode data for Rust WS server
export function encodeAppNotificationData(
  cmd: AppNotification,
  data?: any
): any {
  if (cmd == "Group") {
    return { type: cmd, group: data }
  } else if (cmd == "GroupRemove") {
    return { type: cmd, id: data }
  } else if (cmd == "Comment") {
    return { type: cmd, comment: data }
  } else if (cmd == "CommentRemove") {
    return { type: cmd, id: data }
  } else if (cmd == "MoveRequest") {
    return { type: cmd, to_poster: data.to_poster }
  } else if (cmd == "PersonUpdate") {
    return { type: cmd, person: data }
  } else if (cmd == "Poster") {
    return { type: cmd, poster: data }
  } else if (cmd == "PosterRemove") {
    return { type: cmd, id: data }
  } else if (cmd == "PosterComment") {
    return { type: cmd, comment: data }
  } else if (cmd == "PosterCommentRemove") {
    return { type: cmd, id: data }
  } else if (cmd == "ActiveUsers") {
    return { type: cmd, data: data }
  } else if (cmd == "PersonNew") {
    return { type: cmd, person: data }
  } else if (cmd == "Person") {
    return { type: cmd, person: data }
  } else if (cmd == "PersonRemove") {
    return { type: cmd, id: data }
  } else if (cmd == "ChatTyping") {
    return { type: cmd, ...data }
  } else {
    return null
  }
}

// On client, decode data from Rust WS server
export function decodeNotificationData(
  cmd: AppNotification,
  data?: any
): any | null {
  if (cmd == "Group") {
    return data.group
  } else if (cmd == "GroupRemove") {
    return data.id
  } else if (cmd == "Comment") {
    return data.comment
  } else if (cmd == "CommentRemove") {
    return data.id
  } else if (cmd == "Moved") {
    return data.data
  } else if (cmd == "MoveRequest") {
    return { to_poster: data.to_poster }
  } else if (cmd == "PersonUpdate") {
    return data.person
  } else if (cmd == "Poster") {
    return data.poster
  } else if (cmd == "PosterRemove") {
    return data.id
  } else if (cmd == "PosterComment") {
    return data.comment
  } else if (cmd == "PosterCommentRemove") {
    return data.id
  } else if (cmd == "ActiveUsers") {
    return data.data
  } else if (cmd == "PersonNew") {
    return data.person
  } else if (cmd == "Person") {
    return data.person
  } else if (cmd == "PersonRemove") {
    return data.id
  } else if (cmd == "ChatTyping") {
    console.log("Paraing ChatTyping", data)
    return { room: data.room, user: data.user, typing: data.typing }
  } else {
    return null
  }
}
