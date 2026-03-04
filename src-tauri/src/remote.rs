use reqwest::multipart::{Form, Part};
use reqwest::{Method, StatusCode};
use serde_json::Value;
use std::time::Duration;

use crate::auth::normalize_api_base;

const MANAGEMENT_API_PREFIX: &str = "/v0/management";
const CODEX_API_KEY_PATH: &str = "/codex-api-key";
const GEMINI_API_KEY_PATH: &str = "/gemini-api-key";
const CLAUDE_API_KEY_PATH: &str = "/claude-api-key";
const VERTEX_API_KEY_PATH: &str = "/vertex-api-key";
const VERTEX_IMPORT_PATH: &str = "/vertex/import";
const OPENAI_COMPAT_PATH: &str = "/openai-compatibility";
const API_KEYS_PATH: &str = "/api-keys";
const CONFIG_PATH: &str = "/config";
const CONFIG_YAML_PATH: &str = "/config.yaml";
const AUTH_FILES_PATH: &str = "/auth-files";
const AUTH_FILES_STATUS_PATH: &str = "/auth-files/status";
const AUTH_FILES_DOWNLOAD_PATH: &str = "/auth-files/download";
const AUTH_FILES_MODELS_PATH: &str = "/auth-files/models";
const OAUTH_EXCLUDED_MODELS_PATH: &str = "/oauth-excluded-models";
const OAUTH_MODEL_ALIAS_PATH: &str = "/oauth-model-alias";
const MODEL_DEFINITIONS_PATH: &str = "/model-definitions";
const USAGE_PATH: &str = "/usage";
const USAGE_EXPORT_PATH: &str = "/usage/export";
const USAGE_IMPORT_PATH: &str = "/usage/import";
const LOGS_PATH: &str = "/logs";
const ERROR_LOGS_PATH: &str = "/request-error-logs";
const REQUEST_LOG_BY_ID_PATH: &str = "/request-log-by-id";
const LATEST_VERSION_PATH: &str = "/latest-version";
const AMP_CODE_PATH: &str = "/ampcode";
const AMP_CODE_MODEL_MAPPINGS_PATH: &str = "/ampcode/model-mappings";
const AMP_CODE_UPSTREAM_URL_PATH: &str = "/ampcode/upstream-url";
const AMP_CODE_UPSTREAM_KEY_PATH: &str = "/ampcode/upstream-api-key";
const AMP_CODE_FORCE_MAPPINGS_PATH: &str = "/ampcode/force-model-mappings";
const API_CALL_PATH: &str = "/api-call";
const DEBUG_PATH: &str = "/debug";
const PROXY_URL_PATH: &str = "/proxy-url";
const REQUEST_RETRY_PATH: &str = "/request-retry";
const QUOTA_SWITCH_PROJECT_PATH: &str = "/quota-exceeded/switch-project";
const QUOTA_SWITCH_PREVIEW_MODEL_PATH: &str = "/quota-exceeded/switch-preview-model";
const USAGE_STATISTICS_ENABLED_PATH: &str = "/usage-statistics-enabled";
const REQUEST_LOG_PATH: &str = "/request-log";
const LOGGING_TO_FILE_PATH: &str = "/logging-to-file";
const LOGS_MAX_TOTAL_SIZE_MB_PATH: &str = "/logs-max-total-size-mb";
const WS_AUTH_PATH: &str = "/ws-auth";
const FORCE_MODEL_PREFIX_PATH: &str = "/force-model-prefix";
const ROUTING_STRATEGY_PATH: &str = "/routing/strategy";
const DEFAULT_CODEX_BASE_URL: &str = "https://api.openai.com";
const CODEX_USAGE_PATH: &str = "/dashboard/user/codex_usage";
const REQUEST_TIMEOUT_SECS: u64 = 30;

pub async fn list_auth_files(server: &str, password: &str) -> Result<Value, String> {
    let url = build_url(server, AUTH_FILES_PATH);
    let resp = client()?.get(&url).bearer_auth(password).send().await.map_err(map_error)?;
    if !resp.status().is_success() { return Err(map_status(resp.status())); }
    let body: Value = resp.json().await.map_err(|e| format!("解析响应失败: {e}"))?;
    let files = body.get("files").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    Ok(Value::Array(files))
}

