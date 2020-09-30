use crate::defs::*;
use actix::prelude::*;
use actix_redis::{Command, RedisActor};
use redis_async::resp::RespValue;
use redis_async::resp_array;
use strum_macros::Display;
use uuid::Uuid;

#[derive(Display)]
pub enum EnterStatus {
    New,
    ComeBack,
    NoAccess,
    Deleted,
    NoSpace,
}

pub async fn init_redis_cache(pg: &PgPool, redis: Addr<RedisActor>) -> () {
    let conn = pg.get().await.unwrap();
    let rows = conn
        .query("SELECT * FROM person_position", &[])
        .await
        .unwrap();
    for row in rows {
        let x: i32 = row.get("x");
        let y: i32 = row.get("y");
        let direction: direction = row.get("direction");
        let room: String = row.get("room");
        let person: String = row.get("person");
        redis
            .send(Command(resp_array![
                "SET",
                format!("pos:{}:{}", &room, &person),
                format!("{}.{}.{}", &x, &y, &direction)
            ]))
            .await
            .unwrap()
            .unwrap();
    }
}

pub async fn _get_user_type(redis: Addr<RedisActor>, email: &str) -> Option<UserType> {
    let one = redis.send(Command(resp_array![
        "EXISTS",
        format!("uid:{}", email),
        format!("uid:{}:admin", email)
    ]));
    let k = one.await.unwrap().unwrap();
    let count = match k {
        RespValue::Integer(v) => v,
        _ => 0,
    };
    return if count == 2 {
        Some(UserType::Admin)
    } else if count == 1 {
        Some(UserType::Normal)
    } else {
        None
    };
}

pub async fn enter_room(
    pg: &PgPool,
    redis: Addr<RedisActor>,
    room_id: &str,
    user: &str,
) -> (bool, EnterStatus) {
    let conn = pg.get().await.unwrap();
    let row = conn
        .query_one("SELECT count(*) as c FROM room WHERE id=$1", &[&room_id])
        .await
        .unwrap();
    if row.get::<_, i64>("c") == 0 {
        return (false, EnterStatus::Deleted);
    }
    let row = conn
        .query_one(
            "SELECT count(*) as c FROM person_position where person=$1 and room=$2;",
            &[&user, &room_id],
        )
        .await
        .unwrap();
    if row.get::<_, i64>("c") == 0 {
        return assign_user_position(pg, redis, room_id, user).await;
    }
    return (true, EnterStatus::ComeBack);
}

async fn assign_user_position(
    pg: &PgPool,
    redis: Addr<RedisActor>,
    room: &str,
    user: &str,
) -> (bool, EnterStatus) {
    let conn = pg.get().await.unwrap();
    let row = conn
        .query_one(
            "SELECT count(*) as c from person_room_access where room=$1 and person=$2;",
            &[&room, &user],
        )
        .await
        .unwrap();
    if row.get::<_, i64>("c") == 0 {
        return (false, EnterStatus::NoAccess);
    }
    let last_updated = get_timestamp();
    let direction = direction::down;
    let rows = conn
        .query(
            "INSERT INTO person_position
                (room,person,last_updated,x,y,direction)
            SELECT
                $1,$2,$3,x,y,$4 FROM map_cell 
            WHERE
                room=$1
                AND (x,y) NOT IN
                    (SELECT x,y FROM person_position WHERE room=$1)
                AND kind NOT IN ('water','wall','poster','poster_seat')
            ORDER BY RANDOM()
            LIMIT 1
                RETURNING x,y;
        ",
            &[&room, &user, &last_updated, &direction],
        )
        .await
        .unwrap();
    if rows.len() == 1 {
        let one = redis.send(Command(resp_array![
            "SET",
            format!("{}:{}", &room, &user),
            format!(
                "{}.{}.{}",
                rows[0].get::<_, i32>("x"),
                rows[0].get::<_, i32>("y"),
                &direction
            )
        ]));
        one.await.unwrap().unwrap();
        (true, EnterStatus::New)
    } else {
        (false, EnterStatus::NoSpace)
    }
}

pub async fn start_chat(
    pg: &PgPool,
    room: &str,
    from_user: &str,
    to_users: &Vec<String>,
) -> Result<ChatGroup, String> {
    let conn = pg.get().await.unwrap();
    let users = vec![vec![from_user.to_string()], to_users.clone()].concat();
    let rows = conn
        .query(
            "SELECT
                id from chat_group as g
            JOIN
                person_in_chat_group AS pcg ON g.id=pcg.chat
            WHERE pcg.person IN ($1) AND g.room=$2",
            &[&users.join(","), &room],
        )
        .await
        .unwrap();
    if rows.len() > 0 {
        Err("Member(s) are already in chat".to_string())
    } else {
        let last_updated = get_timestamp().unwrap();
        let group_id = format!("{}", Uuid::new_v4());
        let color = "blue".to_string();
        conn.query("BEGIN", &[]).await.unwrap();
        conn.query(
            "
            INSERT INTO chat_group
                (id,name,last_updated,room,location,color,kind)
            SELECT $1,$2,$3,$4,map_cell.id,$5,$6
            FROM person_position
            JOIN map_cell
            ON
                map_cell.x=person_position.x
                AND map_cell.y=person_position.y 
                AND map_cell.room=person_position.room
            WHERE
                person_position.person=$7
                AND person_position.room=$4        
            ",
            &[
                &group_id,
                &"Group".to_string(),
                &last_updated,
                &room,
                &color,
                &chat_type::people,
                &from_user,
            ],
        )
        .await
        .unwrap();
        for u in &users {
            conn.query(
                "
                INSERT INTO person_in_chat_group (person,chat)
                VALUES ($1,$2)",
                &[&u, &group_id],
            )
            .await
            .unwrap();
        }

        conn.query("COMMIT", &[]).await.unwrap();

        Ok(ChatGroup {
            id: group_id,
            kind: chat_type::people,
            color,
            room: room.to_string(),
            users,
        })
    }
}

pub async fn get_person_pos(pg: &PgPool, room: &str, person: &str) -> Option<PosDir> {
    let conn = pg.get().await.unwrap();
    let rows = conn
        .query(
            "SELECT
                x,y,direction
            FROM
                person_position
            WHERE person=$1 AND  room=$2",
            &[&person, &room],
        )
        .await
        .unwrap();
    if rows.len() == 1 {
        let x: i32 = rows[0].get("x");
        let y: i32 = rows[0].get("y");
        let direction: direction = rows[0].get("direction");
        Some(PosDir {
            x: x as u32,
            y: y as u32,
            direction,
        })
    } else {
        None
    }
}

pub mod chat {
    use crate::defs::*;

    pub async fn addCommentEncrypted(_e: &ChatComment) -> bool {
        true
    }
}
