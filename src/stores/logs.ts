import { defineStore } from "pinia";
import { ref } from "vue";
import type { ErrorLogsResponse, ErrorLogFile, LogsQuery, LogsResponse } from "../types";
import { fetchLogs, clearLogs, fetchErrorLogs, downloadErrorLog, downloadRequestLogById } from "../api/logs";
import { MAX_LOG_LINES } from "../utils/constants";

export const useLogsStore = defineStore("logs", () => {
  const lines = ref<string[]>([]);
  const lineCount = ref(0);
  const latestTimestamp = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const errorLogs = ref<ErrorLogFile[]>([]);
  const errorLogsLoading = ref(false);
  const errorLogsError = ref<string | null>(null);

  async function loadLogs(incremental = false) {
    if (!incremental) {
      loading.value = true;
    }
    error.value = null;
    try {
      const params: LogsQuery = incremental && latestTimestamp.value > 0 ? { after: latestTimestamp.value } : {};
      const data: LogsResponse = await fetchLogs(params);
      if (data["latest-timestamp"]) {
        latestTimestamp.value = data["latest-timestamp"];
      }
      const newLines = Array.isArray(data.lines) ? data.lines : [];
      if (incremental) {
        const merged = [...lines.value, ...newLines];
        lines.value = merged.slice(-MAX_LOG_LINES);
      } else {
        lines.value = newLines.slice(-MAX_LOG_LINES);
      }
      lineCount.value = data["line-count"] ?? lines.value.length;
    } catch (e) {
      if (!incremental) {
        error.value = String(e);
      }
    } finally {
      if (!incremental) {
        loading.value = false;
      }
    }
  }

  async function clearAll() {
    await clearLogs();
    lines.value = [];
    lineCount.value = 0;
    latestTimestamp.value = 0;
  }

  async function loadErrorLogs() {
    errorLogsLoading.value = true;
    errorLogsError.value = null;
    try {
      const res: ErrorLogsResponse = await fetchErrorLogs();
      errorLogs.value = Array.isArray(res.files) ? res.files : [];
    } catch (e) {
      errorLogs.value = [];
      errorLogsError.value = String(e);
    } finally {
      errorLogsLoading.value = false;
    }
  }

  async function downloadErrorLogFile(name: string): Promise<Uint8Array> {
    return downloadErrorLog(name);
  }

  async function downloadRequestLog(id: string): Promise<Uint8Array> {
    return downloadRequestLogById(id);
  }

  return {
    lines,
    lineCount,
    latestTimestamp,
    loading,
    error,
    errorLogs,
    errorLogsLoading,
    errorLogsError,
    loadLogs,
    clearAll,
    loadErrorLogs,
    downloadErrorLogFile,
    downloadRequestLog,
  };
});