pub async fn set_auth_file_status(server: &str, password: &str, name: &str, disabled: bool) -> Result<(), String> {
    let url = build_url(server, AUTH_FILES_STATUS_PATH);
    let resp = client()?.patch(&url).bearer_auth(password)
        .json(&serde_json::json!({ "name": name, "disabled": disabled }))
        .send().await.map_err(map_error)?;
    if !resp.status().is_success() { return Err(map_status(resp.status())); }
    Ok(())
}

pub async fn delete_auth_file(server: &str, password: &str, name: &str) -> Result<(), String> {
    let url = build_url(server, AUTH_FILES_PATH);
    let resp = client()?.delete(&url).bearer_auth(password)
        .query(&[("name", name)])
        .send().await.map_err(map_error)?;
    if !resp.status().is_success() { return Err(map_status(resp.status())); }
    Ok(())
}

pub async fn delete_all_auth_files(server: &str, password: &str) -> Result<(), String> {
    let url = format!("{}?all=true", build_url(server, AUTH_FILES_PATH));
    let resp = client()?.delete(&url).bearer_auth(password).send().await.map_err(map_error)?;
    if !resp.status().is_success() { return Err(map_status(resp.status())); }
    Ok(())
}

pub async fn upload_auth_file(server: &str, password: &str, name: &str, bytes: Vec<u8>) -> Result<(), String> {
    let url = build_url(server, AUTH_FILES_PATH);
    let part = Part::bytes(bytes)
        .file_name(name.to_string())
        .mime_str("application/json")
        .map_err(|e| format!("构建上传文件失败: {e}"))?;
    let form = Form::new().part("file", part);
    let resp = client()?
        .post(&url)
        .bearer_auth(password)
        .multipart(form)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() { return Err(map_status(resp.status())); }
    Ok(())
}

fn build_url(server: &str, path: &str) -> String {
    let base = normalize_api_base(server);
    format!("{base}{MANAGEMENT_API_PREFIX}{path}")
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("初始化网络请求失败: {e}"))
}

fn map_error(err: reqwest::Error) -> String {
    if err.is_timeout() {
        return "请求超时".to_string();
    }
    if err.is_connect() {
        return "无法连接服务器".to_string();
    }
    format!("请求失败: {err}")
}

fn map_status(status: StatusCode) -> String {
    match status.as_u16() {
        401 | 403 => "认证失败，请重新登录".to_string(),
        404 => "接口不存在，请确认服务器版本 >= 6.8.0".to_string(),
        code if code >= 500 => format!("服务器错误（HTTP {code}）"),
        code => format!("请求失败（HTTP {code}）"),
    }
}

