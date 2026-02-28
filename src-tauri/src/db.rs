use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthFileRow {
    pub name: String,
    #[serde(rename = "type", default)]
    pub file_type: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub disabled: Option<bool>,
    #[serde(default)]
    pub unavailable: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub status_message: Option<String>,
    #[serde(default)]
    pub last_refresh: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Account {
    pub account_key: String,
    pub username: String,
    pub server: String,
    pub last_login_at: i64,
    pub remember_password: bool,
    pub has_password: bool,
}

#[derive(Clone)]
pub struct Db {
    pool: SqlitePool,
    _path: PathBuf,
}

impl Db {
    pub async fn new(app: &tauri::AppHandle) -> Result<Self, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("获取应用数据目录失败: {e}"))?;
        fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {e}"))?;
        let db_path = dir.join("app.db");

        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .map_err(|e| format!("连接数据库失败: {e}"))?;

        ensure_schema(&pool).await?;

        Ok(Self {
            pool,
            _path: db_path,
        })
    }

    pub async fn upsert_account(
        &self,
        account_key: &str,
        server: &str,
    ) -> Result<(), String> {
        let now = current_millis();
        let username = server;
        sqlx::query(
            "INSERT INTO accounts (account_key, username, server, last_login_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(account_key) DO UPDATE SET
               username = excluded.username,
               server = excluded.server,
               last_login_at = excluded.last_login_at",
        )
        .bind(account_key)
        .bind(username)
        .bind(server)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("保存账号失败: {e}"))?;
        Ok(())
    }

    pub async fn get_account(&self, account_key: &str) -> Result<Option<Account>, String> {
        let row = sqlx::query(
            r#"
            SELECT account_key, username, server, last_login_at, remember_password, encrypted_password
            FROM accounts
            WHERE account_key = ?1
            "#,
        )
        .bind(account_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("读取账号失败: {e}"))?;

        if let Some(row) = row {
            let remember_value: i64 = row.try_get("remember_password").unwrap_or_default();
            let encrypted: Option<String> = row.try_get("encrypted_password").ok();
            let has_password = encrypted
                .as_deref()
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false);
            return Ok(Some(Account {
                account_key: row.try_get("account_key").unwrap_or_default(),
                username: row.try_get("username").unwrap_or_default(),
                server: row.try_get("server").unwrap_or_default(),
                last_login_at: row.try_get("last_login_at").unwrap_or_default(),
                remember_password: remember_value != 0,
                has_password,
            }));
        }
        Ok(None)
    }

    pub async fn list_accounts(&self) -> Result<Vec<Account>, String> {
        let rows = sqlx::query(
            r#"
            SELECT account_key, username, server, last_login_at, remember_password, encrypted_password
            FROM accounts
            ORDER BY last_login_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("读取账号列表失败: {e}"))?;

        let mut accounts = Vec::with_capacity(rows.len());
        for row in rows {
            let remember_value: i64 = row.try_get("remember_password").unwrap_or_default();
            let encrypted: Option<String> = row.try_get("encrypted_password").ok();
            let has_password = encrypted
                .as_deref()
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false);
            accounts.push(Account {
                account_key: row.try_get("account_key").unwrap_or_default(),
                username: row.try_get("username").unwrap_or_default(),
                server: row.try_get("server").unwrap_or_default(),
                last_login_at: row.try_get("last_login_at").unwrap_or_default(),
                remember_password: remember_value != 0,
                has_password,
            });
        }
        Ok(accounts)
    }

    pub async fn delete_account(&self, account_key: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM accounts WHERE account_key = ?1")
            .bind(account_key)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("删除账号失败: {e}"))?;
        let last = self.get_last_account_key().await?;
        if last.as_deref() == Some(account_key) {
            self.set_last_account_key(None).await?;
        }
        Ok(())
    }

    pub async fn has_password(&self, account_key: &str) -> Result<bool, String> {
        let row = sqlx::query("SELECT encrypted_password FROM accounts WHERE account_key = ?1")
            .bind(account_key)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| format!("读取账号密码失败: {e}"))?;
        let encrypted: Option<String> = row.and_then(|row| row.try_get("encrypted_password").ok());
        Ok(encrypted
            .as_deref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false))
    }

    pub async fn get_encrypted_password(
        &self,
        account_key: &str,
    ) -> Result<Option<String>, String> {
        let row = sqlx::query("SELECT encrypted_password FROM accounts WHERE account_key = ?1")
            .bind(account_key)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| format!("读取账号密码失败: {e}"))?;
        Ok(row.and_then(|row| row.try_get("encrypted_password").ok()))
    }

    pub async fn set_account_password(
        &self,
        account_key: &str,
        encrypted_password: Option<&str>,
        remember_password: bool,
    ) -> Result<(), String> {
        sqlx::query(
            "UPDATE accounts
             SET encrypted_password = ?1, remember_password = ?2
             WHERE account_key = ?3",
        )
        .bind(encrypted_password)
        .bind(if remember_password { 1 } else { 0 })
        .bind(account_key)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("更新账号密码失败: {e}"))?;
        Ok(())
    }

    pub async fn clear_account_password(&self, account_key: &str) -> Result<(), String> {
        self.set_account_password(account_key, None, false).await
    }

    pub async fn get_last_account_key(&self) -> Result<Option<String>, String> {
        let row = sqlx::query("SELECT value FROM app_state WHERE key = 'last_account_key'")
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| format!("读取登录状态失败: {e}"))?;
        Ok(row.and_then(|row| row.try_get("value").ok()))
    }

    pub async fn set_last_account_key(&self, key: Option<&str>) -> Result<(), String> {
        if let Some(value) = key {
            sqlx::query(
                "INSERT INTO app_state (key, value) VALUES ('last_account_key', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            )
            .bind(value)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("更新登录状态失败: {e}"))?;
        } else {
            sqlx::query("DELETE FROM app_state WHERE key = 'last_account_key'")
                .execute(&self.pool)
                .await
                .map_err(|e| format!("清理登录状态失败: {e}"))?;
        }
        Ok(())
    }

    pub async fn sync_auth_files(&self, account_key: &str, files: &[AuthFileRow]) -> Result<(), String> {
        let mut tx = self.pool.begin().await.map_err(|e| format!("开启事务失败: {e}"))?;
        sqlx::query("DELETE FROM auth_files WHERE account_key = ?1")
            .bind(account_key)
            .execute(&mut *tx).await.map_err(|e| format!("清空认证文件表失败: {e}"))?;
        for f in files {
            sqlx::query(
                "INSERT INTO auth_files (account_key, name, type, provider, size, disabled, unavailable, status, status_message, last_refresh) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            )
            .bind(account_key)
            .bind(&f.name)
            .bind(&f.file_type)
            .bind(&f.provider)
            .bind(f.size)
            .bind(if f.disabled.unwrap_or(false) { 1 } else { 0 })
            .bind(if f.unavailable.unwrap_or(false) { 1 } else { 0 })
            .bind(&f.status)
            .bind(&f.status_message)
            .bind(&f.last_refresh)
            .execute(&mut *tx).await.map_err(|e| format!("写入认证文件失败: {e}"))?;
        }
        tx.commit().await.map_err(|e| format!("提交事务失败: {e}"))?;
        Ok(())
    }

    pub async fn list_auth_files(&self, account_key: &str) -> Result<Vec<AuthFileRow>, String> {
        let rows = sqlx::query("SELECT name, type, provider, size, disabled, unavailable, status, status_message, last_refresh FROM auth_files WHERE account_key = ?1 ORDER BY name")
            .bind(account_key)
            .fetch_all(&self.pool).await.map_err(|e| format!("读取认证文件失败: {e}"))?;
        Ok(rows.iter().map(|r| AuthFileRow {
            name: r.try_get("name").unwrap_or_default(),
            file_type: r.try_get("type").ok(),
            provider: r.try_get("provider").ok(),
            size: r.try_get("size").ok(),
            disabled: Some(r.try_get::<i32, _>("disabled").unwrap_or(0) != 0),
            unavailable: Some(r.try_get::<i32, _>("unavailable").unwrap_or(0) != 0),
            status: r.try_get("status").ok(),
            status_message: r.try_get("status_message").ok(),
            last_refresh: r.try_get("last_refresh").ok(),
        }).collect())
    }
}

