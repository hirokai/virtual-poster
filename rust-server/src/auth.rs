extern crate num_cpus;
use super::defs::*;
use actix_redis::Command;
use actix_web::error::{ErrorBadRequest, ErrorUnauthorized};
use actix_web::{dev, web, Error, FromRequest, HttpRequest, HttpResponse};
use futures::future::{err, ok, Ready};
use jsonwebtoken::dangerous_insecure_decode;
use qstring::QString;
use redis::Commands;
use redis_async::resp_array;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};

#[derive(Debug, Deserialize)]
pub struct Auth {
    pub email: String,
    pub user: UserId,
    pub user_type: UserType,
    pub token: Option<String>,
}

#[derive(Deserialize, Debug)]
struct TokenObj {
    token: String,
}

#[derive(Serialize, Debug)]
struct PostIdTokenResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    user_id: Option<String>,
}
/// Our claims struct, it needs to derive `Serialize` and/or `Deserialize`
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    aud: String, // Optional. Audience
    auth_time: usize,
    email: Option<String>,
    email_verified: Option<bool>,
    exp: usize, // Required (validate_exp defaults to true in validation). Expiration time (as UTC timestamp)
    iat: usize, // Optional. Issued at (as UTC timestamp)
    iss: String, // Optional. Issuer
    sub: String, // Optional. Subject (whom token refers to)
    user_id: String,
}

impl FromRequest for Auth {
    type Error = Error;
    type Future = Ready<Result<Self, Self::Error>>;
    type Config = ();

    fn from_request(req: &HttpRequest, _payload: &mut dev::Payload) -> Self::Future {
        let query_str = req.query_string();
        let qs = QString::from(query_str);
        let user = qs.get("debug_as");
        let d = req.app_data::<web::Data<MyData>>().unwrap();
        let debug_token = qs.get("debug_token");
        match (user, debug_token) {
            (Some(u), Some(dt)) => {
                if dt == d.debug_token {
                    ok(Auth {
                        email: String::from(""),
                        user: u.into(),
                        user_type: UserType::Normal,
                        token: None,
                    })
                } else {
                    println!("Debug token invalid");
                    err(ErrorBadRequest("Debug token invalid"))
                }
            }
            _ => {
                // let start = Instant::now();

                let d = req.app_data::<web::Data<MyData>>().unwrap();
                let token_str = get_token_str(req);
                if let Some(token_str) = token_str {
                    // println!("Token: {}", token_str);
                    let claim = dangerous_insecure_decode::<Claims>(&token_str);
                    if let Ok(claim) = claim {
                        if let Some(email) = claim.claims.email {
                            let con = d.redis_sync.get_connection().unwrap();
                            // let end = start.elapsed();
                            // println!("Connected time {} µs", end.as_nanos() / 1000);
                            let u = get_user_type_sync(con, &email).unwrap();
                            // let end = start.elapsed();
                            // println!("Received time {} µs", end.as_nanos() / 1000);
                            match u.1 {
                                Some(ut) => {
                                    let a = Auth {
                                        email: email,
                                        user: u.0.into(),
                                        user_type: ut,
                                        token: Some(token_str),
                                    };
                                    // println!("{:?}", a);
                                    // let end = start.elapsed();
                                    // println!("Auth time {} µs", end.as_nanos() / 1000);
                                    ok(a)
                                }
                                _ => err(ErrorUnauthorized("User info not found")),
                            }
                        } else {
                            println!("Token does not have email");
                            err(ErrorUnauthorized("Token does not have email"))
                        }
                    } else {
                        println!("Token parse failed");
                        err(ErrorUnauthorized("Token parse failed"))
                    }
                } else {
                    println!("Token not found");
                    err(ErrorUnauthorized("Token not found"))
                }
            }
        }
    }
}

