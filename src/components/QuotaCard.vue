<script setup lang="ts">
import { computed, onMounted, ref, watch, type ComputedRef } from "vue";
import { useAuthFilesStore } from "../stores/authFiles";
import { useQuotaStore } from "../stores/quota";
import type {
  AuthFileItem,
  QuotaAntigravityState,
  QuotaClaudeState,
  QuotaCodexState,
  QuotaGeminiCliState,
  QuotaKimiState,
} from "../types";
import {
  isAntigravityFile,
  isClaudeFile,
  isCodexFile,
  isDisabledAuthFile,
  isGeminiCliFile,
  isKimiFile,
  isRuntimeOnlyAuthFile,
} from "../utils/quota";
import BaseCard from "./BaseCard.vue";

const authFilesStore = useAuthFilesStore();
const quotaStore = useQuotaStore();

const resettingCache = ref(false);
const sanitizerError = computed(() => authFilesStore.sanitizeErrors?.[0] || "");

const files = computed(() => (authFilesStore.files ?? []).filter((file): file is AuthFileItem => Boolean(file && file.name)));
const claudeFiles = computed(() => files.value.filter((f) => isClaudeFile(f) && !isRuntimeOnlyAuthFile(f) && !isDisabledAuthFile(f)));
const antigravityFiles = computed(() => files.value.filter((f) => isAntigravityFile(f) && !isRuntimeOnlyAuthFile(f) && !isDisabledAuthFile(f)));
const codexFiles = computed(() => files.value.filter((f) => isCodexFile(f) && !isRuntimeOnlyAuthFile(f) && !isDisabledAuthFile(f)));
const geminiFiles = computed(() => files.value.filter((f) => isGeminiCliFile(f) && !isRuntimeOnlyAuthFile(f) && !isDisabledAuthFile(f)));
const kimiFiles = computed(() => files.value.filter((f) => isKimiFile(f) && !isRuntimeOnlyAuthFile(f) && !isDisabledAuthFile(f)));

const QUOTA_PAGE_SIZE = 6;

const usePagination = (items: ComputedRef<AuthFileItem[]>) => {
  const currentPage = ref(1);
  const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / QUOTA_PAGE_SIZE)));
  const pagedItems = computed(() =>
    items.value.slice((currentPage.value - 1) * QUOTA_PAGE_SIZE, currentPage.value * QUOTA_PAGE_SIZE),
  );
  const hasPagination = computed(() => items.value.length > QUOTA_PAGE_SIZE);
  const goPrev = () => {
    if (currentPage.value > 1) currentPage.value -= 1;
  };
  const goNext = () => {
    if (currentPage.value < totalPages.value) currentPage.value += 1;
  };

  const clampPage = () => {
    if (currentPage.value < 1) currentPage.value = 1;
    if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
  };

  return { currentPage, totalPages, pagedItems, hasPagination, goPrev, goNext, clampPage };
};

const {
  currentPage: claudePage,
  totalPages: claudeTotalPages,
  pagedItems: claudePagedItems,
  hasPagination: claudeHasPagination,
  goPrev: claudePrev,
  goNext: claudeNext,
  clampPage: claudeClamp,
} = usePagination(claudeFiles);
const {
  currentPage: antigravityPage,
  totalPages: antigravityTotalPages,
  pagedItems: antigravityPagedItems,
  hasPagination: antigravityHasPagination,
  goPrev: antigravityPrev,
  goNext: antigravityNext,
  clampPage: antigravityClamp,
} = usePagination(antigravityFiles);
const {
  currentPage: codexPage,
  totalPages: codexTotalPages,
  pagedItems: codexPagedItems,
  hasPagination: codexHasPagination,
  goPrev: codexPrev,
  goNext: codexNext,
  clampPage: codexClamp,
} = usePagination(codexFiles);
const {
  currentPage: geminiPage,
  totalPages: geminiTotalPages,
  pagedItems: geminiPagedItems,
  hasPagination: geminiHasPagination,
  goPrev: geminiPrev,
  goNext: geminiNext,
  clampPage: geminiClamp,
} = usePagination(geminiFiles);
const {
  currentPage: kimiPage,
  totalPages: kimiTotalPages,
  pagedItems: kimiPagedItems,
  hasPagination: kimiHasPagination,
  goPrev: kimiPrev,
  goNext: kimiNext,
  clampPage: kimiClamp,
} = usePagination(kimiFiles);

