/* eslint-disable */
import { AspidaClient, BasicHeaders, dataToURLString } from 'aspida'
import { Methods as Methods0 } from '.'
import { Methods as Methods1 } from './_posterId@string'
import { Methods as Methods2 } from './_posterId@string/comments'
import { Methods as Methods3 } from './_posterId@string/comments/_commentId@string'
import { Methods as Methods4 } from './_posterId@string/file'

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? 'http://localhost:3000/api' : baseURL).replace(/\/$/, '')
  const PATH0 = '/posters'
  const PATH1 = '/comments'
  const PATH2 = '/file'
  const GET = 'GET'
  const POST = 'POST'
  const DELETE = 'DELETE'
  const PATCH = 'PATCH'

  return {
    _posterId: (val0: string) => {
      const prefix0 = `${PATH0}/${val0}`

      return {
        comments: {
          _commentId: (val1: string) => {
            const prefix1 = `${prefix0}${PATH1}/${val1}`

            return {
              patch: (option?: { body?: Methods3['patch']['reqBody'], query?: Methods3['patch']['query'], config?: T }) =>
                fetch<Methods3['patch']['resBody'], BasicHeaders, Methods3['patch']['status']>(prefix, prefix1, PATCH, option).json(),
              $patch: (option?: { body?: Methods3['patch']['reqBody'], query?: Methods3['patch']['query'], config?: T }) =>
                fetch<Methods3['patch']['resBody'], BasicHeaders, Methods3['patch']['status']>(prefix, prefix1, PATCH, option).json().then(r => r.body),
              $path: (option?: { method: 'patch'; query: Methods3['patch']['query'] }) =>
                `${prefix}${prefix1}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
            }
          },
          post: (option?: { body?: Methods2['post']['reqBody'], query?: Methods2['post']['query'], config?: T }) =>
            fetch<Methods2['post']['resBody'], BasicHeaders, Methods2['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).json(),
          $post: (option?: { body?: Methods2['post']['reqBody'], query?: Methods2['post']['query'], config?: T }) =>
            fetch<Methods2['post']['resBody'], BasicHeaders, Methods2['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).json().then(r => r.body),
          get: (option?: { query?: Methods2['get']['query'], config?: T }) =>
            fetch<Methods2['get']['resBody'], BasicHeaders, Methods2['get']['status']>(prefix, `${prefix0}${PATH1}`, GET, option).json(),
          $get: (option?: { query?: Methods2['get']['query'], config?: T }) =>
            fetch<Methods2['get']['resBody'], BasicHeaders, Methods2['get']['status']>(prefix, `${prefix0}${PATH1}`, GET, option).json().then(r => r.body),
          $path: (option?: { method: 'post'; query: Methods2['post']['query'] } | { method?: 'get'; query: Methods2['get']['query'] }) =>
            `${prefix}${prefix0}${PATH1}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        file: {
          get: (option?: { query?: Methods4['get']['query'], config?: T }) =>
            fetch<void, BasicHeaders, Methods4['get']['status']>(prefix, `${prefix0}${PATH2}`, GET, option).send(),
          $get: (option?: { query?: Methods4['get']['query'], config?: T }) =>
            fetch<void, BasicHeaders, Methods4['get']['status']>(prefix, `${prefix0}${PATH2}`, GET, option).send().then(r => r.body),
          post: (option?: { query?: Methods4['post']['query'], config?: T }) =>
            fetch<Methods4['post']['resBody'], BasicHeaders, Methods4['post']['status']>(prefix, `${prefix0}${PATH2}`, POST, option).json(),
          $post: (option?: { query?: Methods4['post']['query'], config?: T }) =>
            fetch<Methods4['post']['resBody'], BasicHeaders, Methods4['post']['status']>(prefix, `${prefix0}${PATH2}`, POST, option).json().then(r => r.body),
          delete: (option?: { query?: Methods4['delete']['query'], config?: T }) =>
            fetch<Methods4['delete']['resBody'], BasicHeaders, Methods4['delete']['status']>(prefix, `${prefix0}${PATH2}`, DELETE, option).json(),
          $delete: (option?: { query?: Methods4['delete']['query'], config?: T }) =>
            fetch<Methods4['delete']['resBody'], BasicHeaders, Methods4['delete']['status']>(prefix, `${prefix0}${PATH2}`, DELETE, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods4['get']['query'] } | { method: 'post'; query: Methods4['post']['query'] } | { method: 'delete'; query: Methods4['delete']['query'] }) =>
            `${prefix}${prefix0}${PATH2}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        patch: (option?: { body?: Methods1['patch']['reqBody'], config?: T }) =>
          fetch<Methods1['patch']['resBody'], BasicHeaders, Methods1['patch']['status']>(prefix, prefix0, PATCH, option).json(),
        $patch: (option?: { body?: Methods1['patch']['reqBody'], config?: T }) =>
          fetch<Methods1['patch']['resBody'], BasicHeaders, Methods1['patch']['status']>(prefix, prefix0, PATCH, option).json().then(r => r.body),
        $path: () => `${prefix}${prefix0}`
      }
    },
    get: (option?: { query?: Methods0['get']['query'], config?: T }) =>
      fetch<Methods0['get']['resBody'], BasicHeaders, Methods0['get']['status']>(prefix, PATH0, GET, option).json(),
    $get: (option?: { query?: Methods0['get']['query'], config?: T }) =>
      fetch<Methods0['get']['resBody'], BasicHeaders, Methods0['get']['status']>(prefix, PATH0, GET, option).json().then(r => r.body),
    $path: (option?: { method?: 'get'; query: Methods0['get']['query'] }) =>
      `${prefix}${PATH0}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
  }
}

export type ApiInstance = ReturnType<typeof api>
export default api
