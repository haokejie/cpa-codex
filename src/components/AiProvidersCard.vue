<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type {
  AmpcodeConfig,
  ApiCallResult,
  GeminiKeyConfig,
  ModelAlias,
  OpenAIProviderConfig,
  ProviderKeyConfig,
} from "../types";
import BaseCard from "./BaseCard.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { useAiProvidersStore } from "../stores/aiProviders";
import {
  buildAmpcodeMappingsText,
  buildOpenAIModelsEndpoint,
  buildOpenAIProviderDraft,
  formatExcludedModelsText,
  formatHeadersText,
  formatModelAliasesText,
  maskSecret,
  parseAmpcodeMappingsText,
  parseExcludedModelsText,
  parseHeadersText,
  parseModelAliasesText,
} from "../utils/providers";
import { normalizeModelList } from "../utils/models";
import { fetchModelsViaApiCall } from "../api/models";

type ProviderDraft = ProviderKeyConfig & {
  headersText: string;
  modelsText: string;
  excludedText: string;
  cloakMode?: string;
  cloakStrict?: boolean;
  cloakSensitiveText: string;
};

type GeminiDraft = GeminiKeyConfig & {
  headersText: string;
  modelsText: string;
  excludedText: string;
};

type OpenAIKeyDraft = {
  apiKey: string;
  proxyUrl?: string;
  headers?: Record<string, string>;
  headersText: string;
};

type OpenAIProviderDraft = OpenAIProviderConfig & {
  headersText: string;
  modelsText: string;
  apiKeyEntries: OpenAIKeyDraft[];
};

const store = useAiProvidersStore();

const geminiDraft = ref<GeminiDraft[]>([]);
const codexDraft = ref<ProviderDraft[]>([]);
const claudeDraft = ref<ProviderDraft[]>([]);
const vertexDraft = ref<ProviderDraft[]>([]);
const openaiDraft = ref<OpenAIProviderDraft[]>([]);

const ampcodeDraft = ref<AmpcodeConfig>({
  upstreamUrl: "",
  upstreamApiKey: "",
  forceModelMappings: false,
  modelMappings: [],
});
const ampcodeMappingsText = ref("");

const workingSection = ref<string | null>(null);
const confirmState = ref({
  open: false,
  title: "",
  message: "",
  onConfirm: () => {},
});

const openConfirm = (title: string, message: string, onConfirm: () => void) => {
  confirmState.value = { open: true, title, message, onConfirm };
};

const closeConfirm = () => {
  confirmState.value = { ...confirmState.value, open: false };
};

const buildProviderDraft = (entry: ProviderKeyConfig): ProviderDraft => ({
  ...entry,
  headersText: formatHeadersText(entry.headers),
  modelsText: formatModelAliasesText(entry.models),
  excludedText: formatExcludedModelsText(entry.excludedModels),
  cloakMode: entry.cloak?.mode ?? "",
  cloakStrict: entry.cloak?.strictMode ?? false,
  cloakSensitiveText: formatExcludedModelsText(entry.cloak?.sensitiveWords),
});

const buildGeminiDraft = (entry: GeminiKeyConfig): GeminiDraft => ({
  ...entry,
  headersText: formatHeadersText(entry.headers),
  modelsText: formatModelAliasesText(entry.models),
  excludedText: formatExcludedModelsText(entry.excludedModels),
});

const toProviderConfig = (draft: ProviderDraft): ProviderKeyConfig => {
  const models = parseModelAliasesText(draft.modelsText);
  const excluded = parseExcludedModelsText(draft.excludedText);
  const headers = parseHeadersText(draft.headersText);
  const cloakSensitive = parseExcludedModelsText(draft.cloakSensitiveText);

  const next: ProviderKeyConfig = {
    apiKey: draft.apiKey,
    priority: draft.priority,
    prefix: draft.prefix,
    baseUrl: draft.baseUrl,
    websockets: draft.websockets,
    proxyUrl: draft.proxyUrl,
    headers: Object.keys(headers).length ? headers : undefined,
    models: models.length ? models : undefined,
    excludedModels: excluded.length ? excluded : undefined,
  };

  if (draft.cloakMode || draft.cloakStrict || cloakSensitive.length) {
    next.cloak = {
      mode: draft.cloakMode || undefined,
      strictMode: draft.cloakStrict,
      sensitiveWords: cloakSensitive.length ? cloakSensitive : undefined,
    };
  }

  return next;
};