async fn request_json(
    server: &str,
    password: &str,
    method: Method,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let url = build_url(server, path);
    let mut req = client()?.request(method, &url).bearer_auth(password);
    if let Some(payload) = body {
        req = req.json(&payload);
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    resp.json::<Value>()
        .await
        .map_err(|e| format!("解析响应失败: {e}"))
}

async fn request_json_with_query(
    server: &str,
    password: &str,
    method: Method,
    path: &str,
    query: &[(&str, &str)],
    body: Option<Value>,
) -> Result<Value, String> {
    let url = build_url(server, path);
    let mut req = client()?.request(method, &url).bearer_auth(password).query(query);
    if let Some(payload) = body {
        req = req.json(&payload);
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    resp.json::<Value>()
        .await
        .map_err(|e| format!("解析响应失败: {e}"))
}

async fn request_empty(
    server: &str,
    password: &str,
    method: Method,
    path: &str,
    body: Option<Value>,
) -> Result<(), String> {
    let url = build_url(server, path);
    let mut req = client()?.request(method, &url).bearer_auth(password);
    if let Some(payload) = body {
        req = req.json(&payload);
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    Ok(())
}

async fn request_empty_with_query(
    server: &str,
    password: &str,
    method: Method,
    path: &str,
    query: &[(&str, &str)],
    body: Option<Value>,
) -> Result<(), String> {
    let url = build_url(server, path);
    let mut req = client()?.request(method, &url).bearer_auth(password).query(query);
    if let Some(payload) = body {
        req = req.json(&payload);
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    Ok(())
}

async fn request_text(
    server: &str,
    password: &str,
    method: Method,
    path: &str,
    body: Option<String>,
    content_type: Option<&str>,
    accept: Option<&str>,
) -> Result<String, String> {
    let url = build_url(server, path);
    let mut req = client()?.request(method, &url).bearer_auth(password);
    if let Some(ct) = content_type {
        req = req.header("Content-Type", ct);
    }
    if let Some(acc) = accept {
        req = req.header("Accept", acc);
    }
    if let Some(payload) = body {
        req = req.body(payload);
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    resp.text()
        .await
        .map_err(|e| format!("解析响应失败: {e}"))
}

async fn request_bytes(
    server: &str,
    password: &str,
    method: Method,
    path: &str,
    query: Option<&[(&str, &str)]>,
) -> Result<Vec<u8>, String> {
    let url = build_url(server, path);
    let mut req = client()?.request(method, &url).bearer_auth(password);
    if let Some(items) = query {
        req = req.query(items);
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| format!("读取响应失败: {e}"))?;
    Ok(bytes.to_vec())
}

async fn request_json_raw(
    url: &str,
    method: Method,
    api_key: Option<&str>,
    headers: Option<&Value>,
) -> Result<Value, String> {
    let mut req = client()?.request(method, url);
    if let Some(key) = api_key {
        req = req.bearer_auth(key);
    }
    if let Some(Value::Object(h)) = headers {
        for (k, v) in h {
            if let Some(s) = v.as_str() {
                req = req.header(k, s);
            }
        }
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    resp.json::<Value>()
        .await
        .map_err(|e| format!("解析响应失败: {e}"))
}

// kebab-case → camelCase（读取时）
fn normalize_config(item: &Value) -> Value {
    let Some(obj) = item.as_object() else { return item.clone() };
    let mut out = serde_json::Map::new();
    let key_map: &[(&str, &str)] = &[
        ("api-key", "apiKey"),
        ("base-url", "baseUrl"),
        ("proxy-url", "proxyUrl"),
        ("excluded-models", "excludedModels"),
        ("strict-mode", "strictMode"),
        ("sensitive-words", "sensitiveWords"),
    ];
    for (k, v) in obj {
        let new_key = key_map.iter().find(|(from, _)| from == k).map(|(_, to)| *to).unwrap_or(k.as_str());
        let new_val = if k == "cloak" { normalize_config(v) } else { v.clone() };
        out.insert(new_key.to_string(), new_val);
    }
    Value::Object(out)
}

// camelCase → kebab-case（写入时）
fn serialize_config(item: &Value) -> Value {
    let Some(obj) = item.as_object() else { return item.clone() };
    let mut out = serde_json::Map::new();
    let key_map: &[(&str, &str)] = &[
        ("apiKey", "api-key"),
        ("baseUrl", "base-url"),
        ("proxyUrl", "proxy-url"),
        ("excludedModels", "excluded-models"),
        ("strictMode", "strict-mode"),
        ("sensitiveWords", "sensitive-words"),
    ];
    for (k, v) in obj {
        let new_key = key_map.iter().find(|(from, _)| from == k).map(|(_, to)| *to).unwrap_or(k.as_str());
        let new_val = if k == "cloak" { serialize_config(v) } else { v.clone() };
        out.insert(new_key.to_string(), new_val);
    }
    Value::Object(out)
}

pub async fn get_codex_configs(server: &str, password: &str) -> Result<Value, String> {
    let url = build_url(server, CODEX_API_KEY_PATH);
    let resp = client()?
        .get(&url)
        .bearer_auth(password)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| format!("解析响应失败: {e}"))?;
    let arr = match &body {
        Value::Array(_) => &body,
        Value::Object(obj) => obj.get("codex-api-key").unwrap_or(&body),
        _ => &body,
    };
    let items = arr.as_array().map(|a| a.iter().map(normalize_config).collect::<Vec<_>>());
    Ok(items.map(Value::Array).unwrap_or(body))
}

pub async fn save_codex_configs(server: &str, password: &str, configs: Value) -> Result<(), String> {
    let url = build_url(server, CODEX_API_KEY_PATH);
    let body = configs.as_array()
        .map(|a| Value::Array(a.iter().map(serialize_config).collect()))
        .unwrap_or(configs);
    let resp = client()?
        .put(&url)
        .bearer_auth(password)
        .json(&body)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    Ok(())
}

pub async fn update_codex_config(server: &str, password: &str, payload: Value) -> Result<(), String> {
    let url = build_url(server, CODEX_API_KEY_PATH);
    let body = if let Some(obj) = payload.as_object() {
        let mut out = obj.clone();
        if let Some(v) = out.remove("value") {
            out.insert("value".to_string(), serialize_config(&v));
        }
        Value::Object(out)
    } else {
        payload
    };
    let resp = client()?
        .patch(&url)
        .bearer_auth(password)
        .json(&body)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    Ok(())
}

pub async fn delete_codex_config(server: &str, password: &str, api_key: &str) -> Result<(), String> {
    let url = format!(
        "{}?api-key={}",
        build_url(server, CODEX_API_KEY_PATH),
        api_key
    );
    let resp = client()?
        .delete(&url)
        .bearer_auth(password)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    Ok(())
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => "".to_string(),
        other => other.to_string(),
    }
}

pub async fn list_api_keys(server: &str, password: &str) -> Result<Vec<String>, String> {
    let url = build_url(server, API_KEYS_PATH);
    let resp = client()?
        .get(&url)
        .bearer_auth(password)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| format!("解析响应失败: {e}"))?;
    let keys_value = match &body {
        Value::Array(_) => &body,
        Value::Object(obj) => obj
            .get("api-keys")
            .or_else(|| obj.get("apiKeys"))
            .unwrap_or(&body),
        _ => &body,
    };
    let keys = keys_value
        .as_array()
        .map(|items| {
            items
                .iter()
                .map(value_to_string)
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(keys)
}

pub async fn replace_api_keys(server: &str, password: &str, keys: Vec<String>) -> Result<(), String> {
    let url = build_url(server, API_KEYS_PATH);
    let resp = client()?
        .put(&url)
        .bearer_auth(password)
        .json(&keys)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    Ok(())
}

pub async fn update_api_key(server: &str, password: &str, index: usize, value: String) -> Result<(), String> {
    let url = build_url(server, API_KEYS_PATH);
    let resp = client()?
        .patch(&url)
        .bearer_auth(password)
        .json(&serde_json::json!({ "index": index, "value": value }))
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    Ok(())
}

pub async fn delete_api_key(server: &str, password: &str, index: usize) -> Result<(), String> {
    let url = format!("{}?index={}", build_url(server, API_KEYS_PATH), index);
    let resp = client()?
        .delete(&url)
        .bearer_auth(password)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    Ok(())
}

pub async fn get_codex_quota(
    api_key: &str,
    base_url: Option<&str>,
    headers: Option<&Value>,
) -> Result<Value, String> {
    let base = match base_url {
        Some(b) if !b.is_empty() => normalize_api_base(b),
        _ => DEFAULT_CODEX_BASE_URL.to_string(),
    };
    let url = format!("{base}{CODEX_USAGE_PATH}");
    let mut req = client()?.get(&url).bearer_auth(api_key);
    if let Some(Value::Object(h)) = headers {
        for (k, v) in h {
            if let Some(s) = v.as_str() {
                req = req.header(k, s);
            }
        }
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    resp.json::<Value>()
        .await
        .map_err(|e| format!("解析响应失败: {e}"))
}

pub async fn get_usage(server: &str, password: &str) -> Result<Value, String> {
    let url = build_url(server, USAGE_PATH);
    let resp = client()?
        .get(&url)
        .bearer_auth(password)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    resp.json::<Value>()
        .await
        .map_err(|e| format!("解析响应失败: {e}"))
}

// ===== 远程配置 =====

pub async fn get_server_config(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, CONFIG_PATH, None).await
}

pub async fn get_server_raw_config(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, CONFIG_PATH, None).await
}

pub async fn update_debug(server: &str, password: &str, enabled: bool) -> Result<(), String> {
    request_empty(server, password, Method::PUT, DEBUG_PATH, Some(serde_json::json!({ "value": enabled }))).await
}

pub async fn update_proxy_url(server: &str, password: &str, proxy_url: &str) -> Result<(), String> {
    request_empty(server, password, Method::PUT, PROXY_URL_PATH, Some(serde_json::json!({ "value": proxy_url }))).await
}

pub async fn clear_proxy_url(server: &str, password: &str) -> Result<(), String> {
    request_empty(server, password, Method::DELETE, PROXY_URL_PATH, None).await
}

pub async fn update_request_retry(server: &str, password: &str, retry_count: u64) -> Result<(), String> {
    request_empty(server, password, Method::PUT, REQUEST_RETRY_PATH, Some(serde_json::json!({ "value": retry_count }))).await
}

pub async fn update_quota_switch_project(server: &str, password: &str, enabled: bool) -> Result<(), String> {
    request_empty(server, password, Method::PUT, QUOTA_SWITCH_PROJECT_PATH, Some(serde_json::json!({ "value": enabled }))).await
}

pub async fn update_quota_switch_preview_model(server: &str, password: &str, enabled: bool) -> Result<(), String> {
    request_empty(server, password, Method::PUT, QUOTA_SWITCH_PREVIEW_MODEL_PATH, Some(serde_json::json!({ "value": enabled }))).await
}

pub async fn update_usage_statistics(server: &str, password: &str, enabled: bool) -> Result<(), String> {
    request_empty(server, password, Method::PUT, USAGE_STATISTICS_ENABLED_PATH, Some(serde_json::json!({ "value": enabled }))).await
}

pub async fn update_request_log(server: &str, password: &str, enabled: bool) -> Result<(), String> {
    request_empty(server, password, Method::PUT, REQUEST_LOG_PATH, Some(serde_json::json!({ "value": enabled }))).await
}

pub async fn update_logging_to_file(server: &str, password: &str, enabled: bool) -> Result<(), String> {
    request_empty(server, password, Method::PUT, LOGGING_TO_FILE_PATH, Some(serde_json::json!({ "value": enabled }))).await
}

pub async fn get_logs_max_total_size_mb(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, LOGS_MAX_TOTAL_SIZE_MB_PATH, None).await
}

pub async fn update_logs_max_total_size_mb(server: &str, password: &str, value: u64) -> Result<(), String> {
    request_empty(server, password, Method::PUT, LOGS_MAX_TOTAL_SIZE_MB_PATH, Some(serde_json::json!({ "value": value }))).await
}

pub async fn update_ws_auth(server: &str, password: &str, enabled: bool) -> Result<(), String> {
    request_empty(server, password, Method::PUT, WS_AUTH_PATH, Some(serde_json::json!({ "value": enabled }))).await
}

pub async fn get_force_model_prefix(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, FORCE_MODEL_PREFIX_PATH, None).await
}

pub async fn update_force_model_prefix(server: &str, password: &str, enabled: bool) -> Result<(), String> {
    request_empty(server, password, Method::PUT, FORCE_MODEL_PREFIX_PATH, Some(serde_json::json!({ "value": enabled }))).await
}

pub async fn get_routing_strategy(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, ROUTING_STRATEGY_PATH, None).await
}

pub async fn update_routing_strategy(server: &str, password: &str, strategy: &str) -> Result<(), String> {
    request_empty(server, password, Method::PUT, ROUTING_STRATEGY_PATH, Some(serde_json::json!({ "value": strategy }))).await
}

// ===== Providers =====

async fn get_provider_configs(server: &str, password: &str, path: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, path, None).await
}

