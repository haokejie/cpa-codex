import type { AuthFileItem } from "../types";
import { isTauri, getInvoke } from "./tauri";
import * as mock from "./mock";

type RawAuthFileItem = AuthFileItem & {
  status_message?: string;
  last_refresh?: string | number;
};

function normalizeAuthFile(item: RawAuthFileItem): AuthFileItem {
  return {
    ...item,
    statusMessage: item.statusMessage ?? item.status_message,
    lastRefresh: item.lastRefresh ?? item.last_refresh,
  };
}

export async function listAuthFiles(): Promise<AuthFileItem[]> {
  if (!isTauri()) return mock.listAuthFiles();
  const items = await (await getInvoke())("list_auth_files");
  return Array.isArray(items) ? items.map(normalizeAuthFile) : [];
}

export async function setAuthFileStatus(name: string, disabled: boolean): Promise<void> {
  if (!isTauri()) return;
  return (await getInvoke())("set_auth_file_status", { name, disabled });
}

export async function deleteAuthFile(name: string): Promise<void> {
  if (!isTauri()) return;
  return (await getInvoke())("delete_auth_file", { name });
}

export async function deleteAllAuthFiles(): Promise<void> {
  if (!isTauri()) return;
  return (await getInvoke())("delete_all_auth_files");
}

export async function syncAuthFiles(): Promise<void> {
  if (!isTauri()) return;
  return (await getInvoke())("sync_auth_files");
}

export async function uploadAuthFile(file: File): Promise<void> {
  if (!isTauri()) return mock.uploadAuthFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return (await getInvoke())("upload_auth_file", { name: file.name, bytes: Array.from(bytes) });
}
