import type { CodexConfig } from "../types";
import * as mock from "./mock";
import { isTauri, getInvoke } from "./tauri";

export async function getCodexConfigs(): Promise<CodexConfig[]> {
  if (!isTauri()) return mock.getCodexConfigs();
  return (await getInvoke())("get_codex_configs");
}

export async function saveCodexConfigs(configs: CodexConfig[]): Promise<void> {
  if (!isTauri()) return mock.saveCodexConfigs();
  return (await getInvoke())("save_codex_configs", { configs });
}

export async function updateCodexConfig(index: number, config: CodexConfig): Promise<void> {
  if (!isTauri()) return mock.updateCodexConfig();
  return (await getInvoke())("update_codex_config", { index, config });
}

export async function deleteCodexConfig(apiKey: string): Promise<void> {
  if (!isTauri()) return mock.deleteCodexConfig();
  return (await getInvoke())("delete_codex_config", { apiKey });
}

export async function getCodexQuota(
  apiKey: string,
  baseUrl?: string,
  headers?: Record<string, string>,
): Promise<Record<string, unknown>> {
  if (!isTauri()) return mock.getCodexQuota();
  return (await getInvoke())("get_codex_quota", { apiKey, baseUrl, headers });
}

export async function getUsage(): Promise<Record<string, unknown>> {
  if (!isTauri()) return mock.getUsage();
  return (await getInvoke())("get_usage");
}
