import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

export async function checkLatestVersion(): Promise<Record<string, unknown>> {
  if (!isTauri()) return mock.checkLatestVersion();
  return (await getInvoke())('check_latest_version');
}
