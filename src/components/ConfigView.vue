<script setup lang="ts">
import { onMounted, computed, ref, watch } from "vue";
import { useConfigStore } from "../stores/config";
import { useAuthStore } from "../stores/auth";
import { useCodexStore } from "../stores/codex";
import { AUTO_REFRESH_MAX_SECONDS, AUTO_REFRESH_MIN_SECONDS, normalizeAutoRefreshIntervalSeconds } from "../utils/autoRefresh";
import CodexAccountCard from "./CodexAccountCard.vue";
import UsageStatsCard from "./UsageStatsCard.vue";
import ServiceHealthCard from "./ServiceHealthCard.vue";
import CredentialStatsCard from "./CredentialStatsCard.vue";
import RequestEventsDetailsCard from "./RequestEventsDetailsCard.vue";
import UsageImportExportCard from "./UsageImportExportCard.vue";
import AuthFilesCard from "./AuthFilesCard.vue";
import AuthFilesOAuthCard from "./AuthFilesOAuthCard.vue";
import ApiDetailsCard from "./ApiDetailsCard.vue";
import ApiKeysCard from "./ApiKeysCard.vue";
import BaseCard from "./BaseCard.vue";
import DashboardCard from "./DashboardCard.vue";
import ServerConfigCard from "./ServerConfigCard.vue";
import SystemCard from "./SystemCard.vue";
import ConfigFileCard from "./ConfigFileCard.vue";
import AiProvidersCard from "./AiProvidersCard.vue";
import OAuthCard from "./OAuthCard.vue";
import QuotaCard from "./QuotaCard.vue";
import LogsCard from "./LogsCard.vue";

const configStore = useConfigStore();
const authStore = useAuthStore();
const codexStore = useCodexStore();

onMounted(() => {
  configStore.refresh();
  codexStore.fetchConfigs();
  codexStore.refreshQuotas();
});

type TabKey = 'dashboard' | 'server-config' | 'config-file' | 'ai-providers' | 'codex' | 'auth' | 'oauth' | 'api-keys' | 'usage' | 'quota' | 'logs' | 'api-details' | 'system' | 'settings';
const activeTab = ref<TabKey>('dashboard');
const autoRefreshSecondsInput = ref('');
const autoRefreshError = ref('');

const mainTabs: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: '仪表盘' },
  { key: 'server-config', label: '基础设置' },
  { key: 'config-file', label: '配置文件' },
  { key: 'ai-providers', label: 'AI 提供商' },
  { key: 'auth', label: '认证' },
  { key: 'oauth', label: 'OAuth' },
  { key: 'api-keys', label: '密钥' },
  { key: 'usage', label: '统计' },
  { key: 'quota', label: '配额' },
  { key: 'logs', label: '日志' },
  { key: 'api-details', label: 'API 明细' },
  { key: 'system', label: '系统' },
];

const accountLabel = computed(() => {
  const account = authStore.currentAccount;
  if (!account) return "未知";
  return account.server;
});

watch(
  () => configStore.config?.auto_refresh_interval_seconds,
  (value) => {
    if (value !== undefined && value !== null) {
      autoRefreshSecondsInput.value = String(value);
    }
  },
  { immediate: true },
);

async function saveAutoRefreshInterval() {
  autoRefreshError.value = "";
  const parsed = Number(autoRefreshSecondsInput.value);
  if (!Number.isFinite(parsed)) {
    autoRefreshError.value = "请输入有效的刷新间隔";
    return;
  }
  const normalized = normalizeAutoRefreshIntervalSeconds(parsed);
  autoRefreshSecondsInput.value = String(normalized);
  try {
    await configStore.updateAutoRefreshIntervalSeconds(normalized);
  } catch {
    // 错误由 configStore.error 展示
  }
}
</script>

