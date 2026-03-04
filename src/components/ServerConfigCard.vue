<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import BaseCard from "./BaseCard.vue";
import { useServerConfigStore } from "../stores/serverConfig";

const store = useServerConfigStore();

const proxyUrlInput = ref("");
const requestRetryInput = ref("");
const logsMaxSizeInput = ref("");
const routingStrategyInput = ref("round-robin");

const proxyError = ref("");
const retryError = ref("");
const logsError = ref("");

const configReady = computed(() => Boolean(store.config));
const busy = computed(() => store.loading || store.working);

const quotaSwitchProject = computed(() => store.config?.quotaExceeded?.switchProject ?? false);
const quotaSwitchPreview = computed(() => store.config?.quotaExceeded?.switchPreviewModel ?? false);

const routingOptions = [
  { value: "round-robin", label: "轮询" },
  { value: "fill-first", label: "填充优先" },
];

watch(
  () => store.config?.proxyUrl,
  (value) => {
    proxyUrlInput.value = value ?? "";
  },
  { immediate: true },
);

watch(
  () => store.config?.requestRetry,
  (value) => {
    requestRetryInput.value = value !== undefined && value !== null ? String(value) : "0";
  },
  { immediate: true },
);

watch(
  () => store.config?.logsMaxTotalSizeMb,
  (value) => {
    logsMaxSizeInput.value = value !== undefined && value !== null ? String(value) : "0";
  },
  { immediate: true },
);

watch(
  () => store.config?.routingStrategy,
  (value) => {
    routingStrategyInput.value = value || "round-robin";
  },
  { immediate: true },
);

const saveProxyUrl = async () => {
  proxyError.value = "";
  try {
    await store.setProxyUrl(proxyUrlInput.value);
  } catch (e) {
    proxyError.value = String(e);
  }
};

const saveRequestRetry = async () => {
  retryError.value = "";
  const parsed = Number(requestRetryInput.value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    retryError.value = "请输入非负数字";
    return;
  }
  try {
    await store.setRequestRetry(parsed);
  } catch (e) {
    retryError.value = String(e);
  }
};

const saveLogsMaxTotalSize = async () => {
  logsError.value = "";
  const parsed = Number(logsMaxSizeInput.value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    logsError.value = "请输入非负数字";
    return;
  }
  try {
    await store.setLogsMaxTotalSizeMb(parsed);
  } catch (e) {
    logsError.value = String(e);
  }
};

const saveRoutingStrategy = async () => {
  try {
    await store.setRoutingStrategy(routingStrategyInput.value);
  } catch {
    // 错误由 store.error 展示
  }
};

const runToggle = async (task: () => Promise<void>) => {
  try {
    await task();
  } catch {
    // 错误由 store.error 展示
  }
};

const toggleDebug = () => runToggle(() => store.setDebug(!store.config?.debug));
const toggleQuotaSwitchProject = () => runToggle(() => store.setQuotaSwitchProject(!quotaSwitchProject.value));
const toggleQuotaSwitchPreview = () => runToggle(() => store.setQuotaSwitchPreviewModel(!quotaSwitchPreview.value));
const toggleUsageStatistics = () => runToggle(() => store.setUsageStatistics(!store.config?.usageStatisticsEnabled));
const toggleRequestLog = () => runToggle(() => store.setRequestLog(!store.config?.requestLog));
const toggleLoggingToFile = () => runToggle(() => store.setLoggingToFile(!store.config?.loggingToFile));
const toggleWsAuth = () => runToggle(() => store.setWsAuth(!store.config?.wsAuth));
const toggleForceModelPrefix = () => runToggle(() => store.setForceModelPrefix(!store.config?.forceModelPrefix));
const clearProxyUrl = () => runToggle(() => store.setProxyUrl(""));

onMounted(() => {
  if (!store.config && !store.loading) {
    store.refresh();
  }
});
</script>

