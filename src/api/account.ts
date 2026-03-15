import type { Account, CommandResult, LoginPayload } from "../types";
import { buildManagementUrl, normalizeApiBase, requestOk } from "./managementClient";
import {
  cachePassword,
  forgetPassword,
  getCachedPassword,
  getRememberPreference,
  hasCachedPassword,
  setSession,
} from "./session";

type StoredAccount = {
  account_key: string;
  server: string;
  last_login_at: number;
};

const STORAGE_ACCOUNTS_KEY = "cpa-codex:accounts";
const STORAGE_LAST_KEY = "cpa-codex:last-account";

let memoryAccounts: StoredAccount[] = [];
let memoryLastKey: string | null = null;

export async function login(payload: LoginPayload): Promise<CommandResult> {
  const server = normalizeApiBase(payload.server);
  const password = payload.password.trim();
  if (!server) {
    throw new Error("服务器不能为空");
  }
  if (!password) {
    throw new Error("密码不能为空");
  }
  await verifyLogin(server, password);
  const accountKey = server;
  const remember = payload.remember_password ?? true;
  upsertAccount(accountKey, server);
  cachePassword(accountKey, password, remember);
  setSession({ account_key: accountKey, server, password });
  setLastAccountKey(accountKey);
  return { ok: true };
}

export async function loginWithSavedPassword(accountKey: string): Promise<CommandResult> {
  const password = getCachedPassword(accountKey);
  if (!password) {
    throw new Error("未保存密码");
  }
  const account = readAccounts().find((item) => item.account_key === accountKey);
  if (!account) {
    throw new Error("账号不存在");
  }
  return login({ server: account.server, password, remember_password: true });
}

export async function hasSavedPassword(accountKey: string): Promise<boolean> {
  return hasCachedPassword(accountKey);
}

export async function listAccounts(): Promise<Account[]> {
  const accounts = readAccounts()
    .sort((a, b) => b.last_login_at - a.last_login_at)
    .map((item) => ({
      ...item,
      remember_password: getRememberPreference(item.account_key) ?? true,
      has_password: hasCachedPassword(item.account_key),
    }));
  return accounts;
}

export async function getLastAccountKey(): Promise<string | null> {
  const key = readLastAccountKey();
  if (!key) return null;
  return readAccounts().some((item) => item.account_key === key) ? key : null;
}

export async function deleteAccount(accountKey: string): Promise<CommandResult> {
  const next = readAccounts().filter((item) => item.account_key !== accountKey);
  writeAccounts(next);
  forgetPassword(accountKey);
  if (readLastAccountKey() === accountKey) {
    setLastAccountKey(null);
  }
  return { ok: true };
}

async function verifyLogin(server: string, password: string): Promise<void> {
  const url = buildManagementUrl(server, "/config");
  await requestOk(url, { auth: password, context: "auth" });
}

function upsertAccount(accountKey: string, server: string) {
  const next = readAccounts();
  const now = Date.now();
  const index = next.findIndex((item) => item.account_key === accountKey);
  if (index >= 0) {
    next[index] = { ...next[index], server, last_login_at: now };
  } else {
    next.push({ account_key: accountKey, server, last_login_at: now });
  }
  writeAccounts(next);
}

function readAccounts(): StoredAccount[] {
  const storage = getStorage();
  if (!storage) return memoryAccounts;
  const raw = storage.getItem(STORAGE_ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  const storage = getStorage();
  if (!storage) {
    memoryAccounts = accounts;
    return;
  }
  storage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function readLastAccountKey(): string | null {
  const storage = getStorage();
  if (!storage) return memoryLastKey;
  return storage.getItem(STORAGE_LAST_KEY);
}

function setLastAccountKey(key: string | null) {
  const storage = getStorage();
  if (!storage) {
    memoryLastKey = key;
    return;
  }
  if (!key) {
    storage.removeItem(STORAGE_LAST_KEY);
  } else {
    storage.setItem(STORAGE_LAST_KEY, key);
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
