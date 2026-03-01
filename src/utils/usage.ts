import type {
  ApiModelStats,
  ApiStats,
  ServiceHealthData,
  StatusBlockDetail,
  StatusBlockState,
  UsageRates,
  UsageSparklineSeries,
  UsageStats,
  UsageTokens,
} from "../types";

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasOwn = (obj: RecordValue, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

const readNumber = (obj: RecordValue, key: string): number | undefined => {
  if (!hasOwn(obj, key)) return undefined;
  const n = Number(obj[key]);
  return Number.isFinite(n) ? n : undefined;
};

const clampNonNegative = (n: number) => (n < 0 ? 0 : n);

const readSummary = (obj: RecordValue): UsageStats | null => {
  const total =
    readNumber(obj, "totalRequests") ??
    readNumber(obj, "total_requests");
  const success =
    readNumber(obj, "successCount") ??
    readNumber(obj, "success_count");
  const fail =
    readNumber(obj, "failCount") ??
    readNumber(obj, "failure_count") ??
    readNumber(obj, "fail_count");

  if (total === undefined && success === undefined && fail === undefined) return null;

  const successResolved =
    success ?? (total !== undefined && fail !== undefined ? clampNonNegative(total - fail) : 0);
  const failResolved =
    fail ?? (total !== undefined && success !== undefined ? clampNonNegative(total - success) : 0);
  const totalResolved = total ?? successResolved + failResolved;

  return {
    totalRequests: clampNonNegative(totalResolved),
    successCount: clampNonNegative(successResolved),
    failCount: clampNonNegative(failResolved),
  };
};

const summarizeFromDetails = (usage: RecordValue): UsageStats | null => {
  const apis = isRecord(usage.apis) ? usage.apis : null;
  const apiList = apis ? Object.values(apis) : Array.isArray(usage.apis) ? usage.apis : null;
  if (!apiList) return null;

  let totalRequests = 0;
  let successCount = 0;
  let failCount = 0;
  let used = false;

  apiList.forEach((apiEntry) => {
    if (!isRecord(apiEntry)) return;

    const modelsObj = isRecord(apiEntry.models) ? apiEntry.models : null;
    const models = modelsObj ? Object.values(modelsObj) : Array.isArray(apiEntry.models) ? apiEntry.models : null;
    let apiCounted = false;

    if (models) {
      models.forEach((modelEntry) => {
        if (!isRecord(modelEntry)) return;

        const details = Array.isArray(modelEntry.details)
          ? modelEntry.details
          : Array.isArray((modelEntry as RecordValue).events)
            ? (modelEntry as RecordValue).events as unknown[]
            : null;
        if (details && details.length) {
          details.forEach((detail) => {
            if (!isRecord(detail)) return;
            totalRequests += 1;
            if (detail.failed === true) {
              failCount += 1;
            } else {
              successCount += 1;
            }
          });
          apiCounted = true;
          used = true;
          return;
        }

        const modelSummary = readSummary(modelEntry);
        if (modelSummary) {
          totalRequests += modelSummary.totalRequests;
          successCount += modelSummary.successCount;
          failCount += modelSummary.failCount;
          apiCounted = true;
          used = true;
        }
      });
    }

    if (!apiCounted) {
      const apiDetails = Array.isArray(apiEntry.details) ? apiEntry.details : null;
      if (apiDetails && apiDetails.length) {
        apiDetails.forEach((detail) => {
          if (!isRecord(detail)) return;
          totalRequests += 1;
          if (detail.failed === true) {
            failCount += 1;
          } else {
            successCount += 1;
          }
        });
        used = true;
        return;
      }
      const apiSummary = readSummary(apiEntry);
      if (apiSummary) {
        totalRequests += apiSummary.totalRequests;
        successCount += apiSummary.successCount;
        failCount += apiSummary.failCount;
        used = true;
      }
    }
  });

  if (!used) return null;
  return {
    totalRequests,
    successCount,
    failCount,
  };
};

export function summarizeUsage(raw: unknown): UsageStats {
  if (!isRecord(raw)) {
    return { totalRequests: 0, successCount: 0, failCount: 0 };
  }

  const direct = readSummary(raw);
  const derived = summarizeFromDetails(raw);
  if (direct) {
    if (derived && (direct.totalRequests === 0 && derived.totalRequests > 0)) {
      return derived;
    }
    return direct;
  }

  if (derived) return derived;

  return { totalRequests: 0, successCount: 0, failCount: 0 };
}

export function unwrapUsagePayload(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  if (hasOwn(raw, "usage")) return (raw as RecordValue).usage;
  const data = (raw as RecordValue).data;
  if (isRecord(data) && hasOwn(data, "usage")) return (data as RecordValue).usage;
  const payload = (raw as RecordValue).payload;
  if (isRecord(payload) && hasOwn(payload, "usage")) return (payload as RecordValue).usage;
  return raw;
}

type UsageDetail = {
  timestamp: string;
  tokens: RecordValue;
  failed?: boolean;
  __timestampMs: number;
  source: string;
  sourceRaw: string;
  auth_index?: unknown;
  __modelName?: string;
};

const readTokenNumber = (obj: RecordValue, key: string): number | undefined => {
  const value = readNumber(obj, key);
  if (value === undefined) return undefined;
  return clampNonNegative(value);
};

const parseTimestampMs = (value: unknown): number => {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value < 1_000_000_000_000 ? value * 1000 : value;
    }
    return 0;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const normalizeAuthIndex = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
};

