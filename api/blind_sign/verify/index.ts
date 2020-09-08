/* eslint-disable */
export type Methods = {
  get: {
    query?: {
      unblinded?: string
      message?: string
    }

    status: 200

    resBody: {
      ok: boolean
    }
  }
}
