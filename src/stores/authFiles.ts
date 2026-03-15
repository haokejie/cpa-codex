import { defineStore } from "pinia";
import { ref } from "vue";
import type { AuthFileItem } from "../types";
import { listAuthFiles, setAuthFileStatus, deleteAuthFile, deleteAllAuthFiles, uploadAuthFile } from "../api/authFiles";

export const useAuthFilesStore = defineStore("authFiles", () => {
  const files = ref<AuthFileItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const uploading = ref(false);
  const uploadError = ref<string | null>(null);
  const lastFetchedAt = ref(0);

  async function fetchFiles() {
    loading.value = true;
    error.value = null;
    try {
      files.value = await listAuthFiles();
      lastFetchedAt.value = Date.now();
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function ensureFiles() {
    if (loading.value) return;
    if (lastFetchedAt.value > 0) return;
    await fetchFiles();
  }

  function setUploadError(message: string | null) {
    uploadError.value = message;
  }

  async function uploadFiles(items: File[]) {
    const filesToUpload = items.filter(Boolean);
    if (filesToUpload.length === 0) return { uploaded: [], failed: [] };
    uploading.value = true;
    uploadError.value = null;
    const results = await Promise.allSettled(filesToUpload.map((file) => uploadAuthFile(file)));
    const uploaded: string[] = [];
    const failed: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") uploaded.push(filesToUpload[index].name);
      else failed.push(filesToUpload[index].name);
    });
    if (uploaded.length > 0) {
      await fetchFiles();
    }
    if (failed.length > 0) {
      uploadError.value = `上传失败：${failed.join(", ")}`;
    }
    uploading.value = false;
    return { uploaded, failed };
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

  function reset() {
    files.value = [];
    error.value = null;
    uploadError.value = null;
    loading.value = false;
    uploading.value = false;
    lastFetchedAt.value = 0;
  }

  return {
    files,
    loading,
    error,
    uploading,
    uploadError,
    lastFetchedAt,
    fetchFiles,
    ensureFiles,
    reset,
    setUploadError,
    uploadFiles,
    toggleDisabled,
    remove,
    removeBatch,
    removeAll
  };
});
