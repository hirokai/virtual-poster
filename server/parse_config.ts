// To parse this data:
//
//   import { Convert, Config } from "./file";
//
//   const config = Convert.toConfig(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface Config {
  domain: string
  api_server: APIServer
  socket_server: SocketServer
  default_rooms: string[]
  certificate_folder: string
  postgresql: string
  redis: string
  aws: Aws
  firebase_auth_credential: string
  user_registration: boolean
  profile_keys: string[]
  cookie_expires: number
  debug_token: string
}

export interface APIServer {
  port: number
  tls: boolean
  http2: boolean
  cluster: number
  debug_log: boolean
}

export interface Aws {
  access_key_id: string
  secret_access_key: string
  region: string
  s3: S3
  cloud_front: CloudFront
}

export interface CloudFront {
  id: string
  domain: string
  key_pair_id: string
  private_key: string
}

export interface S3 {
  upload: boolean
  bucket: string
  via_cdn: boolean
}

export interface SocketServer {
  system: string
  port: number
  tls: boolean
  http2: boolean
  cluster: number
  debug_log: boolean
}

function invalidValue(typ: any, val: any, key: any = ""): never {
  if (key) {
    throw Error(
      `Invalid value for key "${key}". Expected type ${JSON.stringify(
        typ
      )} but got ${JSON.stringify(val)}`
    )
  }
  throw Error(
    `Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`
  )
}

function a(typ: any) {
  return { arrayItems: typ }
}

function u(...typs: any[]) {
  return { unionMembers: typs }
}

function o(props: any[], additional: any) {
  return { props, additional }
}

function m(additional: any) {
  return { props: [], additional }
}

function r(name: string) {
  return { ref: name }
}

const typeMap: any = {
  Config: o(
    [
      { json: "domain", js: "domain", typ: "" },
      { json: "api_server", js: "api_server", typ: r("APIServer") },
      { json: "socket_server", js: "socket_server", typ: r("SocketServer") },
      { json: "default_rooms", js: "default_rooms", typ: a("") },
      { json: "certificate_folder", js: "certificate_folder", typ: "" },
      { json: "postgresql", js: "postgresql", typ: "" },
      { json: "redis", js: "redis", typ: "" },
      { json: "aws", js: "aws", typ: r("Aws") },
      {
        json: "firebase_auth_credential",
        js: "firebase_auth_credential",
        typ: "",
      },
      { json: "user_registration", js: "user_registration", typ: true },
      { json: "profile_keys", js: "profile_keys", typ: a("") },
      { json: "cookie_expires", js: "cookie_expires", typ: 0 },
      { json: "debug_token", js: "debug_token", typ: "" },
    ],
    false
  ),
  APIServer: o(
    [
      { json: "port", js: "port", typ: 0 },
      { json: "tls", js: "tls", typ: true },
      { json: "http2", js: "http2", typ: true },
      { json: "cluster", js: "cluster", typ: 0 },
      { json: "debug_log", js: "debug_log", typ: true },
    ],
    false
  ),
  Aws: o(
    [
      { json: "access_key_id", js: "access_key_id", typ: "" },
      { json: "secret_access_key", js: "secret_access_key", typ: "" },
      { json: "region", js: "region", typ: "" },
      { json: "s3", js: "s3", typ: r("S3") },
      { json: "cloud_front", js: "cloud_front", typ: r("CloudFront") },
    ],
    false
  ),
  CloudFront: o(
    [
      { json: "id", js: "id", typ: "" },
      { json: "domain", js: "domain", typ: "" },
      { json: "key_pair_id", js: "key_pair_id", typ: "" },
      { json: "private_key", js: "private_key", typ: "" },
    ],
    false
  ),
  S3: o(
    [
      { json: "upload", js: "upload", typ: true },
      { json: "bucket", js: "bucket", typ: "" },
      { json: "via_cdn", js: "via_cdn", typ: true },
    ],
    false
  ),
  SocketServer: o(
    [
      { json: "system", js: "system", typ: "" },
      { json: "port", js: "port", typ: 0 },
      { json: "tls", js: "tls", typ: true },
      { json: "http2", js: "http2", typ: true },
      { json: "cluster", js: "cluster", typ: 0 },
      { json: "debug_log", js: "debug_log", typ: true },
    ],
    false
  ),
}
function transform(val: any, typ: any, getProps: any, key: any = ""): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val
    return invalidValue(typ, val, key)
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length
    for (let i = 0; i < l; i++) {
      const typ = typs[i]
      try {
        return transform(val, typ, getProps)
      } catch (_) {
        //
      }
    }
    return invalidValue(typs, val)
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val
    return invalidValue(cases, val)
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue("array", val)
    return val.map(el => transform(el, typ, getProps))
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null
    }
    const d = new Date(val)
    if (isNaN(d.valueOf())) {
      return invalidValue("Date", val)
    }
    return d
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any
  ): any {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return invalidValue("object", val)
    }
    const result: any = {}
    Object.getOwnPropertyNames(props).forEach(key => {
      const prop = props[key]
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined
      result[prop.key] = transform(v, prop.typ, getProps, prop.key)
    })
    Object.getOwnPropertyNames(val).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key)
      }
    })
    return result
  }

  if (typ === "any") return val
  if (typ === null) {
    if (val === null) return val
    return invalidValue(typ, val)
  }
  if (typ === false) return invalidValue(typ, val)
  while (typeof typ === "object" && typ.ref !== undefined) {
    typ = typeMap[typ.ref]
  }
  if (Array.isArray(typ)) return transformEnum(typ, val)
  if (typeof typ === "object") {
    return Object.prototype.hasOwnProperty.call(typ, "unionMembers")
      ? transformUnion(typ.unionMembers, val)
      : Object.prototype.hasOwnProperty.call(typ, "arrayItems")
      ? transformArray(typ.arrayItems, val)
      : Object.prototype.hasOwnProperty.call(typ, "props")
      ? transformObject(getProps(typ), typ.additional, val)
      : invalidValue(typ, val)
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== "number") return transformDate(val)
  return transformPrimitive(typ, val)
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {}
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }))
    typ.jsonToJS = map
  }
  return typ.jsonToJS
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {}
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }))
    typ.jsToJSON = map
  }
  return typ.jsToJSON
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps)
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps)
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toConfig(json: string): Config {
    return cast(JSON.parse(json), r("Config"))
  }

  public static configToJson(value: Config): string {
    return JSON.stringify(uncast(value, r("Config")), null, 2)
  }
}
