mod commands;
mod config;
mod state;
mod tray;

use state::AppState;
use tauri::Manager;
use tauri::WindowEvent;
use tauri_plugin_autostart::MacosLauncher;

#[cfg(target_os = "macos")]
use tauri::RunEvent;
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = tauri::async_runtime::block_on(async {
                let config = crate::config::ConfigStore::load(&app_handle)?;
                Ok::<AppState, String>(AppState { config })
            })
            .map_err(std::io::Error::other)?;

            app.manage(state.clone());
            if state.config.get().tray_enabled {
                crate::tray::setup_tray(&app_handle)?;
            }
            #[cfg(target_os = "macos")]
            {
                let _ = app_handle.set_activation_policy(ActivationPolicy::Regular);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let close_to_tray = window
                    .app_handle()
                    .try_state::<AppState>()
                    .map(|s| s.config.get().close_to_tray)
                    .unwrap_or(true);
                let dock_visible_on_minimize = window
                    .app_handle()
                    .try_state::<AppState>()
                    .map(|s| s.config.get().dock_visible_on_minimize)
                    .unwrap_or(true);
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                    #[cfg(target_os = "macos")]
                    if !dock_visible_on_minimize {
                        let _ = window
                            .app_handle()
                            .set_activation_policy(ActivationPolicy::Accessory);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::set_autostart_enabled,
            commands::set_tray_enabled,
            commands::set_close_to_tray,
            commands::set_dock_visible_on_minimize
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = event {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = app_handle.set_activation_policy(ActivationPolicy::Regular);
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        });
}
