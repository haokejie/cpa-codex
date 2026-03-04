import { defineStore } from "pinia";
import { ref } from "vue";
import type { ModelInfo } from "../types";
import { fetchModels } from "../api/models";
import { normalizeModelList } from "../utils/models";
import { normalizeApiBase } from "../utils/connection";
import { CACHE_EXPIRY_MS } from "../utils/constants";

type ModelsCache = {
  server: string;
  timestamp: number;
};

export const useModelsStore = defineStore("models", () => {
  const models = ref<ModelInfo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const cache = ref<ModelsCache>({ server: "", timestamp: 0 });

  const isCacheValid = (server: string) => {
    if (!cache.value.server) return false;
    if (cache.value.server !== server) return false;
    return Date.now() - cache.value.timestamp < CACHE_EXPIRY_MS;
  };

  const clearCache = () => {
    cache.value = { server: "", timestamp: 0 };
    models.value = [];
  };

  const fetchForServer = async (
    server: string,
    apiKey?: string,
    forceRefresh: boolean = false,
  ) => {
    const normalized = normalizeApiBase(server);
    if (!normalized) {
      error.value = "服务器地址无效";
      models.value = [];
      return [];
    }

    if (!forceRefresh && isCacheValid(normalized)) {
      return models.value;
    }

    loading.value = true;
    error.value = null;
    try {
      const url = `${normalized}/v1/models`;
      const raw = await fetchModels(url, apiKey);
      const list = normalizeModelList(raw, { dedupe: true });
      models.value = list;
      cache.value = { server: normalized, timestamp: Date.now() };
      return list;
    } catch (e) {
      error.value = String(e);
      models.value = [];
      throw e;
    } finally {
      loading.value = false;
    }
  };

  return {
    models,
    loading,
    error,
    cache,
    isCacheValid,
    clearCache,
    fetchForServer,
  };
});
