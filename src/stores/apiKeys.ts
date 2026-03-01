import { defineStore } from "pinia";
import { ref } from "vue";
import { listApiKeys, replaceApiKeys, updateApiKey, deleteApiKey } from "../api/apiKeys";

export const useApiKeysStore = defineStore("apiKeys", () => {
  const keys = ref<string[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const working = ref(false);

  async function fetchKeys() {
    loading.value = true;
    error.value = null;
    try {
      keys.value = await listApiKeys();
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function replaceKeys(nextKeys: string[]) {
    working.value = true;
    error.value = null;
    try {
      await replaceApiKeys(nextKeys);
      keys.value = [...nextKeys];
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      working.value = false;
    }
  }

  async function addKey(value: string) {
    const nextKeys = [...keys.value, value];
    await replaceKeys(nextKeys);
  }

  async function updateKey(index: number, value: string) {
    working.value = true;
    error.value = null;
    try {
      await updateApiKey(index, value);
      keys.value = keys.value.map((k, i) => (i === index ? value : k));
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      working.value = false;
    }
  }

  async function removeKey(index: number) {
    working.value = true;
    error.value = null;
    try {
      await deleteApiKey(index);
      keys.value = keys.value.filter((_, i) => i !== index);
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      working.value = false;
    }
  }

  async function clearKeys() {
    await replaceKeys([]);
  }

  return {
    keys,
    loading,
    error,
    working,
    fetchKeys,
    replaceKeys,
    addKey,
    updateKey,
    removeKey,
    clearKeys,
  };
});
