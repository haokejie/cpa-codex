# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Tauri 2 桌面客户端，采用 **"后台常驻 + 配置页"** 模式：
- Rust 后端常驻运行，负责定时任务、数据存储、账号管理
- Vue 3 前端仅作为配置窗口，关闭窗口只隐藏，不退出进程
- 托盘图标提供"打开配置 / 退出"入口

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
| API 层 | `src/api/` | 封装 `invoke` 调用，提供类型安全的函数 |
| Store 层 | `src/stores/` | Pinia store，管理状态与业务逻辑 |
| Composables 层 | `src/composables/` | 可复用 Vue 组合式函数（当前预留，暂无内容） |
| 视图层 | `src/components/`、`App.vue` | 仅调用 store，不直接调用 api/ |

使用 Vue 3 `<script setup>` SFC 风格，状态管理通过 Pinia。

**新增功能标准流程：**
1. 在 `src/types/index.ts` 添加对应 TS 类型
2. 在 `src/api/` 下对应文件添加 `invoke` 封装函数
3. 在 `src/stores/` 下对应 store 添加 action
4. 在组件中通过 `useXxxStore()` 使用

**新增 IPC 命令同时需要：**
- Rust：在 `commands.rs` 定义，在 `lib.rs` 的 `invoke_handler!` 中注册
- 前端：在 `src/api/` 添加封装，在 `src/types/index.ts` 添加类型

### Rust 后端 (`src-tauri/src/`) — 分层架构

后端采用四层结构，**commands 保持薄**（只做参数验证和结果转换，不含业务逻辑）：

| 层 | 模块 | 职责 |
|----|------|------|
| 配置层 | `lib.rs` | Tauri Builder 配置，注册 commands，wiring |
| IPC 接入层 | `commands.rs` | 参数验证 → 调用 store → 返回结果，不含逻辑 |
| 状态聚合层 | `state.rs` | `AppState` 持有所有 store，作为依赖注入点 |
| 数据访问层 | `config.rs` / `db.rs` / `auth.rs` | 各自封装存储介质（JSON / SQLite / 钥匙串） |

另有两个横切模块：
- `background.rs` — 后台任务，通过 `app.emit()` 向前端推事件
- `tray.rs` — 系统托盘，属于系统集成，不含业务状态

**新增功能标准流程：**
1. 在数据访问层对应模块（`db.rs` / `config.rs` / `auth.rs`）添加方法
2. 在 `commands.rs` 添加 command，通过 `State<'_, AppState>` 取 store 调用
3. 在 `lib.rs` 的 `invoke_handler!` 注册新 command
4. 新建存储模块时需在 `state.rs` 的 `AppState` 中挂载，并实现 `Clone`

### IPC Commands（前端可 `invoke` 的命令）

- `get_config` → 返回 `AppConfig { autostart_enabled, last_account_key }`
- `set_autostart_enabled(enabled: bool)` → 开关开机自启
- `login({ username, password, server })` → 保存账号到 DB + 密码到钥匙串
- `list_accounts` → 返回账号列表
- `delete_account(account_key)` → 删除账号及其密码

### 后端事件（前端通过 `listen` 订阅）

- `backend:tick` → 每 30 秒触发，payload 为 `{ timestamp_ms: number }`

前端订阅示例：
```ts
import { listen } from "@tauri-apps/api/event";
const unlisten = await listen<{ timestamp_ms: number }>("backend:tick", (event) => { ... });
```

### 权限管理

Tauri 2 使用 capabilities 系统，权限配置在 `src-tauri/capabilities/default.json`。新增 Tauri 插件或 API 时，需在此文件添加对应 permission。

### 数据存储

- **SQLite** (`app_data_dir/app.db`)：`accounts` 表，字段 `account_key / username / server / last_login_at`
- **JSON 配置文件** (`app_data_dir/config.json`)：`autostart_enabled`、`last_account_key`
- **系统钥匙串**：以 `com.zoujunkun.tauri-app`（app identifier）为 service，`account_key` 为 user 存储密码

`app_data_dir` 实际路径（identifier: `com.zoujunkun.tauri-app`）：
- macOS：`~/Library/Application Support/com.zoujunkun.tauri-app/`
- Windows：`C:\Users\<user>\AppData\Roaming\com.zoujunkun.tauri-app\`
- Linux：`~/.local/share/com.zoujunkun.tauri-app/`

### 关键约定

- `account_key` 格式：`"{server}::{username}"`，作为 DB 主键和钥匙串 user 标识
- 新增 Tauri command 需在 `commands.rs` 定义，并在 `lib.rs` 的 `invoke_handler!` 中注册
- 所有 Store 结构体均实现 `Clone`（通过 `Arc` / sqlx pool 内部共享）
- 关闭窗口行为在 `lib.rs` 的 `on_window_event` 中拦截，改为 `hide()`