<template>
  <div class="config-layout">
    <!-- 顶部标题栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <div class="brand-logo">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="1" y="2" width="18" height="4.5" rx="1.5" fill="#18181B" opacity="0.3" />
            <rect x="1" y="7.5" width="18" height="4.5" rx="1.5" fill="#18181B" opacity="0.6" />
            <rect x="1" y="13.5" width="18" height="4.5" rx="1.5" fill="#18181B" opacity="0.9" />
          </svg>
        </div>
        <div class="topbar-title">
          <span class="app-name">CPA Codex</span>
          <span class="app-desc">后台常驻，配置轻松</span>
        </div>
      </div>

      <div class="topbar-right">
        <div class="account-badge">
          <span class="account-dot"></span>
          <span class="account-server">{{ accountLabel }}</span>
        </div>
        <div class="topbar-actions">
          <button class="btn-topbar" @click="authStore.switchAccount">切换服务器</button>
          <button class="btn-topbar btn-topbar-danger" @click="authStore.logout">退出登录</button>
        </div>
      </div>
    </header>

    <!-- 主体：侧边导航 + 内容区 -->
    <div class="body">
      <nav class="sidebar">
        <button
          v-for="t in mainTabs"
          :key="t.key"
          class="nav-item"
          :class="{ 'nav-active': activeTab === t.key }"
          @click="activeTab = t.key"
        >
          <svg v-if="t.key === 'dashboard'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <svg v-else-if="t.key === 'server-config'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
            <circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>
          </svg>
          <svg v-else-if="t.key === 'config-file'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
            <path d="M14 2v6h6"/>
            <path d="M8 13h8"/><path d="M8 17h8"/>
          </svg>
          <svg v-else-if="t.key === 'ai-providers'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4"/><path d="M12 18v4"/>
            <path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/>
            <path d="M2 12h4"/><path d="M18 12h4"/>
            <path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <svg v-else-if="t.key === 'codex'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <svg v-else-if="t.key === 'auth'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>
          </svg>
          <svg v-else-if="t.key === 'oauth'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 12"/>
            <path d="M14 11a5 5 0 0 1 0 7l-1.5 1.5a5 5 0 0 1-7-7L7 12"/>
          </svg>
          <svg v-else-if="t.key === 'api-keys'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="7.5" cy="14.5" r="3.5"/>
            <path d="M10.5 14.5h8l2 2-2 2h-2l-1 1-1-1h-2"/>
          </svg>
          <svg v-else-if="t.key === 'usage'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <svg v-else-if="t.key === 'quota'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          <svg v-else-if="t.key === 'logs'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
            <path d="M14 2v6h6"/>
            <path d="M8 13h8"/>
            <path d="M8 17h6"/>
          </svg>
          <svg v-else-if="t.key === 'api-details'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16v4H4z"/><path d="M4 10h16v4H4z"/><path d="M4 16h10v4H4z"/>
          </svg>
          <svg v-else-if="t.key === 'system'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span class="nav-label">{{ t.label }}</span>
        </button>
        <button
          class="nav-item nav-settings"
          :class="{ 'nav-active': activeTab === 'settings' }"
          @click="activeTab = 'settings'"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span class="nav-label">设置</span>
        </button>
      </nav>

      <main class="content">
        <div class="content-inner">
          <!-- 仪表盘 -->
          <DashboardCard v-if="activeTab === 'dashboard'" />

          <!-- 基础设置（服务端） -->
          <ServerConfigCard v-if="activeTab === 'server-config'" />

          <!-- 配置文件编辑 -->
          <ConfigFileCard v-if="activeTab === 'config-file'" />

          <!-- AI 提供商 -->
          <AiProvidersCard v-if="activeTab === 'ai-providers'" />

          <!-- Codex 账号 -->
          <CodexAccountCard v-if="activeTab === 'codex'" />

          <!-- 认证文件 -->
          <template v-if="activeTab === 'auth'">
            <AuthFilesCard />
            <AuthFilesOAuthCard />
          </template>

          <!-- OAuth -->
          <OAuthCard v-if="activeTab === 'oauth'" />

          <!-- API 密钥 -->
          <ApiKeysCard v-if="activeTab === 'api-keys'" />

          <!-- 使用统计 -->
          <template v-if="activeTab === 'usage'">
            <UsageStatsCard />
            <UsageImportExportCard />
            <ServiceHealthCard />
            <CredentialStatsCard />
            <RequestEventsDetailsCard />
          </template>

          <!-- 配额管理 -->
          <QuotaCard v-if="activeTab === 'quota'" />

          <!-- 日志 -->
          <LogsCard v-if="activeTab === 'logs'" />

          <!-- API 详细统计 -->
          <template v-if="activeTab === 'api-details'">
            <ApiDetailsCard />
          </template>

          <!-- 系统信息 -->
          <SystemCard v-if="activeTab === 'system'" />

          <!-- 设置 -->
          <template v-if="activeTab === 'settings'">
            <BaseCard title="启动设置" description="控制应用是否在系统启动时自动运行" headerGap="lg">
              <div class="setting-row">
                <div class="setting-info">
                  <div class="setting-name">开机自启动</div>
                  <div class="setting-value">
                    当前：
                    <span v-if="configStore.config" :class="configStore.config.autostart_enabled ? 'status-on' : 'status-off'">
                      {{ configStore.config.autostart_enabled ? "已开启" : "已关闭" }}
                    </span>
                    <span v-else class="status-muted">加载中...</span>
                  </div>
                </div>
                <button
                  class="btn-action"
                  :class="{ 'btn-action-on': configStore.config?.autostart_enabled }"
                  :disabled="configStore.working || !configStore.config"
                  @click="configStore.toggleAutostart"
                >
                  {{ configStore.config?.autostart_enabled ? "关闭自启动" : "开启自启动" }}
                </button>
              </div>
            </BaseCard>

            <BaseCard title="托盘与后台运行" description="控制系统托盘图标和关闭窗口时的行为" headerGap="lg">
              <div class="setting-row">
                <div class="setting-info">
                  <div class="setting-name">托盘图标</div>
                  <div class="setting-value">
                    当前：
                    <span v-if="configStore.config" :class="configStore.config.tray_enabled ? 'status-on' : 'status-off'">
                      {{ configStore.config.tray_enabled ? "已开启" : "已关闭" }}
                    </span>
                    <span v-else class="status-muted">加载中...</span>
                  </div>
                </div>
                <button
                  class="btn-action"
                  :class="{ 'btn-action-on': configStore.config?.tray_enabled }"
                  :disabled="configStore.working || !configStore.config"
                  @click="configStore.toggleTray"
                >
                  {{ configStore.config?.tray_enabled ? "关闭托盘" : "开启托盘" }}
                </button>
              </div>
              <div class="setting-row">
                <div class="setting-info">
                  <div class="setting-name">关闭时最小化到托盘</div>
                  <div class="setting-value">
                    <template v-if="configStore.config?.tray_enabled">
                      当前：
                      <span :class="configStore.config.close_to_tray ? 'status-on' : 'status-off'">
                        {{ configStore.config.close_to_tray ? "已开启" : "已关闭" }}
                      </span>
                    </template>
                    <span v-else class="status-muted">需开启托盘图标</span>
                  </div>
                </div>
                <button
                  class="btn-action"
                  :class="{ 'btn-action-on': configStore.config?.close_to_tray }"
                  :disabled="configStore.working || !configStore.config || !configStore.config.tray_enabled"
                  @click="configStore.toggleCloseToTray"
                >
                  {{ configStore.config?.close_to_tray ? "关闭" : "开启" }}
                </button>
              </div>
              <div class="setting-row">
                <div class="setting-info">
                  <div class="setting-name">最小化时保留 Dock 图标（仅 macOS）</div>
                  <div class="setting-value">
                    <template v-if="configStore.config?.tray_enabled">
                      当前：
                      <span :class="configStore.config.dock_visible_on_minimize ? 'status-on' : 'status-off'">
                        {{ configStore.config.dock_visible_on_minimize ? "已开启" : "已关闭" }}
                      </span>
                    </template>
                    <span v-else class="status-muted">需开启托盘图标</span>
                  </div>
                </div>
                <button
                  class="btn-action"
                  :class="{ 'btn-action-on': configStore.config?.dock_visible_on_minimize }"
                  :disabled="configStore.working || !configStore.config || !configStore.config.tray_enabled"
                  @click="configStore.toggleDockVisibleOnMinimize"
                >
                  {{ configStore.config?.dock_visible_on_minimize ? "关闭" : "开启" }}
                </button>
              </div>
            </BaseCard>

            <BaseCard title="自动刷新" description="定时刷新认证文件列表" headerGap="lg">
              <div class="setting-row">
                <div class="setting-info">
                  <div class="setting-name">列表自动刷新</div>
                  <div class="setting-value">
                    当前：
                    <span v-if="configStore.config" :class="configStore.config.auto_refresh_enabled ? 'status-on' : 'status-off'">
                      {{ configStore.config.auto_refresh_enabled ? "已开启" : "已关闭" }}
                    </span>
                    <span v-else class="status-muted">加载中...</span>
                  </div>
                </div>
                <button
                  class="btn-action"
                  :class="{ 'btn-action-on': configStore.config?.auto_refresh_enabled }"
                  :disabled="configStore.working || !configStore.config"
                  @click="configStore.toggleAutoRefresh"
                >
                  {{ configStore.config?.auto_refresh_enabled ? "关闭刷新" : "开启刷新" }}
                </button>
              </div>
              <div class="setting-row">
                <div class="setting-info">
                  <div class="setting-name">刷新间隔（秒）</div>
                  <div class="setting-value">
                    当前：
                    <span v-if="configStore.config">{{ configStore.config.auto_refresh_interval_seconds }} 秒</span>
                    <span v-else class="status-muted">加载中...</span>
                  </div>
                </div>
                <div class="setting-actions">
                  <input
                    class="setting-input"
                    v-model="autoRefreshSecondsInput"
                    type="number"
                    :min="AUTO_REFRESH_MIN_SECONDS"
                    :max="AUTO_REFRESH_MAX_SECONDS"
                    :disabled="configStore.working || !configStore.config"
                  />
                  <button
                    class="btn-action"
                    :disabled="configStore.working || !configStore.config"
                    @click="saveAutoRefreshInterval"
                  >
                    保存
                  </button>
                </div>
              </div>
              <p v-if="autoRefreshError" class="error-msg">{{ autoRefreshError }}</p>
            </BaseCard>

            <p v-if="configStore.error" class="error-msg">{{ configStore.error }}</p>
          </template>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.config-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* 顶部栏 */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 52px;
  background: #FFFFFF;
  border-bottom: 1px solid #E4E4E7;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  display: flex;
  align-items: center;
}

