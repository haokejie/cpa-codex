# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Tauri 2 桌面客户端，采用 **"后台常驻 + 配置页"** 模式：
- Rust 后端常驻运行，负责定时任务、数据存储、账号管理
- Vue 3 前端仅作为配置窗口，关闭窗口只隐藏，不退出进程
- 托盘图标提供"打开配置 / 退出"入口

### 核心功能

#### 1. Codex 账号管理

通过远程 Management API 管理 Codex API 密钥（`/codex-api-key` 端点）：

| 操作 | API 端点 | 说明 |
|------|----------|------|
| 列表 | `GET /codex-api-key` | 获取所有 Codex 配置 |
| 全量保存 | `PUT /codex-api-key` | 保存完整配置列表（用于排序、批量操作） |
| 单个更新 | `PATCH /codex-api-key` | 按 index 更新单个配置 |
| 删除 | `DELETE /codex-api-key?api-key=...` | 按 API Key 删除 |

每个 Codex 账号配置（`ProviderKeyConfig`）包含：
- `apiKey` — Codex API 密钥
- `priority` — 优先级（数值越小越优先，用于路由选择）
- `prefix` — 请求前缀标识
- `baseUrl` — 自定义 API 地址
- `websockets` — 是否启用 WebSocket（Codex 特有）
- `proxyUrl` — 代理地址
- `headers` — 自定义请求头（如 `Chatgpt-Account-Id`）
- `models` — 模型别名列表 `[{ name, alias?, priority? }]`
- `excludedModels` — 排除的模型列表
- `cloak` — 伪装配置 `{ mode, strictMode, sensitiveWords }`

#### 2. 账号状态与额度查询

每个 Codex 账号可查询实时额度状态，通过 API 调用获取 `CodexUsagePayload`：
- 请求方式：使用账号的 `apiKey` + `headers`（含 `Chatgpt-Account-Id`）调用 Codex 使用量端点
- 返回数据结构：

```
CodexUsagePayload
├── planType: "plus" | "team" | "free"    # 订阅计划
├── rateLimit                              # 主速率限制
│   ├── allowed: boolean                   # 是否可用
│   ├── limitReached: boolean              # 是否触顶
│   ├── primaryWindow                      # 主窗口（如 5 小时）
│   │   ├── usedPercent                    # 已用百分比
│   │   ├── limitWindowSeconds             # 窗口时长
│   │   └── resetAfterSeconds / resetAt    # 重置倒计时
│   └── secondaryWindow                    # 次窗口（如 周限额）
├── codeReviewRateLimit                    # 代码审查速率限制（结构同上）
└── additionalRateLimits[]                 # 附加限制列表
```

账号状态枚举：
- **可用**（`allowed=true, limitReached=false`）— 绿色，可正常使用
- **额度耗尽**（`limitReached=true`）— 红色，等待窗口重置
- **不可用**（`allowed=false`）— 灰色，账号异常或未激活
- **查询中** / **查询失败** — 加载态 / 错误态

#### 3. 账号批量放行与切换

基于 `priority` 字段实现账号调度：
- **批量放行**：将选中账号的 `priority` 设为较低值（如 0），通过 `PUT /codex-api-key` 全量保存
- **批量禁用**：将选中账号的 `priority` 设为极高值或从列表移除
- **优先级切换**：调整账号顺序，CLIProxyAPI 按 priority 升序路由请求
- **一键切换**：快速将某个账号设为最高优先级（priority=0），其余递增

操作均通过 Rust 后端代理调用远程 API，前端不直接请求远程服务。

#### 4. 额度使用跟踪

通过 `/usage` 端点获取全局使用统计：

| 端点 | 说明 |
|------|------|
| `GET /usage` | 实时使用数据（含各密钥成功/失败计数） |
| `GET /usage/export` | 导出使用统计快照 |
| `POST /usage/import` | 导入使用统计快照 |

跟踪维度：
- **按密钥统计**：每个 Codex 账号的请求成功/失败次数
- **额度窗口监控**：主窗口（5h）、次窗口（周）的已用百分比和重置时间
- **后台定时刷新**：通过 `background.rs` 定时轮询额度状态，推送 `backend:quota-update` 事件到前端

### 关联项目

本项目是 **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** 的 Tauri 桌面客户端。

- **Web 管理面板**（同后端）：`/Users/zoujunkun/githubwork/Cli-Proxy-API-Management-Center`
  - React + TypeScript + Zustand，构建为单 HTML 文件，内置于 CLIProxyAPI 的 `/management.html`
- **远程后端**：CLIProxyAPI 服务（最低版本 ≥ 6.8.0）
  - 认证方式：`Authorization: Bearer <MANAGEMENT_KEY>`
  - Management API 基础路径：`/v0/management`

### 远程 Management API 端点

本客户端通过 Rust 后端调用 CLIProxyAPI 的 Management API，主要端点：

