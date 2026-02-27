<script setup lang="ts">
import type { Account } from "../types";

type Props = {
  accounts: Account[];
  loading?: boolean;
};

defineProps<Props>();

defineEmits<{
  (e: "login", account: Account): void;
  (e: "remove", account: Account): void;
  (e: "new"): void;
}>();
</script>

<template>
  <section class="card">
    <header class="card-header">
      <h2>服务器列表</h2>
      <button class="primary" type="button" :disabled="loading" @click="$emit('new')">
        登录新服务器
      </button>
    </header>
    <div v-if="accounts.length === 0" class="empty">暂无账号</div>
    <ul v-else class="list">
      <li v-for="account in accounts" :key="account.account_key" class="item">
        <div class="info">
          <div class="name">{{ account.server }}</div>
          <div class="meta">服务器地址</div>
        </div>
        <div class="actions">
          <span class="tag">{{ account.has_password ? "已记住" : "需输入密码" }}</span>
          <button
            class="ghost"
            type="button"
            :disabled="loading"
            @click.stop="$emit('login', account)"
          >
            登录
          </button>
          <button
            class="danger"
            type="button"
            :disabled="loading"
            @click.stop="$emit('remove', account)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 16px;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name {
  font-weight: 600;
  color: #0f172a;
}

.meta {
  color: #64748b;
  font-size: 13px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag {
  background: #f1f5f9;
  color: #475569;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
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

.danger {
  background: transparent;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
}

.primary:disabled,
.ghost:disabled,
.danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty {
  color: #94a3b8;
}
</style>
