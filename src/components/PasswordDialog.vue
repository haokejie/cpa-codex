<script setup lang="ts">
import { ref, watch } from "vue";
import type { Account } from "../types";

type Props = {
  open: boolean;
  account: Account | null;
  loading?: boolean;
  defaultRemember?: boolean;
  error?: string;
};

const props = defineProps<Props>();

defineEmits<{
  (e: "submit", payload: { password: string; remember: boolean }): void;
  (e: "close"): void;
}>();

const password = ref("");
const remember = ref(true);

watch(
  () => props.open,
  (open) => {
    if (open) {
      password.value = "";
      remember.value = props.defaultRemember ?? true;
    }
  }
);
</script>

<template>
  <div v-if="open" class="mask">
    <div class="dialog">
      <div class="dialog-header">
        <div class="dialog-title-group">
          <h3 class="dialog-title">输入密码</h3>
          <p v-if="account" class="dialog-meta">{{ account.server }}</p>
        </div>
        <button class="btn-close" :disabled="loading" @click="$emit('close')">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        <input
          v-model="password"
          class="input"
          type="password"
          placeholder="请输入密码"
        />
        <p v-if="error" class="error-msg">{{ error }}</p>
        <label class="checkbox-label">
          <input v-model="remember" type="checkbox" class="checkbox-input" />
          <span>记住密码</span>
        </label>
      </div>

      <div class="dialog-footer">
        <button class="btn-ghost" :disabled="loading" @click="$emit('close')">
          取消
        </button>
        <button
          class="btn-primary"
          :disabled="loading || !password.trim()"
          @click="$emit('submit', { password, remember })"
        >
          {{ loading ? "连接中..." : "连接" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(9, 9, 11, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(2px);
}

.dialog {
  width: 360px;
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.14);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 0;
}

.dialog-title-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #18181B;
}

.dialog-meta {
  font-size: 12px;
  color: #71717A;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 270px;
}

.btn-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: #A1A1AA;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}

.btn-close:hover:not(:disabled) {
  background: #F4F4F5;
  color: #52525B;
}

.btn-close:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dialog-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #E4E4E7;
  border-radius: 7px;
  background: #FAFAFA;
  color: #18181B;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
}

.input:focus {
  border-color: #6366F1;
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.10);
}

.input::placeholder {
  color: #A1A1AA;
}

.error-msg {
  font-size: 12px;
  color: #DC2626;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #52525B;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: #18181B;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 4px 20px 20px;
}

.btn-ghost {
  height: 34px;
  padding: 0 14px;
  background: transparent;
  color: #52525B;
  border: 1px solid #E4E4E7;
  border-radius: 7px;
  font-size: 13px;
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
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  height: 34px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #18181B;
  color: #FFFFFF;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, opacity 150ms ease;
}

.btn-primary:hover:not(:disabled) {
  background: #27272A;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
