<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useAuthFilesStore } from "../stores/authFiles";
import type { AuthFileItem } from "../types";
import ConfirmDialog from "./ConfirmDialog.vue";

const store = useAuthFilesStore();
const currentPage = ref(1);
const pageSize = ref(5);
const showConfirm = ref(false);
const jumpPage = ref('');
const showCleanDialog = ref(false);
const cleaning = ref(false);
const showDeleteDialog = ref(false);
const pendingDeleteName = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const MAX_AUTH_FILE_SIZE = 10 * 1024 * 1024;

function isCodexFile(f: { type?: string; provider?: string }) {
  return f.type === 'codex' || f.provider === 'codex';
}

const filteredFiles = computed(() => {
  return (store.files ?? []).filter(isCodexFile);
});

const totalPages = computed(() => Math.ceil(filteredFiles.value.length / pageSize.value));
const pagedFiles = computed(() =>
  filteredFiles.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value),
);

watch(() => filteredFiles.value.length, () => {
  if (currentPage.value > totalPages.value && totalPages.value > 0) currentPage.value = totalPages.value;
  if (totalPages.value === 0) currentPage.value = 1;
});
watch(pageSize, () => { currentPage.value = 1; });

function doJump() {
  const n = parseInt(jumpPage.value);
  if (n >= 1 && n <= totalPages.value) currentPage.value = n;
  jumpPage.value = '';
}

onMounted(() => store.fetchFiles());

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function handleUploadClick() {
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const list = input.files ? Array.from(input.files) : [];
  if (!list.length) return;

  const valid: File[] = [];
  const invalid: string[] = [];
  const oversized: string[] = [];
  list.forEach((file) => {
    if (!file.name.toLowerCase().endsWith(".json")) {
      invalid.push(file.name);
      return;
    }
    if (file.size > MAX_AUTH_FILE_SIZE) {
      oversized.push(file.name);
      return;
    }
    valid.push(file);
  });

  const errors: string[] = [];
  if (invalid.length) errors.push(`仅支持 .json 文件：${invalid.join(", ")}`);
  if (oversized.length) {
    errors.push(`文件过大（最大 ${formatFileSize(MAX_AUTH_FILE_SIZE)}）：${oversized.join(", ")}`);
  }
  store.setUploadError(errors.length ? errors.join("；") : null);

  if (valid.length) {
    await store.uploadFiles(valid);
  }

  input.value = "";
}

function typeLabel(type?: string) {
  return type || "unknown";
}

const HEALTHY_SET = ['ok', 'healthy', 'ready', 'success', 'available', 'context canceled', 'context cancelled'];
const HEALTHY_CONTAINS = ['context canceled', 'context cancelled'];

function isExpiredMessage(message?: string) {
  if (!message) return false;
  const raw = message.trim();
  const lower = raw.toLowerCase();
  if (lower.includes("token_invalidated") || lower.includes("invalidated") || lower.includes("token expired")) return true;
  if (lower.includes("status") && lower.includes("401")) return true;
  try {
    const parsed = JSON.parse(raw) as { error?: { code?: string }; status?: number };
    if (parsed?.error?.code === "token_invalidated") return true;
    if (parsed?.status === 401) return true;
  } catch { /* 非 JSON 文本 */ }
  return false;
}

function isQuotaExhaustedMessage(message?: string) {
  if (!message) return false;
  const raw = message.trim();
  const lower = raw.toLowerCase();
  if (lower.includes("usage_limit_reached")) return true;
  if (lower.includes("usage limit") && lower.includes("reached")) return true;
  if (lower.includes("quota") && lower.includes("reached")) return true;
  try {
    const parsed = JSON.parse(raw) as { error?: { type?: string; code?: string } };
    if (parsed?.error?.type === "usage_limit_reached") return true;
    if (parsed?.error?.code === "usage_limit_reached") return true;
  } catch { /* 非 JSON 文本 */ }
  return false;
}

function statusKind(f: { disabled?: boolean; unavailable?: boolean; statusMessage?: string; status?: string }) {
  if (f.disabled) return 'disabled';
  const rawMessage = f.statusMessage ?? (f as { status_message?: string }).status_message;
  if (isExpiredMessage(rawMessage)) return 'expired';
  if (isQuotaExhaustedMessage(rawMessage)) return 'exhausted';
  if (f.unavailable) return 'error';
  if (rawMessage) {
    const m = rawMessage.trim().toLowerCase();
    if (HEALTHY_CONTAINS.some((k) => m.includes(k))) return 'healthy';
    if (!HEALTHY_SET.includes(m)) return 'abnormal';
  }
  if (f.status && f.status.toLowerCase() === 'error') return 'abnormal';
  return 'healthy';
}

