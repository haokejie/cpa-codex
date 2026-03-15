import type { CodexConfig } from "../types";
import { buildManagementUrl, requestJson } from "./managementClient";
import { requireSession } from "./session";

const CODEX_API_KEY_PATH = "/codex-api-key";
const CODEX_API_CALL_PATH = "/api-call";
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_AUTH_HEADERS: Record<string, string> = {
  Authorization: "Bearer $TOKEN$",
  "Content-Type": "application/json",
  "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal",
};

type ApiCallRequest = {
  authIndex?: string;
  method: string;
  url: string;
  header?: Record<string, string>;
  data?: string;
};

type ApiCallResult = {
  statusCode: number;
  header: Record<string, string[]>;
  bodyText: string;
  body: unknown | null;
};

const KEY_MAP: Array<[string, string]> = [
  ["api-key", "apiKey"],
  ["base-url", "baseUrl"],
  ["proxy-url", "proxyUrl"],
  ["excluded-models", "excludedModels"],
  ["strict-mode", "strictMode"],
  ["sensitive-words", "sensitiveWords"],
];

export async function getCodexConfigs(): Promise<CodexConfig[]> {
  const session = requireSession();
  const url = buildManagementUrl(session.server, CODEX_API_KEY_PATH);
  const body = await requestJson<unknown>(url, { auth: session.password, context: "management" });
  const arr = extractCodexArray(body);
  return arr.map((item) => normalizeConfig(item)) as CodexConfig[];
}

export async function getCodexQuotaByAuthIndex(
  authIndex: string,
  accountId: string,
  headers?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const requestHeaders = {
    ...CODEX_AUTH_HEADERS,
    "Chatgpt-Account-Id": accountId,
    ...(headers ?? {}),
  };
  const result = await requestApiCall({
    authIndex,
    method: "GET",
    url: CODEX_USAGE_URL,
    header: requestHeaders,
  });
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(getApiCallErrorMessage(result));
  }
  if (result.body && typeof result.body === "object") {
    return result.body as Record<string, unknown>;
  }
  if (result.bodyText) {
    try {
      return JSON.parse(result.bodyText) as Record<string, unknown>;
    } catch {
      // 继续走空响应处理
    }
  }
  throw new Error("额度响应为空");
}

export async function getUsage(): Promise<Record<string, unknown>> {
  const session = requireSession();
  const url = buildManagementUrl(session.server, "/usage");
  return requestJson<Record<string, unknown>>(url, { auth: session.password, context: "management" });
}

function extractCodexArray(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const value = obj["codex-api-key"];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }
  return [];
}

function normalizeConfig(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    const mapped = KEY_MAP.find(([from]) => from === key)?.[1] ?? key;
    if (key === "cloak" && value && typeof value === "object") {
      out[mapped] = normalizeConfig(value as Record<string, unknown>);
    } else {
      out[mapped] = value;
    }
  }
  return out;
}

async function requestApiCall(payload: ApiCallRequest): Promise<ApiCallResult> {
  const session = requireSession();
  const url = buildManagementUrl(session.server, CODEX_API_CALL_PATH);
  const response = await requestJson<Record<string, unknown>>(url, {
    method: "POST",
    auth: session.password,
    body: payload,
    context: "management",
  });
  const statusCode = Number(response?.status_code ?? response?.statusCode ?? 0);
  const header = (response?.header ?? response?.headers ?? {}) as Record<string, string[]>;
  const { bodyText, body } = normalizeApiCallBody(response?.body);
  return { statusCode, header, bodyText, body };
}

function normalizeApiCallBody(input: unknown): { bodyText: string; body: unknown | null } {
  if (input === undefined || input === null) {
    return { bodyText: "", body: null };
  }

  if (typeof input === "string") {
    const text = input;
    const trimmed = text.trim();
    if (!trimmed) {
      return { bodyText: text, body: null };
    }
    try {
      return { bodyText: text, body: JSON.parse(trimmed) };
    } catch {
      return { bodyText: text, body: text };
    }
  }

  try {
    return { bodyText: JSON.stringify(input), body: input };
  } catch {
    return { bodyText: String(input), body: input };
  }
}

function getApiCallErrorMessage(result: ApiCallResult): string {
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
  return message || "Request failed";
}
