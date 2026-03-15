use crate::state::AppState;
use serde::Serialize;
use tauri::Manager;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;

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
