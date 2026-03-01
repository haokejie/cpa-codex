<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useCodexStore } from "../stores/codex";

const store = useCodexStore();
const activeTooltip = ref<number | null>(null);
const gridRef = ref<HTMLElement | null>(null);
const scrollerRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);

const healthData = computed(() => store.serviceHealth);
const hasData = computed(() => healthData.value.totalSuccess + healthData.value.totalFailure > 0);

const rateClass = computed(() => {
  if (!hasData.value) return "";
  if (healthData.value.successRate >= 90) return "health-rate-high";
  if (healthData.value.successRate >= 50) return "health-rate-medium";
  return "health-rate-low";
});

const COLOR_STOPS = [
  { r: 239, g: 68, b: 68 },
  { r: 250, g: 204, b: 21 },
  { r: 34, g: 197, b: 94 },
] as const;

function rateToColor(rate: number): string {
  const t = Math.max(0, Math.min(1, rate));
  const segment = t < 0.5 ? 0 : 1;
  const localT = segment === 0 ? t * 2 : (t - 0.5) * 2;
  const from = COLOR_STOPS[segment];
  const to = COLOR_STOPS[segment + 1];
  const r = Math.round(from.r + (to.r - from.r) * localT);
  const g = Math.round(from.g + (to.g - from.g) * localT);
  const b = Math.round(from.b + (to.b - from.b) * localT);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${h}:${m}`;
}

type TooltipState = {
  idx: number;
  anchorX: number;
  anchorTop: number;
  anchorBottom: number;
  placement: "above" | "below";
  left: number;
  top: number;
};

const tooltipState = ref<TooltipState | null>(null);

function setTooltipForTarget(idx: number, target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const placement: TooltipState["placement"] = rect.top < 80 ? "below" : "above";
  const anchorX = rect.left + rect.width / 2;
  const anchorTop = rect.top;
  const anchorBottom = rect.bottom;
  tooltipState.value = {
    idx,
    anchorX,
    anchorTop,
    anchorBottom,
    placement,
    left: anchorX,
    top: placement === "above" ? anchorTop - 8 : anchorBottom + 8,
  };
  activeTooltip.value = idx;
  nextTick(adjustTooltipPosition);
}

function adjustTooltipPosition() {
  if (!tooltipState.value || !tooltipRef.value) return;
  const tooltipRect = tooltipRef.value.getBoundingClientRect();
  const padding = 8;
  let placement = tooltipState.value.placement;
  let top = placement === "above"
    ? tooltipState.value.anchorTop - 8
    : tooltipState.value.anchorBottom + 8;

  if (placement === "above" && top - tooltipRect.height < padding) {
    placement = "below";
    top = tooltipState.value.anchorBottom + 8;
  } else if (placement === "below" && top + tooltipRect.height > window.innerHeight - padding) {
    placement = "above";
    top = tooltipState.value.anchorTop - 8;
  }

  let left = tooltipState.value.anchorX;
  const minLeft = padding + tooltipRect.width / 2;
  const maxLeft = window.innerWidth - padding - tooltipRect.width / 2;
  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = maxLeft;

  tooltipState.value = {
    ...tooltipState.value,
    placement,
    left,
    top,
  };
}

function refreshTooltipAnchor() {
  if (activeTooltip.value === null || !gridRef.value) return;
  const target = gridRef.value.children.item(activeTooltip.value) as HTMLElement | null;
  if (!target) return;
  const rect = target.getBoundingClientRect();
  tooltipState.value = tooltipState.value
    ? {
      ...tooltipState.value,
      anchorX: rect.left + rect.width / 2,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
    }
    : null;
}

const tooltipStyle = computed(() => {
  if (!tooltipState.value) return {};
  const translateY = tooltipState.value.placement === "above" ? "-100%" : "0";
  return {
    position: "fixed",
    left: `${tooltipState.value.left}px`,
    top: `${tooltipState.value.top}px`,
    transform: `translate(-50%, ${translateY})`,
  };
});

function handlePointerEnter(e: PointerEvent, idx: number) {
  if (e.pointerType === "mouse") {
    setTooltipForTarget(idx, e.currentTarget as HTMLElement);
  }
}

function handlePointerLeave(e: PointerEvent) {
  if (e.pointerType === "mouse") {
    activeTooltip.value = null;
    tooltipState.value = null;
  }
}

function handlePointerDown(e: PointerEvent, idx: number) {
  if (e.pointerType === "touch") {
    e.preventDefault();
    if (activeTooltip.value === idx) {
      activeTooltip.value = null;
      tooltipState.value = null;
      return;
    }
    setTooltipForTarget(idx, e.currentTarget as HTMLElement);
  }
}

function closeTooltipOnOutsideClick(e: PointerEvent) {
  if (!gridRef.value) return;
  if (!gridRef.value.contains(e.target as Node)) {
    activeTooltip.value = null;
    tooltipState.value = null;
  }
}

function handleWindowResize() {
  refreshTooltipAnchor();
  adjustTooltipPosition();
}

onMounted(() => {
  document.addEventListener("pointerdown", closeTooltipOnOutsideClick);
  window.addEventListener("resize", handleWindowResize);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeTooltipOnOutsideClick);
  window.removeEventListener("resize", handleWindowResize);
});

function handleScrollerScroll() {
  if (activeTooltip.value !== null) {
    refreshTooltipAnchor();
    adjustTooltipPosition();
  }
}
</script>

<template>
  <section class="card health-card">
    <div class="health-header">
      <h3 class="health-title">服务健康监测</h3>
      <div class="health-meta">
        <span class="health-window">近7天 / 30分钟</span>
        <span class="health-rate" :class="rateClass">
          {{ store.usageLoading || !hasData ? '--' : `${healthData.successRate.toFixed(1)}%` }}
        </span>
      </div>
    </div>

    <div class="health-grid-scroller" ref="scrollerRef" @scroll="handleScrollerScroll">
      <div class="health-grid" ref="gridRef">
        <div
          v-for="(detail, idx) in healthData.blockDetails"
          :key="idx"
          class="health-block-wrapper"
          :class="{ 'health-block-active': activeTooltip === idx }"
          @pointerenter="(e) => handlePointerEnter(e as PointerEvent, idx)"
          @pointerleave="(e) => handlePointerLeave(e as PointerEvent)"
          @pointerdown="(e) => handlePointerDown(e as PointerEvent, idx)"
        >
          <div
            class="health-block"
            :class="{ 'health-block-idle': detail.rate === -1 }"
            :style="detail.rate === -1 ? undefined : { backgroundColor: rateToColor(detail.rate) }"
          ></div>
        </div>
      </div>
    </div>

    <teleport to="body">
      <div
        v-if="activeTooltip !== null && tooltipState"
        ref="tooltipRef"
        class="health-tooltip"
        :class="{ 'health-tooltip-below': tooltipState?.placement === 'below' }"
        :style="tooltipStyle"
      >
        <span class="health-tooltip-time">
          {{ formatDateTime(healthData.blockDetails[tooltipState.idx].startTime) }}
          –
          {{ formatDateTime(healthData.blockDetails[tooltipState.idx].endTime) }}
        </span>
        <span
          class="health-tooltip-stats"
          v-if="healthData.blockDetails[tooltipState.idx].success + healthData.blockDetails[tooltipState.idx].failure > 0"
        >
          <span class="health-tooltip-success">成功 {{ healthData.blockDetails[tooltipState.idx].success }}</span>
          <span class="health-tooltip-failure">失败 {{ healthData.blockDetails[tooltipState.idx].failure }}</span>
          <span class="health-tooltip-rate">({{ (healthData.blockDetails[tooltipState.idx].rate * 100).toFixed(1) }}%)</span>
        </span>
        <span v-else class="health-tooltip-stats">暂无请求</span>
      </div>
    </teleport>

    <div class="health-legend">
      <span class="health-legend-label">最早</span>
      <div class="health-legend-colors">
        <div class="health-legend-block health-block-idle"></div>
        <div class="health-legend-block" style="background-color: #ef4444"></div>
        <div class="health-legend-block" style="background-color: #facc15"></div>
        <div class="health-legend-block" style="background-color: #22c55e"></div>
      </div>
      <span class="health-legend-label">最新</span>
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

.health-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.health-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.health-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--zinc-900);
  margin: 0;
}

.health-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.health-window {
  font-size: 11px;
  color: var(--zinc-500);
}

.health-rate {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--zinc-100);
  color: var(--zinc-700);
}

.health-rate-high {
  background: var(--green-50);
  color: var(--green-600);
}

.health-rate-medium {
  background: #fef3c7;
  color: #92400e;
}

.health-rate-low {
  background: var(--red-50);
  color: var(--red-600);
}

.health-grid-scroller {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--zinc-300) transparent;
  scrollbar-gutter: stable;
  padding-bottom: 2px;
}

.health-grid-scroller::-webkit-scrollbar {
  height: 3px;
}

.health-grid-scroller::-webkit-scrollbar-track {
  background: transparent;
}

.health-grid-scroller::-webkit-scrollbar-thumb {
  background: var(--zinc-300);
  border-radius: 999px;
}

.health-grid {
  display: grid;
  gap: 2px;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 8px);
  width: fit-content;
  margin: 0 auto;
  position: relative;
}

.health-block-wrapper {
  position: relative;
  cursor: pointer;
  width: 8px;
  height: 8px;
}

.health-block {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.health-block-wrapper:hover .health-block,
.health-block-active .health-block {
  transform: scaleY(1.6);
  opacity: 0.85;
}

.health-block-idle {
  background-color: var(--zinc-200);
}

.health-tooltip {
  position: fixed;
  background: #fff;
  border: 1px solid var(--zinc-200);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1.5;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 20;
  pointer-events: none;
  color: var(--zinc-900);
}

.health-tooltip::after,
.health-tooltip::before {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
}

.health-tooltip::after {
  border-top-color: #fff;
}

.health-tooltip::before {
  border: 6px solid transparent;
  border-top-color: var(--zinc-200);
}

.health-tooltip-below::after,
.health-tooltip-below::before {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
}

.health-tooltip-below::after {
  border-bottom-color: #fff;
}

.health-tooltip-below::before {
  border-bottom-color: var(--zinc-200);
}

.health-tooltip-time {
  color: var(--zinc-600);
  display: block;
  margin-bottom: 2px;
}

.health-tooltip-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.health-tooltip-success {
  color: var(--green-600);
}

.health-tooltip-failure {
  color: var(--red-600);
}

.health-tooltip-rate {
  color: var(--zinc-500);
  margin-left: 2px;
}

.health-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.health-legend-label {
  font-size: 10px;
  color: var(--zinc-500);
}

.health-legend-colors {
  display: flex;
  gap: 3px;
}

.health-legend-block {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

@media (max-width: 560px) {
  .health-card {
    gap: 10px;
  }

  .health-grid {
    grid-template-rows: repeat(7, 6px);
    gap: 2px;
    margin: 0;
  }

  .health-block-wrapper {
    width: 6px;
    height: 6px;
  }

  .health-tooltip {
    font-size: 10px;
    padding: 4px 8px;
  }

  .health-legend-block {
    width: 8px;
    height: 8px;
  }
}
</style>
