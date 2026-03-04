import { defineStore } from "pinia";
import { ref } from "vue";
import type { UsageExportPayload, UsageImportResponse } from "../types";
import { exportUsage, importUsage } from "../api/usage";

export const useUsageStore = defineStore("usage", () => {
  const exporting = ref(false);
  const importing = ref(false);
  const exportError = ref<string | null>(null);
  const importError = ref<string | null>(null);
  const importResult = ref<UsageImportResponse | null>(null);

  async function runExport(): Promise<UsageExportPayload> {
    exporting.value = true;
    exportError.value = null;
    try {
      return await exportUsage();
    } catch (e) {
      exportError.value = String(e);
      throw e;
    } finally {
      exporting.value = false;
    }
  }

  async function runImport(payload: unknown): Promise<UsageImportResponse> {
    importing.value = true;
    importError.value = null;
    importResult.value = null;
    try {
      const result = await importUsage(payload);
      importResult.value = result;
      return result;
    } catch (e) {
      importError.value = String(e);
      throw e;
    } finally {
      importing.value = false;
    }
  }

  return {
    exporting,
    importing,
    exportError,
    importError,
    importResult,
    runExport,
    runImport,
  };
});
