import type { AppConfig, CommandResult } from "../types";
import * as mock from "./mock";
import { isTauri, getInvoke } from "./tauri";

export async function getConfig(): Promise<AppConfig> {
  if (!isTauri()) return mock.getConfig();
  return (await getInvoke())("get_config");
}

export async function setAutostartEnabled(
  enabled: boolean
): Promise<CommandResult> {
  if (!isTauri()) return mock.setAutostartEnabled();
  return (await getInvoke())("set_autostart_enabled", { enabled });
}

export async function setTrayEnabled(
  enabled: boolean
): Promise<CommandResult> {
  if (!isTauri()) return mock.setTrayEnabled();
  return (await getInvoke())("set_tray_enabled", { enabled });
}

export async function setCloseToTray(
  enabled: boolean
): Promise<CommandResult> {
  if (!isTauri()) return mock.setCloseToTray();
  return (await getInvoke())("set_close_to_tray", { enabled });
}

export async function setAutoRefreshEnabled(
  enabled: boolean
): Promise<CommandResult> {
  if (!isTauri()) return mock.setAutoRefreshEnabled();
  return (await getInvoke())("set_auto_refresh_enabled", { enabled });
}

export async function setAutoRefreshIntervalSeconds(
  seconds: number
): Promise<CommandResult> {
  if (!isTauri()) return mock.setAutoRefreshIntervalSeconds();
  return (await getInvoke())("set_auto_refresh_interval_seconds", { seconds });
}
