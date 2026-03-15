import type { AuthFileItem } from "../types";
import { buildManagementUrl, requestJson, requestOk } from "./managementClient";
import { requireSession } from "./session";

type RawAuthFileItem = AuthFileItem & {
  status_message?: string;
  last_refresh?: string | number;
};

function normalizeAuthFile(item: RawAuthFileItem): AuthFileItem {
  return {
    ...item,
    statusMessage: item.statusMessage ?? item.status_message,
    lastRefresh: item.lastRefresh ?? item.last_refresh,
  };
}

export async function listAuthFiles(): Promise<AuthFileItem[]> {
  const session = requireSession();
  const url = buildManagementUrl(session.server, "/auth-files");
  const body = await requestJson<unknown>(url, { auth: session.password, context: "management" });
  const items = extractFiles(body);
  return items.map(normalizeAuthFile);
}

export async function setAuthFileStatus(name: string, disabled: boolean): Promise<void> {
  const session = requireSession();
  const url = buildManagementUrl(session.server, "/auth-files/status");
  await requestOk(url, {
    method: "PATCH",
    auth: session.password,
    body: { name, disabled },
    context: "management",
  });
}

export async function deleteAuthFile(name: string): Promise<void> {
  const session = requireSession();
  const url = `${buildManagementUrl(session.server, "/auth-files")}?name=${encodeURIComponent(name)}`;
  await requestOk(url, { method: "DELETE", auth: session.password, context: "management" });
}

export async function deleteAllAuthFiles(): Promise<void> {
  const session = requireSession();
  const url = `${buildManagementUrl(session.server, "/auth-files")}?all=true`;
  await requestOk(url, { method: "DELETE", auth: session.password, context: "management" });
}

export async function uploadAuthFile(file: File): Promise<void> {
  const session = requireSession();
  const url = buildManagementUrl(session.server, "/auth-files");
  const form = new FormData();
  form.append("file", file, file.name);
  await requestOk(url, {
    method: "POST",
    auth: session.password,
    body: form,
    context: "management",
  });
}

function extractFiles(body: unknown): RawAuthFileItem[] {
  if (Array.isArray(body)) return body as RawAuthFileItem[];
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const files = obj.files;
    if (Array.isArray(files)) return files as RawAuthFileItem[];
  }
  return [];
}
