/* eslint-disable */
import { AspidaClient, BasicHeaders, dataToURLString } from 'aspida'
import { Methods as Methods0 } from './_commentId@string'

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? 'http://localhost:3000/api' : baseURL).replace(/\/$/, '')
  const PATH0 = '/comments'
  const DELETE = 'DELETE'
  const PATCH = 'PATCH'

  return {
    _commentId: (val0: string) => {
      const prefix0 = `${PATH0}/${val0}`

      return {
        patch: (option?: { body?: Methods0['patch']['reqBody'], query?: Methods0['patch']['query'], config?: T }) =>
          fetch<Methods0['patch']['resBody'], BasicHeaders, Methods0['patch']['status']>(prefix, prefix0, PATCH, option).json(),
        $patch: (option?: { body?: Methods0['patch']['reqBody'], query?: Methods0['patch']['query'], config?: T }) =>
          fetch<Methods0['patch']['resBody'], BasicHeaders, Methods0['patch']['status']>(prefix, prefix0, PATCH, option).json().then(r => r.body),
        delete: (option?: { query?: Methods0['delete']['query'], config?: T }) =>
          fetch<Methods0['delete']['resBody'], BasicHeaders, Methods0['delete']['status']>(prefix, prefix0, DELETE, option).json(),
        $delete: (option?: { query?: Methods0['delete']['query'], config?: T }) =>
          fetch<Methods0['delete']['resBody'], BasicHeaders, Methods0['delete']['status']>(prefix, prefix0, DELETE, option).json().then(r => r.body),
        $path: (option?: { method: 'patch'; query: Methods0['patch']['query'] } | { method: 'delete'; query: Methods0['delete']['query'] }) =>
          `${prefix}${prefix0}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
      }
    }
  }
}

export type ApiInstance = ReturnType<typeof api>
export default api
