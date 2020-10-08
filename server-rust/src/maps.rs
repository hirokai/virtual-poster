use super::auth::Auth;
use super::defs::*;
use actix_redis::Command;
use actix_web::{web, HttpResponse};
use redis_async::resp::RespValue;
use redis_async::resp_array;
use serde_json::json;
use std::time::Instant;

pub async fn get_rooms(
    // _path: web::Path<String>,
    data: web::Data<MyData>,
    auth: Auth,
) -> HttpResponse {
    let conn = data.pg.get().await.unwrap();
    let rows = if auth.user_type == UserType::Admin {
        conn.query(
            "
        SELECT
            room.id,
            room.name,
            count(c.poster_number) AS poster_location_count,
            count(poster.id) AS poster_count,
            max(c.x) AS max_x,
            max(c.y) AS max_y
        FROM
            room
            LEFT JOIN map_cell AS c ON room.id = c.room
            LEFT JOIN poster ON c.id = poster.location
        GROUP BY
            room.id;
            ",
            &[],
        )
        .await
        .unwrap()
    } else {
        conn.query(
            "
        SELECT
            room.id,
            room.name,
            count(c.poster_number) as poster_location_count,
            count(poster.id) as poster_count,
            max(c.x) as max_x,
            max(c.y) as max_y
        FROM
            room
            LEFT JOIN map_cell as c on room.id = c.room
            LEFT JOIN poster ON c.id = poster.location
            JOIN person_room_access AS a ON room.id = a.room
        WHERE
            a.person = $1
        GROUP BY
            room.id;",
            &[&auth.user],
        )
        .await
        .unwrap()
    };
    let ss = rows.iter().map(|r| Room {
        id: r.get(0),
        name: r.get(1),
        poster_location_count: r.get::<_, i64>("poster_location_count") as usize,
        poster_count: r.get::<_, i64>("poster_count") as usize,
        numCols: r.get::<_, i32>("max_x") as usize + 1,
        numRows: r.get::<_, i32>("max_y") as usize + 1,
    });
    let ss2: Vec<Room> = ss.collect();
    HttpResponse::Ok().json(ss2)
}

pub async fn get_room(
    data: web::Data<MyData>,
    _auth: Auth,
    path: web::Path<(String,)>,
) -> HttpResponse {
    let start = Instant::now();
    let conn = data.pg.get().await.unwrap();
    let end = start.elapsed();
    println!("connected {} µs", end.subsec_nanos() / 1000);

    let start = Instant::now();
    let one = data.redis.send(Command(resp_array![
        "GET",
        format!("map_cache:{}", &path.0)
    ]));
    let resp = one.await.unwrap().unwrap();
    let s: Option<String> = match resp {
        RespValue::BulkString(v) => Some(std::str::from_utf8(&v).unwrap().to_string()),
        RespValue::SimpleString(s) => Some(s),
        _ => None,
    };
    let end = start.elapsed();
    println!("Redis read {} µs", end.subsec_nanos() / 1000);
    if s.is_some() {
        return HttpResponse::Ok().json(s.unwrap());
    }

    let start = Instant::now();
    let rows = conn
        .query(
            "SELECT id,room,x,y,kind,poster_number,custom_image from map_cell where room=$1",
            &[&path.0],
        )
        .await
        .unwrap();
    let end = start.elapsed();
    println!("query done {} µs", end.subsec_nanos() / 1000);
    let start = Instant::now();
    let ss = rows.iter().map(|r| MapCell {
        id: r.get("id"),
        room: r.get("room"),
        x: r.get::<&str, i32>("x") as usize,
        y: r.get::<&str, i32>("y") as usize,
        kind: r.get("kind"),
        poster_number: r.get("poster_number"),
        custom_image: r.get("custom_image"),
    });
    let cell_list: Vec<MapCell> = ss.collect();

    let end = start.elapsed();
    println!("collected {} µs", end.subsec_nanos() / 1000);
    let start = Instant::now();
    let mut num_cols: usize = 0;
    let mut num_rows: usize = 0;

    for c in &cell_list {
        num_cols = std::cmp::max((c.x + 1) as usize, num_cols);
        num_rows = std::cmp::max((c.y + 1) as usize, num_rows);
    }
    let mut cells = vec![vec![MapCell::default(); num_cols]; num_rows];
    for c in cell_list {
        let x = c.x;
        let y = c.y;
        cells[y][x] = c;
    }

    let end = start.elapsed();
    println!("num_cols calc'd {} µs", end.subsec_nanos() / 1000);

    let start = Instant::now();
    let one = data.redis.send(Command(resp_array![
        "SET",
        format!("map_cache:{}", &path.0),
        format!(
            "{}",
            json!({"cells": cells, "numCols": num_cols, "numRows": num_rows})
        )
    ]));
    one.await.unwrap().unwrap();
    let end = start.elapsed();
    println!("Redis wrote {} µs", end.subsec_nanos() / 1000);
    HttpResponse::Ok().json(json!({"cells": cells, "numCols": num_cols, "numRows": num_rows}))
}

pub async fn enter_room(
    data: web::Data<MyData>,
    auth: Auth,
    room_id: web::Path<String>,
) -> HttpResponse {
    let (ok, status) =
        super::model::enter_room(&data.pg, data.redis.clone(), room_id.as_str(), &auth.user).await;
    HttpResponse::Ok().json(if ok {
        // emit(
        //     &vec![],
        //     &SocketFromAPIServer::AddUserToNamespace {
        //         namespace: room_id.into_inner(),
        //         user: auth.user,
        //     },
        // )
        // .await;
        // json!({"ok": true, "socket_url": "ws://localhost:5000/ws/"})
        let socket_url = "ws://localhost:5000/ws".to_string();
        json!({
            "ok": true,
          "socket_url": socket_url,
          "socket_protocol": "WebSocket"
        })
    } else {
        json!({"ok": false, "error": format!("{}",status)})
    })
}

struct _MapCellRDB {
    id: String,
    room: String,
    x: i32,
    y: i32,
    kind: String,
    poster_number: Option<i32>,
    custom_image: Option<String>,
}
