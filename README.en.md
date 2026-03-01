# CPA Codex Desktop

A desktop client for CLIProxyAPI Codex management. Built with Tauri 2 (resident Rust backend) and Vue 3 (settings window). Closing the window only hides it, so the app remains running in the background for account and quota operations.

## Scope

Implemented:
- Account login management: login/list/delete, remember password (SQLite + AES-256-GCM)
- App configuration: autostart toggle
- System tray: open settings / quit

Planned:
- Codex account management: list/create/update/delete, priority-based routing
- Quota status: available / exhausted / unavailable, batch refresh
- Usage analytics: export/import, per-account stats
- Background jobs: quota polling with frontend events

## Architecture

Frontend (Vue 3) layers:
- `src/types` type layer
- `src/api` invocation layer (wraps `invoke`)
- `src/stores` state & business layer (Pinia)
- `src/components` view layer (store-only access)

Backend (Rust) layers:
- `lib.rs` configuration and command registration
- `commands.rs` IPC entry layer (validation + result mapping)
- `state.rs` state aggregation and DI
- `config.rs` / `db.rs` / `auth.rs` data access
- `background.rs` background jobs
- `tray.rs` system tray

## CLIProxyAPI Integration

- Remote backend: CLIProxyAPI (minimum version ≥ 6.8.0)
- Auth: `Authorization: Bearer <MANAGEMENT_KEY>`
- Management API base path: `/v0/management`

Codex account configurations are not persisted locally; they are managed by the CLIProxyAPI server. Local storage is limited to login and app configuration data.

## Data & Security

- SQLite: `app_data_dir/app.db` (accounts and app state)
- Config file: `app_data_dir/config.json` (autostart)
- Password encryption: AES-256-GCM (stored in SQLite)

`app_data_dir` (identifier: `com.zoujunkun.tauri-app`)
- macOS: `~/Library/Application Support/com.zoujunkun.tauri-app/`
- Windows: `C:\Users\<user>\AppData\Roaming\com.zoujunkun.tauri-app\`
- Linux: `~/.local/share/com.zoujunkun.tauri-app/`

## Development

Package manager: `pnpm`

```bash
# Start full dev environment (Tauri dev, auto-starts frontend dev server)
pnpm tauri dev

# Start frontend Vite dev server only
pnpm dev

# Frontend typecheck + build
pnpm build

# Rust typecheck
cd src-tauri && cargo check

# Rust lint
cd src-tauri && cargo clippy
```

## Related Project

- CLIProxyAPI (remote backend and Management API)
