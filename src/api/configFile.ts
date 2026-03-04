import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

export async function fetchConfigYaml(): Promise<string> {
  if (!isTauri()) return mock.fetchConfigYaml();
  return (await getInvoke())('get_config_yaml');
}

export async function saveConfigYaml(content: string): Promise<void> {
  if (!isTauri()) return mock.saveConfigYaml();
  return (await getInvoke())('save_config_yaml', { content });
}
