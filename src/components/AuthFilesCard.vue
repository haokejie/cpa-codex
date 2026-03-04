<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from "vue";
import { useAuthFilesStore } from "../stores/authFiles";
import { useAuthFilesExtrasStore } from "../stores/authFilesExtras";
import { useConfigStore } from "../stores/config";
import type { AuthFileItem, AuthFileModelDefinition } from "../types";
import { normalizeAutoRefreshIntervalSeconds } from "../utils/autoRefresh";
import { saveTextToFile } from "../utils/download";
import { DEFAULT_AUTH_FILES_PAGE_SIZE, MAX_AUTH_FILE_SIZE, MAX_AUTH_FILES_PAGE_SIZE, MIN_AUTH_FILES_PAGE_SIZE } from "../utils/constants";
import ConfirmDialog from "./ConfirmDialog.vue";
import BaseCard from "./BaseCard.vue";

const store = useAuthFilesStore();
const extrasStore = useAuthFilesExtrasStore();
const configStore = useConfigStore();
const currentPage = ref(1);
const pageSize = ref(DEFAULT_AUTH_FILES_PAGE_SIZE);
const showConfirm = ref(false);
const jumpPage = ref('');
const showCleanDialog = ref(false);
const cleaning = ref(false);
const showDeleteDialog = ref(false);
const pendingDeleteName = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const downloading = ref<Set<string>>(new Set());
const downloadError = ref<string | null>(null);
const modelsModalOpen = ref(false);
const modelsLoading = ref(false);
const modelsError = ref<string | null>(null);
const modelsList = ref<AuthFileModelDefinition[]>([]);
const modelsTargetName = ref('');

const ALL_FILTER = 'all';
const NONE_FILTER = '__none__';

const baseFiles = computed(() => store.files ?? []);

onMounted(() => store.fetchFiles());

let refreshTimer: number | null = null;

function clearAutoRefresh() {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function setupAutoRefresh() {
  clearAutoRefresh();
  const config = configStore.config;
  if (!config?.auto_refresh_enabled) return;
  const seconds = normalizeAutoRefreshIntervalSeconds(config.auto_refresh_interval_seconds);
  refreshTimer = window.setInterval(() => {
    if (store.loading || store.uploading) return;
    store.fetchFiles();
  }, seconds * 1000);
}

watch(
  () => [configStore.config?.auto_refresh_enabled, configStore.config?.auto_refresh_interval_seconds],
  setupAutoRefresh,
  { immediate: true },
);

onUnmounted(() => {
  clearAutoRefresh();
});

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function setDownloading(name: string, active: boolean) {
  const next = new Set(downloading.value);
  if (active) next.add(name);
  else next.delete(name);
  downloading.value = next;
}

async function handleDownload(file: AuthFileItem) {
  const name = file.name;
  if (!name) return;
  if (downloading.value.has(name)) return;
  downloadError.value = null;
  setDownloading(name, true);
  try {
    const text = await extrasStore.downloadAuthFileText(name);
    const ok = await saveTextToFile(text, name);
    if (!ok) {
      downloadError.value = "保存失败，请重试";
    }
  } catch (e) {
    downloadError.value = String(e);
  } finally {
    setDownloading(name, false);
  }
}

async function openModelsModal(file: AuthFileItem) {
  const name = file.name;
  if (!name) return;
  modelsModalOpen.value = true;
  modelsLoading.value = true;
  modelsError.value = null;
  modelsList.value = [];
  modelsTargetName.value = name;
  try {
    modelsList.value = await extrasStore.fetchModelsForFile(name);
  } catch (e) {
    modelsError.value = String(e);
  } finally {
    modelsLoading.value = false;
  }
}

function closeModelsModal() {
  modelsModalOpen.value = false;
  modelsList.value = [];
  modelsError.value = null;
  modelsTargetName.value = '';
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
  const raw = type || 'unknown';
  const lower = raw.toLowerCase();
  if (lower === 'iflow') return 'iFlow';
  if (lower === 'gemini-cli') return 'Gemini CLI';
  return raw;
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

const STATUS_ORDER = ['healthy', 'expired', 'exhausted', 'abnormal', 'error', 'disabled'] as const;
const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
  healthy: '健康',
  expired: '过期',
  exhausted: '额度耗尽',
  abnormal: '异常',
  error: '不可用',
  disabled: '已禁用',
};

const typeFilter = ref(ALL_FILTER);
const statusFilter = ref(ALL_FILTER);
const authIndexFilter = ref(ALL_FILTER);
const nameKeyword = ref('');

function fileTypeValue(f: AuthFileItem) {
  return f.type || f.provider || 'unknown';
}

function authIndexValue(f: AuthFileItem) {
  const raw = f.authIndex ?? f.auth_index;
  if (raw === undefined || raw === null || raw === '') return NONE_FILTER;
  return String(raw);
}

const typeOptions = computed(() => {
  const values = Array.from(new Set(baseFiles.value.map((f) => fileTypeValue(f))));
  values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  return [
    { value: ALL_FILTER, label: '全部类型' },
    ...values.map((value) => ({
      value,
      label: value === 'unknown' ? '未知' : value,
    })),
  ];
});

const statusOptions = computed(() => {
  const present = new Set(baseFiles.value.map((f) => statusKind(f)));
  return [
    { value: ALL_FILTER, label: '全部状态' },
    ...STATUS_ORDER.filter((status) => present.has(status)).map((status) => ({
      value: status,
      label: STATUS_LABELS[status],
    })),
  ];
});

const authIndexOptions = computed(() => {
  const values = Array.from(new Set(baseFiles.value.map((f) => authIndexValue(f))));
  values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }));
  return [
    { value: ALL_FILTER, label: '全部索引' },
    ...values.map((value) => ({
      value,
      label: value === NONE_FILTER ? '无索引' : value,
    })),
  ];
});