const statusLabel = (status?: string) => {
  if (status === "loading") return "加载中";
  if (status === "success") return "已更新";
  if (status === "error") return "异常";
  return "待刷新";
};

const clampPercent = (value: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
};

const remainingFromUsed = (used: number | null) => {
  if (used === null || used === undefined) return null;
  return clampPercent(100 - used);
};

const remainingFromFraction = (fraction: number | null) => {
  if (fraction === null || fraction === undefined) return null;
  return clampPercent(fraction * 100);
};

const remainingFromLimit = (used: number, limit: number) => {
  if (!limit || limit <= 0) return used > 0 ? 0 : null;
  return clampPercent(((limit - used) / limit) * 100);
};

const formatPercent = (value: number | null) => (value === null ? "--" : `${Math.round(value)}%`);

const progressStyle = (value: number | null) => {
  if (value === null) return { width: "0%", background: "#e5e7eb" };
  if (value >= 60) return { width: `${value}%`, background: "#16a34a" };
  if (value >= 20) return { width: `${value}%`, background: "#ca8a04" };
  return { width: `${value}%`, background: "#dc2626" };
};

const renderError = (quota: { error?: string; errorStatus?: number }) => {
  if (!quota.error) return "";
  if (quota.errorStatus) return `${quota.error} (HTTP ${quota.errorStatus})`;
  return quota.error;
};

const resetAuthCache = async () => {
  if (resettingCache.value) return;
  resettingCache.value = true;
  try {
    await authFilesStore.resetCache();
  } finally {
    resettingCache.value = false;
  }
};

const refreshSection = async (type: "claude" | "antigravity" | "codex" | "gemini" | "kimi") => {
  if (authFilesStore.loading) return;
  await authFilesStore.fetchFiles();
  if (type === "claude") return quotaStore.refreshClaude(claudePagedItems.value);
  if (type === "antigravity") return quotaStore.refreshAntigravity(antigravityPagedItems.value);
  if (type === "codex") return quotaStore.refreshCodex(codexPagedItems.value);
  if (type === "gemini") return quotaStore.refreshGeminiCli(geminiPagedItems.value);
  return quotaStore.refreshKimi(kimiPagedItems.value);
};

const getQuota = <T>(map: Record<string, T>, file: AuthFileItem): T | undefined => map[file.name];

onMounted(() => {
  authFilesStore.fetchFiles();
});

const syncPagination = () => {
  claudeClamp();
  antigravityClamp();
  codexClamp();
  geminiClamp();
  kimiClamp();
};

watch([claudeFiles, antigravityFiles, codexFiles, geminiFiles, kimiFiles], syncPagination);
</script>

