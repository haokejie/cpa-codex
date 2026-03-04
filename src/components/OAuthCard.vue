<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { IFlowCookieAuthResponse, OAuthProvider, VertexImportResponse } from "../types";
import { copyToClipboard } from "../utils/clipboard";
import { useOAuthStore } from "../stores/oauth";
import BaseCard from "./BaseCard.vue";

type ProviderState = {
  url?: string;
  state?: string;
  status?: "idle" | "waiting" | "success" | "error";
  error?: string;
  polling?: boolean;
  projectId?: string;
  callbackUrl?: string;
  callbackSubmitting?: boolean;
  callbackStatus?: "success" | "error";
  callbackError?: string;
  copyStatus?: "success" | "error";
};

type IflowState = {
  cookie: string;
  loading: boolean;
  result?: IFlowCookieAuthResponse;
  error?: string;
  errorType?: "error" | "warning";
};

type VertexImportResult = {
  projectId?: string;
  email?: string;
  location?: string;
  authFile?: string;
};

type VertexState = {
  file?: File;
  fileName: string;
  location: string;
  loading: boolean;
  error?: string;
  result?: VertexImportResult;
};

const PROVIDERS: { id: OAuthProvider; title: string; hint: string; urlLabel: string }[] = [
  { id: "codex", title: "Codex OAuth", hint: "获取 Codex OAuth 登录地址并完成授权", urlLabel: "登录地址" },
  { id: "anthropic", title: "Anthropic OAuth", hint: "获取 Claude OAuth 登录地址并完成授权", urlLabel: "登录地址" },
  { id: "antigravity", title: "Antigravity OAuth", hint: "获取 Antigravity 登录地址并完成授权", urlLabel: "登录地址" },
  { id: "gemini-cli", title: "Gemini CLI OAuth", hint: "获取 Gemini CLI 登录地址并完成授权", urlLabel: "登录地址" },
  { id: "kimi", title: "Kimi OAuth", hint: "获取 Kimi 登录地址并完成授权", urlLabel: "登录地址" },
  { id: "qwen", title: "Qwen OAuth", hint: "获取 Qwen 登录地址并完成授权", urlLabel: "登录地址" },
];

const CALLBACK_SUPPORTED = new Set<OAuthProvider>(["codex", "anthropic", "antigravity", "gemini-cli"]);

const oauthStore = useOAuthStore();
const initialStates = PROVIDERS.reduce((acc, provider) => {
  acc[provider.id] = { status: "idle" } as ProviderState;
  return acc;
}, {} as Record<OAuthProvider, ProviderState>);
const states = ref<Record<OAuthProvider, ProviderState>>(initialStates);
const iflowState = ref<IflowState>({ cookie: "", loading: false });
const vertexState = ref<VertexState>({ fileName: "", location: "", loading: false });
const vertexFileInput = ref<HTMLInputElement | null>(null);

const timers: Record<string, number> = {};

const updateProviderState = (provider: OAuthProvider, next: Partial<ProviderState>) => {
  states.value = {
    ...states.value,
    [provider]: {
      ...(states.value[provider] ?? { status: "idle" }),
      ...next,
    },
  };
};

const clearTimer = (provider: OAuthProvider) => {
  if (!timers[provider]) return;
  window.clearInterval(timers[provider]);
  delete timers[provider];
};

const clearAllTimers = () => {
  Object.keys(timers).forEach((key) => {
    window.clearInterval(timers[key]);
    delete timers[key];
  });
};

onUnmounted(() => {
  clearAllTimers();
});

const startPolling = (provider: OAuthProvider, state: string) => {
  clearTimer(provider);
  timers[provider] = window.setInterval(async () => {
    try {
      const res = await oauthStore.status(state);
      if (res.status === "ok") {
        updateProviderState(provider, { status: "success", polling: false });
        clearTimer(provider);
      } else if (res.status === "error") {
        updateProviderState(provider, { status: "error", error: res.error, polling: false });
        clearTimer(provider);
      }
    } catch (e) {
      updateProviderState(provider, { status: "error", error: String(e), polling: false });
      clearTimer(provider);
    }
  }, 3000);
};

