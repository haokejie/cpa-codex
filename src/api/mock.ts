import type { Account, AppConfig, CodexConfig, CommandResult } from "../types";

// Account mocks
export async function login(): Promise<CommandResult> {
  return { ok: true };
}

export async function loginWithSavedPassword(): Promise<CommandResult> {
  return { ok: true };
}

export async function hasSavedPassword(): Promise<boolean> {
  return true;
}

export async function listAccounts(): Promise<Account[]> {
  return [
    {
      account_key: "http://localhost:8080",
      server: "http://localhost:8080",
      last_login_at: Date.now(),
      remember_password: true,
      has_password: true,
    },
  ];
}

export async function getLastAccountKey(): Promise<string | null> {
  return "http://localhost:8080";
}

export async function deleteAccount(): Promise<CommandResult> {
  return { ok: true };
}

// Config mocks
export async function getConfig(): Promise<AppConfig> {
  return { autostart_enabled: false, tray_enabled: true, close_to_tray: true };
}

export async function setAutostartEnabled(): Promise<CommandResult> {
  return { ok: true };
}

export async function setTrayEnabled(): Promise<CommandResult> {
  return { ok: true };
}

export async function setCloseToTray(): Promise<CommandResult> {
  return { ok: true };
}

// Codex mocks
export async function getCodexConfigs(): Promise<CodexConfig[]> {
  return [
    {
      apiKey: "mock-key-001",
      priority: 0,
      planType: "plus",
      prefix: "mock",
      baseUrl: "https://api.example.com",
      websockets: false,
      headers: { "Chatgpt-Account-Id": "mock-account-id" },
      models: [{ name: "gpt-4" }, { name: "o1-pro", alias: "o1" }],
    },
    {
      apiKey: "mock-key-002",
      priority: 1,
      planType: "team",
      models: [{ name: "gpt-4" }],
    },
  ];
}

export async function saveCodexConfigs(): Promise<void> {}

export async function updateCodexConfig(): Promise<void> {}

export async function deleteCodexConfig(): Promise<void> {}

export async function getCodexQuota(): Promise<Record<string, unknown>> {
  return {
    planType: "plus",
    rateLimit: {
      allowed: true,
      limitReached: false,
      primaryWindow: {
        usedPercent: 35,
        limitWindowSeconds: 18000,
        resetAfterSeconds: 9200,
      },
    },
  };
}

export async function getUsage(): Promise<Record<string, unknown>> {
  return { totalRequests: 128, successCount: 120, failCount: 8 };
}

// AuthFiles mocks
import type { AuthFileItem } from "../types";
export async function listAuthFiles(): Promise<AuthFileItem[]> {
  return [
    { name: "claude_oauth_token.json", type: "claude", disabled: false, statusMessage: "ok", lastRefresh: Date.now() / 1000 - 300 },
    { name: "gemini_credentials.json", type: "gemini", disabled: false, unavailable: false, statusMessage: "healthy", lastRefresh: Date.now() / 1000 - 3600 },
    { name: "openai_token.json", type: "openai", disabled: true, statusMessage: "disabled", lastRefresh: Date.now() / 1000 - 7200 },
    { name: "codex_auth.json", type: "codex", disabled: false, unavailable: true, statusMessage: "token expired", lastRefresh: Date.now() / 1000 - 86400 },
    { name: "runtime_session.json", type: "session", runtimeOnly: true, statusMessage: "ok", lastRefresh: Date.now() / 1000 - 60 },
  ];
}
