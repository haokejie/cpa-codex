import { defineStore } from "pinia";
import { ref } from "vue";
import type { AuthFileModelDefinition, OAuthModelAliasEntry } from "../types";
import {
  downloadAuthFileText as apiDownloadAuthFileText,
  getModelsForAuthFile,
  getModelDefinitions,
  getOauthExcludedModels,
  saveOauthExcludedModels,
  deleteOauthExcludedEntry,
  getOauthModelAlias,
  saveOauthModelAlias,
  deleteOauthModelAlias,
} from "../api/authFilesPlus";

export const useAuthFilesExtrasStore = defineStore("authFilesExtras", () => {
  const excludedModels = ref<Record<string, string[]>>({});
  const modelAlias = ref<Record<string, OAuthModelAliasEntry[]>>({});
  const excludedLoading = ref(false);
  const modelAliasLoading = ref(false);
  const excludedError = ref<string | null>(null);
  const modelAliasError = ref<string | null>(null);

  async function loadExcluded() {
    excludedLoading.value = true;
    excludedError.value = null;
    try {
      excludedModels.value = await getOauthExcludedModels();
    } catch (e) {
      excludedError.value = String(e);
    } finally {
      excludedLoading.value = false;
    }
  }

  async function loadModelAlias() {
    modelAliasLoading.value = true;
    modelAliasError.value = null;
    try {
      modelAlias.value = await getOauthModelAlias();
    } catch (e) {
      modelAliasError.value = String(e);
    } finally {
      modelAliasLoading.value = false;
    }
  }

  async function refreshAll() {
    await Promise.allSettled([loadExcluded(), loadModelAlias()]);
  }

  async function saveExcluded(provider: string, models: string[]) {
    const key = provider.trim().toLowerCase();
    if (!key) throw new Error("请填写 Provider");
    excludedError.value = null;
    try {
      await saveOauthExcludedModels(key, models);
      const next = { ...excludedModels.value };
      if (models.length) {
        next[key] = models;
      } else {
        delete next[key];
      }
      excludedModels.value = next;
    } catch (e) {
      excludedError.value = String(e);
      throw e;
    }
  }

  async function deleteExcluded(provider: string) {
    const key = provider.trim().toLowerCase();
    if (!key) throw new Error("请填写 Provider");
    excludedError.value = null;
    try {
      await deleteOauthExcludedEntry(key);
      const next = { ...excludedModels.value };
      delete next[key];
      excludedModels.value = next;
    } catch (e) {
      excludedError.value = String(e);
      throw e;
    }
  }

  async function saveAlias(channel: string, aliases: OAuthModelAliasEntry[]) {
    const key = channel.trim().toLowerCase();
    if (!key) throw new Error("请填写 Channel");
    modelAliasError.value = null;
    try {
      await saveOauthModelAlias(key, aliases);
      const next = { ...modelAlias.value };
      if (aliases.length) {
        next[key] = aliases;
      } else {
        delete next[key];
      }
      modelAlias.value = next;
    } catch (e) {
      modelAliasError.value = String(e);
      throw e;
    }
  }

  async function deleteAlias(channel: string) {
    const key = channel.trim().toLowerCase();
    if (!key) throw new Error("请填写 Channel");
    modelAliasError.value = null;
    try {
      await deleteOauthModelAlias(key);
      const next = { ...modelAlias.value };
      delete next[key];
      modelAlias.value = next;
    } catch (e) {
      modelAliasError.value = String(e);
      throw e;
    }
  }

  async function downloadAuthFileText(name: string): Promise<string> {
    return apiDownloadAuthFileText(name);
  }

  async function fetchModelsForFile(name: string): Promise<AuthFileModelDefinition[]> {
    return getModelsForAuthFile(name) as Promise<AuthFileModelDefinition[]>;
  }

  async function fetchModelDefinitionsForChannel(channel: string): Promise<AuthFileModelDefinition[]> {
    return getModelDefinitions(channel) as Promise<AuthFileModelDefinition[]>;
  }

  return {
    excludedModels,
    modelAlias,
    excludedLoading,
    modelAliasLoading,
    excludedError,
    modelAliasError,
    loadExcluded,
    loadModelAlias,
    refreshAll,
    saveExcluded,
    deleteExcluded,
    saveAlias,
    deleteAlias,
    downloadAuthFileText,
    fetchModelsForFile,
    fetchModelDefinitionsForChannel,
  };
});
