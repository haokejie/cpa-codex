// 与 src-tauri/src/config.rs AppConfig 对应
export type AppConfig = {
  autostart_enabled: boolean;
};

// 与 src-tauri/src/db.rs Account 对应
export type Account = {
  account_key: string;
  server: string;
  last_login_at: number;
  remember_password: boolean;
  has_password: boolean;
};

// Codex 账号配置（与 ProviderKeyConfig 对应）
export type CodexModelAlias = {
  name: string;
  alias?: string;
  priority?: number;
};

export type CodexCloakConfig = {
  mode?: string;
  strictMode?: boolean;
  sensitiveWords?: string[];
};

export type CodexConfig = {
  apiKey: string;
  priority: number;
  planType?: 'plus' | 'team' | 'free';
  prefix?: string;
  baseUrl?: string;
  websockets?: boolean;
  proxyUrl?: string;
  headers?: Record<string, string>;
  models?: CodexModelAlias[];
  excludedModels?: string[];
  cloak?: CodexCloakConfig;
};

// Codex 额度窗口
export type CodexQuotaWindow = {
  label: string;
  usedPercent: number;
  limitWindowSeconds: number;
  resetAfterSeconds: number;
};

// Codex 额度状态
export type CodexQuotaState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  allowed: boolean;
  limitReached: boolean;
  windows: CodexQuotaWindow[];
  planType?: string;
  error?: string;
};

// 使用统计
export type UsageStats = {
  totalRequests: number;
  successCount: number;
  failCount: number;
};

// 通用命令返回值
export type CommandResult = { ok: boolean };

// 认证文件
export type AuthFileItem = {
  name: string;
  type?: string;
  provider?: string;
  size?: number;
  disabled?: boolean;
  unavailable?: boolean;
  status?: string;
  statusMessage?: string;
  lastRefresh?: string | number;
  runtimeOnly?: boolean;
};

// 与 src-tauri/src/commands.rs LoginPayload 对应
export type LoginPayload = {
  password: string;
  server: string;
  remember_password?: boolean;
};