const toGeminiConfig = (draft: GeminiDraft): GeminiKeyConfig => {
  const models = parseModelAliasesText(draft.modelsText);
  const excluded = parseExcludedModelsText(draft.excludedText);
  const headers = parseHeadersText(draft.headersText);
  return {
    apiKey: draft.apiKey,
    priority: draft.priority,
    prefix: draft.prefix,
    baseUrl: draft.baseUrl,
    proxyUrl: draft.proxyUrl,
    headers: Object.keys(headers).length ? headers : undefined,
    models: models.length ? models : undefined,
    excludedModels: excluded.length ? excluded : undefined,
  };
};

const toOpenAIProvider = (draft: OpenAIProviderDraft): OpenAIProviderConfig => {
  const models = parseModelAliasesText(draft.modelsText);
  const headers = parseHeadersText(draft.headersText);
  return {
    name: draft.name,
    prefix: draft.prefix,
    baseUrl: draft.baseUrl,
    apiKeyEntries: draft.apiKeyEntries.map((entry: OpenAIKeyDraft) => ({
      apiKey: entry.apiKey,
      proxyUrl: entry.proxyUrl,
      headers: Object.keys(parseHeadersText(entry.headersText)).length
        ? parseHeadersText(entry.headersText)
        : undefined,
    })),
    headers: Object.keys(headers).length ? headers : undefined,
    models: models.length ? models : undefined,
    priority: draft.priority,
    testModel: draft.testModel,
  };
};

const rebuildDrafts = () => {
  geminiDraft.value = store.gemini.map(buildGeminiDraft);
  codexDraft.value = store.codex.map(buildProviderDraft);
  claudeDraft.value = store.claude.map(buildProviderDraft);
  vertexDraft.value = store.vertex.map(buildProviderDraft);
  openaiDraft.value = store.openai.map((entry) => buildOpenAIProviderDraft(entry) as OpenAIProviderDraft);
  ampcodeDraft.value = {
    upstreamUrl: store.ampcode?.upstreamUrl ?? "",
    upstreamApiKey: undefined,
    forceModelMappings: store.ampcode?.forceModelMappings ?? false,
    modelMappings: store.ampcode?.modelMappings ?? [],
  };
  ampcodeMappingsText.value = buildAmpcodeMappingsText(store.ampcodeMappings);
};

const addGemini = () => {
  geminiDraft.value.push(buildGeminiDraft({ apiKey: "" }));
};
const addCodex = () => {
  codexDraft.value.push(buildProviderDraft({ apiKey: "" }));
};
const addClaude = () => {
  claudeDraft.value.push(buildProviderDraft({ apiKey: "" }));
};
const addVertex = () => {
  vertexDraft.value.push(buildProviderDraft({ apiKey: "" }));
};
const addOpenAI = () => {
  openaiDraft.value.push({
    name: "",
    baseUrl: "",
    apiKeyEntries: [{ apiKey: "", headersText: "" }],
    headersText: "",
    modelsText: "",
    priority: 0,
  });
};

const removeEntry = (list: any[], index: number) => {
  list.splice(index, 1);
};

const saveSection = async (section: string, task: () => Promise<void>) => {
  workingSection.value = section;
  try {
    await task();
  } finally {
    workingSection.value = null;
  }
};

const refreshAll = async () => {
  await store.refreshAll();
  rebuildDrafts();
};

