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
use actix_web::http::header::{HeaderName, HeaderValue};
use actix_web::{web, App, Error, HttpResponse, HttpServer, Responder};
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
use auth::*;
use chat::*;
use dotenv::dotenv;
use groups::*;
use maps::*;
use people::*;
use posters::*;
// use sqlx::postgres::PgPoolOptions;

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
    let res = env::var("SOCKET_URL").unwrap_or("http://localhost:5000/ws/".to_string());
    Ok(HttpResponse::Ok().json(res))
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
        let redis_addr = RedisActor::start("127.0.0.1:6379");
        let mydata = MyData {
            pg: pool.clone(),
            // pgx: poolx.clone(),
            redis: redis_addr,
            redis_sync: redis::Client::open("redis://127.0.0.1/0").unwrap(),
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
                    .route("/socket_url", web::get().to(get_socket_url))
                    .route("/ping", web::get().to(ping))
                    .route("/public_key", web::post().to(post_public_key))
                    .route("/people", web::get().to(get_all_people))
                    .route("/people", web::post().to(post_people))
                    .route("/people_multi/{personIds}", web::get().to(get_people_multi))
                    .route("/people/{userId}", web::get().to(get_person))
                    .route("/people/{userId}", web::patch().to(patch_person))
                    .route("/maps/{roomId}/people", web::get().to(get_room_people))
                    .route("/maps", web::get().to(get_rooms))
                    .route("/maps/{room_id}", web::get().to(get_room))
                    .route("/maps/{roomId}/enter", web::post().to(enter_room))
                    .route("/comments/{commentId}", web::patch().to(patch_comments))
                    .route("/comments/{commentId}", web::delete().to(delete_comments))
                    .route(
                        "/maps/{roomId}/groups/{groupId}/join",
                        web::post().to(join_group),
                    )
                    .route(
                        "/maps/{roomId}/groups/{groupId}/leave",
                        web::post().to(leave_group),
                    )
                    .route(
                        "/maps/{roomId}/groups/{groupId}/people",
                        web::post().to(add_people_to_group),
                    )
                    .route("/maps/{roomId}/groups", web::get().to(get_room_groups))
                    .route("/maps/{roomId}/groups", web::post().to(post_group))
                    .route(
                        "/maps/{roomId}/people/{personId}/groups",
                        web::get().to(get_group_of_person),
                    )
                    .route("/maps/{roomId}/comments", web::get().to(get_comments))
                    .route("/maps/{roomId}/comments", web::post().to(post_comment))
                    .route(
                        "/maps/{roomId}/people/{personId}/poster",
                        web::get().to(get_poster_of_person),
                    )
                    .route(
                        "/maps/{roomId}/people/{personId}/poster/file",
                        web::post().to(post_poster_of_person),
                    )
                    .route(
                        "/people/{personId}/posters",
                        web::get().to(get_posters_of_person),
                    )
                    .route("/maps/{roomId}/posters", web::get().to(get_posters_of_room))
                    .route(
                        "/posters/{posterId}/comments/{commentId}",
                        web::patch().to(patch_poster_comment),
                    )
                    .route("/posters/{posterId}/file", web::get().to(get_poster_file))
                    .route("/posters/{posterId}/file", web::post().to(post_poster_file))
                    .route(
                        "/posters/{posterId}/file",
                        web::delete().to(delete_poster_file),
                    )
                    .route(
                        "/posters/{posterId}/comments",
                        web::get().to(get_poster_comments),
                    )
                    .route(
                        "/posters/{posterId}/comments",
                        web::post().to(post_poster_comments),
                    )
                    // .route("/maps2/{room_id}", web::get().to(get_room_2))
                    .route("/encryption_keys", web::get().to(get_encryption_keys))
                    .route("/id_token", web::post().to(post_id_token)),
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
                            r.headers_mut().insert(
                                HeaderName::from_static("x-powered-by"),
                                HeaderValue::from_static("actix-web"),
                            );
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
