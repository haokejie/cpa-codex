import { defineStore } from "pinia";
import { ref } from "vue";
import type { ServerConfig } from "../types";
import {
  clearProxyUrl,
  getForceModelPrefix,
  getLogsMaxTotalSizeMb,
  getRoutingStrategy,
  getServerConfig,
  updateDebug,
  updateForceModelPrefix,
  updateLoggingToFile,
  updateLogsMaxTotalSizeMb,
  updateProxyUrl,
  updateRequestLog,
  updateRequestRetry,
  updateRoutingStrategy,
  updateSwitchPreviewModel,
  updateSwitchProject,
  updateUsageStatistics,
  updateWsAuth,
} from "../api/configServer";
import { checkLatestVersion } from "../api/version";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeVersionInfo = (raw: unknown) => {
  if (!isRecord(raw)) return { version: null, buildDate: null };
  const version = readText(
    raw.version ??
      raw.latest_version ??
      raw.latestVersion ??
      raw["latest-version"] ??
      raw.serverVersion ??
      raw["server-version"],
  );
  const buildDate = readText(
    raw.buildDate ??
      raw.build_date ??
      raw["build-date"] ??
      raw["build_date"] ??
      raw.buildTime ??
      raw["build-time"],
  );
  return { version, buildDate };
};

export const useServerConfigStore = defineStore("serverConfig", () => {
  const config = ref<ServerConfig | null>(null);
  const loading = ref(false);
  const working = ref(false);
  const error = ref<string | null>(null);
  const serverVersion = ref<string | null>(null);
  const serverBuildDate = ref<string | null>(null);

  async function refreshVersion() {
    try {
      const payload = await checkLatestVersion();
      const { version, buildDate } = normalizeVersionInfo(payload);
      if (version !== null) {
        serverVersion.value = version;
      }
      if (buildDate !== null) {
        serverBuildDate.value = buildDate;
      }
    } catch {
      // 版本信息不影响主流程
    }
  }

  async function refresh() {
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      const next = await getServerConfig();

      const [logsSize, forcePrefix, routing] = await Promise.allSettled([
        next.logsMaxTotalSizeMb === undefined ? getLogsMaxTotalSizeMb() : Promise.resolve(next.logsMaxTotalSizeMb),
        next.forceModelPrefix === undefined ? getForceModelPrefix() : Promise.resolve(next.forceModelPrefix),
        next.routingStrategy ? Promise.resolve(next.routingStrategy) : getRoutingStrategy(),
      ]);

      if (logsSize.status === "fulfilled") {
        next.logsMaxTotalSizeMb = logsSize.value;
      }
      if (forcePrefix.status === "fulfilled") {
        next.forceModelPrefix = Boolean(forcePrefix.value);
      }
      if (routing.status === "fulfilled" && routing.value) {
        next.routingStrategy = routing.value;
      }

      config.value = next;
      refreshVersion();
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function runUpdate(task: () => Promise<void>) {
    working.value = true;
    error.value = null;
    try {
      await task();
      await refresh();
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      working.value = false;
    }
  }

  async function setDebug(enabled: boolean) {
    await runUpdate(() => updateDebug(enabled));
  }

  async function setProxyUrl(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      await runUpdate(() => clearProxyUrl());
      return;
    }
    await runUpdate(() => updateProxyUrl(trimmed));
  }

  async function setRequestRetry(value: number) {
    await runUpdate(() => updateRequestRetry(value));
  }

  async function setQuotaSwitchProject(enabled: boolean) {
    await runUpdate(() => updateSwitchProject(enabled));
  }

  async function setQuotaSwitchPreviewModel(enabled: boolean) {
    await runUpdate(() => updateSwitchPreviewModel(enabled));
  }

  async function setUsageStatistics(enabled: boolean) {
    await runUpdate(() => updateUsageStatistics(enabled));
  }

  async function setRequestLog(enabled: boolean) {
    await runUpdate(() => updateRequestLog(enabled));
  }

  async function setLoggingToFile(enabled: boolean) {
    await runUpdate(() => updateLoggingToFile(enabled));
  }

  async function setLogsMaxTotalSizeMb(value: number) {
    await runUpdate(() => updateLogsMaxTotalSizeMb(value));
  }

  async function setWsAuth(enabled: boolean) {
    await runUpdate(() => updateWsAuth(enabled));
  }

  async function setForceModelPrefix(enabled: boolean) {
    await runUpdate(() => updateForceModelPrefix(enabled));
  }

  async function setRoutingStrategy(strategy: string) {
    await runUpdate(() => updateRoutingStrategy(strategy));
  }

  return {
    config,
    loading,
    working,
    error,
    serverVersion,
    serverBuildDate,
    refresh,
    refreshVersion,
    setDebug,
    setProxyUrl,
    setRequestRetry,
    setQuotaSwitchProject,
    setQuotaSwitchPreviewModel,
    setUsageStatistics,
    setRequestLog,
    setLoggingToFile,
    setLogsMaxTotalSizeMb,
    setWsAuth,
    setForceModelPrefix,
    setRoutingStrategy,
  };
});
