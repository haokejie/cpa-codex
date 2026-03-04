import type { AmpcodeConfig, AmpcodeModelMapping } from '../types';
import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

export async function getAmpcode(): Promise<AmpcodeConfig> {
  if (!isTauri()) return mock.getAmpcode();
  return (await getInvoke())('get_ampcode_config');
}

export async function updateUpstreamUrl(url: string): Promise<void> {
  if (!isTauri()) return mock.updateUpstreamUrl();
  return (await getInvoke())('update_ampcode_upstream_url', { url });
}

export async function clearUpstreamUrl(): Promise<void> {
  if (!isTauri()) return mock.clearUpstreamUrl();
  return (await getInvoke())('clear_ampcode_upstream_url');
}

export async function updateUpstreamApiKey(apiKey: string): Promise<void> {
  if (!isTauri()) return mock.updateUpstreamApiKey();
  return (await getInvoke())('update_ampcode_upstream_api_key', { apiKey });
}

export async function clearUpstreamApiKey(): Promise<void> {
  if (!isTauri()) return mock.clearUpstreamApiKey();
  return (await getInvoke())('clear_ampcode_upstream_api_key');
}

export async function getModelMappings(): Promise<AmpcodeModelMapping[]> {
  if (!isTauri()) return mock.getAmpcodeModelMappings();
  return (await getInvoke())('get_ampcode_model_mappings');
}

export async function saveModelMappings(mappings: AmpcodeModelMapping[]): Promise<void> {
  if (!isTauri()) return mock.saveAmpcodeModelMappings();
  return (await getInvoke())('save_ampcode_model_mappings', { mappings });
}

export async function patchModelMappings(mappings: AmpcodeModelMapping[]): Promise<void> {
  if (!isTauri()) return mock.patchAmpcodeModelMappings();
  return (await getInvoke())('patch_ampcode_model_mappings', { mappings });
}

export async function clearModelMappings(): Promise<void> {
  if (!isTauri()) return mock.clearAmpcodeModelMappings();
  return (await getInvoke())('clear_ampcode_model_mappings');
}

export async function deleteModelMappings(fromList: string[]): Promise<void> {
  if (!isTauri()) return mock.deleteAmpcodeModelMappings();
  return (await getInvoke())('delete_ampcode_model_mappings', { fromList });
}

export async function updateForceModelMappings(enabled: boolean): Promise<void> {
  if (!isTauri()) return mock.updateForceModelMappings();
  return (await getInvoke())('update_ampcode_force_model_mappings', { enabled });
}
