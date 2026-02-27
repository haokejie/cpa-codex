use reqwest::StatusCode;
use std::time::Duration;

const MANAGEMENT_API_PREFIX: &str = "/v0/management";
const CONFIG_PATH: &str = "/config";
const REQUEST_TIMEOUT_SECS: u64 = 30;

pub fn normalize_api_base(input: &str) -> String {
    let mut base = input.trim().to_string();
    if base.is_empty() {
        return base;
    }

    base = trim_trailing_slashes(base);
    base = strip_suffix_case_insensitive(base, CONFIG_PATH);
    base = trim_trailing_slashes(base);
    base = strip_suffix_case_insensitive(base, MANAGEMENT_API_PREFIX);
    base = trim_trailing_slashes(base);

    let lower = base.to_lowercase();
    if !lower.starts_with("http://") && !lower.starts_with("https://") {
        base = format!("http://{}", base);
    }

    base
}

pub async fn verify_login(server: &str, password: &str) -> Result<(), String> {
    if password.trim().is_empty() {
        return Err("密码不能为空".to_string());
    }
    let url = build_config_url(server)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("初始化网络请求失败: {e}"))?;

    let response = client
        .get(url)
        .bearer_auth(password)
        .send()
        .await
        .map_err(map_reqwest_error)?;

    if !response.status().is_success() {
        return Err(map_http_status(response.status()));
    }

    Ok(())
}

fn build_config_url(server: &str) -> Result<String, String> {
    let normalized = normalize_api_base(server);
    if normalized.is_empty() {
        return Err("服务器不能为空".to_string());
    }
    Ok(format!(
        "{normalized}{MANAGEMENT_API_PREFIX}{CONFIG_PATH}"
    ))
}

fn map_http_status(status: StatusCode) -> String {
    match status.as_u16() {
        401 => "认证失败，请检查密码".to_string(),
        403 => "没有访问权限，请检查密码".to_string(),
        404 => "接口不存在，请确认服务器地址".to_string(),
        408 => "请求超时".to_string(),
        429 => "请求过于频繁，请稍后重试".to_string(),
        code if code >= 500 => format!("服务器错误（HTTP {code}）"),
        code => format!("登录失败（HTTP {code}）"),
    }
}

fn map_reqwest_error(err: reqwest::Error) -> String {
    if err.is_timeout() {
        return "请求超时".to_string();
    }
    if err.is_builder() {
        return "服务器地址不合法".to_string();
    }
    if err.is_connect() {
        let message = err.to_string().to_lowercase();
        if message.contains("certificate") || message.contains("tls") {
            return "证书校验失败".to_string();
        }
        return "无法连接服务器".to_string();
    }
    format!("请求失败: {err}")
}

fn trim_trailing_slashes(mut value: String) -> String {
    while value.ends_with('/') {
        value.pop();
    }
    value
}

fn strip_suffix_case_insensitive(value: String, suffix: &str) -> String {
    let lower = value.to_lowercase();
    let suffix_lower = suffix.to_lowercase();
    if lower.ends_with(&suffix_lower) {
        let mut next = value;
        let new_len = next.len().saturating_sub(suffix.len());
        next.truncate(new_len);
        return next;
    }
    value
}
