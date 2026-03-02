import { defineStore } from "pinia";
import { ref } from "vue";
import {
  getConfig,
  setAutostartEnabled,
  setTrayEnabled,
  setCloseToTray,
  setDockVisibleOnMinimize,
  setAutoRefreshEnabled,
  setAutoRefreshIntervalSeconds,
} from "../api/config";
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

  async function toggleTray() {
    if (!config.value) return;
    working.value = true;
    error.value = "";
    try {
      await setTrayEnabled(!config.value.tray_enabled);
      await refresh();
    } catch (e) {
      error.value = String(e);
    } finally {
      working.value = false;
    }
  }

  async function toggleCloseToTray() {
    if (!config.value) return;
    working.value = true;
    error.value = "";
    try {
      await setCloseToTray(!config.value.close_to_tray);
      await refresh();
    } catch (e) {
      error.value = String(e);
    } finally {
      working.value = false;
    }
  }

  async function toggleDockVisibleOnMinimize() {
    if (!config.value) return;
    working.value = true;
    error.value = "";
    try {
      await setDockVisibleOnMinimize(!config.value.dock_visible_on_minimize);
      await refresh();
    } catch (e) {
      error.value = String(e);
    } finally {
      working.value = false;
    }
  }

  async function toggleAutoRefresh() {
    if (!config.value) return;
    working.value = true;
    error.value = "";
    try {
      await setAutoRefreshEnabled(!config.value.auto_refresh_enabled);
      await refresh();
    } catch (e) {
      error.value = String(e);
    } finally {
      working.value = false;
    }
  }

  async function updateAutoRefreshIntervalSeconds(seconds: number) {
    if (!config.value) return;
    working.value = true;
    error.value = "";
    try {
      await setAutoRefreshIntervalSeconds(seconds);
      await refresh();
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      working.value = false;
    }
  }

  return {
    config,
    error,
    working,
    refresh,
    toggleAutostart,
    toggleTray,
    toggleCloseToTray,
    toggleDockVisibleOnMinimize,
    toggleAutoRefresh,
    updateAutoRefreshIntervalSeconds,
  };
});
