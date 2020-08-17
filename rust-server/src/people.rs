use super::auth::Auth;
use super::defs::*;
use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;

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
            "SELECT * FROM person
            LEFT JOIN person_position AS pos ON person.id=pos.person
            LEFT JOIN public_key AS k ON person.id=k.person
            WHERE pos.room=$1",
            &[&room_id],
        )
        .await
        .unwrap();
    let ss = rows.iter().map(|r| PersonInMap {
        id: r.get("id"),
        last_updated: r.get("last_updated"),
        name: r.get("name"),
        avatar: r.get("avatar"),
        email: r.get("email"),
        role: r.get("role"),
        x: r.get::<_, i32>("x") as u32,
        y: r.get::<_, i32>("y") as u32,
        direction: r.get("direction"),
    });
    let ss2: Vec<PersonInMap> = ss.collect();
    HttpResponse::Ok().json(ss2)
}

pub async fn get_all_people(data: web::Data<MyData>, _auth: Auth) -> HttpResponse {
    let conn = data.pg.get().await.unwrap();
    let rows = conn
        .query(
            "SELECT * FROM person
            LEFT JOIN public_key AS k ON person.id=k.person",
            &[],
        )
        .await
        .unwrap();
    let ss = rows.iter().map(|r| Person {
        id: r.get("id"),
        last_updated: r.get("last_updated"),
        name: r.get("name"),
        avatar: r.get("avatar"),
        email: r.get("email"),
        role: r.get("role"),
    });
    let ss2: Vec<Person> = ss.collect();
    HttpResponse::Ok().json(ss2)
}

pub async fn post_people(_data: web::Data<MyData>) -> HttpResponse {
    HttpResponse::Ok().json(json!({"ok": false, "error": "Stub"}))
}

pub async fn get_people_multi(_path: web::Path<String>, _data: web::Data<MyData>) -> HttpResponse {
    HttpResponse::Ok().json(json!({"ok": false, "error": "Stub"}))
}

pub async fn get_person(
    path: web::Path<String>,
    data: web::Data<MyData>,
    _auth: Auth,
) -> HttpResponse {
    let user_id = path.as_str();
    let conn = data.pg.get().await.unwrap();
    let rows = conn
        .query(
            "SELECT id,last_updated,name,avatar,email,role from person WHERE id=$1",
            &[&user_id],
        )
        .await
        .unwrap();
    let ss = rows.iter().map(|r| Person {
        id: r.get("id"),
        last_updated: r.get("last_updated"),
        name: r.get("name"),
        avatar: r.get("avatar"),
        email: r.get("email"),
        role: r.get("role"),
    });
    let ss2: Vec<Person> = ss.collect();
    if ss2.len() > 0 {
        HttpResponse::Ok().json(&ss2[0])
    } else {
        HttpResponse::NotFound().body("Not found")
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