const USAGE_SOURCE_PREFIX_KEY = "k:";
const USAGE_SOURCE_PREFIX_MASKED = "m:";
const USAGE_SOURCE_PREFIX_TEXT = "t:";

const KEY_LIKE_TOKEN_REGEX =
  /(sk-[A-Za-z0-9-_]{6,}|sk-ant-[A-Za-z0-9-_]{6,}|AIza[0-9A-Za-z-_]{8,}|AI[a-zA-Z0-9_-]{6,}|hf_[A-Za-z0-9]{6,}|pk_[A-Za-z0-9]{6,}|rk_[A-Za-z0-9]{6,})/;
const MASKED_TOKEN_HINT_REGEX = /^[^\s]{1,24}(\*{2,}|\.{3}|…)[^\s]{1,24}$/;

const keyFingerprintCache = new Map<string, string>();

const fnv1a64Hex = (value: string): string => {
  const cached = keyFingerprintCache.get(value);
  if (cached) return cached;

  const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;

  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= BigInt(value.charCodeAt(i));
    hash = (hash * FNV_PRIME) & 0xffffffffffffffffn;
  }

  const hex = hash.toString(16).padStart(16, "0");
  keyFingerprintCache.set(value, hex);
  return hex;
};

const maskApiKey = (value: string): string => {
  const raw = value.trim();
  if (raw.length <= 10) {
    return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
  }
  return `${raw.slice(0, 6)}***${raw.slice(-4)}`;
};

const looksLikeRawSecret = (text: string): boolean => {
  if (!text || /\s/.test(text)) return false;
  const lower = text.toLowerCase();
  if (lower.endsWith(".json")) return false;
  if (lower.startsWith("http://") || lower.startsWith("https://")) return false;
  if (/[\\/]/.test(text)) return false;
  if (KEY_LIKE_TOKEN_REGEX.test(text)) return true;
  if (text.length >= 32 && text.length <= 512) return true;
  if (text.length >= 16 && text.length < 32 && /^[A-Za-z0-9._=-]+$/.test(text)) {
    return /[A-Za-z]/.test(text) && /\d/.test(text);
  }
  return false;
};

