/* eslint-disable */
import * as Types from '../../../../../@types'

export type Methods = {
  post: {
    query?: Types.debug_token & Types.debug_as
    status: 200

    resBody: {
      ok: boolean
      error?: string
      joinedGroup?: Types.ChatGroup
    }

    reqBody?: {
      userId: string
    }
  }
}
