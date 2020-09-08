/* eslint-disable */
import * as Types from '../@types'

export type Methods = {
  post: {
    query?: Types.debug_token & Types.debug_as & {
      debug_as?: string
      debug_token?: string
    }

    status: 200

    resBody: {
      ok: boolean
      error?: string
      user_id?: Types.UserId
      admin?: boolean
      public_key?: string
      debug_token?: string
      registered?: 'can_register' | 'registered'
      name?: string
      updated: boolean
      token_actual?: string
    }

    reqBody?: {
      token?: string
      debug_from?: string
      force?: boolean
    }
  }
}