const extractRawSecretFromText = (text: string): string | null => {
  if (!text) return null;
  if (looksLikeRawSecret(text)) return text;

  const keyLikeMatch = text.match(KEY_LIKE_TOKEN_REGEX);
  if (keyLikeMatch?.[0]) return keyLikeMatch[0];

  const queryMatch = text.match(
    /(?:[?&])(api[-_]?key|key|token|access_token|authorization)=([^&#\s]+)/i,
  );
  const queryValue = queryMatch?.[2];
  if (queryValue && looksLikeRawSecret(queryValue)) {
    return queryValue;
  }

  const headerMatch = text.match(
    /(api[-_]?key|key|token|access[-_]?token|authorization)\s*[:=]\s*([A-Za-z0-9._=-]+)/i,
  );
  const headerValue = headerMatch?.[2];
  if (headerValue && looksLikeRawSecret(headerValue)) {
    return headerValue;
  }

  const bearerMatch = text.match(/\bBearer\s+([A-Za-z0-9._=-]{6,})/i);
  const bearerValue = bearerMatch?.[1];
  if (bearerValue && looksLikeRawSecret(bearerValue)) {
    return bearerValue;
  }

  return null;
};

export function normalizeUsageSourceId(value: unknown): string {
  const raw = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith(USAGE_SOURCE_PREFIX_KEY)
    || trimmed.startsWith(USAGE_SOURCE_PREFIX_MASKED)
    || trimmed.startsWith(USAGE_SOURCE_PREFIX_TEXT)
  ) {
    return trimmed;
  }

  const extracted = extractRawSecretFromText(trimmed);
  if (extracted) {
    return `${USAGE_SOURCE_PREFIX_KEY}${fnv1a64Hex(extracted)}`;
  }

  if (MASKED_TOKEN_HINT_REGEX.test(trimmed)) {
    return `${USAGE_SOURCE_PREFIX_MASKED}${maskApiKey(trimmed)}`;
  }

  return `${USAGE_SOURCE_PREFIX_TEXT}${trimmed}`;
}

export function buildCandidateUsageSourceIds(input: { apiKey?: string; prefix?: string }): string[] {
  const result: string[] = [];
  const prefix = input.prefix?.trim();
  if (prefix) {
    result.push(`${USAGE_SOURCE_PREFIX_TEXT}${prefix}`);
  }
  const apiKey = input.apiKey?.trim();
  if (apiKey) {
    result.push(`${USAGE_SOURCE_PREFIX_KEY}${fnv1a64Hex(apiKey)}`);
    result.push(`${USAGE_SOURCE_PREFIX_MASKED}${maskApiKey(apiKey)}`);
  }
  return Array.from(new Set(result));
}

export function collectUsageDetails(raw: unknown): UsageDetail[] {
  const usage = isRecord(raw) ? raw : null;
  if (!usage) return [];

  const apis = isRecord(usage.apis) ? usage.apis : null;
  const apiList = apis ? Object.values(apis) : Array.isArray(usage.apis) ? usage.apis : null;
  if (!apiList) return [];

  const details: UsageDetail[] = [];

  apiList.forEach((apiEntry) => {
    if (!isRecord(apiEntry)) return;

    const modelsObj = isRecord(apiEntry.models) ? apiEntry.models : null;
    const modelEntries = modelsObj ? Object.entries(modelsObj) : Array.isArray(apiEntry.models)
      ? apiEntry.models.map((entry, idx) => [`model-${idx + 1}`, entry])
      : null;
    if (!modelEntries) return;

    modelEntries.forEach(([modelName, modelEntry]) => {
      if (!isRecord(modelEntry)) return;
      const modelDetails = Array.isArray(modelEntry.details)
        ? modelEntry.details
        : Array.isArray((modelEntry as RecordValue).events)
          ? (modelEntry as RecordValue).events as unknown[]
          : null;
      if (!modelDetails) return;
      modelDetails.forEach((detail) => {
        if (!isRecord(detail)) return;
        const timestamp = typeof detail.timestamp === "string"
          ? detail.timestamp
          : typeof detail.timestamp === "number"
            ? new Date(parseTimestampMs(detail.timestamp)).toISOString()
            : "";
        if (!timestamp) return;
        const tokens = isRecord(detail.tokens) ? detail.tokens : {};
        const sourceRaw = typeof detail.source === "string"
          ? detail.source
          : detail.source === null || detail.source === undefined
            ? ""
            : String(detail.source);
        details.push({
          timestamp,
          tokens,
          sourceRaw,
          source: normalizeUsageSourceId(sourceRaw),
          auth_index: detail.auth_index,
          failed: detail.failed === true,
          __timestampMs: parseTimestampMs(detail.timestamp),
          __modelName: modelName,
        });
      });
    });
  });

  return details;
}

export function extractTotalTokens(detail: unknown): number {
  const record = isRecord(detail) ? detail : null;
  const tokensRaw = record?.tokens;
  const tokens = isRecord(tokensRaw) ? tokensRaw : {};

  const totalTokens =
    readTokenNumber(tokens, "total_tokens") ??
    readTokenNumber(tokens, "totalTokens");
  if (totalTokens !== undefined) return totalTokens;

  const inputTokens = readTokenNumber(tokens, "input_tokens") ?? 0;
  const outputTokens = readTokenNumber(tokens, "output_tokens") ?? 0;
  const reasoningTokens = readTokenNumber(tokens, "reasoning_tokens") ?? 0;
  const cachedTokens = Math.max(
    readTokenNumber(tokens, "cached_tokens") ?? 0,
    readTokenNumber(tokens, "cache_tokens") ?? 0,
  );

  return clampNonNegative(inputTokens + outputTokens + reasoningTokens + cachedTokens);
}

export function summarizeTokens(raw: unknown): UsageTokens {
  if (!isRecord(raw)) {
    return { totalTokens: 0, cachedTokens: 0, reasoningTokens: 0, hasData: false, hasBreakdown: false };
  }

  const totalTokens =
    readTokenNumber(raw, "total_tokens") ??
    readTokenNumber(raw, "totalTokens");
  const cachedTokens =
    readTokenNumber(raw, "cached_tokens") ??
    readTokenNumber(raw, "cache_tokens") ??
    readTokenNumber(raw, "cachedTokens");
  const reasoningTokens =
    readTokenNumber(raw, "reasoning_tokens") ??
    readTokenNumber(raw, "reasoningTokens");

  const hasBreakdown = cachedTokens !== undefined || reasoningTokens !== undefined;
  if (totalTokens !== undefined) {
    return {
      totalTokens,
      cachedTokens: cachedTokens ?? 0,
      reasoningTokens: reasoningTokens ?? 0,
      hasData: true,
      hasBreakdown,
    };
  }

  const details = collectUsageDetails(raw);
  if (!details.length) {
    return { totalTokens: 0, cachedTokens: 0, reasoningTokens: 0, hasData: false, hasBreakdown: false };
  }

  let total = 0;
  let cached = 0;
  let reasoning = 0;
  let hasTokenBreakdown = false;

  details.forEach((detail) => {
    total += extractTotalTokens(detail);
    const tokens = detail.tokens;
    const cachedValue = Math.max(
      readTokenNumber(tokens, "cached_tokens") ?? 0,
      readTokenNumber(tokens, "cache_tokens") ?? 0,
    );
    if (cachedValue > 0) {
      cached += cachedValue;
      hasTokenBreakdown = true;
    }
    const reasoningValue = readTokenNumber(tokens, "reasoning_tokens") ?? 0;
    if (reasoningValue > 0) {
      reasoning += reasoningValue;
      hasTokenBreakdown = true;
    }
  });

  return {
    totalTokens: clampNonNegative(total),
    cachedTokens: clampNonNegative(cached),
    reasoningTokens: clampNonNegative(reasoning),
    hasData: true,
    hasBreakdown: hasTokenBreakdown,
  };
}

export function calculateRecentRates(raw: unknown, windowMinutes = 30, nowMs?: number): UsageRates {
  const details = collectUsageDetails(raw);
  const effectiveWindow = Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 30;
  if (!details.length) {
    return { rpm: 0, tpm: 0, windowMinutes: effectiveWindow, requestCount: 0, tokenCount: 0, hasData: false };
  }

  const now = Number.isFinite(nowMs) && (nowMs as number) > 0 ? (nowMs as number) : Date.now();
  const windowStart = now - effectiveWindow * 60 * 1000;
  let requestCount = 0;
  let tokenCount = 0;

  details.forEach((detail) => {
    const timestamp = detail.__timestampMs;
    if (!Number.isFinite(timestamp) || timestamp < windowStart || timestamp > now) {
      return;
    }
    requestCount += 1;
    tokenCount += extractTotalTokens(detail);
  });

  const denominator = effectiveWindow > 0 ? effectiveWindow : 1;
  return {
    rpm: requestCount / denominator,
    tpm: tokenCount / denominator,
    windowMinutes: effectiveWindow,
    requestCount,
    tokenCount,
    hasData: true,
  };
}

export function buildHourlySeries(raw: unknown, hours = 24, nowMs?: number): UsageSparklineSeries {
  const details = collectUsageDetails(raw);
  const windowHours = Number.isFinite(hours) && hours > 0 ? Math.floor(hours) : 24;
  const now = Number.isFinite(nowMs) && (nowMs as number) > 0 ? (nowMs as number) : Date.now();
  const hourMs = 60 * 60 * 1000;
  const windowStart = now - windowHours * hourMs;
  const requests = new Array(windowHours).fill(0);
  const tokens = new Array(windowHours).fill(0);
  let used = false;

  details.forEach((detail) => {
    const timestamp = detail.__timestampMs;
    if (!Number.isFinite(timestamp) || timestamp < windowStart || timestamp > now) {
      return;
    }
    const hourIndex = Math.min(
      windowHours - 1,
      Math.floor((timestamp - windowStart) / hourMs),
    );
    requests[hourIndex] += 1;
    tokens[hourIndex] += extractTotalTokens(detail);
    used = true;
  });

  const labels = requests.map((_, idx) => {
    const date = new Date(windowStart + (idx + 1) * hourMs);
    const h = date.getHours().toString().padStart(2, "0");
    return `${h}:00`;
  });

  return {
    labels,
    requests,
    tokens,
    hasData: used,
  };
}

export function buildMinuteSeries(raw: unknown, minutes = 60, nowMs?: number): UsageSparklineSeries {
  const details = collectUsageDetails(raw);
  const windowMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 60;
  const now = Number.isFinite(nowMs) && (nowMs as number) > 0 ? (nowMs as number) : Date.now();
  const minuteMs = 60 * 1000;
  const windowStart = now - windowMinutes * minuteMs;
  const requests = new Array(windowMinutes).fill(0);
  const tokens = new Array(windowMinutes).fill(0);
  let used = false;

  details.forEach((detail) => {
    const timestamp = detail.__timestampMs;
    if (!Number.isFinite(timestamp) || timestamp < windowStart || timestamp > now) {
      return;
    }
    const minuteIndex = Math.min(
      windowMinutes - 1,
      Math.floor((timestamp - windowStart) / minuteMs),
    );
    requests[minuteIndex] += 1;
    tokens[minuteIndex] += extractTotalTokens(detail);
    used = true;
  });

  const labels = requests.map((_, idx) => {
    const date = new Date(windowStart + (idx + 1) * minuteMs);
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  });

  return {
    labels,
    requests,
    tokens,
    hasData: used,
  };
}

export function calculateServiceHealthData(usageDetails: UsageDetail[]): ServiceHealthData {
  const ROWS = 7;
  const COLS = 48;
  const BLOCK_COUNT = ROWS * COLS;
  const BLOCK_DURATION_MS = 30 * 60 * 1000;
  const WINDOW_MS = BLOCK_COUNT * BLOCK_DURATION_MS;

  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const blockStats: Array<{ success: number; failure: number }> = Array.from(
    { length: BLOCK_COUNT },
    () => ({ success: 0, failure: 0 }),
  );

  let totalSuccess = 0;
  let totalFailure = 0;

  usageDetails.forEach((detail) => {
    const timestamp = detail.__timestampMs;
    if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp < windowStart || timestamp > now) {
      return;
    }

    const ageMs = now - timestamp;
    const blockIndex = BLOCK_COUNT - 1 - Math.floor(ageMs / BLOCK_DURATION_MS);

    if (blockIndex >= 0 && blockIndex < BLOCK_COUNT) {
      if (detail.failed) {
        blockStats[blockIndex].failure += 1;
        totalFailure += 1;
      } else {
        blockStats[blockIndex].success += 1;
        totalSuccess += 1;
      }
    }
  });

  const blocks: StatusBlockState[] = [];
  const blockDetails: StatusBlockDetail[] = [];

  blockStats.forEach((stat, idx) => {
    const total = stat.success + stat.failure;
    if (total === 0) {
      blocks.push("idle");
    } else if (stat.failure === 0) {
      blocks.push("success");
    } else if (stat.success === 0) {
      blocks.push("failure");
    } else {
      blocks.push("mixed");
    }

    const blockStartTime = windowStart + idx * BLOCK_DURATION_MS;
    blockDetails.push({
      success: stat.success,
      failure: stat.failure,
      rate: total > 0 ? stat.success / total : -1,
      startTime: blockStartTime,
      endTime: blockStartTime + BLOCK_DURATION_MS,
    });
  });

  const total = totalSuccess + totalFailure;
  const successRate = total > 0 ? (totalSuccess / total) * 100 : 100;

  return {
    blocks,
    blockDetails,
    successRate,
    totalSuccess,
    totalFailure,
    rows: ROWS,
    cols: COLS,
  };
}

