# CPA Codex Desktop

面向 CLIProxyAPI 的 Codex 管理桌面客户端。基于 Tauri 2（Rust 后端常驻）与 Vue 3（配置窗口）构建，关闭窗口仅隐藏，不退出进程，适合常驻后台的账号与额度管理场景。

## 功能范围

已实现：
- 账号登录管理：登录/列表/删除、记住密码（SQLite + AES-256-GCM）
- 应用配置：开机自启开关
- 系统托盘：打开配置 / 退出

规划中：
- Codex 账号管理：列表/新增/更新/删除、优先级路由
- 额度状态：可用/耗尽/不可用、批量刷新
- 使用统计：导出/导入、按账号统计
- 后台任务：额度轮询并推送前端事件

## 架构概览

前端（Vue 3）分层：
- `src/types` 类型层
- `src/api` 调用层（封装 `invoke`）
- `src/stores` 状态与业务层（Pinia）
- `src/components` 视图层（仅调用 store）

后端（Rust）分层：
- `lib.rs` 配置与命令注册
- `commands.rs` IPC 接入层（参数校验与结果转换）
- `state.rs` 状态聚合与依赖注入
- `config.rs` / `db.rs` / `auth.rs` 数据访问层
- `background.rs` 后台任务
- `tray.rs` 系统托盘

## 与 CLIProxyAPI 的关系

- 远程后端：CLIProxyAPI（最低版本 ≥ 6.8.0）
- 认证方式：`Authorization: Bearer <MANAGEMENT_KEY>`
- Management API 基础路径：`/v0/management`

Codex 账号配置不在本地持久化，由 CLIProxyAPI 服务端统一管理；本地仅保存登录与应用配置数据。

## 数据与安全

- SQLite：`app_data_dir/app.db`（账号与应用状态）
- 配置文件：`app_data_dir/config.json`（开机自启开关）
- 密码加密：AES-256-GCM（存入 SQLite）

`app_data_dir`（identifier: `com.zoujunkun.tauri-app`）
- macOS：`~/Library/Application Support/com.zoujunkun.tauri-app/`
- Windows：`C:\Users\<user>\AppData\Roaming\com.zoujunkun.tauri-app\`
- Linux：`~/.local/share/com.zoujunkun.tauri-app/`

## 开发与构建

包管理器：`pnpm`

```bash
# 启动完整开发环境（Tauri dev，自动启动前端 dev server）
pnpm tauri dev

# 仅启动前端 Vite dev server
pnpm dev

# 前端类型检查 + 构建
pnpm build

# Rust 类型检查
cd src-tauri && cargo check

# Rust lint
cd src-tauri && cargo clippy
```

## 相关项目

- CLIProxyAPI（远程后端与 Management API）
