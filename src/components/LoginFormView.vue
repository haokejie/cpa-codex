<script setup lang="ts">
import { ref } from "vue";
import type { LoginPayload } from "../types";

type Props = {
  loading?: boolean;
  hasAccounts?: boolean;
  defaultRemember?: boolean;
};

const props = defineProps<Props>();

defineEmits<{
  (e: "submit", payload: LoginPayload): void;
  (e: "back"): void;
}>();

const server = ref("");
const password = ref("");
const rememberPassword = ref(props.defaultRemember ?? true);
</script>

<template>
  <section class="card">
    <header class="card-header">
      <h2>登录新服务器</h2>
      <button
        v-if="hasAccounts"
        class="ghost"
        type="button"
        :disabled="loading"
        @click="$emit('back')"
      >
        返回服务器列表
      </button>
    </header>

    <div class="field">
      <label>服务器地址</label>
      <input v-model="server" placeholder="例如 https://api.example.com" />
    </div>

    <div class="field">
      <label>密码</label>
      <input v-model="password" type="password" placeholder="请输入密码" />
    </div>

    <label class="checkbox">
      <input v-model="rememberPassword" type="checkbox" />
      记住密码
    </label>

    <button
      class="primary"
      type="button"
      :disabled="loading"
      @click="
        $emit('submit', {
          server: server.trim(),
          password,
          remember_password: rememberPassword,
        })
      "
    >
      {{ loading ? "登录中..." : "登录" }}
    </button>
  </section>
</template>

<style scoped>
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: #0f172a;
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

.primary {
  background: #0f172a;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 16px;
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
