import json,db_postgres,sets,strutils,sequtils,options

let db* = open("127.0.0.1:5432","postgres","postgres","virtual_poster")

type CommentEncrypted = ref object
    to: string
    text: string
    encrypted: bool

type ChatComment = ref object
  id: string
  timestamp: int64
  last_updated: int64
  room: string
  person: string
  x: int
  y: int
  kind: string
  texts: seq[CommentEncrypted]
  reply_to: Option[string]

func parse_array_agg(s: string): seq[string] =
  var inside_quote = false
  var token_started = false
  var escaped = false
  var tokens = newSeq[string]()
  var s_accum = ""
  for i in 0..<s.len():
    if s[i] == '\"' and not escaped and not inside_quote:
      inside_quote=true
      token_started=true
    elif s[i] == '\"' and not escaped and inside_quote:
      inside_quote=false
    elif s[i] == '\\' and not escaped:
      escaped = true
    elif s[i] == ',' and not escaped:
      if inside_quote:
        s_accum &= s[i]
      else:
        tokens.add(s_accum)
        s_accum = ""        
    elif s[i] == '{' and not escaped:
      if inside_quote:
        s_accum &= s[i]
      else:
        token_started = true
        s_accum = ""
    elif s[i] == '}' and not escaped:
      if inside_quote:
        s_accum &= s[i]
      else:
        token_started = false
        tokens.add(s_accum)
        s_accum = ""
    else:
      escaped = false
      s_accum &= s[i]
  tokens

proc mapComments*(user_id: string, room_id: string): json.JsonNode =
  var comments = newSeq[ChatComment]()
  var comment_ids: HashSet[string]

  proc parse_row(row: seq[string], room_id: string): ChatComment {.inline.} =
    let for_users = parse_array_agg(row[6])
    let comments_for_users = parse_array_agg(row[7])
    let encrypted_for_users: seq[bool] = parse_array_agg(row[5]).mapIt(if it == "t": true else: false)
    var texts = newSeq[CommentEncrypted](for_users.len())
    for i in 0..<for_users.len():
      texts.add(CommentEncrypted(to: for_users[i],text: comments_for_users[i],encrypted: encrypted_for_users[i]))
    # echo(row[7],comments_for_users)
    ChatComment(id: row[1], timestamp: parseInt(row[8]), last_updated: parseInt(row[9]),person: row[2],texts: texts,room: room_id, kind: row[10], x: parseInt(row[3]), y: parseInt(row[4]), reply_to: if row[12] == "": none[string]() else: some(row[12]))

  for row in db.fastRows(sql"""
        SELECT
            'from_me' AS mode,
            c.id AS id,
            c.person,
            c.x,
            c.y,
            array_agg(cp.encrypted) AS to_e,
            array_agg(cp.person) AS to,
            array_agg(cp.comment_encrypted) AS to_c,
            c.timestamp,
            c.last_updated,
            c.kind,
            c.text,
            c.reply_to
        FROM
            comment AS c
            LEFT JOIN comment_to_person AS cp ON c.id = cp.comment
        WHERE
            c.person = ?
            AND room = ?
            AND kind = 'person'
        GROUP BY
            c.id,
            c.x,
            c.y,
            c.text,
            c.timestamp,
            c.last_updated,
            c.person,
            c.kind,
            c.text
        ORDER BY
            c.timestamp;
        ;
        """, [user_id,room_id]):
    let id = row[1]
    if not (id in comment_ids):
      comment_ids.incl(id)
      comments.add(parse_row(row,room_id))
    # echo(row)
  for row in db.fastRows(sql"""SELECT
            'to_me' AS mode,
            c.id AS id,
            c.person,
            c.x,
            c.y,
            array_agg(cp2.encrypted) AS to_e,
            array_agg(cp2.person) AS to,
            array_agg(cp2.comment_encrypted) AS to_c,
            c.timestamp,
            c.last_updated,
            c.kind,
            c.text,
            c.reply_to
        FROM
            comment AS c
            LEFT JOIN comment_to_person AS cp ON c.id = cp.comment
            LEFT JOIN comment_to_person AS cp2 ON c.id = cp2.comment
        WHERE
            cp.person = ?
            AND room = ?
            AND kind = 'person'
        GROUP BY
            c.id,
            c.x,
            c.y,
            c.text,
            c.timestamp,
            c.last_updated,
            c.person,
            c.kind,
            c.text
        ORDER BY
            c.timestamp;
        """,[user_id,room_id]):
    let id = row[1]
    if not (id in comment_ids):
      comment_ids.incl(id)
      comments.add(parse_row(row,room_id))
    # echo(row)
  %*comments
