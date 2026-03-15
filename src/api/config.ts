import type { AppConfig, CommandResult } from "../types";
import { isTauri, getInvoke } from "./tauri";

const WEB_CONFIG_KEY = "cpa-codex:web-config";
const DEFAULT_WEB_CONFIG: AppConfig = {
  autostart_enabled: false,
  tray_enabled: true,
  close_to_tray: true,
  dock_visible_on_minimize: true,
};

export async function getConfig(): Promise<AppConfig> {
  if (!isTauri()) return readWebConfig();
  return (await getInvoke())("get_config");
}

export async function setAutostartEnabled(
  enabled: boolean
): Promise<CommandResult> {
  if (!isTauri()) {
    updateWebConfig({ autostart_enabled: enabled });
    return { ok: true };
  }
  return (await getInvoke())("set_autostart_enabled", { enabled });
}

export async function setTrayEnabled(
  enabled: boolean
): Promise<CommandResult> {
  if (!isTauri()) {
    updateWebConfig({ tray_enabled: enabled });
    return { ok: true };
  }
  return (await getInvoke())("set_tray_enabled", { enabled });
}

export async function setCloseToTray(
  enabled: boolean
): Promise<CommandResult> {
  if (!isTauri()) {
    updateWebConfig({ close_to_tray: enabled });
    return { ok: true };
  }
  return (await getInvoke())("set_close_to_tray", { enabled });
}

export async function setDockVisibleOnMinimize(
  enabled: boolean
): Promise<CommandResult> {
  if (!isTauri()) {
    updateWebConfig({ dock_visible_on_minimize: enabled });
    return { ok: true };
  }
  return (await getInvoke())("set_dock_visible_on_minimize", { enabled });
}

function readWebConfig(): AppConfig {
  if (typeof window === "undefined") return { ...DEFAULT_WEB_CONFIG };
  try {
    const raw = window.localStorage.getItem(WEB_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_WEB_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { ...DEFAULT_WEB_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_WEB_CONFIG };
  }
}

function updateWebConfig(partial: Partial<AppConfig>): AppConfig {
  const next = { ...readWebConfig(), ...partial };
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WEB_CONFIG_KEY, JSON.stringify(next));
    }
  } catch {
    // 忽略本地存储错误
  }
  return next;
}
