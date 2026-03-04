<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import BaseCard from "./BaseCard.vue";
import { useAuthStore } from "../stores/auth";
import { useDashboardStore } from "../stores/dashboard";
import { useServerConfigStore } from "../stores/serverConfig";
import { useModelsStore } from "../stores/models";
import { useApiKeysStore } from "../stores/apiKeys";

const authStore = useAuthStore();
const dashboardStore = useDashboardStore();
const serverConfigStore = useServerConfigStore();
const modelsStore = useModelsStore();
const apiKeysStore = useApiKeysStore();

const apiKeysCache = ref<string[]>([]);

const isConnected = computed(() => Boolean(authStore.currentAccount));
const connectionStatus = computed(() => {
  if (authStore.loading) return "connecting";
  if (authStore.error) return "error";
  return isConnected.value ? "connected" : "disconnected";
});

const connectionLabel = computed(() => {
  if (connectionStatus.value === "connecting") return "连接中";
  if (connectionStatus.value === "error") return "连接异常";
  if (connectionStatus.value === "connected") return "已连接";
  return "未连接";
});

const serverLabel = computed(() => authStore.currentAccount?.server || "-");
const serverVersion = computed(() => serverConfigStore.serverVersion || "-");
const serverBuildDate = computed(() => {
  const raw = serverConfigStore.serverBuildDate;
  if (!raw) return "-";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
});

const totalProviderKeys = computed(() => dashboardStore.totalProviderKeys ?? "-");
const providerBreakdown = computed(() => {
  const stats = dashboardStore.providerStats;
  if (!dashboardStore.providerStatsReady) return "";
  return `Gemini ${stats.gemini ?? 0} / Codex ${stats.codex ?? 0} / Claude ${stats.claude ?? 0} / Vertex ${stats.vertex ?? 0} / OpenAI ${stats.openai ?? 0}`;
});

const routingStrategyLabel = computed(() => {
  const raw = serverConfigStore.config?.routingStrategy;
  if (!raw) return "-";
  if (raw === "round-robin") return "轮询";
  if (raw === "fill-first") return "填充优先";
  return raw;
});

const resolveApiKeys = async () => {
  if (apiKeysCache.value.length) return apiKeysCache.value;
  const configKeys = serverConfigStore.config?.apiKeys ?? [];
  if (configKeys.length) {
    apiKeysCache.value = [...configKeys];
    return apiKeysCache.value;
  }
  try {
    await apiKeysStore.fetchKeys();
    if (apiKeysStore.keys.length) {
      apiKeysCache.value = [...apiKeysStore.keys];
    }
  } catch {
    // ignore
  }
  return apiKeysCache.value;
};

const fetchModels = async (forceRefresh = false) => {
  if (!authStore.currentAccount) return;
  try {
    const keys = await resolveApiKeys();
    const primaryKey = keys[0];
    await modelsStore.fetchForServer(authStore.currentAccount.server, primaryKey, forceRefresh);
  } catch {
    // dashboard 不阻塞
  }
};

const refreshAll = async () => {
  if (!authStore.currentAccount) return;
  await Promise.allSettled([
    serverConfigStore.refresh(),
    dashboardStore.refresh(),
    fetchModels(),
  ]);
};

onMounted(() => {
  if (authStore.currentAccount) {
    refreshAll();
  }
});

watch(
  () => authStore.currentAccount?.server,
  () => {
    apiKeysCache.value = [];
    modelsStore.clearCache();
    dashboardStore.clear();
    if (authStore.currentAccount) {
      refreshAll();
    }
  },
);
</script>

