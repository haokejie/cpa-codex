import type { GeminiKeyConfig, OpenAIProviderConfig, ProviderKeyConfig } from '../types';
import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

export async function getGeminiConfigs(): Promise<GeminiKeyConfig[]> {
  if (!isTauri()) return mock.getGeminiConfigs();
  return (await getInvoke())('get_gemini_configs');
}

export async function saveGeminiConfigs(configs: GeminiKeyConfig[]): Promise<void> {
  if (!isTauri()) return mock.saveGeminiConfigs();
  return (await getInvoke())('save_gemini_configs', { configs });
}

export async function updateGeminiConfig(index: number, value: GeminiKeyConfig): Promise<void> {
  if (!isTauri()) return mock.updateGeminiConfig();
  return (await getInvoke())('update_gemini_config', { index, value });
}

export async function deleteGeminiConfig(apiKey: string): Promise<void> {
  if (!isTauri()) return mock.deleteGeminiConfig();
  return (await getInvoke())('delete_gemini_config', { apiKey });
}

export async function getCodexProviderConfigs(): Promise<ProviderKeyConfig[]> {
  if (!isTauri()) return mock.getCodexProviderConfigs();
  return (await getInvoke())('get_codex_provider_configs');
}

export async function saveCodexProviderConfigs(configs: ProviderKeyConfig[]): Promise<void> {
  if (!isTauri()) return mock.saveCodexProviderConfigs();
  return (await getInvoke())('save_codex_provider_configs', { configs });
}

export async function updateCodexProviderConfig(index: number, value: ProviderKeyConfig): Promise<void> {
  if (!isTauri()) return mock.updateCodexProviderConfig();
  return (await getInvoke())('update_codex_provider_config', { index, value });
}

export async function deleteCodexProviderConfig(apiKey: string): Promise<void> {
  if (!isTauri()) return mock.deleteCodexProviderConfig();
  return (await getInvoke())('delete_codex_provider_config', { apiKey });
}

export async function getClaudeConfigs(): Promise<ProviderKeyConfig[]> {
  if (!isTauri()) return mock.getClaudeConfigs();
  return (await getInvoke())('get_claude_configs');
}

export async function saveClaudeConfigs(configs: ProviderKeyConfig[]): Promise<void> {
  if (!isTauri()) return mock.saveClaudeConfigs();
  return (await getInvoke())('save_claude_configs', { configs });
}

export async function updateClaudeConfig(index: number, value: ProviderKeyConfig): Promise<void> {
  if (!isTauri()) return mock.updateClaudeConfig();
  return (await getInvoke())('update_claude_config', { index, value });
}

export async function deleteClaudeConfig(apiKey: string): Promise<void> {
  if (!isTauri()) return mock.deleteClaudeConfig();
  return (await getInvoke())('delete_claude_config', { apiKey });
}

export async function getVertexConfigs(): Promise<ProviderKeyConfig[]> {
  if (!isTauri()) return mock.getVertexConfigs();
  return (await getInvoke())('get_vertex_configs');
}

export async function saveVertexConfigs(configs: ProviderKeyConfig[]): Promise<void> {
  if (!isTauri()) return mock.saveVertexConfigs();
  return (await getInvoke())('save_vertex_configs', { configs });
}

export async function updateVertexConfig(index: number, value: ProviderKeyConfig): Promise<void> {
  if (!isTauri()) return mock.updateVertexConfig();
  return (await getInvoke())('update_vertex_config', { index, value });
}

export async function deleteVertexConfig(apiKey: string): Promise<void> {
  if (!isTauri()) return mock.deleteVertexConfig();
  return (await getInvoke())('delete_vertex_config', { apiKey });
}

export async function getOpenAIProviders(): Promise<OpenAIProviderConfig[]> {
  if (!isTauri()) return mock.getOpenAIProviders();
  return (await getInvoke())('get_openai_providers');
}

export async function saveOpenAIProviders(providers: OpenAIProviderConfig[]): Promise<void> {
  if (!isTauri()) return mock.saveOpenAIProviders();
  return (await getInvoke())('save_openai_providers', { providers });
}

export async function updateOpenAIProvider(index: number, value: OpenAIProviderConfig): Promise<void> {
  if (!isTauri()) return mock.updateOpenAIProvider();
  return (await getInvoke())('update_openai_provider', { index, value });
}

export async function deleteOpenAIProvider(name: string): Promise<void> {
  if (!isTauri()) return mock.deleteOpenAIProvider();
  return (await getInvoke())('delete_openai_provider', { name });
}
