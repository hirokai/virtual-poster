use actix::prelude::*;
use actix_redis::RedisActor;
use bb8_postgres::bb8::Pool;
use bb8_postgres::PostgresConnectionManager;
use postgres_types::{FromSql, ToSql};
use serde::{Deserialize, Serialize};
// use sqlx;
use std::time::{SystemTime, UNIX_EPOCH};
use strum_macros::{Display, EnumString};

pub type UserId = String;
pub type RoomId = String;
pub type GroupId = String;
pub type CommentId = String;
pub type PgPool = Pool<PostgresConnectionManager<tokio_postgres::NoTls>>;

#[derive(Clone)]
pub struct MyData {
    pub pg: PgPool,
    // pub pgx: sqlx::Pool<sqlx::Postgres>,
    pub redis: Addr<RedisActor>,
    pub redis_sync: redis::Client,
    pub redis_sync_sessions: redis::Client,
    pub debug_token: String,
}

#[derive(PartialEq, Eq, Debug, Deserialize)]
pub enum UserType {
    Normal,
    Admin,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Poster {
    pub id: String,
    pub last_updated: i64,
    pub title: Option<String>,
    pub author: Option<UserId>,
    pub room: RoomId,
    pub x: usize,
    pub y: usize,
    pub poster_number: usize,
    pub custom_image: Option<String>,
}
#[derive(Debug, Serialize, Default, Clone)]
pub struct MapCell {
    pub id: String,
    pub room: String,
    pub x: usize,
    pub y: usize,
    pub kind: String,
    pub poster_number: Option<i32>,
    pub custom_image: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, ToSql, FromSql)]
pub enum user_role {
    user,
    admin,
}

#[derive(Serialize, Deserialize, Display, Debug, Clone, ToSql, FromSql, EnumString)]
pub enum direction {
    up,
    down,
    left,
    right,
    none,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Person {
    pub id: String,
    pub last_updated: i64,
    pub name: String,
    pub avatar: Option<String>,
    pub email: String,
    pub role: Option<user_role>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PersonInMap {
    pub id: String,
    pub last_updated: i64,
    pub name: String,
    pub avatar: Option<String>,
    pub email: String,
    pub role: Option<user_role>,
    pub x: u32,
    pub y: u32,
    pub direction: direction,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Point {
    pub x: u32,
    pub y: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Position {
    pub x: u32,
    pub y: u32,
    pub direction: direction,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Room {
    pub id: String,
    pub name: String,
    pub poster_location_count: usize,
    pub poster_count: usize,
    pub numRows: usize,
    pub numCols: usize,
}

#[derive(Display, Debug, Serialize, Deserialize, Clone, ToSql, FromSql)]
pub enum chat_type {
    poster,
    people,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatGroup {
    pub id: GroupId,
    pub room: RoomId,
    pub users: Vec<UserId>,
    pub color: String,
    pub kind: chat_type,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatComment {
    pub id: CommentId,
    pub texts: Vec<CommentEncryptedEntry>,
    pub timestamp: i64,
    pub last_updated: i64,
    pub room: RoomId,
    pub x: usize,
    pub y: usize,
    pub person: UserId,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CommentEncryptedEntry {
    pub text: String,
    pub to: UserId,
    pub encrypted: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CommentEncrypted {
    pub id: String,
    pub person: String,
    pub room: RoomId,
    pub x: u32,
    pub y: u32,
    pub texts: Vec<CommentEncryptedEntry>,
    pub timestamp: i64,
    pub last_updated: i64,
    pub kind: String,
}

pub fn get_timestamp() -> Option<i64> {
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH);
    since_the_epoch.ok().map(|s| s.as_millis() as i64)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Move {
    pub user: UserId,
    pub x: u32,
    pub y: u32,
    pub direction: direction,
}

// Commanad from REST API server
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AppNotification {
    Person { person: Person },
    PersonNew { person: Person },
    PersonUpdate { person: Person },
    PersonRemove { id: String },
    Group { group: ChatGroup },
    GroupUpdate { group: ChatGroup },
    GroupRemove { id: String },
    PosterFileUpdate { id: String },
    Poster { poster: Poster },
    PosterRemove { id: String },
    PosterComment { comment: CommentEncrypted },
    PosterCommentRemove { id: String },
    Comment { comment: CommentEncrypted },
    CommentRemove { id: String },
    Moved { room: RoomId, move_data: Vec<Move> },
    UserActive { room: RoomId, user: String },
    /*
    | "Announce"
    | "AuthError"
    | "MoveError"
    | "PosterReset"
    | "MapReset"
    | "ActiveUsers"
    | "ChatTyping"
    | "MoveRequest"
    */
}

#[derive(Debug, Serialize, Deserialize)]
pub enum MsgFromUser {
    Move {
        room: String,
        x: u32,
        y: u32,
        user: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        debug_as: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        debug_token: Option<String>,
    },
    Active {
        user: String,
        room: String,
        token: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        debug_as: Option<String>,
    },
    Subscribe {
        channel: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        debug_as: Option<String>,
    },
}