<template>
  <div class="quota-wrap">
    <BaseCard title="配额管理" description="查看各 OAuth 渠道的配额状态" headerGap="sm">
      <template #actions>
        <button class="btn-ghost btn-sm" @click="resetAuthCache" :disabled="resettingCache || authFilesStore.loading">
          {{ resettingCache ? "清理中..." : "清理认证缓存" }}
        </button>
      </template>
      <div v-if="authFilesStore.error" class="error-banner">
        <span class="error-text">{{ authFilesStore.error }}</span>
        <button class="btn-ghost btn-sm" @click="authFilesStore.fetchFiles">重试</button>
      </div>
      <div v-else-if="sanitizerError" class="error-banner">
        <span class="error-text">{{ sanitizerError }}</span>
        <button class="btn-ghost btn-sm" @click="resetAuthCache">再次清理</button>
      </div>
    </BaseCard>

    <BaseCard title="Anthropic / Claude" description="Anthropic OAuth 额度窗口" headerGap="sm">
      <template #actions>
        <button class="btn-ghost btn-sm" @click="refreshSection('claude')" :disabled="quotaStore.claudeLoading">
          {{ quotaStore.claudeLoading ? "刷新中..." : "刷新" }}
        </button>
      </template>

      <div v-if="authFilesStore.loading" class="quota-message">加载中...</div>
      <div v-else-if="!claudeFiles.length" class="quota-message">暂无 Claude 认证文件</div>
      <div v-else class="quota-list">
        <div v-for="file in claudePagedItems" :key="file.name" class="quota-item">
          <div class="quota-item-header">
            <span class="quota-file">{{ file.name }}</span>
            <span class="quota-status" :class="`status-${getQuota(quotaStore.claudeQuota, file)?.status || 'idle'}`">
              {{ statusLabel(getQuota(quotaStore.claudeQuota, file)?.status) }}
            </span>
          </div>
          <div v-if="getQuota(quotaStore.claudeQuota, file)?.status === 'loading'" class="quota-message">加载中...</div>
          <div v-else-if="getQuota(quotaStore.claudeQuota, file)?.status === 'error'" class="quota-message error">
            {{ renderError(getQuota(quotaStore.claudeQuota, file) as QuotaClaudeState) }}
          </div>
          <div v-else class="quota-rows">
            <div v-if="(getQuota(quotaStore.claudeQuota, file) as QuotaClaudeState | undefined)?.extraUsage?.is_enabled" class="quota-extra">
              额外额度：$
              {{ (((getQuota(quotaStore.claudeQuota, file) as QuotaClaudeState).extraUsage?.used_credits || 0) / 100).toFixed(2) }}
              / $
              {{ (((getQuota(quotaStore.claudeQuota, file) as QuotaClaudeState).extraUsage?.monthly_limit || 0) / 100).toFixed(2) }}
            </div>
            <div
              v-for="window in (getQuota(quotaStore.claudeQuota, file) as QuotaClaudeState | undefined)?.windows || []"
              :key="window.id"
              class="quota-row"
            >
              <div class="quota-row-header">
                <span class="quota-label">{{ window.label }}</span>
                <div class="quota-meta">
                  <span class="quota-percent">{{ formatPercent(remainingFromUsed(window.usedPercent)) }}</span>
                  <span class="quota-reset">{{ window.resetLabel }}</span>
                </div>
              </div>
              <div class="quota-bar">
                <div class="quota-bar-fill" :style="progressStyle(remainingFromUsed(window.usedPercent))"></div>
              </div>
            </div>
            <div v-if="!(getQuota(quotaStore.claudeQuota, file) as QuotaClaudeState | undefined)?.windows?.length" class="quota-message">暂无额度窗口</div>
          </div>
        </div>
      </div>
      <div v-if="claudeHasPagination" class="pagination">
        <span class="page-info">共 {{ claudeFiles.length }} 条 · 第 {{ claudePage }} / {{ claudeTotalPages }} 页</span>
        <div class="page-actions">
          <button class="btn-ghost btn-sm" :disabled="claudePage <= 1" @click="claudePrev">上一页</button>
          <button class="btn-ghost btn-sm" :disabled="claudePage >= claudeTotalPages" @click="claudeNext">下一页</button>
        </div>
      </div>
    </BaseCard>

    <BaseCard title="Antigravity" description="Antigravity 额度信息" headerGap="sm">
      <template #actions>
        <button class="btn-ghost btn-sm" @click="refreshSection('antigravity')" :disabled="quotaStore.antigravityLoading">
          {{ quotaStore.antigravityLoading ? "刷新中..." : "刷新" }}
        </button>
      </template>

      <div v-if="authFilesStore.loading" class="quota-message">加载中...</div>
      <div v-else-if="!antigravityFiles.length" class="quota-message">暂无 Antigravity 认证文件</div>
      <div v-else class="quota-list">
        <div v-for="file in antigravityPagedItems" :key="file.name" class="quota-item">
          <div class="quota-item-header">
            <span class="quota-file">{{ file.name }}</span>
            <span class="quota-status" :class="`status-${getQuota(quotaStore.antigravityQuota, file)?.status || 'idle'}`">
              {{ statusLabel(getQuota(quotaStore.antigravityQuota, file)?.status) }}
            </span>
          </div>
          <div v-if="getQuota(quotaStore.antigravityQuota, file)?.status === 'loading'" class="quota-message">加载中...</div>
          <div v-else-if="getQuota(quotaStore.antigravityQuota, file)?.status === 'error'" class="quota-message error">
            {{ renderError(getQuota(quotaStore.antigravityQuota, file) as QuotaAntigravityState) }}
          </div>
          <div v-else class="quota-rows">
            <div
              v-for="group in (getQuota(quotaStore.antigravityQuota, file) as QuotaAntigravityState | undefined)?.groups || []"
              :key="group.id"
              class="quota-row"
            >
              <div class="quota-row-header">
                <span class="quota-label">{{ group.label }}</span>
                <div class="quota-meta">
                  <span class="quota-percent">{{ formatPercent(remainingFromFraction(group.remainingFraction)) }}</span>
                  <span class="quota-reset">{{ group.resetTime || '-' }}</span>
                </div>
              </div>
              <div class="quota-bar">
                <div class="quota-bar-fill" :style="progressStyle(remainingFromFraction(group.remainingFraction))"></div>
              </div>
            </div>
            <div v-if="!(getQuota(quotaStore.antigravityQuota, file) as QuotaAntigravityState | undefined)?.groups?.length" class="quota-message">暂无额度数据</div>
          </div>
        </div>
      </div>
      <div v-if="antigravityHasPagination" class="pagination">
        <span class="page-info">共 {{ antigravityFiles.length }} 条 · 第 {{ antigravityPage }} / {{ antigravityTotalPages }} 页</span>
        <div class="page-actions">
          <button class="btn-ghost btn-sm" :disabled="antigravityPage <= 1" @click="antigravityPrev">上一页</button>
          <button class="btn-ghost btn-sm" :disabled="antigravityPage >= antigravityTotalPages" @click="antigravityNext">下一页</button>
        </div>
      </div>
    </BaseCard>

    <BaseCard title="Codex" description="Codex OAuth 额度窗口" headerGap="sm">
      <template #actions>
        <button class="btn-ghost btn-sm" @click="refreshSection('codex')" :disabled="quotaStore.codexLoading">
          {{ quotaStore.codexLoading ? "刷新中..." : "刷新" }}
        </button>
      </template>

      <div v-if="authFilesStore.loading" class="quota-message">加载中...</div>
      <div v-else-if="!codexFiles.length" class="quota-message">暂无 Codex 认证文件</div>
      <div v-else class="quota-list">
        <div v-for="file in codexPagedItems" :key="file.name" class="quota-item">
          <div class="quota-item-header">
            <div class="quota-file">
              <span>{{ file.name }}</span>
              <span v-if="(getQuota(quotaStore.codexQuota, file) as QuotaCodexState | undefined)?.planType" class="quota-plan">
                {{ (getQuota(quotaStore.codexQuota, file) as QuotaCodexState).planType }}
              </span>
            </div>
            <span class="quota-status" :class="`status-${getQuota(quotaStore.codexQuota, file)?.status || 'idle'}`">
              {{ statusLabel(getQuota(quotaStore.codexQuota, file)?.status) }}
            </span>
          </div>
          <div v-if="getQuota(quotaStore.codexQuota, file)?.status === 'loading'" class="quota-message">加载中...</div>
          <div v-else-if="getQuota(quotaStore.codexQuota, file)?.status === 'error'" class="quota-message error">
            {{ renderError(getQuota(quotaStore.codexQuota, file) as QuotaCodexState) }}
          </div>
          <div v-else class="quota-rows">
            <div
              v-for="window in (getQuota(quotaStore.codexQuota, file) as QuotaCodexState | undefined)?.windows || []"
              :key="window.id"
              class="quota-row"
            >
              <div class="quota-row-header">
                <span class="quota-label">{{ window.label }}</span>
                <div class="quota-meta">
                  <span class="quota-percent">{{ formatPercent(remainingFromUsed(window.usedPercent)) }}</span>
                  <span class="quota-reset">{{ window.resetLabel }}</span>
                </div>
              </div>
              <div class="quota-bar">
                <div class="quota-bar-fill" :style="progressStyle(remainingFromUsed(window.usedPercent))"></div>
              </div>
            </div>
            <div v-if="!(getQuota(quotaStore.codexQuota, file) as QuotaCodexState | undefined)?.windows?.length" class="quota-message">暂无额度窗口</div>
          </div>
        </div>
      </div>
      <div v-if="codexHasPagination" class="pagination">
        <span class="page-info">共 {{ codexFiles.length }} 条 · 第 {{ codexPage }} / {{ codexTotalPages }} 页</span>
        <div class="page-actions">
          <button class="btn-ghost btn-sm" :disabled="codexPage <= 1" @click="codexPrev">上一页</button>
          <button class="btn-ghost btn-sm" :disabled="codexPage >= codexTotalPages" @click="codexNext">下一页</button>
        </div>
      </div>
    </BaseCard>

    <BaseCard title="Gemini CLI" description="Gemini CLI 额度桶" headerGap="sm">
      <template #actions>
        <button class="btn-ghost btn-sm" @click="refreshSection('gemini')" :disabled="quotaStore.geminiCliLoading">
          {{ quotaStore.geminiCliLoading ? "刷新中..." : "刷新" }}
        </button>
      </template>

      <div v-if="authFilesStore.loading" class="quota-message">加载中...</div>
      <div v-else-if="!geminiFiles.length" class="quota-message">暂无 Gemini CLI 认证文件</div>
      <div v-else class="quota-list">
        <div v-for="file in geminiPagedItems" :key="file.name" class="quota-item">
          <div class="quota-item-header">
            <span class="quota-file">{{ file.name }}</span>
            <span class="quota-status" :class="`status-${getQuota(quotaStore.geminiCliQuota, file)?.status || 'idle'}`">
              {{ statusLabel(getQuota(quotaStore.geminiCliQuota, file)?.status) }}
            </span>
          </div>
          <div v-if="getQuota(quotaStore.geminiCliQuota, file)?.status === 'loading'" class="quota-message">加载中...</div>
          <div v-else-if="getQuota(quotaStore.geminiCliQuota, file)?.status === 'error'" class="quota-message error">
            {{ renderError(getQuota(quotaStore.geminiCliQuota, file) as QuotaGeminiCliState) }}
          </div>
          <div v-else class="quota-rows">
            <div
              v-for="bucket in (getQuota(quotaStore.geminiCliQuota, file) as QuotaGeminiCliState | undefined)?.buckets || []"
              :key="bucket.id"
              class="quota-row"
            >
              <div class="quota-row-header">
                <div class="quota-label">
                  <span>{{ bucket.label }}</span>
                  <span v-if="bucket.tokenType" class="quota-tag">{{ bucket.tokenType }}</span>
                </div>
                <div class="quota-meta">
                  <span class="quota-percent">{{ formatPercent(remainingFromFraction(bucket.remainingFraction)) }}</span>
                  <span class="quota-reset">{{ bucket.resetTime || '-' }}</span>
                </div>
              </div>
              <div class="quota-bar">
                <div class="quota-bar-fill" :style="progressStyle(remainingFromFraction(bucket.remainingFraction))"></div>
              </div>
              <div v-if="bucket.remainingAmount !== null && bucket.remainingAmount !== undefined" class="quota-amount">
                剩余量：{{ bucket.remainingAmount }}
              </div>
            </div>
            <div v-if="!(getQuota(quotaStore.geminiCliQuota, file) as QuotaGeminiCliState | undefined)?.buckets?.length" class="quota-message">暂无额度桶</div>
          </div>
        </div>
      </div>
      <div v-if="geminiHasPagination" class="pagination">
        <span class="page-info">共 {{ geminiFiles.length }} 条 · 第 {{ geminiPage }} / {{ geminiTotalPages }} 页</span>
        <div class="page-actions">
          <button class="btn-ghost btn-sm" :disabled="geminiPage <= 1" @click="geminiPrev">上一页</button>
          <button class="btn-ghost btn-sm" :disabled="geminiPage >= geminiTotalPages" @click="geminiNext">下一页</button>
        </div>
      </div>
    </BaseCard>

    <BaseCard title="Kimi" description="Kimi 额度信息" headerGap="sm">
      <template #actions>
        <button class="btn-ghost btn-sm" @click="refreshSection('kimi')" :disabled="quotaStore.kimiLoading">
          {{ quotaStore.kimiLoading ? "刷新中..." : "刷新" }}
        </button>
      </template>

      <div v-if="authFilesStore.loading" class="quota-message">加载中...</div>
      <div v-else-if="!kimiFiles.length" class="quota-message">暂无 Kimi 认证文件</div>
      <div v-else class="quota-list">
        <div v-for="file in kimiPagedItems" :key="file.name" class="quota-item">
          <div class="quota-item-header">
            <span class="quota-file">{{ file.name }}</span>
            <span class="quota-status" :class="`status-${getQuota(quotaStore.kimiQuota, file)?.status || 'idle'}`">
              {{ statusLabel(getQuota(quotaStore.kimiQuota, file)?.status) }}
            </span>
          </div>
          <div v-if="getQuota(quotaStore.kimiQuota, file)?.status === 'loading'" class="quota-message">加载中...</div>
          <div v-else-if="getQuota(quotaStore.kimiQuota, file)?.status === 'error'" class="quota-message error">
            {{ renderError(getQuota(quotaStore.kimiQuota, file) as QuotaKimiState) }}
          </div>
          <div v-else class="quota-rows">
            <div
              v-for="row in (getQuota(quotaStore.kimiQuota, file) as QuotaKimiState | undefined)?.rows || []"
              :key="row.id"
              class="quota-row"
            >
              <div class="quota-row-header">
                <span class="quota-label">{{ row.label || row.id }}</span>
                <div class="quota-meta">
                  <span class="quota-percent">{{ formatPercent(remainingFromLimit(row.used, row.limit)) }}</span>
                  <span class="quota-reset">{{ row.resetHint || '-' }}</span>
                </div>
              </div>
              <div class="quota-bar">
                <div class="quota-bar-fill" :style="progressStyle(remainingFromLimit(row.used, row.limit))"></div>
              </div>
            </div>
            <div v-if="!(getQuota(quotaStore.kimiQuota, file) as QuotaKimiState | undefined)?.rows?.length" class="quota-message">暂无额度数据</div>
          </div>
        </div>
      </div>
      <div v-if="kimiHasPagination" class="pagination">
        <span class="page-info">共 {{ kimiFiles.length }} 条 · 第 {{ kimiPage }} / {{ kimiTotalPages }} 页</span>
        <div class="page-actions">
          <button class="btn-ghost btn-sm" :disabled="kimiPage <= 1" @click="kimiPrev">上一页</button>
          <button class="btn-ghost btn-sm" :disabled="kimiPage >= kimiTotalPages" @click="kimiNext">下一页</button>
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.quota-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fef2f2;
  border-radius: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: #dc2626;
}

