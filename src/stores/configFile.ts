import { defineStore } from "pinia";
import { ref } from "vue";
import { fetchConfigYaml, saveConfigYaml } from "../api/configFile";

export const useConfigFileStore = defineStore("configFile", () => {
  const content = ref("");
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      content.value = await fetchConfigYaml();
      return content.value;
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function save(nextContent: string) {
    saving.value = true;
    error.value = null;
    try {
      await saveConfigYaml(nextContent);
      content.value = nextContent;
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  return {
    content,
    loading,
    saving,
    error,
    load,
    save,
  };
});