const saveAmpcode = async () => {
  const payload: AmpcodeConfig = {
    upstreamUrl: ampcodeDraft.value.upstreamUrl?.trim() ?? "",
    forceModelMappings: ampcodeDraft.value.forceModelMappings,
  };
  if (ampcodeDraft.value.upstreamApiKey) {
    payload.upstreamApiKey = ampcodeDraft.value.upstreamApiKey;
  }
  await store.updateAmpcodeConfig(payload);
  ampcodeDraft.value.upstreamApiKey = undefined;
};

const clearAmpcodeKey = async () => {
  await store.updateAmpcodeConfig({ upstreamApiKey: "" });
  ampcodeDraft.value.upstreamApiKey = undefined;
};

const clearAmpcodeUrl = async () => {
  await store.updateAmpcodeConfig({ upstreamUrl: "" });
  ampcodeDraft.value.upstreamUrl = "";
};

const importOpenaiModels = async (index: number) => {
  const provider = openaiDraft.value[index];
  const url = buildOpenAIModelsEndpoint(provider.baseUrl);
  if (!url) return;
  const apiKey = provider.apiKeyEntries?.[0]?.apiKey;
  const headers = parseHeadersText(provider.headersText);

  const result: ApiCallResult = await fetchModelsViaApiCall(url, apiKey, headers);
  let payload: unknown = result.body;
  if (!payload && result.bodyText) {
    try {
      payload = JSON.parse(result.bodyText);
    } catch {
      payload = result.bodyText;
    }
  }
  const list = normalizeModelList(payload, { dedupe: true });
  if (!list.length) return;

  const existing = parseModelAliasesText(provider.modelsText);
  const seen = new Set(existing.map((m) => m.name.toLowerCase()));
  const merged: ModelAlias[] = [...existing];
  list.forEach((model) => {
    const key = model.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({ name: model.name, alias: model.alias });
  });
  provider.modelsText = formatModelAliasesText(merged);
};

watch(
  () => [store.gemini, store.codex, store.claude, store.vertex, store.openai, store.ampcode, store.ampcodeMappings],
  rebuildDrafts,
  { deep: true },
);

onMounted(async () => {
  await refreshAll();
});
</script>

