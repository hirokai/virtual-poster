//! `PubSubServer` is an actor. It maintains list of connection client session.
//! And manages available rooms. Peers send messages to other peers in same
//! room through `PubSubServer`.

use super::*;
use actix_redis::{Command, RedisActor, RespValue};
use defs::*;
use rand::prelude::*;
use rand::{self};
use redis_async::resp_array;
use serde_json;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use tokio::time::delay_for;
use uuid::Uuid;

const emulate_delay: bool = false;

// type SessionId = u128;

/// Chat server sends this messages to session
#[derive(Message)]
#[rtype(result = "()")]
pub struct Message(pub String);

/// Message for chat server communications

/// New chat session is created
#[derive(Message)]
#[rtype(u128)]
pub struct Connect {
    pub addr: Recipient<Message>,
}

impl<M> actix::dev::MessageResponse<PubSubServer, M> for u128
where
    M: actix::dev::Message<Result = u128>,
{
    fn handle<R: actix::dev::ResponseChannel<M>>(
        self,
        _: &mut Context<PubSubServer>,
        tx: Option<R>,
    ) {
        if let Some(tx) = tx {
            tx.send(self);
        }
    }
}

/// Session is disconnected
#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub id: u128,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct DataFromUser {
    pub data: MsgFromUser,
    pub user_id: String,
    pub session_id: u128,
}

#[derive(Message, Deserialize, Debug)]
#[rtype(result = "()")]
pub struct DataFromAPIServer {
    pub data: AppNotification,
    pub channels: Vec<String>,
}

/// Join room, if room does not exists create new one.
#[derive(Message)]
#[rtype(result = "()")]
pub struct Join {
    /// Client id
    pub id: usize,
    /// Room name
    pub name: String,
}

/// `PubSubServer` manages chat rooms and responsible for coordinating chat
/// session. implementation is super primitive
pub struct PubSubServer {
    sessions: HashMap<u128, Recipient<Message>>,
    topics: HashMap<String, HashSet<u128>>,
    user_of_session: HashMap<u128, (UserId, RoomId)>,
    session_of_user: HashMap<(UserId, RoomId), HashSet<u128>>,
    redis: Addr<RedisActor>,
    pg: bb8_postgres::bb8::Pool<bb8_postgres::PostgresConnectionManager<tokio_postgres::NoTls>>,
}

impl PubSubServer {
    pub fn init(
        pg: bb8_postgres::bb8::Pool<bb8_postgres::PostgresConnectionManager<tokio_postgres::NoTls>>,
        redis_conn_str: &str,
    ) -> PubSubServer {
        // default room
        let mut topics = HashMap::new();
        topics.insert("all".to_owned(), HashSet::new());
        let ts = redis_conn_str.split("://").collect::<Vec<&str>>();
        let mut redis_conn_str_normalized = redis_conn_str;
        if ts.len() > 1 {
            redis_conn_str_normalized = ts[1];
        }
        let redis = RedisActor::start(redis_conn_str_normalized.to_string());

        PubSubServer {
            sessions: HashMap::new(),
            user_of_session: HashMap::new(),
            session_of_user: HashMap::new(),
            topics,
            redis,
            pg,
        }
    }
    /// Send message to all users in the room
    fn send_message(&self, room: &str, message: &str, skip_id: Option<u128>) {
        send_message(&self.sessions, &self.topics, room, message, skip_id);
    }
}

