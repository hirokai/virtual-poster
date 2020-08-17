#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use actix::*;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer};
use actix_web_actors::ws;
use std::time::{Duration, Instant};
mod defs;
mod socket_server;
use crate::defs::*;
use serde::{Deserialize, Serialize};
use serde_json::json;
use socket_server::*;
use std::fmt::Display;
#[macro_use]
extern crate log;

/// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
/// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

/// Entry point for our route
async fn chat_route(
    req: HttpRequest,
    stream: web::Payload,
    srv: web::Data<Addr<socket_server::ChatServer>>,
) -> Result<HttpResponse, Error> {
    ws::start(
        WsChatSession {
            id: 0,
            hb: Instant::now(),
            room: "Main".to_owned(),
            name: None,
            addr: srv.get_ref().clone(),
        },
        &req,
        stream,
    )
}
/*
fn data_to_json(data: &SocketFromAPIServer) -> String {
    (match data {
        SocketFromAPIServer::GroupNew { group } => {
            json!({"message": "group.new", "data": {"group": group}})
        }
        SocketFromAPIServer::GroupRemove { id } => json!({"message": "group.remove","id": id}),
        SocketFromAPIServer::Moved { room, move_data: m } => {
            let encoded: String = format!("{},{},{},{}", m.user, m.x, m.y, m.direction);
            json!({"message": "moved","data": encoded})
        }
        SocketFromAPIServer::MovedMulti { room, move_data } => {
            let encoded: String = move_data
                .iter()
                .map(|m| format!("{},{},{},{}", m.user, m.x, m.y, m.direction))
                .collect::<Vec<String>>()
                .join(";");

            json!({"message": "moved_multi", "data": encoded})
        }
        SocketFromAPIServer::AddUserToNamespace { namespace, user } => {
            json!(
        }
    })
    .to_string()
}
*/

async fn input_route(
    body: web::Json<SocketFromAPIServerWithNamespaces>,
    srv: web::Data<Addr<socket_server::ChatServer>>,
) -> Result<HttpResponse, Error> {
    println!("input from REST server");
    srv.do_send(DataFromAPIServer {
        data: body.into_inner(),
    });
    Ok(HttpResponse::Ok().body("OK"))
}
struct WsChatSession {
    /// unique session id
    id: usize,
    /// Client must send ping at least once per 10 seconds (CLIENT_TIMEOUT),
    /// otherwise we drop connection.
    hb: Instant,
    /// joined room
    room: String,
    /// peer name
    name: Option<String>,
    /// Chat server
    addr: Addr<socket_server::ChatServer>,
}

impl Actor for WsChatSession {
    type Context = ws::WebsocketContext<Self>;

    /// Method is called on actor start.
    /// We register ws session with ChatServer
    fn started(&mut self, ctx: &mut Self::Context) {
        // we'll start heartbeat process on session start.
        self.hb(ctx);

        // register self in chat server. `AsyncContext::wait` register
        // future within context, but context waits until this future resolves
        // before processing any other events.
        // HttpContext::state() is instance of WsChatSessionState, state is shared
        // across all routes within application
        let addr = ctx.address();
        self.addr
            .send(socket_server::Connect {
                addr: addr.recipient(),
            })
            .into_actor(self)
            .then(|res, act, ctx| {
                match res {
                    Ok(res) => act.id = res,
                    // something is wrong with chat server
                    _ => ctx.stop(),
                }
                fut::ready(())
            })
            .wait(ctx);
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        // notify chat server
        self.addr.do_send(socket_server::Disconnect { id: self.id });
        Running::Stop
    }
}

/// Handle messages from chat server, we simply send it to peer websocket
impl Handler<socket_server::Message> for WsChatSession {
    type Result = ();

