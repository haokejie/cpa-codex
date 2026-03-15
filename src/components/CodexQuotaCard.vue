<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useAuthFilesStore } from "../stores/authFiles";
import type { AuthFileItem, CodexAuthQuotaState } from "../types";
import { getCodexQuotaByAuthIndex } from "../api/codex";
import { normalizeAuthIndex } from "../utils/usage";
import {
  buildCodexQuotaWindows,
  normalizePlanType,
  parseCodexUsagePayload,
  resolveCodexChatgptAccountId,
  resolveCodexPlanType,
} from "../utils/codexQuota";
import BaseCard from "./BaseCard.vue";

const authFilesStore = useAuthFilesStore();
const quotas = ref<Record<string, CodexAuthQuotaState>>({});
const refreshingAll = ref(false);
const pageSize = ref(6);
const currentPage = ref(1);

onMounted(() => authFilesStore.ensureFiles());

function isCodexFile(file: AuthFileItem) {
  return file.type === "codex" || file.provider === "codex";
}

const codexFiles = computed(() => (authFilesStore.files ?? []).filter(isCodexFile));
const totalPages = computed(() => Math.max(1, Math.ceil(codexFiles.value.length / pageSize.value)));
const pagedFiles = computed(() =>
  codexFiles.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value),
);

watch(
  () => codexFiles.value.length,
  () => {
    if (currentPage.value > totalPages.value && totalPages.value > 0) {
      currentPage.value = totalPages.value;
    }
    if (totalPages.value === 0) currentPage.value = 1;
  },
);
watch(pageSize, () => {
  currentPage.value = 1;
});

function quotaKey(file: AuthFileItem) {
  return file.name;
}

function getQuota(file: AuthFileItem) {
  return quotas.value[quotaKey(file)];
}

function statusLabel(file: AuthFileItem) {
  if (file.disabled) return "已禁用";
  const q = getQuota(file);
  if (!q || q.status === "idle") return "未查询";
  if (q.status === "loading") return "查询中...";
  if (q.status === "error") return "查询失败";
  return "正常";
}

function statusClass(file: AuthFileItem) {
  if (file.disabled) return "status-disabled";
  const q = getQuota(file);
  if (!q || q.status === "idle") return "status-idle";
  if (q.status === "loading") return "status-loading";
  if (q.status === "error") return "status-error";
  return "status-ok";
}

function planLabel(file: AuthFileItem) {
  const q = getQuota(file);
  const fromQuota = normalizePlanType(q?.planType ?? null);
  if (fromQuota) return fromQuota;
  const fromFile = resolveCodexPlanType(file);
  return fromFile ?? "";
}

function remainingPercent(value: number | null) {
  if (value === null || value === undefined) return null;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.min(100, Math.max(0, 100 - clamped));
}

function percentText(value: number | null) {
  const remaining = remainingPercent(value);
  if (remaining === null) return "--";
  return `${Math.round(remaining)}%`;
}

function barWidth(value: number | null) {
  const remaining = remainingPercent(value);
  if (remaining === null) return "0%";
  return `${remaining}%`;
}

async function refreshQuota(file: AuthFileItem) {
  if (file.disabled) return;
  const key = quotaKey(file);
  quotas.value = {
    ...quotas.value,
    [key]: { status: "loading", windows: [] },
  };

  const authIndex = normalizeAuthIndex(file.auth_index ?? file.authIndex);
  if (!authIndex) {
    quotas.value = {
      ...quotas.value,
      [key]: { status: "error", windows: [], error: "缺少 auth_index" },
    };
    return;
  }

  const accountId = resolveCodexChatgptAccountId(file);
  if (!accountId) {
    quotas.value = {
      ...quotas.value,
      [key]: { status: "error", windows: [], error: "缺少 Chatgpt-Account-Id" },
    };
    return;
  }

  try {
    const raw = await getCodexQuotaByAuthIndex(authIndex, accountId);
    const payload = parseCodexUsagePayload(raw);
    if (!payload) {
      throw new Error("额度数据解析失败");
    }
    const windows = buildCodexQuotaWindows(payload);
    const planType = normalizePlanType(payload.plan_type ?? payload.planType) ?? resolveCodexPlanType(file);
    quotas.value = {
      ...quotas.value,
      [key]: { status: "success", windows, planType },
    };
  } catch (e) {
    quotas.value = {
      ...quotas.value,
      [key]: { status: "error", windows: [], error: String(e) },
    };
  }
}

