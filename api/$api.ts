/* eslint-disable */
import { AspidaClient, BasicHeaders, dataToURLString } from 'aspida'
import { Methods as Methods0 } from './blind_sign/key_pair'
import { Methods as Methods1 } from './blind_sign/sign'
import { Methods as Methods2 } from './blind_sign/verify'
import { Methods as Methods3 } from './comments/_commentId@string'
import { Methods as Methods4 } from './comments/_commentId@string/reply'
import { Methods as Methods5 } from './groups'
import { Methods as Methods6 } from './id_token'
import { Methods as Methods7 } from './latency_report'
import { Methods as Methods8 } from './logout'
import { Methods as Methods9 } from './maps'
import { Methods as Methods10 } from './maps/_roomId@string'
import { Methods as Methods11 } from './maps/_roomId@string/comments'
import { Methods as Methods12 } from './maps/_roomId@string/enter'
import { Methods as Methods13 } from './maps/_roomId@string/groups'
import { Methods as Methods14 } from './maps/_roomId@string/groups/_groupId@string/comments'
import { Methods as Methods15 } from './maps/_roomId@string/groups/_groupId@string/join'
import { Methods as Methods16 } from './maps/_roomId@string/groups/_groupId@string/leave'
import { Methods as Methods17 } from './maps/_roomId@string/groups/_groupId@string/people'
import { Methods as Methods18 } from './maps/_roomId@string/people'
import { Methods as Methods19 } from './maps/_roomId@string/people/_userId@string/groups'
import { Methods as Methods20 } from './maps/_roomId@string/people/_userId@string/poster'
import { Methods as Methods21 } from './maps/_roomId@string/people/_userId@string/poster/file'
import { Methods as Methods22 } from './maps/_roomId@string/poster_slots/_posterNumber@number'
import { Methods as Methods23 } from './maps/_roomId@string/posters'
import { Methods as Methods24 } from './maps/_roomId@string/posters/_posterId@string/approach'
import { Methods as Methods25 } from './maps/_roomId@string/posters/_posterId@string/enter'
import { Methods as Methods26 } from './maps/_roomId@string/posters/_posterId@string/leave'
import { Methods as Methods27 } from './people'
import { Methods as Methods28 } from './people/_userId@string'
import { Methods as Methods29 } from './people/_userId@string/access_code'
import { Methods as Methods30 } from './people/_userId@string/posters'
import { Methods as Methods31 } from './people_multi/_userIds@string'
import { Methods as Methods32 } from './ping'
import { Methods as Methods33 } from './posters'
import { Methods as Methods34 } from './posters/_posterId@string'
import { Methods as Methods35 } from './posters/_posterId@string/comments'
import { Methods as Methods36 } from './posters/_posterId@string/comments/_commentId@string'
import { Methods as Methods37 } from './posters/_posterId@string/comments/_commentId@string/reply'
import { Methods as Methods38 } from './posters/_posterId@string/file'
import { Methods as Methods39 } from './public_key'
import { Methods as Methods40 } from './register'
import { Methods as Methods41 } from './socket_url'

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? 'http://localhost:3000/api' : baseURL).replace(/\/$/, '')
  const PATH0 = '/blind_sign/key_pair'
  const PATH1 = '/blind_sign/sign'
  const PATH2 = '/blind_sign/verify'
  const PATH3 = '/comments'
  const PATH4 = '/reply'
  const PATH5 = '/groups'
  const PATH6 = '/id_token'
  const PATH7 = '/latency_report'
  const PATH8 = '/logout'
  const PATH9 = '/maps'
  const PATH10 = '/enter'
  const PATH11 = '/join'
  const PATH12 = '/leave'
  const PATH13 = '/people'
  const PATH14 = '/poster'
  const PATH15 = '/poster/file'
  const PATH16 = '/poster_slots'
  const PATH17 = '/posters'
  const PATH18 = '/approach'
  const PATH19 = '/access_code'
  const PATH20 = '/people_multi'
  const PATH21 = '/ping'
  const PATH22 = '/file'
  const PATH23 = '/public_key'
  const PATH24 = '/register'
  const PATH25 = '/socket_url'
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
          `${prefix}${PATH2}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
      }
    },
    comments: {
      _commentId: (val0: string) => {
        const prefix0 = `${PATH3}/${val0}`

        return {
          reply: {
            post: (option?: { body?: Methods4['post']['reqBody'], config?: T }) =>
              fetch<Methods4['post']['resBody'], BasicHeaders, Methods4['post']['status']>(prefix, `${prefix0}${PATH4}`, POST, option).json(),
            $post: (option?: { body?: Methods4['post']['reqBody'], config?: T }) =>
              fetch<Methods4['post']['resBody'], BasicHeaders, Methods4['post']['status']>(prefix, `${prefix0}${PATH4}`, POST, option).json().then(r => r.body),
            $path: () => `${prefix}${prefix0}${PATH4}`
          },
          patch: (option?: { body?: Methods3['patch']['reqBody'], query?: Methods3['patch']['query'], config?: T }) =>
            fetch<Methods3['patch']['resBody'], BasicHeaders, Methods3['patch']['status']>(prefix, prefix0, PATCH, option).json(),
          $patch: (option?: { body?: Methods3['patch']['reqBody'], query?: Methods3['patch']['query'], config?: T }) =>
            fetch<Methods3['patch']['resBody'], BasicHeaders, Methods3['patch']['status']>(prefix, prefix0, PATCH, option).json().then(r => r.body),
          delete: (option?: { query?: Methods3['delete']['query'], config?: T }) =>
            fetch<Methods3['delete']['resBody'], BasicHeaders, Methods3['delete']['status']>(prefix, prefix0, DELETE, option).json(),
          $delete: (option?: { query?: Methods3['delete']['query'], config?: T }) =>
            fetch<Methods3['delete']['resBody'], BasicHeaders, Methods3['delete']['status']>(prefix, prefix0, DELETE, option).json().then(r => r.body),
          $path: (option?: { method: 'patch'; query: Methods3['patch']['query'] } | { method: 'delete'; query: Methods3['delete']['query'] }) =>
            `${prefix}${prefix0}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
        }
      }
    },
    groups: {
      get: (option?: { query?: Methods5['get']['query'], config?: T }) =>
        fetch<Methods5['get']['resBody'], BasicHeaders, Methods5['get']['status']>(prefix, PATH5, GET, option).json(),
      $get: (option?: { query?: Methods5['get']['query'], config?: T }) =>
        fetch<Methods5['get']['resBody'], BasicHeaders, Methods5['get']['status']>(prefix, PATH5, GET, option).json().then(r => r.body),
      $path: (option?: { method?: 'get'; query: Methods5['get']['query'] }) =>
        `${prefix}${PATH5}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    id_token: {
      post: (option?: { body?: Methods6['post']['reqBody'], query?: Methods6['post']['query'], config?: T }) =>
        fetch<Methods6['post']['resBody'], BasicHeaders, Methods6['post']['status']>(prefix, PATH6, POST, option).json(),
      $post: (option?: { body?: Methods6['post']['reqBody'], query?: Methods6['post']['query'], config?: T }) =>
        fetch<Methods6['post']['resBody'], BasicHeaders, Methods6['post']['status']>(prefix, PATH6, POST, option).json().then(r => r.body),
      $path: (option?: { method: 'post'; query: Methods6['post']['query'] }) =>
        `${prefix}${PATH6}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    latency_report: {
      post: (option?: { body?: Methods7['post']['reqBody'], config?: T }) =>
        fetch<Methods7['post']['resBody'], BasicHeaders, Methods7['post']['status']>(prefix, PATH7, POST, option).json(),
      $post: (option?: { body?: Methods7['post']['reqBody'], config?: T }) =>
        fetch<Methods7['post']['resBody'], BasicHeaders, Methods7['post']['status']>(prefix, PATH7, POST, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH7}`
    },
    logout: {
      post: (option?: { config?: T }) =>
        fetch<Methods8['post']['resBody'], BasicHeaders, Methods8['post']['status']>(prefix, PATH8, POST, option).json(),
      $post: (option?: { config?: T }) =>
        fetch<Methods8['post']['resBody'], BasicHeaders, Methods8['post']['status']>(prefix, PATH8, POST, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH8}`
    },
    maps: {
      _roomId: (val1: string) => {
        const prefix1 = `${PATH9}/${val1}`

        return {
          comments: {
            get: (option?: { query?: Methods11['get']['query'], config?: T }) =>
              fetch<Methods11['get']['resBody'], BasicHeaders, Methods11['get']['status']>(prefix, `${prefix1}${PATH3}`, GET, option).json(),
            $get: (option?: { query?: Methods11['get']['query'], config?: T }) =>
              fetch<Methods11['get']['resBody'], BasicHeaders, Methods11['get']['status']>(prefix, `${prefix1}${PATH3}`, GET, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods11['get']['query'] }) =>
              `${prefix}${prefix1}${PATH3}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          enter: {
            post: (option?: { query?: Methods12['post']['query'], config?: T }) =>
              fetch<Methods12['post']['resBody'], BasicHeaders, Methods12['post']['status']>(prefix, `${prefix1}${PATH10}`, POST, option).json(),
            $post: (option?: { query?: Methods12['post']['query'], config?: T }) =>
              fetch<Methods12['post']['resBody'], BasicHeaders, Methods12['post']['status']>(prefix, `${prefix1}${PATH10}`, POST, option).json().then(r => r.body),
            $path: (option?: { method: 'post'; query: Methods12['post']['query'] }) =>
              `${prefix}${prefix1}${PATH10}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          groups: {
            _groupId: (val2: string) => {
              const prefix2 = `${prefix1}${PATH5}/${val2}`

              return {
                comments: {
                  post: (option?: { body?: Methods14['post']['reqBody'], config?: T }) =>
                    fetch<void, BasicHeaders, Methods14['post']['status']>(prefix, `${prefix2}${PATH3}`, POST, option).send(),
                  $post: (option?: { body?: Methods14['post']['reqBody'], config?: T }) =>
                    fetch<void, BasicHeaders, Methods14['post']['status']>(prefix, `${prefix2}${PATH3}`, POST, option).send().then(r => r.body),
                  $path: () => `${prefix}${prefix2}${PATH3}`
                },
                join: {
                  post: (option?: { query?: Methods15['post']['query'], config?: T }) =>
                    fetch<Methods15['post']['resBody'], BasicHeaders, Methods15['post']['status']>(prefix, `${prefix2}${PATH11}`, POST, option).json(),
                  $post: (option?: { query?: Methods15['post']['query'], config?: T }) =>
                    fetch<Methods15['post']['resBody'], BasicHeaders, Methods15['post']['status']>(prefix, `${prefix2}${PATH11}`, POST, option).json().then(r => r.body),
                  $path: (option?: { method: 'post'; query: Methods15['post']['query'] }) =>
                    `${prefix}${prefix2}${PATH11}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
                },
                leave: {
                  post: (option?: { query?: Methods16['post']['query'], config?: T }) =>
                    fetch<Methods16['post']['resBody'], BasicHeaders, Methods16['post']['status']>(prefix, `${prefix2}${PATH12}`, POST, option).json(),
                  $post: (option?: { query?: Methods16['post']['query'], config?: T }) =>
                    fetch<Methods16['post']['resBody'], BasicHeaders, Methods16['post']['status']>(prefix, `${prefix2}${PATH12}`, POST, option).json().then(r => r.body),
                  $path: (option?: { method: 'post'; query: Methods16['post']['query'] }) =>
                    `${prefix}${prefix2}${PATH12}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
                },
                people: {
                  post: (option?: { body?: Methods17['post']['reqBody'], query?: Methods17['post']['query'], config?: T }) =>
                    fetch<Methods17['post']['resBody'], BasicHeaders, Methods17['post']['status']>(prefix, `${prefix2}${PATH13}`, POST, option).json(),
                  $post: (option?: { body?: Methods17['post']['reqBody'], query?: Methods17['post']['query'], config?: T }) =>
                    fetch<Methods17['post']['resBody'], BasicHeaders, Methods17['post']['status']>(prefix, `${prefix2}${PATH13}`, POST, option).json().then(r => r.body),
                  $path: (option?: { method: 'post'; query: Methods17['post']['query'] }) =>
                    `${prefix}${prefix2}${PATH13}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
                }
              }
            },
            post: (option?: { body?: Methods13['post']['reqBody'], query?: Methods13['post']['query'], config?: T }) =>
              fetch<Methods13['post']['resBody'], BasicHeaders, Methods13['post']['status']>(prefix, `${prefix1}${PATH5}`, POST, option).json(),
            $post: (option?: { body?: Methods13['post']['reqBody'], query?: Methods13['post']['query'], config?: T }) =>
              fetch<Methods13['post']['resBody'], BasicHeaders, Methods13['post']['status']>(prefix, `${prefix1}${PATH5}`, POST, option).json().then(r => r.body),
            get: (option?: { query?: Methods13['get']['query'], config?: T }) =>
              fetch<Methods13['get']['resBody'], BasicHeaders, Methods13['get']['status']>(prefix, `${prefix1}${PATH5}`, GET, option).json(),
            $get: (option?: { query?: Methods13['get']['query'], config?: T }) =>
              fetch<Methods13['get']['resBody'], BasicHeaders, Methods13['get']['status']>(prefix, `${prefix1}${PATH5}`, GET, option).json().then(r => r.body),
            $path: (option?: { method: 'post'; query: Methods13['post']['query'] } | { method?: 'get'; query: Methods13['get']['query'] }) =>
              `${prefix}${prefix1}${PATH5}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          people: {
            _userId: (val3: string) => {
              const prefix3 = `${prefix1}${PATH13}/${val3}`

              return {
                groups: {
                  get: (option?: { query?: Methods19['get']['query'], config?: T }) =>
                    fetch<Methods19['get']['resBody'], BasicHeaders, Methods19['get']['status']>(prefix, `${prefix3}${PATH5}`, GET, option).json(),
                  $get: (option?: { query?: Methods19['get']['query'], config?: T }) =>
                    fetch<Methods19['get']['resBody'], BasicHeaders, Methods19['get']['status']>(prefix, `${prefix3}${PATH5}`, GET, option).json().then(r => r.body),
                  $path: (option?: { method?: 'get'; query: Methods19['get']['query'] }) =>
                    `${prefix}${prefix3}${PATH5}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
                },
                poster: {
                  file: {
                    post: (option?: { body?: Methods21['post']['reqBody'], query?: Methods21['post']['query'], config?: T }) =>
                      fetch<Methods21['post']['resBody'], BasicHeaders, Methods21['post']['status']>(prefix, `${prefix3}${PATH15}`, POST, option, 'FormData').json(),
                    $post: (option?: { body?: Methods21['post']['reqBody'], query?: Methods21['post']['query'], config?: T }) =>
                      fetch<Methods21['post']['resBody'], BasicHeaders, Methods21['post']['status']>(prefix, `${prefix3}${PATH15}`, POST, option, 'FormData').json().then(r => r.body),
                    $path: (option?: { method: 'post'; query: Methods21['post']['query'] }) =>
                      `${prefix}${prefix3}${PATH15}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
                  },
                  get: (option?: { query?: Methods20['get']['query'], config?: T }) =>
                    fetch<Methods20['get']['resBody'], BasicHeaders, Methods20['get']['status']>(prefix, `${prefix3}${PATH14}`, GET, option).json(),
                  $get: (option?: { query?: Methods20['get']['query'], config?: T }) =>
                    fetch<Methods20['get']['resBody'], BasicHeaders, Methods20['get']['status']>(prefix, `${prefix3}${PATH14}`, GET, option).json().then(r => r.body),
                  $path: (option?: { method?: 'get'; query: Methods20['get']['query'] }) =>
                    `${prefix}${prefix3}${PATH14}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
                }
              }
            },
            get: (option?: { query?: Methods18['get']['query'], config?: T }) =>
              fetch<Methods18['get']['resBody'], BasicHeaders, Methods18['get']['status']>(prefix, `${prefix1}${PATH13}`, GET, option).json(),
            $get: (option?: { query?: Methods18['get']['query'], config?: T }) =>
              fetch<Methods18['get']['resBody'], BasicHeaders, Methods18['get']['status']>(prefix, `${prefix1}${PATH13}`, GET, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods18['get']['query'] }) =>
              `${prefix}${prefix1}${PATH13}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          poster_slots: {
            _posterNumber: (val4: number) => {
              const prefix4 = `${prefix1}${PATH16}/${val4}`

              return {
                post: (option?: { config?: T }) =>
                  fetch<Methods22['post']['resBody'], BasicHeaders, Methods22['post']['status']>(prefix, prefix4, POST, option).json(),
                $post: (option?: { config?: T }) =>
                  fetch<Methods22['post']['resBody'], BasicHeaders, Methods22['post']['status']>(prefix, prefix4, POST, option).json().then(r => r.body),
                delete: (option?: { config?: T }) =>
                  fetch<Methods22['delete']['resBody'], BasicHeaders, Methods22['delete']['status']>(prefix, prefix4, DELETE, option).json(),
                $delete: (option?: { config?: T }) =>
                  fetch<Methods22['delete']['resBody'], BasicHeaders, Methods22['delete']['status']>(prefix, prefix4, DELETE, option).json().then(r => r.body),
                $path: () => `${prefix}${prefix4}`
              }
            }
          },
          posters: {
            _posterId: (val5: string) => {
              const prefix5 = `${prefix1}${PATH17}/${val5}`

              return {
                approach: {
                  post: (option?: { config?: T }) =>
                    fetch<Methods24['post']['resBody'], BasicHeaders, Methods24['post']['status']>(prefix, `${prefix5}${PATH18}`, POST, option).json(),
                  $post: (option?: { config?: T }) =>
                    fetch<Methods24['post']['resBody'], BasicHeaders, Methods24['post']['status']>(prefix, `${prefix5}${PATH18}`, POST, option).json().then(r => r.body),
                  $path: () => `${prefix}${prefix5}${PATH18}`
                },
                enter: {
                  post: (option?: { config?: T }) =>
                    fetch<Methods25['post']['resBody'], BasicHeaders, Methods25['post']['status']>(prefix, `${prefix5}${PATH10}`, POST, option).json(),
                  $post: (option?: { config?: T }) =>
                    fetch<Methods25['post']['resBody'], BasicHeaders, Methods25['post']['status']>(prefix, `${prefix5}${PATH10}`, POST, option).json().then(r => r.body),
                  $path: () => `${prefix}${prefix5}${PATH10}`
                },
                leave: {
                  post: (option?: { config?: T }) =>
                    fetch<Methods26['post']['resBody'], BasicHeaders, Methods26['post']['status']>(prefix, `${prefix5}${PATH12}`, POST, option).json(),
                  $post: (option?: { config?: T }) =>
                    fetch<Methods26['post']['resBody'], BasicHeaders, Methods26['post']['status']>(prefix, `${prefix5}${PATH12}`, POST, option).json().then(r => r.body),
                  $path: () => `${prefix}${prefix5}${PATH12}`
                }
              }
            },
            get: (option?: { query?: Methods23['get']['query'], config?: T }) =>
              fetch<Methods23['get']['resBody'], BasicHeaders, Methods23['get']['status']>(prefix, `${prefix1}${PATH17}`, GET, option).json(),
            $get: (option?: { query?: Methods23['get']['query'], config?: T }) =>
              fetch<Methods23['get']['resBody'], BasicHeaders, Methods23['get']['status']>(prefix, `${prefix1}${PATH17}`, GET, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods23['get']['query'] }) =>
              `${prefix}${prefix1}${PATH17}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          get: (option?: { query?: Methods10['get']['query'], config?: T }) =>
            fetch<Methods10['get']['resBody'], BasicHeaders, Methods10['get']['status']>(prefix, prefix1, GET, option).json(),
          $get: (option?: { query?: Methods10['get']['query'], config?: T }) =>
            fetch<Methods10['get']['resBody'], BasicHeaders, Methods10['get']['status']>(prefix, prefix1, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods10['get']['query'] }) =>
            `${prefix}${prefix1}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
        }
      },
      get: (option?: { query?: Methods9['get']['query'], config?: T }) =>
        fetch<Methods9['get']['resBody'], BasicHeaders, Methods9['get']['status']>(prefix, PATH9, GET, option).json(),
      $get: (option?: { query?: Methods9['get']['query'], config?: T }) =>
        fetch<Methods9['get']['resBody'], BasicHeaders, Methods9['get']['status']>(prefix, PATH9, GET, option).json().then(r => r.body),
      $path: (option?: { method?: 'get'; query: Methods9['get']['query'] }) =>
        `${prefix}${PATH9}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    people: {
      _userId: (val6: string) => {
        const prefix6 = `${PATH13}/${val6}`

        return {
          access_code: {
            post: (option?: { body?: Methods29['post']['reqBody'], config?: T }) =>
              fetch<Methods29['post']['resBody'], BasicHeaders, Methods29['post']['status']>(prefix, `${prefix6}${PATH19}`, POST, option).json(),
            $post: (option?: { body?: Methods29['post']['reqBody'], config?: T }) =>
              fetch<Methods29['post']['resBody'], BasicHeaders, Methods29['post']['status']>(prefix, `${prefix6}${PATH19}`, POST, option).json().then(r => r.body),
            $path: () => `${prefix}${prefix6}${PATH19}`
          },
          posters: {
            get: (option?: { query?: Methods30['get']['query'], config?: T }) =>
              fetch<Methods30['get']['resBody'], BasicHeaders, Methods30['get']['status']>(prefix, `${prefix6}${PATH17}`, GET, option).json(),
            $get: (option?: { query?: Methods30['get']['query'], config?: T }) =>
              fetch<Methods30['get']['resBody'], BasicHeaders, Methods30['get']['status']>(prefix, `${prefix6}${PATH17}`, GET, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods30['get']['query'] }) =>
              `${prefix}${prefix6}${PATH17}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          get: (option?: { query?: Methods28['get']['query'], config?: T }) =>
            fetch<Methods28['get']['resBody'], BasicHeaders, Methods28['get']['status']>(prefix, prefix6, GET, option).json(),
          $get: (option?: { query?: Methods28['get']['query'], config?: T }) =>
            fetch<Methods28['get']['resBody'], BasicHeaders, Methods28['get']['status']>(prefix, prefix6, GET, option).json().then(r => r.body),
          patch: (option?: { body?: Methods28['patch']['reqBody'], query?: Methods28['patch']['query'], config?: T }) =>
            fetch<Methods28['patch']['resBody'], BasicHeaders, Methods28['patch']['status']>(prefix, prefix6, PATCH, option).json(),
          $patch: (option?: { body?: Methods28['patch']['reqBody'], query?: Methods28['patch']['query'], config?: T }) =>
            fetch<Methods28['patch']['resBody'], BasicHeaders, Methods28['patch']['status']>(prefix, prefix6, PATCH, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods28['get']['query'] } | { method: 'patch'; query: Methods28['patch']['query'] }) =>
            `${prefix}${prefix6}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
        }
      },
      get: (option?: { query?: Methods27['get']['query'], config?: T }) =>
        fetch<Methods27['get']['resBody'], BasicHeaders, Methods27['get']['status']>(prefix, PATH13, GET, option).json(),
      $get: (option?: { query?: Methods27['get']['query'], config?: T }) =>
        fetch<Methods27['get']['resBody'], BasicHeaders, Methods27['get']['status']>(prefix, PATH13, GET, option).json().then(r => r.body),
      post: (option?: { body?: Methods27['post']['reqBody'], query?: Methods27['post']['query'], config?: T }) =>
        fetch<void, BasicHeaders, Methods27['post']['status']>(prefix, PATH13, POST, option).send(),
      $post: (option?: { body?: Methods27['post']['reqBody'], query?: Methods27['post']['query'], config?: T }) =>
        fetch<void, BasicHeaders, Methods27['post']['status']>(prefix, PATH13, POST, option).send().then(r => r.body),
      $path: (option?: { method?: 'get'; query: Methods27['get']['query'] } | { method: 'post'; query: Methods27['post']['query'] }) =>
        `${prefix}${PATH13}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    people_multi: {
      _userIds: (val7: string) => {
        const prefix7 = `${PATH20}/${val7}`

        return {
          get: (option?: { query?: Methods31['get']['query'], config?: T }) =>
            fetch<Methods31['get']['resBody'], BasicHeaders, Methods31['get']['status']>(prefix, prefix7, GET, option).json(),
          $get: (option?: { query?: Methods31['get']['query'], config?: T }) =>
            fetch<Methods31['get']['resBody'], BasicHeaders, Methods31['get']['status']>(prefix, prefix7, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods31['get']['query'] }) =>
            `${prefix}${prefix7}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
        }
      }
    },
    ping: {
      get: (option?: { config?: T }) =>
        fetch<Methods32['get']['resBody'], BasicHeaders, Methods32['get']['status']>(prefix, PATH21, GET, option).text(),
      $get: (option?: { config?: T }) =>
        fetch<Methods32['get']['resBody'], BasicHeaders, Methods32['get']['status']>(prefix, PATH21, GET, option).text().then(r => r.body),
      $path: () => `${prefix}${PATH21}`
    },
    posters: {
      _posterId: (val8: string) => {
        const prefix8 = `${PATH17}/${val8}`

        return {
          comments: {
            _commentId: (val9: string) => {
              const prefix9 = `${prefix8}${PATH3}/${val9}`

              return {
                reply: {
                  post: (option?: { body?: Methods37['post']['reqBody'], config?: T }) =>
                    fetch<Methods37['post']['resBody'], BasicHeaders, Methods37['post']['status']>(prefix, `${prefix9}${PATH4}`, POST, option).json(),
                  $post: (option?: { body?: Methods37['post']['reqBody'], config?: T }) =>
                    fetch<Methods37['post']['resBody'], BasicHeaders, Methods37['post']['status']>(prefix, `${prefix9}${PATH4}`, POST, option).json().then(r => r.body),
                  $path: () => `${prefix}${prefix9}${PATH4}`
                },
                patch: (option?: { body?: Methods36['patch']['reqBody'], query?: Methods36['patch']['query'], config?: T }) =>
                  fetch<Methods36['patch']['resBody'], BasicHeaders, Methods36['patch']['status']>(prefix, prefix9, PATCH, option).json(),
                $patch: (option?: { body?: Methods36['patch']['reqBody'], query?: Methods36['patch']['query'], config?: T }) =>
                  fetch<Methods36['patch']['resBody'], BasicHeaders, Methods36['patch']['status']>(prefix, prefix9, PATCH, option).json().then(r => r.body),
                delete: (option?: { query?: Methods36['delete']['query'], config?: T }) =>
                  fetch<Methods36['delete']['resBody'], BasicHeaders, Methods36['delete']['status']>(prefix, prefix9, DELETE, option).json(),
                $delete: (option?: { query?: Methods36['delete']['query'], config?: T }) =>
                  fetch<Methods36['delete']['resBody'], BasicHeaders, Methods36['delete']['status']>(prefix, prefix9, DELETE, option).json().then(r => r.body),
                $path: (option?: { method: 'patch'; query: Methods36['patch']['query'] } | { method: 'delete'; query: Methods36['delete']['query'] }) =>
                  `${prefix}${prefix9}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
              }
            },
            post: (option?: { body?: Methods35['post']['reqBody'], query?: Methods35['post']['query'], config?: T }) =>
              fetch<Methods35['post']['resBody'], BasicHeaders, Methods35['post']['status']>(prefix, `${prefix8}${PATH3}`, POST, option).json(),
            $post: (option?: { body?: Methods35['post']['reqBody'], query?: Methods35['post']['query'], config?: T }) =>
              fetch<Methods35['post']['resBody'], BasicHeaders, Methods35['post']['status']>(prefix, `${prefix8}${PATH3}`, POST, option).json().then(r => r.body),
            get: (option?: { query?: Methods35['get']['query'], config?: T }) =>
              fetch<Methods35['get']['resBody'], BasicHeaders, Methods35['get']['status']>(prefix, `${prefix8}${PATH3}`, GET, option).json(),
            $get: (option?: { query?: Methods35['get']['query'], config?: T }) =>
              fetch<Methods35['get']['resBody'], BasicHeaders, Methods35['get']['status']>(prefix, `${prefix8}${PATH3}`, GET, option).json().then(r => r.body),
            $path: (option?: { method: 'post'; query: Methods35['post']['query'] } | { method?: 'get'; query: Methods35['get']['query'] }) =>
              `${prefix}${prefix8}${PATH3}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          file: {
            get: (option?: { query?: Methods38['get']['query'], config?: T }) =>
              fetch<void, BasicHeaders, Methods38['get']['status']>(prefix, `${prefix8}${PATH22}`, GET, option).send(),
            $get: (option?: { query?: Methods38['get']['query'], config?: T }) =>
              fetch<void, BasicHeaders, Methods38['get']['status']>(prefix, `${prefix8}${PATH22}`, GET, option).send().then(r => r.body),
            post: (option?: { query?: Methods38['post']['query'], config?: T }) =>
              fetch<Methods38['post']['resBody'], BasicHeaders, Methods38['post']['status']>(prefix, `${prefix8}${PATH22}`, POST, option).json(),
            $post: (option?: { query?: Methods38['post']['query'], config?: T }) =>
              fetch<Methods38['post']['resBody'], BasicHeaders, Methods38['post']['status']>(prefix, `${prefix8}${PATH22}`, POST, option).json().then(r => r.body),
            delete: (option?: { query?: Methods38['delete']['query'], config?: T }) =>
              fetch<Methods38['delete']['resBody'], BasicHeaders, Methods38['delete']['status']>(prefix, `${prefix8}${PATH22}`, DELETE, option).json(),
            $delete: (option?: { query?: Methods38['delete']['query'], config?: T }) =>
              fetch<Methods38['delete']['resBody'], BasicHeaders, Methods38['delete']['status']>(prefix, `${prefix8}${PATH22}`, DELETE, option).json().then(r => r.body),
            $path: (option?: { method?: 'get'; query: Methods38['get']['query'] } | { method: 'post'; query: Methods38['post']['query'] } | { method: 'delete'; query: Methods38['delete']['query'] }) =>
              `${prefix}${prefix8}${PATH22}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
          },
          patch: (option?: { body?: Methods34['patch']['reqBody'], config?: T }) =>
            fetch<Methods34['patch']['resBody'], BasicHeaders, Methods34['patch']['status']>(prefix, prefix8, PATCH, option).json(),
          $patch: (option?: { body?: Methods34['patch']['reqBody'], config?: T }) =>
            fetch<Methods34['patch']['resBody'], BasicHeaders, Methods34['patch']['status']>(prefix, prefix8, PATCH, option).json().then(r => r.body),
          $path: () => `${prefix}${prefix8}`
        }
      },
      get: (option?: { query?: Methods33['get']['query'], config?: T }) =>
        fetch<Methods33['get']['resBody'], BasicHeaders, Methods33['get']['status']>(prefix, PATH17, GET, option).json(),
      $get: (option?: { query?: Methods33['get']['query'], config?: T }) =>
        fetch<Methods33['get']['resBody'], BasicHeaders, Methods33['get']['status']>(prefix, PATH17, GET, option).json().then(r => r.body),
      $path: (option?: { method?: 'get'; query: Methods33['get']['query'] }) =>
        `${prefix}${PATH17}${option && option.query ? `?${dataToURLString(option.query)}` : ''}`
    },
    public_key: {
      get: (option?: { config?: T }) =>
        fetch<Methods39['get']['resBody'], BasicHeaders, Methods39['get']['status']>(prefix, PATH23, GET, option).json(),
      $get: (option?: { config?: T }) =>
        fetch<Methods39['get']['resBody'], BasicHeaders, Methods39['get']['status']>(prefix, PATH23, GET, option).json().then(r => r.body),
      post: (option?: { body?: Methods39['post']['reqBody'], config?: T }) =>
        fetch<Methods39['post']['resBody'], BasicHeaders, Methods39['post']['status']>(prefix, PATH23, POST, option).json(),
      $post: (option?: { body?: Methods39['post']['reqBody'], config?: T }) =>
        fetch<Methods39['post']['resBody'], BasicHeaders, Methods39['post']['status']>(prefix, PATH23, POST, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH23}`
    },
    register: {
      post: (option?: { body?: Methods40['post']['reqBody'], config?: T }) =>
        fetch<Methods40['post']['resBody'], BasicHeaders, Methods40['post']['status']>(prefix, PATH24, POST, option).json(),
      $post: (option?: { body?: Methods40['post']['reqBody'], config?: T }) =>
        fetch<Methods40['post']['resBody'], BasicHeaders, Methods40['post']['status']>(prefix, PATH24, POST, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH24}`
    },
    socket_url: {
      get: (option?: { config?: T }) =>
        fetch<Methods41['get']['resBody'], BasicHeaders, Methods41['get']['status']>(prefix, PATH25, GET, option).json(),
      $get: (option?: { config?: T }) =>
        fetch<Methods41['get']['resBody'], BasicHeaders, Methods41['get']['status']>(prefix, PATH25, GET, option).json().then(r => r.body),
      $path: () => `${prefix}${PATH25}`
    }
  }
}

export type ApiInstance = ReturnType<typeof api>
export default api
