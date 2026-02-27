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
      <h3>请输入密码</h3>
      <p v-if="account" class="meta">服务器地址：{{ account.server }}</p>
      <input v-model="password" type="password" placeholder="请输入密码" />
      <p v-if="error" class="error">{{ error }}</p>
      <label class="checkbox">
        <input v-model="remember" type="checkbox" />
        记住密码
      </label>
      <div class="actions">
        <button class="ghost" :disabled="loading" @click="$emit('close')">
          取消
        </button>
        <button
          class="primary"
          :disabled="loading || !password.trim()"
          @click="$emit('submit', { password, remember })"
        >
          {{ loading ? "登录中..." : "登录" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.dialog {
  width: 360px;
  background: #fff;
  border-radius: 14px;
  padding: 20px 22px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h3 {
  margin: 0;
  font-size: 18px;
}

.meta {
  color: #64748b;
  font-size: 13px;
  margin: 0;
}

input {
  border: 1px solid #cbd5f5;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 14px;
}

.error {
  color: #b91c1c;
  font-size: 13px;
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
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