async fn save_provider_configs(server: &str, password: &str, path: &str, configs: Value) -> Result<(), String> {
    request_empty(server, password, Method::PUT, path, Some(configs)).await
}

async fn update_provider_config(server: &str, password: &str, path: &str, index: usize, value: Value) -> Result<(), String> {
    request_empty(server, password, Method::PATCH, path, Some(serde_json::json!({ "index": index, "value": value }))).await
}

async fn delete_provider_config(server: &str, password: &str, path: &str, api_key: &str) -> Result<(), String> {
    request_empty_with_query(server, password, Method::DELETE, path, &[ ("api-key", api_key) ], None).await
}

pub async fn get_gemini_configs(server: &str, password: &str) -> Result<Value, String> {
    get_provider_configs(server, password, GEMINI_API_KEY_PATH).await
}

pub async fn save_gemini_configs(server: &str, password: &str, configs: Value) -> Result<(), String> {
    save_provider_configs(server, password, GEMINI_API_KEY_PATH, configs).await
}

pub async fn update_gemini_config(server: &str, password: &str, index: usize, value: Value) -> Result<(), String> {
    update_provider_config(server, password, GEMINI_API_KEY_PATH, index, value).await
}

pub async fn delete_gemini_config(server: &str, password: &str, api_key: &str) -> Result<(), String> {
    delete_provider_config(server, password, GEMINI_API_KEY_PATH, api_key).await
}

