// 与 src-tauri/src/config.rs AppConfig 对应
export type AppConfig = {
  autostart_enabled: boolean;
  tray_enabled: boolean;
  close_to_tray: boolean;
  dock_visible_on_minimize: boolean;
  auto_refresh_enabled: boolean;
  auto_refresh_interval_seconds: number;
};

// 与 src-tauri/src/db.rs Account 对应
export type Account = {
  account_key: string;
  server: string;
  last_login_at: number;
  remember_password: boolean;
  has_password: boolean;
};

// 通用模型别名
export type ModelAlias = {
  name: string;
  alias?: string;
  priority?: number;
  testModel?: string;
};

export type ApiKeyEntry = {
  apiKey: string;
  proxyUrl?: string;
  headers?: Record<string, string>;
};

export type CloakConfig = {
  mode?: string;
  strictMode?: boolean;
  sensitiveWords?: string[];
};

export type GeminiKeyConfig = {
  apiKey: string;
  priority?: number;
  prefix?: string;
  baseUrl?: string;
  proxyUrl?: string;
  models?: ModelAlias[];
  headers?: Record<string, string>;
  excludedModels?: string[];
};

export type ProviderKeyConfig = {
  apiKey: string;
  priority?: number;
  prefix?: string;
  baseUrl?: string;
  websockets?: boolean;
  proxyUrl?: string;
  headers?: Record<string, string>;
  models?: ModelAlias[];
  excludedModels?: string[];
  cloak?: CloakConfig;
};

export type OpenAIProviderConfig = {
  name: string;
  prefix?: string;
  baseUrl: string;
  apiKeyEntries: ApiKeyEntry[];
  headers?: Record<string, string>;
  models?: ModelAlias[];
  priority?: number;
  testModel?: string;
  [key: string]: unknown;
};

// Codex 账号配置（与 ProviderKeyConfig 对应）
export type CodexModelAlias = ModelAlias;

export type CodexCloakConfig = CloakConfig;

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

export type UsageTokens = {
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  hasData: boolean;
  hasBreakdown: boolean;
};

export type UsageRates = {
  rpm: number;
  tpm: number;
  windowMinutes: number;
  requestCount: number;
  tokenCount: number;
  hasData: boolean;
};

export type UsageSparklineSeries = {
  labels: string[];
  requests: number[];
  tokens: number[];
  hasData: boolean;
};

export type ApiModelStats = {
  requests: number;
  successCount: number;
  failureCount: number;
  tokens: number;
};

export type ApiStats = {
  endpoint: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalTokens: number;
  models: Record<string, ApiModelStats>;
};

export type StatusBlockState = 'idle' | 'success' | 'failure' | 'mixed';

export type StatusBlockDetail = {
  success: number;
  failure: number;
  rate: number;
  startTime: number;
  endTime: number;
};

export type ServiceHealthData = {
  blocks: StatusBlockState[];
  blockDetails: StatusBlockDetail[];
  successRate: number;
  totalSuccess: number;
  totalFailure: number;
  rows: number;
  cols: number;
};

// 通用命令返回值
export type CommandResult = { ok: boolean };

// 认证文件
export type AuthFileItem = {
  id?: number;
  name: string;
  type?: string;
  provider?: string;
  authIndex?: string | number;
  auth_index?: string | number;
  size?: number;
  disabled?: boolean;
  unavailable?: boolean;
  status?: string;
  statusMessage?: string;
  lastRefresh?: string | number;
  runtimeOnly?: boolean;
  runtime_only?: boolean | string;
  modified?: number;
  metadata?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  id_token?: unknown;
  plan_type?: string;
  planType?: string;
  account?: string;
};

export type AuthFilesResponse = {
  files: AuthFileItem[];
  total?: number;
};

export type AuthFileModelDefinition = {
  id: string;
  display_name?: string;
  type?: string;
  owned_by?: string;
};

// OAuth
export type OAuthProvider =
  | 'codex'
  | 'anthropic'
  | 'antigravity'
  | 'gemini-cli'
  | 'kimi'
  | 'qwen';

export type OAuthStartResponse = {
  url: string;
  state?: string;
};

export type OAuthStatusResponse = {
  status: 'ok' | 'wait' | 'error';
  error?: string;
};

export type OAuthCallbackResponse = {
  status: 'ok';
};

export type IFlowCookieAuthResponse = {
  status: 'ok' | 'error';
  error?: string;
  saved_path?: string;
  email?: string;
  expired?: string;
  type?: string;
};

