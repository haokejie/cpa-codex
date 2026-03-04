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
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            #[cfg(target_os = "macos")]
            {
                let _ = app_handle.set_activation_policy(ActivationPolicy::Regular);
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
            commands::set_dock_visible_on_minimize,
            commands::set_auto_refresh_enabled,
            commands::set_auto_refresh_interval_seconds,
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
            commands::list_api_keys,
            commands::replace_api_keys,
            commands::update_api_key,
            commands::delete_api_key,
            commands::get_codex_quota,
            commands::get_usage,
            commands::list_auth_files,
            commands::sync_auth_files,
            commands::upload_auth_file,
            commands::set_auth_file_status,
            commands::delete_auth_file,
            commands::delete_all_auth_files,
            commands::reset_auth_files_cache,
            commands::get_server_config,
            commands::get_server_raw_config,
            commands::update_debug,
            commands::update_proxy_url,
            commands::clear_proxy_url,
            commands::update_request_retry,
            commands::update_quota_switch_project,
            commands::update_quota_switch_preview_model,
            commands::update_usage_statistics,
            commands::update_request_log,
            commands::update_logging_to_file,
            commands::get_logs_max_total_size_mb,
            commands::update_logs_max_total_size_mb,
            commands::update_ws_auth,
            commands::get_force_model_prefix,
            commands::update_force_model_prefix,
            commands::get_routing_strategy,
            commands::update_routing_strategy,
            commands::get_gemini_configs,
            commands::save_gemini_configs,
            commands::update_gemini_config,
            commands::delete_gemini_config,
            commands::get_codex_provider_configs,
            commands::save_codex_provider_configs,
            commands::update_codex_provider_config,
            commands::delete_codex_provider_config,
            commands::get_claude_configs,
            commands::save_claude_configs,
            commands::update_claude_config,
            commands::delete_claude_config,
            commands::get_vertex_configs,
            commands::save_vertex_configs,
            commands::update_vertex_config,
            commands::delete_vertex_config,
            commands::get_openai_providers,
            commands::save_openai_providers,
            commands::update_openai_provider,
            commands::delete_openai_provider,
            commands::get_ampcode_config,
            commands::update_ampcode_upstream_url,
            commands::clear_ampcode_upstream_url,
            commands::update_ampcode_upstream_api_key,
            commands::clear_ampcode_upstream_api_key,
            commands::get_ampcode_model_mappings,
            commands::save_ampcode_model_mappings,
            commands::patch_ampcode_model_mappings,
            commands::clear_ampcode_model_mappings,
            commands::delete_ampcode_model_mappings,
            commands::update_ampcode_force_model_mappings,
            commands::start_oauth,
            commands::get_oauth_status,
            commands::submit_oauth_callback,
            commands::iflow_cookie_auth,
            commands::vertex_import,
            commands::download_auth_file,
            commands::get_auth_file_models,
            commands::get_model_definitions,
            commands::get_oauth_excluded_models,
            commands::save_oauth_excluded_models,
            commands::replace_oauth_excluded_models,
            commands::delete_oauth_excluded_entry,
            commands::get_oauth_model_alias,
            commands::save_oauth_model_alias,
            commands::delete_oauth_model_alias,
            commands::export_usage,
            commands::import_usage,
            commands::fetch_logs,
            commands::clear_logs,
            commands::fetch_error_logs,
            commands::download_error_log,
            commands::download_request_log_by_id,
            commands::get_config_yaml,
            commands::save_config_yaml,
            commands::api_call,
            commands::fetch_models,
            commands::check_latest_version
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