<template>
  <div class="providers-stack">
    <BaseCard title="AI 提供商" description="管理 Gemini/Codex/Claude/Vertex/OpenAI 兼容/Ampcode" headerGap="lg">
      <template #actions>
        <button class="btn-ghost" :disabled="store.loading" @click="refreshAll">
          {{ store.loading ? "刷新中..." : "刷新" }}
        </button>
      </template>

      <div class="section">
        <div class="section-head">
          <h3>Gemini</h3>
          <div class="section-actions">
            <button class="btn-ghost" @click="addGemini">新增</button>
            <button
              class="btn-action"
              :disabled="workingSection === 'gemini'"
              @click="saveSection('gemini', () => store.saveGemini(geminiDraft.map(toGeminiConfig)))"
            >
              {{ workingSection === 'gemini' ? "保存中..." : "保存" }}
            </button>
          </div>
        </div>
        <div v-if="geminiDraft.length === 0" class="empty">暂无 Gemini 配置</div>
        <details v-for="(entry, idx) in geminiDraft" :key="`gemini-${idx}`" class="entry" open>
          <summary>
            <span>Key {{ idx + 1 }}</span>
            <span class="muted">{{ maskSecret(entry.apiKey) || "未填写" }}</span>
          </summary>
          <div class="entry-body">
            <div class="form-grid">
              <label class="field">
                <span>API Key</span>
                <input v-model="entry.apiKey" class="input" />
              </label>
              <label class="field">
                <span>优先级</span>
                <input v-model.number="entry.priority" class="input" type="number" />
              </label>
              <label class="field">
                <span>Prefix</span>
                <input v-model="entry.prefix" class="input" />
              </label>
              <label class="field">
                <span>Base URL</span>
                <input v-model="entry.baseUrl" class="input" />
              </label>
              <label class="field">
                <span>Proxy URL</span>
                <input v-model="entry.proxyUrl" class="input" />
              </label>
              <label class="field full">
                <span>Headers（key: value）</span>
                <textarea v-model="entry.headersText" class="textarea" />
              </label>
              <label class="field full">
                <span>模型别名（name, alias, priority, testModel）</span>
                <textarea v-model="entry.modelsText" class="textarea" />
              </label>
              <label class="field full">
                <span>排除模型（每行一个）</span>
                <textarea v-model="entry.excludedText" class="textarea" />
              </label>
            </div>
            <div class="entry-actions">
              <button
                class="btn-danger"
                @click="openConfirm('删除 Gemini 配置', '确认删除该配置？', () => removeEntry(geminiDraft, idx))"
              >
                删除
              </button>
            </div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head">
          <h3>Codex</h3>
          <div class="section-actions">
            <button class="btn-ghost" @click="addCodex">新增</button>
            <button
              class="btn-action"
              :disabled="workingSection === 'codex'"
              @click="saveSection('codex', () => store.saveCodex(codexDraft.map(toProviderConfig)))"
            >
              {{ workingSection === 'codex' ? "保存中..." : "保存" }}
            </button>
          </div>
        </div>
        <div v-if="codexDraft.length === 0" class="empty">暂无 Codex 配置</div>
        <details v-for="(entry, idx) in codexDraft" :key="`codex-${idx}`" class="entry">
          <summary>
            <span>Key {{ idx + 1 }}</span>
            <span class="muted">{{ maskSecret(entry.apiKey) || "未填写" }}</span>
          </summary>
          <div class="entry-body">
            <div class="form-grid">
              <label class="field">
                <span>API Key</span>
                <input v-model="entry.apiKey" class="input" />
              </label>
              <label class="field">
                <span>优先级</span>
                <input v-model.number="entry.priority" class="input" type="number" />
              </label>
              <label class="field">
                <span>Prefix</span>
                <input v-model="entry.prefix" class="input" />
              </label>
              <label class="field">
                <span>Base URL</span>
                <input v-model="entry.baseUrl" class="input" />
              </label>
              <label class="field">
                <span>Proxy URL</span>
                <input v-model="entry.proxyUrl" class="input" />
              </label>
              <label class="field">
                <span>WebSockets</span>
                <input v-model="entry.websockets" class="checkbox" type="checkbox" />
              </label>
              <label class="field full">
                <span>Headers（key: value）</span>
                <textarea v-model="entry.headersText" class="textarea" />
              </label>
              <label class="field full">
                <span>模型别名（name, alias, priority, testModel）</span>
                <textarea v-model="entry.modelsText" class="textarea" />
              </label>
              <label class="field full">
                <span>排除模型（每行一个）</span>
                <textarea v-model="entry.excludedText" class="textarea" />
              </label>
            </div>
            <div class="cloak">
              <div class="cloak-title">Cloak 设置</div>
              <div class="form-grid">
                <label class="field">
                  <span>模式</span>
                  <select v-model="entry.cloakMode" class="input">
                    <option value="">默认</option>
                    <option value="auto">Auto</option>
                    <option value="always">Always</option>
                    <option value="never">Never</option>
                  </select>
                </label>
                <label class="field">
                  <span>严格模式</span>
                  <input v-model="entry.cloakStrict" class="checkbox" type="checkbox" />
                </label>
                <label class="field full">
                  <span>敏感词（每行一个）</span>
                  <textarea v-model="entry.cloakSensitiveText" class="textarea" />
                </label>
              </div>
            </div>
            <div class="entry-actions">
              <button
                class="btn-danger"
                @click="openConfirm('删除 Codex 配置', '确认删除该配置？', () => removeEntry(codexDraft, idx))"
              >
                删除
              </button>
            </div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head">
          <h3>Claude</h3>
          <div class="section-actions">
            <button class="btn-ghost" @click="addClaude">新增</button>
            <button
              class="btn-action"
              :disabled="workingSection === 'claude'"
              @click="saveSection('claude', () => store.saveClaude(claudeDraft.map(toProviderConfig)))"
            >
              {{ workingSection === 'claude' ? "保存中..." : "保存" }}
            </button>
          </div>
        </div>
        <div v-if="claudeDraft.length === 0" class="empty">暂无 Claude 配置</div>
        <details v-for="(entry, idx) in claudeDraft" :key="`claude-${idx}`" class="entry">
          <summary>
            <span>Key {{ idx + 1 }}</span>
            <span class="muted">{{ maskSecret(entry.apiKey) || "未填写" }}</span>
          </summary>
          <div class="entry-body">
            <div class="form-grid">
              <label class="field">
                <span>API Key</span>
                <input v-model="entry.apiKey" class="input" />
              </label>
              <label class="field">
                <span>优先级</span>
                <input v-model.number="entry.priority" class="input" type="number" />
              </label>
              <label class="field">
                <span>Prefix</span>
                <input v-model="entry.prefix" class="input" />
              </label>
              <label class="field">
                <span>Base URL</span>
                <input v-model="entry.baseUrl" class="input" />
              </label>
              <label class="field">
                <span>Proxy URL</span>
                <input v-model="entry.proxyUrl" class="input" />
              </label>
              <label class="field full">
                <span>Headers（key: value）</span>
                <textarea v-model="entry.headersText" class="textarea" />
              </label>
              <label class="field full">
                <span>模型别名（name, alias, priority, testModel）</span>
                <textarea v-model="entry.modelsText" class="textarea" />
              </label>
              <label class="field full">
                <span>排除模型（每行一个）</span>
                <textarea v-model="entry.excludedText" class="textarea" />
              </label>
            </div>
            <div class="cloak">
              <div class="cloak-title">Cloak 设置</div>
              <div class="form-grid">
                <label class="field">
                  <span>模式</span>
                  <select v-model="entry.cloakMode" class="input">
                    <option value="">默认</option>
                    <option value="auto">Auto</option>
                    <option value="always">Always</option>
                    <option value="never">Never</option>
                  </select>
                </label>
                <label class="field">
                  <span>严格模式</span>
                  <input v-model="entry.cloakStrict" class="checkbox" type="checkbox" />
                </label>
                <label class="field full">
                  <span>敏感词（每行一个）</span>
                  <textarea v-model="entry.cloakSensitiveText" class="textarea" />
                </label>
              </div>
            </div>
            <div class="entry-actions">
              <button
                class="btn-danger"
                @click="openConfirm('删除 Claude 配置', '确认删除该配置？', () => removeEntry(claudeDraft, idx))"
              >
                删除
              </button>
            </div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head">
          <h3>Vertex</h3>
          <div class="section-actions">
            <button class="btn-ghost" @click="addVertex">新增</button>
            <button
              class="btn-action"
              :disabled="workingSection === 'vertex'"
              @click="saveSection('vertex', () => store.saveVertex(vertexDraft.map(toProviderConfig)))"
            >
              {{ workingSection === 'vertex' ? "保存中..." : "保存" }}
            </button>
          </div>
        </div>
        <div v-if="vertexDraft.length === 0" class="empty">暂无 Vertex 配置</div>
        <details v-for="(entry, idx) in vertexDraft" :key="`vertex-${idx}`" class="entry">
          <summary>
            <span>Key {{ idx + 1 }}</span>
            <span class="muted">{{ maskSecret(entry.apiKey) || "未填写" }}</span>
          </summary>
          <div class="entry-body">
            <div class="form-grid">
              <label class="field">
                <span>API Key</span>
                <input v-model="entry.apiKey" class="input" />
              </label>
              <label class="field">
                <span>优先级</span>
                <input v-model.number="entry.priority" class="input" type="number" />
              </label>
              <label class="field">
                <span>Prefix</span>
                <input v-model="entry.prefix" class="input" />
              </label>
              <label class="field">
                <span>Base URL</span>
                <input v-model="entry.baseUrl" class="input" />
              </label>
              <label class="field">
                <span>Proxy URL</span>
                <input v-model="entry.proxyUrl" class="input" />
              </label>
              <label class="field full">
                <span>Headers（key: value）</span>
                <textarea v-model="entry.headersText" class="textarea" />
              </label>
              <label class="field full">
                <span>模型别名（name, alias, priority, testModel）</span>
                <textarea v-model="entry.modelsText" class="textarea" />
              </label>
              <label class="field full">
                <span>排除模型（每行一个）</span>
                <textarea v-model="entry.excludedText" class="textarea" />
              </label>
            </div>
            <div class="entry-actions">
              <button
                class="btn-danger"
                @click="openConfirm('删除 Vertex 配置', '确认删除该配置？', () => removeEntry(vertexDraft, idx))"
              >
                删除
              </button>
            </div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head">
          <h3>OpenAI 兼容</h3>
          <div class="section-actions">
            <button class="btn-ghost" @click="addOpenAI">新增</button>
            <button
              class="btn-action"
              :disabled="workingSection === 'openai'"
              @click="saveSection('openai', () => store.saveOpenAI(openaiDraft.map(toOpenAIProvider)))"
            >
              {{ workingSection === 'openai' ? "保存中..." : "保存" }}
            </button>
          </div>
        </div>
        <div v-if="openaiDraft.length === 0" class="empty">暂无 OpenAI 兼容配置</div>
        <details v-for="(entry, idx) in openaiDraft" :key="`openai-${idx}`" class="entry">
          <summary>
            <span>{{ entry.name || `Provider ${idx + 1}` }}</span>
            <span class="muted">{{ entry.baseUrl || "未填写 Base URL" }}</span>
          </summary>
          <div class="entry-body">
            <div class="form-grid">
              <label class="field">
                <span>名称</span>
                <input v-model="entry.name" class="input" />
              </label>
              <label class="field">
                <span>Base URL</span>
                <input v-model="entry.baseUrl" class="input" />
              </label>
              <label class="field">
                <span>Prefix</span>
                <input v-model="entry.prefix" class="input" />
              </label>
              <label class="field">
                <span>优先级</span>
                <input v-model.number="entry.priority" class="input" type="number" />
              </label>
              <label class="field">
                <span>测试模型</span>
                <input v-model="entry.testModel" class="input" />
              </label>
              <label class="field full">
                <span>Headers（key: value）</span>
                <textarea v-model="entry.headersText" class="textarea" />
              </label>
              <label class="field full">
                <span>模型别名（name, alias, priority, testModel）</span>
                <textarea v-model="entry.modelsText" class="textarea" />
              </label>
            </div>

            <div class="sub-section">
              <div class="sub-head">
                <span>API Keys</span>
                <div class="sub-actions">
                  <button class="btn-ghost" @click="entry.apiKeyEntries.push({ apiKey: '', headersText: '' })">新增 Key</button>
                  <button class="btn-ghost" @click="importOpenaiModels(idx)">拉取 /v1/models</button>
                </div>
              </div>
              <div v-if="entry.apiKeyEntries.length === 0" class="empty">暂无 Key</div>
              <div v-for="(keyEntry, kIdx) in entry.apiKeyEntries" :key="`openai-key-${idx}-${kIdx}`" class="key-row">
                <div class="form-grid">
                  <label class="field">
                    <span>API Key</span>
                    <input v-model="keyEntry.apiKey" class="input" />
                  </label>
                  <label class="field">
                    <span>Proxy URL</span>
                    <input v-model="keyEntry.proxyUrl" class="input" />
                  </label>
                  <label class="field full">
                    <span>Headers（key: value）</span>
                    <textarea v-model="keyEntry.headersText" class="textarea" />
                  </label>
                </div>
                <button
                  class="btn-link"
                  @click="entry.apiKeyEntries.splice(kIdx, 1)"
                >
                  移除
                </button>
              </div>
            </div>

            <div class="entry-actions">
              <button
                class="btn-danger"
                @click="openConfirm('删除 OpenAI 兼容配置', '确认删除该配置？', () => removeEntry(openaiDraft, idx))"
              >
                删除
              </button>
            </div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head">
          <h3>Ampcode</h3>
          <div class="section-actions">
            <button
              class="btn-action"
              :disabled="workingSection === 'ampcode'"
              @click="saveSection('ampcode', saveAmpcode)"
            >
              {{ workingSection === 'ampcode' ? "保存中..." : "保存设置" }}
            </button>
            <button
              class="btn-ghost"
              :disabled="workingSection === 'ampcode' || !ampcodeDraft.upstreamUrl"
              @click="saveSection('ampcode', clearAmpcodeUrl)"
            >
              清空上游地址
            </button>
            <button
              class="btn-ghost"
              :disabled="workingSection === 'ampcode'"
              @click="saveSection('ampcode', clearAmpcodeKey)"
            >
              清空上游密钥
            </button>
            <button
              class="btn-ghost"
              :disabled="workingSection === 'ampcode-mappings'"
              @click="saveSection('ampcode-mappings', () => store.saveAmpcodeMappings(parseAmpcodeMappingsText(ampcodeMappingsText)))"
            >
              {{ workingSection === 'ampcode-mappings' ? "保存中..." : "保存映射" }}
            </button>
          </div>
        </div>
        <div class="form-grid">
          <label class="field">
            <span>上游地址</span>
            <input v-model="ampcodeDraft.upstreamUrl" class="input" />
          </label>
          <label class="field">
            <span>上游密钥</span>
            <input v-model="ampcodeDraft.upstreamApiKey" class="input" placeholder="留空不变更" />
          </label>
          <label class="field">
            <span>强制映射</span>
            <input v-model="ampcodeDraft.forceModelMappings" class="checkbox" type="checkbox" />
          </label>
          <label class="field full">
            <span>模型映射（from => to）</span>
            <textarea v-model="ampcodeMappingsText" class="textarea" />
          </label>
        </div>
      </div>
    </BaseCard>
  </div>

  <ConfirmDialog
    :open="confirmState.open"
    :title="confirmState.title"
    :message="confirmState.message"
    @cancel="closeConfirm"
    @confirm="() => { confirmState.onConfirm(); closeConfirm(); }"
  />