const typeOptionSet = computed(() => new Set(typeOptions.value.map((option) => option.value)));
const statusOptionSet = computed(() => new Set(statusOptions.value.map((option) => option.value)));
const authIndexOptionSet = computed(() => new Set(authIndexOptions.value.map((option) => option.value)));

const effectiveTypeFilter = computed(() => (typeOptionSet.value.has(typeFilter.value) ? typeFilter.value : ALL_FILTER));
const effectiveStatusFilter = computed(() => (statusOptionSet.value.has(statusFilter.value) ? statusFilter.value : ALL_FILTER));
const effectiveAuthIndexFilter = computed(() =>
  authIndexOptionSet.value.has(authIndexFilter.value) ? authIndexFilter.value : ALL_FILTER,
);

const filteredFiles = computed(() =>
  baseFiles.value.filter((f) => {
    const typeMatched = effectiveTypeFilter.value === ALL_FILTER || fileTypeValue(f) === effectiveTypeFilter.value;
    const statusMatched = effectiveStatusFilter.value === ALL_FILTER || statusKind(f) === effectiveStatusFilter.value;
    const authIndexMatched = effectiveAuthIndexFilter.value === ALL_FILTER
      || authIndexValue(f) === effectiveAuthIndexFilter.value;
    const keyword = nameKeyword.value.trim().toLowerCase();
    const nameMatched = !keyword || f.name.toLowerCase().includes(keyword);
    return typeMatched && statusMatched && authIndexMatched && nameMatched;
  }),
);

const hasActiveFilters = computed(
  () =>
    effectiveTypeFilter.value !== ALL_FILTER
    || effectiveStatusFilter.value !== ALL_FILTER
    || effectiveAuthIndexFilter.value !== ALL_FILTER
    || nameKeyword.value.trim() !== '',
);

const descriptionText = computed(() => {
  const total = baseFiles.value.length;
  if (!hasActiveFilters.value) return `管理认证文件（${total} 个）`;
  return `管理认证文件（${filteredFiles.value.length}/${total} 个）`;
});

