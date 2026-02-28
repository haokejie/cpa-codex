<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useConfigStore } from "../stores/config";
import { useAuthStore } from "../stores/auth";
import { useCodexStore } from "../stores/codex";
import CodexAccountCard from "./CodexAccountCard.vue";
import UsageStatsCard from "./UsageStatsCard.vue";
import AuthFilesCard from "./AuthFilesCard.vue";

const configStore = useConfigStore();
const authStore = useAuthStore();
const codexStore = useCodexStore();

onMounted(() => {
  configStore.refresh();
  codexStore.fetchConfigs();
  codexStore.refreshQuotas();
});

const accountLabel = computed(() => {
  const account = authStore.currentAccount;
  if (!account) return "未知";
  return account.server;
});
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

    <!-- 内容区 -->
    <main class="config-content">
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">启动设置</h2>
          <p class="card-desc">控制应用是否在系统启动时自动运行</p>
        </div>
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
      </section>

      <CodexAccountCard />

      <AuthFilesCard />

      <UsageStatsCard />

      <p v-if="configStore.error" class="error-msg">{{ configStore.error }}</p>
    </main>
  </div>
</template>

<style scoped>
.config-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #F4F4F5;
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

/* 内容区 */
.config-content {
  flex: 1;
  padding: 28px 32px;
  overflow-y: auto;
  max-width: 640px;
  width: 100%;
  margin: 0 auto;
}

.card {
  background: #FFFFFF;
  border: 1px solid #E4E4E7;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

.card-head {
  margin-bottom: 20px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #18181B;
  margin-bottom: 4px;
}

.card-desc {
  font-size: 12px;
  color: #A1A1AA;
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

.status-on {
  color: #16A34A;
  font-weight: 500;
}

.status-off {
  color: #A1A1AA;
}

.status-muted {
  color: #A1A1AA;
}

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
