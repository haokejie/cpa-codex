import type { UsageExportPayload, UsageImportResponse } from '../types';
import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

export async function getUsageRaw(): Promise<Record<string, unknown>> {
  if (!isTauri()) return mock.getUsageRaw();
  return (await getInvoke())('get_usage');
}

export async function exportUsage(): Promise<UsageExportPayload> {
  if (!isTauri()) return mock.exportUsage();
  return (await getInvoke())('export_usage');
}

export async function importUsage(payload: unknown): Promise<UsageImportResponse> {
  if (!isTauri()) return mock.importUsage();
  return (await getInvoke())('import_usage', { payload });
}
