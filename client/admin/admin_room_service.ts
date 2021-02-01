import { RoomId, Room } from "@/@types/types"
import axiosDefault from "axios"
const API_ROOT = "/api"
const axios = axiosDefault.create({ baseURL: API_ROOT })
import axiosClient from "@aspida/axios"
import api from "@/api/$api"
const client = api(axiosClient(axios))

export const createAccessCode = (state: {
  rooms: { [room_id: string]: Room }
}) => async (room_id: RoomId) => {
  const r = await client.maps._roomId(room_id).access_code.$post({ body: {} })
  if (r.access_code) {
    if (!state.rooms[room_id].access_codes) {
      state.rooms[room_id].access_codes = []
    }
    state.rooms[room_id].access_codes!.push({
      code: r.access_code.code,
      active: r.access_code.active,
      access_granted: r.access_code.access_granted,
      timestamp: r.access_code.timestamp,
    })
  }
}

export const renewAccessCode = (state: {
  rooms: { [room_id: string]: Room }
}) => async (room_id: RoomId, code: string) => {
  const room_codes = state.rooms[room_id].access_codes
  const idx = room_codes ? room_codes.findIndex(c => c.code == code) : -1
  if (
    idx < 0 ||
    !confirm("アクセスコードを更新しますか？ 古いコードは使えなくなります。")
  ) {
    return
  }
  const r = await client.maps
    ._roomId(room_id)
    .access_code._accessCode(code)
    .renew.$post()
  if (r.code && r.active != undefined) {
    state.rooms[room_id].access_codes![idx].code = r.code
    state.rooms[room_id].access_codes![idx].active = r.active
  }
}

export const deleteAccessCode = (state: {
  rooms: { [room_id: string]: Room }
}) => {
  return async (room_id: RoomId, code: string) => {
    const room_codes = state.rooms[room_id].access_codes
    const idx = room_codes ? room_codes.findIndex(c => c.code == code) : -1
    if (
      idx < 0 ||
      !confirm(
        "アクセスコードを削除しますか？ 削除するとコードは使えなくなります。"
      )
    ) {
      return
    }
    const r = await client.maps
      ._roomId(room_id)
      .access_code._accessCode(code)
      .$delete()
    if (r.ok) {
      state.rooms[room_id].access_codes!.splice(idx, 1)
      alert("アクセスコードを削除しました")
    } else {
      console.error(r.error)
      alert("アクセスコードの削除に失敗しました")
    }
  }
}

export const reloadRoomMetadata = (state: {
  rooms: { [room_id: string]: Room }
}) => {
  return async (room_id: RoomId, code: string) => {
    console.log("reloadRoomMetadata")
    const r = await client.maps._roomId(room_id).$get()
    state.rooms[room_id].access_codes = r.access_codes
  }
}
