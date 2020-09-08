/* eslint-disable */
import * as Types from '../../@types'

export type Methods = {
  patch: {
    query?: Types.debug_token & Types.debug_as
    status: 200

    resBody: {
      ok: boolean
      comment?: Types.CommentEncrypted
      error?: string
    }

    reqBody?: {
      comments?: Types.CommentEncrypted[]
    }
  }

  delete: {
    query?: Types.debug_token & Types.debug_as
    status: 200

    resBody: {
      ok: boolean
      error?: string
    }
  }
}
