import type { AuthFileModelDefinition, OAuthModelAliasEntry } from '../types';
import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

type StatusError = { status?: number };

const getStatusCode = (err: unknown): number | undefined => {
  if (!err || typeof err !== 'object') return undefined;
  if ('status' in err) return (err as StatusError).status;
  return undefined;
};

const normalizeOauthExcludedModels = (payload: unknown): Record<string, string[]> => {
  if (!payload || typeof payload !== 'object') return {};

  const record = payload as Record<string, unknown>;
  const source = record['oauth-excluded-models'] ?? record.items ?? payload;
  if (!source || typeof source !== 'object') return {};

  const result: Record<string, string[]> = {};

  Object.entries(source as Record<string, unknown>).forEach(([provider, models]) => {
    const key = String(provider ?? '')
      .trim()
      .toLowerCase();
    if (!key) return;

    const rawList = Array.isArray(models)
      ? models
      : typeof models === 'string'
        ? models.split(/[\n,]+/)
        : [];

    const seen = new Set<string>();
    const normalized: string[] = [];
    rawList.forEach((item) => {
      const trimmed = String(item ?? '').trim();
      if (!trimmed) return;
      const modelKey = trimmed.toLowerCase();
      if (seen.has(modelKey)) return;
      seen.add(modelKey);
      normalized.push(trimmed);
    });

    result[key] = normalized;
  });

  return result;
};

const normalizeOauthModelAlias = (payload: unknown): Record<string, OAuthModelAliasEntry[]> => {
  if (!payload || typeof payload !== 'object') return {};

  const record = payload as Record<string, unknown>;
  const source =
    record['oauth-model-alias'] ??
    record.items ??
    payload;
  if (!source || typeof source !== 'object') return {};

  const result: Record<string, OAuthModelAliasEntry[]> = {};

  Object.entries(source as Record<string, unknown>).forEach(([channel, mappings]) => {
    const key = String(channel ?? '')
      .trim()
      .toLowerCase();
    if (!key) return;
    if (!Array.isArray(mappings)) return;

    const seen = new Set<string>();
    const normalized = mappings
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const entry = item as Record<string, unknown>;
        const name = String(entry.name ?? entry.id ?? entry.model ?? '').trim();
        const alias = String(entry.alias ?? '').trim();
        if (!name || !alias) return null;
        const fork = entry.fork === true;
        return fork ? { name, alias, fork } : { name, alias };
      })
      .filter(Boolean)
      .filter((entry) => {
        const aliasEntry = entry as OAuthModelAliasEntry;
        const dedupeKey = `${aliasEntry.name.toLowerCase()}::${aliasEntry.alias.toLowerCase()}::${aliasEntry.fork ? '1' : '0'}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      }) as OAuthModelAliasEntry[];

    if (normalized.length) {
      result[key] = normalized;
    }
  });

  return result;
};

export async function downloadAuthFileText(name: string): Promise<string> {
  if (!isTauri()) return mock.downloadAuthFileText();
  const bytes = await (await getInvoke())('download_auth_file', { name });
  const buffer = Uint8Array.from(bytes as number[]);
  return new TextDecoder().decode(buffer);
}

export async function getOauthExcludedModels(): Promise<Record<string, string[]>> {
  if (!isTauri()) return mock.getOauthExcludedModels();
  const data = await (await getInvoke())('get_oauth_excluded_models');
  return normalizeOauthExcludedModels(data);
}

export async function saveOauthExcludedModels(provider: string, models: string[]): Promise<void> {
  if (!isTauri()) return mock.saveOauthExcludedModels();
  return (await getInvoke())('save_oauth_excluded_models', { provider, models });
}

export async function deleteOauthExcludedEntry(provider: string): Promise<void> {
  if (!isTauri()) return mock.deleteOauthExcludedEntry();
  return (await getInvoke())('delete_oauth_excluded_entry', { provider });
}

export async function replaceOauthExcludedModels(map: Record<string, string[]>): Promise<void> {
  if (!isTauri()) return mock.replaceOauthExcludedModels();
  const normalized = normalizeOauthExcludedModels(map);
  return (await getInvoke())('replace_oauth_excluded_models', { map: normalized });
}

export async function getOauthModelAlias(): Promise<Record<string, OAuthModelAliasEntry[]>> {
  if (!isTauri()) return mock.getOauthModelAlias();
  const data = await (await getInvoke())('get_oauth_model_alias');
  return normalizeOauthModelAlias(data);
}

export async function saveOauthModelAlias(channel: string, aliases: OAuthModelAliasEntry[]): Promise<void> {
  if (!isTauri()) return mock.saveOauthModelAlias();
  const normalizedChannel = String(channel ?? '')
    .trim()
    .toLowerCase();
  const normalizedAliases = normalizeOauthModelAlias({ [normalizedChannel]: aliases })[normalizedChannel] ?? [];
  return (await getInvoke())('save_oauth_model_alias', { channel: normalizedChannel, aliases: normalizedAliases });
}

export async function deleteOauthModelAlias(channel: string): Promise<void> {
  if (!isTauri()) return mock.deleteOauthModelAlias();
  const normalizedChannel = String(channel ?? '')
    .trim()
    .toLowerCase();

  try {
    await (await getInvoke())('save_oauth_model_alias', { channel: normalizedChannel, aliases: [] });
  } catch (err) {
    const status = getStatusCode(err);
    if (status !== 405) throw err;
    await (await getInvoke())('delete_oauth_model_alias', { channel: normalizedChannel });
  }
}

export async function getModelsForAuthFile(name: string): Promise<AuthFileModelDefinition[]> {
  if (!isTauri()) return mock.getModelsForAuthFile();
  return (await getInvoke())('get_auth_file_models', { name });
}

export async function getModelDefinitions(channel: string): Promise<AuthFileModelDefinition[]> {
  if (!isTauri()) return mock.getModelDefinitions();
  return (await getInvoke())('get_model_definitions', { channel });
}
