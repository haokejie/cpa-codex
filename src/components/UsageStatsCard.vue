<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
} from "chart.js";
import { useCodexStore } from "../stores/codex";
import { formatCompactNumber, formatPerMinuteValue } from "../utils/usage";

const store = useCodexStore();

const sparklineReady = computed(() => !store.usageLoading && store.usageSeries.hasData);

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler);

const requestCanvas = ref<HTMLCanvasElement | null>(null);
const tokenCanvas = ref<HTMLCanvasElement | null>(null);
const rpmCanvas = ref<HTMLCanvasElement | null>(null);
const tpmCanvas = ref<HTMLCanvasElement | null>(null);

let requestChart: Chart | null = null;
let tokenChart: Chart | null = null;
let rpmChart: Chart | null = null;
let tpmChart: Chart | null = null;

function fmt(n: number) {
  return n.toLocaleString();
}

const sparklineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    x: { display: false },
    y: { display: false },
  },
  elements: {
    line: { tension: 0.45 },
    point: { radius: 0 },
  },
};

function buildDataset(series: number[], color: string, fill: string) {
  return {
    data: series,
    borderColor: color,
    backgroundColor: fill,
    fill: true,
    borderWidth: 2,
  };
}

function destroyCharts() {
  requestChart?.destroy();
  tokenChart?.destroy();
  rpmChart?.destroy();
  tpmChart?.destroy();
  requestChart = null;
  tokenChart = null;
  rpmChart = null;
  tpmChart = null;
}

function ensureChart(
  canvas: HTMLCanvasElement | null,
  chart: Chart | null,
  series: number[],
  color: string,
  fill: string,
) {
  if (!canvas) return chart;
  const ctx = canvas.getContext("2d");
  if (!ctx) return chart;
  if (!chart) {
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: store.usageSeries.labels,
        datasets: [buildDataset(series, color, fill)],
      },
      options: sparklineOptions,
    });
  }
  chart.data.labels = store.usageSeries.labels;
  chart.data.datasets[0].data = series;
  chart.data.datasets[0].borderColor = color;
  chart.data.datasets[0].backgroundColor = fill;
  chart.update("none");
  return chart;
}

function syncCharts() {
  if (!sparklineReady.value) {
    destroyCharts();
    return;
  }
  nextTick(() => {
    requestChart = ensureChart(
      requestCanvas.value,
      requestChart,
      store.usageSeries.requests,
      "#4B5563",
      "rgba(75, 85, 99, 0.18)",
    );
    tokenChart = ensureChart(
      tokenCanvas.value,
      tokenChart,
      store.usageSeries.tokens,
      "rgba(99, 102, 241, 1)",
      "rgba(99, 102, 241, 0.18)",
    );
    rpmChart = ensureChart(
      rpmCanvas.value,
      rpmChart,
      store.usageSeries.requests,
      "rgba(22, 163, 74, 1)",
      "rgba(22, 163, 74, 0.18)",
    );
    tpmChart = ensureChart(
      tpmCanvas.value,
      tpmChart,
      store.usageSeries.tokens,
      "rgba(245, 158, 11, 1)",
      "rgba(245, 158, 11, 0.18)",
    );
  });
}

onMounted(syncCharts);
onBeforeUnmount(destroyCharts);
watch(
  () => [sparklineReady.value, store.usageSeries.labels, store.usageSeries.requests, store.usageSeries.tokens],
  syncCharts,
  { deep: true },
);

