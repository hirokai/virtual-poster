#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use actix::*;
// use actix_cors::Cors;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer};
use actix_web_actors::ws;
use std::time::{Duration, Instant};
mod defs;
extern crate num_cpus;
mod socket_server;
use crate::defs::*;
use bb8_postgres::bb8::Pool;
use bb8_postgres::PostgresConnectionManager;
use clap::{App as AppClap, Arg};
use dotenv::dotenv;
use serde::Deserialize;
use serde_json::json;
use socket_server::*;
use std::env;
use std::time::SystemTime;
#[macro_use]
extern crate log;
extern crate yaml_rust;
use yaml_rust::YamlLoader;

/// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
/// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

fn show_time() -> () {
    debug!(
        "Time: {:?}",
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .ok()
            .map(|t| t.as_micros())
    );
}

fn check_token<'a>(
    user: &'a str,
    _token: &'a str,
    debug_as: &'a Option<String>,
) -> Option<&'a str> {
    match debug_as {
        Some(user) => Some(user),
        None => {
            // TODO: Implement checking token
            Some(user)
        }
    }
}

/// Entry point for our route
async fn chat_route(
    req: HttpRequest,
    stream: web::Payload,
    srv: web::Data<Addr<socket_server::PubSubServer>>,
) -> Result<HttpResponse, Error> {
    println!("/ws chat route open");
    ws::start(
        WsChatSession {
            id: None,
            hb: Instant::now(),
            subscribed_to: vec!["all".to_string()],
            user_id: None,
            addr: srv.get_ref().clone(),
        },
        &req,
        stream,
    )
}

async fn input_route(
    body: web::Json<DataFromAPIServer>,
    srv: web::Data<Addr<socket_server::PubSubServer>>,
) -> Result<HttpResponse, Error> {
    let data: DataFromAPIServer = body.into_inner();
    debug!("Parsed input from REST server: {:?}", &data);
    srv.do_send(data);
    Ok(HttpResponse::Ok().body("OK"))
}

struct WsChatSession {
    /// unique session id
    id: Option<u128>,
    /// Client must send ping at least once per 10 seconds (CLIENT_TIMEOUT),
    /// otherwise we drop connection.
    hb: Instant,
    subscribed_to: Vec<String>,
    user_id: Option<String>,
    /// Chat server
    addr: Addr<socket_server::PubSubServer>,
}

impl Actor for WsChatSession {
    type Context = ws::WebsocketContext<Self>;

    /// Method is called on actor start.
    /// We register ws session with PubSubServer
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
                    Ok(res) => act.id = Some(res),
                    // something is wrong with chat server
                    _ => ctx.stop(),
                }
                fut::ready(())
            })
            .wait(ctx);
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        // notify chat server
        match self.id {
            Some(session_id) => {
                self.addr
                    .do_send(socket_server::Disconnect { id: session_id });
            }
            _ => {
                //
            }
        }
        Running::Stop
    }
}

/// Handle messages from chat server, we simply send it to peer websocket
impl Handler<socket_server::Message> for WsChatSession {
    type Result = ();

