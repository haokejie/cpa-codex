use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tokio::time::{interval, Duration};

#[derive(Debug, Serialize, Clone)]
pub struct TickPayload {
    pub timestamp_ms: i64,
}

pub fn start_background_worker(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(30));
        loop {
            ticker.tick().await;
            let payload = TickPayload {
                timestamp_ms: now_millis(),
            };
            let _ = app.emit("backend:tick", payload);
        }
    });
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}
