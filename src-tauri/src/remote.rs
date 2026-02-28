use reqwest::StatusCode;
use serde_json::Value;
use std::time::Duration;

use crate::auth::normalize_api_base;

const MANAGEMENT_API_PREFIX: &str = "/v0/management";
const CODEX_API_KEY_PATH: &str = "/codex-api-key";
const DEFAULT_CODEX_BASE_URL: &str = "https://api.openai.com";
const CODEX_USAGE_PATH: &str = "/dashboard/user/codex_usage";
const REQUEST_TIMEOUT_SECS: u64 = 30;

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
    resp.json::<Value>().await.map_err(|e| format!("解析响应失败: {e}"))
}

pub async fn save_codex_configs(server: &str, password: &str, configs: Value) -> Result<(), String> {
    let url = build_url(server, CODEX_API_KEY_PATH);
    let resp = client()?
        .put(&url)
        .bearer_auth(password)
        .json(&configs)
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
    let resp = client()?
        .patch(&url)
        .bearer_auth(password)
        .json(&payload)
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
