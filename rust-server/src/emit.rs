use crate::defs::*;
use actix_web::client::Client;
use serde_json::{json, to_string};

pub async fn emit(topics: &Vec<&str>, data: &AppNotification) -> () {
    let obj = json!({"topics": topics, "data": data});
    let serialized_value: String = to_string(&obj).unwrap();
    println!("Emitting: {:?}", serialized_value);

    let port: u16 = 5000;
    let debug_token = std::env::var("DEBUG_TOKEN").unwrap();
    let client = Client::default();

    // Create request builder and send request
    let _response = client
        .post(format!("http://localhost:{}/input/{}", port, debug_token))
        .header("User-Agent", "Actix-web")
        .send_json(&obj)
        .await;

    println!("{:?}", _response);

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