export type VertexImportResponse = {
  status: 'ok';
  project_id?: string;
  email?: string;
  location?: string;
  'auth-file'?: string;
  auth_file?: string;
};

export type OAuthModelAliasEntry = {
  name: string;
  alias: string;
  fork?: boolean;
};

export type OAuthModelAlias = Record<string, OAuthModelAliasEntry[]>;

// 远程配置
export type QuotaExceededConfig = {
  switchProject?: boolean;
  switchPreviewModel?: boolean;
};

export type ServerConfig = {
  debug?: boolean;
  proxyUrl?: string;
  requestRetry?: number;
  quotaExceeded?: QuotaExceededConfig;
  usageStatisticsEnabled?: boolean;
  requestLog?: boolean;
  loggingToFile?: boolean;
  logsMaxTotalSizeMb?: number;
  wsAuth?: boolean;
  forceModelPrefix?: boolean;
  routingStrategy?: string;
  apiKeys?: string[];
  ampcode?: AmpcodeConfig;
  geminiApiKeys?: GeminiKeyConfig[];
  codexApiKeys?: ProviderKeyConfig[];
  claudeApiKeys?: ProviderKeyConfig[];
  vertexApiKeys?: ProviderKeyConfig[];
  openaiCompatibility?: OpenAIProviderConfig[];
  oauthExcludedModels?: Record<string, string[]>;
  raw?: Record<string, unknown>;
};

// 使用统计导入导出
export type UsageExportPayload = {
  version?: number;
  exported_at?: string;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
};

export type UsageImportResponse = {
  added?: number;
  skipped?: number;
  total_requests?: number;
  failed_requests?: number;
  [key: string]: unknown;
};

// 日志
export type LogsQuery = {
  after?: number;
};

export type LogsResponse = {
  lines: string[];
  'line-count': number;
  'latest-timestamp': number;
};

export type ErrorLogFile = {
  name: string;
  size?: number;
  modified?: number;
};

export type ErrorLogsResponse = {
  files?: ErrorLogFile[];
};

// 模型
export type ModelInfo = {
  name: string;
  alias?: string;
  description?: string;
};

export type ModelGroup = {
  id: string;
  label: string;
  items: ModelInfo[];
};

// Ampcode
export type AmpcodeModelMapping = {
  from: string;
  to: string;
};

export type AmpcodeConfig = {
  upstreamUrl?: string;
  upstreamApiKey?: string;
  modelMappings?: AmpcodeModelMapping[];
  forceModelMappings?: boolean;
};

// API call
export type ApiCallRequest = {
  authIndex?: string;
  method: string;
  url: string;
  header?: Record<string, string>;
  data?: string;
};

export type ApiCallResult<T = unknown> = {
  statusCode: number;
  header: Record<string, string[]>;
  bodyText: string;
  body: T | null;
};

// API 客户端
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type ApiClientConfig = {
  apiBase: string;
  managementKey: string;
  timeout?: number;
};

export type RequestOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
};

export type ServerVersion = {
  version: string;
  buildDate?: string;
};

export type ApiError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
  data?: unknown;
};

// 配额管理相关类型（避免与现有 CodexQuotaState 冲突，使用 Quota 前缀）
export type ThemeColors = { bg: string; text: string; border?: string };
export type TypeColorSet = { light: ThemeColors; dark?: ThemeColors };
export type ResolvedTheme = 'light' | 'dark';

export interface AntigravityQuotaGroupDefinition {
  id: string;
  label: string;
  identifiers: string[];
  labelFromModel?: boolean;
}

export interface GeminiCliQuotaGroupDefinition {
  id: string;
  label: string;
  preferredModelId?: string;
  modelIds: string[];
}

export interface QuotaGeminiCliQuotaBucket {
  modelId?: string;
  model_id?: string;
  tokenType?: string;
  token_type?: string;
  remainingFraction?: number | string;
  remaining_fraction?: number | string;
  remainingAmount?: number | string;
  remaining_amount?: number | string;
  resetTime?: string;
  reset_time?: string;
}

export interface QuotaGeminiCliQuotaPayload {
  buckets?: QuotaGeminiCliQuotaBucket[];
}

export interface QuotaAntigravityQuotaInfo {
  displayName?: string;
  quotaInfo?: {
    remainingFraction?: number | string;
    remaining_fraction?: number | string;
    remaining?: number | string;
    resetTime?: string;
    reset_time?: string;
  };
  quota_info?: {
    remainingFraction?: number | string;
    remaining_fraction?: number | string;
    remaining?: number | string;
    resetTime?: string;
    reset_time?: string;
  };
}

