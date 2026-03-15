import { buildManagementUrl, requestJson, requestOk } from "./managementClient";
import { requireSession } from "./session";

const API_KEYS_PATH = "/api-keys";

export async function listApiKeys(): Promise<string[]> {
  const session = requireSession();
  const url = buildManagementUrl(session.server, API_KEYS_PATH);
  const body = await requestJson<unknown>(url, { auth: session.password, context: "management" });
  const keysValue = extractApiKeys(body);
  return keysValue
    .map(valueToString)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function replaceApiKeys(keys: string[]): Promise<void> {
  const session = requireSession();
  const url = buildManagementUrl(session.server, API_KEYS_PATH);
  await requestOk(url, {
    method: "PUT",
    auth: session.password,
    body: keys,
    context: "management",
  });
}

export async function updateApiKey(index: number, value: string): Promise<void> {
  const session = requireSession();
  const url = buildManagementUrl(session.server, API_KEYS_PATH);
  await requestOk(url, {
    method: "PATCH",
    auth: session.password,
    body: { index, value },
    context: "management",
  });
}

export async function deleteApiKey(index: number): Promise<void> {
  const session = requireSession();
  const url = `${buildManagementUrl(session.server, API_KEYS_PATH)}?index=${index}`;
  await requestOk(url, { method: "DELETE", auth: session.password, context: "management" });
}

function extractApiKeys(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const keys = obj["api-keys"] ?? obj["apiKeys"];
    if (Array.isArray(keys)) return keys;
  }
  return [];
}

function valueToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";
  return String(value);
}