export function formatPerMinuteValue(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0.00";
  const abs = Math.abs(num);
  if (abs >= 1000) return Math.round(num).toLocaleString();
  if (abs >= 100) return num.toFixed(0);
  if (abs >= 10) return num.toFixed(1);
  return num.toFixed(2);
}

export function formatCompactNumber(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const abs = Math.abs(num);
  if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return abs >= 1 ? num.toFixed(0) : num.toFixed(2);
}

const readTotalTokens = (obj: RecordValue): number | undefined =>
  readTokenNumber(obj, "total_tokens") ?? readTokenNumber(obj, "totalTokens");

const summarizeDetailList = (details: unknown[]): ApiModelStats => {
  let requests = 0;
  let successCount = 0;
  let failureCount = 0;
  let tokens = 0;
  details.forEach((detail) => {
    if (!isRecord(detail)) return;
    requests += 1;
    if (detail.failed === true) {
      failureCount += 1;
    } else {
      successCount += 1;
    }
    tokens += extractTotalTokens(detail);
  });
  return { requests, successCount, failureCount, tokens };
};

export type UsageTimeRange = "all" | "24h" | "today";

const isWithinRange = (timestampMs: number, range: UsageTimeRange, nowMs: number): boolean => {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return false;
  if (range === "all") return true;
  if (range === "24h") {
    return timestampMs >= nowMs - 24 * 60 * 60 * 1000 && timestampMs <= nowMs;
  }
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return timestampMs >= startMs && timestampMs < endMs;
};