<template>
  <div class="dashboard-stack">
    <BaseCard title="连接状态" description="服务器连接与版本信息" headerGap="lg">
      <template #actions>
        <button class="btn-ghost" :disabled="!isConnected || dashboardStore.loading" @click="refreshAll">
          {{ dashboardStore.loading ? "刷新中..." : "刷新" }}
        </button>
      </template>
      <div class="connection-row">
        <div class="connection-status">
          <span class="status-dot" :class="`status-${connectionStatus}`"></span>
          <span class="status-text">{{ connectionLabel }}</span>
        </div>
        <div class="connection-meta">
          <span class="meta-item mono">{{ serverLabel }}</span>
          <span class="meta-item">版本 {{ serverVersion }}</span>
          <span class="meta-item">构建 {{ serverBuildDate }}</span>
        </div>
      </div>
    </BaseCard>

    <BaseCard title="关键概览" description="管理对象与可用模型概况" headerGap="lg">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ dashboardStore.apiKeysCount ?? "-" }}</div>
          <div class="stat-label">管理密钥</div>
          <div class="stat-sub">API Keys</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalProviderKeys }}</div>
          <div class="stat-label">AI 提供商</div>
          <div class="stat-sub">{{ providerBreakdown || "统计加载中" }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ dashboardStore.authFilesCount ?? "-" }}</div>
          <div class="stat-label">认证文件</div>
          <div class="stat-sub">OAuth / Token</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ modelsStore.loading ? "-" : modelsStore.models.length }}</div>
          <div class="stat-label">可用模型</div>
          <div class="stat-sub">模型列表快照</div>
        </div>
      </div>
      <p v-if="dashboardStore.error" class="error-msg">{{ dashboardStore.error }}</p>
    </BaseCard>

    <BaseCard title="当前配置" description="服务端基础设置速览" headerGap="lg">
      <div v-if="serverConfigStore.config" class="config-grid">
        <div class="config-item">
          <span class="config-label">Debug</span>
          <span class="config-value" :class="{ enabled: serverConfigStore.config.debug }">
            {{ serverConfigStore.config.debug ? "已开启" : "已关闭" }}
          </span>
        </div>
        <div class="config-item">
          <span class="config-label">使用统计</span>
          <span class="config-value" :class="{ enabled: serverConfigStore.config.usageStatisticsEnabled }">
            {{ serverConfigStore.config.usageStatisticsEnabled ? "已开启" : "已关闭" }}
          </span>
        </div>
        <div class="config-item">
          <span class="config-label">写日志到文件</span>
          <span class="config-value" :class="{ enabled: serverConfigStore.config.loggingToFile }">
            {{ serverConfigStore.config.loggingToFile ? "已开启" : "已关闭" }}
          </span>
        </div>
        <div class="config-item">
          <span class="config-label">重试次数</span>
          <span class="config-value">{{ serverConfigStore.config.requestRetry ?? 0 }}</span>
        </div>
        <div class="config-item">
          <span class="config-label">WS 鉴权</span>
          <span class="config-value" :class="{ enabled: serverConfigStore.config.wsAuth }">
            {{ serverConfigStore.config.wsAuth ? "已开启" : "已关闭" }}
          </span>
        </div>
        <div class="config-item">
          <span class="config-label">路由策略</span>
          <span class="config-badge">{{ routingStrategyLabel }}</span>
        </div>
        <div v-if="serverConfigStore.config.proxyUrl" class="config-item full">
          <span class="config-label">代理地址</span>
          <span class="config-value mono">{{ serverConfigStore.config.proxyUrl }}</span>
        </div>
      </div>
      <div v-else class="hint">尚未加载配置</div>
      <p v-if="serverConfigStore.error" class="error-msg">{{ serverConfigStore.error }}</p>
    </BaseCard>
  </div>
</template>

<style scoped>
.dashboard-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.btn-ghost {
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

.connection-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--zinc-800);
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--zinc-400);
}
.status-connected { background: var(--green-600); }
.status-connecting { background: var(--indigo-500); }
.status-error { background: var(--red-600); }
.status-disconnected { background: var(--zinc-400); }
.status-text {
  font-size: 13px;
}
.connection-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--zinc-500);
}
.meta-item {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--zinc-100);
}
.mono { font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.stat-card {
  background: var(--zinc-50);
  border: 1px solid var(--zinc-100);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 92px;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--zinc-900);
}
.stat-label {
  font-size: 12px;
  color: var(--zinc-600);
}
.stat-sub {
  font-size: 11px;
  color: var(--zinc-400);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}
.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--zinc-50);
  border: 1px solid var(--zinc-100);
}
.config-item.full {
  grid-column: 1 / -1;
}
.config-label {
  font-size: 12px;
  color: var(--zinc-500);
}
.config-value {
  font-size: 12px;
  color: var(--zinc-700);
}
.config-value.enabled {
  color: var(--green-600);
  font-weight: 600;
}
.config-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #EEF2FF;
  color: #4F46E5;
}

.hint {
  font-size: 12px;
  color: var(--zinc-400);
}
.error-msg {
  margin-top: 8px;
  font-size: 12px;
  color: var(--red-600);
}

@media (max-width: 640px) {
  .stats-grid,
  .config-grid {
    grid-template-columns: 1fr;
  }
}
</style>
