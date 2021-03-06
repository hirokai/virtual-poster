import { UserId, PersonWithEmail, VisualStyle } from "../@types/types"

//https://stackoverflow.com/questions/28905965/textarea-how-to-count-wrapped-lines-rows
/** @type {HTMLTextAreaElement} */
let _buffer

/**
 * Returns the number of lines in a textarea, including wrapped lines.
 *
 * __NOTE__:
 * [textarea] should have an integer line height to avoid rounding errors.
 */
export function countLines(textarea: HTMLTextAreaElement): number {
  if (_buffer == null) {
    _buffer = document.createElement("textarea")
    _buffer.style.border = "none"
    _buffer.style.height = "0"
    _buffer.style.overflow = "hidden"
    _buffer.style.padding = "0"
    _buffer.style.position = "absolute"
    _buffer.style.left = "0"
    _buffer.style.top = "0"
    _buffer.style.zIndex = "-1"
    document.body.appendChild(_buffer)
  }

  const cs = window.getComputedStyle(textarea)
  const pl = parseInt(cs.paddingLeft)
  const pr = parseInt(cs.paddingRight)
  let lh = parseInt(cs.lineHeight)

  // [cs.lineHeight] may return 'normal', which means line height = font size.
  if (isNaN(lh)) lh = parseInt(cs.fontSize)

  // Copy content width.
  _buffer.style.width = textarea.clientWidth - pl - pr + "px"

  // Copy text properties.
  _buffer.style.font = cs.font
  _buffer.style.letterSpacing = cs.letterSpacing
  _buffer.style.whiteSpace = cs.whiteSpace
  _buffer.style.wordBreak = cs.wordBreak
  _buffer.style.wordSpacing = cs.wordSpacing
  _buffer.style.wordWrap = cs.wordWrap

  // Copy value.
  _buffer.value = textarea.value

  let result = Math.floor(_buffer.scrollHeight / lh)
  if (result == 0) result = 1
  return result
}

export function setUserInfo(
  user_id: UserId,
  email: string,
  admin: boolean
): void {
  localStorage["virtual-poster:user_id"] = user_id
  localStorage["virtual-poster:email"] = email
  localStorage["virtual-poster:admin"] = admin ? "1" : "0"
}

export function deleteUserInfoOnLogout(): void {
  localStorage.removeItem("virtual-poster:user_id")
  localStorage.removeItem("virtual-poster:email")
  localStorage.removeItem("virtual-poster:name")
  localStorage.removeItem("virtual-poster:admin")
  localStorage.removeItem("virtual-poster:jwt_hash")
}

export function formatTime(
  timestamp: number,
  locale: "ja" | "en" = "ja"
): string {
  const t = new Date(timestamp)
  const now = new Date()
  const is_today =
    t.getFullYear() == now.getFullYear() &&
    t.getMonth() == now.getMonth() &&
    t.getDate() == now.getDate()

  return (
    (!is_today ? "" + (t.getMonth() + 1) + "/" + t.getDate() + " " : "") +
    t.getHours().toString() +
    ":" +
    t
      .getMinutes()
      .toString()
      .padStart(2, "0") +
    ":" +
    t
      .getSeconds()
      .toString()
      .padStart(2, "0")
  )
}

export function truncateComment(c: string): string {
  if (c.length <= 100) {
    return c
  } else {
    return c.slice(0, 80) + "..."
  }
}

export const findUser = (
  people: { [user_id: string]: PersonWithEmail },
  txt: string
): UserId | undefined => {
  let user: PersonWithEmail | undefined = undefined
  user = people[txt]
  if (user) {
    return user.id
  }
  user = Object.values(people).find(p => p.email == txt)
  if (user) {
    return user.id
  }
  user = Object.values(people).find(p => p.name == txt)
  if (user) {
    return user.id
  }
  return undefined
}

export const findUser2 = (
  people: { id?: UserId; email: string; name?: string }[],
  txt: string
): string | undefined => {
  let user:
    | { id?: UserId; email: string; name?: string }
    | undefined = undefined
  user = people[txt]
  if (user) {
    return user.email
  }
  user = Object.values(people).find(p => p.email == txt)
  if (user) {
    return user.email
  }
  user = Object.values(people).find(p => p.name == txt)
  if (user) {
    return user.email
  }
  return undefined
}

export const getVisualStyle = (style: string): VisualStyle => {
  if (
    ["default", "abstract", "monochrome", "abstract_monochrome"].indexOf(
      style
    ) != -1
  ) {
    return style as VisualStyle
  } else {
    return "default"
  }
}
