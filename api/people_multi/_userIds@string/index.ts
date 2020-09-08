/* eslint-disable */
import * as Types from '../../@types'

export type Methods = {
  get: {
    query?: Types.debug_token & Types.debug_as & {
      email?: boolean
    }

    status: 200
    resBody: Types.PersonWithEmail[]
  }
}
