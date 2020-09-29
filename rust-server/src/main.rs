#![allow(non_snake_case)]
#![allow(non_camel_case_types)]
extern crate clap;
extern crate dotenv;
extern crate num_cpus;
extern crate rand;
extern crate redis_async;
#[macro_use]
extern crate log;
use actix_files as fs;
use actix_redis::RedisActor;
use actix_service::Service;
use actix_web::http;
use actix_web::http::header::{HeaderName, HeaderValue};
use actix_web::http::uri::Uri;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer, Responder};
use bb8_postgres::bb8::Pool;
use bb8_postgres::PostgresConnectionManager;
use clap::{App as AppClap, Arg};
use defs::MyData;
use futures::future::FutureExt;
use openssl::ssl::{SslAcceptor, SslFiletype, SslMethod};
use std::env;
use std::time::Instant;
use tokio_postgres;
mod auth;
mod chat;
mod defs;
mod emit;
mod groups;
mod maps;
mod model;
mod people;
mod posters;
use actix_cors::Cors;
use actix_web::client::Client;
use auth::*;
use chat::*;
use dotenv::dotenv;
use groups::*;
use maps::*;
use people::*;
use posters::*;
use serde_json::json;

// use sqlx::postgres::PgPoolOptions;

pub async fn stub(req: HttpRequest, body: web::Payload) -> HttpResponse {
    let uri = format!("{}{}", "http://localhost:3030", req.uri())
        .parse::<Uri>()
        .unwrap();

    let c = req
        .headers()
        .get("Cookie")
        .and_then(|c| c.to_str().ok())
        .unwrap_or("");
    let ct = req
        .headers()
        .get(http::header::CONTENT_TYPE)
        .and_then(|c| c.to_str().ok())
        .unwrap_or("applicaion/json");

    let client = Client::default();
    let res = match req.method() {
        &http::Method::GET => {
            client
                .get(uri)
                .header("User-Agent", "Actix-web")
                .header(http::header::COOKIE, c)
                .header(http::header::CONTENT_TYPE, ct)
                .send_stream(body)
                .await
        }
        &http::Method::POST => {
            client
                .post(uri)
                .header("User-Agent", "Actix-web")
                .header(http::header::COOKIE, c)
                .header(http::header::CONTENT_TYPE, ct)
                .send_stream(body)
                .await
        }
        &http::Method::DELETE => {
            client
                .delete(uri)
                .header("User-Agent", "Actix-web")
                .header(http::header::COOKIE, c)
                .header(http::header::CONTENT_TYPE, ct)
                .send_stream(body)
                .await
        }
        &http::Method::PATCH => {
            client
                .patch(uri)
                .header("User-Agent", "Actix-web")
                .header(http::header::COOKIE, c)
                .header(http::header::CONTENT_TYPE, ct)
                .send_stream(body)
                .await
        }
        _ => {
            panic!("Not supported");
        }
    };

    println!("Response: {:?}", res);
    let mut res = res.unwrap();
    let body = res.body().await.unwrap();
    let set_cookie = res.headers().get(http::header::SET_COOKIE);
    let mut res_to_client = HttpResponse::Ok().body(body);
    res_to_client.headers_mut().insert(
        HeaderName::from_static("x-powered-by"),
        HeaderValue::from_static("Fastify via Actix"),
    );
    if set_cookie.is_some() {
        res_to_client
            .headers_mut()
            .insert(http::header::SET_COOKIE, set_cookie.unwrap().to_owned());
    }
    res_to_client
}

async fn ping() -> impl Responder {
    HttpResponse::Ok().body("pong")
}

use rand::seq::SliceRandom;

const BASE_STR: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

fn gen_ascii_chars(size: usize) -> String {
    let mut rng = &mut rand::thread_rng();
    String::from_utf8(
        BASE_STR
            .as_bytes()
            .choose_multiple(&mut rng, size)
            .cloned()
            .collect(),
    )
    .unwrap()
}

