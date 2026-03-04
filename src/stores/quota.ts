import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  ApiCallResult,
  AuthFileItem,
  QuotaAntigravityState,
  QuotaAntigravityQuotaGroup,
  QuotaAntigravityModelsPayload,
  QuotaClaudeState,
  QuotaClaudeQuotaWindow,
  QuotaClaudeExtraUsage,
  QuotaCodexState,
  QuotaCodexQuotaWindow,
  QuotaCodexUsagePayload,
  QuotaCodexRateLimitInfo,
  QuotaCodexUsageWindow,
  QuotaGeminiCliState,
  QuotaGeminiCliParsedBucket,
  QuotaGeminiCliQuotaBucketState,
  QuotaKimiState,
  QuotaKimiQuotaRow,
} from "../types";
import { apiCall } from "../api/apiCall";
import { downloadAuthFileText } from "../api/authFilesPlus";
import {
  ANTIGRAVITY_QUOTA_URLS,
  ANTIGRAVITY_REQUEST_HEADERS,
  CLAUDE_USAGE_URL,
  CLAUDE_REQUEST_HEADERS,
  CLAUDE_USAGE_WINDOW_KEYS,
  CODEX_USAGE_URL,
  CODEX_REQUEST_HEADERS,
  GEMINI_CLI_QUOTA_URL,
  GEMINI_CLI_REQUEST_HEADERS,
  KIMI_USAGE_URL,
  KIMI_REQUEST_HEADERS,
  buildAntigravityQuotaGroups,
  buildGeminiCliQuotaBuckets,
  buildKimiQuotaRows,
  createStatusError,
  formatCodexResetLabel,
  formatQuotaResetTime,
  getStatusFromError,
  isAntigravityFile,
  isClaudeFile,
  isCodexFile,
  isDisabledAuthFile,
  isGeminiCliFile,
  isKimiFile,
  isRuntimeOnlyAuthFile,
  normalizeAuthIndex,
  normalizeGeminiCliModelId,
  normalizeNumberValue,
  normalizePlanType,
  normalizeQuotaFraction,
  normalizeStringValue,
  parseAntigravityPayload,
  parseClaudeUsagePayload,
  parseCodexUsagePayload,
  parseGeminiCliQuotaPayload,
  parseKimiUsagePayload,
  resolveCodexChatgptAccountId,
  resolveCodexPlanType,
  resolveGeminiCliProjectId,
} from "../utils/quota";

const DEFAULT_ANTIGRAVITY_PROJECT_ID = "bamboo-precept-lgxtn";

const getApiCallErrorMessage = (result: ApiCallResult): string => {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object";

  const status = result.statusCode;
  const body = result.body;
  const bodyText = result.bodyText;
  let message = "";

  if (isRecord(body)) {
    const errorValue = body.error;
    if (isRecord(errorValue) && typeof errorValue.message === "string") {
      message = errorValue.message;
    } else if (typeof errorValue === "string") {
      message = errorValue;
    }
    if (!message && typeof body.message === "string") {
      message = body.message;
    }
  } else if (typeof body === "string") {
    message = body;
  }

  if (!message && bodyText) {
    message = bodyText;
  }

  if (status && message) return `${status} ${message}`.trim();
  if (status) return `HTTP ${status}`;
  return message || "请求失败";
};

const resolveAntigravityProjectId = async (file: AuthFileItem): Promise<string> => {
  try {
    const text = await downloadAuthFileText(file.name);
    const trimmed = text.trim();
    if (!trimmed) return DEFAULT_ANTIGRAVITY_PROJECT_ID;
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    const topLevel = normalizeStringValue(parsed.project_id ?? parsed.projectId);
    if (topLevel) return topLevel;

    const installed =
      parsed.installed && typeof parsed.installed === "object" && parsed.installed !== null
        ? (parsed.installed as Record<string, unknown>)
        : null;
    const installedProjectId = installed
      ? normalizeStringValue(installed.project_id ?? installed.projectId)
      : null;
    if (installedProjectId) return installedProjectId;

    const web =
      parsed.web && typeof parsed.web === "object" && parsed.web !== null
        ? (parsed.web as Record<string, unknown>)
        : null;
    const webProjectId = web ? normalizeStringValue(web.project_id ?? web.projectId) : null;
    if (webProjectId) return webProjectId;
  } catch {
    return DEFAULT_ANTIGRAVITY_PROJECT_ID;
  }

  return DEFAULT_ANTIGRAVITY_PROJECT_ID;
};

