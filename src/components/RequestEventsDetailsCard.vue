<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { listAuthFiles } from "../api/authFiles";
import { useCodexStore } from "../stores/codex";
import type { AuthFileItem } from "../types";
import { collectUsageDetails, extractTotalTokens, normalizeAuthIndex } from "../utils/usage";
import { buildSourceInfoMap, resolveSourceDisplay, type CredentialInfo } from "../utils/sourceResolver";

const store = useCodexStore();
const { configs, usageRaw, usageLoading } = storeToRefs(store);
const authFileMap = ref<Map<string, CredentialInfo>>(new Map());

const ALL_FILTER = "__all__";
const MAX_RENDERED_EVENTS = 500;

onMounted(async () => {
  try {
    const files = await listAuthFiles();
    const map = new Map<string, CredentialInfo>();
    files.forEach((file: AuthFileItem) => {
      const key = normalizeAuthIndex(file.auth_index ?? file.authIndex);
      if (!key) return;
      map.set(key, {
        name: file.name || key,
        type: (file.type || file.provider || "").toString(),
      });
    });
    authFileMap.value = map;
  } catch {
    /* ignore */
  }
});

type RequestEventRow = {
  id: string;
  timestamp: string;
  timestampMs: number;
  timestampLabel: string;
  model: string;
  sourceRaw: string;
  source: string;
  sourceType: string;
  authIndex: string;
  failed: boolean;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const encodeCsv = (value: string | number): string => {
  const text = String(value ?? "");
  const trimmedLeft = text.replace(/^\s+/, "");
  const safeText = trimmedLeft && /^[=+\-@]/.test(trimmedLeft) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const sourceInfoMap = computed(() =>
  buildSourceInfoMap(Array.isArray(configs.value) ? configs.value : []),
);

const rows = computed<RequestEventRow[]>(() => {
  const details = collectUsageDetails(usageRaw.value);
  if (!details.length) return [];

  return details
    .map((detail, index) => {
      const timestamp = detail.timestamp;
      const timestampMs =
        typeof detail.__timestampMs === "number" && detail.__timestampMs > 0
          ? detail.__timestampMs
          : Date.parse(timestamp);
      const date = Number.isNaN(timestampMs) ? null : new Date(timestampMs);
      const sourceRaw = detail.sourceRaw || "-";
      const authIndexRaw = detail.auth_index;
      const authIndex =
        authIndexRaw === null || authIndexRaw === undefined || authIndexRaw === ""
          ? "-"
          : String(authIndexRaw);
      const sourceInfo = resolveSourceDisplay(detail.source, authIndexRaw, sourceInfoMap.value, authFileMap.value);
      const source = sourceInfo.displayName;
      const sourceType = sourceInfo.type;
      const model = String(detail.__modelName ?? "").trim() || "-";
      const inputTokens = Math.max(toNumber(detail.tokens?.input_tokens), 0);
      const outputTokens = Math.max(toNumber(detail.tokens?.output_tokens), 0);
      const reasoningTokens = Math.max(toNumber(detail.tokens?.reasoning_tokens), 0);
      const cachedTokens = Math.max(
        Math.max(toNumber(detail.tokens?.cached_tokens), 0),
        Math.max(toNumber(detail.tokens?.cache_tokens), 0),
      );
      const totalTokens = Math.max(
        toNumber(detail.tokens?.total_tokens),
        extractTotalTokens(detail),
      );

      return {
        id: `${timestamp}-${model}-${sourceRaw}-${authIndex}-${index}`,
        timestamp,
        timestampMs: Number.isNaN(timestampMs) ? 0 : timestampMs,
        timestampLabel: date ? date.toLocaleString() : timestamp || "-",
        model,
        sourceRaw,
        source,
        sourceType,
        authIndex,
        failed: detail.failed === true,
        inputTokens,
        outputTokens,
        reasoningTokens,
        cachedTokens,
        totalTokens,
      };
    })
    .sort((a, b) => b.timestampMs - a.timestampMs);
});

const modelFilter = ref(ALL_FILTER);
const sourceFilter = ref(ALL_FILTER);
const authIndexFilter = ref(ALL_FILTER);

const modelOptions = computed(() => [
  { value: ALL_FILTER, label: "全部模型" },
  ...Array.from(new Set(rows.value.map((row) => row.model))).map((model) => ({
    value: model,
    label: model,
  })),
]);

const sourceOptions = computed(() => [
  { value: ALL_FILTER, label: "全部来源" },
  ...Array.from(new Set(rows.value.map((row) => row.source))).map((source) => ({
    value: source,
    label: source,
  })),
]);

const authIndexOptions = computed(() => [
  { value: ALL_FILTER, label: "全部索引" },
  ...Array.from(new Set(rows.value.map((row) => row.authIndex))).map((authIndex) => ({
    value: authIndex,
    label: authIndex,
  })),
]);

const modelOptionSet = computed(() => new Set(modelOptions.value.map((option) => option.value)));
const sourceOptionSet = computed(() => new Set(sourceOptions.value.map((option) => option.value)));
const authIndexOptionSet = computed(() => new Set(authIndexOptions.value.map((option) => option.value)));

const effectiveModelFilter = computed(() => (modelOptionSet.value.has(modelFilter.value) ? modelFilter.value : ALL_FILTER));
const effectiveSourceFilter = computed(() => (sourceOptionSet.value.has(sourceFilter.value) ? sourceFilter.value : ALL_FILTER));
const effectiveAuthIndexFilter = computed(() =>
  authIndexOptionSet.value.has(authIndexFilter.value) ? authIndexFilter.value : ALL_FILTER,
);

const filteredRows = computed(() =>
  rows.value.filter((row) => {
    const modelMatched = effectiveModelFilter.value === ALL_FILTER || row.model === effectiveModelFilter.value;
    const sourceMatched = effectiveSourceFilter.value === ALL_FILTER || row.source === effectiveSourceFilter.value;
    const authIndexMatched = effectiveAuthIndexFilter.value === ALL_FILTER || row.authIndex === effectiveAuthIndexFilter.value;
    return modelMatched && sourceMatched && authIndexMatched;
  }),
);

const renderedRows = computed(() => filteredRows.value.slice(0, MAX_RENDERED_EVENTS));

const hasActiveFilters = computed(
  () =>
    effectiveModelFilter.value !== ALL_FILTER
    || effectiveSourceFilter.value !== ALL_FILTER
    || effectiveAuthIndexFilter.value !== ALL_FILTER,
);

function clearFilters() {
  modelFilter.value = ALL_FILTER;
  sourceFilter.value = ALL_FILTER;
  authIndexFilter.value = ALL_FILTER;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  if (!filteredRows.value.length) return;
  const csvHeader = [
    "timestamp",
    "model",
    "source",
    "source_raw",
    "auth_index",
    "result",
    "input_tokens",
    "output_tokens",
    "reasoning_tokens",
    "cached_tokens",
    "total_tokens",
  ];
  const csvRows = filteredRows.value.map((row) =>
    [
      row.timestamp,
      row.model,
      row.source,
      row.sourceRaw,
      row.authIndex,
      row.failed ? "failed" : "success",
      row.inputTokens,
      row.outputTokens,
      row.reasoningTokens,
      row.cachedTokens,
      row.totalTokens,
    ]
      .map((value) => encodeCsv(value))
      .join(","),
  );
  const content = [csvHeader.join(","), ...csvRows].join("\n");
  const fileTime = new Date().toISOString().replace(/[:.]/g, "-");
  downloadBlob(`usage-events-${fileTime}.csv`, new Blob([content], { type: "text/csv;charset=utf-8" }));
}

function exportJson() {
  if (!filteredRows.value.length) return;
  const payload = filteredRows.value.map((row) => ({
    timestamp: row.timestamp,
    model: row.model,
    source: row.source,
    source_raw: row.sourceRaw,
    auth_index: row.authIndex,
    failed: row.failed,
    tokens: {
      input_tokens: row.inputTokens,
      output_tokens: row.outputTokens,
      reasoning_tokens: row.reasoningTokens,
      cached_tokens: row.cachedTokens,
      total_tokens: row.totalTokens,
    },
  }));
  const content = JSON.stringify(payload, null, 2);
  const fileTime = new Date().toISOString().replace(/[:.]/g, "-");
  downloadBlob(`usage-events-${fileTime}.json`, new Blob([content], { type: "application/json;charset=utf-8" }));
}

const expandedIds = ref<Set<string>>(new Set());

function toggleRow(id: string) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  expandedIds.value = next;
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">请求事件明细</h2>
        <p class="card-desc">最近请求与 Token 细分</p>
      </div>
      <div class="card-actions">
        <button class="btn-ghost btn-sm" @click="clearFilters" :disabled="!hasActiveFilters">清空筛选</button>
        <button class="btn-ghost btn-sm" @click="exportCsv" :disabled="filteredRows.length === 0">导出 CSV</button>
        <button class="btn-ghost btn-sm" @click="exportJson" :disabled="filteredRows.length === 0">导出 JSON</button>
      </div>
    </div>

    <div class="filters">
      <label class="filter-item">
        <span class="filter-label">模型</span>
        <select v-model="modelFilter" class="filter-select">
          <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label class="filter-item">
        <span class="filter-label">来源</span>
        <select v-model="sourceFilter" class="filter-select">
          <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label class="filter-item">
        <span class="filter-label">索引</span>
        <select v-model="authIndexFilter" class="filter-select">
          <option v-for="opt in authIndexOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
    </div>

    <div v-if="usageLoading && rows.length === 0" class="empty-state keep-height">
      <p class="empty-text">加载中...</p>
    </div>
    <div v-else-if="rows.length === 0" class="empty-state">
      <p class="empty-text">暂无请求事件</p>
    </div>
    <div v-else-if="filteredRows.length === 0" class="empty-state">
      <p class="empty-text">无匹配结果</p>
    </div>
    <template v-else>
      <div class="events-meta">
        <span>共 {{ filteredRows.length }} 条</span>
        <span v-if="filteredRows.length > MAX_RENDERED_EVENTS" class="events-limit">
          已显示 {{ MAX_RENDERED_EVENTS }} 条
        </span>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th class="col-time">时间</th>
              <th class="col-model">模型</th>
              <th class="col-tokens">Token 统计</th>
              <th class="col-result">结果</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in renderedRows" :key="row.id">
              <tr class="row-summary" @click="toggleRow(row.id)">
                <td class="cell-time" :title="row.timestamp">{{ row.timestampLabel }}</td>
                <td class="cell-model">{{ row.model }}</td>
                <td class="cell-tokens">
                  <span class="token-total">总 {{ row.totalTokens.toLocaleString() }}</span>
                </td>
                <td class="cell-result">
                  <span :class="row.failed ? 'stat-failure' : 'stat-success'">
                    {{ row.failed ? "失败" : "成功" }}
                  </span>
                </td>
                <td class="cell-actions">
                  <button class="btn-expand" :class="{ 'is-expanded': expandedIds.has(row.id) }" @click="toggleRow(row.id)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4.5 5.5L7 8L9.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </td>
              </tr>
              <tr v-if="expandedIds.has(row.id)" class="row-detail">
                <td colspan="5">
                  <div class="detail-panel">
                    <div class="detail-section">
                      <div class="detail-section-title">来源信息</div>
                      <div class="detail-source-grid">
                        <div class="detail-field">
                          <span class="detail-label">来源</span>
                          <span class="detail-value" :title="row.source">
                            {{ row.source }}
                            <span v-if="row.sourceType" class="credential-type">{{ row.sourceType }}</span>
                          </span>
                        </div>
                        <div class="detail-field">
                          <span class="detail-label">索引</span>
                          <span class="detail-value">{{ row.authIndex }}</span>
                        </div>
                        <div class="detail-field detail-field-wide">
                          <span class="detail-label">原始来源</span>
                          <span class="detail-value detail-value-mono" :title="row.sourceRaw">{{ row.sourceRaw }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="detail-section">
                      <div class="detail-section-title">Token 明细</div>
                      <div class="token-breakdown">
                        <div class="token-bar-track" v-if="row.totalTokens > 0">
                          <div class="token-bar-seg seg-input" :style="{ width: (row.inputTokens / row.totalTokens * 100) + '%' }"></div>
                          <div class="token-bar-seg seg-output" :style="{ width: (row.outputTokens / row.totalTokens * 100) + '%' }"></div>
                          <div class="token-bar-seg seg-reasoning" :style="{ width: (row.reasoningTokens / row.totalTokens * 100) + '%' }"></div>
                          <div class="token-bar-seg seg-cached" :style="{ width: (row.cachedTokens / row.totalTokens * 100) + '%' }"></div>
                        </div>
                        <div class="token-bar-track token-bar-empty" v-else></div>
                        <div class="token-legend">
                          <div class="token-legend-item">
                            <span class="token-dot dot-input"></span>
                            <span class="token-legend-label">输入</span>
                            <span class="token-legend-value">{{ row.inputTokens.toLocaleString() }}</span>
                          </div>
                          <div class="token-legend-item">
                            <span class="token-dot dot-output"></span>
                            <span class="token-legend-label">输出</span>
                            <span class="token-legend-value">{{ row.outputTokens.toLocaleString() }}</span>
                          </div>
                          <div class="token-legend-item">
                            <span class="token-dot dot-reasoning"></span>
                            <span class="token-legend-label">推理</span>
                            <span class="token-legend-value">{{ row.reasoningTokens.toLocaleString() }}</span>
                          </div>
                          <div class="token-legend-item">
                            <span class="token-dot dot-cached"></span>
                            <span class="token-legend-label">缓存</span>
                            <span class="token-legend-value">{{ row.cachedTokens.toLocaleString() }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
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
  gap: 6px;
  flex-wrap: wrap;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.btn-ghost:hover:not(:disabled) {
  background: var(--zinc-50);
  border-color: var(--zinc-300);
  color: var(--zinc-900);
}

.btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

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

.events-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--zinc-500);
  margin-bottom: 8px;
}

.events-limit {
  color: var(--zinc-400);
}

.table-wrapper {
  overflow-x: hidden;
  max-height: 360px;
  overflow-y: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.table thead th {
  text-align: left;
  color: var(--zinc-500);
  font-weight: 600;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--zinc-100);
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
  white-space: nowrap;
}

.table tbody td {
  padding: 10px 0;
  border-bottom: 1px solid var(--zinc-50);
  color: var(--zinc-700);
  vertical-align: top;
  white-space: normal;
}

.col-time { width: 160px; }
.col-model { width: 160px; }
.col-result { width: 80px; }
.col-actions { width: 40px; }

.cell-time {
  min-width: 140px;
  color: var(--zinc-600);
  white-space: nowrap;
}

.cell-model {
  color: var(--zinc-600);
  white-space: nowrap;
}

.cell-tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: var(--zinc-600);
}

.token-total {
  font-weight: 600;
  color: var(--zinc-900);
}

.token-sub {
  font-size: 11px;
  color: var(--zinc-500);
}

.cell-actions {
  text-align: right;
  width: 40px;
}

.btn-expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--zinc-400);
  border-radius: 6px;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, transform 150ms ease;
}

