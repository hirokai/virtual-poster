use crate::defs::*;
use actix::prelude::*;
use actix_redis::{Command, RedisActor};
use actix_web::client::Client;
use messagepack_rs::serializable::Serializable;
use messagepack_rs::value::Value;
use redis_async::resp_array;
use serde_json::{json, to_string};
use std::collections::BTreeMap;
#[macro_use]
use log::*;
use log::Level;

fn encode_msgpack(rooms: &Vec<String>, data: Vec<Value>) -> Vec<u8> {
    let uid = "emitter";
    let mut packet = BTreeMap::new();
    packet.insert(String::from("type"), Value::from(2));
    packet.insert(String::from("data"), Value::from(data));
    packet.insert(String::from("nsp"), Value::from("/"));

    let mut opts = BTreeMap::new();
    opts.insert(
        String::from("rooms"),
        Value::from(
            rooms
                .iter()
                .map(|r| Value::from(r.clone()))
                .collect::<Vec<Value>>(),
        ),
    );
    opts.insert(String::from("flags"), Value::from(BTreeMap::new()));
    let value = Value::from(vec![
        Value::from(uid),
        Value::from(packet),
        Value::from(opts),
    ]);
    println!("{:?}", value);
    let serialized_value = value.serialize().unwrap();
    serialized_value
}

pub async fn _emit_socket_io(redis: Addr<RedisActor>, rooms: &Vec<String>, data: Vec<Value>) -> () {
    let serialized_value = encode_msgpack(rooms, data);
    println!("{:?}", serialized_value);
    let channel = "socket.io#/#";
    redis
        .send(Command(resp_array!["PUBLISH", channel, serialized_value]))
        .await
        .unwrap()
        .unwrap();
    // let deserialized_value =
    //     Value::deserialize(&mut BufReader::new(Cursor::new(serialized_value))).unwrap();
    // println!("{:?}", deserialized_value);
}

pub async fn emit(namespaces: &Vec<&str>, data: &SocketFromAPIServer) -> () {
    let obj = json!({"namespaces": namespaces, "data": data});
    let serialized_value: String = to_string(&obj).unwrap();
    println!("Emitting: {:?}", serialized_value);

    let port: u16 = 5000;
    let debug_token = std::env::var("DEBUG_TOKEN").unwrap();
    let client = Client::default();

    // Create request builder and send request
    let _response = client
        .get(format!("http://localhost:{}/input/{}", port, debug_token))
        .header("User-Agent", "Actix-web")
        .send_json(&obj)
        .await;

    let _ = _response.map_err(|e| {
        error!("{}", e);
    });
    // let channel = "virtual-poster";
    // redis
    //     .send(Command(resp_array!["PUBLISH", channel, serialized_value]))
    //     .await
    //     .unwrap()
    //     .unwrap();
}