const buildClaudeQuotaWindows = (payload: Record<string, unknown>): QuotaClaudeQuotaWindow[] => {
  const labelMap: Record<string, string> = {
    five_hour: "5 小时",
    seven_day: "7 天",
    seven_day_oauth_apps: "7 天 OAuth Apps",
    seven_day_opus: "7 天 Opus",
    seven_day_sonnet: "7 天 Sonnet",
    seven_day_cowork: "7 天 Cowork",
    iguana_necktie: "Iguana Necktie",
  };
  const windows: QuotaClaudeQuotaWindow[] = [];
  for (const { key, id } of CLAUDE_USAGE_WINDOW_KEYS) {
    const raw = payload[key as keyof typeof payload];
    if (!raw || typeof raw !== "object" || !("utilization" in raw)) continue;
    const typedWindow = raw as { utilization: number; resets_at: string };
    const usedPercent = normalizeNumberValue(typedWindow.utilization);
    const resetLabel = formatQuotaResetTime(typedWindow.resets_at);
    windows.push({
      id,
      label: labelMap[key] ?? key,
      usedPercent,
      resetLabel,
    });
  }
  return windows;
};

const buildCodexQuotaWindows = (payload: QuotaCodexUsagePayload): QuotaCodexQuotaWindow[] => {
  const FIVE_HOUR_SECONDS = 18000;
  const WEEK_SECONDS = 604800;
  const WINDOW_META = {
    codeFiveHour: { id: "five-hour", label: "主窗口" },
    codeWeekly: { id: "weekly", label: "次窗口" },
    codeReviewFiveHour: { id: "code-review-five-hour", label: "代码审查主窗口" },
    codeReviewWeekly: { id: "code-review-weekly", label: "代码审查次窗口" },
  } as const;

  const rateLimit = payload.rate_limit ?? payload.rateLimit ?? undefined;
  const codeReviewLimit = payload.code_review_rate_limit ?? payload.codeReviewRateLimit ?? undefined;
  const additionalRateLimits = payload.additional_rate_limits ?? payload.additionalRateLimits ?? [];
  const windows: QuotaCodexQuotaWindow[] = [];

  const addWindow = (
    id: string,
    label: string,
    window?: QuotaCodexUsageWindow | null,
    limitReached?: boolean,
    allowed?: boolean,
    labelParams?: Record<string, string | number>
  ) => {
    if (!window) return;
    const resetLabel = formatCodexResetLabel(window);
    const usedPercentRaw = normalizeNumberValue(window.used_percent ?? window.usedPercent);
    const isLimitReached = Boolean(limitReached) || allowed === false;
    const usedPercent = usedPercentRaw ?? (isLimitReached && resetLabel !== "-" ? 100 : null);
    windows.push({
      id,
      label,
      labelParams,
      usedPercent,
      resetLabel,
    });
  };

  const getWindowSeconds = (window?: QuotaCodexUsageWindow | null): number | null => {
    if (!window) return null;
    return normalizeNumberValue(window.limit_window_seconds ?? window.limitWindowSeconds);
  };

  const rawLimitReached = rateLimit?.limit_reached ?? rateLimit?.limitReached;
  const rawAllowed = rateLimit?.allowed;

  const pickClassifiedWindows = (
    limitInfo?: QuotaCodexRateLimitInfo | null,
    options?: { allowOrderFallback?: boolean }
  ): { fiveHourWindow: QuotaCodexUsageWindow | null; weeklyWindow: QuotaCodexUsageWindow | null } => {
    const allowOrderFallback = options?.allowOrderFallback ?? true;
    const primaryWindow = limitInfo?.primary_window ?? limitInfo?.primaryWindow ?? null;
    const secondaryWindow = limitInfo?.secondary_window ?? limitInfo?.secondaryWindow ?? null;
    const rawWindows = [primaryWindow, secondaryWindow];

    let fiveHourWindow: QuotaCodexUsageWindow | null = null;
    let weeklyWindow: QuotaCodexUsageWindow | null = null;

    for (const window of rawWindows) {
      if (!window) continue;
      const seconds = getWindowSeconds(window);
      if (seconds === FIVE_HOUR_SECONDS && !fiveHourWindow) {
        fiveHourWindow = window;
      } else if (seconds === WEEK_SECONDS && !weeklyWindow) {
        weeklyWindow = window;
      }
    }

    if (allowOrderFallback) {
      if (!fiveHourWindow) {
        fiveHourWindow = primaryWindow && primaryWindow !== weeklyWindow ? primaryWindow : null;
      }
      if (!weeklyWindow) {
        weeklyWindow = secondaryWindow && secondaryWindow !== fiveHourWindow ? secondaryWindow : null;
      }
    }

    return { fiveHourWindow, weeklyWindow };
  };

  const rateWindows = pickClassifiedWindows(rateLimit);
  addWindow(
    WINDOW_META.codeFiveHour.id,
    WINDOW_META.codeFiveHour.label,
    rateWindows.fiveHourWindow,
    rawLimitReached,
    rawAllowed
  );
  addWindow(
    WINDOW_META.codeWeekly.id,
    WINDOW_META.codeWeekly.label,
    rateWindows.weeklyWindow,
    rawLimitReached,
    rawAllowed
  );

  const codeReviewWindows = pickClassifiedWindows(codeReviewLimit);
  const codeReviewLimitReached = codeReviewLimit?.limit_reached ?? codeReviewLimit?.limitReached;
  const codeReviewAllowed = codeReviewLimit?.allowed;
  addWindow(
    WINDOW_META.codeReviewFiveHour.id,
    WINDOW_META.codeReviewFiveHour.label,
    codeReviewWindows.fiveHourWindow,
    codeReviewLimitReached,
    codeReviewAllowed
  );
  addWindow(
    WINDOW_META.codeReviewWeekly.id,
    WINDOW_META.codeReviewWeekly.label,
    codeReviewWindows.weeklyWindow,
    codeReviewLimitReached,
    codeReviewAllowed
  );

  const normalizeWindowId = (raw: string) =>
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  if (Array.isArray(additionalRateLimits)) {
    additionalRateLimits.forEach((limitItem, index) => {
      const rateInfo = limitItem?.rate_limit ?? limitItem?.rateLimit ?? null;
      if (!rateInfo) return;

      const limitName =
        normalizeStringValue(limitItem?.limit_name ?? limitItem?.limitName) ??
        normalizeStringValue(limitItem?.metered_feature ?? limitItem?.meteredFeature) ??
        `additional-${index + 1}`;

      const idPrefix = normalizeWindowId(limitName) || `additional-${index + 1}`;
      const additionalPrimaryWindow = rateInfo.primary_window ?? rateInfo.primaryWindow ?? null;
      const additionalSecondaryWindow = rateInfo.secondary_window ?? rateInfo.secondaryWindow ?? null;
      const additionalLimitReached = rateInfo.limit_reached ?? rateInfo.limitReached;
      const additionalAllowed = rateInfo.allowed;

      addWindow(
        `${idPrefix}-five-hour-${index}`,
        `附加 ${limitName} 主窗口`,
        additionalPrimaryWindow,
        additionalLimitReached,
        additionalAllowed,
        { name: limitName }
      );
      addWindow(
        `${idPrefix}-weekly-${index}`,
        `附加 ${limitName} 次窗口`,
        additionalSecondaryWindow,
        additionalLimitReached,
        additionalAllowed,
        { name: limitName }
      );
    });
  }

  return windows;
};

