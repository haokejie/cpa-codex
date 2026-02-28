# Codex 账号管理 — 产品需求文档 (PRD)

## 1. 产品背景

CPA Codex 是 CLIProxyAPI 的 Tauri 桌面客户端。用户需要通过本客户端管理多个 Codex API 账号，实时监控额度状态，并通过优先级调度实现账号的智能切换。

所有 Codex 数据不本地持久化，通过 Rust 后端代理调用远程 Management API（`/v0/management/codex-api-key`）实时获取和操作。

## 2. 目标用户

拥有多个 Codex API 账号的开发者/团队，需要：
- 集中管理多账号配置
- 实时掌握各账号额度消耗
- 快速切换活跃账号以避免限流

## 3. 核心用户故事与验收标准

### P0 — 必须实现（MVP）

#### US-1: 账号列表展示

> 作为用户，我希望登录后看到所有 Codex 账号的列表，以便了解当前配置全貌。

验收标准：
- [ ] 登录进入配置页后，自动调用 `GET /codex-api-key` 加载账号列表
- [ ] 每个账号行显示：脱敏 API Key、plan 类型标签（plus/team/free）、优先级标签
- [ ] 列表按 `priority` 升序排列（数值越小越靠前）
- [ ] 加载中显示 loading 态，加载失败显示错误提示并可重试
- [ ] 空列表显示引导态（"暂无 Codex 账号" + 添加按钮）

#### US-2: 额度状态查询

> 作为用户，我希望看到每个账号的实时额度使用情况，以便决定使用哪个账号。

验收标准：
- [ ] 每个账号行显示状态指示点：绿色（可用）、红色（耗尽）、灰色（不可用）、脉冲灰（查询中）
- [ ] 可用账号显示额度进度条（百分比）+ 重置倒计时
- [ ] 进度条颜色：< 80% 黑色，80-99% 琥珀色，100% 红色
- [ ] 支持手动"刷新额度"按钮，刷新期间按钮禁用并显示"刷新中..."
- [ ] 后台每 30 秒自动轮询额度（通过 `backend:quota-update` 事件推送）

#### US-3: 单账号置顶（一键切换）

> 作为用户，我希望一键将某个账号设为最高优先级，让 CLIProxyAPI 优先路由到该账号。

验收标准：
- [ ] 每个账号行有"置顶"按钮（上箭头图标）
- [ ] 点击后该账号 `priority` 设为 0，其余账号 priority 依次递增
- [ ] 通过 `PUT /codex-api-key` 全量保存更新后的配置
- [ ] 操作后列表即时刷新，反映新排序

### P1 — 重要功能

#### US-4: 批量选择与操作

> 作为用户，我希望批量选中多个账号进行置顶或移除操作，提高管理效率。

验收标准：
- [ ] 每行有 checkbox，支持多选
- [ ] 选中 >= 1 个时底部出现批量操作栏，显示"已选 N 个"
- [ ] 批量置顶：选中账号移到列表顶部，priority 重新编号，全量保存
- [ ] 批量移除：二次确认后调用 `DELETE /codex-api-key` 逐个删除
- [ ] 操作完成后自动清除选择状态

#### US-5: 删除账号

> 作为用户，我希望删除不再使用的账号配置。

验收标准：
- [ ] 每行有删除按钮（X 图标），hover 变红
- [ ] 点击后弹出确认对话框（复用 `ConfirmDialog`）
- [ ] 确认后调用 `DELETE /codex-api-key?api-key=...`
- [ ] 删除后列表即时更新，剩余账号 priority 重新编号

#### US-6: 使用统计概览

> 作为用户，我希望看到全局请求统计，了解整体使用情况。

验收标准：
- [ ] 配置页显示统计卡片：总请求数、成功数、失败数、成功率
- [ ] 数据来源 `GET /usage`
- [ ] 随账号列表一起加载，支持手动刷新

### P2 — 后续迭代

#### US-7: 添加新账号

> 作为用户，我希望通过表单添加新的 Codex 账号配置。

验收标准：
- [ ] 点击"+ 添加"按钮打开表单（弹窗或内联）
- [ ] 必填字段：API Key；可选字段：baseUrl、proxyUrl、headers、websockets
- [ ] 提交后通过全量保存（`PUT /codex-api-key`）追加到列表末尾
- [ ] 添加成功后自动触发该账号的额度查询

#### US-8: 编辑账号配置

> 作为用户，我希望修改已有账号的配置（如 baseUrl、headers 等）。

验收标准：
- [ ] 点击账号行展开详情编辑区域
- [ ] 可编辑字段：baseUrl、proxyUrl、headers、websockets
- [ ] API Key 只读显示（不可修改）
- [ ] 保存通过 `PATCH /codex-api-key` 按 index 更新

#### US-9: 使用统计导入/导出

> 作为用户，我希望导出和导入使用统计快照，用于备份或迁移。

验收标准：
- [ ] 统计卡片提供"导出"按钮，调用 `GET /usage/export` 下载 JSON
- [ ] 提供"导入"按钮，选择 JSON 文件后调用 `POST /usage/import`

## 4. 数据流架构

```
用户操作 → Vue 组件 → Pinia Store → API 层 (invoke)
    → Rust Command → remote.rs (HTTP) → CLIProxyAPI
    ← 响应原路返回

后台轮询：background.rs → remote.rs → CLIProxyAPI
    ← backend:quota-update 事件 → 前端 listen → Store 更新
```

## 5. 技术约束

- Codex 数据不落盘，全部实时远程获取
- 额度缓存仅在内存（Rust AppState + 前端 Store）
- 前端不直接请求远程服务，所有请求经 Rust 后端代理
- 前端分层：组件 → Store → API → Rust，禁止跨层调用

## 6. 当前实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
| TS 类型定义 | 已完成 | `CodexConfig`, `CodexQuotaState`, `UsageStats` |
| 前端 Store | Mock 阶段 | `useCodexStore` 使用硬编码 mock 数据 |
| 账号列表 UI | 已完成 | `CodexAccountCard.vue` 含列表、选择、进度条 |
| 统计卡片 UI | 已创建 | `UsageStatsCard.vue` |
| Rust IPC Commands | 待实现 | `get_codex_configs` 等均未定义 |
| remote.rs | 待新增 | HTTP 调用层不存在 |
| 后台额度轮询 | 待实现 | `backend:quota-update` 事件未接入 |

下一步重点：实现 Rust 后端 `remote.rs` + IPC Commands，将前端 Store 从 mock 切换到真实 API 调用。
