/* eslint-disable */
import { AspidaClient, BasicHeaders, dataToURLString } from 'aspida'
import { Methods as Methods0 } from '.'
import { Methods as Methods1 } from './_userId@string'
import { Methods as Methods2 } from './_userId@string/access_code'
import { Methods as Methods3 } from './_userId@string/posters'

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? 'http://localhost:3000/api' : baseURL).replace(/\/$/, '')
  const PATH0 = '/people'
  const PATH1 = '/access_code'
  const PATH2 = '/posters'
  const GET = 'GET'
  const POST = 'POST'
  const PATCH = 'PATCH'

  return {
    _userId: (val0: string) => {
      const prefix0 = `${PATH0}/${val0}`

      return {
        access_code: {
          post: (option?: { body?: Methods2['post']['reqBody'], config?: T }) =>
            fetch<Methods2['post']['resBody'], BasicHeaders, Methods2['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).json(),
          $post: (option?: { body?: Methods2['post']['reqBody'], config?: T }) =>
            fetch<Methods2['post']['resBody'], BasicHeaders, Methods2['post']['status']>(prefix, `${prefix0}${PATH1}`, POST, option).json().then(r => r.body),
          $path: () => `${prefix}${prefix0}${PATH1}`
        },
        posters: {
          get: (option?: { query?: Methods3['get']['query'], config?: T }) =>
            fetch<Methods3['get']['resBody'], BasicHeaders, Methods3['get']['status']>(prefix, `${prefix0}${PATH2}`, GET, option).json(),
          $get: (option?: { query?: Methods3['get']['query'], config?: T }) =>
            fetch<Methods3['get']['resBody'], BasicHeaders, Methods3['get']['status']>(prefix, `${prefix0}${PATH2}`, GET, option).json().then(r => r.body),
          $path: (option?: { method?: 'get'; query: Methods3['get']['query'] }) =>
            `${prefix}${prefix0}${PATH2}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
        },
        get: (option?: { query?: Methods1['get']['query'], config?: T }) =>
          fetch<Methods1['get']['resBody'], BasicHeaders, Methods1['get']['status']>(prefix, prefix0, GET, option).json(),
        $get: (option?: { query?: Methods1['get']['query'], config?: T }) =>
          fetch<Methods1['get']['resBody'], BasicHeaders, Methods1['get']['status']>(prefix, prefix0, GET, option).json().then(r => r.body),
        patch: (option?: { body?: Methods1['patch']['reqBody'], query?: Methods1['patch']['query'], config?: T }) =>
          fetch<Methods1['patch']['resBody'], BasicHeaders, Methods1['patch']['status']>(prefix, prefix0, PATCH, option).json(),
        $patch: (option?: { body?: Methods1['patch']['reqBody'], query?: Methods1['patch']['query'], config?: T }) =>
          fetch<Methods1['patch']['resBody'], BasicHeaders, Methods1['patch']['status']>(prefix, prefix0, PATCH, option).json().then(r => r.body),
        $path: (option?: { method?: 'get'; query: Methods1['get']['query'] } | { method: 'patch'; query: Methods1['patch']['query'] }) =>
          `${prefix}${prefix0}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
      }
    },
    get: (option?: { query?: Methods0['get']['query'], config?: T }) =>
      fetch<Methods0['get']['resBody'], BasicHeaders, Methods0['get']['status']>(prefix, PATH0, GET, option).json(),
    $get: (option?: { query?: Methods0['get']['query'], config?: T }) =>
      fetch<Methods0['get']['resBody'], BasicHeaders, Methods0['get']['status']>(prefix, PATH0, GET, option).json().then(r => r.body),
    post: (option?: { body?: Methods0['post']['reqBody'], query?: Methods0['post']['query'], config?: T }) =>
      fetch<void, BasicHeaders, Methods0['post']['status']>(prefix, PATH0, POST, option).send(),
    $post: (option?: { body?: Methods0['post']['reqBody'], query?: Methods0['post']['query'], config?: T }) =>
      fetch<void, BasicHeaders, Methods0['post']['status']>(prefix, PATH0, POST, option).send().then(r => r.body),
    $path: (option?: { method?: 'get'; query: Methods0['get']['query'] } | { method: 'post'; query: Methods0['post']['query'] }) =>
      `${prefix}${PATH0}${option?.query ? `?${dataToURLString(option.query)}` : ''}`
  }
}

export type ApiInstance = ReturnType<typeof api>
export default api
