import type { ApiCallResult } from '../types';
import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';
import { apiCall } from './apiCall';

export async function fetchModels(url: string, apiKey?: string, headers: Record<string, string> = {}): Promise<unknown> {
  if (!isTauri()) return mock.fetchModels();
  return (await getInvoke())('fetch_models', { url, apiKey, headers });
}

export async function fetchModelsViaApiCall(
  url: string,
  apiKey?: string,
  headers: Record<string, string> = {}
): Promise<ApiCallResult> {
  if (!isTauri()) return mock.fetchModelsViaApiCall();
  const resolvedHeaders = { ...headers };
  const hasAuthHeader = Boolean(resolvedHeaders.Authorization || resolvedHeaders.authorization);
  if (apiKey && !hasAuthHeader) {
    resolvedHeaders.Authorization = `Bearer ${apiKey}`;
  }
  return apiCall({ method: 'GET', url, header: Object.keys(resolvedHeaders).length ? resolvedHeaders : undefined });
}