const totalRequestsText = computed(() => fmt(store.usage.totalRequests));
const totalTokensText = computed(() =>
  store.usageTokens.hasData ? formatCompactNumber(store.usageTokens.totalTokens) : "-",
);
const rpmText = computed(() =>
  store.usageRates.hasData ? formatPerMinuteValue(store.usageRates.rpm) : "-",
);
const tpmText = computed(() =>
  store.usageRates.hasData ? formatPerMinuteValue(store.usageRates.tpm) : "-",
);
const rpmMetaText = computed(() =>
  store.usageRates.hasData ? fmt(store.usageRates.requestCount) : "-",
);
const tpmMetaText = computed(() =>
  store.usageRates.hasData ? formatCompactNumber(store.usageRates.tokenCount) : "-",
);
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div class="head-left">
        <h2 class="card-title">使用统计</h2>
        <p class="card-desc">请求成功率与密钥使用情况</p>
      </div>
      <button class="btn-ghost btn-sm" @click="store.refreshUsage" :disabled="store.usageLoading">
        <span v-if="store.usageLoading" class="btn-spinner" aria-hidden="true"></span>
        {{ store.usageLoading ? '刷新中...' : '刷新' }}
      </button>
    </div>
    <div class="stats-grid">
      <div class="stat-card stat-requests">
        <div class="stat-head">
          <span class="stat-label">总请求</span>
          <span class="stat-value">{{ totalRequestsText }}</span>
        </div>
        <div class="stat-meta">
          <span class="stat-meta-item value-green">成功 {{ fmt(store.usage.successCount) }}</span>
          <span class="stat-meta-item value-red">失败 {{ fmt(store.usage.failCount) }}</span>
        </div>
        <div class="stat-sparkline">
          <canvas v-if="sparklineReady" ref="requestCanvas"></canvas>
          <div v-else class="sparkline-placeholder"></div>
        </div>
      </div>

      <div class="stat-card stat-tokens">
        <div class="stat-head">
          <span class="stat-label">总 Token</span>
          <span class="stat-value">{{ totalTokensText }}</span>
        </div>
        <div class="stat-meta">
          <template v-if="store.usageTokens.hasBreakdown">
            <span class="stat-meta-item">缓存 {{ formatCompactNumber(store.usageTokens.cachedTokens) }}</span>
            <span class="stat-meta-item">推理 {{ formatCompactNumber(store.usageTokens.reasoningTokens) }}</span>
          </template>
          <span v-else class="stat-meta-item stat-muted">-</span>
        </div>
        <div class="stat-sparkline">
          <canvas v-if="sparklineReady" ref="tokenCanvas"></canvas>
          <div v-else class="sparkline-placeholder"></div>
        </div>
      </div>

      <div class="stat-card stat-rpm">
        <div class="stat-head">
          <span class="stat-label">30m RPM</span>
          <span class="stat-value">{{ rpmText }}</span>
        </div>
        <div class="stat-meta">
          <span class="stat-meta-item">窗口请求 {{ rpmMetaText }}</span>
        </div>
        <div class="stat-sparkline">
          <canvas v-if="sparklineReady" ref="rpmCanvas"></canvas>
          <div v-else class="sparkline-placeholder"></div>
        </div>
      </div>

      <div class="stat-card stat-tpm">
        <div class="stat-head">
          <span class="stat-label">30m TPM</span>
          <span class="stat-value">{{ tpmText }}</span>
        </div>
        <div class="stat-meta">
          <span class="stat-meta-item">窗口 Token {{ tpmMetaText }}</span>
        </div>
        <div class="stat-sparkline">
          <canvas v-if="sparklineReady" ref="tpmCanvas"></canvas>
          <div v-else class="sparkline-placeholder"></div>
        </div>
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
}
.card-head { margin-bottom: 20px; }
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.head-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
@keyframes usage-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding-top: 16px;
  border-top: 1px solid var(--zinc-100);
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--zinc-100);
  background: var(--zinc-50);
  min-height: 120px;
}
.stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.stat-label {
  font-size: 12px;
  color: var(--zinc-500);
}
.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--zinc-900);
}
.stat-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--zinc-500);
}
.stat-meta-item {
  white-space: nowrap;
}
.stat-muted { color: var(--zinc-400); }
.stat-sparkline {
  margin-top: auto;
  height: 36px;
}
.stat-sparkline canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.sparkline-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--zinc-100), var(--zinc-50));
}
.value-green { color: var(--green-600); }
.value-red { color: var(--red-600); }

@media (max-width: 560px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
