import type { AuthFileItem } from "../types";
import { isTauri, getInvoke } from "./tauri";

export async function listAuthFiles(): Promise<AuthFileItem[]> {
  if (!isTauri()) return [];
  return (await getInvoke())("list_auth_files");
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