export type QuotaAntigravityModelsPayload = Record<string, QuotaAntigravityQuotaInfo>;

export interface QuotaGeminiCliParsedBucket {
  modelId: string;
  tokenType: string | null;
  remainingFraction: number | null;
  remainingAmount: number | null;
  resetTime: string | undefined;
}

export interface QuotaCodexUsageWindow {
  used_percent?: number | string;
  usedPercent?: number | string;
  limit_window_seconds?: number | string;
  limitWindowSeconds?: number | string;
  reset_after_seconds?: number | string;
  resetAfterSeconds?: number | string;
  reset_at?: number | string;
  resetAt?: number | string;
}

export interface QuotaCodexRateLimitInfo {
  allowed?: boolean;
  limit_reached?: boolean;
  limitReached?: boolean;
  primary_window?: QuotaCodexUsageWindow | null;
  primaryWindow?: QuotaCodexUsageWindow | null;
  secondary_window?: QuotaCodexUsageWindow | null;
  secondaryWindow?: QuotaCodexUsageWindow | null;
}

export interface QuotaCodexAdditionalRateLimit {
  limit_name?: string;
  limitName?: string;
  metered_feature?: string;
  meteredFeature?: string;
  rate_limit?: QuotaCodexRateLimitInfo | null;
  rateLimit?: QuotaCodexRateLimitInfo | null;
}

export interface QuotaCodexUsagePayload {
  plan_type?: string;
  planType?: string;
  rate_limit?: QuotaCodexRateLimitInfo | null;
  rateLimit?: QuotaCodexRateLimitInfo | null;
  code_review_rate_limit?: QuotaCodexRateLimitInfo | null;
  codeReviewRateLimit?: QuotaCodexRateLimitInfo | null;
  additional_rate_limits?: QuotaCodexAdditionalRateLimit[] | null;
  additionalRateLimits?: QuotaCodexAdditionalRateLimit[] | null;
}

export interface QuotaClaudeUsageWindow {
  utilization: number;
  resets_at: string;
}

export interface QuotaClaudeExtraUsage {
  is_enabled: boolean;
  monthly_limit: number;
  used_credits: number;
  utilization: number | null;
}

export interface QuotaClaudeUsagePayload {
  five_hour?: QuotaClaudeUsageWindow | null;
  seven_day?: QuotaClaudeUsageWindow | null;
  seven_day_oauth_apps?: QuotaClaudeUsageWindow | null;
  seven_day_opus?: QuotaClaudeUsageWindow | null;
  seven_day_sonnet?: QuotaClaudeUsageWindow | null;
  seven_day_cowork?: QuotaClaudeUsageWindow | null;
  iguana_necktie?: QuotaClaudeUsageWindow | null;
  extra_usage?: QuotaClaudeExtraUsage | null;
}

export interface QuotaClaudeQuotaWindow {
  id: string;
  label: string;
  labelKey?: string;
  usedPercent: number | null;
  resetLabel: string;
}

export interface QuotaClaudeState {
  status: 'idle' | 'loading' | 'success' | 'error';
  windows: QuotaClaudeQuotaWindow[];
  extraUsage?: QuotaClaudeExtraUsage | null;
  error?: string;
  errorStatus?: number;
}

export interface QuotaAntigravityQuotaGroup {
  id: string;
  label: string;
  models: string[];
  remainingFraction: number;
  resetTime?: string;
}

export interface QuotaAntigravityState {
  status: 'idle' | 'loading' | 'success' | 'error';
  groups: QuotaAntigravityQuotaGroup[];
  error?: string;
  errorStatus?: number;
}

export interface QuotaGeminiCliQuotaBucketState {
  id: string;
  label: string;
  remainingFraction: number | null;
  remainingAmount: number | null;
  resetTime: string | undefined;
  tokenType: string | null;
  modelIds?: string[];
}

export interface QuotaGeminiCliState {
  status: 'idle' | 'loading' | 'success' | 'error';
  buckets: QuotaGeminiCliQuotaBucketState[];
  error?: string;
  errorStatus?: number;
}

export interface QuotaCodexQuotaWindow {
  id: string;
  label: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  usedPercent: number | null;
  resetLabel: string;
}

export interface QuotaCodexState {
  status: 'idle' | 'loading' | 'success' | 'error';
  windows: QuotaCodexQuotaWindow[];
  planType?: string | null;
  error?: string;
  errorStatus?: number;
}

