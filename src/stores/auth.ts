import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  getLastAccountKey,
  hasSavedPassword,
  listAccounts,
  login,
  loginWithSavedPassword,
  deleteAccount as deleteAccountApi,
} from "../api/account";
import type { Account, LoginPayload } from "../types";

export type AuthMode = "prompt" | "list" | "form" | "config";

export const useAuthStore = defineStore("auth", () => {
  const mode = ref<AuthMode>("form");
  const accounts = ref<Account[]>([]);
  const lastAccount = ref<Account | null>(null);
  const currentAccount = ref<Account | null>(null);
  const loading = ref(false);
  const error = ref("");
  const rememberPassword = ref(true);

  const hasAccounts = computed(() => accounts.value.length > 0);

  async function refreshAccounts() {
    const [list, lastKey] = await Promise.all([
      listAccounts(),
      getLastAccountKey(),
    ]);
    accounts.value = list;
    lastAccount.value = lastKey
      ? list.find((item) => item.account_key === lastKey) ?? null
      : null;
  }

  async function restoreSession() {
    loading.value = true;
    error.value = "";
    try {
      await refreshAccounts();
      if (lastAccount.value) {
        mode.value = "prompt";
      } else if (accounts.value.length > 0) {
        mode.value = "list";
      } else {
        mode.value = "form";
      }
    } catch (e) {
      error.value = String(e);
      mode.value = "form";
    } finally {
      loading.value = false;
    }
  }

  function enterList() {
    mode.value = "list";
  }

  function enterForm() {
    mode.value = "form";
  }

  function switchAccount() {
    currentAccount.value = null;
    mode.value = accounts.value.length > 0 ? "list" : "form";
  }

  async function loginExistingWithPassword(
    account: Account,
    password: string,
    remember: boolean
  ) {
    const payload: LoginPayload = {
      server: account.server,
      password,
      remember_password: remember,
    };
    await loginWithPayload(payload);
  }

  async function loginNew(payload: LoginPayload) {
    await loginWithPayload(payload);
  }

  async function loginWithPayload(payload: LoginPayload) {
    loading.value = true;
    error.value = "";
    try {
      await login(payload);
      await refreshAccounts();
      currentAccount.value = lastAccount.value ?? null;
      mode.value = "config";
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function loginExistingWithSavedPassword(account: Account) {
    loading.value = true;
    error.value = "";
    try {
      await loginWithSavedPassword(account.account_key);
      await refreshAccounts();
      currentAccount.value = lastAccount.value ?? account;
      mode.value = "config";
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function checkHasSavedPassword(account: Account) {
    return hasSavedPassword(account.account_key);
  }

  function logout() {
    currentAccount.value = null;
    error.value = "";
    mode.value = accounts.value.length > 0 ? "list" : "form";
  }

  async function deleteAccount(account: Account) {
    loading.value = true;
    error.value = "";
    try {
      await deleteAccountApi(account.account_key);
      await refreshAccounts();
      if (currentAccount.value?.account_key === account.account_key) {
        currentAccount.value = null;
      }
      if (mode.value === "config") {
        mode.value = accounts.value.length > 0 ? "list" : "form";
      } else if (mode.value !== "form" && accounts.value.length === 0) {
        mode.value = "form";
      }
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    mode,
    accounts,
    lastAccount,
    currentAccount,
    loading,
    error,
    rememberPassword,
    hasAccounts,
    restoreSession,
    refreshAccounts,
    enterList,
    enterForm,
    switchAccount,
    loginExistingWithPassword,
    loginExistingWithSavedPassword,
    loginNew,
    checkHasSavedPassword,
    logout,
    deleteAccount,
  };
});
