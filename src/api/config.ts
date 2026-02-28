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
