import { invoke } from "@tauri-apps/api/core";
import type { Account, CommandResult, LoginPayload } from "../types";

export async function login(payload: LoginPayload): Promise<CommandResult> {
  return invoke("login", { payload });
}

export async function loginWithSavedPassword(
  accountKey: string
): Promise<CommandResult> {
  return invoke("login_with_saved_password", { accountKey });
}

export async function hasSavedPassword(accountKey: string): Promise<boolean> {
  return invoke("has_saved_password", { accountKey });
}

export async function listAccounts(): Promise<Account[]> {
  return invoke("list_accounts");
}

export async function getLastAccountKey(): Promise<string | null> {
  return invoke("get_last_account_key");
}

export async function deleteAccount(
  accountKey: string
): Promise<CommandResult> {
  return invoke("delete_account", { accountKey });
}
