//! `PubSubServer` is an actor. It maintains list of connection client session.
//! And manages available rooms. Peers send messages to other peers in same
//! room through `PubSubServer`.

use super::*;
use actix_redis::{Command, RedisActor, RespValue};
use defs::*;
use rand::{self};
use redis_async::resp_array;
use serde_json;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use uuid::Uuid;

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

#[derive(Message, Deserialize)]
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
    redis: Addr<RedisActor>,
    pg: bb8_postgres::bb8::Pool<bb8_postgres::PostgresConnectionManager<tokio_postgres::NoTls>>,
}

impl PubSubServer {
    pub fn init(
        pg: bb8_postgres::bb8::Pool<bb8_postgres::PostgresConnectionManager<tokio_postgres::NoTls>>,
    ) -> PubSubServer {
        // default room
        let mut topics = HashMap::new();
        topics.insert("all".to_owned(), HashSet::new());
        let redis = RedisActor::start("127.0.0.1:6379");

        PubSubServer {
            sessions: HashMap::new(),
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
    if let Some(sessions_in_topic) = topics.get(room) {
        for id in sessions_in_topic {
            if *id != skip_id.unwrap_or(0) {
                if let Some(addr) = sessions.get(id) {
                    let _ = addr.do_send(Message(message.to_owned()));
                }
            }
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
        println!("Someone joined");

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

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        println!("Someone disconnected");

        let mut rooms: Vec<String> = Vec::new();

        // remove address
        if self.sessions.remove(&msg.id).is_some() {
            // remove session from all rooms
            for (name, sessions) in &mut self.topics {
                if sessions.remove(&msg.id) {
                    rooms.push(name.to_owned());
                }
            }
        }
        // send message to other users
        for room in rooms {
            self.send_message(&room, "Someone disconnected", None);
        }
    }
}

fn encode_for_client(obj: &AppNotification) -> serde_json::Value {
    match obj {
        AppNotification::Moved { room: _, move_data } => {
            let s = move_data
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
        let start = Instant::now();
        debug!("{:?}", start);
        match msg.data {
            MsgFromUser::Subscribe { channel, .. } => {
                show_time();
                self.topics
                    .entry(channel.clone())
                    .or_insert(HashSet::new())
                    .insert(msg.session_id);

                debug!("Rooms: {:?}", self.topics);
            }
            MsgFromUser::Move { room, x, y, .. } => {
                let redis = self.redis.clone();
                let user_id = msg.user_id.clone();
                let room1 = room.clone();
                let addr = ctx.address();
                let sessions = self.sessions.clone();
                let topics = self.topics.clone();
                let pg = self.pg.clone();
                async move {
                    let resp = redis
                        .send(Command(resp_array![
                            "GET",
                            format!("pos:{}:{}", room1, user_id.clone())
                        ]))
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
                        None => warn!("Pos parse failed: {}", s),
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
                                        format!("pos:{}:{}", room1, user_id.clone()),
                                        format!("{}.{}.{}", new_pos.0.x, new_pos.0.y, &new_pos.1)
                                    ]))
                                    .await
                                    .unwrap()
                                    .unwrap();
                                let conn = pg.get().await.unwrap();
                                let from_me = conn
                                    .query(
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
                                let obj = AppNotification::Moved {
                                    room: room1,
                                    move_data: vec![Move {
                                        user: user_id,
                                        x: x,
                                        y: y,
                                        direction: new_pos.1,
                                    }],
                                };
                                let s = serde_json::to_string(&encode_for_client(&obj)).unwrap();
                                for (n, _) in &topics {
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
            MsgFromUser::Active { user, room, .. } => {
                let obj = AppNotification::UserActive {
                    user,
                    room: room.clone(),
                };
                self.send_message(
                    &room,
                    &serde_json::to_string(&encode_for_client(&obj)).unwrap(),
                    None,
                );
            }
        };
    }
}

/// Handler for DataFromAPIServer message.
impl Handler<DataFromAPIServer> for PubSubServer {
    type Result = ();

    fn handle(&mut self, msg: DataFromAPIServer, _: &mut Context<Self>) {
        let s: String = serde_json::to_string(&msg.data).unwrap();
        debug!("From server: {:?}", s);
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
