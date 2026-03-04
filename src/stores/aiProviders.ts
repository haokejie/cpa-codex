import { defineStore } from "pinia";
import { ref } from "vue";
import type { AmpcodeConfig, AmpcodeModelMapping, GeminiKeyConfig, OpenAIProviderConfig, ProviderKeyConfig } from "../types";
import {
  getAmpcode,
  getModelMappings,
  updateForceModelMappings,
  updateUpstreamApiKey,
  updateUpstreamUrl,
  saveModelMappings,
  clearUpstreamApiKey,
  clearUpstreamUrl,
} from "../api/ampcode";
import {
  getGeminiConfigs,
  saveGeminiConfigs,
  getCodexProviderConfigs,
  saveCodexProviderConfigs,
  getClaudeConfigs,
  saveClaudeConfigs,
  getVertexConfigs,
  saveVertexConfigs,
  getOpenAIProviders,
  saveOpenAIProviders,
} from "../api/providers";

export const useAiProvidersStore = defineStore("aiProviders", () => {
  const loading = ref(false);
  const working = ref(false);
  const error = ref<string | null>(null);

  const gemini = ref<GeminiKeyConfig[]>([]);
  const codex = ref<ProviderKeyConfig[]>([]);
  const claude = ref<ProviderKeyConfig[]>([]);
  const vertex = ref<ProviderKeyConfig[]>([]);
  const openai = ref<OpenAIProviderConfig[]>([]);
  const ampcode = ref<AmpcodeConfig | null>(null);
  const ampcodeMappings = ref<AmpcodeModelMapping[]>([]);

  async function refreshAll() {
    loading.value = true;
    error.value = null;
    try {
      const results = await Promise.allSettled([
        getGeminiConfigs(),
        getCodexProviderConfigs(),
        getClaudeConfigs(),
        getVertexConfigs(),
        getOpenAIProviders(),
        getAmpcode(),
        getModelMappings(),
      ]);

      gemini.value = results[0].status === "fulfilled" ? results[0].value : [];
      codex.value = results[1].status === "fulfilled" ? results[1].value : [];
      claude.value = results[2].status === "fulfilled" ? results[2].value : [];
      vertex.value = results[3].status === "fulfilled" ? results[3].value : [];
      openai.value = results[4].status === "fulfilled" ? results[4].value : [];
      ampcode.value = results[5].status === "fulfilled" ? results[5].value : null;
      ampcodeMappings.value = results[6].status === "fulfilled" ? results[6].value : [];
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function runUpdate(task: () => Promise<void>) {
    working.value = true;
    error.value = null;
    try {
      await task();
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      working.value = false;
    }
  }

  async function saveGemini(list: GeminiKeyConfig[]) {
    await runUpdate(async () => {
      await saveGeminiConfigs(list);
      gemini.value = [...list];
    });
  }

  async function saveCodex(list: ProviderKeyConfig[]) {
    await runUpdate(async () => {
      await saveCodexProviderConfigs(list);
      codex.value = [...list];
    });
  }

  async function saveClaude(list: ProviderKeyConfig[]) {
    await runUpdate(async () => {
      await saveClaudeConfigs(list);
      claude.value = [...list];
    });
  }

  async function saveVertex(list: ProviderKeyConfig[]) {
    await runUpdate(async () => {
      await saveVertexConfigs(list);
      vertex.value = [...list];
    });
  }

  async function saveOpenAI(list: OpenAIProviderConfig[]) {
    await runUpdate(async () => {
      await saveOpenAIProviders(list);
      openai.value = [...list];
    });
  }

  async function updateAmpcodeConfig(next: AmpcodeConfig) {
    await runUpdate(async () => {
      if (next.upstreamUrl !== undefined) {
        if (next.upstreamUrl) {
          await updateUpstreamUrl(next.upstreamUrl);
        } else {
          await clearUpstreamUrl();
        }
      }
      if (next.upstreamApiKey !== undefined) {
        if (next.upstreamApiKey) {
          await updateUpstreamApiKey(next.upstreamApiKey);
        } else {
          await clearUpstreamApiKey();
        }
      }
      if (next.forceModelMappings !== undefined) {
        await updateForceModelMappings(Boolean(next.forceModelMappings));
      }
      ampcode.value = {
        ...(ampcode.value || {}),
        ...next,
      };
    });
  }

  async function saveAmpcodeMappings(mappings: AmpcodeModelMapping[]) {
    await runUpdate(async () => {
      await saveModelMappings(mappings);
      ampcodeMappings.value = [...mappings];
    });
  }

  return {
    loading,
    working,
    error,
    gemini,
    codex,
    claude,
    vertex,
    openai,
    ampcode,
    ampcodeMappings,
    refreshAll,
    saveGemini,
    saveCodex,
    saveClaude,
    saveVertex,
    saveOpenAI,
    updateAmpcodeConfig,
    saveAmpcodeMappings,
  };
});
