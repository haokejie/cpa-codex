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
  <div class="prompt">
    <div class="prompt-text">
      是否立即登录：
      <strong>{{ account.server }}</strong>
    </div>
    <div class="prompt-actions">
      <button class="primary" :disabled="loading" @click="$emit('confirm')">
        立即登录
      </button>
      <button class="ghost" :disabled="loading" @click="$emit('cancel')">
        取消
      </button>
    </div>
  </div>
</template>

<style scoped>
.prompt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 16px;
}

.prompt-text {
  color: #0f172a;
}

.prompt-actions {
  display: flex;
  gap: 8px;
}

.primary {
  background: #0f172a;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
}

.ghost {
  background: transparent;
  color: #0f172a;
  border: 1px solid #cbd5f5;
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
}

.primary:disabled,
.ghost:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
