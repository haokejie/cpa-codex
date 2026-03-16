# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

CPA Codex Desktop 是基于 Tauri 2 + Vue 3 的桌面客户端，用于管理 CLIProxyAPI 的 Codex 账号和额度。应用采用常驻后台模式，关闭窗口仅隐藏而不退出进程。

- **前端**：Vue 3 + Pinia + TypeScript
- **后端**：Rust (Tauri 2)
- **包管理器**：pnpm
- **窗口尺寸**：800×600（固定）
- **Identifier**：`com.zoujunkun.tauri-app`

## 开发命令

```bash
# 完整开发环境（Tauri + 前端 dev server）
pnpm tauri dev

# 仅启动前端 Vite dev server（用于浏览器调试）
pnpm dev

# 前端类型检查 + 构建
pnpm build

# 测试
pnpm test          # watch 模式
pnpm test:run      # 单次运行

# Rust 检查和 lint
cd src-tauri && cargo check
cd src-tauri && cargo clippy
```

## 架构分层

### 前端分层（严格单向依赖）

```
types/          类型定义层（与 Rust 结构体对应）
  ↓
api/            调用层（封装 invoke 和 HTTP 请求）
  ↓
stores/         状态与业务逻辑层（Pinia）
  ↓
components/     视图层（仅调用 store，不直接调用 api）
```

**关键约定**：
- 组件不得直接调用 `api/` 层，必须通过 `stores/`
- `types/index.ts` 中的类型需与 Rust 结构体保持同步（见注释标注）
- Store 之间可以相互调用，但需避免循环依赖

### 后端分层

```
lib.rs          应用入口、插件注册、事件处理
  ↓
commands.rs     Tauri IPC 命令（参数校验、结果转换）
  ↓
state.rs        应用状态聚合（依赖注入）
  ↓
config.rs       配置持久化（JSON 文件）
tray.rs         系统托盘
```

## 前后端通信

### 1. Tauri IPC（本地配置）

前端通过 `@tauri-apps/api` 的 `invoke` 调用 Rust 命令：

```typescript
// 前端：src/api/config.ts
import { invoke } from "@tauri-apps/api/core";
await invoke<AppConfig>("get_config");

// 后端：src-tauri/src/commands.rs
#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String>
```

**用途**：应用配置（开机自启、托盘、Dock 可见性）

### 2. HTTP 请求（远程 Management API）

前端直接调用 CLIProxyAPI 的 Management API（`/v0/management/*`）：

```typescript
// src/api/managementClient.ts
const url = buildManagementUrl(server, "/config");
await requestJson<T>(url, { auth: password });
```

**认证方式**：`Authorization: Bearer <MANAGEMENT_KEY>`（即用户密码）

**开发代理**：
- 设置环境变量 `VITE_MANAGEMENT_PROXY_TARGET=http://localhost:8787`
- Vite 会将 `/v0/management` 代理到目标服务器
- 仅在浏览器开发时生效（`!isTauri() && import.meta.env.DEV`）

## 数据存储

### 前端（localStorage）

- **账号列表**：`cpa-codex:accounts`（服务器地址、最后登录时间）
- **最后登录账号**：`cpa-codex:last-account`
- **密码缓存**：内存中（`Map<accountKey, password>`），页面刷新后清空
- **记住密码偏好**：`cpa-codex:remember:<accountKey>`

### 后端（Rust）

- **应用配置**：`app_data_dir/config.json`（开机自启、托盘、Dock 设置）
- **数据目录**：
  - macOS: `~/Library/Application Support/com.zoujunkun.tauri-app/`
  - Windows: `C:\Users\<user>\AppData\Roaming\com.zoujunkun.tauri-app\`
  - Linux: `~/.local/share/com.zoujunkun.tauri-app/`

**注意**：Codex 账号配置不在本地持久化，由 CLIProxyAPI 服务端统一管理。

## 类型同步约定

以下类型定义需与 Rust 结构体保持一致（字段名、类型、可选性）：

- `AppConfig` ↔ `src-tauri/src/config.rs::AppConfig`
- `LoginPayload` ↔ `src-tauri/src/commands.rs::LoginPayload`（如果存在）
- `CommandResult` ↔ `src-tauri/src/commands.rs::CommandResult`

修改 Rust 结构体时，必须同步更新 `src/types/index.ts`。

## 窗口行为

- **关闭窗口**：默认隐藏而非退出（`close_to_tray: true`）
- **macOS Dock**：
  - 窗口可见时显示 Dock 图标
  - 最小化时根据 `dock_visible_on_minimize` 配置决定是否隐藏
  - 使用 `ActivationPolicy::Accessory` 隐藏 Dock 图标
- **重新打开**：macOS 点击 Dock 图标或托盘菜单可恢复窗口

## 开发注意事项

1. **类型安全**：前端类型定义与 Rust 结构体必须同步，修改时需同时更新
2. **分层约束**：组件不得直接调用 `api/` 层，必须通过 `stores/`
3. **密码处理**：密码仅在内存中缓存，不持久化到磁盘（安全考虑）
4. **API 版本**：要求 CLIProxyAPI >= 6.8.0（Management API 支持）
5. **开发代理**：浏览器开发时需设置 `VITE_MANAGEMENT_PROXY_TARGET` 环境变量
6. **测试隔离**：使用 vitest + jsdom，测试时 Tauri API 不可用（需 mock）

## 常见任务

### 添加新的 Tauri 命令

1. 在 `src-tauri/src/commands.rs` 添加命令函数（标注 `#[tauri::command]`）
2. 在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 中注册
3. 在 `src/api/` 创建对应的调用函数（封装 `invoke`）
4. 在 `src/stores/` 中调用 api 函数
5. 如有新类型，在 `src/types/index.ts` 和 Rust 中同步定义

### 添加新的 Management API 调用

1. 在 `src/api/` 创建调用函数（使用 `buildManagementUrl` + `requestJson`）
2. 在 `src/types/index.ts` 定义响应类型
3. 在 `src/stores/` 中调用并管理状态
4. 组件通过 store 访问数据

### 修改窗口行为

窗口事件处理在 `src-tauri/src/lib.rs` 的 `.on_window_event()` 中，macOS 特定行为需使用 `#[cfg(target_os = "macos")]`。