<template>
  <div class="config-stack">
    <BaseCard title="基础设置" description="调试与网络相关配置" headerGap="lg">
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">Debug 模式</div>
          <div class="setting-value">
            当前：
            <span :class="store.config?.debug ? 'status-on' : 'status-off'">
              {{ store.config?.debug ? "已开启" : "已关闭" }}
            </span>
          </div>
        </div>
        <button
          class="btn-action"
          :class="{ 'btn-action-on': store.config?.debug }"
          :disabled="busy || !configReady"
          @click="toggleDebug"
        >
          {{ store.config?.debug ? "关闭" : "开启" }}
        </button>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">代理地址</div>
          <div class="setting-value">
            当前：<span class="mono">{{ store.config?.proxyUrl || "未设置" }}</span>
          </div>
        </div>
        <div class="setting-actions">
          <input class="setting-input wide" v-model="proxyUrlInput" :disabled="busy || !configReady" />
          <button class="btn-action" :disabled="busy || !configReady" @click="saveProxyUrl">保存</button>
          <button class="btn-ghost" :disabled="busy || !configReady" @click="clearProxyUrl">清除</button>
        </div>
      </div>
      <p v-if="proxyError" class="error-msg">{{ proxyError }}</p>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">请求重试次数</div>
          <div class="setting-value">
            当前：{{ store.config?.requestRetry ?? 0 }}
          </div>
        </div>
        <div class="setting-actions">
          <input class="setting-input" v-model="requestRetryInput" type="number" min="0" :disabled="busy || !configReady" />
          <button class="btn-action" :disabled="busy || !configReady" @click="saveRequestRetry">保存</button>
        </div>
      </div>
      <p v-if="retryError" class="error-msg">{{ retryError }}</p>
    </BaseCard>

    <BaseCard title="配额回退" description="额度不足时的回退策略" headerGap="lg">
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">切换项目</div>
          <div class="setting-value">
            当前：
            <span :class="quotaSwitchProject ? 'status-on' : 'status-off'">
              {{ quotaSwitchProject ? "已开启" : "已关闭" }}
            </span>
          </div>
        </div>
        <button
          class="btn-action"
          :class="{ 'btn-action-on': quotaSwitchProject }"
          :disabled="busy || !configReady"
          @click="toggleQuotaSwitchProject"
        >
          {{ quotaSwitchProject ? "关闭" : "开启" }}
        </button>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">切换预览模型</div>
          <div class="setting-value">
            当前：
            <span :class="quotaSwitchPreview ? 'status-on' : 'status-off'">
              {{ quotaSwitchPreview ? "已开启" : "已关闭" }}
            </span>
          </div>
        </div>
        <button
          class="btn-action"
          :class="{ 'btn-action-on': quotaSwitchPreview }"
          :disabled="busy || !configReady"
          @click="toggleQuotaSwitchPreview"
        >
          {{ quotaSwitchPreview ? "关闭" : "开启" }}
        </button>
      </div>
    </BaseCard>

    <BaseCard title="统计与日志" description="使用统计与日志记录" headerGap="lg">
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">使用统计</div>
          <div class="setting-value">
            当前：
            <span :class="store.config?.usageStatisticsEnabled ? 'status-on' : 'status-off'">
              {{ store.config?.usageStatisticsEnabled ? "已开启" : "已关闭" }}
            </span>
          </div>
        </div>
        <button
          class="btn-action"
          :class="{ 'btn-action-on': store.config?.usageStatisticsEnabled }"
          :disabled="busy || !configReady"
          @click="toggleUsageStatistics"
        >
          {{ store.config?.usageStatisticsEnabled ? "关闭" : "开启" }}
        </button>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">请求日志</div>
          <div class="setting-value">
            当前：
            <span :class="store.config?.requestLog ? 'status-on' : 'status-off'">
              {{ store.config?.requestLog ? "已开启" : "已关闭" }}
            </span>
          </div>
        </div>
        <button
          class="btn-action"
          :class="{ 'btn-action-on': store.config?.requestLog }"
          :disabled="busy || !configReady"
          @click="toggleRequestLog"
        >
          {{ store.config?.requestLog ? "关闭" : "开启" }}
        </button>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">写日志到文件</div>
          <div class="setting-value">
            当前：
            <span :class="store.config?.loggingToFile ? 'status-on' : 'status-off'">
              {{ store.config?.loggingToFile ? "已开启" : "已关闭" }}
            </span>
          </div>
        </div>
        <button
          class="btn-action"
          :class="{ 'btn-action-on': store.config?.loggingToFile }"
          :disabled="busy || !configReady"
          @click="toggleLoggingToFile"
        >
          {{ store.config?.loggingToFile ? "关闭" : "开启" }}
        </button>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">日志总大小上限（MB）</div>
          <div class="setting-value">
            当前：{{ store.config?.logsMaxTotalSizeMb ?? 0 }}
          </div>
        </div>
        <div class="setting-actions">
          <input class="setting-input" v-model="logsMaxSizeInput" type="number" min="0" :disabled="busy || !configReady" />
          <button class="btn-action" :disabled="busy || !configReady" @click="saveLogsMaxTotalSize">保存</button>
        </div>
      </div>
      <p v-if="logsError" class="error-msg">{{ logsError }}</p>
    </BaseCard>

    <BaseCard title="连接与路由" description="WebSocket 与路由策略" headerGap="lg">
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">WS 鉴权</div>
          <div class="setting-value">
            当前：
            <span :class="store.config?.wsAuth ? 'status-on' : 'status-off'">
              {{ store.config?.wsAuth ? "已开启" : "已关闭" }}
            </span>
          </div>
        </div>
        <button
          class="btn-action"
          :class="{ 'btn-action-on': store.config?.wsAuth }"
          :disabled="busy || !configReady"
          @click="toggleWsAuth"
        >
          {{ store.config?.wsAuth ? "关闭" : "开启" }}
        </button>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">强制模型前缀</div>
          <div class="setting-value">
            当前：
            <span :class="store.config?.forceModelPrefix ? 'status-on' : 'status-off'">
              {{ store.config?.forceModelPrefix ? "已开启" : "已关闭" }}
            </span>
          </div>
        </div>
        <button
          class="btn-action"
          :class="{ 'btn-action-on': store.config?.forceModelPrefix }"
          :disabled="busy || !configReady"
          @click="toggleForceModelPrefix"
        >
          {{ store.config?.forceModelPrefix ? "关闭" : "开启" }}
        </button>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">路由策略</div>
          <div class="setting-value">
            当前：{{ store.config?.routingStrategy || "round-robin" }}
          </div>
        </div>
        <div class="setting-actions">
          <select class="setting-select" v-model="routingStrategyInput" :disabled="busy || !configReady">
            <option v-for="item in routingOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
          <button class="btn-action" :disabled="busy || !configReady" @click="saveRoutingStrategy">保存</button>
        </div>
      </div>
    </BaseCard>

    <p v-if="store.error" class="error-msg">{{ store.error }}</p>
  </div>
