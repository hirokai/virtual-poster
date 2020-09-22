/* eslint-disable */
import { AspidaClient, BasicHeaders, dataToURLString } from 'aspida'
import { Methods as Methods0 } from './_commentId@string'
import { Methods as Methods1 } from './_commentId@string/reply'

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? 'http://localhost:3000/api' : baseURL).replace(/\/$/, '')
  const PATH0 = '/comments'
  const PATH1 = '/reply'
  const POST = 'POST'
  const DELETE = 'DELETE'
  const PATCH = 'PATCH'

  return {
    _commentId: (val0: string) => {
      const prefix0 = `${PATH0}/${val0}`

      return {
        reply: {
          post: (option?: { body?: Methods1['post']['reqBody'], config?: T }) =>
            fetch<Methods1['post']['resBody'], BasicHeaders, Methods1['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).json(),
          $post: (option?: { body?: Methods1['post']['reqBody'], config?: T }) =>
            fetch<Methods1['post']['resBody'], BasicHeaders, Methods1['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).json().then(r => r.body),
          $path: () => `${prefix}${prefix0}${PATH1}`
        },
        patch: (option?: { body?: Methods0['patch']['reqBody'], query?: Methods0['patch']['query'], config?: T }) =>
          fetch<Methods0['patch']['resBody'], BasicHeaders, Methods0['patch']['status']>(prefix, prefix0, PATCH, option).json(),
        $patch: (option?: { body?: Methods0['patch']['reqBody'], query?: Methods0['patch']['query'], config?: T }) =>
          fetch<Methods0['patch']['resBody'], BasicHeaders, Methods0['patch']['status']>(prefix, prefix0, PATCH, option).json().then(r => r.body),
        delete: (option?: { query?: Methods0['delete']['query'], config?: T }) =>
          fetch<Methods0['delete']['resBody'], BasicHeaders, Methods0['delete']['status']>(prefix, prefix0, DELETE, option).json(),
        $delete: (option?: { query?: Methods0['delete']['query'], config?: T }) =>
          fetch<Methods0['delete']['resBody'], BasicHeaders, Methods0['delete']['status']>(prefix, prefix0, DELETE, option).json().then(r => r.body),
        $path: (option?: { method: 'patch'; query: Methods0['patch']['query'] } | { method: 'delete'; query: Methods0['delete']['query'] }) =>
          `${prefix}${prefix0}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
      }
    }
  }
}

export type ApiInstance = ReturnType<typeof api>
export default api
