import type {
  Account,
  AmpcodeConfig,
  AmpcodeModelMapping,
  ApiCallResult,
  AppConfig,
  AuthFileItem,
  CodexConfig,
  CommandResult,
  ErrorLogsResponse,
  GeminiKeyConfig,
  LogsResponse,
  OAuthCallbackResponse,
  OAuthStartResponse,
  OAuthStatusResponse,
  OpenAIProviderConfig,
  ProviderKeyConfig,
  ServerConfig,
  UsageExportPayload,
  UsageImportResponse,
  VertexImportResponse,
} from "../types";

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
  return {
    autostart_enabled: false,
    tray_enabled: true,
    close_to_tray: true,
    dock_visible_on_minimize: true,
    auto_refresh_enabled: false,
    auto_refresh_interval_seconds: 60,
  };
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

export async function setDockVisibleOnMinimize(): Promise<CommandResult> {
  return { ok: true };
}

export async function setAutoRefreshEnabled(): Promise<CommandResult> {
  return { ok: true };
}

export async function setAutoRefreshIntervalSeconds(): Promise<CommandResult> {
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
  const now = Date.now();
  const details = Array.from({ length: 60 }).map((_, idx) => {
    const minuteOffset = 59 - idx;
    const timestamp = new Date(now - minuteOffset * 60 * 1000 + 12 * 1000).toISOString();
    const inputTokens = 120 + idx * 3;
    const outputTokens = 80 + idx * 2;
    const cachedTokens = idx % 4 === 0 ? 24 : 8;
    const reasoningTokens = idx % 9 === 0 ? 16 : 0;
    return {
      timestamp,
      source: "codex-demo",
      auth_index: idx % 3,
      tokens: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cached_tokens: cachedTokens,
        reasoning_tokens: reasoningTokens,
      },
      failed: idx % 11 === 0,
    };
  });

  const totalRequests = details.length;
  const failCount = details.filter((detail) => detail.failed).length;
  const successCount = totalRequests - failCount;
  const totalTokens = details.reduce((sum, detail) => {
    const tokens = detail.tokens;
    return sum + tokens.input_tokens + tokens.output_tokens + tokens.cached_tokens + tokens.reasoning_tokens;
  }, 0);

  return {
    totalRequests,
    successCount,
    failCount,
    total_tokens: totalTokens,
    apis: {
      codex: {
        models: {
          "gpt-4o": {
            details,
          },
        },
      },
    },
  };
}

// API Keys mocks
export async function listApiKeys(): Promise<string[]> {
  return [
    "sk-demo-001-abcdefghijklmnopqrstuvwxyz",
    "sk-demo-002-abcdefghijklmnopqrstuvwxyz",
  ];
}

export async function replaceApiKeys(): Promise<void> {}

export async function updateApiKey(): Promise<void> {}

export async function deleteApiKey(): Promise<void> {}

// AuthFiles mocks
export async function listAuthFiles(): Promise<AuthFileItem[]> {
  return [
    { name: "claude_oauth_token.json", type: "claude", disabled: false, statusMessage: "ok", lastRefresh: Date.now() / 1000 - 300 },
    { name: "gemini_credentials.json", type: "gemini", disabled: false, unavailable: false, statusMessage: "healthy", lastRefresh: Date.now() / 1000 - 3600 },
    { name: "openai_token.json", type: "openai", disabled: true, statusMessage: "disabled", lastRefresh: Date.now() / 1000 - 7200 },
    { name: "codex_auth.json", type: "codex", disabled: false, unavailable: true, statusMessage: "token expired", lastRefresh: Date.now() / 1000 - 86400 },
    { name: "runtime_session.json", type: "session", runtimeOnly: true, statusMessage: "ok", lastRefresh: Date.now() / 1000 - 60 },
  ];
}

export async function uploadAuthFile(_file: File): Promise<void> {
  return;
}

// Server config mocks
export async function getServerConfig(): Promise<ServerConfig> {
  return { debug: false, requestRetry: 0, usageStatisticsEnabled: true };
}

export async function getServerRawConfig(): Promise<Record<string, unknown>> {
  return {};
}

export async function updateDebug(): Promise<void> {}
export async function updateProxyUrl(): Promise<void> {}
export async function clearProxyUrl(): Promise<void> {}
export async function updateRequestRetry(): Promise<void> {}
export async function updateSwitchProject(): Promise<void> {}
export async function updateSwitchPreviewModel(): Promise<void> {}
export async function updateUsageStatistics(): Promise<void> {}
export async function updateRequestLog(): Promise<void> {}
export async function updateLoggingToFile(): Promise<void> {}
export async function getLogsMaxTotalSizeMb(): Promise<number> { return 0; }
export async function updateLogsMaxTotalSizeMb(): Promise<void> {}
export async function updateWsAuth(): Promise<void> {}
export async function getForceModelPrefix(): Promise<boolean> { return false; }
export async function updateForceModelPrefix(): Promise<void> {}
export async function getRoutingStrategy(): Promise<string> { return "round-robin"; }
export async function updateRoutingStrategy(): Promise<void> {}

