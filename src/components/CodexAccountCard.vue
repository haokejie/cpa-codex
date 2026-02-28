<script setup lang="ts">
import { useCodexStore } from "../stores/codex";
import type { CodexConfig, CodexQuotaState } from "../types";

const emit = defineEmits<{ edit: [cfg: CodexConfig]; delete: [cfg: CodexConfig]; batchDelete: [] }>();
const store = useCodexStore();

function maskKey(key: string) {
  if (key.length <= 12) return key;
  return key.slice(0, 7) + "..." + key.slice(-4);
}

function getQuota(key: string): CodexQuotaState | undefined {
  return store.quotas[key];
}

function statusClass(cfg: CodexConfig) {
  const q = getQuota(cfg.apiKey);
  if (!q || q.status === "loading") return "loading";
  if (q.status === "error" || !q.allowed) return "unavailable";
  if (q.limitReached) return "exhausted";
  return "available";
}

function statusLabel(cfg: CodexConfig) {
  const s = statusClass(cfg);
  if (s === "available") return "可用";
  if (s === "exhausted") return "已耗尽";
  if (s === "unavailable") return "不可用";
  return "查询中...";
}

function planLabel(cfg: CodexConfig): string {
  return cfg.planType || getQuota(cfg.apiKey)?.planType || "";
}

function barPercent(cfg: CodexConfig): number {
  const q = getQuota(cfg.apiKey);
  if (!q?.windows?.length) return 0;
  return Math.min(100, Math.max(0, q.windows[0].usedPercent));
}

function barColorClass(percent: number) {
  if (percent >= 100) return "bar-red";
  if (percent >= 80) return "bar-amber";
  return "bar-default";
}

function formatReset(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function windowInfo(cfg: CodexConfig): string {
  const q = getQuota(cfg.apiKey);
  if (!q?.windows?.length) return "";
  const w = q.windows[0];
  return `${w.label} 重置于 ${formatReset(w.resetAfterSeconds)}`;
}

function isSelected(key: string) {
  return store.selected.has(key);
}

function isQuotaLoading(key: string) {
  return getQuota(key)?.status === "loading";
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div class="card-head-left">
        <h2 class="card-title">Codex 账号</h2>
        <span class="card-count" v-if="store.configs.length">({{ store.configs.length }})</span>
      </div>
      <div class="card-head-actions">
        <button class="btn-ghost" :disabled="store.refreshingQuota" @click="store.refreshQuotas">
          {{ store.refreshingQuota ? "刷新中..." : "刷新额度" }}
        </button>
        <button class="btn-primary-sm">+ 添加</button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!store.configs.length && !store.loading" class="empty-state">
      <p class="empty-text">暂无 Codex 账号</p>
      <button class="btn-dashed">+ 添加账号</button>
    </div>

    <!-- 全选栏 -->
    <div v-if="store.configs.length" class="select-all-bar">
      <label class="checkbox-wrap" @click.stop>
        <input type="checkbox" :checked="store.allSelected" @change="store.toggleSelectAll" />
        <span class="checkbox-box"></span>
      </label>
      <span class="select-all-label">全选</span>
    </div>

    <!-- 账号列表 -->
    <div v-if="store.configs.length" class="account-list">
      <div
        v-for="cfg in store.configs"
        :key="cfg.apiKey"
        class="account-row"
        :class="{ 'row-selected': isSelected(cfg.apiKey) }"
      >
        <div class="row-main">
          <label class="checkbox-wrap" @click.stop>
            <input type="checkbox" :checked="isSelected(cfg.apiKey)" @change="store.toggleSelect(cfg.apiKey)" />
            <span class="checkbox-box"></span>
          </label>

          <span class="status-dot" :class="'dot-' + statusClass(cfg)"></span>
          <span class="api-key">{{ maskKey(cfg.apiKey) }}</span>

          <span v-if="planLabel(cfg)" class="tag" :class="'tag-' + planLabel(cfg).toLowerCase()">{{ planLabel(cfg) }}</span>
          <span class="tag tag-priority">P:{{ cfg.priority }}</span>

          <!-- 状态徽章 -->
          <span class="badge" :class="'badge-' + statusClass(cfg)">{{ statusLabel(cfg) }}</span>

          <div class="row-actions">
            <button class="btn-icon" title="查询额度" :disabled="isQuotaLoading(cfg.apiKey)" @click="store.refreshSingleQuota(cfg.apiKey)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11.5 7A4.5 4.5 0 1 1 7 2.5M7 2.5V5.5L9 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="btn-icon" title="置顶" @click="store.setTopPriority(cfg.apiKey)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2.5V11.5M7 2.5L3.5 6M7 2.5L10.5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="btn-icon" title="编辑" @click="emit('edit', cfg)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M8.5 2.5L11.5 5.5M2 12L2.5 9.5L10 2L12 4L4.5 11.5L2 12Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="btn-icon btn-icon-danger" title="删除" @click="emit('delete', cfg)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 额度进度条 -->
        <div class="row-quota" v-if="getQuota(cfg.apiKey)?.windows?.length">
          <div class="bar-track">
            <div class="bar-fill" :class="barColorClass(barPercent(cfg))" :style="{ width: barPercent(cfg) + '%' }"></div>
          </div>
          <span class="bar-percent" :class="{ 'percent-red': barPercent(cfg) >= 100 }">{{ barPercent(cfg) }}%</span>
          <span class="reset-info">{{ windowInfo(cfg) }}</span>
        </div>

        <div class="row-quota" v-else-if="getQuota(cfg.apiKey)">
          <span class="status-label" :class="'label-' + statusClass(cfg)">{{ statusLabel(cfg) }}</span>
        </div>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="store.selectedCount > 0" class="batch-bar">
      <span class="batch-info">已选 {{ store.selectedCount }} 个</span>
      <div class="batch-actions">
        <button class="btn-ghost btn-sm" @click="store.batchSetTopPriority">批量放行</button>
        <button class="btn-ghost btn-sm" @click="store.batchDisable">批量禁用</button>
        <button class="btn-ghost btn-sm btn-ghost-danger" @click="emit('batchDelete')">批量移除</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card {
  background: #fff;
  border: 1px solid var(--zinc-200);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-head-left {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--zinc-900);
}

.card-count {
  font-size: 12px;
  color: var(--zinc-400);
}

.card-head-actions {
  display: flex;
  gap: 8px;
}

/* 按钮 */
.btn-ghost {
  height: 30px;
  padding: 0 12px;
  background: transparent;
  color: var(--zinc-600);
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--zinc-50);
  border-color: var(--zinc-300);
  color: var(--zinc-900);
}
.btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-ghost-danger {
  color: var(--red-600);
  border-color: var(--red-200);
}
.btn-ghost-danger:hover:not(:disabled) {
  background: var(--red-50);
  border-color: var(--red-200);
  color: var(--red-600);
}

.btn-primary-sm {
  height: 30px;
  padding: 0 14px;
  background: var(--zinc-900);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease;
}
.btn-primary-sm:hover { background: var(--zinc-800); }

.btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }

