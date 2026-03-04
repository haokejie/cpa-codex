import type { VertexImportResponse } from '../types';
import * as mock from './mock';
import { getInvoke, isTauri } from './tauri';

export async function importVertexCredential(file: File, location?: string): Promise<VertexImportResponse> {
  if (!isTauri()) return mock.importVertexCredential();
  const bytes = new Uint8Array(await file.arrayBuffer());
  return (await getInvoke())('vertex_import', {
    name: file.name,
    bytes: Array.from(bytes),
    location: location?.trim() ? location.trim() : undefined,
  });
}
