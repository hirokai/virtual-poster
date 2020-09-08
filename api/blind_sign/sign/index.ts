/* eslint-disable */
export type Methods = {
  post: {
    status: 200

    resBody: {
      ok: boolean
      signed?: string
    }

    reqBody?: {
      blinded: string
    }
  }
}