function formatTime(v?: string | number) {
  if (!v) return '';
  const d = new Date(typeof v === 'number' ? v * 1000 : v);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

const cleanTargets = computed(() => {
  return filteredFiles.value.filter((f: AuthFileItem) => {
    const s = statusKind(f);
    return s === 'expired' || s === 'error';
  });
});

const cleanStats = computed(() => {
  let expired = 0;
  let error = 0;
  for (const f of cleanTargets.value) {
    const s = statusKind(f);
    if (s === 'expired') expired += 1;
    if (s === 'error') error += 1;
  }
  return { total: cleanTargets.value.length, expired, error };
});

function openCleanDialog() {
  if (!cleanTargets.value.length) return;
  showCleanDialog.value = true;
}

async function confirmClean() {
  if (!cleanTargets.value.length) {
    showCleanDialog.value = false;
    return;
  }
  cleaning.value = true;
  try {
    await store.removeBatch(cleanTargets.value.map((f: AuthFileItem) => f.name));
  } finally {
    cleaning.value = false;
    showCleanDialog.value = false;
  }
}

function requestDelete(name: string) {
  pendingDeleteName.value = name;
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  if (!pendingDeleteName.value) {
    showDeleteDialog.value = false;
    return;
  }
  const name = pendingDeleteName.value;
  pendingDeleteName.value = '';
  showDeleteDialog.value = false;
  await store.remove(name);
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div class="head-row">
        <div>
          <h2 class="card-title">认证文件</h2>
          <p class="card-desc">管理 Codex 认证文件（{{ filteredFiles.length }} 个）</p>
        </div>
        <div class="head-actions">
          <button class="btn-ghost btn-sm" @click="store.fetchFiles" :disabled="store.loading">刷新</button>
          <button class="btn-ghost btn-sm" @click="handleUploadClick" :disabled="store.loading || store.uploading">
            {{ store.uploading ? "上传中..." : "上传" }}
          </button>
          <button class="btn-ghost btn-sm btn-ghost-danger" @click="openCleanDialog" :disabled="!cleanTargets.length">一键清理</button>
          <button class="btn-danger btn-sm" @click="showConfirm = true" :disabled="!store.files.length">清空</button>
        </div>
      </div>
    </div>

    <div v-if="store.error" class="error-banner">
      <span class="error-text">{{ store.error }}</span>
      <button class="btn-ghost btn-sm" @click="store.fetchFiles">重试</button>
    </div>
    <div v-if="store.uploadError" class="error-banner">
      <span class="error-text">{{ store.uploadError }}</span>
      <button class="btn-ghost btn-sm" @click="store.setUploadError(null)">关闭</button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      multiple
      style="display: none"
      @change="handleFileChange"
    />

    <div v-if="store.loading" class="empty-state keep-height">
      <p class="empty-text">加载中...</p>
    </div>

    <div v-else-if="!filteredFiles.length && !store.error" class="empty-state">
      <svg class="empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/></svg>
      <p class="empty-text">暂无 Codex 认证文件</p>
    </div>

    <div v-else class="file-list">
      <div class="file-header">
        <span class="col-name">文件名</span>
        <span class="col-type">类型</span>
        <span class="col-status">状态</span>
        <span class="col-refresh">最后刷新</span>
        <span class="col-ops">操作</span>
      </div>
      <div class="file-body">
        <div v-for="f in pagedFiles" :key="f.name" class="file-row">
        <span class="col-name file-name" :class="{ 'file-disabled': f.disabled }">{{ f.name }}</span>
        <span class="col-type file-type">{{ typeLabel(f.type) }}</span>
        <span class="col-status">
          <span class="badge" :class="'badge-' + statusKind(f)">
            {{ { healthy: '健康', expired: '过期', exhausted: '额度耗尽', abnormal: '异常', error: '不可用', disabled: '已禁用' }[statusKind(f)] }}
          </span>
        </span>
        <span class="col-refresh last-refresh">{{ f.lastRefresh ? formatTime(f.lastRefresh) : '-' }}</span>
        <span class="col-ops file-actions">
          <button
            v-if="!f.runtimeOnly"
            class="btn-row"
            @click="store.toggleDisabled(f.name, !f.disabled)"
          >{{ f.disabled ? '启用' : '禁用' }}</button>
          <button
            v-if="!f.runtimeOnly"
            class="btn-row btn-row-danger"
            @click="requestDelete(f.name)"
          >删除</button>
        </span>
      </div>
      </div>
    </div>

    <div v-if="filteredFiles.length" class="pagination">
      <span class="page-info">共 {{ filteredFiles.length }} 条，每页
        <select class="page-size-select" v-model="pageSize">
          <option :value="5">5</option>
          <option :value="10">10</option>
          <option :value="20">20</option>
        </select>
        条
      </span>
      <div class="page-actions">
        <button class="btn-ghost btn-xs" :disabled="currentPage <= 1" @click="currentPage--">上一页</button>
        <span class="page-num">{{ currentPage }}/{{ totalPages }}</span>
        <button class="btn-ghost btn-xs" :disabled="currentPage >= totalPages" @click="currentPage++">下一页</button>
        <input class="page-jump" v-model="jumpPage" placeholder="跳转" @keyup.enter="doJump" type="number" min="1" :max="totalPages" />
        <button class="btn-ghost btn-xs" @click="doJump">GO</button>
      </div>
    </div>
  </section>

  <ConfirmDialog
    :open="showConfirm"
    title="清空认证文件"
    message="确定要删除所有认证文件吗？此操作不可撤销。"
    @confirm="store.removeAll(); showConfirm = false"
    @cancel="showConfirm = false"
  />

  <ConfirmDialog
    :open="showDeleteDialog"
    title="删除认证文件"
    :message="pendingDeleteName ? `确定要删除 ${pendingDeleteName} 吗？此操作不可撤销。` : '确定要删除该文件吗？此操作不可撤销。'"
    @confirm="confirmDelete"
    @cancel="showDeleteDialog = false"
  />

  <div v-if="showCleanDialog" class="mask">
    <div class="dialog">
      <div class="dialog-header">
        <h3 class="dialog-title">清理不可用与过期文件</h3>
        <div class="dialog-stats">
          <span>共 {{ cleanStats.total }} 个</span>
          <span>过期 {{ cleanStats.expired }}</span>
          <span>不可用 {{ cleanStats.error }}</span>
        </div>
      </div>
      <div class="dialog-body">
        <p class="dialog-message">以下文件将被删除，确认继续？</p>
        <div class="dialog-list">
          <div v-for="f in cleanTargets" :key="f.name" class="dialog-item">
            <span class="dialog-key">{{ f.name }}</span>
            <span class="dialog-status" :class="'status-' + statusKind(f)">
              {{ { expired: '过期', exhausted: '额度耗尽', error: '不可用', abnormal: '异常', disabled: '已禁用', healthy: '健康' }[statusKind(f)] }}
            </span>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn-ghost" :disabled="cleaning" @click="showCleanDialog = false">取消</button>
        <button class="btn-danger" :disabled="cleaning" @click="confirmClean">
          {{ cleaning ? "处理中..." : "确认删除" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: #fff;
  border: 1px solid var(--zinc-200);
  border-radius: 12px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 52px - 56px);
  min-height: 0;
}
.card-head { margin-bottom: 16px; }
.head-row { display: flex; justify-content: space-between; align-items: flex-start; }
.head-actions { display: flex; gap: 8px; }
.card-title { font-size: 15px; font-weight: 600; color: var(--zinc-900); margin-bottom: 4px; }
.card-desc { font-size: 12px; color: var(--zinc-500); }
.error-banner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; background: #fef2f2; border-radius: 8px;
  margin-bottom: 12px; font-size: 12px; color: #dc2626;
}
.empty-state { padding: 40px 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.keep-height { flex: 1; }
.empty-icon { color: var(--zinc-300); }
.empty-text { font-size: 13px; color: var(--zinc-500); }
.file-list { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.file-header {
  display: flex; align-items: center; padding: 0 0 8px;
  border-bottom: 1px solid var(--zinc-200);
  font-size: 11px; font-weight: 500; color: var(--zinc-500);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.file-body { flex: 1; overflow-y: auto; min-height: 0; }
.file-row {
  display: flex; align-items: center;
  padding: 10px 0; border-bottom: 1px solid var(--zinc-100);
}
.file-row:last-child { border-bottom: none; }
.col-name { flex: 1; min-width: 0; }
.col-type { width: 70px; flex-shrink: 0; }
.col-status { width: 64px; flex-shrink: 0; }
.col-refresh { width: 72px; flex-shrink: 0; }
.col-ops { width: 100px; flex-shrink: 0; display: flex; justify-content: flex-end; }
.file-name { font-size: 13px; color: var(--zinc-800); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-disabled { color: var(--zinc-400); text-decoration: line-through; }
.file-type { font-size: 11px; color: var(--zinc-400); flex-shrink: 0; }
.badge { font-size: 11px; padding: 0 8px; border-radius: 10px; font-weight: 500; height: 20px; line-height: 20px; display: inline-block; }
.badge-healthy { background: #f0fdf4; color: #16a34a; }
.badge-warning { background: #fefce8; color: #ca8a04; }
.badge-expired { background: #fff7ed; color: #c2410c; }
.badge-exhausted { background: #fefce8; color: #ca8a04; }
.badge-abnormal { background: #fef2f2; color: #dc2626; }
.badge-error { background: #fef2f2; color: #dc2626; }
.badge-disabled { background: var(--zinc-100); color: var(--zinc-400); }
.last-refresh { font-size: 11px; color: var(--zinc-400); }
.file-actions { display: flex; align-items: center; gap: 4px; }
.btn-row {
  background: transparent; border: 1px solid var(--zinc-200); border-radius: 6px;
  padding: 2px 8px; font-size: 11px; font-family: inherit;
  color: var(--zinc-600); cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}
.btn-row:hover { background: var(--zinc-50); border-color: var(--zinc-300); color: var(--zinc-900); }
.btn-row-danger { color: #dc2626; border-color: #fecaca; }
.btn-row-danger:hover { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }
.btn-ghost {
  background: none; border: 1px solid var(--zinc-200); border-radius: 7px;
  color: var(--zinc-600); font-family: inherit; cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}
.btn-ghost:hover { background: var(--zinc-50); border-color: var(--zinc-300); color: var(--zinc-900); }
.btn-ghost-danger {
  border-color: #fecaca;
  color: #dc2626;
}
.btn-ghost-danger:hover {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}
.btn-ghost:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-danger {
  background: none; border: 1px solid #fecaca; border-radius: 7px;
  color: #dc2626; font-family: inherit; cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}
.btn-danger:hover { background: #fef2f2; border-color: #fca5a5; }
.btn-danger:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-sm { font-size: 12px; padding: 4px 10px; }
.btn-xs { font-size: 11px; padding: 2px 8px; }
.pagination {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid var(--zinc-100); padding-top: 12px; margin-top: 8px;
}
.page-info { font-size: 12px; color: var(--zinc-500); display: flex; align-items: center; gap: 4px; }
.page-actions { display: flex; align-items: center; gap: 6px; }
.page-num { font-size: 12px; color: var(--zinc-500); min-width: 36px; text-align: center; }
.page-size-select {
  height: 22px; padding: 0 4px; font-size: 12px; font-family: inherit;
  border: 1px solid var(--zinc-200); border-radius: 5px;
  background: #fff; color: var(--zinc-700); cursor: pointer;
}
.page-jump {
  width: 48px; height: 22px; padding: 0 6px; font-size: 12px; font-family: inherit;
  border: 1px solid var(--zinc-200); border-radius: 5px;
  background: #fff; color: var(--zinc-700); text-align: center;
}
.page-jump:focus { outline: none; border-color: #6366F1; box-shadow: 0 0 0 2px rgba(99,102,241,0.10); }
.page-jump::-webkit-inner-spin-button { -webkit-appearance: none; }

/* 清理弹窗 */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(9, 9, 11, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(2px);
}
.dialog {
  width: 420px;
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.14);
  overflow: hidden;
}
.dialog-header {
  padding: 20px 20px 0;
}
.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #18181B;
}
.dialog-stats {
  margin-top: 6px;
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: #71717A;
}
.dialog-body {
  padding: 8px 20px 16px;
}
.dialog-message {
  font-size: 13px;
  color: #71717A;
  line-height: 1.6;
}
.dialog-list {
  margin-top: 10px;
  max-height: 220px;
  overflow: auto;
  border: 1px solid var(--zinc-200);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dialog-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  background: var(--zinc-50);
  border-radius: 6px;
}
.dialog-key {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--zinc-700);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dialog-status {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 500;
}
.status-expired,
.status-error {
  color: #dc2626;
}
.status-exhausted {
  color: #ca8a04;
}
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 20px;
}
.dialog-footer .btn-ghost {
  height: 34px;
  padding: 0 14px;
  border-radius: 7px;
  font-size: 13px;
}
.dialog-footer .btn-danger {
  height: 34px;
  padding: 0 14px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  background: #DC2626;
  color: #FFFFFF;
  border: none;
}
.dialog-footer .btn-danger:hover:not(:disabled) {
  background: #B91C1C;
  border: none;
}
</style>