const fetchAntigravityQuota = async (file: AuthFileItem): Promise<QuotaAntigravityQuotaGroup[]> => {
  const rawAuthIndex = file["auth_index"] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error("缺少 auth_index");
  }

  const projectId = await resolveAntigravityProjectId(file);
  const requestBody = JSON.stringify({ project: projectId });

  let lastError = "";
  let lastStatus: number | undefined;
  let priorityStatus: number | undefined;
  let hadSuccess = false;

  for (const url of ANTIGRAVITY_QUOTA_URLS) {
    try {
      const result = await apiCall({
        authIndex,
        method: "POST",
        url,
        header: { ...ANTIGRAVITY_REQUEST_HEADERS },
        data: requestBody,
      });

      if (result.statusCode < 200 || result.statusCode >= 300) {
        lastError = getApiCallErrorMessage(result);
        lastStatus = result.statusCode;
        if (result.statusCode === 403 || result.statusCode === 404) {
          priorityStatus ??= result.statusCode;
        }
        continue;
      }

      hadSuccess = true;
      const payload = parseAntigravityPayload(result.body ?? result.bodyText);
      const models = payload?.models;
      if (!models || typeof models !== "object" || Array.isArray(models)) {
        lastError = "未返回模型列表";
        continue;
      }

      const groups = buildAntigravityQuotaGroups(models as QuotaAntigravityModelsPayload);
      if (groups.length === 0) {
        lastError = "未返回模型列表";
        continue;
      }

      return groups;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : "请求失败";
      const status = getStatusFromError(err);
      if (status) {
        lastStatus = status;
        if (status === 403 || status === 404) {
          priorityStatus ??= status;
        }
      }
    }
  }

  if (hadSuccess) {
    return [];
  }

  throw createStatusError(lastError || "请求失败", priorityStatus ?? lastStatus);
};