const filterDetailsByRange = (details: unknown[], range: UsageTimeRange, nowMs: number): unknown[] => {
  if (range === "all") return details;
  return details.filter((detail) => {
    if (!isRecord(detail)) return false;
    const ts = parseTimestampMs(detail.timestamp);
    return isWithinRange(ts, range, nowMs);
  });
};

export function buildApiStats(raw: unknown, range: UsageTimeRange = "all", nowMs: number = Date.now()): ApiStats[] {
  const usage = isRecord(raw) ? raw : null;
  if (!usage) return [];

  const apisRaw = usage.apis;
  const apiEntries: Array<[string, RecordValue]> = [];

  if (isRecord(apisRaw)) {
    Object.entries(apisRaw).forEach(([endpoint, entry]) => {
      if (isRecord(entry)) apiEntries.push([endpoint, entry]);
    });
  } else if (Array.isArray(apisRaw)) {
    apisRaw.forEach((entry, idx) => {
      if (isRecord(entry)) apiEntries.push([`API #${idx + 1}`, entry]);
    });
  }

  if (!apiEntries.length) return [];

  const results: ApiStats[] = [];

  apiEntries.forEach(([endpoint, apiEntry]) => {
    const models: Record<string, ApiModelStats> = {};
    let totalRequests = 0;
    let successCount = 0;
    let failureCount = 0;
    let totalTokens = 0;
    let used = false;

    const modelsObj = isRecord(apiEntry.models) ? apiEntry.models : null;
    const modelEntries = modelsObj
      ? Object.entries(modelsObj)
      : Array.isArray(apiEntry.models)
        ? apiEntry.models.map((entry, idx) => [`model-${idx + 1}`, entry] as [string, unknown])
        : null;

    if (modelEntries) {
      modelEntries.forEach(([modelName, modelEntry]) => {
        if (!isRecord(modelEntry)) return;
        const detailList = Array.isArray(modelEntry.details)
          ? modelEntry.details
          : Array.isArray((modelEntry as RecordValue).events)
            ? (modelEntry as RecordValue).events as unknown[]
            : null;

        let stats: ApiModelStats | null = null;
        if (detailList && detailList.length) {
          const filtered = filterDetailsByRange(detailList, range, nowMs);
          if (filtered.length) {
            stats = summarizeDetailList(filtered);
          }
        } else if (range === "all") {
          const summary = readSummary(modelEntry);
          const tokenTotal = readTotalTokens(modelEntry);
          if (summary || tokenTotal !== undefined) {
            stats = {
              requests: summary?.totalRequests ?? 0,
              successCount: summary?.successCount ?? 0,
              failureCount: summary?.failCount ?? 0,
              tokens: tokenTotal ?? 0,
            };
          }
        }

        if (!stats) return;
        if (stats.requests === 0 && stats.tokens === 0 && stats.successCount === 0 && stats.failureCount === 0) {
          return;
        }

        models[modelName] = stats;
        totalRequests += stats.requests;
        successCount += stats.successCount;
        failureCount += stats.failureCount;
        totalTokens += stats.tokens;
        used = true;
      });
    }

    if (!used) {
      const apiDetails = Array.isArray(apiEntry.details) ? apiEntry.details : null;
      if (apiDetails && apiDetails.length) {
        const filtered = filterDetailsByRange(apiDetails, range, nowMs);
        if (filtered.length) {
          const stats = summarizeDetailList(filtered);
          totalRequests = stats.requests;
          successCount = stats.successCount;
          failureCount = stats.failureCount;
          totalTokens = stats.tokens;
          used = true;
        }
      }
    }

    if (!used && range === "all") {
      const summary = readSummary(apiEntry);
      const tokenTotal = readTotalTokens(apiEntry);
      if (summary || tokenTotal !== undefined) {
        totalRequests = summary?.totalRequests ?? 0;
        successCount = summary?.successCount ?? 0;
        failureCount = summary?.failCount ?? 0;
        totalTokens = tokenTotal ?? 0;
        used = true;
      }
    }

    if (!used) return;

    results.push({
      endpoint,
      totalRequests,
      successCount,
      failureCount,
      totalTokens,
      models,
    });
  });

  return results;
}
