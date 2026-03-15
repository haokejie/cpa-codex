import { isTauri } from "./tauri";

const MANAGEMENT_API_PREFIX = "/v0/management";
const DEFAULT_TIMEOUT_MS = 30_000;
const MANAGEMENT_PROXY_TARGET = import.meta.env.VITE_MANAGEMENT_PROXY_TARGET;

type RequestContext = "management" | "auth" | "openai";

export function normalizeApiBase(input: string): string {
  let base = input.trim();
  if (!base) return base;
  base = trimTrailingSlashes(base);
  base = stripSuffixCaseInsensitive(base, "/config");
  base = trimTrailingSlashes(base);
  base = stripSuffixCaseInsensitive(base, MANAGEMENT_API_PREFIX);
  base = trimTrailingSlashes(base);
  const lower = base.toLowerCase();
  if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
    base = `http://${base}`;
  }
  return base;
}

export function buildManagementUrl(server: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (shouldUseManagementProxy()) {
    return `${MANAGEMENT_API_PREFIX}${normalizedPath}`;
  }
  const base = normalizeApiBase(server);
  return `${base}${MANAGEMENT_API_PREFIX}${normalizedPath}`;
}

export async function requestJson<T>(
  url: string,
  options: {
    method?: string;
    auth?: string;
    headers?: HeadersInit;
    body?: unknown;
    timeoutMs?: number;
    context?: RequestContext;
  } = {}
): Promise<T> {
  const response = await request(url, options);
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`解析响应失败: ${String(err)}`);
  }
}

export async function requestOk(
  url: string,
  options: {
    method?: string;
    auth?: string;
    headers?: HeadersInit;
    body?: unknown;
    timeoutMs?: number;
    context?: RequestContext;
  } = {}
): Promise<void> {
  await request(url, options);
}

async function request(
  url: string,
  options: {
    method?: string;
    auth?: string;
    headers?: HeadersInit;
    body?: unknown;
    timeoutMs?: number;
    context?: RequestContext;
  }
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.auth) {
    headers.set("Authorization", `Bearer ${options.auth}`);
  }
  let body: BodyInit | null | undefined = options.body as BodyInit | null | undefined;
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(mapStatus(response.status, options.context || "management"));
    }
    return response;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error("请求超时");
      }
      const msg = err.message || "";
      if (msg && msg !== "Failed to fetch" && msg !== "NetworkError when attempting to fetch resource.") {
        throw err;
      }
    }
    throw new Error(mapNetworkError(err));
  } finally {
    clearTimeout(timer);
  }
}

function mapStatus(status: number, context: RequestContext): string {
  if (context === "auth") {
    switch (status) {
      case 401:
        return "认证失败，请检查密码";
      case 403:
        return "没有访问权限，请检查密码";
      case 404:
        return "接口不存在，请确认服务器地址";
      case 408:
        return "请求超时";
      case 429:
        return "请求过于频繁，请稍后重试";
      default:
        return status >= 500 ? `服务器错误（HTTP ${status}）` : `登录失败（HTTP ${status}）`;
    }
  }
  if (context === "openai") {
    switch (status) {
      case 401:
      case 403:
        return "认证失败，请检查 API Key";
      case 429:
        return "请求过于频繁，请稍后重试";
      default:
        return status >= 500 ? `服务器错误（HTTP ${status}）` : `请求失败（HTTP ${status}）`;
    }
  }
  switch (status) {
    case 401:
    case 403:
      return "认证失败，请重新登录";
    case 404:
      return "接口不存在，请确认服务器版本 >= 6.8.0";
    default:
      return status >= 500 ? `服务器错误（HTTP ${status}）` : `请求失败（HTTP ${status}）`;
  }
}

function mapNetworkError(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("timeout")) return "请求超时";
    if (message.includes("failed to fetch") || message.includes("networkerror")) return "无法连接服务器";
    return `请求失败: ${err.message}`;
  }
  return `请求失败: ${String(err)}`;
}

function trimTrailingSlashes(value: string): string {
  let out = value;
  while (out.endsWith("/")) {
    out = out.slice(0, -1);
  }
  return out;
}

function stripSuffixCaseInsensitive(value: string, suffix: string): string {
  const lower = value.toLowerCase();
  const suffixLower = suffix.toLowerCase();
  if (lower.endsWith(suffixLower)) {
    return value.slice(0, value.length - suffix.length);
  }
  return value;
}

function shouldUseManagementProxy(): boolean {
  return Boolean(import.meta.env.DEV && !isTauri() && MANAGEMENT_PROXY_TARGET);
}