async fn get_socket_url(_data: web::Data<MyData>) -> Result<HttpResponse, Error> {
    let socket_url = env::var("SOCKET_URL").unwrap_or("ws://localhost:8080/ws".to_string());
    Ok(HttpResponse::Ok().json(json!({
      "socket_url": socket_url,
      "socket_protocol": "WebSocket"
    })))
}

#[actix_rt::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    let app = AppClap::new("Web server")
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

    let is_tls = matches.is_present("tls");

    let num_cpus = num_cpus::get();

    let debug_token = env::var("DEBUG_TOKEN").unwrap_or(gen_ascii_chars(10));

    let port = env::var("PORT").unwrap_or(env::var("PORT").unwrap_or(String::from("3000")));

    let num_workers: usize = matches
        .value_of("workers")
        .map(|a| a.parse().unwrap_or(num_cpus))
        .unwrap_or(num_cpus);

    let conn_str = env::var("POSTGRES_CONNECTION_STRING").unwrap_or(String::from(
        "postgresql://postgres@localhost:5432/virtual_poster",
    ));

    // let poolx = PgPoolOptions::new()
    //     .max_connections(num_workers as u32)
    //     .min_connections(num_workers as u32)
    //     .connect(&conn_str)
    //     .await
    //     .unwrap();
    let pg_mgr =
        PostgresConnectionManager::new_from_stringlike(conn_str, tokio_postgres::NoTls).unwrap();

    let pool = match Pool::builder().build(pg_mgr).await {
        Ok(pool) => pool,
        Err(e) => panic!("builder error: {:?}", e),
    };

    println!("# of workers: {}", num_workers);
    println!("TLS: {}", if is_tls { "ON" } else { "OFF" });
    println!("Debug token: {}", debug_token);

    println!("Initializing Redis cache...");
    let redis_addr_1 = RedisActor::start("127.0.0.1:6379");
    model::init_redis_cache(&pool, redis_addr_1).await;
    println!("Done.");

    let server = HttpServer::new(move || {
        let mydata = MyData {
            pg: pool.clone(),
            // pgx: poolx.clone(),
            redis: RedisActor::start("127.0.0.1:6379"),
            redis_sync: redis::Client::open("redis://127.0.0.1/0").unwrap(),
            redis_sync_sessions: redis::Client::open("redis://127.0.0.1/3").unwrap(),
            debug_token: debug_token.clone(),
        };

        App::new()
            .app_data(web::JsonConfig::default().limit(1_000_000))
            .data(mydata)
            .wrap(
                Cors::new() // <- Construct CORS middleware builder
                    .max_age(3600)
                    .finish(),
            )
            .service(
                web::scope("/api")
                    .route("/blind_sign/key_pair", web::get().to(get_encryption_keys))
                    .route("/blind_sign/sign", web::post().to(stub))
                    .route("/blind_sign/verify", web::get().to(stub))
                    .route("/comments/{commentId}", web::patch().to(stub))
                    .route("/comments/{commentId}", web::delete().to(stub))
                    .route("/comments/{commentId}/reply", web::post().to(stub))
                    .route("/groups", web::get().to(stub))
                    .route("/id_token", web::post().to(stub))
                    .route("/logout", web::post().to(stub))
                    .route("/latency_report", web::post().to(stub))
                    .route("/maps/{roomId}/people", web::get().to(get_room_people))
                    .route("/maps", web::get().to(get_rooms)) // 20200928 OK
                    .route("/maps/{room_id}", web::get().to(get_room)) // 20200928 OK
                    .route("/maps/{roomId}/enter", web::post().to(enter_room))
                    .route("/maps/{roomId}/groups/{groupId}/join", web::post().to(stub))
                    .route(
                        "/maps/{roomId}/groups/{groupId}/leave",
                        web::post().to(leave_group),
                    )
                    .route(
                        "/maps/{roomId}/groups/{groupId}/people",
                        web::post().to(stub),
                    )
                    .route("/maps/{roomId}/groups", web::get().to(get_room_groups))
                    .route("/maps/{roomId}/groups", web::post().to(post_group))
                    .route(
                        "/maps/{roomId}/people/{personId}/groups",
                        web::get().to(stub),
                    )
                    .route("/maps/{roomId}/comments", web::get().to(get_comments))
                    .route(
                        "/maps/{roomId}/people/{personId}/poster",
                        web::get().to(stub),
                    )
                    .route(
                        "/maps/{roomId}/people/{personId}/poster/file",
                        web::post().to(stub),
                    )
                    .route("/maps/{roomId}/posters", web::get().to(get_posters_of_room))
                    .route(
                        "/maps/{roomId}/poster_slot/{posterNumber}",
                        web::post().to(stub),
                    )
                    .route(
                        "/maps/{roomId}/poster_slot/{posterNumber}",
                        web::delete().to(stub),
                    )
                    .route(
                        "/maps/{roomId}/groups/{groupId}/comments",
                        web::post().to(post_comment),
                    )
                    .route(
                        "/maps/{roomId}/posters/{posterId}/approach",
                        web::post().to(stub),
                    )
                    .route(
                        "/maps/{roomId}/posters/{posterId}/enter",
                        web::post().to(stub),
                    )
                    .route(
                        "/maps/{roomId}/posters/{posterId}/leave",
                        web::post().to(stub),
                    )
                    .route("/people/{userId}", web::get().to(get_person))
                    .route("/people/{userId}", web::patch().to(patch_person))
                    .route("/people", web::get().to(get_all_people))
                    .route("/people", web::post().to(stub))
                    .route("/people_multi/{personIds}", web::get().to(stub))
                    .route(
                        "/posters/{posterId}/comments/{commentId}",
                        web::patch().to(stub),
                    )
                    .route(
                        "/posters/{posterId}/comments/{commentId}",
                        web::delete().to(stub),
                    )
                    .route("/people/{personId}/posters", web::get().to(stub))
                    .route("/posters/{posterId}/file", web::get().to(stub))
                    .route("/posters/{posterId}/file", web::post().to(stub))
                    .route("/posters/{posterId}/file", web::delete().to(stub))
                    .route("/posters/{posterId}/comments", web::get().to(stub))
                    .route("/posters/{posterId}/comments", web::post().to(stub))
                    .route("/posters", web::get().to(stub))
                    .route("/ping", web::get().to(ping))
                    .route("/public_key", web::get().to(get_public_key))
                    .route("/public_key", web::post().to(post_public_key))
                    .route("/people/{personId}/access_code", web::post().to(stub))
                    .route("/posters/{posterId}", web::patch().to(stub))
                    .route(
                        "/posters/{posterId}/comments/{commentId}/reply",
                        web::post().to(stub),
                    )
                    .route("/register", web::post().to(stub))
                    .route("/socket_url", web::get().to(get_socket_url)),
            )
            .default_service(fs::Files::new("/", "../public"))
            .wrap_fn(|req, srv| {
                let start = Instant::now();
                // println!("Hi from start. You requested: {}", req.path());
                srv.call(req).map(move |res| {
                    let _end = start.elapsed();
                    // println!("Hi from response: {} µs", end.as_nanos() / 1000);
                    match res {
                        Ok(mut r) => {
                            // println!("{:?}", r);
                            let headers = r.headers_mut();
                            if (!headers.contains_key("x-powered-by")) {
                                headers.insert(
                                    HeaderName::from_static("x-powered-by"),
                                    HeaderValue::from_static("actix-web"),
                                );
                            }
                            Ok(r)
                        }
                        Err(e) => Err(e),
                    }
                })
            })
    })
    .workers(num_workers);
    println!("Starting to listen on port {}", port);
    if is_tls {
        let mut builder = SslAcceptor::mozilla_intermediate(SslMethod::tls()).unwrap();

        builder
            .set_private_key_file("key.pem", SslFiletype::PEM)
            .unwrap();
        builder.set_certificate_chain_file("cert.pem").unwrap();
        let s = server.bind_openssl(format!("0.0.0.0:{}", port), builder)?;
        println!("Server started with {} workers", num_workers);
        s.run().await.unwrap();
    } else {
        server
            .bind(format!("0.0.0.0:{}", port))?
            .run()
            .await
            .unwrap();
    }
    Ok(())
}
