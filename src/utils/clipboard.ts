import { isTauri } from '../api/tauri';

export async function copyToClipboard(text: string): Promise<boolean> {
  const content = String(text ?? '');
  if (!content) return false;

  try {
    if (isTauri()) {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(content);
      return true;
    }

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