.btn-dashed {
  height: 36px;
  padding: 0 20px;
  background: transparent;
  color: var(--zinc-600);
  border: 1px dashed var(--zinc-300);
  border-radius: 7px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease;
}
.btn-dashed:hover {
  border-color: var(--zinc-400);
  color: var(--zinc-900);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
}
.empty-text {
  font-size: 14px;
  color: var(--zinc-400);
}

/* 全选栏 */
.select-all-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--zinc-100);
}
.select-all-label {
  font-size: 12px;
  color: var(--zinc-500);
}

/* 状态徽章 */
.badge {
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}
.badge-available { background: var(--green-50); color: var(--green-600); }
.badge-exhausted { background: var(--red-50); color: var(--red-600); }
.badge-unavailable { background: var(--zinc-100); color: var(--zinc-400); }
.badge-loading { background: var(--zinc-100); color: var(--zinc-400); }

/* 账号列表 */
.account-list {
  display: flex;
  flex-direction: column;
}

.account-row {
  padding: 12px 0;
  border-top: 1px solid var(--zinc-100);
  transition: background 150ms ease;
}
.account-row:hover {
  background: var(--zinc-50);
  margin: 0 -24px;
  padding-left: 24px;
  padding-right: 24px;
}
.row-selected {
  background: var(--zinc-100);
  margin: 0 -24px;
  padding-left: 22px;
  padding-right: 24px;
  border-left: 2px solid var(--indigo-500);
}

.row-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Checkbox */
.checkbox-wrap {
  position: relative;
  display: flex;
  cursor: pointer;
}
.checkbox-wrap input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.checkbox-box {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--zinc-300);
  border-radius: 4px;
  transition: background 150ms ease, border-color 150ms ease;
}
.checkbox-wrap:hover .checkbox-box {
  border-color: var(--zinc-400);
}
.checkbox-wrap input:checked + .checkbox-box {
  background: var(--zinc-900);
  border-color: var(--zinc-900);
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 10 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 5L4 7L8 3' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
}

/* 状态点 */
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-available { background: var(--green-600); }
.dot-exhausted { background: var(--red-600); }
.dot-unavailable { background: var(--zinc-300); }
.dot-loading {
  background: var(--zinc-400);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* API Key */
.api-key {
  font-size: 13px;
  font-family: "SF Mono", "Fira Code", monospace;
  color: var(--zinc-700);
  flex-shrink: 0;
}

/* Tags */
.tag {
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}
.tag-plus { background: var(--green-50); color: var(--green-600); }
.tag-team { background: #EEF2FF; color: var(--indigo-500); }
.tag-free { background: var(--zinc-100); color: var(--zinc-500); }
.tag-priority { background: var(--zinc-100); color: var(--zinc-500); margin-left: auto; }

/* 行操作 */
.row-actions {
  display: flex;
  gap: 4px;
  margin-left: 4px;
}
.btn-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: var(--zinc-400);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}
.btn-icon:hover:not(:disabled) {
  background: var(--zinc-100);
  color: var(--zinc-700);
}
.btn-icon:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.btn-icon-danger:hover {
  background: var(--red-50);
  color: var(--red-600);
}

/* 额度进度条 */
.row-quota {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-left: 32px;
}

.bar-track {
  flex: 1;
  height: 4px;
  background: var(--zinc-200);
  border-radius: 2px;
  overflow: hidden;
  max-width: 180px;
}
.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 300ms ease;
}
.bar-default { background: var(--zinc-900); }
.bar-amber { background: #F59E0B; }
.bar-red { background: var(--red-600); }

.bar-percent {
  font-size: 12px;
  font-weight: 500;
  color: var(--zinc-600);
  min-width: 32px;
}
.percent-red { color: var(--red-600); }

.reset-info {
  font-size: 12px;
  color: var(--zinc-400);
}

.status-label {
  font-size: 12px;
}
.label-unavailable { color: var(--zinc-400); }
.label-exhausted { color: var(--red-600); }
.label-loading { color: var(--zinc-400); }

/* 批量操作栏 */
.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 0;
  margin-top: 8px;
  border-top: 1px solid var(--zinc-200);
}
.batch-info {
  font-size: 13px;
  color: var(--zinc-500);
}
.batch-actions {
  display: flex;
  gap: 8px;
}
</style>
