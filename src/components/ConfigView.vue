<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useConfigStore } from "../stores/config";
import { useAuthStore } from "../stores/auth";

const configStore = useConfigStore();
const authStore = useAuthStore();

onMounted(configStore.refresh);

const accountLabel = computed(() => {
  const account = authStore.currentAccount;
  if (!account) return "未知";
  return account.server;
});
</script>

<template>
  <main class="container">
    <header>
      <h1>配置中心</h1>
      <p class="subtitle">后台任务常驻运行，当前页面仅用于配置。</p>
      <div class="account">
        <span class="muted">当前服务器：{{ accountLabel }}</span>
        <div class="account-actions">
          <button class="ghost" @click="authStore.switchAccount">切换服务器</button>
          <button class="ghost" @click="authStore.logout">退出登录</button>
        </div>
      </div>
    </header>

    <section class="card">
      <h2>启动设置</h2>
      <p v-if="configStore.config">
        当前开机自启：
        <strong>{{ configStore.config.autostart_enabled ? "已开启" : "已关闭" }}</strong>
      </p>
      <p v-else>配置加载中...</p>
      <button
        class="primary"
        :disabled="configStore.working || !configStore.config"
        @click="configStore.toggleAutostart"
      >
        {{ configStore.config?.autostart_enabled ? "关闭自启动" : "开启自启动" }}
      </button>
    </section>

    <p v-if="configStore.error" class="error">{{ configStore.error }}</p>
  </main>
</template>

<style scoped>
:root {
  color: #111827;
}

.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px;
  font-family: "Source Sans 3", "Noto Sans SC", system-ui, sans-serif;
  color: #0f172a;
}

header {
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h1 {
  font-size: 32px;
  margin: 0 0 8px;
}

.subtitle {
  color: #475569;
  margin: 0;
}

.account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 14px;
  background: #f8fafc;
}

.account-actions {
  display: flex;
  gap: 8px;
}

.card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.primary {
  margin-top: 12px;
  background: #0f172a;
  color: #fff;
  border: none;
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost {
  background: transparent;
  color: #0f172a;
  border: 1px solid #cbd5f5;
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
}

.muted {
  color: #64748b;
}

.error {
  color: #b91c1c;
  margin-top: 12px;
}
</style>