pub async fn get_claude_configs(server: &str, password: &str) -> Result<Value, String> {
    get_provider_configs(server, password, CLAUDE_API_KEY_PATH).await
}

pub async fn save_claude_configs(server: &str, password: &str, configs: Value) -> Result<(), String> {
    save_provider_configs(server, password, CLAUDE_API_KEY_PATH, configs).await
}

pub async fn update_claude_config(server: &str, password: &str, index: usize, value: Value) -> Result<(), String> {
    update_provider_config(server, password, CLAUDE_API_KEY_PATH, index, value).await
}

pub async fn delete_claude_config(server: &str, password: &str, api_key: &str) -> Result<(), String> {
    delete_provider_config(server, password, CLAUDE_API_KEY_PATH, api_key).await
}

pub async fn get_vertex_configs(server: &str, password: &str) -> Result<Value, String> {
    get_provider_configs(server, password, VERTEX_API_KEY_PATH).await
}

pub async fn save_vertex_configs(server: &str, password: &str, configs: Value) -> Result<(), String> {
    save_provider_configs(server, password, VERTEX_API_KEY_PATH, configs).await
}

pub async fn update_vertex_config(server: &str, password: &str, index: usize, value: Value) -> Result<(), String> {
    update_provider_config(server, password, VERTEX_API_KEY_PATH, index, value).await
}

