<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useAuthStore } from "./stores/auth";
import type { Account, LoginPayload } from "./types";
import LoginPromptBar from "./components/LoginPromptBar.vue";
import AccountListView from "./components/AccountListView.vue";
import LoginFormView from "./components/LoginFormView.vue";
import PasswordDialog from "./components/PasswordDialog.vue";
import ConfigView from "./components/ConfigView.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";

const auth = useAuthStore();
const pendingAccount = ref<Account | null>(null);
const passwordDialogOpen = ref(false);
const deleteDialogOpen = ref(false);
const deleteTarget = ref<Account | null>(null);

onMounted(() => {
  auth.restoreSession();
});

async function tryLogin(account: Account) {
  try {
    const hasPassword = await auth.checkHasSavedPassword(account);
    if (hasPassword) {
      await auth.loginExistingWithSavedPassword(account);
      return;
    }
    auth.rememberPassword = account.remember_password;
    auth.error = "";
    pendingAccount.value = account;
    passwordDialogOpen.value = true;
  } catch (e) {
    auth.error = String(e);
  }
}

async function handlePromptConfirm() {
  if (!auth.lastAccount) return;
  await tryLogin(auth.lastAccount);
}

function handlePromptCancel() {
  auth.enterList();
}

async function handleAccountLogin(account: Account) {
  await tryLogin(account);
}

async function handlePasswordSubmit(payload: { password: string; remember: boolean }) {
  if (!pendingAccount.value) return;
  auth.rememberPassword = payload.remember;
  try {
    await auth.loginExistingWithPassword(
      pendingAccount.value,
      payload.password,
      payload.remember
    );
    passwordDialogOpen.value = false;
    pendingAccount.value = null;
  } catch {
    // 保持弹窗，显示错误
  }
}

function handlePasswordClose() {
  passwordDialogOpen.value = false;
  pendingAccount.value = null;
  auth.error = "";
}

async function handleNewLogin(payload: LoginPayload) {
  auth.error = "";
  auth.rememberPassword = payload.remember_password ?? true;
  try {
    await auth.loginNew(payload);
  } catch {
    // 错误由 store 处理
  }
}

function handleDeleteAccount(account: Account) {
  deleteTarget.value = account;
  deleteDialogOpen.value = true;
}

async function handleDeleteConfirm() {
  if (!deleteTarget.value) return;
  try {
    await auth.deleteAccount(deleteTarget.value);
    deleteDialogOpen.value = false;
    deleteTarget.value = null;
  } catch {
    // 错误由 store 处理
  }
}

function handleDeleteCancel() {
  deleteDialogOpen.value = false;
  deleteTarget.value = null;
}
</script>

<template>
  <ConfigView v-if="auth.mode === 'config'" />

  <main v-else class="page">
    <section class="shell">
      <header class="title">
        <h1>服务器登录</h1>
        <p class="subtitle">请选择服务器继续，或登录新服务器。</p>
      </header>

      <LoginPromptBar
        v-if="auth.mode === 'prompt' && auth.lastAccount"
        :account="auth.lastAccount"
        :loading="auth.loading"
        @confirm="handlePromptConfirm"
        @cancel="handlePromptCancel"
      />

      <AccountListView
        v-if="auth.mode === 'list'"
        :accounts="auth.accounts"
        :loading="auth.loading"
        @login="handleAccountLogin"
        @remove="handleDeleteAccount"
        @new="auth.enterForm"
      />

      <LoginFormView
        v-if="auth.mode === 'form'"
        :loading="auth.loading"
        :has-accounts="auth.hasAccounts"
        :default-remember="auth.rememberPassword"
        @submit="handleNewLogin"
        @back="auth.enterList"
      />

      <p v-if="auth.error" class="error">{{ auth.error }}</p>
    </section>
  </main>

  <PasswordDialog
    :open="passwordDialogOpen"
    :account="pendingAccount"
    :loading="auth.loading"
    :default-remember="auth.rememberPassword"
    :error="auth.error"
    @submit="handlePasswordSubmit"
    @close="handlePasswordClose"
  />

  <ConfirmDialog
    :open="deleteDialogOpen"
    title="删除服务器"
    :message="deleteTarget ? `确定删除服务器 ${deleteTarget.server} 吗？` : ''"
    :loading="auth.loading"
    @confirm="handleDeleteConfirm"
    @cancel="handleDeleteCancel"
  />
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
}

.shell {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: "Source Sans 3", "Noto Sans SC", system-ui, sans-serif;
  color: #0f172a;
}

.title {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

h1 {
  margin: 0;
  font-size: 28px;
}

.subtitle {
  margin: 0;
  color: #64748b;
}

.error {
  color: #b91c1c;
  margin-top: 4px;
}
</style>
