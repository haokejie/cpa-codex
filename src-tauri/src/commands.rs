use crate::state::AppState;
use crate::auth;
use crate::crypto;
use crate::remote;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub password: String,
    pub server: String,
    pub remember_password: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CommandResult {
    pub ok: bool,
}

#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<crate::config::AppConfig, String> {
    Ok(state.config.get())
}

#[tauri::command]
pub async fn set_autostart_enabled(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<CommandResult, String> {
    let manager = app.autolaunch();
    if enabled {
        manager
            .enable()
            .map_err(|e| format!("启用自启动失败: {e}"))?;
    } else {
        manager
            .disable()
            .map_err(|e| format!("关闭自启动失败: {e}"))?;
    }
    state.config.set_autostart_enabled(enabled)?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    payload: LoginPayload,
) -> Result<CommandResult, String> {
    let server = auth::normalize_api_base(payload.server.trim());
    let password = payload.password.trim().to_string();
    if server.is_empty() {
        return Err("服务器不能为空".to_string());
    }
    if password.is_empty() {
        return Err("密码不能为空".to_string());
    }

    auth::verify_login(&server, &password).await?;

    let account_key = build_account_key(&server);
    state
        .db
        .upsert_account(&account_key, &server)
        .await?;
    let remember_password = payload.remember_password.unwrap_or(true);
    if remember_password {
        let encrypted = crypto::encrypt_password(&password)?;
        state
            .db
            .set_account_password(&account_key, Some(&encrypted), true)
            .await?;
    } else {
        state.db.clear_account_password(&account_key).await?;
    }
    state.db.set_last_account_key(Some(&account_key)).await?;

    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn list_accounts(
    state: State<'_, AppState>,
) -> Result<Vec<crate::db::Account>, String> {
    state.db.list_accounts().await
}

#[tauri::command]
pub async fn delete_account(
    state: State<'_, AppState>,
    account_key: String,
) -> Result<CommandResult, String> {
    state.db.delete_account(&account_key).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn has_saved_password(
    state: State<'_, AppState>,
    account_key: String,
) -> Result<bool, String> {
    state.db.has_password(&account_key).await
}

#[tauri::command]
pub async fn get_last_account_key(
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state.db.get_last_account_key().await
}

#[tauri::command]
pub async fn login_with_saved_password(
    state: State<'_, AppState>,
    account_key: String,
) -> Result<CommandResult, String> {
    let encrypted = state.db.get_encrypted_password(&account_key).await?;
    let encrypted = match encrypted {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            return Err("未保存密码".to_string());
        }
    };
    let account = state
        .db
        .get_account(&account_key)
        .await?
        .ok_or_else(|| "账号不存在".to_string())?;
    let password = crypto::decrypt_password(&encrypted)?;
    let server = auth::normalize_api_base(&account.server);

    auth::verify_login(&server, &password).await?;

    state.db.upsert_account(&account_key, &server).await?;
    state.db.set_last_account_key(Some(&account_key)).await?;
    Ok(CommandResult { ok: true })
}

fn build_account_key(server: &str) -> String {
    server.to_string()
}

async fn resolve_session(state: &AppState) -> Result<(String, String), String> {
    let account_key = state
        .db
        .get_last_account_key()
        .await?
        .ok_or_else(|| "未登录".to_string())?;
    let account = state
        .db
        .get_account(&account_key)
        .await?
        .ok_or_else(|| "账号不存在".to_string())?;
    let encrypted = state
        .db
        .get_encrypted_password(&account_key)
        .await?
        .ok_or_else(|| "未保存密码，请重新登录".to_string())?;
    let password = crypto::decrypt_password(&encrypted)?;
    let server = auth::normalize_api_base(&account.server);
    Ok((server, password))
}

#[tauri::command]
pub async fn get_codex_configs(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password) = resolve_session(&state).await?;
    remote::get_codex_configs(&server, &password).await
}

#[tauri::command]
pub async fn save_codex_configs(state: State<'_, AppState>, configs: Value) -> Result<CommandResult, String> {
    let (server, password) = resolve_session(&state).await?;
    remote::save_codex_configs(&server, &password, configs).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_codex_config(state: State<'_, AppState>, index: usize, config: Value) -> Result<CommandResult, String> {
    let (server, password) = resolve_session(&state).await?;
    let payload = serde_json::json!({ "index": index, "config": config });
    remote::update_codex_config(&server, &password, payload).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_codex_config(state: State<'_, AppState>, api_key: String) -> Result<CommandResult, String> {
    let (server, password) = resolve_session(&state).await?;
    remote::delete_codex_config(&server, &password, &api_key).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_codex_quota(
    api_key: String,
    base_url: Option<String>,
    headers: Option<Value>,
) -> Result<Value, String> {
    remote::get_codex_quota(&api_key, base_url.as_deref(), headers.as_ref()).await
}

#[tauri::command]
pub async fn get_usage(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password) = resolve_session(&state).await?;
    remote::get_usage(&server, &password).await
}