    fn handle(&mut self, msg: socket_server::Message, ctx: &mut Self::Context) {
        ctx.text(msg.0);
        show_time();
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
                debug!("Text received: {:?}", m);
                if m == "ping" {
                    info!("Ping text received");
                    ctx.text("pong");
                } else {
                    let obj: Option<MsgFromUser> = serde_json::from_str(&m).ok();
                    info!("Parsed: {:?}", &obj);
                    if obj.is_none() {
                        info!("Parse failed");
                        return;
                    }
                    let obj = obj.unwrap();
                    match (&obj, &self.user_id, &self.id) {
                        (
                            MsgFromUser::Active {
                                room,
                                user,
                                token,
                                debug_as,
                            },
                            _,
                            Some(session_id)
                        ) => {
                            let user_verified: Option<&str> = check_token(&user, &token, &debug_as);
                            match user_verified {
                                Some(user_verified) => {
                                    self.user_id = Some(user_verified.to_string());
                                    self.addr.do_send(socket_server::DataFromUser {
                                        data: MsgFromUser::Active {
                                            room: room.to_string(),
                                            user: user.to_string(),
                                            token: token.to_string(),
                                            debug_as: debug_as.as_ref().map(|s| s.to_string()),
                                        },
                                        user_id: user_verified.to_string(),
                                        session_id: *session_id,
                                    });
                                },
                                None => ctx.text(
                                    &serde_json::to_string(&json!({"Error": {"error": "Invalid token"}})).unwrap()
                                ),
                            }
                        }
                        (obj1, Some(user_id), Some(session_id)) => {
                            if let MsgFromUser::Subscribe { channel } = &obj1 {
                                    self.subscribed_to.push(channel.to_string());
                            }
                            self.addr.do_send(socket_server::DataFromUser {
                                data: obj,
                                user_id: user_id.to_string(),
                                session_id: *session_id,
                            });
                        }
                        (_, Some(_), None) => {
                            ctx.text(
                            &serde_json::to_string(
                                &json!({"Error": {"error": "Session ID not assigned"}}),
                            )
                            .unwrap())
                        }
                        (_, None,_) => ctx.text(
                            &serde_json::to_string(
                                &json!({"Error": {"error": "User ID has not been registered by Active message."}}),
                            )
                            .unwrap(),
                        )
                    }
                }
            }

            ws::Message::Binary(_) => warn!("Unexpected binary"),
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

                match &act.id {
                    Some(session_id) => {
                        // notify chat server
                        act.addr.do_send(socket_server::Disconnect {
                            id: session_id.clone(),
                        });
                    }
                    _ => {
                        //
                    }
                }
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
    dotenv().ok();
    env_logger::init();

    // std::env::set_var(
    //     "RUST_LOG",
    //     "actix_server=info,actix_web=info,websocket=debug",
    // );

    let s = std::fs::read_to_string("./virtual_poster.yaml")
        .unwrap_or(std::fs::read_to_string("../virtual_poster.yaml").unwrap());
    let doc = &YamlLoader::load_from_str(&s).unwrap()[0];
    let port = doc["socket_server"]["port"].as_i64().unwrap();

    let app = AppClap::new("WebSocket server")
        .version("0.1.0")
        .arg(
            Arg::with_name("tls")
                .help("Enable TLS")
                .long("tls")
                .takes_value(false),
        )
        .arg(
            Arg::with_name("workers")
                .help("The number of workers")
                .long("workers")
                .short("w")
                .takes_value(true),
        );
    let matches = app.get_matches();

    let port = env::var("PORT").unwrap_or(format!("{}", port));
    let secret_path =
        std::env::var("DEBUG_TOKEN").unwrap_or(doc["debug_token"].as_str().unwrap().to_string());
    let input_path = format!("/input/{}", secret_path);
    println!("Secret input path: {}", input_path);

    let conn_str = doc["postgresql"].as_str().unwrap();
    let redis_conn_str = doc["redis"].as_str().unwrap();

    debug!("PostgreSQL: {}", conn_str);
    debug!("Redis: {}", redis_conn_str);

    let pg_mgr =
        PostgresConnectionManager::new_from_stringlike(conn_str, tokio_postgres::NoTls).unwrap();

    let pg = match Pool::builder().build(pg_mgr).await {
        Ok(pool) => pool,
        Err(e) => panic!("builder error: {:?}", e),
    };
    // Start chat server actor
    let actor = socket_server::PubSubServer::init(pg, &redis_conn_str);
    let server = actor.start();

    let num_cpus = num_cpus::get();

    let num_workers: usize = matches
        .value_of("workers")
        .map(|a| a.parse().unwrap_or(num_cpus))
        .unwrap_or(num_cpus);

    println!("# of workers: {}", num_workers);

    // Create Http server with websocket support
    HttpServer::new(move || {
        App::new()
            .data(server.clone())
            // .wrap(
            //     Cors::new() // <- Construct CORS middleware builder
            //         .allowed_origin("*")
            //         .max_age(3600)
            //         .finish(),
            // )
            .service(web::resource("/ws").to(chat_route))
            .service(web::resource(input_path.clone()).to(input_route))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .workers(num_workers)
    .run()
    .await
}
