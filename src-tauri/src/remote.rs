use reqwest::multipart::{Form, Part};
use reqwest::StatusCode;
use serde_json::Value;
use std::time::Duration;

use crate::auth::normalize_api_base;

const MANAGEMENT_API_PREFIX: &str = "/v0/management";
const CODEX_API_KEY_PATH: &str = "/codex-api-key";
const API_KEYS_PATH: &str = "/api-keys";
const DEFAULT_CODEX_BASE_URL: &str = "https://api.openai.com";
const CODEX_USAGE_PATH: &str = "/dashboard/user/codex_usage";
const REQUEST_TIMEOUT_SECS: u64 = 30;

pub async fn list_auth_files(server: &str, password: &str) -> Result<Value, String> {
    let url = build_url(server, "/auth-files");
    let resp = client()?.get(&url).bearer_auth(password).send().await.map_err(map_error)?;
    if !resp.status().is_success() { return Err(map_status(resp.status())); }
    let body: Value = resp.json().await.map_err(|e| format!("解析响应失败: {e}"))?;
    let files = body.get("files").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    Ok(Value::Array(files))
}

pub async fn set_auth_file_status(server: &str, password: &str, name: &str, disabled: bool) -> Result<(), String> {
    let url = build_url(server, "/auth-files/status");
    let resp = client()?.patch(&url).bearer_auth(password)
        .json(&serde_json::json!({ "name": name, "disabled": disabled }))
        .send().await.map_err(map_error)?;
    if !resp.status().is_success() { return Err(map_status(resp.status())); }
    Ok(())
}

pub async fn delete_auth_file(server: &str, password: &str, name: &str) -> Result<(), String> {
    let url = build_url(server, "/auth-files");
    let resp = client()?.delete(&url).bearer_auth(password)
        .query(&[("name", name)])
        .send().await.map_err(map_error)?;
    if !resp.status().is_success() { return Err(map_status(resp.status())); }
    Ok(())
}

pub async fn delete_all_auth_files(server: &str, password: &str) -> Result<(), String> {
    let url = format!("{}?all=true", build_url(server, "/auth-files"));
    let resp = client()?.delete(&url).bearer_auth(password).send().await.map_err(map_error)?;
    if !resp.status().is_success() { return Err(map_status(resp.status())); }
    Ok(())
}

pub async fn upload_auth_file(server: &str, password: &str, name: &str, bytes: Vec<u8>) -> Result<(), String> {
    let url = build_url(server, "/auth-files");
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
    let url = build_url(server, "/usage");
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