</template>

<style scoped>
.providers-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--zinc-100);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.section-head h3 {
  font-size: 15px;
  margin: 0;
}
.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.entry {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
  margin-bottom: 12px;
}
.entry summary {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--zinc-800);
}
.entry-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--zinc-600);
}
.field.full {
  grid-column: 1 / -1;
}

.input,
.textarea {
  border: 1px solid var(--zinc-200);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--zinc-800);
  background: #fff;
}
.textarea {
  min-height: 72px;
  resize: vertical;
}
.checkbox {
  width: 18px;
  height: 18px;
}

.entry-actions {
  display: flex;
  justify-content: flex-end;
}

.sub-section {
  border-top: 1px solid var(--zinc-100);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
}
.sub-actions {
  display: flex;
  gap: 6px;
}
.key-row {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--zinc-100);
  background: var(--zinc-50);
}

.cloak {
  border-top: 1px dashed var(--zinc-200);
  padding-top: 12px;
}
.cloak-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--zinc-700);
  margin-bottom: 8px;
}

.btn-ghost {
  height: 30px;
  padding: 0 12px;
  background: transparent;
  color: var(--zinc-600);
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
}
.btn-action {
  height: 30px;
  padding: 0 14px;
  background: var(--zinc-900);
  color: #fff;
  border: 1px solid var(--zinc-900);
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
}
.btn-danger {
  height: 30px;
  padding: 0 12px;
  background: var(--red-600);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
}
.btn-link {
  margin-top: 8px;
  border: none;
  background: transparent;
  color: var(--red-600);
  font-size: 12px;
  cursor: pointer;
}

.empty {
  font-size: 12px;
  color: var(--zinc-400);
  margin-bottom: 8px;
}
.muted {
  font-size: 12px;
  color: var(--zinc-500);
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