const startAuth = async (provider: OAuthProvider) => {
  const current = states.value[provider] ?? {};
  const rawProjectId = provider === "gemini-cli" ? (current.projectId || "").trim() : "";
  const projectId = rawProjectId
    ? rawProjectId.toUpperCase() === "ALL"
      ? "ALL"
      : rawProjectId
    : undefined;

  updateProviderState(provider, {
    status: "waiting",
    polling: true,
    error: undefined,
    callbackStatus: undefined,
    callbackError: undefined,
    callbackUrl: "",
  });

  try {
    const res = await oauthStore.start(provider, provider === "gemini-cli" ? { projectId } : undefined);
    updateProviderState(provider, { url: res.url, state: res.state, status: "waiting", polling: true });
    if (res.state) {
      startPolling(provider, res.state);
    }
  } catch (e) {
    updateProviderState(provider, { status: "error", error: String(e), polling: false });
  }
};

const copyLink = async (provider: OAuthProvider) => {
  const url = states.value[provider]?.url;
  if (!url) return;
  const ok = await copyToClipboard(url);
  updateProviderState(provider, { copyStatus: ok ? "success" : "error" });
  window.setTimeout(() => updateProviderState(provider, { copyStatus: undefined }), 2000);
};

const openLink = async (provider: OAuthProvider) => {
  const url = states.value[provider]?.url;
  if (!url) return;
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
};

const submitCallback = async (provider: OAuthProvider) => {
  const redirectUrl = (states.value[provider]?.callbackUrl || "").trim();
  if (!redirectUrl) {
    updateProviderState(provider, { callbackStatus: "error", callbackError: "请输入回调地址" });
    return;
  }
  updateProviderState(provider, { callbackSubmitting: true, callbackStatus: undefined, callbackError: undefined });
  try {
    await oauthStore.submitCallback(provider, redirectUrl);
    updateProviderState(provider, { callbackSubmitting: false, callbackStatus: "success" });
  } catch (e) {
    updateProviderState(provider, { callbackSubmitting: false, callbackStatus: "error", callbackError: String(e) });
  }
};

const submitIflowCookie = async () => {
  const cookie = iflowState.value.cookie.trim();
  if (!cookie) {
    iflowState.value = { ...iflowState.value, error: "请输入 Cookie", errorType: "warning" };
    return;
  }
  iflowState.value = { cookie, loading: true };
  try {
    const res = await oauthStore.submitIflowCookie(cookie);
    if (res.status === "ok") {
      iflowState.value = { cookie, loading: false, result: res };
    } else {
      iflowState.value = {
        cookie,
        loading: false,
        error: res.error || "授权失败",
        errorType: "error",
      };
    }
  } catch (e) {
    const message = String(e);
    const warning = message.includes("409") || message.includes("重复");
    iflowState.value = {
      cookie,
      loading: false,
      error: message,
      errorType: warning ? "warning" : "error",
    };
  }
};

const handleVertexPick = () => {
  vertexFileInput.value?.click();
};

const handleVertexChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".json")) {
    vertexState.value = { ...vertexState.value, error: "仅支持 .json 文件" };
    input.value = "";
    return;
  }
  vertexState.value = {
    ...vertexState.value,
    file,
    fileName: file.name,
    error: undefined,
    result: undefined,
  };
  input.value = "";
};

const handleVertexImport = async () => {
  const file = vertexState.value.file;
  if (!file) {
    vertexState.value = { ...vertexState.value, error: "请选择 Vertex JSON 文件" };
    return;
  }
  vertexState.value = { ...vertexState.value, loading: true, error: undefined, result: undefined };
  try {
    const res: VertexImportResponse = await oauthStore.importVertex(
      file,
      vertexState.value.location.trim() || undefined
    );
    const result: VertexImportResult = {
      projectId: res.project_id,
      email: res.email,
      location: res.location,
      authFile: res["auth-file"] ?? res.auth_file,
    };
    vertexState.value = { ...vertexState.value, loading: false, result };
  } catch (e) {
    vertexState.value = { ...vertexState.value, loading: false, error: String(e) };
  }
};

const statusLabel = (state: ProviderState) => {
  if (state.status === "success") return "授权成功";
  if (state.status === "error") return `授权失败 ${state.error || ""}`.trim();
  if (state.status === "waiting") return "等待授权中";
  return "";
};
</script>