pub async fn delete_vertex_config(server: &str, password: &str, api_key: &str) -> Result<(), String> {
    delete_provider_config(server, password, VERTEX_API_KEY_PATH, api_key).await
}

pub async fn get_openai_providers(server: &str, password: &str) -> Result<Value, String> {
    get_provider_configs(server, password, OPENAI_COMPAT_PATH).await
}

pub async fn save_openai_providers(server: &str, password: &str, providers: Value) -> Result<(), String> {
    save_provider_configs(server, password, OPENAI_COMPAT_PATH, providers).await
}

pub async fn update_openai_provider(server: &str, password: &str, index: usize, value: Value) -> Result<(), String> {
    update_provider_config(server, password, OPENAI_COMPAT_PATH, index, value).await
}

pub async fn delete_openai_provider(server: &str, password: &str, name: &str) -> Result<(), String> {
    request_empty_with_query(server, password, Method::DELETE, OPENAI_COMPAT_PATH, &[ ("name", name) ], None).await
}

// ===== Ampcode =====

pub async fn get_ampcode_config(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, AMP_CODE_PATH, None).await
}

pub async fn update_ampcode_upstream_url(server: &str, password: &str, url: &str) -> Result<(), String> {
    request_empty(server, password, Method::PUT, AMP_CODE_UPSTREAM_URL_PATH, Some(serde_json::json!({ "value": url }))).await
}

pub async fn clear_ampcode_upstream_url(server: &str, password: &str) -> Result<(), String> {
    request_empty(server, password, Method::DELETE, AMP_CODE_UPSTREAM_URL_PATH, None).await
}

pub async fn update_ampcode_upstream_api_key(server: &str, password: &str, api_key: &str) -> Result<(), String> {
    request_empty(server, password, Method::PUT, AMP_CODE_UPSTREAM_KEY_PATH, Some(serde_json::json!({ "value": api_key }))).await
}

pub async fn clear_ampcode_upstream_api_key(server: &str, password: &str) -> Result<(), String> {
    request_empty(server, password, Method::DELETE, AMP_CODE_UPSTREAM_KEY_PATH, None).await
}

pub async fn get_ampcode_model_mappings(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, AMP_CODE_MODEL_MAPPINGS_PATH, None).await
}

pub async fn save_ampcode_model_mappings(server: &str, password: &str, mappings: Value) -> Result<(), String> {
    request_empty(server, password, Method::PUT, AMP_CODE_MODEL_MAPPINGS_PATH, Some(serde_json::json!({ "value": mappings }))).await
}

