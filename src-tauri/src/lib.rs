mod background;
mod auth;
mod commands;
mod config;
mod crypto;
mod db;
mod remote;
mod state;
mod tray;

use state::AppState;
use tauri::Manager;
use tauri::WindowEvent;
use tauri_plugin_autostart::MacosLauncher;

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
                let db = crate::db::Db::new(&app_handle).await?;
                Ok::<AppState, String>(AppState { config, db })
            })
            .map_err(std::io::Error::other)?;

            app.manage(state.clone());
            if state.config.get().tray_enabled {
                crate::tray::setup_tray(&app_handle)?;
            }
            crate::background::start_background_worker(app_handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let close_to_tray = window
                    .app_handle()
                    .try_state::<AppState>()
                    .map(|s| s.config.get().close_to_tray)
                    .unwrap_or(true);
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::set_autostart_enabled,
            commands::set_tray_enabled,
            commands::set_close_to_tray,
            commands::login,
            commands::list_accounts,
            commands::delete_account,
            commands::has_saved_password,
            commands::login_with_saved_password,
            commands::get_last_account_key,
            commands::get_codex_configs,
            commands::save_codex_configs,
            commands::update_codex_config,
            commands::delete_codex_config,
            commands::get_codex_quota,
            commands::get_usage,
            commands::list_auth_files,
            commands::sync_auth_files,
            commands::set_auth_file_status,
            commands::delete_auth_file,
            commands::delete_all_auth_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
