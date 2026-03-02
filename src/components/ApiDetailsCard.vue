<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useCodexStore } from "../stores/codex";
import { buildApiStats, formatCompactNumber } from "../utils/usage";
import type { UsageTimeRange } from "../utils/usage";
import type { ApiStats } from "../types";

const store = useCodexStore();
const { usageRaw, usageLoading } = storeToRefs(store);

type ApiSortKey = "endpoint" | "requests" | "tokens";

type SortDir = "asc" | "desc";

const expandedApis = ref<Set<string>>(new Set());
const sortKey = ref<ApiSortKey>("requests");
const sortDir = ref<SortDir>("desc");

const range = ref<UsageTimeRange>("all");

const rows = computed<ApiStats[]>(() => buildApiStats(usageRaw.value, range.value));

const sorted = computed(() => {
  const list = [...rows.value];
  const dir = sortDir.value === "asc" ? 1 : -1;
  list.sort((a, b) => {
    switch (sortKey.value) {
      case "endpoint":
        return dir * a.endpoint.localeCompare(b.endpoint);
      case "requests":
        return dir * (a.totalRequests - b.totalRequests);
      case "tokens":
        return dir * (a.totalTokens - b.totalTokens);
      default:
        return 0;
    }
  });
  return list;
});

function toggleExpand(endpoint: string) {
  const next = new Set(expandedApis.value);
  if (next.has(endpoint)) {
    next.delete(endpoint);
  } else {
    next.add(endpoint);
  }
  expandedApis.value = next;
}

function handleSort(key: ApiSortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = key === "endpoint" ? "asc" : "desc";
  }
}

const arrow = (key: ApiSortKey) => {
  if (sortKey.value !== key) return "";
  return sortDir.value === "asc" ? " ▲" : " ▼";
};

const modelRows = (api: ApiStats) =>
  Object.entries(api.models).sort((a, b) => b[1].requests - a[1].requests);

function handleRefresh() {
  if (usageLoading.value) return;
  store.refreshUsage();
}

onMounted(() => {
  if (usageLoading.value) return;
  store.refreshUsage();
});
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">API 详细统计</h2>
        <p class="card-desc">按 API 端点汇总请求与 Token</p>
      </div>
      <div class="card-actions">
        <div class="range-switch">
          <button
            type="button"
            class="range-btn"
            :class="{ 'range-btn-active': range === 'all' }"
            @click="range = 'all'"
          >全部</button>
          <button
            type="button"
            class="range-btn"
            :class="{ 'range-btn-active': range === '24h' }"
            @click="range = '24h'"
          >近24小时</button>
          <button
            type="button"
            class="range-btn"
            :class="{ 'range-btn-active': range === 'today' }"
            @click="range = 'today'"
          >今日</button>
        </div>
      </div>
    </div>

    <div v-if="usageLoading && sorted.length === 0" class="empty-state keep-height">
      <p class="empty-text">加载中...</p>
    </div>

    <div v-else-if="sorted.length === 0" class="empty-state">
      <p class="empty-text">暂无数据</p>
    </div>

    <template v-else>
      <div class="api-sort-bar">
        <button
          type="button"
          class="api-sort-btn"
          :class="{ 'api-sort-btn-active': sortKey === 'endpoint' }"
          @click="handleSort('endpoint')"
        >
          端点{{ arrow('endpoint') }}
        </button>
        <button
          type="button"
          class="api-sort-btn"
          :class="{ 'api-sort-btn-active': sortKey === 'requests' }"
          @click="handleSort('requests')"
        >
          请求数{{ arrow('requests') }}
        </button>
        <button
          type="button"
          class="api-sort-btn"
          :class="{ 'api-sort-btn-active': sortKey === 'tokens' }"
          @click="handleSort('tokens')"
        >
          Token 数{{ arrow('tokens') }}
        </button>
        <button
          type="button"
          class="btn-ghost btn-sm api-refresh-btn"
          :disabled="usageLoading"
          @click="handleRefresh"
        >
          <span v-if="usageLoading" class="btn-spinner" aria-hidden="true"></span>
          {{ usageLoading ? '刷新中...' : '刷新' }}
        </button>
      </div>

      <div class="details-scroll">
        <div class="api-list">
          <div v-for="api in sorted" :key="api.endpoint" class="api-item">
            <button
              type="button"
              class="api-header"
              :aria-expanded="expandedApis.has(api.endpoint)"
              @click="toggleExpand(api.endpoint)"
            >
              <div class="api-info">
                <span class="api-endpoint">{{ api.endpoint }}</span>
                <div class="api-stats">
                  <span class="api-badge">
                    请求数: {{ api.totalRequests.toLocaleString() }}
                    <span class="request-breakdown">
                      (<span class="stat-success">{{ api.successCount.toLocaleString() }}</span>
                      <span class="stat-failure">{{ api.failureCount.toLocaleString() }}</span>)
                    </span>
                  </span>
                  <span class="api-badge">Token: {{ formatCompactNumber(api.totalTokens) }}</span>
                </div>
              </div>
              <span class="expand-icon">
                {{ expandedApis.has(api.endpoint) ? '▼' : '▶' }}
              </span>
            </button>

            <div v-if="expandedApis.has(api.endpoint)" class="api-models">
              <div v-if="modelRows(api).length === 0" class="empty-models">
                无模型明细
              </div>
              <div v-else class="model-list">
                <div v-for="[model, stats] in modelRows(api)" :key="model" class="model-row">
                  <span class="model-name">{{ model }}</span>
                  <span class="model-stat">
                    <span class="request-count-cell">
                      <span>{{ stats.requests.toLocaleString() }}</span>
                      <span class="request-breakdown">
                        (<span class="stat-success">{{ stats.successCount.toLocaleString() }}</span>
                        <span class="stat-failure">{{ stats.failureCount.toLocaleString() }}</span>)
                      </span>
                    </span>
                  </span>
                  <span class="model-stat">{{ formatCompactNumber(stats.tokens) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.card {
  background: #fff;
  border: 1px solid var(--zinc-200);
  border-radius: 12px;
  padding: 20px 24px;
}

.card-head {
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--zinc-900);
  margin-bottom: 4px;
}

.card-desc {
  font-size: 12px;
  color: var(--zinc-500);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

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
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--zinc-300);
  border-top-color: var(--zinc-600);
  border-radius: 50%;
  animation: usage-spin 0.8s linear infinite;
}

