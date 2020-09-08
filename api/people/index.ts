/* eslint-disable */
import * as Types from '../@types'

export type Methods = {
  get: {
    query?: Types.debug_token & Types.debug_as & {
      email?: boolean
    }

    status: 200
    resBody: Types.PersonWithEmail[]
  }

  post: {
    query?: Types.debug_token & Types.debug_as
    status: 200

    reqBody?: {
      email: string
      name: string
      avatar?: string
      rooms?: Types.RoomId[]
      on_conflict?: 'append' | 'reject' | 'replace'
    }
  }
}
