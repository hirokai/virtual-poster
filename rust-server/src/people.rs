use super::auth::Auth;
use super::defs::*;
use crate::emit::emit;
use actix_web::{cookie::Cookie, web, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use time;

#[derive(Deserialize, Serialize)]
pub struct PatchPersonData {
    email: Option<String>,
    name: Option<String>,
    avatar: Option<String>,
}

pub async fn get_room_people(
    room_id: web::Path<String>,
    data: web::Data<MyData>,
    _auth: Auth,
) -> HttpResponse {
    let room_id = room_id.as_str();
    let conn = data.pg.get().await.unwrap();
    let rows = conn
        .query(
            " SELECT
              person.*,
              pos.x,
              pos.y,
              pos.direction,
              k.*
          FROM
              person
              LEFT JOIN person_position AS pos ON person.id = pos.person
              LEFT JOIN public_key AS k ON person.id = k.person
          WHERE
              pos.room = $1
          GROUP BY
              person.id,
              pos.x,
              pos.y,
              pos.direction,
              k.person;",
            &[&room_id],
        )
        .await
        .unwrap();
    let rows2 = conn
        .query(
            " SELECT
              *
          FROM
              poster_viewer
          WHERE
              poster IN (
                  SELECT
                      id
                  FROM
                      poster
                  WHERE
                      location IN (
                          SELECT
                              id
                          FROM
                              map_cell
                          WHERE
                              room = $1
                      )
              )
              AND left_time IS NULL;",
            &[&room_id],
        )
        .await
        .unwrap();
    //   data.redis_sessions.

    let connected: HashSet<UserId> = HashSet::new(); //Stub

    /*
    const connected = room_id
      ? new Set(await redis.sockets.smembers("room:" + room_id + ":__all__"))
      : new Set<string>()

    const count_all_sockets_for_users = await redis.sockets.hgetall(
      "room:" + "__any__"
    )

    const poster_viewers = _.groupBy(rows2, "person")

    // log.debug(count_all_sockets_for_users)
    return rows.map(row => {
      const uid = row["id"] as UserId
      const poster_viewing = poster_viewers[uid]
        ? poster_viewers[uid][0]?.poster
        : undefined
      const r: PersonInMap & {
        email?: string
        rooms?: RoomId[]
        poster_viewing?: PosterId
      } = {
        name: row["name"],
        rooms: row["rooms"] ? row["rooms"].split("::::") : [],
        stats: {
          walking_steps: 0,
          people_encountered: [],
          chat_count: 0,
          chat_char_count: 0,
        },
        public_key: row["public_key"],
        id: uid,
        last_updated: parseInt(row["last_updated"]),
        connected: room_id
          ? connected.has(row.id)
          : count_all_sockets_for_users[row.id] &&
            parseInt(count_all_sockets_for_users[row.id]) > 0
          ? true
          : false,
        room: room_id || "N/A",
        avatar: row["avatar"],
        x: row["x"],
        y: row["y"],
        direction: row["direction"],
        moving: false,
      }
      if (poster_viewing) {
        r.poster_viewing = poster_viewing
      }
      if (with_email) {
        r.email = row["email"]
      }
      return r
    })
        */
    let ss: Vec<PersonInMap> = rows
        .iter()
        .map(|r| {
            let a = 1u32;
            PersonInMap {
                id: r.get("id"),
                last_updated: r.get("last_updated"),
                name: r.get("name"),
                avatar: r.get("avatar"),
                connected: None, // Stub
                stats: PersonStat {},
                public_key: r.get("public_key"),
                room: room_id.to_owned(),
                x: r.get::<_, i32>("x") as u32,
                y: r.get::<_, i32>("y") as u32,
                direction: r.get("direction"),
                moving: false,
                poster_viewing: None, //Stub
            }
        })
        .collect();
    HttpResponse::Ok().json(ss)
}

pub async fn get_all_people(data: web::Data<MyData>, _auth: Auth) -> HttpResponse {
    let conn = data.pg.get().await.unwrap();
    let rows = conn
        .query(
            "
                SELECT
                    person.*,
                    string_agg(ra.room, '::::') AS rooms,
                    k.public_key
                FROM
                    person
                    LEFT JOIN person_room_access AS ra ON person.id = ra.person
                    LEFT JOIN public_key AS k ON person.id = k.person
                GROUP BY
                    person.id,
                    k.public_key;",
            &[],
        )
        .await
        .unwrap();
    let ss = rows.iter().map(|r| Person {
        id: r.get("id"),
        last_updated: r.get("last_updated"),
        public_key: r.get("public_key"),
        stats: PersonStat {},
        connected: None, //Stub
        name: r.get("name"),
        avatar: r.get("avatar"),
    });
    let ss2: Vec<Person> = ss.collect();
    HttpResponse::Ok().json(ss2)
}

pub async fn get_person(
    path: web::Path<String>,
    data: web::Data<MyData>,
    _auth: Auth,
) -> HttpResponse {
    let user_id = path.as_str();
    let conn = data.pg.get().await.unwrap();
    let row = conn
        .query_opt(
            "
            SELECT
                *
            FROM
                person
                LEFT JOIN public_key AS k ON person.id = k.person
            WHERE
                id = $1;
            ",
            &[&user_id],
        )
        .await
        .unwrap();
    match row {
        Some(r) => {
            let p = Person {
                id: r.get("id"),
                last_updated: r.get("last_updated"),
                name: r.get("name"),
                avatar: r.get("avatar"),
                connected: None, // Stub,
                stats: PersonStat {},
                public_key: r.get("public_key"),
            };
            HttpResponse::Ok().json(&p)
        }
        None => HttpResponse::NotFound().body("Not found"),
    }
}

pub async fn patch_person(
    path: web::Path<String>,
    body: web::Json<PatchPersonData>,
    data: web::Data<MyData>,
    auth: Auth,
) -> HttpResponse {
    let user_id = path.as_str();
    if auth.user != user_id && auth.user_type != UserType::Admin {
        HttpResponse::Unauthorized().body("Do not have write access to this user's information")
    } else {
        let conn = data.pg.get().await.unwrap();
        conn.query("BEGIN", &[]).await.unwrap();
        // FIXME: Use a single query instead of multiple sequential ones.
        if let Some(email) = &body.email {
            conn.query(
                "UPDATE person SET email=$2 from person WHERE id=$1",
                &[&user_id, email],
            )
            .await
            .unwrap();
        }
        if let Some(avatar) = &body.avatar {
            conn.query(
                "UPDATE person SET avatar=$2 from person WHERE id=$1",
                &[&user_id, avatar],
            )
            .await
            .unwrap();
        }
        if let Some(name) = &body.name {
            conn.query(
                "UPDATE person SET name=$2 from person WHERE id=$1",
                &[&user_id, name],
            )
            .await
            .unwrap();
        }
        conn.query("COMMIT", &[]).await.unwrap();

        HttpResponse::Ok().body("")
    }
}

#[derive(Deserialize)]
pub struct RegisterUserData {
    email: String,
    name: String,
    access_code: Option<String>,
}

fn random_avatar() -> String {
    String::from("001")
}

// Stub
async fn create_person(
    email: &str,
    name: &str,
    user_type: UserType,
    avatar: &str,
    rooms: &Vec<String>,
    strategy: &str,
) -> Result<PersonWithEmailRooms, String> {
    Err("Stub".to_string())
}

// Stub
fn get_allowed_rooms_from_code(code: &str) -> Option<Vec<String>> {
    Some(vec![])
}

async fn create_session_id(t: UserType, email: &str, uid: &str) -> String {
    "".to_string()
}

pub async fn post_person() -> HttpResponse {
    return HttpResponse::Ok().json(json!({"ok": false, "errror": "Stub"}));
}

pub async fn register_user(auth: Auth, body: web::Json<RegisterUserData>) -> HttpResponse {
    if &auth.email != &body.email {
        warn!("Incorrect email: {} {}", &auth.email, &body.email);
        return HttpResponse::Ok().json(json!({"ok": false, "errror": "Incorrect email address"}));
    }
    let rooms = get_allowed_rooms_from_code(&body.access_code.as_ref().unwrap_or(&"".to_string()));
    if rooms.is_none() {
        return HttpResponse::Ok().json(json!({"ok": false, "errror": "Access code is invalid"}));
    }
    let rooms: Vec<String> = rooms.unwrap();
    let avatar = random_avatar();
    let r = create_person(
        &body.email,
        &body.name,
        UserType::Normal,
        &avatar,
        &rooms,
        &"reject",
    )
    .await;
    if let Err(e) = r {
        return HttpResponse::Ok().json(json!({"ok": false, "errror": e}));
    }
    let user = r.unwrap();
    let sid = create_session_id(UserType::Normal, &body.email, &user.id).await;
    //Stub
    for room in user.rooms {
        let p = PersonInMap {
            id: user.id.to_owned(),
            last_updated: user.last_updated,
            room: room.to_owned(),
            x: 0,
            y: 0,
            name: user.name.to_owned(),
            avatar: user.avatar.to_owned(),
            direction: direction::none,
            connected: None,
            moving: false,
            poster_viewing: None,
            public_key: None,
            stats: PersonStat {},
        };
        emit(
            &vec![&room],
            &AppNotification::PersonNew { person: vec![p] },
        )
        .await;
    }

    let mut tm = time::now();
    tm.tm_mday += 3;

    let cookie = Cookie::build("virtual_poster_session_id", sid)
        .expires(tm)
        .http_only(true)
        .finish();
    HttpResponse::Ok().cookie(cookie).json(json!({"ok": true}))
}