fn send_message(
    sessions: &HashMap<u128, Recipient<Message>>,
    topics: &HashMap<String, HashSet<u128>>,
    room: &str,
    message: &str,
    skip_id: Option<u128>,
) {
    debug!("{:?}", topics);
    let mut ids: HashSet<u128> = HashSet::new();
    if let Some(sessions_in_topic) = topics.get(room) {
        for id in sessions_in_topic {
            if *id != skip_id.unwrap_or(0) {
                ids.insert(*id);
            }
        }
    }
    for id in ids {
        if let Some(addr) = sessions.get(&id) {
            let _ = addr.do_send(Message(message.to_owned()));
        }
    }
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Ping;

impl Handler<Ping> for PubSubServer {
    type Result = ();

    fn handle(&mut self, item: Ping, ctx: &mut Context<PubSubServer>) -> () {
        println!("ping");
    }
}

/// Make actor from `PubSubServer`
impl Actor for PubSubServer {
    /// We are going to use simple Context, we just need ability to communicate
    /// with other actors.
    type Context = Context<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {}
}

/// Handler for Connect message.
///
/// Register new session and assign unique id to this session
impl Handler<Connect> for PubSubServer {
    type Result = u128;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> u128 {
        println!("Someone connected");

        // notify all users in same room
        // self.send_message(&"Main".to_owned(), "Someone joined", 0);

        // register session with random id
        let id = Uuid::new_v4().as_u128();
        self.sessions.insert(id, msg.addr);

        // auto join session to Main room
        self.topics
            .entry("all".to_owned())
            .or_insert(HashSet::new())
            .insert(id);

        // send id back
        id
    }
}

/// Handler for Disconnect message.
impl Handler<Disconnect> for PubSubServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, ctx: &mut Context<Self>) {
        info!("Someone disconnected");

        // remove address
        if self.sessions.remove(&msg.id).is_some() {
            // remove session from all rooms
            let mut topics_to_remove: HashSet<String> = HashSet::new();
            for (name, sessions_in_topic) in &mut self.topics {
                sessions_in_topic.remove(&msg.id);
                if sessions_in_topic.is_empty() {
                    topics_to_remove.insert(name.to_string());
                }
            }
            for t in topics_to_remove {
                self.topics.remove(&t);
            }
        }
        if let Some((u, r)) = self.user_of_session.get(&msg.id) {
            let mut remove_flag = false;
            let ss = self
                .session_of_user
                .get_mut(&(u.to_string(), r.to_string()));
            if let Some(ss) = ss {
                ss.remove(&msg.id);
                if ss.is_empty() {
                    remove_flag = true;
                    let obj = AppNotification::ActiveUsers {
                        data: vec![ActiveUserData {
                            room: r.to_string(),
                            user: u.to_string(),
                            active: false,
                        }],
                    };
                    let s = serde_json::to_string(&encode_for_client(&obj)).unwrap();
                    send_message(&self.sessions, &self.topics, &r, &s, None);
                }
            }
            if remove_flag {
                self.session_of_user.remove(&(u.to_string(), r.to_string()));
                let redis = self.redis.clone();
                let key = format!("connected_users:room:{}:__all__", &r);
                let u = u.clone();
                async move {
                    redis
                        .send(Command(resp_array!["SREM", &key, &u.to_string()]))
                        .await
                        .unwrap()
                        .unwrap();
                }
                .into_actor(self)
                .then(|res, act, ctx| fut::ready(()))
                .wait(ctx);
            }
            self.user_of_session.remove(&msg.id);
        }
        debug!("{:?}", self.topics);
    }
}

fn encode_for_client(obj: &AppNotification) -> serde_json::Value {
    match obj {
        AppNotification::Moved {
            room: _room,
            positions,
        } => {
            let s = positions
                .iter()
                .map(
                    |Move {
                         user,
                         x,
                         y,
                         direction,
                     }| {
                        format!("{},{},{},{}", user, x, y, &direction.to_string()[0..1])
                    },
                )
                .collect::<Vec<String>>()
                .join(";");
            json!({ "type": "Moved", "data": s })
        }
        obj => serde_json::to_value(&obj).unwrap(),
    }
}

fn parse_pos(s: &str) -> Option<(Point, direction)> {
    let ts: Vec<&str> = s.split(".").collect();
    let x = ts[0].parse::<u32>().ok()?;
    let y = ts[1].parse::<u32>().ok()?;
    let d = direction::from_str(ts[2]).ok()?;
    Some((Point { x, y }, d))
}