</template>

<style scoped>
.config-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--zinc-100);
}

.setting-row:first-of-type {
  border-top: none;
  padding-top: 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.setting-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--zinc-800);
}

.setting-value {
  font-size: 12px;
  color: var(--zinc-500);
}

.setting-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-input {
  height: 32px;
  width: 100px;
  padding: 0 10px;
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 13px;
  color: var(--zinc-800);
  font-family: inherit;
  background: #FFFFFF;
}

.setting-input.wide {
  width: 220px;
}

.setting-input:disabled {
  background: var(--zinc-100);
  color: var(--zinc-400);
}

.setting-select {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 13px;
  color: var(--zinc-800);
  font-family: inherit;
  background: #FFFFFF;
}

.status-on { color: var(--green-600); font-weight: 500; }
.status-off { color: var(--zinc-400); }

.btn-action {
  height: 32px;
  padding: 0 14px;
  background: var(--zinc-50);
  color: var(--zinc-600);
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 13px;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}
.btn-action:hover:not(:disabled) {
  background: var(--zinc-100);
  border-color: var(--zinc-300);
  color: var(--zinc-900);
}
.btn-action-on {
  background: var(--zinc-900);
  color: #FFFFFF;
  border-color: var(--zinc-900);
}
.btn-action-on:hover:not(:disabled) {
  background: var(--zinc-800);
  border-color: var(--zinc-800);
  color: #FFFFFF;
}
.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost {
  height: 32px;
  padding: 0 12px;
  background: transparent;
  color: var(--zinc-600);
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 13px;
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

.error-msg {
  margin-top: 8px;
  font-size: 12px;
  color: var(--red-600);
}

.mono {
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}

@media (max-width: 640px) {
  .setting-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .setting-actions {
    width: 100%;
  }
  .setting-input.wide {
    width: 100%;
  }
}
</style>
