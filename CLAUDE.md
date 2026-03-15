# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Tauri 2 桌面客户端，采用 **"前端主导 + Rust 配置层"** 架构：
- Rust 后端仅负责应用配置（开机自启、托盘设置）和系统集成（托盘、窗口管理）
- Vue 3 前端处理所有业务逻辑：账号管理、远程 API 调用、状态管理
- 关闭窗口只隐藏，不退出进程，托盘图标提供"打开配置 / 退出"入口

### 核心功能

#### 1. 账号管理（前端实现）

- 登录验证：通过 Management API 的 `/config` 端点验证密码
- 账号存储：使用 **localStorage** 存储账号列表（server + last_login_at）
- 密码缓存：在前端**内存**中缓存（Map），刷新页面后需重新输入
- Session 管理：当前登录的 server + password 保存在内存中

#### 2. 远程 API 调用（前端实现）

前端通过 `src/api/managementClient.ts` 直接调用 CLIProxyAPI 的 Management API：
- 认证方式：`Authorization: Bearer <password>`
- 基础路径：`/v0/management`
- 支持开发代理：DEV 模式下可通过 Vite proxy 转发请求

#### 3. 应用配置（Rust 实现）

Rust 后端管理 4 个配置项，存储在 `config.json`：
- `autostart_enabled` - 开机自启
- `tray_enabled` - 托盘启用
- `close_to_tray` - 关闭到托盘
- `dock_visible_on_minimize` - 最小化时 Dock 可见性（macOS）

### 关联项目

本项目是 **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** 的 Tauri 桌面客户端。

- **远程后端**：CLIProxyAPI 服务（最低版本 ≥ 6.8.0）
  - 认证方式：`Authorization: Bearer <MANAGEMENT_KEY>`
  - Management API 基础路径：`/v0/management`

## 常用命令

包管理器：**pnpm**

```bash
# 启动完整开发环境（Tauri dev，自动启动前端 dev server）
pnpm tauri dev

# 仅启动前端 Vite dev server
pnpm dev

# 构建发布包
pnpm tauri build

# 前端类型检查 + 构建
pnpm build

# Rust 类型检查
cd src-tauri && cargo check

# Rust lint
cd src-tauri && cargo clippy
```

## 代码架构

### 前端 (`src/`) — 分层架构

前端采用四层结构，**禁止跨层调用**（组件不直接 invoke）：

| 层 | 目录 | 职责 |
|----|------|------|
| 类型层 | `src/types/index.ts` | 与 Rust 结构体对应的 TS 类型，所有层共享 |
| API 层 | `src/api/` | 封装 `invoke` 调用和远程 API 请求 |
| Store 层 | `src/stores/` | Pinia store，管理状态与业务逻辑 |
| 视图层 | `src/components/`、`App.vue` | 仅调用 store，不直接调用 api/ |

使用 Vue 3 `<script setup>` SFC 风格，状态管理通过 Pinia。

**API 层关键模块：**
- `account.ts` - 账号管理（localStorage + 内存），登录验证
- `session.ts` - Session 和密码缓存（纯内存）
- `managementClient.ts` - 远程 API 请求封装（fetch + 错误处理）
- `config.ts` - 应用配置（调用 Tauri commands）
- `codex.ts` / `authFiles.ts` / `apiKeys.ts` - 各业务模块的远程 API 调用

**新增功能标准流程：**
1. 在 `src/types/index.ts` 添加对应 TS 类型
2. 在 `src/api/` 下对应文件添加 API 调用函数
3. 在 `src/stores/` 下对应 store 添加 action
4. 在组件中通过 `useXxxStore()` 使用

### Rust 后端 (`src-tauri/src/`) — 极简架构

后端只负责配置和系统集成，不含业务逻辑：

| 模块 | 职责 |
|------|------|
| `lib.rs` | Tauri Builder 配置，注册 commands，窗口事件处理 |
| `commands.rs` | 5 个配置相关的 IPC commands |
| `state.rs` | `AppState` 持有 `ConfigStore` |
| `config.rs` | 配置文件读写（`config.json`） |
| `tray.rs` | 系统托盘 |
| `main.rs` | 入口 |

**新增配置项流程：**
1. 在 `config.rs` 的 `AppConfig` 结构体添加字段
2. 在 `ConfigStore` 添加 `set_xxx` 方法
3. 在 `commands.rs` 添加对应 command
4. 在 `lib.rs` 的 `invoke_handler!` 注册

### IPC Commands（前端可 `invoke` 的命令）

**应用配置（已实现）：**
- `get_config()` → 返回 `AppConfig { autostart_enabled, tray_enabled, close_to_tray, dock_visible_on_minimize }`
- `set_autostart_enabled(enabled: bool)` → 开关开机自启
- `set_tray_enabled(enabled: bool)` → 开关托盘
- `set_close_to_tray(enabled: bool)` → 开关关闭到托盘
- `set_dock_visible_on_minimize(enabled: bool)` → 开关最小化时 Dock 可见性（macOS）

**注意：** 账号管理、远程 API 调用等业务功能全部在前端实现，不通过 Tauri commands。

### 权限管理

Tauri 2 使用 capabilities 系统，权限配置在 `src-tauri/capabilities/default.json`。新增 Tauri 插件或 API 时，需在此文件添加对应 permission。

### 数据存储

- **Rust 配置文件** (`app_data_dir/config.json`)：4 个应用配置项
- **前端 localStorage**：
  - `cpa-codex:accounts` - 账号列表 `[{ account_key, server, last_login_at }]`
  - `cpa-codex:last-account` - 上次登录的 account_key
- **前端内存**：
  - Session（当前登录的 server + password）
  - 密码缓存（Map<account_key, password>）
  - 记住密码偏好（Map<account_key, boolean>）

`app_data_dir` 实际路径（identifier: `com.zoujunkun.tauri-app`）：
- macOS：`~/Library/Application Support/com.zoujunkun.tauri-app/`
- Windows：`C:\Users\<user>\AppData\Roaming\com.zoujunkun.tauri-app\`
- Linux：`~/.local/share/com.zoujunkun.tauri-app/`

### Auth 状态机（前端 `useAuthStore`）

前端认证流程由 `mode` 状态驱动，4 种模式：
- `"prompt"` → 检测到上次登录账号，提示快速登录
- `"list"` → 显示已有账号列表供选择
- `"form"` → 无账号，显示新增账号表单
- `"config"` → 已登录，显示配置页

### 关键约定

- `account_key` 即服务器 URL（经过 `normalizeApiBase` 标准化）
- 新增 Tauri command 需在 `commands.rs` 定义，并在 `lib.rs` 的 `invoke_handler!` 中注册
- 关闭窗口行为在 `lib.rs` 的 `on_window_event` 中拦截，改为 `hide()`
- 前端直接调用远程 API，不通过 Rust 代理
- 密码仅在内存中缓存，刷新页面后需重新输入（安全考虑）
