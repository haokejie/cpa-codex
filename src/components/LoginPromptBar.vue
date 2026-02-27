<script setup lang="ts">
import type { Account } from "../types";

type Props = {
  account: Account;
  loading?: boolean;
};

defineProps<Props>();

defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <div class="prompt-view">
    <header class="view-header">
      <h2 class="view-title">快速登录</h2>
      <p class="view-desc">上次连接的服务器</p>
    </header>

    <div class="server-card">
      <div class="server-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1.5" width="14" height="3.5" rx="1.5" fill="currentColor" opacity="0.35" />
          <rect x="1" y="6" width="14" height="3.5" rx="1.5" fill="currentColor" opacity="0.65" />
          <rect x="1" y="11" width="14" height="3.5" rx="1.5" fill="currentColor" />
        </svg>
      </div>
      <span class="server-url">{{ account.server }}</span>
    </div>

    <div class="actions">
      <button class="btn-primary" :disabled="loading" @click="$emit('confirm')">
        {{ loading ? "连接中..." : "立即连接" }}
      </button>
      <button class="btn-ghost" :disabled="loading" @click="$emit('cancel')">
        切换账号
      </button>
    </div>
  </div>
</template>

<style scoped>
.prompt-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.view-title {
  font-size: 18px;
  font-weight: 600;
  color: #18181B;
  letter-spacing: -0.2px;
  line-height: 1.3;
}

.view-desc {
  font-size: 13px;
  color: #71717A;
}

.server-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: #FAFAFA;
  border: 1px solid #E4E4E7;
  border-radius: 10px;
}

.server-icon {
  flex-shrink: 0;
  display: flex;
  color: #71717A;
}

.server-url {
  font-size: 13px;
  font-weight: 500;
  color: #18181B;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-primary {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #18181B;
  color: #FFFFFF;
  border: none;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, opacity 150ms ease;
}

.btn-primary:hover:not(:disabled) {
  background: #27272A;
}

.btn-primary:active:not(:disabled) {
  background: #3F3F46;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-ghost {
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #52525B;
  border: 1px solid #E4E4E7;
  border-radius: 7px;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.btn-ghost:hover:not(:disabled) {
  background: #FAFAFA;
  border-color: #D4D4D8;
  color: #18181B;
}

.btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
