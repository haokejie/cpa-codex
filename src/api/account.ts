import type { Account, CommandResult, LoginPayload } from "../types";
import * as mock from "./mock";
import { isTauri, getInvoke } from "./tauri";

export async function login(payload: LoginPayload): Promise<CommandResult> {
  if (!isTauri()) return mock.login();
  return (await getInvoke())("login", { payload });
}

export async function loginWithSavedPassword(
  accountKey: string
): Promise<CommandResult> {
  if (!isTauri()) return mock.loginWithSavedPassword();
  return (await getInvoke())("login_with_saved_password", { accountKey });
}

export async function hasSavedPassword(accountKey: string): Promise<boolean> {
  if (!isTauri()) return mock.hasSavedPassword();
  return (await getInvoke())("has_saved_password", { accountKey });
}

export async function listAccounts(): Promise<Account[]> {
  if (!isTauri()) return mock.listAccounts();
  return (await getInvoke())("list_accounts");
}

export async function getLastAccountKey(): Promise<string | null> {
  if (!isTauri()) return mock.getLastAccountKey();
  return (await getInvoke())("get_last_account_key");
}

export async function deleteAccount(
  accountKey: string
): Promise<CommandResult> {
  if (!isTauri()) return mock.deleteAccount();
  return (await getInvoke())("delete_account", { accountKey });
}
