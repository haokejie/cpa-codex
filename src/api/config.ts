import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, CommandResult } from "../types";

export async function getConfig(): Promise<AppConfig> {
  return invoke("get_config");
}

export async function setAutostartEnabled(
  enabled: boolean
): Promise<CommandResult> {
  return invoke("set_autostart_enabled", { enabled });
}