const fetchClaudeQuota = async (
  file: AuthFileItem
): Promise<{ windows: QuotaClaudeQuotaWindow[]; extraUsage?: QuotaClaudeExtraUsage | null }> => {
  const rawAuthIndex = file["auth_index"] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error("缺少 auth_index");
  }

  const result = await apiCall({
    authIndex,
    method: "GET",
    url: CLAUDE_USAGE_URL,
    header: { ...CLAUDE_REQUEST_HEADERS },
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw createStatusError(getApiCallErrorMessage(result), result.statusCode);
  }

  const payload = parseClaudeUsagePayload(result.body ?? result.bodyText);
  if (!payload) {
    throw new Error("未返回有效额度数据");
  }

  const windows = buildClaudeQuotaWindows(payload as Record<string, unknown>);
  return { windows, extraUsage: (payload as { extra_usage?: QuotaClaudeExtraUsage }).extra_usage };
};

const fetchCodexQuota = async (
  file: AuthFileItem
): Promise<{ planType: string | null; windows: QuotaCodexQuotaWindow[] }> => {
  const rawAuthIndex = file["auth_index"] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error("缺少 auth_index");
  }

  const planTypeFromFile = resolveCodexPlanType(file);
  const accountId = resolveCodexChatgptAccountId(file);
  if (!accountId) {
    throw new Error("缺少 ChatGPT Account ID");
  }

  const requestHeader: Record<string, string> = {
    ...CODEX_REQUEST_HEADERS,
    "Chatgpt-Account-Id": accountId,
  };

  const result = await apiCall({
    authIndex,
    method: "GET",
    url: CODEX_USAGE_URL,
    header: requestHeader,
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw createStatusError(getApiCallErrorMessage(result), result.statusCode);
  }

  const payload = parseCodexUsagePayload(result.body ?? result.bodyText) as QuotaCodexUsagePayload | null;
  if (!payload) {
    throw new Error("未返回额度窗口");
  }

  const planTypeFromUsage = normalizePlanType(payload.plan_type ?? payload.planType);
  const windows = buildCodexQuotaWindows(payload);
  return { planType: planTypeFromUsage ?? planTypeFromFile, windows };
};

