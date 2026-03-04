<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BaseCard from "./BaseCard.vue";
import { useAuthStore } from "../stores/auth";
import { useServerConfigStore } from "../stores/serverConfig";
import { useModelsStore } from "../stores/models";
import { useApiKeysStore } from "../stores/apiKeys";
import { classifyModels } from "../utils/models";
import { isTauri } from "../api/tauri";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getVersion } from "@tauri-apps/api/app";

const authStore = useAuthStore();
const serverConfigStore = useServerConfigStore();
const modelsStore = useModelsStore();
const apiKeysStore = useApiKeysStore();

const appVersion = ref("-");
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

const modelGroups = computed(() => classifyModels(modelsStore.models, { otherLabel: "其他" }));

const links = [
  {
    title: "CLIProxyAPI 主仓库",
    desc: "核心服务端项目",
    url: "https://github.com/router-for-me/CLIProxyAPI",
  },
  {
    title: "管理中心前端",
    desc: "Web 管理后台源码",
    url: "https://github.com/router-for-me/Cli-Proxy-API-Management-Center",
  },
  {
    title: "官方文档",
    desc: "配置与说明文档",
    url: "https://help.router-for.me/",
  },
];

const openExternal = async (url: string) => {
  if (!url) return;
  if (isTauri()) {
    await openUrl(url);
  } else if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
  }
};

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
    // ignore
  }
};

// Request log hidden toggle
const requestLogModalOpen = ref(false);
const requestLogDraft = ref(false);
const requestLogTouched = ref(false);
const requestLogSaving = ref(false);
const versionTapCount = ref(0);
let versionTapTimer: number | null = null;

const requestLogEnabled = computed(() => serverConfigStore.config?.requestLog ?? false);
const requestLogDirty = computed(() => requestLogDraft.value !== requestLogEnabled.value);
const canEditRequestLog = computed(() => isConnected.value && Boolean(serverConfigStore.config));

const openRequestLogModal = () => {
  requestLogTouched.value = false;
  requestLogDraft.value = requestLogEnabled.value;
  requestLogModalOpen.value = true;
};

const handleVersionTap = () => {
  versionTapCount.value += 1;
  if (versionTapTimer) {
    window.clearTimeout(versionTapTimer);
  }

  if (versionTapCount.value >= 7) {
    versionTapCount.value = 0;
    versionTapTimer = null;
    openRequestLogModal();
    return;
  }

  versionTapTimer = window.setTimeout(() => {
    versionTapCount.value = 0;
    versionTapTimer = null;
  }, 1500);
};

const handleRequestLogClose = () => {
  requestLogModalOpen.value = false;
  requestLogTouched.value = false;
};

const handleRequestLogSave = async () => {
  if (!canEditRequestLog.value) return;
  if (!requestLogDirty.value) {
    handleRequestLogClose();
    return;
  }
  requestLogSaving.value = true;
  try {
    await serverConfigStore.setRequestLog(requestLogDraft.value);
    handleRequestLogClose();
  } catch {
    // 保持弹窗打开以便重试
  } finally {
    requestLogSaving.value = false;
  }
};

watch(
  () => requestLogModalOpen.value,
  (open) => {
    if (open) {
      requestLogDraft.value = requestLogEnabled.value;
    }
  },
);

onMounted(async () => {
  if (isTauri()) {
    try {
      appVersion.value = await getVersion();
    } catch {
      appVersion.value = "-";
    }
  }
  if (!serverConfigStore.config && !serverConfigStore.loading) {
    serverConfigStore.refresh();
  }
  if (authStore.currentAccount) {
    fetchModels();
  }
});

watch(
  () => authStore.currentAccount?.server,
  () => {
    apiKeysCache.value = [];
    modelsStore.clearCache();
    if (authStore.currentAccount) {
      fetchModels(true);
    }
  },
);

onBeforeUnmount(() => {
  if (versionTapTimer) {
    window.clearTimeout(versionTapTimer);
  }
});
</script>