fn calc_direction(from: &Point, to: &Point) -> direction {
    if from.x == to.x {
        if (from.y > to.y) {
            return direction::up;
        } else if (from.y < to.y) {
            return direction::down;
        } else {
            return direction::none;
        }
    } else if (from.x > to.x) {
        return direction::left;
    } else {
        return direction::right;
    }
}

/// Handler for DataFromUser message.
impl Handler<DataFromUser> for PubSubServer {
    type Result = ();

    fn handle(&mut self, msg: DataFromUser, ctx: &mut Context<Self>) {
        let mut rng = rand::thread_rng();
        let start = Instant::now();
        debug!("{:?}", start);
        match msg.data {
            MsgFromUser::Subscribe { channel, .. } => {
                show_time();
                self.topics
                    .entry(channel.clone())
                    .or_insert(HashSet::new())
                    .insert(msg.session_id);

                debug!("Channels: {:?}", self.topics);
            }
            MsgFromUser::Unsubscribe { channel, .. } => {
                show_time();
                self.topics
                    .entry(channel.clone())
                    .or_insert(HashSet::new())
                    .remove(&msg.session_id);
                debug!("Channels: {:?}", self.topics);
            }
            MsgFromUser::Move { room, x, y, .. } => {
                let redis = self.redis.clone();
                let user_id = msg.user_id.clone();
                let session_id = msg.session_id.clone();
                let room1 = room.clone();
                let addr = ctx.address();
                let sessions = self.sessions.clone();
                let topics = self.topics.clone();
                let pg = self.pg.clone();
                async move {
                    if emulate_delay {
                        let delay: u64 = rng.gen_range(20, 200);
                        delay_for(Duration::from_millis(delay)).await;
                    }
                    let key = format!("pos:{}:{}", &room1, user_id.clone());
                    let resp = redis
                        .send(Command(resp_array!["GET", &key]))
                        .await
                        .unwrap()
                        .unwrap();
                    let s: String = match resp {
                        RespValue::BulkString(v) => std::str::from_utf8(&v).unwrap().to_string(),
                        RespValue::SimpleString(s) => s,
                        _ => "".to_string(),
                    };
                    let pos: Option<(Point, direction)> = parse_pos(&s);
                    match pos {
                        None => warn!("Pos parse failed: '{}' (key: '{}')", s, &key),
                        Some(pos) => {
                            if (pos.0.x as i32 - (x as i32)).abs() > 1
                                || (pos.0.y as i32 - (y as i32)).abs() > 1
                            {
                                warn!("Not ajacent point");
                            } else {
                                let direction = calc_direction(&pos.0, &Point { x, y });
                                println!("{:?}", &pos);
                                let new_pos = (Point { x, y }, direction);
                                let resp = redis
                                    .send(Command(resp_array![
                                        "SET",
                                        format!("pos:{}:{}", &room1, &user_id),
                                        format!("{}.{}.{}", new_pos.0.x, new_pos.0.y, &new_pos.1)
                                    ]))
                                    .await
                                    .unwrap()
                                    .unwrap();
                                let start = Instant::now();
                                let conn = pg.get().await.unwrap();
                                conn.query(
                                    "UPDATE
                                            person_position
                                        SET
                                            x=$3,
                                            y=$4
                                        WHERE
                                            person=$1
                                            AND room=$2",
                                    &[
                                        &user_id,
                                        &room,
                                        &(new_pos.0.x as i32),
                                        &(new_pos.0.y as i32),
                                    ],
                                )
                                .await
                                .unwrap();
                                let end = start.elapsed();
                                debug!("Updated position: {} µs", end.subsec_nanos() / 1000);

                                let obj = AppNotification::Moved {
                                    room: room1.clone(),
                                    positions: vec![Move {
                                        user: user_id.clone(),
                                        x: x,
                                        y: y,
                                        direction: new_pos.1,
                                    }],
                                };
                                let s = serde_json::to_string(&encode_for_client(&obj)).unwrap();
                                for (n, _) in &topics {
                                    if n == &room1 {
                                        send_message(&sessions, &topics, &n, &s, None);
                                    }
                                }
                            }
                            ()
                        }
                    }
                }
                .into_actor(self)
                .then(|res, act, ctx| fut::ready(()))
                .wait(ctx);
            }
            MsgFromUser::Direction { room, direction } => {
                let redis = self.redis.clone();
                let user_id = msg.user_id.clone();
                let session_id = msg.session_id.clone();
                let room1 = room.clone();
                let addr = ctx.address();
                let sessions = self.sessions.clone();
                let topics = self.topics.clone();
                let pg = self.pg.clone();
                async move {
                    if emulate_delay {
                        let delay: u64 = rng.gen_range(20, 200);
                        delay_for(Duration::from_millis(delay)).await;
                    }
                    let key = format!("pos:{}:{}", &room1, user_id.clone());
                    let resp = redis
                        .send(Command(resp_array!["GET", &key]))
                        .await
                        .unwrap()
                        .unwrap();
                    let s: String = match resp {
                        RespValue::BulkString(v) => std::str::from_utf8(&v).unwrap().to_string(),
                        RespValue::SimpleString(s) => s,
                        _ => "".to_string(),
                    };
                    let pos: Option<(Point, direction)> = parse_pos(&s);
                    match pos {
                        None => warn!("Pos parse failed: '{}' (key: '{}')", s, &key),
                        Some(pos) => {
                            println!("{:?}", &pos);
                            let new_pos = (pos.0, direction);
                            let resp = redis
                                .send(Command(resp_array![
                                    "SET",
                                    format!("pos:{}:{}", &room1, &user_id),
                                    format!("{}.{}.{}", new_pos.0.x, new_pos.0.y, &new_pos.1)
                                ]))
                                .await
                                .unwrap()
                                .unwrap();
                            let start = Instant::now();
                            let conn = pg.get().await.unwrap();
                            conn.query(
                                "UPDATE
                                            person_position
                                        SET
                                            direction=$3
                                        WHERE
                                            person=$1
                                            AND room=$2",
                                &[&user_id, &room, &(new_pos.1)],
                            )
                            .await
                            .unwrap();
                            let end = start.elapsed();
                            debug!("Updated position: {} µs", end.subsec_nanos() / 1000);

                            let obj = AppNotification::Moved {
                                room: room1.clone(),
                                positions: vec![Move {
                                    user: user_id.clone(),
                                    x: new_pos.0.x,
                                    y: new_pos.0.y,
                                    direction: new_pos.1,
                                }],
                            };
                            let s = serde_json::to_string(&encode_for_client(&obj)).unwrap();
                            for (n, _) in &topics {
                                if n == &room1 {
                                    send_message(&sessions, &topics, &n, &s, None);
                                }
                            }
                            ()
                        }
                    }
                }
                .into_actor(self)
                .then(|res, act, ctx| fut::ready(()))
                .wait(ctx);
            }
            MsgFromUser::Active { room, .. } => {
                self.topics
                    .entry(msg.user_id.clone())
                    .or_insert(HashSet::new())
                    .insert(msg.session_id.clone());

                let redis = self.redis.clone();
                let user_id = msg.user_id.clone();
                let session_id = msg.session_id.clone();
                let room1 = room.clone();
                let addr = ctx.address();
                let sessions = self.sessions.clone();
                let topics = self.topics.clone();
                let pg = self.pg.clone();

                self.user_of_session
                    .insert(session_id, (user_id.clone(), room.clone()));

                self.session_of_user
                    .entry((user_id.clone(), room.clone()))
                    .or_insert(HashSet::new())
                    .insert(session_id.clone());

                debug!("user_of_session: {:?}", self.user_of_session);
                debug!("session_of_user: {:?}", self.session_of_user);

                async move {
                    let key = format!("connected_users:room:{}:__all__", &room);
                    redis
                        .send(Command(resp_array!["SADD", &key, &user_id]))
                        .await
                        .unwrap()
                        .unwrap();
                    let conn = pg.get().await.unwrap();
                    let rows = conn
                        .query("SELECT * FROM announce WHERE room=$1", &[&room])
                        .await
                        .unwrap();
                    if rows.len() > 0 {
                        let r = &rows[0];
                        let obj = AppNotification::Announce {
                            announce: Announcement {
                                room: r.get("room"),
                                text: r.get("text"),
                                marquee: r.get("marquee"),
                                period: r.get::<_, Option<i32>>("period").unwrap_or(0),
                            },
                        };
                        send_message(
                            &sessions,
                            &topics,
                            &room,
                            &serde_json::to_string(&encode_for_client(&obj)).unwrap(),
                            None,
                        );
                    }
                }
                .into_actor(self)
                .then(|res, act, ctx| fut::ready(()))
                .wait(ctx);

                /*
                let active_in_room: Vec<UserId> = self
                    .session_of_user
                    .iter()
                    .filter_map(|((u, r), ss)| {
                        if r == &room1 && !ss.is_empty() {
                            Some(u.to_string())
                        } else {
                            None
                        }
                    })
                    .collect();
                debug!("active_in_room: {:?}", active_in_room);
                let obj1 = AppNotification::ActiveUsers {
                    data: active_in_room
                        .iter()
                        .map(|u| ActiveUserData {
                            user: u.to_string(),
                            room: room1.clone(),
                            active: true,
                        })
                        .collect(),
                };
                self.send_message(
                    &msg.user_id,
                    &serde_json::to_string(&encode_for_client(&obj1)).unwrap(),
                    None,
                );
                */
                let obj = AppNotification::ActiveUsers {
                    data: vec![ActiveUserData {
                        user: msg.user_id,
                        room: room1.clone(),
                        active: true,
                    }],
                };
                self.send_message(
                    &room1,
                    &serde_json::to_string(&encode_for_client(&obj)).unwrap(),
                    None,
                );
            }
            MsgFromUser::ChatTyping { room, typing, .. } => {
                let redis = self.redis.clone();
                let user_id = msg.user_id.clone();
                let room_id = room.clone();
                async move {
                    let key = format!("typing:{}:{}", &room_id, user_id);
                    redis
                        .send(Command(resp_array![
                            "SET",
                            &key,
                            if typing { "1" } else { "0" }
                        ]))
                        .await
                        .unwrap()
                }
                .into_actor(self)
                .then(|res, act, ctx| fut::ready(()))
                .wait(ctx);
                let obj = AppNotification::ChatTyping {
                    room: room.clone(),
                    user: msg.user_id,
                    typing,
                };
                let s = serde_json::to_string(&encode_for_client(&obj)).unwrap();
                debug!("Emitting to client: {}", &s);
                self.send_message(
                    &room, &s, None,
                    // Some(msg.session_id),
                )
            }
        };
    }
}

/// Handler for DataFromAPIServer message.
impl Handler<DataFromAPIServer> for PubSubServer {
    type Result = ();

    fn handle(&mut self, msg: DataFromAPIServer, _: &mut Context<Self>) {
        let s: String = serde_json::to_string(&msg.data).unwrap();
        // debug!("From server: channels: {:?}, data: {:?}", msg.channels, s);
        match msg.data {
            _ => {
                for n in msg.channels {
                    self.send_message(&n, &s, None);
                }
            }
        }
    }
}

/// Join room, send disconnect message to old room
/// send join message to new room
impl Handler<Join> for PubSubServer {
    type Result = ();

    fn handle(&mut self, msg: Join, _: &mut Context<Self>) {}
}
