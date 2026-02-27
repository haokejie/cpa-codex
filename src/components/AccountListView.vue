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
  <div class="list-view">
    <header class="view-header">
      <h2 class="view-title">选择服务器</h2>
      <p class="view-desc">选择已保存的服务器，或添加新服务器</p>
    </header>

    <div v-if="accounts.length === 0" class="empty-state">
      暂无已保存的服务器
    </div>

    <ul v-else class="server-list">
      <li
        v-for="account in accounts"
        :key="account.account_key"
        class="server-item"
        :class="{ 'is-loading': loading }"
        @click="!loading && $emit('login', account)"
      >
        <div class="server-info">
          <div class="server-url">{{ account.server }}</div>
          <div class="server-meta">
            <span class="tag" :class="account.has_password ? 'tag-saved' : 'tag-manual'">
              {{ account.has_password ? "密码已记住" : "需手动输入" }}
            </span>
          </div>
        </div>
        <button
          class="btn-delete"
          type="button"
          :disabled="loading"
          title="删除"
          @click.stop="$emit('remove', account)"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </li>
    </ul>

    <button class="btn-add" type="button" :disabled="loading" @click="$emit('new')">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      添加新服务器
    </button>
  </div>
</template>

<style scoped>
.list-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.empty-state {
  padding: 24px;
  text-align: center;
  color: #A1A1AA;
  font-size: 13px;
  border: 1px dashed #E4E4E7;
  border-radius: 10px;
}

.server-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 250px;
  overflow-y: auto;
}

.server-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 13px;
  border: 1px solid #E4E4E7;
  border-radius: 9px;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.server-item:hover:not(.is-loading) {
  background: #FAFAFA;
  border-color: #D4D4D8;
}

.server-item.is-loading {
  cursor: not-allowed;
  opacity: 0.6;
}

.server-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.server-url {
  font-size: 13px;
  font-weight: 500;
  color: #18181B;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-meta {
  display: flex;
  align-items: center;
}

.tag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.tag-saved {
  background: #F0FDF4;
  color: #16A34A;
}

.tag-manual {
  background: #F4F4F5;
  color: #71717A;
}

.btn-delete {
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

.btn-delete:hover:not(:disabled) {
  background: #FEF2F2;
  color: #DC2626;
}

.btn-delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  background: transparent;
  color: #52525B;
  border: 1px dashed #D4D4D8;
  border-radius: 7px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.btn-add:hover:not(:disabled) {
  background: #FAFAFA;
  border-color: #A1A1AA;
  color: #18181B;
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
