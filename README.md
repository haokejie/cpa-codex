# CPA Codex Desktop

面向 CLIProxyAPI 的 Codex 账号管理桌面客户端。基于 Tauri 2（Rust 后端常驻）与 Vue 3（配置窗口）构建，关闭窗口仅隐藏，不退出进程，适合常驻后台的账号与额度管理场景。

## 功能

- **账号管理**：多服务器账号登录/切换/删除，密码仅缓存于内存
- **Codex 账号配置**：查看 CLIProxyAPI 上的 Codex 账号列表及优先级配置
- **认证文件管理**：列出、删除 auth files，支持额度状态查询
- **API Keys 管理**：查看与管理 API Keys
- **使用统计**：请求数、成功率、Token 用量（含缓存/推理分解）、RPM/TPM 速率、分钟级 Sparkline、服务健康格
- **额度监控**：按 auth index 查询 Codex 账号额度状态
- **失效账号扫描**：
  - 手动扫描：并发检测失效账号，支持批量删除
  - 自动扫描：定时循环扫描并自动清理，支持暂停/恢复，保存最近 10 次历史
- **应用配置**：开机自启、托盘开关、关闭隐藏到托盘、macOS Dock 可见性
- **系统托盘**：打开窗口 / 退出

## 架构概览

前端（Vue 3）分层：

```
src/types/       类型定义（与 Rust 结构体同步）
src/api/         调用层（封装 invoke 和 HTTP 请求）
src/stores/      状态与业务逻辑层（Pinia）
src/components/  视图层（仅调用 store）
```

后端（Rust）分层：

```
lib.rs           应用入口、插件注册、窗口事件处理
commands.rs      Tauri IPC 命令（参数校验、结果转换）
state.rs         应用状态聚合（依赖注入）
config.rs        配置持久化（JSON 文件）
tray.rs          系统托盘
```

## 与 CLIProxyAPI 的关系

- 远程后端：CLIProxyAPI（最低版本 >= 6.8.0）
- 认证方式：`Authorization: Bearer <MANAGEMENT_KEY>`
- Management API 基础路径：`/v0/management`

Codex 账号配置不在本地持久化，由 CLIProxyAPI 服务端统一管理。

## 数据存储

### 前端（localStorage）

- `cpa-codex:accounts`：账号列表（服务器地址、最后登录时间）
- `cpa-codex:last-account`：最后登录的账号 key
- `cpa-codex:remember:<accountKey>`：记住密码偏好

密码仅缓存于内存，页面刷新后清空，不写入磁盘。

### 后端（Rust）

- `app_data_dir/config.json`：应用配置（开机自启、托盘、Dock 设置）

`app_data_dir`（identifier: `com.zoujunkun.tauri-app`）：
- macOS：`~/Library/Application Support/com.zoujunkun.tauri-app/`
- Windows：`C:\Users\<user>\AppData\Roaming\com.zoujunkun.tauri-app\`
- Linux：`~/.local/share/com.zoujunkun.tauri-app/`

## 开发与构建

包管理器：`pnpm`

```bash
# 启动完整开发环境（Tauri dev，自动启动前端 dev server）
pnpm tauri dev

# 仅启动前端 Vite dev server（浏览器调试）
pnpm dev

# 前端类型检查 + 构建
pnpm build

# 测试（watch 模式）
pnpm test

# 测试（单次运行）
pnpm test:run

# Rust 类型检查
cd src-tauri && cargo check

# Rust lint
cd src-tauri && cargo clippy
```

浏览器开发时需设置代理环境变量：

```bash
VITE_MANAGEMENT_PROXY_TARGET=http://localhost:8787 pnpm dev
```

## 相关项目

- CLIProxyAPI（远程后端与 Management API）

## License

[MIT](./LICENSE) © haokejie