pub async fn patch_ampcode_model_mappings(server: &str, password: &str, mappings: Value) -> Result<(), String> {
    request_empty(server, password, Method::PATCH, AMP_CODE_MODEL_MAPPINGS_PATH, Some(serde_json::json!({ "value": mappings }))).await
}

pub async fn clear_ampcode_model_mappings(server: &str, password: &str) -> Result<(), String> {
    request_empty(server, password, Method::DELETE, AMP_CODE_MODEL_MAPPINGS_PATH, None).await
}

pub async fn delete_ampcode_model_mappings(server: &str, password: &str, from_list: Vec<String>) -> Result<(), String> {
    if from_list.is_empty() {
        return request_empty(server, password, Method::DELETE, AMP_CODE_MODEL_MAPPINGS_PATH, None).await;
    }
    request_empty(server, password, Method::DELETE, AMP_CODE_MODEL_MAPPINGS_PATH, Some(serde_json::json!({ "value": from_list }))).await
}

pub async fn update_ampcode_force_model_mappings(server: &str, password: &str, enabled: bool) -> Result<(), String> {
    request_empty(server, password, Method::PUT, AMP_CODE_FORCE_MAPPINGS_PATH, Some(serde_json::json!({ "value": enabled }))).await
}

// ===== OAuth =====

pub async fn start_oauth(server: &str, password: &str, provider: &str, params: Vec<(String, String)>) -> Result<Value, String> {
    let path = format!("/{provider}-auth-url");
    let url = build_url(server, &path);
    let mut req = client()?.get(&url).bearer_auth(password);
    if !params.is_empty() {
        req = req.query(&params);
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    resp.json::<Value>().await.map_err(|e| format!("解析响应失败: {e}"))
}

pub async fn get_oauth_status(server: &str, password: &str, state: &str) -> Result<Value, String> {
    request_json_with_query(server, password, Method::GET, "/get-auth-status", &[ ("state", state) ], None).await
}

pub async fn submit_oauth_callback(server: &str, password: &str, provider: &str, redirect_url: &str) -> Result<Value, String> {
    request_json(server, password, Method::POST, "/oauth-callback", Some(serde_json::json!({ "provider": provider, "redirect_url": redirect_url }))).await
}

pub async fn iflow_cookie_auth(server: &str, password: &str, cookie: &str) -> Result<Value, String> {
    request_json(server, password, Method::POST, "/iflow-auth-url", Some(serde_json::json!({ "cookie": cookie }))).await
}

pub async fn import_vertex_credential(
    server: &str,
    password: &str,
    name: &str,
    bytes: Vec<u8>,
    location: Option<String>,
) -> Result<Value, String> {
    let url = build_url(server, VERTEX_IMPORT_PATH);
    let part = Part::bytes(bytes)
        .file_name(name.to_string())
        .mime_str("application/json")
        .map_err(|e| format!("构建上传文件失败: {e}"))?;
    let mut form = Form::new().part("file", part);
    if let Some(location_value) = location {
        let trimmed = location_value.trim().to_string();
        if !trimmed.is_empty() {
            form = form.text("location", trimmed);
        }
    }
    let resp = client()?
        .post(&url)
        .bearer_auth(password)
        .multipart(form)
        .send()
        .await
        .map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    resp.json::<Value>().await.map_err(|e| format!("解析响应失败: {e}"))
}

// ===== Auth files extras =====

pub async fn download_auth_file(server: &str, password: &str, name: &str) -> Result<Vec<u8>, String> {
    request_bytes(server, password, Method::GET, AUTH_FILES_DOWNLOAD_PATH, Some(&[("name", name)])).await
}

pub async fn get_auth_file_models(server: &str, password: &str, name: &str) -> Result<Value, String> {
    request_json_with_query(server, password, Method::GET, AUTH_FILES_MODELS_PATH, &[ ("name", name) ], None).await
}

pub async fn get_model_definitions(server: &str, password: &str, channel: &str) -> Result<Value, String> {
    let path = format!("{MODEL_DEFINITIONS_PATH}/{channel}");
    request_json(server, password, Method::GET, &path, None).await
}

pub async fn get_oauth_excluded_models(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, OAUTH_EXCLUDED_MODELS_PATH, None).await
}

pub async fn save_oauth_excluded_models(server: &str, password: &str, provider: &str, models: Value) -> Result<(), String> {
    request_empty(server, password, Method::PATCH, OAUTH_EXCLUDED_MODELS_PATH, Some(serde_json::json!({ "provider": provider, "models": models }))).await
}

