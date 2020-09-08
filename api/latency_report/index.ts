/* eslint-disable */
export type Methods = {
  post: {
    status: 200

    resBody: {
      ok: boolean
    }

    reqBody?: {
      url?: string
      method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'LINK' | 'UNLINK'
      latency?: number
      timestamp?: number
    }[]
  }
}
