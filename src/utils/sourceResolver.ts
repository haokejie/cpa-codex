import type { CodexConfig } from "../types";
import { buildCandidateUsageSourceIds, normalizeAuthIndex } from "./usage";

export type CredentialInfo = {
  name: string;
  type: string;
};

export type SourceDisplay = {
  displayName: string;
  type: string;
};

const formatSourceFallback = (sourceId: string): string => {
  if (!sourceId) return "-";
  if (sourceId.startsWith("t:")) return sourceId.slice(2) || "-";
  if (sourceId.startsWith("k:") || sourceId.startsWith("m:")) {
    const token = sourceId.slice(2);
    if (!token) return "-";
    return `${sourceId.slice(0, 2)}${token.slice(0, 6)}…${token.slice(-4)}`;
  }
  return sourceId;
};

export function buildSourceInfoMap(configs: CodexConfig[]): Map<string, SourceDisplay> {
  const map = new Map<string, SourceDisplay>();
  configs.forEach((config, idx) => {
    const displayName = config.prefix?.trim() || `Codex #${idx + 1}`;
    buildCandidateUsageSourceIds({ apiKey: config.apiKey, prefix: config.prefix }).forEach((id) => {
      map.set(id, { displayName, type: "codex" });
    });
  });
  return map;
}

export function resolveSourceDisplay(
  sourceId: string,
  authIndex: unknown,
  sourceInfoMap: Map<string, SourceDisplay>,
  authFileMap: Map<string, CredentialInfo>,
): SourceDisplay {
  if (sourceId && sourceInfoMap.has(sourceId)) {
    return sourceInfoMap.get(sourceId)!;
  }
  const normalizedAuthIndex = normalizeAuthIndex(authIndex);
  if (normalizedAuthIndex && authFileMap.has(normalizedAuthIndex)) {
    const info = authFileMap.get(normalizedAuthIndex)!;
    return { displayName: info.name, type: info.type };
  }
  return { displayName: formatSourceFallback(sourceId), type: "" };
}
