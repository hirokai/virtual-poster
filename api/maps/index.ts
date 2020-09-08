/* eslint-disable */
import * as Types from '../@types'

export type Methods = {
  get: {
    query?: Types.debug_token & Types.debug_as
    status: 200
    resBody: {
      numCols: number
      numRows: number
      id: string
      name: string
      poster_location_count: number
      poster_count: number
    }[]
  }
}
