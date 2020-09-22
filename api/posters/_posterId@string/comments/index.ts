/* eslint-disable */
import * as Types from '../../../@types'

export type Methods = {
  post: {
    query?: Types.debug_token & Types.debug_as
    status: 200

    resBody: {
      ok: boolean
    }

    reqBody?: {
      user_id?: Types.UserId
      comment?: string
    }
  }

  get: {
    query?: Types.debug_token & Types.debug_as
    status: 200
    resBody: Types.PosterCommentDecrypted[]
  }
}
