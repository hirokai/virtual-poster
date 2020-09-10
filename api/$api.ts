/* eslint-disable */
import { AspidaClient, BasicHeaders, dataToURLString } from 'aspida'
import { Methods as Methods0 } from './blind_sign/key_pair'
import { Methods as Methods1 } from './blind_sign/sign'
import { Methods as Methods2 } from './blind_sign/verify'
import { Methods as Methods3 } from './comments/_commentId@string'
import { Methods as Methods4 } from './groups'
import { Methods as Methods5 } from './id_token'
import { Methods as Methods6 } from './latency_report'
import { Methods as Methods7 } from './logout'
import { Methods as Methods8 } from './maps'
import { Methods as Methods9 } from './maps/_roomId@string'
import { Methods as Methods10 } from './maps/_roomId@string/comments'
import { Methods as Methods11 } from './maps/_roomId@string/enter'
import { Methods as Methods12 } from './maps/_roomId@string/groups'
import { Methods as Methods13 } from './maps/_roomId@string/groups/_groupId@string/comments'
import { Methods as Methods14 } from './maps/_roomId@string/groups/_groupId@string/join'
import { Methods as Methods15 } from './maps/_roomId@string/groups/_groupId@string/leave'
import { Methods as Methods16 } from './maps/_roomId@string/groups/_groupId@string/people'
import { Methods as Methods17 } from './maps/_roomId@string/people'
import { Methods as Methods18 } from './maps/_roomId@string/people/_userId@string/groups'
import { Methods as Methods19 } from './maps/_roomId@string/people/_userId@string/poster'
import { Methods as Methods20 } from './maps/_roomId@string/people/_userId@string/poster/file'
import { Methods as Methods21 } from './maps/_roomId@string/poster_slots/_posterNumber@number'
import { Methods as Methods22 } from './maps/_roomId@string/posters'
import { Methods as Methods23 } from './maps/_roomId@string/posters/_posterId@string/approach'
import { Methods as Methods24 } from './people'
import { Methods as Methods25 } from './people/_userId@string'
import { Methods as Methods26 } from './people/_userId@string/access_code'
import { Methods as Methods27 } from './people/_userId@string/posters'
import { Methods as Methods28 } from './people_multi/_userIds@string'
import { Methods as Methods29 } from './ping'
import { Methods as Methods30 } from './posters'
import { Methods as Methods31 } from './posters/_posterId@string/comments'
import { Methods as Methods32 } from './posters/_posterId@string/comments/_commentId@string'
import { Methods as Methods33 } from './posters/_posterId@string/file'
import { Methods as Methods34 } from './public_key'
import { Methods as Methods35 } from './register'
import { Methods as Methods36 } from './socket_url'

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? 'http://localhost:3000/api' : baseURL).replace(/\/$/, '')
  const PATH0 = '/blind_sign/key_pair'
  const PATH1 = '/blind_sign/sign'
  const PATH2 = '/blind_sign/verify'
  const PATH3 = '/comments'
  const PATH4 = '/groups'
  const PATH5 = '/id_token'
  const PATH6 = '/latency_report'
  const PATH7 = '/logout'
  const PATH8 = '/maps'
  const PATH9 = '/enter'
  const PATH10 = '/join'
  const PATH11 = '/leave'
  const PATH12 = '/people'
  const PATH13 = '/poster'
  const PATH14 = '/poster/file'
  const PATH15 = '/poster_slots'
  const PATH16 = '/posters'
  const PATH17 = '/approach'
  const PATH18 = '/access_code'
  const PATH19 = '/people_multi'
  const PATH20 = '/ping'
  const PATH21 = '/file'
  const PATH22 = '/public_key'
  const PATH23 = '/register'
  const PATH24 = '/socket_url'
  const GET = 'GET'
  const POST = 'POST'
  const DELETE = 'DELETE'
  const PATCH = 'PATCH'

  return {
    blind_sign: {
      key_pair: {
        get: (option?: { config?: T }) =>
          fetch<Methods0['get']['resBody'], BasicHeaders, Methods0['get']['status']>(prefix, PATH0, GET, option).json(),
        $get: (option?: { config?: T }) =>
          fetch<Methods0['get']['resBody'], BasicHeaders, Methods0['get']['status']>(prefix, PATH0, GET, option).json().then(r => r.body),
        $path: () => `${prefix}${PATH0}`
      },
      sign: {
        post: (option?: { body?: Methods1['post']['reqBody'], config?: T }) =>
          fetch<Methods1['post']['resBody'], BasicHeaders, Methods1['post']['status']>(prefix, PATH1, POST, option).json(),
        $post: (option?: { body?: Methods1['post']['reqBody'], config?: T }) =>
          fetch<Methods1['post']['resBody'], BasicHeaders, Methods1['post']['status']>(prefix, PATH1, POST, option).json().then(r => r.body),
        $path: () => `${prefix}${PATH1}`
      },
      verify: {
        get: (option?: { query?: Methods2['get']['query'], config?: T }) =>
          fetch<Methods2['get']['resBody'], BasicHeaders, Methods2['get']['status']>(prefix, PATH2, GET, option).json(),
        $get: (option?: { query?: Methods2['get']['query'], config?: T }) =>
          fetch<Methods2['get']['resBody'], BasicHeaders, Methods2['get']['status']>(prefix, PATH2, GET, option).json().then(r => r.body),
        $path: (option?: { method?: 'get'; query: Methods2['get']['query'] }) =>
          `${prefix}${PATH2}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
      }
    },
    comments: {
      _commentId: (val0: string) => {
        const prefix0 = `${PATH3}/${val0}`

        return {
          patch: (option?: { body?: Methods3['patch']['reqBody'], query?: Methods3['patch']['query'], config?: T }) =>
            fetch<Methods3['patch']['resBody'], BasicHeaders, Methods3['patch']['status']>(prefix, prefix0, PATCH, option).json(),
          $patch: (option?: { body?: Methods3['patch']['reqBody'], query?: Methods3['patch']['query'], config?: T }) =>
            fetch<Methods3['patch']['resBody'], BasicHeaders, Methods3['patch']['status']>(prefix, prefix0, PATCH, option).json().then(r => r.body),
          delete: (option?: { query?: Methods3['delete']['query'], config?: T }) =>
            fetch<Methods3['delete']['resBody'], BasicHeaders, Methods3['delete']['status']>(prefix, prefix0, DELETE, option).json(),
          $delete: (option?: { query?: Methods3['delete']['query'], config?: T }) =>
            fetch<Methods3['delete']['resBody'], BasicHeaders, Methods3['delete']['status']>(prefix, prefix0, DELETE, option).json().then(r => r.body),
          $path: (option?: { method: 'patch'; query: Methods3['patch']['query'] } | { method: 'delete'; query: Methods3['delete']['query'] }) =>
            `${prefix}${prefix0}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        }
      }
    },
    groups: {
      get: (option?: { query?: Methods4['get']['query'], config?: T }) =>
        fetch<Methods4['get']['resBody'], BasicHeaders, Methods4['get']['status']>(prefix, PATH4, GET, option).json(),
      $get: (option?: { query?: Methods4['get']['query'], config?: T }) =>
        fetch<Methods4['get']['resBody'], BasicHeaders, Methods4['get']['status']>(prefix, PATH4, GET, option).json().then(r => r.body),
      $path: (option?: { method?: 'get'; query: Methods4['get']['query'] }) =>
        `${prefix}${PATH4}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    id_token: {
      post: (option?: { body?: Methods5['post']['reqBody'], query?: Methods5['post']['query'], config?: T }) =>
        fetch<Methods5['post']['resBody'], BasicHeaders, Methods5['post']['status']>(prefix, PATH5, POST, option).json(),
      $post: (option?: { body?: Methods5['post']['reqBody'], query?: Methods5['post']['query'], config?: T }) =>
        fetch<Methods5['post']['resBody'], BasicHeaders, Methods5['post']['status']>(prefix, PATH5, POST, option).json().then(r => r.body),
      $path: (option?: { method: 'post'; query: Methods5['post']['query'] }) =>
        `${prefix}${PATH5}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    latency_report: {
      post: (option?: { body?: Methods6['post']['reqBody'], config?: T }) =>
        fetch<Methods6['post']['resBody'], BasicHeaders, Methods6['post']['status']>(prefix, PATH6, POST, option).json(),
      $post: (option?: { body?: Methods6['post']['reqBody'], config?: T }) =>
        fetch<Methods6['post']['resBody'], BasicHeaders, Methods6['post']['status']>(prefix, PATH6, POST, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH6}`
    },
    logout: {
      post: (option?: { config?: T }) =>
        fetch<Methods7['post']['resBody'], BasicHeaders, Methods7['post']['status']>(prefix, PATH7, POST, option).json(),
      $post: (option?: { config?: T }) =>
        fetch<Methods7['post']['resBody'], BasicHeaders, Methods7['post']['status']>(prefix, PATH7, POST, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH7}`
    },
    maps: {
      _roomId: (val1: string) => {
        const prefix1 = `${PATH8}/${val1}`

        return {
          comments: {
            get: (option?: { query?: Methods10['get']['query'], config?: T }) =>
              fetch<Methods10['get']['resBody'], BasicHeaders, Methods10['get']['status']>(prefix, `${prefix1}${PATH3}`, GET, option).json(),
            $get: (option?: { query?: Methods10['get']['query'], config?: T }) =>
              fetch<Methods10['get']['resBody'], BasicHeaders, Methods10['get']['status']>(prefix, `${prefix1}${PATH3}`, GET, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods10['get']['query'] }) =>
              `${prefix}${prefix1}${PATH3}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          enter: {
            post: (option?: { query?: Methods11['post']['query'], config?: T }) =>
              fetch<Methods11['post']['resBody'], BasicHeaders, Methods11['post']['status']>(prefix, `${prefix1}${PATH9}`, POST, option).json(),
            $post: (option?: { query?: Methods11['post']['query'], config?: T }) =>
              fetch<Methods11['post']['resBody'], BasicHeaders, Methods11['post']['status']>(prefix, `${prefix1}${PATH9}`, POST, option).json().then(r => r.body),
            $path: (option?: { method: 'post'; query: Methods11['post']['query'] }) =>
              `${prefix}${prefix1}${PATH9}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          groups: {
            _groupId: (val2: string) => {
              const prefix2 = `${prefix1}${PATH4}/${val2}`

              return {
                comments: {
                  post: (option?: { body?: Methods13['post']['reqBody'], config?: T }) =>
                    fetch<void, BasicHeaders, Methods13['post']['status']>(prefix, `${prefix2}${PATH3}`, POST, option).send(),
                  $post: (option?: { body?: Methods13['post']['reqBody'], config?: T }) =>
                    fetch<void, BasicHeaders, Methods13['post']['status']>(prefix, `${prefix2}${PATH3}`, POST, option).send().then(r => r.body),
                  $path: () => `${prefix}${prefix2}${PATH3}`
                },
                join: {
                  post: (option?: { query?: Methods14['post']['query'], config?: T }) =>
                    fetch<Methods14['post']['resBody'], BasicHeaders, Methods14['post']['status']>(prefix, `${prefix2}${PATH10}`, POST, option).json(),
                  $post: (option?: { query?: Methods14['post']['query'], config?: T }) =>
                    fetch<Methods14['post']['resBody'], BasicHeaders, Methods14['post']['status']>(prefix, `${prefix2}${PATH10}`, POST, option).json().then(r => r.body),
                  $path: (option?: { method: 'post'; query: Methods14['post']['query'] }) =>
                    `${prefix}${prefix2}${PATH10}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
                },
                leave: {
                  post: (option?: { query?: Methods15['post']['query'], config?: T }) =>
                    fetch<Methods15['post']['resBody'], BasicHeaders, Methods15['post']['status']>(prefix, `${prefix2}${PATH11}`, POST, option).json(),
                  $post: (option?: { query?: Methods15['post']['query'], config?: T }) =>
                    fetch<Methods15['post']['resBody'], BasicHeaders, Methods15['post']['status']>(prefix, `${prefix2}${PATH11}`, POST, option).json().then(r => r.body),
                  $path: (option?: { method: 'post'; query: Methods15['post']['query'] }) =>
                    `${prefix}${prefix2}${PATH11}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
                },
                people: {
                  post: (option?: { body?: Methods16['post']['reqBody'], query?: Methods16['post']['query'], config?: T }) =>
                    fetch<Methods16['post']['resBody'], BasicHeaders, Methods16['post']['status']>(prefix, `${prefix2}${PATH12}`, POST, option).json(),
                  $post: (option?: { body?: Methods16['post']['reqBody'], query?: Methods16['post']['query'], config?: T }) =>
                    fetch<Methods16['post']['resBody'], BasicHeaders, Methods16['post']['status']>(prefix, `${prefix2}${PATH12}`, POST, option).json().then(r => r.body),
                  $path: (option?: { method: 'post'; query: Methods16['post']['query'] }) =>
                    `${prefix}${prefix2}${PATH12}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
                }
              }
            },
            post: (option?: { body?: Methods12['post']['reqBody'], query?: Methods12['post']['query'], config?: T }) =>
              fetch<Methods12['post']['resBody'], BasicHeaders, Methods12['post']['status']>(prefix, `${prefix1}${PATH4}`, POST, option).json(),
            $post: (option?: { body?: Methods12['post']['reqBody'], query?: Methods12['post']['query'], config?: T }) =>
              fetch<Methods12['post']['resBody'], BasicHeaders, Methods12['post']['status']>(prefix, `${prefix1}${PATH4}`, POST, option).json().then(r => r.body),
            get: (option?: { query?: Methods12['get']['query'], config?: T }) =>
              fetch<Methods12['get']['resBody'], BasicHeaders, Methods12['get']['status']>(prefix, `${prefix1}${PATH4}`, GET, option).json(),
            $get: (option?: { query?: Methods12['get']['query'], config?: T }) =>
              fetch<Methods12['get']['resBody'], BasicHeaders, Methods12['get']['status']>(prefix, `${prefix1}${PATH4}`, GET, option).json().then(r => r.body),
            $path: (option?: { method: 'post'; query: Methods12['post']['query'] } | { method?: 'get'; query: Methods12['get']['query'] }) =>
              `${prefix}${prefix1}${PATH4}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          people: {
            _userId: (val3: string) => {
              const prefix3 = `${prefix1}${PATH12}/${val3}`

              return {
                groups: {
                  get: (option?: { query?: Methods18['get']['query'], config?: T }) =>
                    fetch<Methods18['get']['resBody'], BasicHeaders, Methods18['get']['status']>(prefix, `${prefix3}${PATH4}`, GET, option).json(),
                  $get: (option?: { query?: Methods18['get']['query'], config?: T }) =>
                    fetch<Methods18['get']['resBody'], BasicHeaders, Methods18['get']['status']>(prefix, `${prefix3}${PATH4}`, GET, option).json().then(r => r.body),
                  $path: (option?: { method?: 'get'; query: Methods18['get']['query'] }) =>
                    `${prefix}${prefix3}${PATH4}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
                },
                poster: {
                  file: {
                    post: (option?: { body?: Methods20['post']['reqBody'], query?: Methods20['post']['query'], config?: T }) =>
                      fetch<Methods20['post']['resBody'], BasicHeaders, Methods20['post']['status']>(prefix, `${prefix3}${PATH14}`, POST, option, 'FormData').json(),
                    $post: (option?: { body?: Methods20['post']['reqBody'], query?: Methods20['post']['query'], config?: T }) =>
                      fetch<Methods20['post']['resBody'], BasicHeaders, Methods20['post']['status']>(prefix, `${prefix3}${PATH14}`, POST, option, 'FormData').json().then(r => r.body),
                    $path: (option?: { method: 'post'; query: Methods20['post']['query'] }) =>
                      `${prefix}${prefix3}${PATH14}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
                  },
                  get: (option?: { query?: Methods19['get']['query'], config?: T }) =>
                    fetch<Methods19['get']['resBody'], BasicHeaders, Methods19['get']['status']>(prefix, `${prefix3}${PATH13}`, GET, option).json(),
                  $get: (option?: { query?: Methods19['get']['query'], config?: T }) =>
                    fetch<Methods19['get']['resBody'], BasicHeaders, Methods19['get']['status']>(prefix, `${prefix3}${PATH13}`, GET, option).json().then(r => r.body),
                  $path: (option?: { method?: 'get'; query: Methods19['get']['query'] }) =>
                    `${prefix}${prefix3}${PATH13}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
                }
              }
            },
            get: (option?: { query?: Methods17['get']['query'], config?: T }) =>
              fetch<Methods17['get']['resBody'], BasicHeaders, Methods17['get']['status']>(prefix, `${prefix1}${PATH12}`, GET, option).json(),
            $get: (option?: { query?: Methods17['get']['query'], config?: T }) =>
              fetch<Methods17['get']['resBody'], BasicHeaders, Methods17['get']['status']>(prefix, `${prefix1}${PATH12}`, GET, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods17['get']['query'] }) =>
              `${prefix}${prefix1}${PATH12}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          poster_slots: {
            _posterNumber: (val4: number) => {
              const prefix4 = `${prefix1}${PATH15}/${val4}`

              return {
                post: (option?: { config?: T }) =>
                  fetch<Methods21['post']['resBody'], BasicHeaders, Methods21['post']['status']>(prefix, prefix4, POST, option).json(),
                $post: (option?: { config?: T }) =>
                  fetch<Methods21['post']['resBody'], BasicHeaders, Methods21['post']['status']>(prefix, prefix4, POST, option).json().then(r => r.body),
                delete: (option?: { config?: T }) =>
                  fetch<Methods21['delete']['resBody'], BasicHeaders, Methods21['delete']['status']>(prefix, prefix4, DELETE, option).json(),
                $delete: (option?: { config?: T }) =>
                  fetch<Methods21['delete']['resBody'], BasicHeaders, Methods21['delete']['status']>(prefix, prefix4, DELETE, option).json().then(r => r.body),
                $path: () => `${prefix}${prefix4}`
              }
            }
          },
          posters: {
            _posterId: (val5: string) => {
              const prefix5 = `${prefix1}${PATH16}/${val5}`

              return {
                approach: {
                  post: (option?: { config?: T }) =>
                    fetch<Methods23['post']['resBody'], BasicHeaders, Methods23['post']['status']>(prefix, `${prefix5}${PATH17}`, POST, option).json(),
                  $post: (option?: { config?: T }) =>
                    fetch<Methods23['post']['resBody'], BasicHeaders, Methods23['post']['status']>(prefix, `${prefix5}${PATH17}`, POST, option).json().then(r => r.body),
                  $path: () => `${prefix}${prefix5}${PATH17}`
                }
              }
            },
            get: (option?: { query?: Methods22['get']['query'], config?: T }) =>
              fetch<Methods22['get']['resBody'], BasicHeaders, Methods22['get']['status']>(prefix, `${prefix1}${PATH16}`, GET, option).json(),
            $get: (option?: { query?: Methods22['get']['query'], config?: T }) =>
              fetch<Methods22['get']['resBody'], BasicHeaders, Methods22['get']['status']>(prefix, `${prefix1}${PATH16}`, GET, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods22['get']['query'] }) =>
              `${prefix}${prefix1}${PATH16}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          get: (option?: { query?: Methods9['get']['query'], config?: T }) =>
            fetch<Methods9['get']['resBody'], BasicHeaders, Methods9['get']['status']>(prefix, prefix1, GET, option).json(),
          $get: (option?: { query?: Methods9['get']['query'], config?: T }) =>
            fetch<Methods9['get']['resBody'], BasicHeaders, Methods9['get']['status']>(prefix, prefix1, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods9['get']['query'] }) =>
            `${prefix}${prefix1}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        }
      },
      get: (option?: { query?: Methods8['get']['query'], config?: T }) =>
        fetch<Methods8['get']['resBody'], BasicHeaders, Methods8['get']['status']>(prefix, PATH8, GET, option).json(),
      $get: (option?: { query?: Methods8['get']['query'], config?: T }) =>
        fetch<Methods8['get']['resBody'], BasicHeaders, Methods8['get']['status']>(prefix, PATH8, GET, option).json().then(r => r.body),
      $path: (option?: { method?: 'get'; query: Methods8['get']['query'] }) =>
        `${prefix}${PATH8}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    people: {
      _userId: (val6: string) => {
        const prefix6 = `${PATH12}/${val6}`

        return {
          access_code: {
            post: (option?: { body?: Methods26['post']['reqBody'], config?: T }) =>
              fetch<Methods26['post']['resBody'], BasicHeaders, Methods26['post']['status']>(prefix, `${prefix6}${PATH18}`, POST, option).json(),
            $post: (option?: { body?: Methods26['post']['reqBody'], config?: T }) =>
              fetch<Methods26['post']['resBody'], BasicHeaders, Methods26['post']['status']>(prefix, `${prefix6}${PATH18}`, POST, option).json().then(r => r.body),
            $path: () => `${prefix}${prefix6}${PATH18}`
          },
          posters: {
            get: (option?: { query?: Methods27['get']['query'], config?: T }) =>
              fetch<Methods27['get']['resBody'], BasicHeaders, Methods27['get']['status']>(prefix, `${prefix6}${PATH16}`, GET, option).json(),
            $get: (option?: { query?: Methods27['get']['query'], config?: T }) =>
              fetch<Methods27['get']['resBody'], BasicHeaders, Methods27['get']['status']>(prefix, `${prefix6}${PATH16}`, GET, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods27['get']['query'] }) =>
              `${prefix}${prefix6}${PATH16}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          get: (option?: { query?: Methods25['get']['query'], config?: T }) =>
            fetch<Methods25['get']['resBody'], BasicHeaders, Methods25['get']['status']>(prefix, prefix6, GET, option).json(),
          $get: (option?: { query?: Methods25['get']['query'], config?: T }) =>
            fetch<Methods25['get']['resBody'], BasicHeaders, Methods25['get']['status']>(prefix, prefix6, GET, option).json().then(r => r.body),
          patch: (option?: { body?: Methods25['patch']['reqBody'], query?: Methods25['patch']['query'], config?: T }) =>
            fetch<void, BasicHeaders, Methods25['patch']['status']>(prefix, prefix6, PATCH, option).send(),
          $patch: (option?: { body?: Methods25['patch']['reqBody'], query?: Methods25['patch']['query'], config?: T }) =>
            fetch<void, BasicHeaders, Methods25['patch']['status']>(prefix, prefix6, PATCH, option).send().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods25['get']['query'] } | { method: 'patch'; query: Methods25['patch']['query'] }) =>
            `${prefix}${prefix6}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        }
      },
      get: (option?: { query?: Methods24['get']['query'], config?: T }) =>
        fetch<Methods24['get']['resBody'], BasicHeaders, Methods24['get']['status']>(prefix, PATH12, GET, option).json(),
      $get: (option?: { query?: Methods24['get']['query'], config?: T }) =>
        fetch<Methods24['get']['resBody'], BasicHeaders, Methods24['get']['status']>(prefix, PATH12, GET, option).json().then(r => r.body),
      post: (option?: { body?: Methods24['post']['reqBody'], query?: Methods24['post']['query'], config?: T }) =>
        fetch<void, BasicHeaders, Methods24['post']['status']>(prefix, PATH12, POST, option).send(),
      $post: (option?: { body?: Methods24['post']['reqBody'], query?: Methods24['post']['query'], config?: T }) =>
        fetch<void, BasicHeaders, Methods24['post']['status']>(prefix, PATH12, POST, option).send().then(r => r.body),
      $path: (option?: { method?: 'get'; query: Methods24['get']['query'] } | { method: 'post'; query: Methods24['post']['query'] }) =>
        `${prefix}${PATH12}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    people_multi: {
      _userIds: (val7: string) => {
        const prefix7 = `${PATH19}/${val7}`

        return {
          get: (option?: { query?: Methods28['get']['query'], config?: T }) =>
            fetch<Methods28['get']['resBody'], BasicHeaders, Methods28['get']['status']>(prefix, prefix7, GET, option).json(),
          $get: (option?: { query?: Methods28['get']['query'], config?: T }) =>
            fetch<Methods28['get']['resBody'], BasicHeaders, Methods28['get']['status']>(prefix, prefix7, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods28['get']['query'] }) =>
            `${prefix}${prefix7}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        }
      }
    },
    ping: {
      get: (option?: { config?: T }) =>
        fetch<Methods29['get']['resBody'], BasicHeaders, Methods29['get']['status']>(prefix, PATH20, GET, option).text(),
      $get: (option?: { config?: T }) =>
        fetch<Methods29['get']['resBody'], BasicHeaders, Methods29['get']['status']>(prefix, PATH20, GET, option).text().then(r => r.body),
      $path: () => `${prefix}${PATH20}`
    },
    posters: {
      _posterId: (val8: string) => {
        const prefix8 = `${PATH16}/${val8}`

        return {
          comments: {
            _commentId: (val9: string) => {
              const prefix9 = `${prefix8}${PATH3}/${val9}`

              return {
                patch: (option?: { body?: Methods32['patch']['reqBody'], query?: Methods32['patch']['query'], config?: T }) =>
                  fetch<Methods32['patch']['resBody'], BasicHeaders, Methods32['patch']['status']>(prefix, prefix9, PATCH, option).json(),
                $patch: (option?: { body?: Methods32['patch']['reqBody'], query?: Methods32['patch']['query'], config?: T }) =>
                  fetch<Methods32['patch']['resBody'], BasicHeaders, Methods32['patch']['status']>(prefix, prefix9, PATCH, option).json().then(r => r.body),
                $path: (option?: { method: 'patch'; query: Methods32['patch']['query'] }) =>
                  `${prefix}${prefix9}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
              }
            },
            post: (option?: { body?: Methods31['post']['reqBody'], query?: Methods31['post']['query'], config?: T }) =>
              fetch<Methods31['post']['resBody'], BasicHeaders, Methods31['post']['status']>(prefix, `${prefix8}${PATH3}`, POST, option).json(),
            $post: (option?: { body?: Methods31['post']['reqBody'], query?: Methods31['post']['query'], config?: T }) =>
              fetch<Methods31['post']['resBody'], BasicHeaders, Methods31['post']['status']>(prefix, `${prefix8}${PATH3}`, POST, option).json().then(r => r.body),
            get: (option?: { query?: Methods31['get']['query'], config?: T }) =>
              fetch<Methods31['get']['resBody'], BasicHeaders, Methods31['get']['status']>(prefix, `${prefix8}${PATH3}`, GET, option).json(),
            $get: (option?: { query?: Methods31['get']['query'], config?: T }) =>
              fetch<Methods31['get']['resBody'], BasicHeaders, Methods31['get']['status']>(prefix, `${prefix8}${PATH3}`, GET, option).json().then(r => r.body),
            $path: (option?: { method: 'post'; query: Methods31['post']['query'] } | { method?: 'get'; query: Methods31['get']['query'] }) =>
              `${prefix}${prefix8}${PATH3}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          file: {
            get: (option?: { query?: Methods33['get']['query'], config?: T }) =>
              fetch<void, BasicHeaders, Methods33['get']['status']>(prefix, `${prefix8}${PATH21}`, GET, option).send(),
            $get: (option?: { query?: Methods33['get']['query'], config?: T }) =>
              fetch<void, BasicHeaders, Methods33['get']['status']>(prefix, `${prefix8}${PATH21}`, GET, option).send().then(r => r.body),
            post: (option?: { query?: Methods33['post']['query'], config?: T }) =>
              fetch<Methods33['post']['resBody'], BasicHeaders, Methods33['post']['status']>(prefix, `${prefix8}${PATH21}`, POST, option).json(),
            $post: (option?: { query?: Methods33['post']['query'], config?: T }) =>
              fetch<Methods33['post']['resBody'], BasicHeaders, Methods33['post']['status']>(prefix, `${prefix8}${PATH21}`, POST, option).json().then(r => r.body),
            delete: (option?: { query?: Methods33['delete']['query'], config?: T }) =>
              fetch<Methods33['delete']['resBody'], BasicHeaders, Methods33['delete']['status']>(prefix, `${prefix8}${PATH21}`, DELETE, option).json(),
            $delete: (option?: { query?: Methods33['delete']['query'], config?: T }) =>
              fetch<Methods33['delete']['resBody'], BasicHeaders, Methods33['delete']['status']>(prefix, `${prefix8}${PATH21}`, DELETE, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods33['get']['query'] } | { method: 'post'; query: Methods33['post']['query'] } | { method: 'delete'; query: Methods33['delete']['query'] }) =>
              `${prefix}${prefix8}${PATH21}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
          }
        }
      },
      get: (option?: { query?: Methods30['get']['query'], config?: T }) =>
        fetch<Methods30['get']['resBody'], BasicHeaders, Methods30['get']['status']>(prefix, PATH16, GET, option).json(),
      $get: (option?: { query?: Methods30['get']['query'], config?: T }) =>
        fetch<Methods30['get']['resBody'], BasicHeaders, Methods30['get']['status']>(prefix, PATH16, GET, option).json().then(r => r.body),
      $path: (option?: { method?: 'get'; query: Methods30['get']['query'] }) =>
        `${prefix}${PATH16}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    public_key: {
      get: (option?: { config?: T }) =>
        fetch<Methods34['get']['resBody'], BasicHeaders, Methods34['get']['status']>(prefix, PATH22, GET, option).json(),
      $get: (option?: { config?: T }) =>
        fetch<Methods34['get']['resBody'], BasicHeaders, Methods34['get']['status']>(prefix, PATH22, GET, option).json().then(r => r.body),
      post: (option?: { body?: Methods34['post']['reqBody'], config?: T }) =>
        fetch<Methods34['post']['resBody'], BasicHeaders, Methods34['post']['status']>(prefix, PATH22, POST, option).json(),
      $post: (option?: { body?: Methods34['post']['reqBody'], config?: T }) =>
        fetch<Methods34['post']['resBody'], BasicHeaders, Methods34['post']['status']>(prefix, PATH22, POST, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH22}`
    },
    register: {
      post: (option?: { body?: Methods35['post']['reqBody'], config?: T }) =>
        fetch<Methods35['post']['resBody'], BasicHeaders, Methods35['post']['status']>(prefix, PATH23, POST, option).json(),
      $post: (option?: { body?: Methods35['post']['reqBody'], config?: T }) =>
        fetch<Methods35['post']['resBody'], BasicHeaders, Methods35['post']['status']>(prefix, PATH23, POST, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH23}`
    },
    socket_url: {
      get: (option?: { config?: T }) =>
        fetch<Methods36['get']['resBody'], BasicHeaders, Methods36['get']['status']>(prefix, PATH24, GET, option).json(),
      $get: (option?: { config?: T }) =>
        fetch<Methods36['get']['resBody'], BasicHeaders, Methods36['get']['status']>(prefix, PATH24, GET, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH24}`
    }
  }
}

export type ApiInstance = ReturnType<typeof api>
export default api
