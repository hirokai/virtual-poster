/* eslint-disable */
import { AspidaClient, BasicHeaders, dataToURLString } from 'aspida'
import { Methods as Methods0 } from '.'
import { Methods as Methods1 } from './_posterId@string/comments'
import { Methods as Methods2 } from './_posterId@string/comments/_commentId@string'
import { Methods as Methods3 } from './_posterId@string/file'

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
              patch: (option?: { body?: Methods2['patch']['reqBody'], query?: Methods2['patch']['query'], config?: T }) =>
                fetch<Methods2['patch']['resBody'], BasicHeaders, Methods2['patch']['status']>(prefix, prefix1, PATCH, option).json(),
              $patch: (option?: { body?: Methods2['patch']['reqBody'], query?: Methods2['patch']['query'], config?: T }) =>
                fetch<Methods2['patch']['resBody'], BasicHeaders, Methods2['patch']['status']>(prefix, prefix1, PATCH, option).json().then(r => r.body),
              $path: (option?: { method: 'patch'; query: Methods2['patch']['query'] }) =>
                `${prefix}${prefix1}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
            }
          },
          post: (option?: { body?: Methods1['post']['reqBody'], query?: Methods1['post']['query'], config?: T }) =>
            fetch<Methods1['post']['resBody'], BasicHeaders, Methods1['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).json(),
          $post: (option?: { body?: Methods1['post']['reqBody'], query?: Methods1['post']['query'], config?: T }) =>
            fetch<Methods1['post']['resBody'], BasicHeaders, Methods1['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).json().then(r => r.body),
          get: (option?: { query?: Methods1['get']['query'], config?: T }) =>
            fetch<Methods1['get']['resBody'], BasicHeaders, Methods1['get']['status']>(prefix, `${prefix0}${PATH1}`, GET, option).json(),
          $get: (option?: { query?: Methods1['get']['query'], config?: T }) =>
            fetch<Methods1['get']['resBody'], BasicHeaders, Methods1['get']['status']>(prefix, `${prefix0}${PATH1}`, GET, option).json().then(r => r.body),
          $path: (option?: { method: 'post'; query: Methods1['post']['query'] } | { method?: 'get'; query: Methods1['get']['query'] }) =>
            `${prefix}${prefix0}${PATH1}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        file: {
          get: (option?: { query?: Methods3['get']['query'], config?: T }) =>
            fetch<void, BasicHeaders, Methods3['get']['status']>(prefix, `${prefix0}${PATH2}`, GET, option).send(),
          $get: (option?: { query?: Methods3['get']['query'], config?: T }) =>
            fetch<void, BasicHeaders, Methods3['get']['status']>(prefix, `${prefix0}${PATH2}`, GET, option).send().then(r => r.body),
          post: (option?: { query?: Methods3['post']['query'], config?: T }) =>
            fetch<Methods3['post']['resBody'], BasicHeaders, Methods3['post']['status']>(prefix, `${prefix0}${PATH2}`, POST, option).json(),
          $post: (option?: { query?: Methods3['post']['query'], config?: T }) =>
            fetch<Methods3['post']['resBody'], BasicHeaders, Methods3['post']['status']>(prefix, `${prefix0}${PATH2}`, POST, option).json().then(r => r.body),
          delete: (option?: { query?: Methods3['delete']['query'], config?: T }) =>
            fetch<Methods3['delete']['resBody'], BasicHeaders, Methods3['delete']['status']>(prefix, `${prefix0}${PATH2}`, DELETE, option).json(),
          $delete: (option?: { query?: Methods3['delete']['query'], config?: T }) =>
            fetch<Methods3['delete']['resBody'], BasicHeaders, Methods3['delete']['status']>(prefix, `${prefix0}${PATH2}`, DELETE, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods3['get']['query'] } | { method: 'post'; query: Methods3['post']['query'] } | { method: 'delete'; query: Methods3['delete']['query'] }) =>
            `${prefix}${prefix0}${PATH2}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        }
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