async function refreshAll() {
  refreshingAll.value = true;
  try {
    await authFilesStore.fetchFiles();
    const files = pagedFiles.value;
    await Promise.all(files.map((file) => refreshQuota(file)));
  } finally {
    refreshingAll.value = false;
  }
}

function goPrev() {
  currentPage.value = Math.max(1, currentPage.value - 1);
}

function goNext() {
  currentPage.value = Math.min(totalPages.value, currentPage.value + 1);
}
</script>

<template>
  <BaseCard title="Codex 额度" description="基于认证文件的额度窗口">
    <template #actions>
      <button class="btn-ghost btn-sm" :disabled="refreshingAll" @click="refreshAll">
        {{ refreshingAll ? "刷新中..." : "刷新额度" }}
      </button>
    </template>

    <div v-if="authFilesStore.loading && codexFiles.length === 0" class="empty-state">
      <p class="empty-text">加载中...</p>
    </div>

    <div v-else-if="codexFiles.length === 0" class="empty-state">
      <p class="empty-text">暂无 Codex 认证文件</p>
    </div>

    <div v-else class="quota-list">
      <div v-for="file in pagedFiles" :key="file.name" class="quota-item">
        <div class="quota-header">
          <div class="quota-title">
            <span class="file-name">{{ file.name }}</span>
            <span v-if="planLabel(file)" class="tag tag-plan">{{ planLabel(file) }}</span>
            <span class="tag" :class="statusClass(file)">{{ statusLabel(file) }}</span>
          </div>
          <button class="btn-ghost btn-sm" :disabled="getQuota(file)?.status === 'loading'" @click="refreshQuota(file)">
            {{ getQuota(file)?.status === "loading" ? "查询中..." : "查询" }}
          </button>
        </div>

        <div v-if="getQuota(file)?.status === 'error'" class="quota-error">
          {{ getQuota(file)?.error }}
        </div>

        <div v-else-if="getQuota(file)?.windows?.length" class="quota-windows">
          <div v-for="window in getQuota(file)?.windows" :key="window.id" class="quota-window">
            <div class="window-header">
              <span class="window-label">{{ window.label }}</span>
              <span class="window-percent">{{ percentText(window.usedPercent) }}</span>
              <span class="window-reset">{{ window.resetLabel }}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: barWidth(window.usedPercent) }"></div>
            </div>
          </div>
        </div>

        <div v-else-if="getQuota(file)?.status === 'loading'" class="quota-empty">
          查询中...
        </div>
        <div v-else class="quota-empty">
          尚未查询
        </div>
      </div>
    </div>

    <div v-if="codexFiles.length > pageSize" class="pagination">
      <button class="btn-ghost btn-sm" :disabled="currentPage <= 1" @click="goPrev">上一页</button>
      <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
      <button class="btn-ghost btn-sm" :disabled="currentPage >= totalPages" @click="goNext">下一页</button>
    </div>
  </BaseCard>
</template>

<style scoped>
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }

.quota-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quota-item {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e4e4e7;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quota-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.quota-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.file-name {
  font-size: 14px;
  color: #18181b;
  font-weight: 600;
}

.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f4f4f5;
  color: #71717a;
}

.tag-plan {
  background: #eef2ff;
  color: #4f46e5;
}

.status-idle { background: #f4f4f5; color: #71717a; }
.status-loading { background: #fef9c3; color: #a16207; }
.status-ok { background: #dcfce7; color: #166534; }
.status-error { background: #fee2e2; color: #b91c1c; }
.status-disabled { background: #e4e4e7; color: #71717a; }

.quota-windows {
  display: grid;
  gap: 10px;
}

.quota-window {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.window-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #71717a;
}

.window-label { color: #27272a; font-weight: 500; }
.window-percent { color: #18181b; font-weight: 600; }
.window-reset { color: #a1a1aa; }

.bar-track {
  width: 100%;
  height: 6px;
  background: #f4f4f5;
  border-radius: 999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%);
}

.quota-error {
  font-size: 12px;
  color: #dc2626;
}

.quota-empty {
  font-size: 12px;
  color: #a1a1aa;
}

.empty-state {
  padding: 32px 0;
  text-align: center;
}

.empty-text {
  font-size: 13px;
  color: #a1a1aa;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
}

.page-info {
  font-size: 12px;
  color: #71717a;
}
</style>
