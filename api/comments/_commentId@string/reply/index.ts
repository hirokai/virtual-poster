/* eslint-disable */
import * as Types from '../../../@types'

export type Methods = {
  post: {
    status: 200

    resBody: {
      ok: boolean
      error?: string
    }

    reqBody?: Types.CommentEncrypted[]
  }
}
