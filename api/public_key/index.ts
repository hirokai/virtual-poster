/* eslint-disable */
export type Methods = {
  get: {
    status: 200

    resBody: {
      ok: boolean
      public_key?: string
    }
  }

  post: {
    status: 200

    resBody: {
      ok: boolean
    }

    reqBody?: {
      key: string
      force?: boolean
    }
  }
}
