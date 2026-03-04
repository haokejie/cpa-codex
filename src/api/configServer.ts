import type { ServerConfig } from '../types';
import { normalizeConfigResponse } from '../utils/transformers';
import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

export async function getServerConfig(): Promise<ServerConfig> {
  if (!isTauri()) return mock.getServerConfig();
  const raw = await (await getInvoke())('get_server_config');
  return normalizeConfigResponse(raw);
}

export async function getServerRawConfig(): Promise<Record<string, unknown>> {
  if (!isTauri()) return mock.getServerRawConfig();
  return (await getInvoke())('get_server_raw_config');
}

export async function updateDebug(enabled: boolean): Promise<void> {
  if (!isTauri()) return mock.updateDebug();
  return (await getInvoke())('update_debug', { enabled });
}

export async function updateProxyUrl(proxyUrl: string): Promise<void> {
  if (!isTauri()) return mock.updateProxyUrl();
  return (await getInvoke())('update_proxy_url', { proxyUrl });
}

export async function clearProxyUrl(): Promise<void> {
  if (!isTauri()) return mock.clearProxyUrl();
  return (await getInvoke())('clear_proxy_url');
}

export async function updateRequestRetry(retryCount: number): Promise<void> {
  if (!isTauri()) return mock.updateRequestRetry();
  return (await getInvoke())('update_request_retry', { retryCount });
}

export async function updateSwitchProject(enabled: boolean): Promise<void> {
  if (!isTauri()) return mock.updateSwitchProject();
  return (await getInvoke())('update_quota_switch_project', { enabled });
}

export async function updateSwitchPreviewModel(enabled: boolean): Promise<void> {
  if (!isTauri()) return mock.updateSwitchPreviewModel();
  return (await getInvoke())('update_quota_switch_preview_model', { enabled });
}

export async function updateUsageStatistics(enabled: boolean): Promise<void> {
  if (!isTauri()) return mock.updateUsageStatistics();
  return (await getInvoke())('update_usage_statistics', { enabled });
}

export async function updateRequestLog(enabled: boolean): Promise<void> {
  if (!isTauri()) return mock.updateRequestLog();
  return (await getInvoke())('update_request_log', { enabled });
}

export async function updateLoggingToFile(enabled: boolean): Promise<void> {
  if (!isTauri()) return mock.updateLoggingToFile();
  return (await getInvoke())('update_logging_to_file', { enabled });
}

export async function getLogsMaxTotalSizeMb(): Promise<number> {
  if (!isTauri()) return mock.getLogsMaxTotalSizeMb();
  const data = await (await getInvoke())('get_logs_max_total_size_mb');
  const record = (data && typeof data === 'object') ? (data as Record<string, unknown>) : null;
  const value = record?.['logs-max-total-size-mb'] ?? record?.logsMaxTotalSizeMb ?? data ?? 0;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function updateLogsMaxTotalSizeMb(value: number): Promise<void> {
  if (!isTauri()) return mock.updateLogsMaxTotalSizeMb();
  return (await getInvoke())('update_logs_max_total_size_mb', { value });
}

export async function updateWsAuth(enabled: boolean): Promise<void> {
  if (!isTauri()) return mock.updateWsAuth();
  return (await getInvoke())('update_ws_auth', { enabled });
}

export async function getForceModelPrefix(): Promise<boolean> {
  if (!isTauri()) return mock.getForceModelPrefix();
  const data = await (await getInvoke())('get_force_model_prefix');
  const record = (data && typeof data === 'object') ? (data as Record<string, unknown>) : null;
  if (record) {
    return Boolean(record['force-model-prefix'] ?? record.forceModelPrefix ?? false);
  }
  return Boolean(data ?? false);
}

export async function updateForceModelPrefix(enabled: boolean): Promise<void> {
  if (!isTauri()) return mock.updateForceModelPrefix();
  return (await getInvoke())('update_force_model_prefix', { enabled });
}

export async function getRoutingStrategy(): Promise<string> {
  if (!isTauri()) return mock.getRoutingStrategy();
  const data = await (await getInvoke())('get_routing_strategy');
  const record = (data && typeof data === 'object') ? (data as Record<string, unknown>) : null;
  if (record) {
    const strategy = record.strategy ?? record['routing-strategy'] ?? record.routingStrategy;
    return typeof strategy === 'string' ? strategy : 'round-robin';
  }
  return typeof data === 'string' ? data : 'round-robin';
}

export async function updateRoutingStrategy(strategy: string): Promise<void> {
  if (!isTauri()) return mock.updateRoutingStrategy();
  return (await getInvoke())('update_routing_strategy', { strategy });
}