pub async fn replace_oauth_excluded_models(server: &str, password: &str, map: Value) -> Result<(), String> {
    request_empty(server, password, Method::PUT, OAUTH_EXCLUDED_MODELS_PATH, Some(map)).await
}

pub async fn delete_oauth_excluded_entry(server: &str, password: &str, provider: &str) -> Result<(), String> {
    request_empty_with_query(server, password, Method::DELETE, OAUTH_EXCLUDED_MODELS_PATH, &[ ("provider", provider) ], None).await
}

pub async fn get_oauth_model_alias(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, OAUTH_MODEL_ALIAS_PATH, None).await
}

pub async fn save_oauth_model_alias(server: &str, password: &str, channel: &str, aliases: Value) -> Result<(), String> {
    request_empty(server, password, Method::PATCH, OAUTH_MODEL_ALIAS_PATH, Some(serde_json::json!({ "channel": channel, "aliases": aliases }))).await
}

pub async fn delete_oauth_model_alias(server: &str, password: &str, channel: &str) -> Result<(), String> {
    request_empty_with_query(server, password, Method::DELETE, OAUTH_MODEL_ALIAS_PATH, &[ ("channel", channel) ], None).await
}

// ===== Usage export/import =====

pub async fn export_usage(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, USAGE_EXPORT_PATH, None).await
}

pub async fn import_usage(server: &str, password: &str, payload: Value) -> Result<Value, String> {
    request_json(server, password, Method::POST, USAGE_IMPORT_PATH, Some(payload)).await
}

// ===== Logs =====

pub async fn fetch_logs(server: &str, password: &str, after: Option<i64>) -> Result<Value, String> {
    let url = build_url(server, LOGS_PATH);
    let mut req = client()?.get(&url).bearer_auth(password);
    if let Some(value) = after {
        req = req.query(&[("after", value)]);
    }
    let resp = req.send().await.map_err(map_error)?;
    if !resp.status().is_success() {
        return Err(map_status(resp.status()));
    }
    resp.json::<Value>().await.map_err(|e| format!("解析响应失败: {e}"))
}

pub async fn clear_logs(server: &str, password: &str) -> Result<(), String> {
    request_empty(server, password, Method::DELETE, LOGS_PATH, None).await
}

pub async fn fetch_error_logs(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, ERROR_LOGS_PATH, None).await
}

pub async fn download_error_log(server: &str, password: &str, filename: &str) -> Result<Vec<u8>, String> {
    let path = format!("{ERROR_LOGS_PATH}/{filename}");
    request_bytes(server, password, Method::GET, &path, None).await
}

pub async fn download_request_log_by_id(server: &str, password: &str, id: &str) -> Result<Vec<u8>, String> {
    let path = format!("{REQUEST_LOG_BY_ID_PATH}/{id}");
    request_bytes(server, password, Method::GET, &path, None).await
}

// ===== Config file =====

pub async fn get_config_yaml(server: &str, password: &str) -> Result<String, String> {
    request_text(
        server,
        password,
        Method::GET,
        CONFIG_YAML_PATH,
        None,
        None,
        Some("application/yaml, text/yaml, text/plain"),
    ).await
}

pub async fn save_config_yaml(server: &str, password: &str, content: &str) -> Result<(), String> {
    let _ = request_text(
        server,
        password,
        Method::PUT,
        CONFIG_YAML_PATH,
        Some(content.to_string()),
        Some("application/yaml"),
        Some("application/json, text/plain, */*"),
    ).await?;
    Ok(())
}

// ===== API call =====

pub async fn api_call(server: &str, password: &str, payload: Value) -> Result<Value, String> {
    request_json(server, password, Method::POST, API_CALL_PATH, Some(payload)).await
}

// ===== Models =====

pub async fn fetch_models(url: &str, api_key: Option<&str>, headers: Option<&Value>) -> Result<Value, String> {
    request_json_raw(url, Method::GET, api_key, headers).await
}

// ===== Version =====

pub async fn check_latest_version(server: &str, password: &str) -> Result<Value, String> {
    request_json(server, password, Method::GET, LATEST_VERSION_PATH, None).await
}
