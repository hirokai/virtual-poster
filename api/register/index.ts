/* eslint-disable */
import * as Types from '../@types'

export type Methods = {
  post: {
    status: 200

    resBody: {
      ok: boolean
      user?: Types.PersonWithEmail
      error?: string
    }

    reqBody?: {
      email: string
      name: string
      access_code: string
    }
  }
}