<template>
  <div class="oauth-container">
    <div class="oauth-grid">
      <BaseCard v-for="provider in PROVIDERS" :key="provider.id" :title="provider.title" :description="provider.hint" headerGap="sm">
        <template #actions>
          <button class="btn-primary btn-sm" @click="startAuth(provider.id)" :disabled="states[provider.id]?.polling">
            {{ states[provider.id]?.polling ? "登录中..." : "登录" }}
          </button>
        </template>

        <div class="oauth-body">
          <div v-if="provider.id === 'gemini-cli'" class="form-item">
            <span class="form-label">Project ID（可选）</span>
            <input
              v-model="states[provider.id].projectId"
              class="form-input"
              placeholder="留空自动选择第一个项目；输入 ALL 获取全部"
              :disabled="states[provider.id]?.polling"
            />
          </div>

          <div v-if="states[provider.id]?.url" class="auth-url">
            <div class="auth-url-label">{{ provider.urlLabel }}</div>
            <div class="auth-url-value">{{ states[provider.id]?.url }}</div>
            <div class="auth-url-actions">
              <button class="btn-ghost btn-xs" @click="copyLink(provider.id)">复制</button>
              <button class="btn-ghost btn-xs" @click="openLink(provider.id)">打开</button>
              <span v-if="states[provider.id]?.copyStatus" class="copy-status">
                {{ states[provider.id]?.copyStatus === 'success' ? '已复制' : '复制失败' }}
              </span>
            </div>
          </div>

          <div v-if="CALLBACK_SUPPORTED.has(provider.id) && states[provider.id]?.url" class="callback-section">
            <span class="form-label">回调地址</span>
            <input
              v-model="states[provider.id].callbackUrl"
              class="form-input"
              placeholder="填写 OAuth 回调地址"
            />
            <div class="callback-actions">
              <button
                class="btn-ghost btn-sm"
                @click="submitCallback(provider.id)"
                :disabled="states[provider.id]?.callbackSubmitting"
              >{{ states[provider.id]?.callbackSubmitting ? '提交中...' : '提交回调' }}</button>
              <span v-if="states[provider.id]?.callbackStatus === 'success'" class="status-badge success">提交成功</span>
              <span v-else-if="states[provider.id]?.callbackStatus === 'error'" class="status-badge error">
                {{ states[provider.id]?.callbackError || '提交失败' }}
              </span>
            </div>
          </div>

          <div v-if="states[provider.id]?.status && states[provider.id]?.status !== 'idle'" class="status-badge" :class="states[provider.id]?.status">
            {{ statusLabel(states[provider.id] || {}) }}
          </div>
        </div>
      </BaseCard>
    </div>

    <BaseCard title="Vertex 凭据导入" description="上传 Vertex JSON 凭据文件并生成认证文件" headerGap="sm">
      <template #actions>
        <button class="btn-primary btn-sm" @click="handleVertexImport" :disabled="vertexState.loading">
          {{ vertexState.loading ? "导入中..." : "导入" }}
        </button>
      </template>

      <div class="oauth-body">
        <div class="form-item">
          <span class="form-label">Location（可选）</span>
          <input
            v-model="vertexState.location"
            class="form-input"
            placeholder="如 us-central1"
          />
        </div>
        <div class="form-item">
          <span class="form-label">Vertex JSON 文件</span>
          <div class="file-row">
            <button class="btn-ghost btn-sm" @click="handleVertexPick">选择文件</button>
            <span class="file-name" :class="{ 'file-muted': !vertexState.fileName }">
              {{ vertexState.fileName || '未选择文件' }}
            </span>
          </div>
          <input ref="vertexFileInput" type="file" accept=".json,application/json" style="display:none" @change="handleVertexChange" />
        </div>
        <div v-if="vertexState.error" class="status-badge error">{{ vertexState.error }}</div>
        <div v-if="vertexState.result" class="result-box">
          <div class="result-title">导入结果</div>
          <div class="result-list">
            <div v-if="vertexState.result.projectId" class="result-item">
              <span class="result-key">Project</span>
              <span class="result-value">{{ vertexState.result.projectId }}</span>
            </div>
            <div v-if="vertexState.result.email" class="result-item">
              <span class="result-key">Email</span>
              <span class="result-value">{{ vertexState.result.email }}</span>
            </div>
            <div v-if="vertexState.result.location" class="result-item">
              <span class="result-key">Location</span>
              <span class="result-value">{{ vertexState.result.location }}</span>
            </div>
            <div v-if="vertexState.result.authFile" class="result-item">
              <span class="result-key">Auth File</span>
              <span class="result-value">{{ vertexState.result.authFile }}</span>
            </div>
          </div>
        </div>
      </div>
    </BaseCard>

    <BaseCard title="iFlow Cookie 导入" description="粘贴 iFlow Cookie 以生成认证文件" headerGap="sm">
      <template #actions>
        <button class="btn-primary btn-sm" @click="submitIflowCookie" :disabled="iflowState.loading">
          {{ iflowState.loading ? "导入中..." : "导入" }}
        </button>
      </template>

      <div class="oauth-body">
        <div class="form-item">
          <span class="form-label">Cookie</span>
          <input v-model="iflowState.cookie" class="form-input" placeholder="粘贴 iFlow Cookie" />
        </div>
        <div v-if="iflowState.error" class="status-badge" :class="iflowState.errorType === 'warning' ? 'warning' : 'error'">
          {{ iflowState.error }}
        </div>
        <div v-if="iflowState.result && iflowState.result.status === 'ok'" class="result-box">
          <div class="result-title">导入结果</div>
          <div class="result-list">
            <div v-if="iflowState.result.email" class="result-item">
              <span class="result-key">Email</span>
              <span class="result-value">{{ iflowState.result.email }}</span>
            </div>
            <div v-if="iflowState.result.expired" class="result-item">
              <span class="result-key">Expired</span>
              <span class="result-value">{{ iflowState.result.expired }}</span>
            </div>
            <div v-if="iflowState.result.saved_path" class="result-item">
              <span class="result-key">保存路径</span>
              <span class="result-value">{{ iflowState.result.saved_path }}</span>
            </div>
            <div v-if="iflowState.result.type" class="result-item">
              <span class="result-key">类型</span>
              <span class="result-value">{{ iflowState.result.type }}</span>
            </div>
          </div>
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.oauth-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.oauth-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.oauth-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  color: var(--zinc-500);
}