fn get_user_type_sync(
    mut con: redis::Connection,
    email: &str,
) -> Result<(std::string::String, Option<UserType>), redis::RedisError> {
    let uid = con.get::<String, String>(format!("email:{}", email))?;
    let count =
        con.exists::<&[String; 2], isize>(&[format!("uid:{}", uid), format!("uid:{}:admin", uid)])?;
    Ok((
        uid,
        if count == 2 {
            Some(UserType::Admin)
        } else if count == 1 {
            Some(UserType::Normal)
        } else {
            None
        },
    ))
}

fn get_token_str(req: &web::HttpRequest) -> Option<String> {
    let query_str = req.query_string();
    let qs = QString::from(query_str);
    let token_str = req
        .headers()
        .get("Authorization")
        .and_then(|s| {
            s.to_str().ok().map(|s| {
                let ss: Vec<&str> = s.split(" ").collect();
                ss[1]
            })
        })
        .or(qs.get("access_token"));
    token_str.map(|s| s.to_string())
}

pub async fn get_encryption_keys(data: web::Data<MyData>, auth: Auth) -> HttpResponse {
    let conn = data.pg.get().await.unwrap();
    let row = conn
        .query_opt(
            "SELECT public_key FROM public_key WHERE person=$1;",
            &[&auth.user],
        )
        .await
        .unwrap();
    if let Some(row) = row {
        HttpResponse::Ok()
            .json(json!({"ok": true, "public_key": row.get::<usize,String>(0).to_string()}))
    } else {
        HttpResponse::Ok().json(json!({"ok": false}))
    }
}

pub async fn post_id_token(
    // mut _payload: web::Payload,
    data: web::Data<MyData>,
    auth: Auth,
) -> HttpResponse {
    /*
    // payload is a stream of Bytes objects
    let mut body = BytesMut::new();
    while let Some(chunk) = payload.next().await {
        let chunk = chunk?;
        // limit max size of in-memory payload
        if (body.len() + chunk.len()) > 1_000_000 {
            return Err(error::ErrorBadRequest("overflow"));
        }
        body.extend_from_slice(&chunk);
    }
    // body is loaded, now we can deserialize serde-json
    let obj = serde_json::from_slice::<TokenObj>(&body)?;
    */

    match auth.token {
        Some(token) => {
            let cmd = data.redis.send(Command(resp_array![
                "SETEX",
                format!("{}{}", "token:", auth.email),
                "3600",
                &token
            ]));
            cmd.await.unwrap().unwrap();

            let mut hasher = Sha256::new();
            hasher.update(&token);
            let result = hasher.finalize();
            let hash: String = format!("{:x}", result);

            let cmd = data.redis.send(Command(resp_array![
                "SETEX",
                format!("hash:{}", hash),
                "3600",
                &auth.user
            ]));
            cmd.await.unwrap().unwrap();
            /*
            let k2 = match k {
                RespValue::SimpleString(s) => s,
                RespValue::BulkString(vs) => String::from_utf8(vs).unwrap(),
                _ => {
                    println!("{:?}", k);
                    String::from("")
                }
            };*/
            let conn = data.pg.get().await.unwrap();
            let expire_at = timestamp().unwrap() + 1000 * 60 * 60;
            println!("{}", expire_at);
            conn.query("INSERT into token (person,token,expire_at) values ($1,$2,$3) ON CONFLICT ON CONSTRAINT token_pkey DO UPDATE SET token=$2,expire_at=$3;",&[&auth.user, &token, &expire_at]).await.unwrap();
            println!("post_id_token by {}", auth.email);

            HttpResponse::Ok().json(PostIdTokenResponse {
                ok: true,
                error: None,
                user_id: Some(auth.user),
            })
        }
        _ => HttpResponse::BadRequest().body("Token and email should be specified"),
    }
}

pub async fn post_public_key(_data: web::Data<MyData>, _auth: Auth) -> HttpResponse {
    HttpResponse::Ok().json(json!({"ok": false}))
}
