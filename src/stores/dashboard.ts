import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { listApiKeys } from "../api/apiKeys";
import { listAuthFiles } from "../api/authFiles";
import {
  getClaudeConfigs,
  getCodexProviderConfigs,
  getGeminiConfigs,
  getOpenAIProviders,
  getVertexConfigs,
} from "../api/providers";

type ProviderStats = {
  gemini: number | null;
  codex: number | null;
  claude: number | null;
  vertex: number | null;
  openai: number | null;
};

export const useDashboardStore = defineStore("dashboard", () => {
  const apiKeysCount = ref<number | null>(null);
  const authFilesCount = ref<number | null>(null);
  const providerStats = ref<ProviderStats>({
    gemini: null,
    codex: null,
    claude: null,
    vertex: null,
    openai: null,
  });
  const loading = ref(false);
  const error = ref<string | null>(null);

  const providerStatsReady = computed(() =>
    Object.values(providerStats.value).every((value) => value !== null),
  );

  const totalProviderKeys = computed(() => {
    if (!providerStatsReady.value) return null;
    return (
      (providerStats.value.gemini ?? 0) +
      (providerStats.value.codex ?? 0) +
      (providerStats.value.claude ?? 0) +
      (providerStats.value.vertex ?? 0) +
      (providerStats.value.openai ?? 0)
    );
  });

  async function refresh() {
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      const results = await Promise.allSettled([
        listApiKeys(),
        listAuthFiles(),
        getGeminiConfigs(),
        getCodexProviderConfigs(),
        getClaudeConfigs(),
        getVertexConfigs(),
        getOpenAIProviders(),
      ]);

      apiKeysCount.value = results[0].status === "fulfilled" ? results[0].value.length : null;
      authFilesCount.value = results[1].status === "fulfilled" ? results[1].value.length : null;
      providerStats.value = {
        gemini: results[2].status === "fulfilled" ? results[2].value.length : null,
        codex: results[3].status === "fulfilled" ? results[3].value.length : null,
        claude: results[4].status === "fulfilled" ? results[4].value.length : null,
        vertex: results[5].status === "fulfilled" ? results[5].value.length : null,
        openai: results[6].status === "fulfilled" ? results[6].value.length : null,
      };
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  function clear() {
    apiKeysCount.value = null;
    authFilesCount.value = null;
    providerStats.value = {
      gemini: null,
      codex: null,
      claude: null,
      vertex: null,
      openai: null,
    };
    error.value = null;
  }

  return {
    apiKeysCount,
    authFilesCount,
    providerStats,
    providerStatsReady,
    totalProviderKeys,
    loading,
    error,
    refresh,
    clear,
  };
});
