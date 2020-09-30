use super::auth::Auth;
use super::defs::*;
use crate::emit;
use crate::model;
use actix_web::{web, HttpResponse};
use itertools::izip;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashSet;
use tokio_postgres::row::Row;
use uuid::Uuid;

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
            c.reply_to,
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
            c.reply_to,
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
        let cs: Option<String> = r.get::<_, Option<String>>("to_c");
        let comments_for_users: Vec<String> = match cs {
            Some(cs) => cs.split("::::").map(|s| s.to_string()).collect(),
            None => vec![],
        };
        let encrypted = r
            .try_get::<_, Vec<bool>>("to_e")
            .ok()
            .unwrap_or([false].repeat(comments_for_users.len()));
        let texts: Vec<CommentEncryptedEntry> = izip!(comments_for_users, to, encrypted)
            .map(|(text, to, encrypted)| CommentEncryptedEntry {
                text,
                to,
                encrypted,
            })
            .collect();
        ChatComment {
            id,
            texts,
            kind: r.get("kind"),
            timestamp: r.get::<_, i64>("timestamp"),
            last_updated: r.get::<_, i64>("last_updated"),
            person: r.get("person"),
            room: r.get("room"),
            x: r.get::<_, i32>("x") as u32,
            y: r.get::<_, i32>("y") as u32,
            reply_to: r.get("reply_to"),
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

pub async fn post_comment(
    data: web::Data<MyData>,
    body: web::Json<Vec<CommentEncryptedEntry>>,
    auth: Auth,
    params: web::Path<(String, String)>,
) -> HttpResponse {
    let room_id = params.0.to_string();
    let timestamp = get_timestamp().unwrap();
    match model::get_person_pos(&data.pg, &room_id, &auth.user).await {
        None => HttpResponse::Ok().json(json!({"ok": false, "error": "Position not found"})),
        Some(pos) => {
            let e = ChatComment {
                id: Uuid::new_v4().to_hyphenated().to_string(),
                person: auth.user,
                room: room_id.clone(),
                x: pos.x,
                y: pos.y,
                kind: "person".to_string(),
                texts: body.to_vec(),
                timestamp,
                last_updated: timestamp,
                reply_to: None, //Stub
            };
            let r = model::chat::addCommentEncrypted(&e).await;
            if r {
                let notification = AppNotification::Comment { comment: e.clone() };
                emit::emit(&vec![&room_id], &notification).await;
                HttpResponse::Ok().json(json!({"ok": true, "comment": e}))
            } else {
                HttpResponse::Ok().json(json!({"ok": false, "error": "DB error"}))
            }
        }
    }
    /*
      userLog({
        userId: requester,
        operation: "comment.new",
        data: { text: comment || comments_encrypted },
      })
      const group = await model.chat.getGroupOfUser(roomId, requester)
      const pos = await model.people.getPos(requester, roomId)
      if (!pos) {
        throw { statusCode: 400, message: "User position not found" }
      }
      const map = model.maps[roomId]
      if (!map) {
        throw { statusCode: 400, message: "Room not found" }
      }
    */
}
