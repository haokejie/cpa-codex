import { defineStore } from "pinia";
import { ref } from "vue";
import type { AuthFileItem } from "../types";
import { listAuthFiles, syncAuthFiles, setAuthFileStatus, deleteAuthFile, deleteAllAuthFiles } from "../api/authFiles";

export const useAuthFilesStore = defineStore("authFiles", () => {
  const files = ref<AuthFileItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchFiles() {
    loading.value = true;
    error.value = null;
    try {
      await syncAuthFiles();
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

  async function removeBatch(names: string[]) {
    const unique = Array.from(new Set(names)).filter(Boolean);
    if (unique.length === 0) return { deleted: [], failed: [] };
    const results = await Promise.allSettled(unique.map((name) => deleteAuthFile(name)));
    const deleted: string[] = [];
    const failed: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") deleted.push(unique[index]);
      else failed.push(unique[index]);
    });
    if (deleted.length > 0) {
      const deletedSet = new Set(deleted);
      files.value = files.value.filter((f) => !deletedSet.has(f.name));
    }
    return { deleted, failed };
  }

  async function removeAll() {
    await deleteAllAuthFiles();
    files.value = [];
  }

  return { files, loading, error, fetchFiles, toggleDisabled, remove, removeBatch, removeAll };
});
