import type { Session } from "../types";

let currentSession: Session | null = null;
const passwordCache = new Map<string, string>();
const rememberPreference = new Map<string, boolean>();
const STORAGE_PASSWORDS_KEY = "cpa-codex:password-cache";
const STORAGE_REMEMBER_KEY = "cpa-codex:remember-preference";

const storage = getStorage();
if (storage) {
  loadPasswordCache(storage);
  loadRememberPreference(storage);
}

export function setSession(session: Session | null) {
  currentSession = session;
}

export function getSession(): Session | null {
  return currentSession;
}

export function requireSession(): Session {
  if (!currentSession) {
    throw new Error("未登录");
  }
  return currentSession;
}

export function cachePassword(accountKey: string, password: string, remember: boolean) {
  if (remember) {
    passwordCache.set(accountKey, password);
  } else {
    passwordCache.delete(accountKey);
  }
  rememberPreference.set(accountKey, remember);
  persistPasswordCache();
  persistRememberPreference();
}

export function forgetPassword(accountKey: string) {
  passwordCache.delete(accountKey);
  rememberPreference.delete(accountKey);
  persistPasswordCache();
  persistRememberPreference();
}

export function clearSession() {
  currentSession = null;
}

export function hasCachedPassword(accountKey: string): boolean {
  return passwordCache.has(accountKey);
}

export function getCachedPassword(accountKey: string): string | null {
  return passwordCache.get(accountKey) ?? null;
}

export function getRememberPreference(accountKey: string): boolean | undefined {
  return rememberPreference.get(accountKey);
}

function persistPasswordCache() {
  if (!storage) return;
  const payload: Record<string, string> = {};
  passwordCache.forEach((value, key) => {
    payload[key] = value;
  });
  try {
    storage.setItem(STORAGE_PASSWORDS_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

function persistRememberPreference() {
  if (!storage) return;
  const payload: Record<string, boolean> = {};
  rememberPreference.forEach((value, key) => {
    payload[key] = value;
  });
  try {
    storage.setItem(STORAGE_REMEMBER_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

function loadPasswordCache(target: Storage) {
  const raw = target.getItem(STORAGE_PASSWORDS_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === "string" && key) {
        passwordCache.set(key, value);
      }
    });
  } catch {
    // ignore parse errors
  }
}

function loadRememberPreference(target: Storage) {
  const raw = target.getItem(STORAGE_REMEMBER_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === "boolean" && key) {
        rememberPreference.set(key, value);
      }
    });
  } catch {
    // ignore parse errors
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
