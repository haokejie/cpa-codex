use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use tokio::time::{interval, Duration};

use crate::auth;
use crate::crypto;
use crate::remote;
use crate::state::AppState;

#[derive(Debug, Serialize, Clone)]
pub struct TickPayload {
    pub timestamp_ms: i64,
}

pub fn start_background_worker(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(30));
        let mut count: u32 = 0;
        loop {
            ticker.tick().await;
            let payload = TickPayload {
                timestamp_ms: now_millis(),
            };
            let _ = app.emit("backend:tick", payload);
            count += 1;
            if count % 20 == 0 {
                sync_auth_files_bg(&app).await;
            }
        }
    });
}

async fn sync_auth_files_bg(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let Ok(Some(account_key)) = state.db.get_last_account_key().await else { return };
    let Ok(Some(account)) = state.db.get_account(&account_key).await else { return };
    let Ok(Some(encrypted)) = state.db.get_encrypted_password(&account_key).await else { return };
    let Ok(password) = crypto::decrypt_password(&encrypted) else { return };
    let server = auth::normalize_api_base(&account.server);
    let Ok(value) = remote::list_auth_files(&server, &password).await else { return };
    let Ok(files): Result<Vec<crate::db::AuthFileRow>, _> = serde_json::from_value(value) else { return };
    let _ = state.db.sync_auth_files(&account_key, &files).await;
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}
