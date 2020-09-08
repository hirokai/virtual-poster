/* eslint-disable */
import { AspidaClient, BasicHeaders, dataToURLString } from 'aspida'
import { Methods as Methods0 } from '.'
import { Methods as Methods1 } from './_roomId@string'
import { Methods as Methods2 } from './_roomId@string/comments'
import { Methods as Methods3 } from './_roomId@string/enter'
import { Methods as Methods4 } from './_roomId@string/groups'
import { Methods as Methods5 } from './_roomId@string/groups/_groupId@string/join'
import { Methods as Methods6 } from './_roomId@string/groups/_groupId@string/leave'
import { Methods as Methods7 } from './_roomId@string/groups/_groupId@string/people'
import { Methods as Methods8 } from './_roomId@string/people'
import { Methods as Methods9 } from './_roomId@string/people/_userId@string/groups'
import { Methods as Methods10 } from './_roomId@string/people/_userId@string/poster'
import { Methods as Methods11 } from './_roomId@string/people/_userId@string/poster/file'
import { Methods as Methods12 } from './_roomId@string/posters'
import { Methods as Methods13 } from './_roomId@string/take_slot/_posterLocation@number'

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
  const PATH9 = '/posters'
  const PATH10 = '/take_slot'
  const GET = 'GET'
  const POST = 'POST'

  return {
    _roomId: (val0: string) => {
      const prefix0 = `${PATH0}/${val0}`

      return {
        comments: {
          get: (option?: { query?: Methods2['get']['query'], config?: T }) =>
            fetch<Methods2['get']['resBody'], BasicHeaders, Methods2['get']['status']>(prefix, `${prefix0}${PATH1}`, GET, option).json(),
          $get: (option?: { query?: Methods2['get']['query'], config?: T }) =>
            fetch<Methods2['get']['resBody'], BasicHeaders, Methods2['get']['status']>(prefix, `${prefix0}${PATH1}`, GET, option).json().then(r => r.body),
          post: (option?: { body?: Methods2['post']['reqBody'], query?: Methods2['post']['query'], config?: T }) =>
            fetch<void, BasicHeaders, Methods2['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).send(),
          $post: (option?: { body?: Methods2['post']['reqBody'], query?: Methods2['post']['query'], config?: T }) =>
            fetch<void, BasicHeaders, Methods2['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).send().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods2['get']['query'] } | { method: 'post'; query: Methods2['post']['query'] }) =>
            `${prefix}${prefix0}${PATH1}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        enter: {
          post: (option?: { query?: Methods3['post']['query'], config?: T }) =>
            fetch<Methods3['post']['resBody'], BasicHeaders, Methods3['post']['status']>(prefix, `${prefix0}${PATH2}`, POST, option).json(),
          $post: (option?: { query?: Methods3['post']['query'], config?: T }) =>
            fetch<Methods3['post']['resBody'], BasicHeaders, Methods3['post']['status']>(prefix, `${prefix0}${PATH2}`, POST, option).json().then(r => r.body),
          $path: (option?: { method: 'post'; query: Methods3['post']['query'] }) =>
            `${prefix}${prefix0}${PATH2}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        groups: {
          _groupId: (val1: string) => {
            const prefix1 = `${prefix0}${PATH3}/${val1}`

            return {
              join: {
                post: (option?: { query?: Methods5['post']['query'], config?: T }) =>
                  fetch<Methods5['post']['resBody'], BasicHeaders, Methods5['post']['status']>(prefix, `${prefix1}${PATH4}`, POST, option).json(),
                $post: (option?: { query?: Methods5['post']['query'], config?: T }) =>
                  fetch<Methods5['post']['resBody'], BasicHeaders, Methods5['post']['status']>(prefix, `${prefix1}${PATH4}`, POST, option).json().then(r => r.body),
                $path: (option?: { method: 'post'; query: Methods5['post']['query'] }) =>
                  `${prefix}${prefix1}${PATH4}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
              },
              leave: {
                post: (option?: { query?: Methods6['post']['query'], config?: T }) =>
                  fetch<Methods6['post']['resBody'], BasicHeaders, Methods6['post']['status']>(prefix, `${prefix1}${PATH5}`, POST, option).json(),
                $post: (option?: { query?: Methods6['post']['query'], config?: T }) =>
                  fetch<Methods6['post']['resBody'], BasicHeaders, Methods6['post']['status']>(prefix, `${prefix1}${PATH5}`, POST, option).json().then(r => r.body),
                $path: (option?: { method: 'post'; query: Methods6['post']['query'] }) =>
                  `${prefix}${prefix1}${PATH5}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
              },
              people: {
                post: (option?: { body?: Methods7['post']['reqBody'], query?: Methods7['post']['query'], config?: T }) =>
                  fetch<Methods7['post']['resBody'], BasicHeaders, Methods7['post']['status']>(prefix, `${prefix1}${PATH6}`, POST, option).json(),
                $post: (option?: { body?: Methods7['post']['reqBody'], query?: Methods7['post']['query'], config?: T }) =>
                  fetch<Methods7['post']['resBody'], BasicHeaders, Methods7['post']['status']>(prefix, `${prefix1}${PATH6}`, POST, option).json().then(r => r.body),
                $path: (option?: { method: 'post'; query: Methods7['post']['query'] }) =>
                  `${prefix}${prefix1}${PATH6}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
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
            `${prefix}${prefix0}${PATH3}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        people: {
          _userId: (val2: string) => {
            const prefix2 = `${prefix0}${PATH6}/${val2}`

            return {
              groups: {
                get: (option?: { query?: Methods9['get']['query'], config?: T }) =>
                  fetch<Methods9['get']['resBody'], BasicHeaders, Methods9['get']['status']>(prefix, `${prefix2}${PATH3}`, GET, option).json(),
                $get: (option?: { query?: Methods9['get']['query'], config?: T }) =>
                  fetch<Methods9['get']['resBody'], BasicHeaders, Methods9['get']['status']>(prefix, `${prefix2}${PATH3}`, GET, option).json().then(r => r.body),
                $path: (option?: { method?: 'get'; query: Methods9['get']['query'] }) =>
                  `${prefix}${prefix2}${PATH3}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
              },
              poster: {
                file: {
                  post: (option?: { body?: Methods11['post']['reqBody'], query?: Methods11['post']['query'], config?: T }) =>
                    fetch<Methods11['post']['resBody'], BasicHeaders, Methods11['post']['status']>(prefix, `${prefix2}${PATH8}`, POST, option, 'FormData').json(),
                  $post: (option?: { body?: Methods11['post']['reqBody'], query?: Methods11['post']['query'], config?: T }) =>
                    fetch<Methods11['post']['resBody'], BasicHeaders, Methods11['post']['status']>(prefix, `${prefix2}${PATH8}`, POST, option, 'FormData').json().then(r => r.body),
                  $path: (option?: { method: 'post'; query: Methods11['post']['query'] }) =>
                    `${prefix}${prefix2}${PATH8}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
                },
                get: (option?: { query?: Methods10['get']['query'], config?: T }) =>
                  fetch<Methods10['get']['resBody'], BasicHeaders, Methods10['get']['status']>(prefix, `${prefix2}${PATH7}`, GET, option).json(),
                $get: (option?: { query?: Methods10['get']['query'], config?: T }) =>
                  fetch<Methods10['get']['resBody'], BasicHeaders, Methods10['get']['status']>(prefix, `${prefix2}${PATH7}`, GET, option).json().then(r => r.body),
                $path: (option?: { method?: 'get'; query: Methods10['get']['query'] }) =>
                  `${prefix}${prefix2}${PATH7}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
              }
            }
          },
          get: (option?: { query?: Methods8['get']['query'], config?: T }) =>
            fetch<Methods8['get']['resBody'], BasicHeaders, Methods8['get']['status']>(prefix, `${prefix0}${PATH6}`, GET, option).json(),
          $get: (option?: { query?: Methods8['get']['query'], config?: T }) =>
            fetch<Methods8['get']['resBody'], BasicHeaders, Methods8['get']['status']>(prefix, `${prefix0}${PATH6}`, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods8['get']['query'] }) =>
            `${prefix}${prefix0}${PATH6}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        posters: {
          get: (option?: { query?: Methods12['get']['query'], config?: T }) =>
            fetch<Methods12['get']['resBody'], BasicHeaders, Methods12['get']['status']>(prefix, `${prefix0}${PATH9}`, GET, option).json(),
          $get: (option?: { query?: Methods12['get']['query'], config?: T }) =>
            fetch<Methods12['get']['resBody'], BasicHeaders, Methods12['get']['status']>(prefix, `${prefix0}${PATH9}`, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods12['get']['query'] }) =>
            `${prefix}${prefix0}${PATH9}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        take_slot: {
          _posterLocation: (val3: number) => {
            const prefix3 = `${prefix0}${PATH10}/${val3}`

            return {
              post: (option?: { config?: T }) =>
                fetch<Methods13['post']['resBody'], BasicHeaders, Methods13['post']['status']>(prefix, prefix3, POST, option).json(),
              $post: (option?: { config?: T }) =>
                fetch<Methods13['post']['resBody'], BasicHeaders, Methods13['post']['status']>(prefix, prefix3, POST, option).json().then(r => r.body),
              $path: () => `${prefix}${prefix3}`
            }
          }
        },
        get: (option?: { query?: Methods1['get']['query'], config?: T }) =>
          fetch<Methods1['get']['resBody'], BasicHeaders, Methods1['get']['status']>(prefix, prefix0, GET, option).json(),
        $get: (option?: { query?: Methods1['get']['query'], config?: T }) =>
          fetch<Methods1['get']['resBody'], BasicHeaders, Methods1['get']['status']>(prefix, prefix0, GET, option).json().then(r => r.body),
        $path: (option?: { method?: 'get'; query: Methods1['get']['query'] }) =>
          `${prefix}${prefix0}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
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
