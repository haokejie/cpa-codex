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

  <div v-else class="auth-layout">
    <!-- 左侧品牌面板 -->
    <aside class="brand-panel">
      <div class="brand-inner">
        <div class="brand-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="3" width="30" height="7" rx="2.5" fill="white" opacity="0.3" />
            <rect x="1" y="12" width="30" height="7" rx="2.5" fill="white" opacity="0.6" />
            <rect x="1" y="21" width="30" height="7" rx="2.5" fill="white" opacity="0.9" />
          </svg>
        </div>
        <h1 class="brand-name">CPA Codex</h1>
        <p class="brand-tagline">后台常驻<br>轻松管理服务器连接</p>
      </div>
    </aside>

    <!-- 右侧表单面板 -->
    <main class="form-panel">
      <div class="form-inner">
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

        <p v-if="auth.error" class="form-error">{{ auth.error }}</p>
      </div>
    </main>
  </div>

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
.auth-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 左侧品牌面板 */
.brand-panel {
  width: 260px;
  flex-shrink: 0;
  background: #18181B;
  display: flex;
  align-items: center;
  padding: 40px 32px;
  user-select: none;
}

.brand-inner {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.brand-icon {
  display: flex;
}

.brand-name {
  font-size: 22px;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.brand-tagline {
  font-size: 13px;
  color: #71717A;
  line-height: 1.7;
}

/* 右侧表单面板 */
.form-panel {
  flex: 1;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  overflow-y: auto;
}

.form-inner {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-error {
  font-size: 13px;
  color: #DC2626;
}
</style>
