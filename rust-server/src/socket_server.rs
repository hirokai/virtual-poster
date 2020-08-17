//! `ChatServer` is an actor. It maintains list of connection client session.
//! And manages available rooms. Peers send messages to other peers in same
//! room through `ChatServer`.

use super::*;
use actix::prelude::*;
use defs::*;
use log;
use rand::{self, rngs::ThreadRng, Rng};
use redis_async::resp::FromResp;
use serde_json;
use std::collections::{HashMap, HashSet};
/// Chat server sends this messages to session
#[derive(Message)]
#[rtype(result = "()")]
pub struct Message(pub String);

/// Message for chat server communications

/// New chat session is created
#[derive(Message)]
#[rtype(usize)]
pub struct Connect {
    pub addr: Recipient<Message>,
}

/// Session is disconnected
#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub id: usize,
}

/// Send message to specific room
#[derive(Message)]
#[rtype(result = "()")]
pub struct ClientMessage {
    /// Id of the client session
    pub id: usize,
    /// Peer message
    pub msg: String,
    /// Room name
    pub room: String,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct DataFromUser {
    pub data: SocketFromUser,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct DataFromAPIServer {
    pub data: SocketFromAPIServerWithNamespaces,
}

/// List of available rooms
pub struct ListRooms;

impl actix::Message for ListRooms {
    type Result = Vec<String>;
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

/// `ChatServer` manages chat rooms and responsible for coordinating chat
/// session. implementation is super primitive
pub struct ChatServer {
    sessions: HashMap<usize, Recipient<Message>>,
    rooms: HashMap<String, HashSet<usize>>,
    rng: ThreadRng,
}

impl ChatServer {
    pub fn init() -> ChatServer {
        // default room
        let mut rooms = HashMap::new();
        rooms.insert("Main".to_owned(), HashSet::new());

        ChatServer {
            sessions: HashMap::new(),
            rooms,
            rng: rand::thread_rng(),
        }
    }
    /// Send message to all users in the room
    fn send_message(&self, room: &str, message: &str, skip_id: usize) {
        debug!("{:?}", self.rooms);
        if let Some(sessions) = self.rooms.get(room) {
            for id in sessions {
                if *id != skip_id {
                    if let Some(addr) = self.sessions.get(id) {
                        let _ = addr.do_send(Message(message.to_owned()));
                    }
                }
            }
        }
    }
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Ping;

impl Handler<Ping> for ChatServer {
    type Result = ();

    fn handle(&mut self, item: Ping, ctx: &mut Context<ChatServer>) -> () {
        println!("ping");
    }
}

/// Make actor from `ChatServer`
impl Actor for ChatServer {
    /// We are going to use simple Context, we just need ability to communicate
    /// with other actors.
    type Context = Context<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {}
}

/// Handler for Connect message.
///
/// Register new session and assign unique id to this session
impl Handler<Connect> for ChatServer {
    type Result = usize;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
        println!("Someone joined");

        // notify all users in same room
        self.send_message(&"Main".to_owned(), "Someone joined", 0);

        // register session with random id
        let id = self.rng.gen::<usize>();
        self.sessions.insert(id, msg.addr);

        // auto join session to Main room
        self.rooms
            .entry("Main".to_owned())
            .or_insert(HashSet::new())
            .insert(id);

        // send id back
        id
    }
}

/// Handler for Disconnect message.
impl Handler<Disconnect> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        println!("Someone disconnected");

        let mut rooms: Vec<String> = Vec::new();

        // remove address
        if self.sessions.remove(&msg.id).is_some() {
            // remove session from all rooms
            for (name, sessions) in &mut self.rooms {
                if sessions.remove(&msg.id) {
                    rooms.push(name.to_owned());
                }
            }
        }
        // send message to other users
        for room in rooms {
            self.send_message(&room, "Someone disconnected", 0);
        }
    }
}

/// Handler for Message message.
impl Handler<ClientMessage> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: ClientMessage, _: &mut Context<Self>) {
        self.send_message(&msg.room, msg.msg.as_str(), msg.id);
    }
}

/// Handler for DataFromUser message.
impl Handler<DataFromUser> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: DataFromUser, _: &mut Context<Self>) {
        match msg.data {
            SocketFromUser::Move {
                user,
                room,
                x,
                y,
                token,
                debug_as,
            } => {
                let direction = direction::up;
                let obj = SocketFromAPIServer::Moved {
                    room: room.clone(),
                    move_data: Move {
                        user: user.clone(),
                        x: x,
                        y: y,
                        direction: direction,
                    },
                };
                let namespaces: Vec<&str> = vec![&room];
                for n in namespaces {
                    self.send_message(&n, &serde_json::to_string(&obj).unwrap(), 0);
                }
            }
            SocketFromUser::Active {
                user,
                room,
                token,
                debug_as,
            } => {
                //
            }
            SocketFromUser::Subscribe { namespace, user } => {
                self.rooms
                    .entry(namespace.clone())
                    .or_insert(HashSet::new())
                    .insert(0);
            }
        };
    }
}

/// Handler for DataFromAPIServer message.
impl Handler<DataFromAPIServer> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: DataFromAPIServer, _: &mut Context<Self>) {
        debug!("{:?}", self.rooms);
        let s: String = serde_json::to_string(&msg.data.data).unwrap();
        debug!("{:?}", s);
        match msg.data.data {
            _ => {
                for n in msg.data.namespaces {
                    self.send_message(&n, &s, 0);
                }
            }
        }
    }
}

/// Handler for `ListRooms` message.
impl Handler<ListRooms> for ChatServer {
    type Result = MessageResult<ListRooms>;

    fn handle(&mut self, _: ListRooms, _: &mut Context<Self>) -> Self::Result {
        let mut rooms = Vec::new();

        for key in self.rooms.keys() {
            rooms.push(key.to_owned())
        }

        MessageResult(rooms)
    }
}

/// Join room, send disconnect message to old room
/// send join message to new room
impl Handler<Join> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: Join, _: &mut Context<Self>) {
        let Join { id, name } = msg;
        let mut rooms = Vec::new();

        // remove session from all rooms
        for (n, sessions) in &mut self.rooms {
            if sessions.remove(&id) {
                rooms.push(n.to_owned());
            }
        }
        // send message to other users
        for room in rooms {
            self.send_message(&room, "Someone disconnected", 0);
        }

        self.rooms
            .entry(name.clone())
            .or_insert(HashSet::new())
            .insert(id);

        self.send_message(&name, "Someone connected", id);
    }
}
