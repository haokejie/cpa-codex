import type { ApiCallRequest, ApiCallResult } from '../types';
import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

const normalizeBody = (input: unknown): { bodyText: string; body: unknown | null } => {
  if (input === undefined || input === null) {
    return { bodyText: '', body: null };
  }

  if (typeof input === 'string') {
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
};

export async function apiCall(payload: ApiCallRequest): Promise<ApiCallResult> {
  if (!isTauri()) return mock.apiCall();
  const response = await (await getInvoke())('api_call', { payload });
  const record = response as Record<string, unknown>;
  const statusCode = Number(record?.status_code ?? record?.statusCode ?? 0);
  const header = (record?.header ?? record?.headers ?? {}) as Record<string, string[]>;
  const { bodyText, body } = normalizeBody(record?.body);

  return {
    statusCode,
    header,
    bodyText,
    body
  };
}
