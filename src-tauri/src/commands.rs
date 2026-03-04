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

#[derive(Debug, Deserialize)]
pub struct LogsQuery {
    pub after: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct OAuthStartOptions {
    #[serde(rename = "projectId")]
    pub project_id: Option<String>,
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

#[tauri::command]
pub async fn reset_auth_files_cache(state: State<'_, AppState>) -> Result<CommandResult, String> {
    let (server, password, account_key) = resolve_session(&state).await?;
    state.db.clear_auth_files(&account_key).await?;
    do_sync_auth_files(&state, &server, &password, &account_key).await?;
    Ok(CommandResult { ok: true })
}

// ===== 远程配置 =====

#[tauri::command]
pub async fn get_server_config(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_server_config(&server, &password).await
}

#[tauri::command]
pub async fn get_server_raw_config(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_server_raw_config(&server, &password).await
}

#[tauri::command]
pub async fn update_debug(state: State<'_, AppState>, enabled: bool) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_debug(&server, &password, enabled).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_proxy_url(state: State<'_, AppState>, proxy_url: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_proxy_url(&server, &password, &proxy_url).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn clear_proxy_url(state: State<'_, AppState>) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::clear_proxy_url(&server, &password).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_request_retry(state: State<'_, AppState>, retry_count: u64) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_request_retry(&server, &password, retry_count).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_quota_switch_project(state: State<'_, AppState>, enabled: bool) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_quota_switch_project(&server, &password, enabled).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_quota_switch_preview_model(state: State<'_, AppState>, enabled: bool) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_quota_switch_preview_model(&server, &password, enabled).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_usage_statistics(state: State<'_, AppState>, enabled: bool) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_usage_statistics(&server, &password, enabled).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_request_log(state: State<'_, AppState>, enabled: bool) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_request_log(&server, &password, enabled).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_logging_to_file(state: State<'_, AppState>, enabled: bool) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_logging_to_file(&server, &password, enabled).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_logs_max_total_size_mb(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_logs_max_total_size_mb(&server, &password).await
}

#[tauri::command]
pub async fn update_logs_max_total_size_mb(state: State<'_, AppState>, value: u64) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_logs_max_total_size_mb(&server, &password, value).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_ws_auth(state: State<'_, AppState>, enabled: bool) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_ws_auth(&server, &password, enabled).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_force_model_prefix(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_force_model_prefix(&server, &password).await
}

#[tauri::command]
pub async fn update_force_model_prefix(state: State<'_, AppState>, enabled: bool) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_force_model_prefix(&server, &password, enabled).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_routing_strategy(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_routing_strategy(&server, &password).await
}

#[tauri::command]
pub async fn update_routing_strategy(state: State<'_, AppState>, strategy: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_routing_strategy(&server, &password, &strategy).await?;
    Ok(CommandResult { ok: true })
}

// ===== Providers =====

#[tauri::command]
pub async fn get_gemini_configs(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_gemini_configs(&server, &password).await
}

#[tauri::command]
pub async fn save_gemini_configs(state: State<'_, AppState>, configs: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_gemini_configs(&server, &password, configs).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_gemini_config(state: State<'_, AppState>, index: usize, value: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_gemini_config(&server, &password, index, value).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_gemini_config(state: State<'_, AppState>, api_key: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_gemini_config(&server, &password, &api_key).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_codex_provider_configs(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_codex_configs(&server, &password).await
}

#[tauri::command]
pub async fn save_codex_provider_configs(state: State<'_, AppState>, configs: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_codex_configs(&server, &password, configs).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_codex_provider_config(state: State<'_, AppState>, index: usize, value: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    let payload = serde_json::json!({ "index": index, "value": value });
    remote::update_codex_config(&server, &password, payload).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_codex_provider_config(state: State<'_, AppState>, api_key: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_codex_config(&server, &password, &api_key).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_claude_configs(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_claude_configs(&server, &password).await
}

#[tauri::command]
pub async fn save_claude_configs(state: State<'_, AppState>, configs: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_claude_configs(&server, &password, configs).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_claude_config(state: State<'_, AppState>, index: usize, value: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_claude_config(&server, &password, index, value).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_claude_config(state: State<'_, AppState>, api_key: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_claude_config(&server, &password, &api_key).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_vertex_configs(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_vertex_configs(&server, &password).await
}

#[tauri::command]
pub async fn save_vertex_configs(state: State<'_, AppState>, configs: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_vertex_configs(&server, &password, configs).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_vertex_config(state: State<'_, AppState>, index: usize, value: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_vertex_config(&server, &password, index, value).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_vertex_config(state: State<'_, AppState>, api_key: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_vertex_config(&server, &password, &api_key).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_openai_providers(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_openai_providers(&server, &password).await
}

#[tauri::command]
pub async fn save_openai_providers(state: State<'_, AppState>, providers: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_openai_providers(&server, &password, providers).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_openai_provider(state: State<'_, AppState>, index: usize, value: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_openai_provider(&server, &password, index, value).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_openai_provider(state: State<'_, AppState>, name: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_openai_provider(&server, &password, &name).await?;
    Ok(CommandResult { ok: true })
}

// ===== Ampcode =====

#[tauri::command]
pub async fn get_ampcode_config(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_ampcode_config(&server, &password).await
}

#[tauri::command]
pub async fn update_ampcode_upstream_url(state: State<'_, AppState>, url: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_ampcode_upstream_url(&server, &password, &url).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn clear_ampcode_upstream_url(state: State<'_, AppState>) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::clear_ampcode_upstream_url(&server, &password).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_ampcode_upstream_api_key(state: State<'_, AppState>, api_key: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_ampcode_upstream_api_key(&server, &password, &api_key).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn clear_ampcode_upstream_api_key(state: State<'_, AppState>) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::clear_ampcode_upstream_api_key(&server, &password).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_ampcode_model_mappings(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_ampcode_model_mappings(&server, &password).await
}

#[tauri::command]
pub async fn save_ampcode_model_mappings(state: State<'_, AppState>, mappings: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_ampcode_model_mappings(&server, &password, mappings).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn patch_ampcode_model_mappings(state: State<'_, AppState>, mappings: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::patch_ampcode_model_mappings(&server, &password, mappings).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn clear_ampcode_model_mappings(state: State<'_, AppState>) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::clear_ampcode_model_mappings(&server, &password).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_ampcode_model_mappings(state: State<'_, AppState>, from_list: Vec<String>) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_ampcode_model_mappings(&server, &password, from_list).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn update_ampcode_force_model_mappings(state: State<'_, AppState>, enabled: bool) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::update_ampcode_force_model_mappings(&server, &password, enabled).await?;
    Ok(CommandResult { ok: true })
}

// ===== OAuth =====

#[tauri::command]
pub async fn start_oauth(state: State<'_, AppState>, provider: String, options: Option<OAuthStartOptions>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    let mut params: Vec<(String, String)> = Vec::new();
    let provider_lower = provider.trim().to_lowercase();
    let webui_supported = matches!(provider_lower.as_str(), "codex" | "anthropic" | "antigravity" | "gemini-cli");
    if webui_supported {
        params.push(("is_webui".to_string(), "true".to_string()));
    }
    if provider_lower == "gemini-cli" {
        if let Some(project_id) = options.and_then(|o| o.project_id).filter(|v| !v.trim().is_empty()) {
            params.push(("project_id".to_string(), project_id));
        }
    }
    remote::start_oauth(&server, &password, &provider_lower, params).await
}

#[tauri::command]
pub async fn get_oauth_status(state: State<'_, AppState>, state_value: String) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_oauth_status(&server, &password, &state_value).await
}

#[tauri::command]
pub async fn submit_oauth_callback(state: State<'_, AppState>, provider: String, redirect_url: String) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    let normalized = if provider.trim().eq_ignore_ascii_case("gemini-cli") {
        "gemini".to_string()
    } else {
        provider.trim().to_string()
    };
    remote::submit_oauth_callback(&server, &password, &normalized, &redirect_url).await
}

#[tauri::command]
pub async fn iflow_cookie_auth(state: State<'_, AppState>, cookie: String) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::iflow_cookie_auth(&server, &password, &cookie).await
}

#[tauri::command]
pub async fn vertex_import(state: State<'_, AppState>, name: String, bytes: Vec<u8>, location: Option<String>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::import_vertex_credential(&server, &password, &name, bytes, location).await
}

// ===== Auth files extras =====

#[tauri::command]
pub async fn download_auth_file(state: State<'_, AppState>, name: String) -> Result<Vec<u8>, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::download_auth_file(&server, &password, &name).await
}

#[tauri::command]
pub async fn get_auth_file_models(state: State<'_, AppState>, name: String) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_auth_file_models(&server, &password, &name).await
}

#[tauri::command]
pub async fn get_model_definitions(state: State<'_, AppState>, channel: String) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_model_definitions(&server, &password, &channel).await
}

#[tauri::command]
pub async fn get_oauth_excluded_models(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_oauth_excluded_models(&server, &password).await
}

#[tauri::command]
pub async fn save_oauth_excluded_models(state: State<'_, AppState>, provider: String, models: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_oauth_excluded_models(&server, &password, &provider, models).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn replace_oauth_excluded_models(state: State<'_, AppState>, map: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::replace_oauth_excluded_models(&server, &password, map).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_oauth_excluded_entry(state: State<'_, AppState>, provider: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_oauth_excluded_entry(&server, &password, &provider).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn get_oauth_model_alias(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_oauth_model_alias(&server, &password).await
}

#[tauri::command]
pub async fn save_oauth_model_alias(state: State<'_, AppState>, channel: String, aliases: Value) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_oauth_model_alias(&server, &password, &channel, aliases).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn delete_oauth_model_alias(state: State<'_, AppState>, channel: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::delete_oauth_model_alias(&server, &password, &channel).await?;
    Ok(CommandResult { ok: true })
}

// ===== Usage export/import =====

#[tauri::command]
pub async fn export_usage(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::export_usage(&server, &password).await
}

#[tauri::command]
pub async fn import_usage(state: State<'_, AppState>, payload: Value) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::import_usage(&server, &password, payload).await
}

// ===== Logs =====

#[tauri::command]
pub async fn fetch_logs(state: State<'_, AppState>, params: Option<LogsQuery>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    let after = params.and_then(|p| p.after);
    remote::fetch_logs(&server, &password, after).await
}

#[tauri::command]
pub async fn clear_logs(state: State<'_, AppState>) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::clear_logs(&server, &password).await?;
    Ok(CommandResult { ok: true })
}

#[tauri::command]
pub async fn fetch_error_logs(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::fetch_error_logs(&server, &password).await
}

#[tauri::command]
pub async fn download_error_log(state: State<'_, AppState>, filename: String) -> Result<Vec<u8>, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::download_error_log(&server, &password, &filename).await
}

#[tauri::command]
pub async fn download_request_log_by_id(state: State<'_, AppState>, id: String) -> Result<Vec<u8>, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::download_request_log_by_id(&server, &password, &id).await
}

// ===== Config file =====

#[tauri::command]
pub async fn get_config_yaml(state: State<'_, AppState>) -> Result<String, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::get_config_yaml(&server, &password).await
}

#[tauri::command]
pub async fn save_config_yaml(state: State<'_, AppState>, content: String) -> Result<CommandResult, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::save_config_yaml(&server, &password, &content).await?;
    Ok(CommandResult { ok: true })
}

// ===== API call =====

#[tauri::command]
pub async fn api_call(state: State<'_, AppState>, payload: Value) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::api_call(&server, &password, payload).await
}

// ===== Models =====

#[tauri::command]
pub async fn fetch_models(url: String, api_key: Option<String>, headers: Option<Value>) -> Result<Value, String> {
    remote::fetch_models(&url, api_key.as_deref(), headers.as_ref()).await
}

// ===== Version =====

#[tauri::command]
pub async fn check_latest_version(state: State<'_, AppState>) -> Result<Value, String> {
    let (server, password, _) = resolve_session(&state).await?;
    remote::check_latest_version(&server, &password).await
}