export interface QuotaKimiUsageDetail {
  used?: number;
  limit?: number;
  remaining?: number;
  name?: string;
  title?: string;
  resetAt?: string;
  reset_at?: string;
  resetTime?: string;
  reset_time?: string;
  resetIn?: number;
  reset_in?: number;
  ttl?: number;
}

export interface QuotaKimiLimitWindow {
  duration?: number;
  timeUnit?: string;
}

export interface QuotaKimiLimitItem {
  name?: string;
  title?: string;
  scope?: string;
  detail?: QuotaKimiUsageDetail;
  window?: QuotaKimiLimitWindow;
  used?: number;
  limit?: number;
  remaining?: number;
  duration?: number;
  timeUnit?: string;
  resetAt?: string;
  reset_at?: string;
  resetIn?: number;
  reset_in?: number;
  ttl?: number;
}

export interface QuotaKimiUsagePayload {
  usage?: QuotaKimiUsageDetail;
  limits?: QuotaKimiLimitItem[];
}

export interface QuotaKimiQuotaRow {
  id: string;
  label?: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  used: number;
  limit: number;
  resetHint?: string;
}

export interface QuotaKimiState {
  status: 'idle' | 'loading' | 'success' | 'error';
  rows: QuotaKimiQuotaRow[];
  error?: string;
  errorStatus?: number;
}

// 与 src-tauri/src/commands.rs LoginPayload 对应
export type LoginPayload = {
  password: string;
  server: string;
  remember_password?: boolean;
};

// 配置文件可视化编辑相关类型
export type PayloadParamValueType = 'string' | 'number' | 'boolean' | 'json';

export type PayloadParamEntry = {
  id: string;
  path: string;
  valueType: PayloadParamValueType;
  value: string;
};

export type PayloadModelEntry = {
  id: string;
  name: string;
  protocol?: 'openai' | 'openai-response' | 'gemini' | 'claude' | 'codex' | 'antigravity';
};

export type PayloadRule = {
  id: string;
  models: PayloadModelEntry[];
  params: PayloadParamEntry[];
};

export type PayloadFilterRule = {
  id: string;
  models: PayloadModelEntry[];
  params: string[];
};

export interface StreamingConfig {
  keepaliveSeconds: string;
  bootstrapRetries: string;
  nonstreamKeepaliveInterval: string;
}

export type VisualConfigValues = {
  host: string;
  port: string;
  tlsEnable: boolean;
  tlsCert: string;
  tlsKey: string;
  rmAllowRemote: boolean;
  rmSecretKey: string;
  rmDisableControlPanel: boolean;
  rmPanelRepo: string;
  authDir: string;
  apiKeysText: string;
  debug: boolean;
  commercialMode: boolean;
  loggingToFile: boolean;
  logsMaxTotalSizeMb: string;
  usageStatisticsEnabled: boolean;
  proxyUrl: string;
  forceModelPrefix: boolean;
  requestRetry: string;
  maxRetryInterval: string;
  quotaSwitchProject: boolean;
  quotaSwitchPreviewModel: boolean;
  routingStrategy: 'round-robin' | 'fill-first';
  wsAuth: boolean;
  payloadDefaultRules: PayloadRule[];
  payloadOverrideRules: PayloadRule[];
  payloadFilterRules: PayloadFilterRule[];
  streaming: StreamingConfig;
};

export const makeClientId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export const DEFAULT_VISUAL_VALUES: VisualConfigValues = {
  host: '',
  port: '',
  tlsEnable: false,
  tlsCert: '',
  tlsKey: '',
  rmAllowRemote: false,
  rmSecretKey: '',
  rmDisableControlPanel: false,
  rmPanelRepo: '',
  authDir: '',
  apiKeysText: '',
  debug: false,
  commercialMode: false,
  loggingToFile: false,
  logsMaxTotalSizeMb: '',
  usageStatisticsEnabled: false,
  proxyUrl: '',
  forceModelPrefix: false,
  requestRetry: '',
  maxRetryInterval: '',
  quotaSwitchProject: true,
  quotaSwitchPreviewModel: true,
  routingStrategy: 'round-robin',
  wsAuth: false,
  payloadDefaultRules: [],
  payloadOverrideRules: [],
  payloadFilterRules: [],
  streaming: {
    keepaliveSeconds: '',
    bootstrapRetries: '',
    nonstreamKeepaliveInterval: '',
  },
};
