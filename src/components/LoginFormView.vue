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
  <div class="form-view">
    <header class="view-header">
      <div>
        <h2 class="view-title">添加服务器</h2>
        <p class="view-desc">连接到新的 CPA 服务器</p>
      </div>
      <button
        v-if="hasAccounts"
        class="btn-back"
        type="button"
        :disabled="loading"
        @click="$emit('back')"
      >
        ← 返回列表
      </button>
    </header>

    <div class="fields">
      <div class="field">
        <label class="label">服务器地址</label>
        <input
          v-model="server"
          class="input"
          placeholder="https://api.example.com"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <div class="field">
        <label class="label">密码</label>
        <input
          v-model="password"
          class="input"
          type="password"
          placeholder="请输入密码"
        />
      </div>
      <label class="checkbox-label">
        <input v-model="rememberPassword" type="checkbox" class="checkbox-input" />
        <span>记住密码</span>
      </label>
    </div>

    <button
      class="btn-primary"
      type="button"
      :disabled="loading || !server.trim() || !password.trim()"
      @click="$emit('submit', { server: server.trim(), password, remember_password: rememberPassword })"
    >
      {{ loading ? "连接中..." : "连接服务器" }}
    </button>
  </div>
</template>

<style scoped>
.form-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.view-title {
  font-size: 18px;
  font-weight: 600;
  color: #18181B;
  letter-spacing: -0.2px;
  line-height: 1.3;
}

.view-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #71717A;
}

.btn-back {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 4px 0;
  font-size: 12px;
  color: #71717A;
  font-family: inherit;
  cursor: pointer;
  transition: color 150ms ease;
}

.btn-back:hover:not(:disabled) {
  color: #18181B;
}

.btn-back:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: #3F3F46;
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
</style>
