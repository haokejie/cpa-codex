import { defineStore } from "pinia";
import { ref } from "vue";
import type { AuthFileItem } from "../types";
import { listAuthFiles, setAuthFileStatus, deleteAuthFile, deleteAllAuthFiles } from "../api/authFiles";

export const useAuthFilesStore = defineStore("authFiles", () => {
  const files = ref<AuthFileItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchFiles() {
    loading.value = true;
    error.value = null;
    try {
      files.value = await listAuthFiles();
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function toggleDisabled(name: string, disabled: boolean) {
    await setAuthFileStatus(name, disabled);
    const f = files.value.find((f) => f.name === name);
    if (f) f.disabled = disabled;
  }

  async function remove(name: string) {
    await deleteAuthFile(name);
    files.value = files.value.filter((f) => f.name !== name);
  }

  async function removeAll() {
    await deleteAllAuthFiles();
    files.value = [];
  }

  return { files, loading, error, fetchFiles, toggleDisabled, remove, removeAll };
});