function clearFilters() {
  typeFilter.value = ALL_FILTER;
  statusFilter.value = ALL_FILTER;
  authIndexFilter.value = ALL_FILTER;
  nameKeyword.value = '';
}

watch([typeFilter, statusFilter, authIndexFilter, nameKeyword], () => {
  currentPage.value = 1;
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
  return baseFiles.value.filter((f: AuthFileItem) => {
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
  <BaseCard
    title="认证文件"
    :description="descriptionText"
  >
    <template #actions>
      <div class="head-actions">
        <button class="btn-ghost btn-sm btn-refresh" @click="store.fetchFiles" :disabled="store.loading">
          <span v-if="store.loading" class="btn-spinner" aria-hidden="true"></span>
          {{ store.loading ? "刷新中..." : "刷新" }}
        </button>
        <button class="btn-ghost btn-sm" @click="handleUploadClick" :disabled="store.loading || store.uploading">
          {{ store.uploading ? "上传中..." : "上传" }}
        </button>
        <button class="btn-ghost btn-sm btn-ghost-danger" @click="openCleanDialog" :disabled="!cleanTargets.length">一键清理</button>
        <button class="btn-danger btn-sm" @click="showConfirm = true" :disabled="!store.files.length">清空</button>
      </div>
    </template>

    <div v-if="store.error" class="error-banner">
      <span class="error-text">{{ store.error }}</span>
      <button class="btn-ghost btn-sm" @click="store.fetchFiles">重试</button>
    </div>
    <div v-if="store.uploadError" class="error-banner">
      <span class="error-text">{{ store.uploadError }}</span>
      <button class="btn-ghost btn-sm" @click="store.setUploadError(null)">关闭</button>
    </div>
    <div v-if="downloadError" class="error-banner">
      <span class="error-text">{{ downloadError }}</span>
      <button class="btn-ghost btn-sm" @click="downloadError = null">关闭</button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      multiple
      style="display: none"
      @change="handleFileChange"
    />

    <div v-if="baseFiles.length" class="filters">
      <label class="filter-item">
        <span class="filter-label">类型</span>
        <select v-model="typeFilter" class="filter-select">
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label class="filter-item">
        <span class="filter-label">状态</span>
        <select v-model="statusFilter" class="filter-select">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label class="filter-item">
        <span class="filter-label">索引</span>
        <select v-model="authIndexFilter" class="filter-select">
          <option v-for="opt in authIndexOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label class="filter-item">
        <span class="filter-label">名称</span>
        <input
          v-model="nameKeyword"
          class="filter-input"
          placeholder="搜索文件名"
          type="search"
        />
      </label>
      <button class="btn-ghost btn-sm" @click="clearFilters" :disabled="!hasActiveFilters">清空筛选</button>
    </div>

    <div v-if="store.loading" class="empty-state keep-height">
      <p class="empty-text">加载中...</p>
    </div>

    <div v-else-if="!baseFiles.length && !store.error" class="empty-state">
      <svg class="empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/></svg>
      <p class="empty-text">暂无认证文件</p>
    </div>

    <div v-else-if="!filteredFiles.length" class="empty-state">
      <p class="empty-text">无匹配结果</p>
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
        <div class="col-name file-name" :class="{ 'file-disabled': f.disabled }">
          <span class="file-name-text">{{ f.name }}</span>
          <span v-if="f.runtimeOnly" class="file-tag">运行时</span>
        </div>
        <span class="col-type file-type">{{ typeLabel(f.type ?? f.provider) }}</span>
        <span class="col-status">
          <span class="badge" :class="'badge-' + statusKind(f)">
            {{ { healthy: '健康', expired: '过期', exhausted: '额度耗尽', abnormal: '异常', error: '不可用', disabled: '已禁用' }[statusKind(f)] }}
          </span>
        </span>
        <span class="col-refresh last-refresh">{{ f.lastRefresh ? formatTime(f.lastRefresh) : '-' }}</span>
        <span class="col-ops file-actions">
          <button
            class="btn-row"
            @click="openModelsModal(f)"
            :disabled="modelsLoading && modelsTargetName === f.name"
          >{{ modelsLoading && modelsTargetName === f.name ? '加载中...' : '模型' }}</button>
          <button
            class="btn-row"
            @click="handleDownload(f)"
            :disabled="downloading.has(f.name)"
          >{{ downloading.has(f.name) ? '下载中...' : '下载' }}</button>
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
          <option :value="MIN_AUTH_FILES_PAGE_SIZE">{{ MIN_AUTH_FILES_PAGE_SIZE }}</option>
          <option :value="DEFAULT_AUTH_FILES_PAGE_SIZE">{{ DEFAULT_AUTH_FILES_PAGE_SIZE }}</option>
          <option :value="MAX_AUTH_FILES_PAGE_SIZE">{{ MAX_AUTH_FILES_PAGE_SIZE }}</option>
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
  </BaseCard>

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

  <div v-if="modelsModalOpen" class="mask">
    <div class="dialog dialog-lg">
      <div class="dialog-header">
        <h3 class="dialog-title">模型列表</h3>
        <div class="dialog-stats">
          <span>文件：{{ modelsTargetName || '-' }}</span>
          <span>数量：{{ modelsList.length }}</span>
        </div>
      </div>
      <div class="dialog-body">
        <div v-if="modelsLoading" class="dialog-message">加载中...</div>
        <div v-else-if="modelsError" class="dialog-message dialog-error">{{ modelsError }}</div>
        <div v-else-if="!modelsList.length" class="dialog-message">暂无模型</div>
        <div v-else class="models-list">
          <div v-for="model in modelsList" :key="model.id" class="models-item">
            <div class="models-name">{{ model.id }}</div>
            <div class="models-meta">
              <span v-if="model.display_name">{{ model.display_name }}</span>
              <span v-if="model.type">{{ model.type }}</span>
              <span v-if="model.owned_by">{{ model.owned_by }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn-ghost" @click="closeModelsModal">关闭</button>
      </div>
    </div>
  </div>

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
.head-actions { display: flex; gap: 8px; }
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
.col-ops { width: 180px; flex-shrink: 0; display: flex; justify-content: flex-end; }
.file-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
.file-name-text {
  font-size: 13px;
  color: var(--zinc-800);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-tag {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 18px;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}
.file-disabled { color: var(--zinc-400); text-decoration: line-through; }
.file-name.file-disabled .file-name-text {
  color: var(--zinc-400);
  text-decoration: line-through;
}
.file-name.file-disabled .file-tag { opacity: 0.6; }
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
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.filter-label {
  font-size: 12px;
  color: var(--zinc-500);
}
.filter-select {
  height: 28px;
  border: 1px solid var(--zinc-200);
  border-radius: 6px;
  background: #fff;
  color: var(--zinc-700);
  font-size: 12px;
  padding: 0 8px;
}
.filter-input {
  height: 28px;
  border: 1px solid var(--zinc-200);
  border-radius: 6px;
  background: #fff;
  color: var(--zinc-700);
  font-size: 12px;
  padding: 0 8px;
  width: 140px;
}
.filter-input:focus {
  outline: none;
  border-color: #6366F1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.10);
}
.btn-refresh { display: inline-flex; align-items: center; gap: 6px; }
.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--zinc-300);
  border-top-color: var(--zinc-600);
  border-radius: 50%;
  animation: btn-spin 0.8s linear infinite;
}
@keyframes btn-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
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
.dialog-lg {
  width: 520px;
}
.dialog-error {
  color: #dc2626;
}
.models-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
  margin-top: 8px;
  border: 1px solid var(--zinc-200);
  border-radius: 8px;
  padding: 8px;
}
.models-item {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--zinc-50);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.models-name {
  font-size: 12px;
  color: var(--zinc-900);
  font-family: monospace;
}
.models-meta {
  font-size: 11px;
  color: var(--zinc-500);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