const fetchGeminiCliQuota = async (
  file: AuthFileItem
): Promise<QuotaGeminiCliQuotaBucketState[]> => {
  const rawAuthIndex = file["auth_index"] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error("缺少 auth_index");
  }

  const projectId = resolveGeminiCliProjectId(file);
  if (!projectId) {
    throw new Error("缺少 Project ID");
  }

  const result = await apiCall({
    authIndex,
    method: "POST",
    url: GEMINI_CLI_QUOTA_URL,
    header: { ...GEMINI_CLI_REQUEST_HEADERS },
    data: JSON.stringify({ project: projectId }),
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw createStatusError(getApiCallErrorMessage(result), result.statusCode);
  }

  const payload = parseGeminiCliQuotaPayload(result.body ?? result.bodyText);
  const buckets = Array.isArray(payload?.buckets) ? payload?.buckets : [];
  if (buckets.length === 0) return [];

  const parsedBuckets: QuotaGeminiCliParsedBucket[] = buckets
    .map((bucket) => {
      const modelId = normalizeGeminiCliModelId(bucket.modelId ?? bucket.model_id);
      if (!modelId) return null;
      const tokenType = normalizeStringValue(bucket.tokenType ?? bucket.token_type);
      const remainingFractionRaw = normalizeQuotaFraction(
        bucket.remainingFraction ?? bucket.remaining_fraction
      );
      const remainingAmount = normalizeNumberValue(
        bucket.remainingAmount ?? bucket.remaining_amount
      );
      const resetTime = normalizeStringValue(bucket.resetTime ?? bucket.reset_time) ?? undefined;
      let fallbackFraction: number | null = null;
      if (remainingAmount !== null) {
        fallbackFraction = remainingAmount <= 0 ? 0 : null;
      } else if (resetTime) {
        fallbackFraction = 0;
      }
      const remainingFraction = remainingFractionRaw ?? fallbackFraction;
      return {
        modelId,
        tokenType,
        remainingFraction,
        remainingAmount,
        resetTime,
      } as QuotaGeminiCliParsedBucket;
    })
    .filter(Boolean) as QuotaGeminiCliParsedBucket[];

  return buildGeminiCliQuotaBuckets(parsedBuckets);
};

const fetchKimiQuota = async (file: AuthFileItem): Promise<QuotaKimiQuotaRow[]> => {
  const rawAuthIndex = file["auth_index"] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error("缺少 auth_index");
  }

  const result = await apiCall({
    authIndex,
    method: "GET",
    url: KIMI_USAGE_URL,
    header: { ...KIMI_REQUEST_HEADERS },
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw createStatusError(getApiCallErrorMessage(result), result.statusCode);
  }

  const payload = parseKimiUsagePayload(result.body ?? result.bodyText);
  if (!payload) {
    throw new Error("未返回有效额度数据");
  }

  return buildKimiQuotaRows(payload);
};

