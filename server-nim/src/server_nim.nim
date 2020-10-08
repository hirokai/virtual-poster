# This is just an example to get you started. A typical binary package
# uses this file as the main entry point of the application.

import jester,json,sequtils,strutils
import db_postgres

var settings = newSettings()

settings.port = Port(5050)

let db = open("127.0.0.1:5432","postgres","postgres","virtual_poster")

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

routes:
  get "/api/ping":
    resp "pong"

  get "/api/maps/@roomId/people":
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