use super::auth::Auth;
use super::defs::*;
use actix_web::{web, HttpResponse};
use serde_json::json;

pub async fn get_posters_of_room(
    data: web::Data<MyData>,
    _auth: Auth,
    room: web::Path<String>,
) -> HttpResponse {
    let room = room.as_str();
    let conn = data.pg.get().await.unwrap();

    let rows = if room != "__any__" {
        conn.query(
            "SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image
        FROM poster AS p
        JOIN map_cell AS c ON p.location=c.id
        WHERE location IN (SELECT id FROM map_cell WHERE room=$1);",
            &[&room],
        )
        .await
        .unwrap()
    } else {
        conn.query(
            "
            SELECT p.*,c.room,c.x,c.y,c.poster_number,c.custom_image from poster as p
            JOIN map_cell AS c ON p.location=c.id;",
            &[],
        )
        .await
        .unwrap()
    };
    let posters: Vec<Poster> = rows
        .iter()
        .map(|r| Poster {
            id: r.get("id"),
            room: r.get("room"),
            last_updated: r.get("last_updated"),
            author: r.get("author"),
            title: r.get("title"),
            poster_number: r.get::<_, i32>("poster_number") as usize,
            location: r.get("location"),
            custom_image: r.get("custom_image"),
            x: r.get::<_, i32>("x") as usize,
            y: r.get::<_, i32>("y") as usize,
        })
        .collect();
    HttpResponse::Ok().json(json!(posters))
}
