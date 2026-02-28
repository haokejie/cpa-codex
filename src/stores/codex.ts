import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { CodexConfig, CodexQuotaState, CodexQuotaWindow, UsageStats } from "../types";
import { getCodexConfigs, saveCodexConfigs, deleteCodexConfig, getCodexQuota, getUsage } from "../api/codex";

function parseWindow(w: Record<string, unknown>): CodexQuotaWindow {
  return {
    label: `${Math.round(Number(w.limitWindowSeconds || 0) / 3600)}h窗口`,
    usedPercent: Number(w.usedPercent || 0),
    limitWindowSeconds: Number(w.limitWindowSeconds || 0),
    resetAfterSeconds: Number(w.resetAfterSeconds || 0),
  };
}

function parseQuota(raw: Record<string, unknown>): CodexQuotaState {
  const rl = (raw.rateLimit || {}) as Record<string, unknown>;
  const pw = (rl.primaryWindow || {}) as Record<string, unknown>;
  const windows: CodexQuotaWindow[] = [];
  if (pw.limitWindowSeconds) windows.push(parseWindow(pw));
  const sw = (rl.secondaryWindow || {}) as Record<string, unknown>;
  if (sw.limitWindowSeconds) windows.push(parseWindow(sw));
  return {
    status: "success",
    allowed: Boolean(rl.allowed),
    limitReached: Boolean(rl.limitReached),
    windows,
    planType: raw.planType as string | undefined,
  };
}

export const useCodexStore = defineStore("codex", () => {
  const configs = ref<CodexConfig[]>([]);
  const quotas = ref<Record<string, CodexQuotaState>>({});
  const usage = ref<UsageStats>({ totalRequests: 0, successCount: 0, failCount: 0 });
  const loading = ref(false);
  const fetchError = ref<string | null>(null);
  const refreshingQuota = ref(false);
  const selected = ref<Set<string>>(new Set());

  const selectedCount = computed(() => selected.value.size);
  const allSelected = computed(() => configs.value.length > 0 && selected.value.size === configs.value.length);
  const successRate = computed(() => {
    if (!usage.value.totalRequests) return "0";
    return ((usage.value.successCount / usage.value.totalRequests) * 100).toFixed(1);
  });

  async function fetchConfigs() {
    loading.value = true;
    fetchError.value = null;
    try {
      configs.value = await getCodexConfigs();
      try {
        const raw = await getUsage();
        usage.value = {
          totalRequests: Number(raw.totalRequests || 0),
          successCount: Number(raw.successCount || 0),
          failCount: Number(raw.failCount || 0),
        };
      } catch { /* usage 查询失败不阻塞 */ }
    } catch (e) {
      fetchError.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function refreshQuotas() {
    refreshingQuota.value = true;
    try {
      const results: Record<string, CodexQuotaState> = {};
      await Promise.all(configs.value.map(async (c) => {
        try {
          const raw = await getCodexQuota(c.apiKey, c.baseUrl, c.headers);
          results[c.apiKey] = parseQuota(raw);
        } catch (e) {
          results[c.apiKey] = { status: "error", allowed: false, limitReached: false, windows: [], error: String(e) };
        }
      }));
      quotas.value = results;
    } finally {
      refreshingQuota.value = false;
    }
  }

  function toggleSelect(apiKey: string) {
    const s = new Set(selected.value);
    s.has(apiKey) ? s.delete(apiKey) : s.add(apiKey);
    selected.value = s;
  }

  function toggleSelectAll() {
    if (allSelected.value) {
      selected.value = new Set();
    } else {
      selected.value = new Set(configs.value.map((c) => c.apiKey));
    }
  }

  function clearSelection() {
    selected.value = new Set();
  }

  async function setTopPriority(apiKey: string) {
    const idx = configs.value.findIndex((c) => c.apiKey === apiKey);
    if (idx < 0) return;
    const item = configs.value.splice(idx, 1)[0];
    item.priority = 0;
    configs.value.unshift(item);
    configs.value.forEach((c, i) => (c.priority = i));
    configs.value = [...configs.value];
    await saveCodexConfigs(configs.value);
  }

  async function batchSetTopPriority() {
    const keys = [...selected.value];
    const picked = configs.value.filter((c) => keys.includes(c.apiKey));
    const rest = configs.value.filter((c) => !keys.includes(c.apiKey));
    configs.value = [...picked, ...rest];
    configs.value.forEach((c, i) => (c.priority = i));
    configs.value = [...configs.value];
    await saveCodexConfigs(configs.value);
    clearSelection();
  }

  async function deleteConfig(apiKey: string) {
    await deleteCodexConfig(apiKey);
    configs.value = configs.value.filter((c) => c.apiKey !== apiKey);
    configs.value.forEach((c, i) => (c.priority = i));
    selected.value.delete(apiKey);
    selected.value = new Set(selected.value);
  }

  async function batchDisable() {
    const keys = [...selected.value];
    configs.value.forEach((c) => {
      if (keys.includes(c.apiKey)) c.priority = 999;
    });
    configs.value.sort((a, b) => a.priority - b.priority);
    configs.value = [...configs.value];
    await saveCodexConfigs(configs.value);
    clearSelection();
  }

  async function refreshSingleQuota(apiKey: string) {
    quotas.value = { ...quotas.value, [apiKey]: { status: "loading", allowed: false, limitReached: false, windows: [] } };
    try {
      const cfg = configs.value.find((c) => c.apiKey === apiKey);
      const raw = await getCodexQuota(apiKey, cfg?.baseUrl, cfg?.headers);
      quotas.value = { ...quotas.value, [apiKey]: parseQuota(raw) };
    } catch (e) {
      quotas.value = { ...quotas.value, [apiKey]: { status: "error", allowed: false, limitReached: false, windows: [], error: String(e) } };
    }
  }

  async function batchDelete() {
    const keys = [...selected.value];
    for (const key of keys) {
      await deleteCodexConfig(key);
    }
    configs.value = configs.value.filter((c) => !keys.includes(c.apiKey));
    configs.value.forEach((c, i) => (c.priority = i));
    clearSelection();
  }

  return {
    configs, quotas, usage, loading, fetchError, refreshingQuota,
    selected, selectedCount, allSelected, successRate,
    fetchConfigs, refreshQuotas, refreshSingleQuota,
    toggleSelect, toggleSelectAll, clearSelection,
    setTopPriority, batchSetTopPriority, batchDisable,
    deleteConfig, batchDelete,
  };
});