.btn-expand:hover {
  background: var(--zinc-100);
  color: var(--zinc-700);
}

.btn-expand.is-expanded {
  transform: rotate(180deg);
  color: var(--zinc-600);
}

.cell-result {
  color: var(--zinc-600);
  white-space: nowrap;
}

.row-summary {
  cursor: pointer;
  transition: background 150ms ease;
}

.row-summary:hover {
  background: var(--zinc-50);
}

.row-detail td {
  padding: 0 0 8px 0;
  white-space: normal;
  border-bottom: none;
}

.detail-panel {
  background: var(--zinc-50);
  border: 1px solid var(--zinc-100);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--zinc-400);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}

.detail-source-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-field-wide {
  grid-column: span 2;
}

.detail-label {
  font-size: 11px;
  color: var(--zinc-400);
}

.detail-value {
  color: var(--zinc-700);
  font-size: 12px;
  word-break: break-all;
}

.detail-value-mono {
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 11px;
  color: var(--zinc-500);
}

.credential-type {
  font-size: 10px;
  color: var(--zinc-500);
  background: var(--zinc-200);
  padding: 1px 6px;
  border-radius: 999px;
  text-transform: uppercase;
  margin-left: 4px;
}

.token-breakdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.token-bar-track {
  height: 6px;
  border-radius: 3px;
  background: var(--zinc-200);
  display: flex;
  overflow: hidden;
}

.token-bar-empty {
  opacity: 0.4;
}

.token-bar-seg {
  height: 100%;
  min-width: 1px;
  transition: width 300ms ease;
}

.seg-input { background: #3B82F6; }
.seg-output { background: #10B981; }
.seg-reasoning { background: #F59E0B; }
.seg-cached { background: #8B5CF6; }

.token-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
}

.token-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.token-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-input { background: #3B82F6; }
.dot-output { background: #10B981; }
.dot-reasoning { background: #F59E0B; }
.dot-cached { background: #8B5CF6; }

.token-legend-label {
  font-size: 11px;
  color: var(--zinc-500);
}

.token-legend-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--zinc-700);
}

.stat-success {
  color: var(--green-600);
}

.stat-failure {
  color: var(--red-600);
}
</style>