    fn handle(&mut self, msg: socket_server::Message, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

/// WebSocket message handler
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsChatSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        let msg = match msg {
            Err(_) => {
                ctx.stop();
                return;
            }
            Ok(msg) => msg,
        };

        // println!("WEBSOCKET MESSAGE: {:?}", msg);
        match msg {
            ws::Message::Ping(msg) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            ws::Message::Pong(_) => {
                self.hb = Instant::now();
            }
            ws::Message::Text(text) => {
                let m = text.trim();
                // we check for /sss type of messages
                if m.starts_with('/') {
                    let v: Vec<&str> = m.splitn(2, ' ').collect();
                    match v[0] {
                        "/list" => {
                            // Send ListRooms message to chat server and wait for
                            // response
                            println!("List rooms");
                            self.addr
                                .send(socket_server::ListRooms)
                                .into_actor(self)
                                .then(|res, _, ctx| {
                                    match res {
                                        Ok(rooms) => {
                                            for room in rooms {
                                                ctx.text(room);
                                            }
                                        }
                                        _ => println!("Something is wrong"),
                                    }
                                    fut::ready(())
                                })
                                .wait(ctx)
                            // .wait(ctx) pauses all events in context,
                            // so actor wont receive any new messages until it get list
                            // of rooms back
                        }
                        "/join" => {
                            if v.len() == 2 {
                                self.room = v[1].to_owned();
                                self.addr.do_send(socket_server::Join {
                                    id: self.id,
                                    name: self.room.clone(),
                                });

                                ctx.text("joined");
                            } else {
                                ctx.text("!!! room name is required");
                            }
                        }
                        "/name" => {
                            if v.len() == 2 {
                                self.name = Some(v[1].to_owned());
                            } else {
                                ctx.text("!!! name is required");
                            }
                        }
                        _ => ctx.text(format!("!!! unknown command: {:?}", m)),
                    }
                } else {
                    let msg: String = if let Some(ref name) = self.name {
                        format!("{}: {}", name, m)
                    } else {
                        m.to_owned()
                    };
                    let obj: Option<SocketFromUser> = serde_json::from_str(&m).ok();
                    info!("{:?}", &obj);
                    match obj {
                        Some(obj1) => match obj1 {
                            SocketFromUser::Subscribe { namespace, user } => {
                                self.addr.do_send(socket_server::Join {
                                    id: self.id,
                                    name: namespace,
                                });
                            }
                            _ => {
                                self.addr
                                    .do_send(socket_server::DataFromUser { data: obj1 });
                            }
                        },
                        None => {
                            warn!("Parse failed");
                            //
                        }
                    }
                }
            }
            ws::Message::Binary(_) => println!("Unexpected binary"),
            ws::Message::Close(reason) => {
                ctx.close(reason);
                ctx.stop();
            }
            ws::Message::Continuation(_) => {
                ctx.stop();
            }
            ws::Message::Nop => (),
        }
    }
}

impl WsChatSession {
    /// helper method that sends ping to client every second.
    ///
    /// also this method checks heartbeats from client
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // check client heartbeats
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                // heartbeat timed out
                println!("Websocket Client heartbeat failed, disconnecting!");

                // notify chat server
                act.addr.do_send(socket_server::Disconnect { id: act.id });

                // stop actor
                ctx.stop();

                // don't try to send a ping
                return;
            }

            ctx.ping(b"");
        });
    }
}

#[actix_rt::main]
async fn main() -> std::io::Result<()> {
    std::env::set_var(
        "RUST_LOG",
        "actix_server=info,actix_web=info,websocket=debug",
    );
    let secret_path = std::env::var("DEBUG_TOKEN").expect("DEBUG_TOKEN is needed");
    let input_path = format!("/input/{}", secret_path);
    println!("Input path: {}", input_path);
    env_logger::init();

    // Start chat server actor
    let actor = socket_server::ChatServer::init();
    let server = actor.start();

    // Create Http server with websocket support
    HttpServer::new(move || {
        App::new()
            .data(server.clone())
            .service(web::resource("/ws/").to(chat_route))
            .service(web::resource(input_path.clone()).to(input_route))
    })
    .bind("127.0.0.1:5000")?
    .run()
    .await
}
