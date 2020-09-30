use actix::prelude::*;
use actix_redis::RedisActor;
use bb8_postgres::bb8::Pool;
use bb8_postgres::PostgresConnectionManager;
use postgres_types::{FromSql, ToSql};
use serde::{Deserialize, Serialize};
// use sqlx;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use strum_macros::{Display, EnumString};

pub type UserId = String;
pub type RoomId = String;
pub type GroupId = String;
pub type CommentId = String;
pub type PosterId = String;
pub type MapCellId = String;
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
    pub location: MapCellId,
    pub x: usize,
    pub y: usize,
    pub poster_number: usize,
    pub custom_image: Option<String>,
}
#[derive(Debug, Serialize, Default, Clone)]
pub struct MapCell {
    pub id: MapCellId,
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
pub struct PersonPos {
    pub x: u32,
    pub y: u32,
    pub direction: direction,
    pub room: String,
    pub user: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Person {
    pub id: String,
    pub last_updated: i64,
    pub name: String,
    pub avatar: Option<String>,
    pub connected: Option<bool>,
    pub stats: PersonStat,
    pub public_key: Option<String>,
}

pub struct PersonWithEmail {
    pub id: String,
    pub last_updated: i64,
    pub name: String,
    pub avatar: Option<String>,
    pub connected: Option<bool>,
    pub stats: PersonStat,
    pub public_key: Option<String>,
    pub email: Option<String>,
}

pub struct PersonWithEmailRooms {
    pub id: String,
    pub last_updated: i64,
    pub name: String,
    pub avatar: Option<String>,
    pub connected: Option<bool>,
    pub stats: PersonStat,
    pub public_key: Option<String>,
    pub email: Option<String>,
    pub rooms: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PersonStat {}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PersonInMap {
    pub id: String,
    pub last_updated: i64,
    pub name: String,
    pub avatar: Option<String>,
    pub connected: Option<bool>,
    pub stats: PersonStat,
    pub public_key: Option<String>,
    pub room: String,
    pub x: u32,
    pub y: u32,
    pub direction: direction,
    pub moving: bool,
    pub poster_viewing: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PersonUpdate {
    pub id: String,
    pub last_updated: i64,
    pub room: Option<String>,
    pub x: Option<u32>,
    pub y: Option<u32>,
    pub moving: Option<bool>,
    pub direction: Option<direction>,
    pub name: Option<String>,
    pub avatar: Option<String>,
    pub connected: Option<bool>,
    pub poster_viewing: Option<Option<String>>,
    pub stats: Option<PersonStat>,
    pub public_key: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Point {
    pub x: u32,
    pub y: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PosDir {
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
pub struct CommentEncryptedEntry {
    pub text: String,
    pub to: UserId,
    pub encrypted: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatComment {
    pub id: String,
    pub person: String,
    pub room: RoomId,
    pub x: u32,
    pub y: u32,
    pub texts: Vec<CommentEncryptedEntry>,
    pub timestamp: i64,
    pub last_updated: i64,
    pub kind: String,
    pub reply_to: Option<CommentId>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Announcement {
    pub room: String,
    pub text: String,
    pub marquee: bool,
    pub period: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PosterCommentDecrypted {
    pub id: String,
    pub timestamp: i64,
    pub last_updated: i64,
    pub room: RoomId,
    pub x: u32,
    pub y: u32,
    pub poster: PosterId,
    pub person: UserId,
    pub text_decrypted: String,
    pub reply_to: Option<CommentId>,
    pub reactions: Option<HashMap<String, HashMap<UserId, CommentId>>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActiveUserData {
    pub room: RoomId,
    pub user: String,
    pub active: bool,
}

// Commanad from REST API server
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AppNotification {
    Announce {
        announce: Announcement,
    },
    Person {
        person: Person,
    },
    PersonNew {
        person: Vec<PersonInMap>,
    },
    PersonUpdate {
        person: Vec<PersonUpdate>,
    },
    PersonRemove {
        id: Vec<String>,
    },
    AuthError,
    Moved {
        room: RoomId,
        positions: Vec<Move>,
    },
    MoveError {
        pos: Option<PosDir>,
        user_id: String,
        error: String,
    },
    Group {
        group: ChatGroup,
    },
    GroupRemove {
        id: String,
    },
    Comment {
        comment: ChatComment,
    },
    CommentRemove {
        id: String,
    },
    PosterComment {
        comment: PosterCommentDecrypted,
    },
    PosterCommentRemove {
        id: String,
    },
    PosterReset,
    Poster {
        poster: Poster,
    },
    PosterRemove {
        id: String,
    },
    MapReset,
    ActiveUsers {
        data: Vec<ActiveUserData>,
    },
    ChatTyping {
        room: RoomId,
        user: UserId,
        typing: bool,
    },
    MoveRequest {
        to_poster: PosterId,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub enum MsgFromUser {
    Move {
        room: RoomId,
        x: u32,
        y: u32,
        user: UserId,
    },
    Direction {
        room: RoomId,
        direction: direction,
    },
    Active {
        user: UserId,
        room: RoomId,
        token: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        debug_as: Option<String>,
    },
    Subscribe {
        channel: String,
    },
    Unsubscribe {
        channel: String,
    },
    ChatTyping {
        user: UserId,
        room: RoomId,
        typing: bool,
    },
}
