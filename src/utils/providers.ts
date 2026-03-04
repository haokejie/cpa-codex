import type { AmpcodeModelMapping, ModelAlias, OpenAIProviderConfig } from "../types";
import { normalizeExcludedModels, normalizeHeaders } from "./transformers";

export const parseTextList = (text: string): string[] =>
  text
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export const formatTextList = (items?: string[]): string =>
  Array.isArray(items) ? items.filter(Boolean).join("\n") : "";

export const parseHeadersText = (text: string): Record<string, string> => {
  const entries: Record<string, string> = {};
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey?.trim();
      const value = rest.join(":").trim();
      if (!key) return;
      entries[key] = value;
    });
  return normalizeHeaders(entries) ?? {};
};

export const formatHeadersText = (headers?: Record<string, string>): string => {
  if (!headers || typeof headers !== "object") return "";
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
};

export const parseExcludedModelsText = (text: string): string[] =>
  normalizeExcludedModels(text);

export const formatExcludedModelsText = (models?: string[]): string =>
  formatTextList(models);

export const parseModelAliasesText = (text: string): ModelAlias[] => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const results: ModelAlias[] = [];

  lines.forEach((line) => {
    const normalized = line.replace(/=>/g, ",");
    const [nameRaw, aliasRaw, priorityRaw, testModelRaw] = normalized.split(",").map((p) => p.trim());
    if (!nameRaw) return;
    const item: ModelAlias = { name: nameRaw };
    if (aliasRaw) item.alias = aliasRaw;
    if (priorityRaw) {
      const parsed = Number(priorityRaw);
      if (Number.isFinite(parsed)) item.priority = parsed;
    }
    if (testModelRaw) item.testModel = testModelRaw;
    results.push(item);
  });

  return results;
};

export const formatModelAliasesText = (models?: ModelAlias[]): string => {
  if (!Array.isArray(models) || models.length === 0) return "";
  return models
    .map((model) => {
      const parts = [model.name, model.alias ?? "", model.priority ?? "", model.testModel ?? ""]
        .map((v) => (v === undefined || v === null ? "" : String(v).trim()))
        .filter((v, idx) => v || idx === 0);
      return parts.join(", ");
    })
    .join("\n");
};

export const maskSecret = (value: string, keep: number = 4): string => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= keep * 2) return `${trimmed.slice(0, keep)}****`;
  return `${trimmed.slice(0, keep)}****${trimmed.slice(-keep)}`;
};

export const normalizeOpenAIBaseUrl = (baseUrl: string): string => {
  let trimmed = String(baseUrl || "").trim();
  if (!trimmed) return "";
  trimmed = trimmed.replace(/\/?v0\/management\/?$/i, "");
  trimmed = trimmed.replace(/\/+$/g, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed;
};

export const buildOpenAIModelsEndpoint = (baseUrl: string): string => {
  const trimmed = normalizeOpenAIBaseUrl(baseUrl);
  if (!trimmed) return "";
  if (trimmed.endsWith("/v1")) return `${trimmed}/models`;
  return `${trimmed}/v1/models`;
};

export const buildOpenAIProviderDraft = (provider: OpenAIProviderConfig) => ({
  ...provider,
  headersText: formatHeadersText(provider.headers),
  modelsText: formatModelAliasesText(provider.models),
  apiKeyEntries: (provider.apiKeyEntries || []).map((entry) => ({
    ...entry,
    headersText: formatHeadersText(entry.headers),
  })),
});

export const buildAmpcodeMappingsText = (mappings?: AmpcodeModelMapping[]): string =>
  Array.isArray(mappings)
    ? mappings.map((mapping) => `${mapping.from} => ${mapping.to}`).join("\n")
    : "";

export const parseAmpcodeMappingsText = (text: string): AmpcodeModelMapping[] => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const results: AmpcodeModelMapping[] = [];
  const seen = new Set<string>();
  lines.forEach((line) => {
    const normalized = line.replace(/=>/g, ",");
    const [fromRaw, toRaw] = normalized.split(",").map((item) => item.trim());
    if (!fromRaw || !toRaw) return;
    const key = fromRaw.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ from: fromRaw, to: toRaw });
  });
  return results;
};