.error-text {
  flex: 1;
}

.quota-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pagination {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--zinc-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-info {
  font-size: 12px;
  color: var(--zinc-500);
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.quota-item {
  border: 1px solid var(--zinc-200);
  border-radius: 12px;
  padding: 12px 14px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quota-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.quota-file {
  font-size: 13px;
  color: var(--zinc-800);
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.quota-plan {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: #f3f4f6;
  color: #4b5563;
}

.quota-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--zinc-100);
  color: var(--zinc-500);
}

.status-loading {
  background: #fefce8;
  color: #ca8a04;
}

.status-success {
  background: #f0fdf4;
  color: #16a34a;
}

.status-error {
  background: #fef2f2;
  color: #dc2626;
}

.status-idle {
  background: #f3f4f6;
  color: #9ca3af;
}

.quota-message {
  font-size: 12px;
  color: var(--zinc-500);
}

.quota-message.error {
  color: #dc2626;
}

.quota-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quota-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quota-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.quota-label {
  font-size: 12px;
  color: var(--zinc-700);
  display: flex;
  align-items: center;
  gap: 6px;
}

.quota-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--zinc-500);
}

.quota-percent {
  font-weight: 600;
}

.quota-bar {
  height: 6px;
  background: var(--zinc-100);
  border-radius: 999px;
  overflow: hidden;
}

.quota-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 200ms ease;
}

.quota-extra {
  font-size: 12px;
  color: var(--zinc-500);
}

.quota-tag {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #4338ca;
}

.quota-amount {
  font-size: 11px;
  color: var(--zinc-500);
}

.btn-ghost {
  background: none;
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  color: var(--zinc-600);
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.btn-ghost:hover {
  background: var(--zinc-50);
  border-color: var(--zinc-300);
  color: var(--zinc-900);
}

.btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}
</style>