| 分类 | 端点 | 说明 |
|------|------|------|
| 认证验证 | `GET /config` | 用 Management Key 请求，成功即登录有效 |
| 配置管理 | `PUT /debug`, `PUT /proxy-url`, `PUT /request-retry` 等 | 各项配置开关 |
| API 密钥 | `GET/PUT/PATCH/DELETE /api-keys` | 代理 API 密钥 CRUD |
| 认证文件 | `GET/POST/DELETE /auth-files` | OAuth 认证文件管理 |
| AI 提供商 | `/claude-api-keys`, `/gemini-api-keys`, `/codex-api-keys` 等 | 各提供商密钥配置 |
| OAuth | `GET /{provider}-auth-url`, `GET /get-auth-status` | 设备码/OAuth 登录流程 |
| 使用统计 | `GET /usage`, `GET /usage/export`, `POST /usage/import` | 请求/令牌统计 |
| 日志 | `GET /logs`, `DELETE /logs` | 请求日志查询与清理 |
| 模型 | `GET /v1/models` | 可用模型列表 |
| 路由策略 | `GET/PUT /routing/strategy` | 请求路由策略 |

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
| 远程 API 层 | `remote.rs`（待新增） | 封装对 CLIProxyAPI Management API 的 HTTP 调用 |

另有两个横切模块：
- `background.rs` — 后台任务，通过 `app.emit()` 向前端推事件
- `tray.rs` — 系统托盘，属于系统集成，不含业务状态

**新增功能标准流程：**
1. 在数据访问层对应模块（`db.rs` / `config.rs` / `auth.rs`）添加方法
2. 在 `commands.rs` 添加 command，通过 `State<'_, AppState>` 取 store 调用
3. 在 `lib.rs` 的 `invoke_handler!` 注册新 command
4. 新建存储模块时需在 `state.rs` 的 `AppState` 中挂载，并实现 `Clone`

### IPC Commands（前端可 `invoke` 的命令）

**基础账号管理（已实现）：**
- `get_config` → 返回 `AppConfig { autostart_enabled }`
- `set_autostart_enabled(enabled: bool)` → 开关开机自启
- `login({ password, server, remember_password? })` → 验证登录 + 保存账号到 DB + 加密密码存 SQLite
- `login_with_saved_password(account_key)` → 用已保存密码自动登录
- `has_saved_password(account_key)` → 查询是否有已保存密码
- `get_last_account_key` → 从 DB `app_state` 表取上次登录账号
- `list_accounts` → 返回账号列表
- `delete_account(account_key)` → 删除账号及其密码

**Codex 账号管理（待实现）：**
- `get_codex_configs()` → 获取所有 Codex 配置列表，返回 `CodexConfig[]`
- `save_codex_configs(configs: CodexConfig[])` → 全量保存配置（用于排序、批量操作）
- `update_codex_config(index, config)` → 按索引更新单个配置
- `delete_codex_config(api_key)` → 按 API Key 删除配置

**额度查询（待实现）：**
- `get_codex_quota(api_key, headers?)` → 查询单个账号的额度状态，返回 `CodexQuotaState`
- `get_all_codex_quotas()` → 批量查询所有账号额度，返回 `Record<string, CodexQuotaState>`

**批量操作（待实现）：**
- `batch_set_codex_priority(items: { api_key: string, priority: number }[])` → 批量设置优先级
- `set_codex_top_priority(api_key)` → 将指定账号设为最高优先级

**使用统计（待实现）：**
- `get_usage()` → 获取全局使用统计
- `export_usage()` → 导出使用统计快照
- `import_usage(payload)` → 导入使用统计快照

### 后端事件（前端通过 `listen` 订阅）

- `backend:tick` → 每 30 秒触发，payload 为 `{ timestamp_ms: number }`
- `backend:quota-update` → 额度轮询结果推送，payload 为 `{ quotas: Record<string, CodexQuotaState> }`（待实现）

前端订阅示例：
```ts
import { listen } from "@tauri-apps/api/event";
const unlisten = await listen<{ timestamp_ms: number }>("backend:tick", (event) => { ... });
```

### 权限管理

Tauri 2 使用 capabilities 系统，权限配置在 `src-tauri/capabilities/default.json`。新增 Tauri 插件或 API 时，需在此文件添加对应 permission。

### 数据存储

- **SQLite** (`app_data_dir/app.db`)：
  - `accounts` 表：`account_key / username / server / last_login_at / remember_password / encrypted_password`
  - `app_state` 表：key-value 存储，目前存 `last_account_key`
- **JSON 配置文件** (`app_data_dir/config.json`)：仅含 `autostart_enabled`
- **密码加密**：`crypto.rs` 用 AES-256-GCM 加密后存入 SQLite `encrypted_password` 列（非钥匙串）
- **Codex 数据**：不本地持久化，全部通过远程 API 实时获取（配置存在 CLIProxyAPI 服务端）
- **额度缓存**：仅在内存中缓存（Rust `AppState` 或前端 store），不落盘

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

- `account_key` 即服务器 URL（`build_account_key(server)` 直接返回 server 字符串）
- 新增 Tauri command 需在 `commands.rs` 定义，并在 `lib.rs` 的 `invoke_handler!` 中注册
- 所有 Store 结构体均实现 `Clone`（通过 `Arc` / sqlx pool 内部共享）
- 关闭窗口行为在 `lib.rs` 的 `on_window_event` 中拦截，改为 `hide()`
