import * as mock from "./mock";
import { isTauri, getInvoke } from "./tauri";

export async function listApiKeys(): Promise<string[]> {
  if (!isTauri()) return mock.listApiKeys();
  return (await getInvoke())("list_api_keys");
}

export async function replaceApiKeys(keys: string[]): Promise<void> {
  if (!isTauri()) return mock.replaceApiKeys();
  return (await getInvoke())("replace_api_keys", { keys });
}

export async function updateApiKey(index: number, value: string): Promise<void> {
  if (!isTauri()) return mock.updateApiKey();
  return (await getInvoke())("update_api_key", { index, value });
}

export async function deleteApiKey(index: number): Promise<void> {
  if (!isTauri()) return mock.deleteApiKey();
  return (await getInvoke())("delete_api_key", { index });
}
