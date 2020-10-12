# This is just an example to get you started. A typical binary package
# uses this file as the main entry point of the application.

import jester,json,sequtils,strutils,redis,strformat,redpool,options,asyncdispatch,httpbeast
import db_postgres
import model

var pool {.threadvar.}: redpool.RedisPool

type Person = object
  id: string
  name: string
  last_updated: int64
  avatar: string
  x: int
  y: int
  direction: string
  role: string
  public_key: string


proc getUser(request: jester.Request): Future[Option[string]] {.async, gcsafe.} =
  let params = request.params()
  if "debug_as" in params:
    return some(params["debug_as"])
  if pool.isNil:
    pool = waitFor redpool.newRedisPool(5, timeout=4, maxConns=7)
  let c = request.cookies["virtual_poster_session_id"]
  if len(c) > 0:
    echo(fmt"Cookie {c}")
    pool.withAcquire(conn):
      discard await conn.select(3)
      let uid = await conn.get(fmt"cookie:uid:{c}")
      if uid != redis.redisNil:
        echo(fmt"Authed: {uid}")
        return some(uid)
      else:
        return none[string]()
  else:
    return none[string]()

router myrouter:
  get "/api/ping":
    resp "pong"

  get "/api/maps/@roomId/people":
    let u = await getUser(request)
    echo(u)

    var people = newSeq[Person]()
    for row in db.fastRows(sql"""
    SELECT
            person.id,
            person.last_updated,
            person.name,
            person.avatar,
            person.email,
            person.role,
            pos.x,
            pos.y,
            pos.direction,
            k.public_key
        FROM
            person
            LEFT JOIN person_position AS pos ON person.id = pos.person
            LEFT JOIN public_key AS k ON person.id = k.person
        WHERE
            pos.room = ?
        GROUP BY
            person.id,
            pos.x,
            pos.y,
            pos.direction,
            k.person;""",[@"roomId"]):
      people.add(Person(id: row[0], name: row[2], avatar: row[3], x: parseInt(row[6]),y: parseInt(row[7]), direction: row[8], role: row[5], public_key: row[9],last_updated: parseInt(row[1])))
    resp %*people

  get "/api/maps/@roomId/comments":
    let u = await getUser(request)
    if u.isSome():
      resp mapComments(u.get(),@"roomId")

proc main() {.async.} =
  var settings = newSettings()
  settings.port = Port(5050)
  var jester = initJester(myrouter, settings=settings)
  jester.serve()

when isMainModule:
  asyncdispatch.waitFor main()