export const useQuotaStore = defineStore("quota", () => {
  const antigravityQuota = ref<Record<string, QuotaAntigravityState>>({});
  const claudeQuota = ref<Record<string, QuotaClaudeState>>({});
  const codexQuota = ref<Record<string, QuotaCodexState>>({});
  const geminiCliQuota = ref<Record<string, QuotaGeminiCliState>>({});
  const kimiQuota = ref<Record<string, QuotaKimiState>>({});

  const antigravityLoading = ref(false);
  const claudeLoading = ref(false);
  const codexLoading = ref(false);
  const geminiCliLoading = ref(false);
  const kimiLoading = ref(false);

  const loadQuota = async <TState, TData>(
    files: AuthFileItem[],
    quotaRef: { value: Record<string, TState> },
    loadingRef: { value: boolean },
    filterFn: (file: AuthFileItem) => boolean,
    fetchFn: (file: AuthFileItem) => Promise<TData>,
    buildLoading: () => TState,
    buildSuccess: (data: TData) => TState,
    buildError: (message: string, status?: number) => TState
  ) => {
    if (loadingRef.value) return;
    loadingRef.value = true;

    const safeFiles = files.filter((file): file is AuthFileItem => Boolean(file && file.name));
    const targets = safeFiles.filter(filterFn);
    const targetNames = new Set(targets.map((file) => file.name));

    const trimmed: Record<string, TState> = {};
    Object.entries(quotaRef.value).forEach(([name, state]) => {
      if (targetNames.has(name)) {
        trimmed[name] = state;
      }
    });
    quotaRef.value = trimmed;

    if (targets.length === 0) {
      loadingRef.value = false;
      return;
    }

    const loadingState: Record<string, TState> = { ...quotaRef.value };
    targets.forEach((file) => {
      loadingState[file.name] = buildLoading();
    });
    quotaRef.value = loadingState;

    const results = await Promise.all(
      targets.map(async (file) => {
        try {
          const data = await fetchFn(file);
          return { name: file.name, ok: true as const, data };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const status = getStatusFromError(err);
          return { name: file.name, ok: false as const, message, status };
        }
      })
    );

    const nextState: Record<string, TState> = { ...quotaRef.value };
    results.forEach((result) => {
      if (result.ok) {
        nextState[result.name] = buildSuccess(result.data as TData);
      } else {
        nextState[result.name] = buildError(result.message, result.status);
      }
    });
    quotaRef.value = nextState;

    loadingRef.value = false;
  };

  const refreshAntigravity = async (files: AuthFileItem[]) => {
    await loadQuota(
      files,
      antigravityQuota,
      antigravityLoading,
      (file) => isAntigravityFile(file) && !isRuntimeOnlyAuthFile(file) && !isDisabledAuthFile(file),
      fetchAntigravityQuota,
      () => ({ status: "loading", groups: [] } as QuotaAntigravityState),
      (groups) => ({ status: "success", groups } as QuotaAntigravityState),
      (message, status) => ({ status: "error", groups: [], error: message, errorStatus: status } as QuotaAntigravityState)
    );
  };

  const refreshClaude = async (files: AuthFileItem[]) => {
    await loadQuota(
      files,
      claudeQuota,
      claudeLoading,
      (file) => isClaudeFile(file) && !isRuntimeOnlyAuthFile(file) && !isDisabledAuthFile(file),
      fetchClaudeQuota,
      () => ({ status: "loading", windows: [] } as QuotaClaudeState),
      (data) => ({ status: "success", windows: data.windows, extraUsage: data.extraUsage } as QuotaClaudeState),
      (message, status) => ({ status: "error", windows: [], error: message, errorStatus: status } as QuotaClaudeState)
    );
  };

  const refreshCodex = async (files: AuthFileItem[]) => {
    await loadQuota(
      files,
      codexQuota,
      codexLoading,
      (file) => isCodexFile(file) && !isRuntimeOnlyAuthFile(file) && !isDisabledAuthFile(file),
      fetchCodexQuota,
      () => ({ status: "loading", windows: [] } as QuotaCodexState),
      (data) => ({ status: "success", windows: data.windows, planType: data.planType } as QuotaCodexState),
      (message, status) => ({ status: "error", windows: [], error: message, errorStatus: status } as QuotaCodexState)
    );
  };

  const refreshGeminiCli = async (files: AuthFileItem[]) => {
    await loadQuota(
      files,
      geminiCliQuota,
      geminiCliLoading,
      (file) => isGeminiCliFile(file) && !isRuntimeOnlyAuthFile(file) && !isDisabledAuthFile(file),
      fetchGeminiCliQuota,
      () => ({ status: "loading", buckets: [] } as QuotaGeminiCliState),
      (buckets) => ({ status: "success", buckets } as QuotaGeminiCliState),
      (message, status) => ({ status: "error", buckets: [], error: message, errorStatus: status } as QuotaGeminiCliState)
    );
  };

  const refreshKimi = async (files: AuthFileItem[]) => {
    await loadQuota(
      files,
      kimiQuota,
      kimiLoading,
      (file) => isKimiFile(file) && !isRuntimeOnlyAuthFile(file) && !isDisabledAuthFile(file),
      fetchKimiQuota,
      () => ({ status: "loading", rows: [] } as QuotaKimiState),
      (rows) => ({ status: "success", rows } as QuotaKimiState),
      (message, status) => ({ status: "error", rows: [], error: message, errorStatus: status } as QuotaKimiState)
    );
  };

  const clearQuotaCache = () => {
    antigravityQuota.value = {};
    claudeQuota.value = {};
    codexQuota.value = {};
    geminiCliQuota.value = {};
    kimiQuota.value = {};
  };

  return {
    antigravityQuota,
    claudeQuota,
    codexQuota,
    geminiCliQuota,
    kimiQuota,
    antigravityLoading,
    claudeLoading,
    codexLoading,
    geminiCliLoading,
    kimiLoading,
    refreshAntigravity,
    refreshClaude,
    refreshCodex,
    refreshGeminiCli,
    refreshKimi,
    clearQuotaCache,
  };
});
