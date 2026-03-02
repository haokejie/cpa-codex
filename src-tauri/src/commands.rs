use crate::state::AppState;
use crate::auth;
use crate::crypto;
use crate::remote;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;

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

#[tauri::command]
pub async fn set_tray_enabled(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<CommandResult, String> {
    state.config.set_tray_enabled(enabled)?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn set_close_to_tray(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<CommandResult, String> {
    state.config.set_close_to_tray(enabled)?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn set_dock_visible_on_minimize(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<CommandResult, String> {
    state.config.set_dock_visible_on_minimize(enabled)?;
    #[cfg(target_os = "macos")]
    {
        let dock_visible = if enabled {
            true
        } else if let Some(window) = app.get_webview_window("main") {
            let minimized = window.is_minimized().unwrap_or(false);
            let visible = window.is_visible().unwrap_or(true);
            visible && !minimized
        } else {
            true
        };
        let policy = if dock_visible {
            ActivationPolicy::Regular
        } else {
            ActivationPolicy::Accessory
        };
        let _ = app.set_activation_policy(policy);
    }
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn set_auto_refresh_enabled(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<CommandResult, String> {
    state.config.set_auto_refresh_enabled(enabled)?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn set_auto_refresh_interval_seconds(
    state: State<'_, AppState>,
    seconds: u64,
) -> Result<CommandResult, String> {
    let min_seconds: u64 = 10;
    let max_seconds: u64 = 3600;
    if seconds < min_seconds {
        return Err(format!("刷新间隔不能小于 {min_seconds} 秒"));
    }
    if seconds > max_seconds {
        return Err(format!("刷新间隔不能超过 {max_seconds} 秒"));
    }
    state.config.set_auto_refresh_interval_seconds(seconds)?;
    Ok(CommandResult { ok: true })
}

fn build_account_key(server: &str) -> String {
    server.to_string()
}

async fn resolve_session(state: &AppState) -> Result<(String, String, String), String> {
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
    Ok((server, password, account_key))
}

#[tauri::command]
pub async fn get_codex_configs(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_codex_configs(&server, &password).await
}

#[tauri::command]
pub async fn save_codex_configs(state: State<'_, AppState>, configs: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_codex_configs(&server, &password, configs).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_codex_config(state: State<'_, AppState>, index: usize, config: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    let payload = serde_json::json!({ "index": index, "value": config });
    remote::update_codex_config(&server, &password, payload).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_codex_config(state: State<'_, AppState>, api_key: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_codex_config(&server, &password, &api_key).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn list_api_keys(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::list_api_keys(&server, &password).await
}

#[tauri::command]
pub async fn replace_api_keys(state: State<'_, AppState>, keys: Vec<String>) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::replace_api_keys(&server, &password, keys).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_api_key(state: State<'_, AppState>, index: usize, value: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_api_key(&server, &password, index, value).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_api_key(state: State<'_, AppState>, index: usize) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_api_key(&server, &password, index).await?;
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
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_usage(&server, &password).await
}

#[tauri::command]
pub async fn list_auth_files(state: State<'_, AppState>) -> Result<Vec<crate::db::AuthFileRow>, String> {
    let account_key = state.db.get_last_account_key().await?.ok_or_else(|| "未登录".to_string())?;
    state.db.list_auth_files(&account_key).await
}

#[tauri::command]
pub async fn sync_auth_files(state: State<'_, AppState>) -> Result<CommandResult, String> {
    let (server, password, account_key) = resolve_session(&state).await?;
    do_sync_auth_files(&state, &server, &password, &account_key).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn upload_auth_file(state: State<'_, AppState>, name: String, bytes: Vec<u8>) -> Result<CommandResult, String> {
    let (server, password, account_key) = resolve_session(&state).await?;
    remote::upload_auth_file(&server, &password, &name, bytes).await?;
    let _ = do_sync_auth_files(&state, &server, &password, &account_key).await;
    Ok(CommandResult { ok: true })
}

async fn do_sync_auth_files(state: &AppState, server: &str, password: &str, account_key: &str) -> Result<(), String> {
    let value = remote::list_auth_files(server, password).await?;
    let files: Vec<crate::db::AuthFileRow> = serde_json::from_value(value)
        .map_err(|e| format!("解析认证文件数据失败: {e}"))?;
    state.db.sync_auth_files(account_key, &files).await
}

#[tauri::command]
pub async fn set_auth_file_status(state: State<'_, AppState>, name: String, disabled: bool) -> Result<CommandResult, String> {
    let (server, password, account_key) = resolve_session(&state).await?;
    remote::set_auth_file_status(&server, &password, &name, disabled).await?;
    let _ = do_sync_auth_files(&state, &server, &password, &account_key).await;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_auth_file(state: State<'_, AppState>, name: String) -> Result<CommandResult, String> {
    let (server, password, account_key) = resolve_session(&state).await?;
    remote::delete_auth_file(&server, &password, &name).await?;
    let _ = do_sync_auth_files(&state, &server, &password, &account_key).await;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_all_auth_files(state: State<'_, AppState>) -> Result<CommandResult, String> {
    let (server, password, account_key) = resolve_session(&state).await?;
    remote::delete_all_auth_files(&server, &password).await?;
    let _ = do_sync_auth_files(&state, &server, &password, &account_key).await;
    Ok(CommandResult { ok: true })
}
