/* eslint-disable */
import { AspidaClient, BasicHeaders, dataToURLString } from 'aspida'
import { Methods as Methods0 } from '.'
import { Methods as Methods1 } from './_roomId@string'
import { Methods as Methods2 } from './_roomId@string/comments'
import { Methods as Methods3 } from './_roomId@string/enter'
import { Methods as Methods4 } from './_roomId@string/groups'
import { Methods as Methods5 } from './_roomId@string/groups/_groupId@string/comments'
import { Methods as Methods6 } from './_roomId@string/groups/_groupId@string/join'
import { Methods as Methods7 } from './_roomId@string/groups/_groupId@string/leave'
import { Methods as Methods8 } from './_roomId@string/groups/_groupId@string/people'
import { Methods as Methods9 } from './_roomId@string/people'
import { Methods as Methods10 } from './_roomId@string/people/_userId@string/groups'
import { Methods as Methods11 } from './_roomId@string/people/_userId@string/poster'
import { Methods as Methods12 } from './_roomId@string/people/_userId@string/poster/file'
import { Methods as Methods13 } from './_roomId@string/poster_slots/_posterNumber@number'
import { Methods as Methods14 } from './_roomId@string/posters'
import { Methods as Methods15 } from './_roomId@string/posters/_posterId@string/approach'
import { Methods as Methods16 } from './_roomId@string/posters/_posterId@string/enter'
import { Methods as Methods17 } from './_roomId@string/posters/_posterId@string/leave'

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? 'http://localhost:3000/api' : baseURL).replace(/\/$/, '')
  const PATH0 = '/maps'
  const PATH1 = '/comments'
  const PATH2 = '/enter'
  const PATH3 = '/groups'
  const PATH4 = '/join'
  const PATH5 = '/leave'
  const PATH6 = '/people'
  const PATH7 = '/poster'
  const PATH8 = '/poster/file'
  const PATH9 = '/poster_slots'
  const PATH10 = '/posters'
  const PATH11 = '/approach'
  const GET = 'GET'
  const POST = 'POST'
  const DELETE = 'DELETE'

  return {
    _roomId: (val0: string) => {
      const prefix0 = `${PATH0}/${val0}`

      return {
        comments: {
          get: (option?: { query?: Methods2['get']['query'], config?: T }) =>
            fetch<Methods2['get']['resBody'], BasicHeaders, Methods2['get']['status']>(prefix, `${prefix0}${PATH1}`, GET, option).json(),
          $get: (option?: { query?: Methods2['get']['query'], config?: T }) =>
            fetch<Methods2['get']['resBody'], BasicHeaders, Methods2['get']['status']>(prefix, `${prefix0}${PATH1}`, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods2['get']['query'] }) =>
            `${prefix}${prefix0}${PATH1}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        enter: {
          post: (option?: { query?: Methods3['post']['query'], config?: T }) =>
            fetch<Methods3['post']['resBody'], BasicHeaders, Methods3['post']['status']>(prefix, `${prefix0}${PATH2}`, POST, option).json(),
          $post: (option?: { query?: Methods3['post']['query'], config?: T }) =>
            fetch<Methods3['post']['resBody'], BasicHeaders, Methods3['post']['status']>(prefix, `${prefix0}${PATH2}`, POST, option).json().then(r => r.body),
          $path: (option?: { method: 'post'; query: Methods3['post']['query'] }) =>
            `${prefix}${prefix0}${PATH2}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        groups: {
          _groupId: (val1: string) => {
            const prefix1 = `${prefix0}${PATH3}/${val1}`

            return {
              comments: {
                post: (option?: { body?: Methods5['post']['reqBody'], config?: T }) =>
                  fetch<void, BasicHeaders, Methods5['post']['status']>(prefix, `${prefix1}${PATH1}`, POST, option).send(),
                $post: (option?: { body?: Methods5['post']['reqBody'], config?: T }) =>
                  fetch<void, BasicHeaders, Methods5['post']['status']>(prefix, `${prefix1}${PATH1}`, POST, option).send().then(r => r.body),
                $path: () => `${prefix}${prefix1}${PATH1}`
              },
              join: {
                post: (option?: { query?: Methods6['post']['query'], config?: T }) =>
                  fetch<Methods6['post']['resBody'], BasicHeaders, Methods6['post']['status']>(prefix, `${prefix1}${PATH4}`, POST, option).json(),
                $post: (option?: { query?: Methods6['post']['query'], config?: T }) =>
                  fetch<Methods6['post']['resBody'], BasicHeaders, Methods6['post']['status']>(prefix, `${prefix1}${PATH4}`, POST, option).json().then(r => r.body),
                $path: (option?: { method: 'post'; query: Methods6['post']['query'] }) =>
                  `${prefix}${prefix1}${PATH4}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
              },
              leave: {
                post: (option?: { query?: Methods7['post']['query'], config?: T }) =>
                  fetch<Methods7['post']['resBody'], BasicHeaders, Methods7['post']['status']>(prefix, `${prefix1}${PATH5}`, POST, option).json(),
                $post: (option?: { query?: Methods7['post']['query'], config?: T }) =>
                  fetch<Methods7['post']['resBody'], BasicHeaders, Methods7['post']['status']>(prefix, `${prefix1}${PATH5}`, POST, option).json().then(r => r.body),
                $path: (option?: { method: 'post'; query: Methods7['post']['query'] }) =>
                  `${prefix}${prefix1}${PATH5}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
              },
              people: {
                post: (option?: { body?: Methods8['post']['reqBody'], query?: Methods8['post']['query'], config?: T }) =>
                  fetch<Methods8['post']['resBody'], BasicHeaders, Methods8['post']['status']>(prefix, `${prefix1}${PATH6}`, POST, option).json(),
                $post: (option?: { body?: Methods8['post']['reqBody'], query?: Methods8['post']['query'], config?: T }) =>
                  fetch<Methods8['post']['resBody'], BasicHeaders, Methods8['post']['status']>(prefix, `${prefix1}${PATH6}`, POST, option).json().then(r => r.body),
                $path: (option?: { method: 'post'; query: Methods8['post']['query'] }) =>
                  `${prefix}${prefix1}${PATH6}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
              }
            }
          },
          post: (option?: { body?: Methods4['post']['reqBody'], query?: Methods4['post']['query'], config?: T }) =>
            fetch<Methods4['post']['resBody'], BasicHeaders, Methods4['post']['status']>(prefix, `${prefix0}${PATH3}`, POST, option).json(),
          $post: (option?: { body?: Methods4['post']['reqBody'], query?: Methods4['post']['query'], config?: T }) =>
            fetch<Methods4['post']['resBody'], BasicHeaders, Methods4['post']['status']>(prefix, `${prefix0}${PATH3}`, POST, option).json().then(r => r.body),
          get: (option?: { query?: Methods4['get']['query'], config?: T }) =>
            fetch<Methods4['get']['resBody'], BasicHeaders, Methods4['get']['status']>(prefix, `${prefix0}${PATH3}`, GET, option).json(),
          $get: (option?: { query?: Methods4['get']['query'], config?: T }) =>
            fetch<Methods4['get']['resBody'], BasicHeaders, Methods4['get']['status']>(prefix, `${prefix0}${PATH3}`, GET, option).json().then(r => r.body),
          $path: (option?: { method: 'post'; query: Methods4['post']['query'] } | { method?: 'get'; query: Methods4['get']['query'] }) =>
            `${prefix}${prefix0}${PATH3}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        people: {
          _userId: (val2: string) => {
            const prefix2 = `${prefix0}${PATH6}/${val2}`

            return {
              groups: {
                get: (option?: { query?: Methods10['get']['query'], config?: T }) =>
                  fetch<Methods10['get']['resBody'], BasicHeaders, Methods10['get']['status']>(prefix, `${prefix2}${PATH3}`, GET, option).json(),
                $get: (option?: { query?: Methods10['get']['query'], config?: T }) =>
                  fetch<Methods10['get']['resBody'], BasicHeaders, Methods10['get']['status']>(prefix, `${prefix2}${PATH3}`, GET, option).json().then(r => r.body),
                $path: (option?: { method?: 'get'; query: Methods10['get']['query'] }) =>
                  `${prefix}${prefix2}${PATH3}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
              },
              poster: {
                file: {
                  post: (option?: { body?: Methods12['post']['reqBody'], query?: Methods12['post']['query'], config?: T }) =>
                    fetch<Methods12['post']['resBody'], BasicHeaders, Methods12['post']['status']>(prefix, `${prefix2}${PATH8}`, POST, option, 'FormData').json(),
                  $post: (option?: { body?: Methods12['post']['reqBody'], query?: Methods12['post']['query'], config?: T }) =>
                    fetch<Methods12['post']['resBody'], BasicHeaders, Methods12['post']['status']>(prefix, `${prefix2}${PATH8}`, POST, option, 'FormData').json().then(r => r.body),
                  $path: (option?: { method: 'post'; query: Methods12['post']['query'] }) =>
                    `${prefix}${prefix2}${PATH8}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
                },
                get: (option?: { query?: Methods11['get']['query'], config?: T }) =>
                  fetch<Methods11['get']['resBody'], BasicHeaders, Methods11['get']['status']>(prefix, `${prefix2}${PATH7}`, GET, option).json(),
                $get: (option?: { query?: Methods11['get']['query'], config?: T }) =>
                  fetch<Methods11['get']['resBody'], BasicHeaders, Methods11['get']['status']>(prefix, `${prefix2}${PATH7}`, GET, option).json().then(r => r.body),
                $path: (option?: { method?: 'get'; query: Methods11['get']['query'] }) =>
                  `${prefix}${prefix2}${PATH7}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
              }
            }
          },
          get: (option?: { query?: Methods9['get']['query'], config?: T }) =>
            fetch<Methods9['get']['resBody'], BasicHeaders, Methods9['get']['status']>(prefix, `${prefix0}${PATH6}`, GET, option).json(),
          $get: (option?: { query?: Methods9['get']['query'], config?: T }) =>
            fetch<Methods9['get']['resBody'], BasicHeaders, Methods9['get']['status']>(prefix, `${prefix0}${PATH6}`, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods9['get']['query'] }) =>
            `${prefix}${prefix0}${PATH6}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        poster_slots: {
          _posterNumber: (val3: number) => {
            const prefix3 = `${prefix0}${PATH9}/${val3}`

            return {
              post: (option?: { config?: T }) =>
                fetch<Methods13['post']['resBody'], BasicHeaders, Methods13['post']['status']>(prefix, prefix3, POST, option).json(),
              $post: (option?: { config?: T }) =>
                fetch<Methods13['post']['resBody'], BasicHeaders, Methods13['post']['status']>(prefix, prefix3, POST, option).json().then(r => r.body),
              delete: (option?: { config?: T }) =>
                fetch<Methods13['delete']['resBody'], BasicHeaders, Methods13['delete']['status']>(prefix, prefix3, DELETE, option).json(),
              $delete: (option?: { config?: T }) =>
                fetch<Methods13['delete']['resBody'], BasicHeaders, Methods13['delete']['status']>(prefix, prefix3, DELETE, option).json().then(r => r.body),
              $path: () => `${prefix}${prefix3}`
            }
          }
        },
        posters: {
          _posterId: (val4: string) => {
            const prefix4 = `${prefix0}${PATH10}/${val4}`

            return {
              approach: {
                post: (option?: { config?: T }) =>
                  fetch<Methods15['post']['resBody'], BasicHeaders, Methods15['post']['status']>(prefix, `${prefix4}${PATH11}`, POST, option).json(),
                $post: (option?: { config?: T }) =>
                  fetch<Methods15['post']['resBody'], BasicHeaders, Methods15['post']['status']>(prefix, `${prefix4}${PATH11}`, POST, option).json().then(r => r.body),
                $path: () => `${prefix}${prefix4}${PATH11}`
              },
              enter: {
                post: (option?: { config?: T }) =>
                  fetch<Methods16['post']['resBody'], BasicHeaders, Methods16['post']['status']>(prefix, `${prefix4}${PATH2}`, POST, option).json(),
                $post: (option?: { config?: T }) =>
                  fetch<Methods16['post']['resBody'], BasicHeaders, Methods16['post']['status']>(prefix, `${prefix4}${PATH2}`, POST, option).json().then(r => r.body),
                $path: () => `${prefix}${prefix4}${PATH2}`
              },
              leave: {
                post: (option?: { config?: T }) =>
                  fetch<Methods17['post']['resBody'], BasicHeaders, Methods17['post']['status']>(prefix, `${prefix4}${PATH5}`, POST, option).json(),
                $post: (option?: { config?: T }) =>
                  fetch<Methods17['post']['resBody'], BasicHeaders, Methods17['post']['status']>(prefix, `${prefix4}${PATH5}`, POST, option).json().then(r => r.body),
                $path: () => `${prefix}${prefix4}${PATH5}`
              }
            }
          },
          get: (option?: { query?: Methods14['get']['query'], config?: T }) =>
            fetch<Methods14['get']['resBody'], BasicHeaders, Methods14['get']['status']>(prefix, `${prefix0}${PATH10}`, GET, option).json(),
          $get: (option?: { query?: Methods14['get']['query'], config?: T }) =>
            fetch<Methods14['get']['resBody'], BasicHeaders, Methods14['get']['status']>(prefix, `${prefix0}${PATH10}`, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods14['get']['query'] }) =>
            `${prefix}${prefix0}${PATH10}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        get: (option?: { query?: Methods1['get']['query'], config?: T }) =>
          fetch<Methods1['get']['resBody'], BasicHeaders, Methods1['get']['status']>(prefix, prefix0, GET, option).json(),
        $get: (option?: { query?: Methods1['get']['query'], config?: T }) =>
          fetch<Methods1['get']['resBody'], BasicHeaders, Methods1['get']['status']>(prefix, prefix0, GET, option).json().then(r => r.body),
        $path: (option?: { method?: 'get'; query: Methods1['get']['query'] }) =>
          `${prefix}${prefix0}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
      }
    },
    get: (option?: { query?: Methods0['get']['query'], config?: T }) =>
      fetch<Methods0['get']['resBody'], BasicHeaders, Methods0['get']['status']>(prefix, PATH0, GET, option).json(),
    $get: (option?: { query?: Methods0['get']['query'], config?: T }) =>
      fetch<Methods0['get']['resBody'], BasicHeaders, Methods0['get']['status']>(prefix, PATH0, GET, option).json().then(r => r.body),
    $path: (option?: { method?: 'get'; query: Methods0['get']['query'] }) =>
      `${prefix}${PATH0}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
  }
}

export type ApiInstance = ReturnType<typeof api>
export default api
