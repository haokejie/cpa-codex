import { isTauri } from '../api/tauri';

export type DownloadBlobOptions = {
  filename: string;
  blob: Blob;
  revokeDelayMs?: number;
};

export async function downloadBlob({ filename, blob, revokeDelayMs = 1000 }: DownloadBlobOptions) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
    link.remove();
  }, revokeDelayMs);
}

export async function saveBytesToFile(bytes: Uint8Array, filename: string): Promise<boolean> {
  try {
    if (isTauri()) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const target = await save({ defaultPath: filename });
      if (!target) return false;
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      await writeFile(target, bytes);
      return true;
    }

    const blob = new Blob([bytes]);
    await downloadBlob({ filename, blob });
    return true;
  } catch {
    return false;
  }
}

export async function saveTextToFile(content: string, filename: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content ?? '');
  return saveBytesToFile(bytes, filename);
}