// Providers mocks
export async function getGeminiConfigs(): Promise<GeminiKeyConfig[]> { return []; }
export async function saveGeminiConfigs(): Promise<void> {}
export async function updateGeminiConfig(): Promise<void> {}
export async function deleteGeminiConfig(): Promise<void> {}
export async function getCodexProviderConfigs(): Promise<ProviderKeyConfig[]> { return []; }
export async function saveCodexProviderConfigs(): Promise<void> {}
export async function updateCodexProviderConfig(): Promise<void> {}
export async function deleteCodexProviderConfig(): Promise<void> {}
export async function getClaudeConfigs(): Promise<ProviderKeyConfig[]> { return []; }
export async function saveClaudeConfigs(): Promise<void> {}
export async function updateClaudeConfig(): Promise<void> {}
export async function deleteClaudeConfig(): Promise<void> {}
export async function getVertexConfigs(): Promise<ProviderKeyConfig[]> { return []; }
export async function saveVertexConfigs(): Promise<void> {}
export async function updateVertexConfig(): Promise<void> {}
export async function deleteVertexConfig(): Promise<void> {}
export async function getOpenAIProviders(): Promise<OpenAIProviderConfig[]> { return []; }
export async function saveOpenAIProviders(): Promise<void> {}
export async function updateOpenAIProvider(): Promise<void> {}
export async function deleteOpenAIProvider(): Promise<void> {}

// OAuth mocks
export async function startOAuth(): Promise<OAuthStartResponse> {
  return { url: "https://example.com/oauth" };
}
export async function getAuthStatus(): Promise<OAuthStatusResponse> {
  return { status: "wait" };
}
export async function submitOAuthCallback(): Promise<OAuthCallbackResponse> {
  return { status: "ok" };
}
export async function iflowCookieAuth(): Promise<{ status: "ok" }> {
  return { status: "ok" };
}

// Vertex import mock
export async function importVertexCredential(): Promise<VertexImportResponse> {
  return { status: "ok", project_id: "demo-project", email: "demo@example.com", location: "us-central1", "auth-file": "vertex_auth.json" };
}

// AuthFiles advanced mocks
export async function downloadAuthFileText(): Promise<string> { return "{}"; }
export async function getOauthExcludedModels(): Promise<Record<string, string[]>> { return {}; }
export async function saveOauthExcludedModels(): Promise<void> {}
export async function deleteOauthExcludedEntry(): Promise<void> {}
export async function replaceOauthExcludedModels(): Promise<void> {}
export async function getOauthModelAlias(): Promise<Record<string, { name: string; alias: string }[]>> { return {}; }
export async function saveOauthModelAlias(): Promise<void> {}
export async function deleteOauthModelAlias(): Promise<void> {}
export async function getModelsForAuthFile(): Promise<{ id: string }[]> { return []; }
export async function getModelDefinitions(): Promise<{ id: string }[]> { return []; }

// Usage mocks
export async function getUsageRaw(): Promise<Record<string, unknown>> { return {}; }
export async function exportUsage(): Promise<UsageExportPayload> { return {}; }
export async function importUsage(): Promise<UsageImportResponse> { return {}; }

// Logs mocks
export async function fetchLogs(): Promise<LogsResponse> {
  return { lines: [], "line-count": 0, "latest-timestamp": 0 };
}
export async function clearLogs(): Promise<void> {}
export async function fetchErrorLogs(): Promise<ErrorLogsResponse> { return { files: [] }; }
export async function downloadErrorLog(): Promise<Uint8Array> { return new Uint8Array(); }
export async function downloadRequestLogById(): Promise<Uint8Array> { return new Uint8Array(); }

// Config file mocks
export async function fetchConfigYaml(): Promise<string> { return ""; }
export async function saveConfigYaml(): Promise<void> {}

// Models mocks
export async function fetchModels(): Promise<unknown> { return []; }
export async function fetchModelsViaApiCall(): Promise<ApiCallResult> {
  return { statusCode: 200, header: {}, bodyText: "", body: [] };
}

// API call mock
export async function apiCall(): Promise<ApiCallResult> {
  return { statusCode: 200, header: {}, bodyText: "", body: null };
}

// Ampcode mocks
export async function getAmpcode(): Promise<AmpcodeConfig> { return {}; }
export async function updateUpstreamUrl(): Promise<void> {}
export async function clearUpstreamUrl(): Promise<void> {}
export async function updateUpstreamApiKey(): Promise<void> {}
export async function clearUpstreamApiKey(): Promise<void> {}
export async function getAmpcodeModelMappings(): Promise<AmpcodeModelMapping[]> { return []; }
export async function saveAmpcodeModelMappings(): Promise<void> {}
export async function patchAmpcodeModelMappings(): Promise<void> {}
export async function clearAmpcodeModelMappings(): Promise<void> {}
export async function deleteAmpcodeModelMappings(): Promise<void> {}
export async function updateForceModelMappings(): Promise<void> {}

// Version mock
export async function checkLatestVersion(): Promise<Record<string, unknown>> { return {}; }