fn current_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

async fn ensure_schema(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS accounts (
            account_key TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            server TEXT NOT NULL,
            last_login_at INTEGER NOT NULL,
            remember_password INTEGER NOT NULL DEFAULT 0,
            encrypted_password TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("初始化数据表失败: {e}"))?;

    let columns = sqlx::query("PRAGMA table_info(accounts)")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("读取数据表结构失败: {e}"))?;
    let mut has_remember = false;
    let mut has_encrypted = false;
    for row in columns {
        let name: String = row.try_get("name").unwrap_or_default();
        if name == "remember_password" {
            has_remember = true;
        }
        if name == "encrypted_password" {
            has_encrypted = true;
        }
    }
    if !has_remember {
        sqlx::query(
            "ALTER TABLE accounts ADD COLUMN remember_password INTEGER NOT NULL DEFAULT 0",
        )
        .execute(pool)
        .await
        .map_err(|e| format!("升级数据表失败: {e}"))?;
    }
    if !has_encrypted {
        sqlx::query("ALTER TABLE accounts ADD COLUMN encrypted_password TEXT")
            .execute(pool)
            .await
            .map_err(|e| format!("升级数据表失败: {e}"))?;
    }

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("初始化状态表失败: {e}"))?;

    // 迁移：旧 auth_files 表无 account_key 列，DROP 重建（缓存可重新同步）
    let cols = sqlx::query("PRAGMA table_info(auth_files)")
        .fetch_all(pool).await.unwrap_or_default();
    if !cols.is_empty() && !cols.iter().any(|r| r.try_get::<String, _>("name").unwrap_or_default() == "account_key") {
        let _ = sqlx::query("DROP TABLE auth_files").execute(pool).await;
    }

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS auth_files (
            account_key TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT,
            provider TEXT,
            size INTEGER,
            disabled INTEGER NOT NULL DEFAULT 0,
            unavailable INTEGER NOT NULL DEFAULT 0,
            status TEXT,
            status_message TEXT,
            last_refresh TEXT,
            PRIMARY KEY (account_key, name)
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("初始化认证文件表失败: {e}"))?;

    // 迁移：auth_files 表新增状态列
    let af_cols = sqlx::query("PRAGMA table_info(auth_files)")
        .fetch_all(pool).await.unwrap_or_default();
    let af_col_names: Vec<String> = af_cols.iter().map(|r| r.try_get("name").unwrap_or_default()).collect();
    for (col, def) in [
        ("unavailable", "INTEGER NOT NULL DEFAULT 0"),
        ("status", "TEXT"),
        ("status_message", "TEXT"),
        ("last_refresh", "TEXT"),
    ] {
        if !af_col_names.contains(&col.to_string()) {
            let sql = format!("ALTER TABLE auth_files ADD COLUMN {col} {def}");
            let _ = sqlx::query(&sql).execute(pool).await;
        }
    }

    Ok(())
}
