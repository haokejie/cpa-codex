import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  CodexConfig,
  ServiceHealthData,
  UsageRates,
  UsageSparklineSeries,
  UsageStats,
  UsageTokens,
} from "../types";
import { getCodexConfigs, getUsage } from "../api/codex";
import {
  buildMinuteSeriesFromDetails,
  calculateRecentRatesFromDetails,
  calculateServiceHealthData,
  collectUsageDetails,
  summarizeTokensFromDetails,
  summarizeUsage,
  unwrapUsagePayload,
} from "../utils/usage";

export const useCodexStore = defineStore("codex", () => {
  const configs = ref<CodexConfig[]>([]);
  const usage = ref<UsageStats>({ totalRequests: 0, successCount: 0, failCount: 0 });
  const usageRaw = ref<unknown>(null);
  const usageUpdatedAt = ref(0);
  const usageDetails = computed(() => collectUsageDetails(usageRaw.value));
  const loading = ref(false);
  const usageLoading = ref(false);
  const fetchError = ref<string | null>(null);

  const usageTokens = computed<UsageTokens>(() =>
    summarizeTokensFromDetails(usageRaw.value, usageDetails.value),
  );
  const usageRates = computed<UsageRates>(() =>
    calculateRecentRatesFromDetails(usageDetails.value, 30, usageUpdatedAt.value),
  );
  const usageSeries = computed<UsageSparklineSeries>(() =>
    buildMinuteSeriesFromDetails(usageDetails.value, 60, usageUpdatedAt.value),
  );
  const serviceHealth = computed<ServiceHealthData>(() => calculateServiceHealthData(usageDetails.value));

  async function refreshUsage() {
    usageLoading.value = true;
    try {
      const raw = await getUsage();
      const rawUsage = unwrapUsagePayload(raw);
      usageRaw.value = rawUsage;
      usageUpdatedAt.value = Date.now();
      usage.value = summarizeUsage(rawUsage);
    } catch { /* usage 查询失败不阻塞 */ }
    finally {
      usageLoading.value = false;
    }
  }

  async function fetchConfigs() {
    loading.value = true;
    fetchError.value = null;
    try {
      configs.value = await getCodexConfigs();
      await refreshUsage();
    } catch (e) {
      fetchError.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  return {
    configs,
    usage,
    usageRaw,
    usageUpdatedAt,
    usageTokens,
    usageRates,
    usageSeries,
    serviceHealth,
    loading,
    usageLoading,
    fetchError,
    fetchConfigs,
    refreshUsage,
  };
});
