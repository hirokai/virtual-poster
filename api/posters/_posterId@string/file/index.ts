/* eslint-disable */
import * as Types from '../../../@types'

export type Methods = {
  get: {
    query?: Types.debug_token & Types.debug_as
    status: 200
  }

  post: {
    query?: Types.debug_token & Types.debug_as
    status: 200

    resBody: {
      ok: boolean
      error?: string
      poster?: Types.Poster
    }
  }

  delete: {
    query?: Types.debug_token & Types.debug_as
    status: 200

    resBody: {
      ok: boolean
      poster?: Types.Poster
      error?: string
    }
  }
}