.topbar-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.app-name {
  font-size: 13px;
  font-weight: 600;
  color: #18181B;
  line-height: 1.3;
}

.app-desc {
  font-size: 11px;
  color: #A1A1AA;
  line-height: 1.3;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.account-badge {
  display: flex;
  align-items: center;
  gap: 6px;
}

.account-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #16A34A;
  flex-shrink: 0;
}

.account-server {
  font-size: 12px;
  color: #52525B;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-topbar {
  height: 28px;
  padding: 0 10px;
  background: transparent;
  color: #52525B;
  border: 1px solid #E4E4E7;
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.btn-topbar:hover {
  background: #FAFAFA;
  border-color: #D4D4D8;
  color: #18181B;
}

.btn-topbar-danger {
  color: #DC2626;
  border-color: #FECACA;
}

.btn-topbar-danger:hover {
  background: #FEF2F2;
  border-color: #FCA5A5;
  color: #DC2626;
}

/* 主体 */
.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* 侧边导航 */
.sidebar {
  width: 60px;
  background: #F4F4F5;
  border-right: 1px solid #E4E4E7;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 48px;
  height: 44px;
  margin-bottom: 4px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #71717A;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
  font-family: inherit;
}

.nav-item:hover {
  background: #E4E4E7;
  color: #27272A;
}

.nav-active {
  background: #E4E4E7;
  color: #18181B;
}

.nav-active:hover {
  background: #D4D4D8;
}

.nav-settings {
  margin-top: auto;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

/* 内容区 */
.content {
  flex: 1;
  overflow-y: auto;
  background: #F4F4F5;
}

.content-inner {
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  padding: 28px 32px;
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
  border-top: 1px solid #F4F4F5;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.setting-name {
  font-size: 14px;
  font-weight: 500;
  color: #27272A;
}

.setting-value {
  font-size: 12px;
  color: #71717A;
}

.setting-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-input {
  height: 32px;
  width: 90px;
  padding: 0 10px;
  border: 1px solid #E4E4E7;
  border-radius: 7px;
  font-size: 13px;
  color: #27272A;
  font-family: inherit;
  background: #FFFFFF;
}

.setting-input:disabled {
  background: #F4F4F5;
  color: #A1A1AA;
}

.status-on { color: #16A34A; font-weight: 500; }
.status-off { color: #A1A1AA; }
.status-muted { color: #A1A1AA; }

.btn-action {
  height: 32px;
  padding: 0 14px;
  background: #FAFAFA;
  color: #52525B;
  border: 1px solid #E4E4E7;
  border-radius: 7px;
  font-size: 13px;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.btn-action:hover:not(:disabled) {
  background: #F4F4F5;
  border-color: #D4D4D8;
  color: #18181B;
}

.btn-action-on {
  background: #18181B;
  color: #FFFFFF;
  border-color: #18181B;
}

.btn-action-on:hover:not(:disabled) {
  background: #27272A;
  border-color: #27272A;
  color: #FFFFFF;
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-msg {
  font-size: 13px;
  color: #DC2626;
  margin-top: 4px;
}
</style>