<template>
  <div class="system-stack">
    <BaseCard title="系统信息" description="客户端与服务端概览" headerGap="lg">
      <div class="info-grid">
        <button class="info-tile tap-tile" type="button" @click="handleVersionTap">
          <div class="tile-label">客户端版本</div>
          <div class="tile-value">{{ appVersion }}</div>
        </button>
        <div class="info-tile">
          <div class="tile-label">服务端版本</div>
          <div class="tile-value">{{ serverVersion }}</div>
        </div>
        <div class="info-tile">
          <div class="tile-label">构建时间</div>
          <div class="tile-value">{{ serverBuildDate }}</div>
        </div>
        <div class="info-tile">
          <div class="tile-label">连接状态</div>
          <div class="tile-value">{{ connectionLabel }}</div>
          <div class="tile-sub">{{ serverLabel }}</div>
        </div>
      </div>
    </BaseCard>

    <BaseCard title="快捷链接" description="常用项目入口" headerGap="lg">
      <div class="links-grid">
        <button v-for="link in links" :key="link.url" class="link-card" type="button" @click="openExternal(link.url)">
          <div class="link-title">
            {{ link.title }}
            <span class="link-arrow">↗</span>
          </div>
          <div class="link-desc">{{ link.desc }}</div>
        </button>
      </div>
    </BaseCard>

    <BaseCard title="模型列表" description="按类别汇总可用模型" headerGap="lg">
      <template #actions>
        <button class="btn-ghost" :disabled="modelsStore.loading || !isConnected" @click="fetchModels(true)">
          {{ modelsStore.loading ? "刷新中..." : "刷新" }}
        </button>
      </template>

      <p v-if="modelsStore.error" class="error-msg">{{ modelsStore.error }}</p>
      <div v-if="modelsStore.loading" class="hint">加载中...</div>
      <div v-else-if="modelGroups.length === 0" class="hint">暂无模型数据</div>
      <div v-else class="model-groups">
        <div v-for="group in modelGroups" :key="group.id" class="model-group">
          <div class="group-title">{{ group.label }}</div>
          <div class="group-tags">
            <span
              v-for="model in group.items"
              :key="`${model.name}-${model.alias || 'default'}`"
              class="model-tag"
              :title="model.description || ''"
            >
              <span class="model-name">{{ model.name }}</span>
              <span v-if="model.alias" class="model-alias">{{ model.alias }}</span>
            </span>
          </div>
        </div>
      </div>
    </BaseCard>
  </div>

  <div v-if="requestLogModalOpen" class="modal-mask">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">请求日志开关</h3>
      </div>
      <div class="modal-body">
        <div class="warning-box">该开关仅供调试使用，请谨慎开启。</div>
        <label class="toggle">
          <input
            type="checkbox"
            :checked="requestLogDraft"
            :disabled="!canEditRequestLog || requestLogSaving"
            @change="(e) => { requestLogDraft = (e.target as HTMLInputElement).checked; requestLogTouched = true; }"
          />
          <span class="toggle-track"></span>
          <span class="toggle-label">启用请求日志</span>
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" :disabled="requestLogSaving" @click="handleRequestLogClose">取消</button>
        <button
          class="btn-action"
          :disabled="requestLogSaving || !canEditRequestLog || !requestLogDirty"
          @click="handleRequestLogSave"
        >
          {{ requestLogSaving ? "保存中..." : "保存" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.system-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.info-tile {
  background: var(--zinc-50);
  border: 1px solid var(--zinc-100);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}
.tap-tile {
  cursor: pointer;
  transition: border-color 150ms ease, transform 150ms ease;
}
.tap-tile:hover {
  border-color: var(--zinc-300);
  transform: translateY(-1px);
}
.tile-label {
  font-size: 12px;
  color: var(--zinc-500);
}
.tile-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--zinc-900);
}
.tile-sub {
  font-size: 11px;
  color: var(--zinc-400);
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.link-card {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  padding: 12px 14px;
  background: #FFFFFF;
  text-align: left;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.link-card:hover {
  border-color: var(--zinc-300);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
}
.link-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--zinc-900);
  display: flex;
  align-items: center;
  gap: 6px;
}
.link-arrow {
  font-size: 12px;
  color: var(--zinc-500);
}
.link-desc {
  font-size: 12px;
  color: var(--zinc-500);
  margin-top: 6px;
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

.model-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.model-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--zinc-800);
}
.group-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.model-tag {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--zinc-100);
  color: var(--zinc-700);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.model-name {
  font-weight: 600;
}
.model-alias {
  color: var(--zinc-500);
}

.hint {
  font-size: 12px;
  color: var(--zinc-400);
}
.error-msg {
  font-size: 12px;
  color: var(--red-600);
  margin-bottom: 8px;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(9, 9, 11, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  backdrop-filter: blur(2px);
}
.modal {
  width: 360px;
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.2);
  overflow: hidden;
}
.modal-header {
  padding: 18px 20px 0;
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--zinc-900);
}
.modal-body {
  padding: 12px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.warning-box {
  background: var(--red-50);
  color: var(--red-600);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--zinc-700);
}
.toggle input {
  display: none;
}
.toggle-track {
  width: 36px;
  height: 20px;
  background: var(--zinc-300);
  border-radius: 999px;
  position: relative;
  transition: background 150ms ease;
}
.toggle-track::after {
  content: "";
  width: 16px;
  height: 16px;
  background: #FFFFFF;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 150ms ease;
}
.toggle input:checked + .toggle-track {
  background: var(--green-600);
}
.toggle input:checked + .toggle-track::after {
  transform: translateX(16px);
}
.toggle-label {
  font-size: 13px;
}
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 18px;
}
.btn-action {
  height: 32px;
  padding: 0 14px;
  background: var(--zinc-900);
  color: #FFFFFF;
  border: 1px solid var(--zinc-900);
  border-radius: 7px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}
.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .info-grid,
  .links-grid {
    grid-template-columns: 1fr;
  }
  .modal {
    width: calc(100% - 32px);
  }
}
</style>
