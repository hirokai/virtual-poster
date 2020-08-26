use super::auth::Auth;
use super::defs::*;
use super::emit::*;
use super::model::*;
use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;

pub async fn join_group(
    _data: web::Data<MyData>, 
    _auth: Auth,
    _path: web::Path<(String,)>,
) -> HttpResponse {
    HttpResponse::Ok().json(json!({"ok": false, "error": "Stub"}))
}

#[derive(Deserialize)]
pub struct LeaveGroupPath {
    roomId: String,
    groupId: String,
}

pub async fn leave_group(
    data: web::Data<MyData>,
    auth: Auth,
    path: web::Path<LeaveGroupPath>,
) -> HttpResponse {
    let conn = data.pg.get().await.unwrap();
    conn.query(
        "DELETE FROM person_in_chat_group WHERE person=$1 and chat=$2",
        &[&auth.user, &path.groupId],
    )
    .await
    .unwrap();
    let row = conn
        .query_one(
            "SELECT count(*) AS c FROM person_in_chat_group WHERE chat=$1",
            &[&path.groupId],
        )
        .await
        .unwrap();
    if row.get::<_, i64>("c") <= 1 {
        conn.query(
            "DELETE FROM person_in_chat_group WHERE chat=$1",
            &[&path.groupId],
        )
        .await
        .unwrap();
        conn.query("DELETE FROM chat_group WHERE id=$1", &[&path.groupId])
            .await
            .unwrap();
        emit(
            &vec![&path.roomId],
            &AppNotification::GroupRemove {
                id: path.groupId.clone(),
            },
        )
        .await;
    }

    HttpResponse::Ok().json(json!({"ok": true}))
}

pub async fn add_people_to_group(
    _data: web::Data<MyData>,
    _auth: Auth,
    _path: web::Path<(String,)>,
) -> HttpResponse {
    HttpResponse::Ok().json(json!({"ok": false, "error": "Stub"}))
}

pub async fn get_room_groups(
    data: web::Data<MyData>,
    _auth: Auth,
    roomId: web::Path<String>,
) -> HttpResponse {
    let room = roomId.as_str();
    let conn = data.pg.get().await.unwrap();
    let rows = if room == "__any__" {
        conn.query("SELECT g.*,string_agg(pcg.person,'::::') as users from chat_group as g join person_in_chat_group as pcg on g.id=pcg.chat GROUP BY g.id", &[]).await.unwrap()
    } else {
        conn.query("SELECT g.*,string_agg(pcg.person,'::::') as users from chat_group as g join person_in_chat_group as pcg on g.id=pcg.chat WHERE g.room=$1 GROUP BY g.id", &[&room]).await.unwrap()
    };
    let groups: Vec<ChatGroup> = rows
        .iter()
        .map(|r| {
            let us: Vec<String> = r
                .get::<_, String>("users")
                .split("::::")
                .map(|s| s.to_string())
                .collect();
            ChatGroup {
                id: r.get("id"),
                users: us,
                room: r.get("room"),
                color: r.get("color"),
                kind: r.get("kind"),
            }
        })
        .collect();
    HttpResponse::Ok().json(json!(groups))
}
#[derive(Debug, Serialize, Deserialize)]
pub struct GetRoomGroupsBody {
    pub fromUser: String,
    pub toUsers: Vec<String>,
}

pub async fn post_group(
    data: web::Data<MyData>,
    room: web::Path<String>,
    web::Json(payload): web::Json<GetRoomGroupsBody>,
    _auth: Auth,
) -> HttpResponse {
    let room = room.as_str();
    let from_user = payload.fromUser;
    let to_users = payload.toUsers;
    let r = start_chat(&data.pg, room, &from_user, &to_users).await;
    match r {
        Ok(r) => {
            emit(
                &vec![&r.room],
                &AppNotification::GroupNew { group: r.clone() },
            )
            .await;
            HttpResponse::Ok().json(json!({"ok": true, "group": r}))
        }
        Err(e) => HttpResponse::Ok().json(json!({"ok": false, "error": e})),
    }
}

pub async fn get_group_of_person(
    _data: web::Data<MyData>,
    _auth: Auth,
    _path: web::Path<(String,)>,
) -> HttpResponse {
    HttpResponse::Ok().json(json!({"ok": false, "error": "Stub"}))
}
