<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useLogsStore } from "../stores/logs";
import { saveBytesToFile, saveTextToFile } from "../utils/download";
import { MANAGEMENT_API_PREFIX } from "../utils/constants";
import BaseCard from "./BaseCard.vue";
import ConfirmDialog from "./ConfirmDialog.vue";

const store = useLogsStore();
const searchQuery = ref("");
const hideManagementLogs = ref(true);
const autoRefresh = ref(true);
const showClearDialog = ref(false);
const requestId = ref("");
const requestDownloadError = ref<string | null>(null);
const errorLogDownloadError = ref<string | null>(null);

let autoTimer: number | null = null;

const filteredLines = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let lines = store.lines;
  if (hideManagementLogs.value) {
    lines = lines.filter((line) => !line.includes(MANAGEMENT_API_PREFIX));
  }
  if (query) {
    lines = lines.filter((line) => line.toLowerCase().includes(query));
  }
  return lines;
});

const displayLines = computed(() => filteredLines.value.join("\n"));

const refreshLogs = async () => {
  await store.loadLogs(false);
};

const setupAutoRefresh = () => {
  if (autoTimer) {
    window.clearInterval(autoTimer);
    autoTimer = null;
  }
  if (!autoRefresh.value) return;
  autoTimer = window.setInterval(() => {
    store.loadLogs(true);
  }, 8000);
};

const formatFileSize = (size?: number) => {
  if (!size) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const formatTime = (value?: number) => {
  if (!value) return "-";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const downloadLogs = async () => {
  await saveTextToFile(displayLines.value, "logs.txt");
};

const confirmClearLogs = () => {
  showClearDialog.value = true;
};

const clearLogs = async () => {
  await store.clearAll();
  showClearDialog.value = false;
};

const downloadErrorLog = async (name: string) => {
  errorLogDownloadError.value = null;
  try {
    const bytes = await store.downloadErrorLogFile(name);
    await saveBytesToFile(bytes, name);
  } catch (e) {
    errorLogDownloadError.value = String(e);
  }
};

const downloadRequestLog = async () => {
  requestDownloadError.value = null;
  const id = requestId.value.trim();
  if (!id) {
    requestDownloadError.value = "请输入请求 ID";
    return;
  }
  try {
    const bytes = await store.downloadRequestLog(id);
    await saveBytesToFile(bytes, `request-${id}.log`);
  } catch (e) {
    requestDownloadError.value = String(e);
  }
};

onMounted(async () => {
  await store.loadLogs(false);
  await store.loadErrorLogs();
  setupAutoRefresh();
});

onUnmounted(() => {
  if (autoTimer) window.clearInterval(autoTimer);
});

watch(autoRefresh, setupAutoRefresh);
</script>

<template>
  <div class="logs-wrap">
    <BaseCard title="日志" description="请求日志与管理日志" headerGap="sm">
      <template #actions>
        <button class="btn-ghost btn-sm" @click="refreshLogs" :disabled="store.loading">
          {{ store.loading ? "刷新中..." : "刷新" }}
        </button>
        <button class="btn-ghost btn-sm" @click="downloadLogs">下载当前日志</button>
        <button class="btn-ghost btn-sm btn-ghost-danger" @click="confirmClearLogs">清空日志</button>
      </template>

      <div v-if="store.error" class="error-banner">
        <span class="error-text">{{ store.error }}</span>
        <button class="btn-ghost btn-sm" @click="refreshLogs">重试</button>
      </div>

      <div class="log-controls">
        <label class="control-item">
          <input type="checkbox" v-model="autoRefresh" />
          <span>自动刷新</span>
        </label>
        <label class="control-item">
          <input type="checkbox" v-model="hideManagementLogs" />
          <span>隐藏管理端流量（{{ MANAGEMENT_API_PREFIX }}）</span>
        </label>
        <input v-model="searchQuery" class="control-input" placeholder="搜索日志" />
        <span class="control-meta">显示 {{ filteredLines.length }} / {{ store.lineCount || store.lines.length }}</span>
      </div>

      <div class="log-viewer">
        <pre class="log-content">{{ displayLines || '暂无日志' }}</pre>
      </div>
    </BaseCard>

    <BaseCard title="错误日志" description="请求错误日志文件" headerGap="sm">
      <template #actions>
        <button class="btn-ghost btn-sm" @click="store.loadErrorLogs" :disabled="store.errorLogsLoading">
          {{ store.errorLogsLoading ? "刷新中..." : "刷新" }}
        </button>
      </template>

      <div v-if="store.errorLogsError" class="error-banner">
        <span class="error-text">{{ store.errorLogsError }}</span>
      </div>
      <div v-if="errorLogDownloadError" class="error-banner">
        <span class="error-text">{{ errorLogDownloadError }}</span>
      </div>

      <div v-if="store.errorLogsLoading" class="quota-message">加载中...</div>
      <div v-else-if="!store.errorLogs.length" class="quota-message">暂无错误日志</div>
      <div v-else class="error-log-list">
        <div v-for="file in store.errorLogs" :key="file.name" class="error-log-item">
          <div class="error-log-info">
            <span class="error-log-name">{{ file.name }}</span>
            <span class="error-log-meta">{{ formatFileSize(file.size) }} · {{ formatTime(file.modified) }}</span>
          </div>
          <button class="btn-ghost btn-sm" @click="downloadErrorLog(file.name)">下载</button>
        </div>
      </div>
    </BaseCard>

    <BaseCard title="按请求 ID 下载" description="输入请求 ID 下载对应请求日志" headerGap="sm">
      <div class="request-download">
        <input v-model="requestId" class="control-input" placeholder="请求 ID" />
        <button class="btn-primary btn-sm" @click="downloadRequestLog">下载</button>
      </div>
      <div v-if="requestDownloadError" class="error-text">{{ requestDownloadError }}</div>
    </BaseCard>
  </div>

  <ConfirmDialog
    :open="showClearDialog"
    title="清空日志"
    message="确定要清空所有请求日志吗？"
    @confirm="clearLogs"
    @cancel="showClearDialog = false"
  />
</template>

<style scoped>
.logs-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.log-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--zinc-600);
}

.control-input {
  height: 28px;
  border: 1px solid var(--zinc-200);
  border-radius: 6px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--zinc-700);
  background: #fff;
}

.control-meta {
  font-size: 11px;
  color: var(--zinc-400);
}

.log-viewer {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
}

.log-content {
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fef2f2;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #dc2626;
}

.error-text {
  font-size: 12px;
  color: #dc2626;
}

.error-log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.error-log-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
}

.error-log-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error-log-name {
  font-size: 12px;
  font-family: monospace;
  color: var(--zinc-800);
}

.error-log-meta {
  font-size: 11px;
  color: var(--zinc-500);
}

.request-download {
  display: flex;
  align-items: center;
  gap: 10px;
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

.btn-ghost-danger {
  border-color: #fecaca;
  color: #dc2626;
}

.btn-ghost-danger:hover {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}

.btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}

.quota-message {
  font-size: 12px;
  color: var(--zinc-500);
}
</style>
