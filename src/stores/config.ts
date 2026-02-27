import { defineStore } from "pinia";
import { ref } from "vue";
import { getConfig, setAutostartEnabled } from "../api/config";
import type { AppConfig } from "../types";

export const useConfigStore = defineStore("config", () => {
  const config = ref<AppConfig | null>(null);
  const error = ref("");
  const working = ref(false);

  async function refresh() {
    error.value = "";
    try {
      config.value = await getConfig();
    } catch (e) {
      error.value = String(e);
    }
  }

  async function toggleAutostart() {
    if (!config.value) return;
    working.value = true;
    error.value = "";
    try {
      await setAutostartEnabled(!config.value.autostart_enabled);
      await refresh();
    } catch (e) {
      error.value = String(e);
    } finally {
      working.value = false;
    }
  }

  return { config, error, working, refresh, toggleAutostart };
});