.api-refresh-btn {
  margin-left: auto;
}

@keyframes usage-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.range-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px;
  background: var(--zinc-100);
  border: 1px solid var(--zinc-200);
  border-radius: 999px;
}

.range-btn {
  height: 24px;
  padding: 0 10px;
  background: transparent;
  border: none;
  border-radius: 999px;
  font-size: 11px;
  color: var(--zinc-600);
  cursor: pointer;
  font-family: inherit;
  transition: background 150ms ease, color 150ms ease;
}

.range-btn:hover {
  color: var(--zinc-900);
}

.range-btn-active {
  background: #ffffff;
  color: var(--zinc-900);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.empty-state {
  padding: 16px 0;
  text-align: center;
}

.keep-height {
  min-height: 120px;
}

.empty-text {
  font-size: 13px;
  color: var(--zinc-500);
}

.api-sort-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.api-sort-btn {
  height: 28px;
  padding: 0 10px;
  background: transparent;
  color: var(--zinc-600);
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.api-sort-btn:hover {
  background: var(--zinc-50);
  border-color: var(--zinc-300);
  color: var(--zinc-900);
}

.api-sort-btn-active {
  background: var(--zinc-100);
  border-color: var(--zinc-300);
  color: var(--zinc-900);
}

.details-scroll {
  max-height: 420px;
  overflow-y: auto;
}

.api-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.api-item {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.api-header {
  width: 100%;
  border: none;
  background: var(--zinc-50);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
}

.api-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.api-endpoint {
  font-size: 12px;
  color: var(--zinc-800);
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  word-break: break-all;
}

.api-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.api-badge {
  font-size: 11px;
  color: var(--zinc-600);
  background: #fff;
  border: 1px solid var(--zinc-200);
  border-radius: 999px;
  padding: 2px 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.request-breakdown {
  color: var(--zinc-400);
  margin-left: 4px;
}

.expand-icon {
  color: var(--zinc-500);
  font-size: 12px;
}

.api-models {
  border-top: 1px solid var(--zinc-100);
  padding: 10px 12px;
  background: #fff;
}

.empty-models {
  font-size: 12px;
  color: var(--zinc-500);
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.model-row {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.6fr;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--zinc-700);
}

.model-name {
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  color: var(--zinc-700);
}

.model-stat {
  color: var(--zinc-600);
}

.request-count-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.stat-success {
  color: var(--green-600);
}

.stat-failure {
  color: var(--red-600);
}
</style>
