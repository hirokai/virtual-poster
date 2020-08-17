use super::auth::Auth;
use super::defs::*;
use actix_web::{web, HttpResponse};
use serde_json::json;
use std::collections::HashSet;
use tokio_postgres::row::Row;

pub async fn patch_comments(
    _data: web::Data<MyData>,
    _auth: Auth,
    _path: web::Path<(String,)>,
) -> HttpResponse {
    HttpResponse::Ok().json(json!({"ok": false, "error": "Stub"}))
}

pub async fn delete_comments(
    _data: web::Data<MyData>,
    _auth: Auth,
    _path: web::Path<(String,)>,
) -> HttpResponse {
    HttpResponse::Ok().json(json!({"ok": false, "error": "Stub"}))
}

pub async fn get_comments(
    data: web::Data<MyData>,
    auth: Auth,
    room_id: web::Path<String>,
) -> HttpResponse {
    let conn = data.pg.get().await.unwrap();
    let user_id = auth.user.as_str();
    let room_id = room_id.as_str();

    let from_me = conn
        .query(
            "SELECT
            'from_me' AS mode,
            c.id AS id,c.person,c.x,c.y,array_agg(cp.encrypted) AS to_e,
            string_agg(cp.person,'::::') AS to,string_agg(cp.comment_encrypted,'::::') AS to_c,
            c.timestamp,c.last_updated,c.kind,c.text,c.room
        FROM comment AS c
        LEFT JOIN comment_to_person AS cp ON c.id=cp.comment
        WHERE
            c.person=$1
            AND room=$2 
            AND kind='person'
        GROUP BY c.id, c.x, c.y,c.text,c.timestamp,c.last_updated,c.person,c.kind,c.text
        ORDER BY c.timestamp",
            &[&user_id, &room_id],
        )
        .await
        .unwrap();
    let to_me = conn
        .query(
            "SELECT
            'to_me' as mode,
            c.id as id,c.person,c.x,c.y,array_agg(cp2.encrypted) as to_e,
            string_agg(cp2.person,'::::') as to,string_agg(cp2.comment_encrypted,'::::') as to_c,
            c.timestamp,c.last_updated,c.kind,c.text,c.room
        FROM comment AS c
        LEFT JOIN comment_to_person AS cp ON c.id=cp.comment
        LEFT JOIN comment_to_person AS cp2 ON c.id=cp2.comment
        WHERE
            cp.person=$1
            AND room=$2 
            AND kind='person'
        GROUP BY c.id, c.x, c.y,c.text,c.timestamp,c.last_updated,c.person,c.kind,c.text
        ORDER BY c.timestamp",
            &[&user_id, &room_id],
        )
        .await
        .unwrap();

    let mut ds: Vec<ChatComment> = Vec::with_capacity(from_me.len() + to_me.len());
    let mut ids = HashSet::new();
    fn read_row(r: Row) -> ChatComment {
        let id: String = r.get("id");
        let to: Vec<String> = r
            .get::<_, String>("to")
            .split("::::")
            .map(|s| s.to_string())
            .collect();
        let comments_for_users: Vec<String> = r
            .get::<_, String>("to_c")
            .split("::::")
            .map(|s| s.to_string())
            .collect();
        ChatComment {
            id,
            to,
            comments_for_users,
            encrypted: r.get("to_e"),
            kind: r.get("kind"),
            timestamp: r.get::<_, i64>("timestamp"),
            last_updated: r.get::<_, i64>("last_updated"),
            person: r.get("person"),
            room: r.get("room"),
            text: None, //Stub
            x: r.get::<_, i32>("x") as usize,
            y: r.get::<_, i32>("y") as usize,
        }
    }
    for r in from_me {
        let c = read_row(r);
        ids.insert(c.id.clone());
        ds.push(c)
    }
    for r in to_me {
        let id: String = r.get("id");
        if !ids.contains(&id) {
            let c = read_row(r);
            ds.push(c)
        }
    }
    /*

    .map(|r|{
        const for_users: string[] = (r["to"] || "").split("::::")
        const comments_for_users: string[] = (r["to_c"] || "").split("::::")
        const encrypted_for_users: boolean[] = r["to_e"]
        const idx = _.indexOf(for_users, user_id)
        r.to = for_users
        r.encrypted = encrypted_for_users
        r.text =
          encrypted_for_users[idx] == null ? r["text"] : comments_for_users[idx]
        delete r["to_c"]
        delete r["to_e"]
        delete r["mode"]
        r["timestamp"] = parseInt(r["timestamp"])
        r["last_updated"] = parseInt(r["last_updated"])
        return r
      });
      */
    HttpResponse::Ok().json(json!(ds))
}
