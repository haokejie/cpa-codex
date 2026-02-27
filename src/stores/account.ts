import { defineStore } from "pinia";
import { ref } from "vue";
import { listAccounts, deleteAccount } from "../api/account";
import type { Account } from "../types";

export const useAccountStore = defineStore("account", () => {
  const accounts = ref<Account[]>([]);
  const error = ref("");

  async function refresh() {
    error.value = "";
    try {
      accounts.value = await listAccounts();
    } catch (e) {
      error.value = String(e);
    }
  }

  async function remove(accountKey: string) {
    await deleteAccount(accountKey);
    await refresh();
  }

  return { accounts, error, refresh, remove };
});
