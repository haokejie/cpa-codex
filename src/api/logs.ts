import type { ErrorLogsResponse, LogsQuery, LogsResponse } from '../types';
import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

export async function fetchLogs(params: LogsQuery = {}): Promise<LogsResponse> {
  if (!isTauri()) return mock.fetchLogs();
  return (await getInvoke())('fetch_logs', { params });
}

export async function clearLogs(): Promise<void> {
  if (!isTauri()) return mock.clearLogs();
  return (await getInvoke())('clear_logs');
}

export async function fetchErrorLogs(): Promise<ErrorLogsResponse> {
  if (!isTauri()) return mock.fetchErrorLogs();
  return (await getInvoke())('fetch_error_logs');
}

export async function downloadErrorLog(filename: string): Promise<Uint8Array> {
  if (!isTauri()) return mock.downloadErrorLog();
  const bytes = await (await getInvoke())('download_error_log', { filename });
  return Uint8Array.from(bytes as number[]);
}

export async function downloadRequestLogById(id: string): Promise<Uint8Array> {
  if (!isTauri()) return mock.downloadRequestLogById();
  const bytes = await (await getInvoke())('download_request_log_by_id', { id });
  return Uint8Array.from(bytes as number[]);
}