.form-input {
  border: 1px solid var(--zinc-200);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--zinc-700);
  background: #fff;
}

.form-input:focus {
  outline: none;
  border-color: #6366F1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
}

.auth-url {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  padding: 10px;
  background: var(--zinc-50);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-url-label {
  font-size: 11px;
  color: var(--zinc-500);
}

.auth-url-value {
  font-size: 12px;
  color: var(--zinc-800);
  word-break: break-all;
}

.auth-url-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.copy-status {
  font-size: 11px;
  color: var(--zinc-500);
}

.callback-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.callback-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.status-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--zinc-100);
  color: var(--zinc-600);
  align-self: flex-start;
}

.status-badge.waiting {
  background: #fefce8;
  color: #ca8a04;
}

.status-badge.success {
  background: #f0fdf4;
  color: #16a34a;
}

.status-badge.error {
  background: #fef2f2;
  color: #dc2626;
}

.status-badge.warning {
  background: #fff7ed;
  color: #c2410c;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-name {
  font-size: 12px;
  color: var(--zinc-700);
}

.file-muted {
  color: var(--zinc-400);
}

.result-box {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  padding: 10px;
  background: #fff;
}

.result-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--zinc-800);
  margin-bottom: 8px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--zinc-600);
}

.result-key {
  color: var(--zinc-500);
}

.result-value {
  color: var(--zinc-800);
  font-family: monospace;
}

.btn-primary {
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: background 150ms ease;
}

.btn-primary:hover {
  background: #4338ca;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-ghost {
  background: none;
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  color: var(--zinc-600);
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.btn-ghost:hover {
  background: var(--zinc-50);
  border-color: var(--zinc-300);
  color: var(--zinc-900);
}

.btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}

.btn-xs {
  font-size: 11px;
  padding: 2px 8px;
}
</style>
