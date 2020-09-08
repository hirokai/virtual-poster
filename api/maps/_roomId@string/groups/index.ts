/* eslint-disable */
import * as Types from '../../../@types'

export type Methods = {
  post: {
    query?: Types.debug_token & Types.debug_as
    status: 200

    resBody: {
      ok: boolean
      error?: string
      group?: Types.ChatGroup
    }

    reqBody?: {
      fromUser: Types.UserId
      toUsers: Types.UserId[]
    }
  }

  get: {
    query?: Types.debug_token & Types.debug_as
    status: 200
    resBody: Types.ChatGroup[]
  }
}
