use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub autostart_enabled: bool,
}

#[derive(Clone)]
pub struct ConfigStore {
    path: PathBuf,
    data: Arc<Mutex<AppConfig>>,
}

impl ConfigStore {
    pub fn load(app: &tauri::AppHandle) -> Result<Self, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("获取应用数据目录失败: {e}"))?;
        fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {e}"))?;
        let path = dir.join("config.json");

        let config = if path.exists() {
            let content =
                fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {e}"))?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            AppConfig::default()
        };

        let store = Self {
            path,
            data: Arc::new(Mutex::new(config)),
        };
        store.persist()?;
        Ok(store)
    }

    pub fn get(&self) -> AppConfig {
        self.data
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    pub fn set_autostart_enabled(&self, enabled: bool) -> Result<(), String> {
        let mut data = self.data.lock().unwrap_or_else(|e| e.into_inner());
        data.autostart_enabled = enabled;
        drop(data);
        self.persist()
    }

    fn persist(&self) -> Result<(), String> {
        let data = self.data.lock().unwrap_or_else(|e| e.into_inner());
        let content =
            serde_json::to_string_pretty(&*data).map_err(|e| format!("序列化配置失败: {e}"))?;
        fs::write(&self.path, content).map_err(|e| format!("写入配置失败: {e}"))?;
        Ok(())
    }
}
