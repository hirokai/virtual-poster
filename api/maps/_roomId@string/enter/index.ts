/* eslint-disable */
import * as Types from '../../../@types'

export type Methods = {
  post: {
    query?: Types.debug_token & Types.debug_as
    status: 200

    resBody: {
      ok: boolean
      status?: string
      public_key?: string
      socket_url?: string
      socket_protocol?: 'Socket.IO' | 'WebSocket'
    }
  }
}
