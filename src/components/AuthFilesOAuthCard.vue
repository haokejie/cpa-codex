<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import type { OAuthModelAliasEntry } from "../types";
import { useAuthFilesStore } from "../stores/authFiles";
import { useAuthFilesExtrasStore } from "../stores/authFilesExtras";
import BaseCard from "./BaseCard.vue";

const authFilesStore = useAuthFilesStore();
const extrasStore = useAuthFilesExtrasStore();
const {
  excludedModels,
  modelAlias,
  excludedLoading,
  modelAliasLoading,
  excludedError,
  modelAliasError,
} = storeToRefs(extrasStore);

const DEFAULT_PROVIDERS = [
  "gemini-cli",
  "vertex",
  "aistudio",
  "antigravity",
  "claude",
  "anthropic",
  "codex",
  "qwen",
  "kimi",
  "iflow",
];

const normalizeKey = (value: string) => value.trim().toLowerCase();

const providerOptions = computed(() => {
  const extraSet = new Set<string>();
  Object.keys(excludedModels.value || {}).forEach((key) => extraSet.add(normalizeKey(key)));
  Object.keys(modelAlias.value || {}).forEach((key) => extraSet.add(normalizeKey(key)));
  (authFilesStore.files || []).forEach((file) => {
    if (file.type) extraSet.add(normalizeKey(file.type));
    if (file.provider) extraSet.add(normalizeKey(file.provider));
  });

  const baseSet = new Set(DEFAULT_PROVIDERS.map((value) => normalizeKey(value)));
  const extras = Array.from(extraSet)
    .filter((value) => value && !baseSet.has(value))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  return [...DEFAULT_PROVIDERS, ...extras];
});

const excludedProvider = ref("");
const excludedInput = ref("");
const excludedSaving = ref(false);
const excludedDeleting = ref(false);
const excludedFormError = ref("");

const aliasProvider = ref("");
const aliasEntries = ref<OAuthModelAliasEntry[]>([]);
const aliasSaving = ref(false);
const aliasDeleting = ref(false);
const aliasFormError = ref("");

const resetExcludedInput = () => {
  const key = normalizeKey(excludedProvider.value);
  const list = key ? excludedModels.value?.[key] ?? [] : [];
  excludedInput.value = list.join("\n");
};

const resetAliasEntries = () => {
  const key = normalizeKey(aliasProvider.value);
  const list = key ? modelAlias.value?.[key] ?? [] : [];
  aliasEntries.value = list.map((entry) => ({ ...entry }));
};

watch([excludedProvider, excludedModels], () => {
  resetExcludedInput();
  excludedFormError.value = "";
});

watch([aliasProvider, modelAlias], () => {
  resetAliasEntries();
  aliasFormError.value = "";
});

watch(
  providerOptions,
  (options) => {
    if (!excludedProvider.value && options.length) excludedProvider.value = options[0];
    if (!aliasProvider.value && options.length) aliasProvider.value = options[0];
  },
  { immediate: true }
);

onMounted(() => {
  if (!authFilesStore.files.length) {
    authFilesStore.fetchFiles();
  }
  extrasStore.refreshAll();
});

const parseModelsInput = (value: string): string[] => {
  const tokens = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  tokens.forEach((token) => {
    const key = token.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(token);
  });
  return result;
};

const normalizeAliasEntries = (entries: OAuthModelAliasEntry[]) => {
  const seen = new Set<string>();
  const result: OAuthModelAliasEntry[] = [];
  entries.forEach((entry) => {
    const name = entry.name.trim();
    const alias = entry.alias.trim();
    if (!name || !alias) return;
    const dedupeKey = `${name.toLowerCase()}::${alias.toLowerCase()}::${entry.fork ? "1" : "0"}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push({ name, alias, ...(entry.fork ? { fork: true } : {}) });
  });
  return result;
};

const handleSaveExcluded = async () => {
  excludedFormError.value = "";
  const provider = normalizeKey(excludedProvider.value);
  if (!provider) {
    excludedFormError.value = "请填写 Provider";
    return;
  }
  const models = parseModelsInput(excludedInput.value);
  excludedSaving.value = true;
  try {
    await extrasStore.saveExcluded(provider, models);
  } catch (e) {
    excludedFormError.value = String(e);
  } finally {
    excludedSaving.value = false;
  }
};

const handleDeleteExcluded = async () => {
  excludedFormError.value = "";
  const provider = normalizeKey(excludedProvider.value);
  if (!provider) {
    excludedFormError.value = "请填写 Provider";
    return;
  }
  excludedDeleting.value = true;
  try {
    await extrasStore.deleteExcluded(provider);
    excludedInput.value = "";
  } catch (e) {
    excludedFormError.value = String(e);
  } finally {
    excludedDeleting.value = false;
  }
};

const handleAddAlias = () => {
  aliasEntries.value.push({ name: "", alias: "" });
};

const handleSaveAlias = async () => {
  aliasFormError.value = "";
  const provider = normalizeKey(aliasProvider.value);
  if (!provider) {
    aliasFormError.value = "请填写 Channel";
    return;
  }
  const normalized = normalizeAliasEntries(aliasEntries.value);
  aliasSaving.value = true;
  try {
    await extrasStore.saveAlias(provider, normalized);
    aliasEntries.value = normalized;
  } catch (e) {
    aliasFormError.value = String(e);
  } finally {
    aliasSaving.value = false;
  }
};

const handleDeleteAlias = async () => {
  aliasFormError.value = "";
  const provider = normalizeKey(aliasProvider.value);
  if (!provider) {
    aliasFormError.value = "请填写 Channel";
    return;
  }
  aliasDeleting.value = true;
  try {
    await extrasStore.deleteAlias(provider);
    aliasEntries.value = [];
  } catch (e) {
    aliasFormError.value = String(e);
  } finally {
    aliasDeleting.value = false;
  }
};
</script>

<template>
  <div class="oauth-wrap">
    <BaseCard title="OAuth 排除模型" description="配置 OAuth 登录后需要排除的模型" headerGap="sm">
      <div class="form-grid">
        <label class="form-item">
          <span class="form-label">Provider</span>
          <input
            v-model="excludedProvider"
            class="form-input"
            list="oauth-provider-options"
            placeholder="例如: codex / claude / gemini-cli"
          />
        </label>
        <label class="form-item form-item-full">
          <span class="form-label">排除模型（每行一个）</span>
          <textarea
            v-model="excludedInput"
            class="form-textarea"
            placeholder="例如:\nmodel-a\nmodel-b"
            rows="5"
          ></textarea>
        </label>
      </div>
      <div class="form-actions">
        <div class="form-status">
          <span v-if="excludedLoading" class="status-muted">加载中...</span>
          <span v-else-if="excludedError" class="status-error">{{ excludedError }}</span>
          <span v-else-if="excludedFormError" class="status-error">{{ excludedFormError }}</span>
        </div>
        <div class="form-buttons">
          <button class="btn-ghost btn-sm" @click="resetExcludedInput" :disabled="excludedLoading">重置</button>
          <button
            class="btn-ghost btn-sm btn-ghost-danger"
            @click="handleDeleteExcluded"
            :disabled="excludedDeleting || excludedLoading"
          >{{ excludedDeleting ? "删除中..." : "删除配置" }}</button>
          <button
            class="btn-ghost btn-sm"
            @click="handleSaveExcluded"
            :disabled="excludedSaving || excludedLoading"
          >{{ excludedSaving ? "保存中..." : "保存" }}</button>
        </div>
      </div>
    </BaseCard>

    <BaseCard title="OAuth 模型别名" description="配置 OAuth 渠道的模型别名映射" headerGap="sm">
      <div class="form-grid">
        <label class="form-item">
          <span class="form-label">Channel</span>
          <input
            v-model="aliasProvider"
            class="form-input"
            list="oauth-provider-options"
            placeholder="例如: codex / claude / gemini-cli"
          />
        </label>
        <div class="form-item form-item-full">
          <span class="form-label">别名映射</span>
          <div class="alias-table">
            <div class="alias-header">
              <span>模型名</span>
              <span>别名</span>
              <span>Fork</span>
              <span></span>
            </div>
            <div v-if="!aliasEntries.length" class="alias-empty">暂无映射</div>
            <div v-for="(entry, index) in aliasEntries" :key="`alias-${index}`" class="alias-row">
              <input v-model="entry.name" class="form-input" placeholder="模型名" />
              <input v-model="entry.alias" class="form-input" placeholder="别名" />
              <label class="checkbox-row">
                <input v-model="entry.fork" type="checkbox" />
                <span>Fork</span>
              </label>
              <button class="btn-row btn-row-danger" @click="aliasEntries.splice(index, 1)">删除</button>
            </div>
            <button class="btn-dashed" @click="handleAddAlias">+ 添加映射</button>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <div class="form-status">
          <span v-if="modelAliasLoading" class="status-muted">加载中...</span>
          <span v-else-if="modelAliasError" class="status-error">{{ modelAliasError }}</span>
          <span v-else-if="aliasFormError" class="status-error">{{ aliasFormError }}</span>
        </div>
        <div class="form-buttons">
          <button class="btn-ghost btn-sm" @click="resetAliasEntries" :disabled="modelAliasLoading">重置</button>
          <button
            class="btn-ghost btn-sm btn-ghost-danger"
            @click="handleDeleteAlias"
            :disabled="aliasDeleting || modelAliasLoading"
          >{{ aliasDeleting ? "删除中..." : "删除配置" }}</button>
          <button
            class="btn-ghost btn-sm"
            @click="handleSaveAlias"
            :disabled="aliasSaving || modelAliasLoading"
          >{{ aliasSaving ? "保存中..." : "保存" }}</button>
        </div>
      </div>
    </BaseCard>

    <datalist id="oauth-provider-options">
      <option v-for="option in providerOptions" :key="option" :value="option" />
    </datalist>
  </div>
</template>

<style scoped>
.oauth-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item-full {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 12px;
  color: var(--zinc-500);
}

.form-input,
.form-textarea {
  border: 1px solid var(--zinc-200);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--zinc-700);
  background: #fff;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #6366F1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
}

.form-textarea {
  resize: vertical;
  min-height: 110px;
}

.form-actions {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.form-status {
  font-size: 12px;
}

.status-muted {
  color: var(--zinc-400);
}

.status-error {
  color: #dc2626;
}

.form-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alias-table {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--zinc-50);
}

.alias-header {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto;
  font-size: 11px;
  color: var(--zinc-500);
  padding: 0 4px;
}

.alias-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto;
  gap: 8px;
  align-items: center;
}

.alias-empty {
  font-size: 12px;
  color: var(--zinc-400);
  padding: 8px 4px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--zinc-600);
}

.btn-row {
  background: transparent;
  border: 1px solid var(--zinc-200);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}

.btn-row-danger {
  color: #dc2626;
  border-color: #fecaca;
}

.btn-row-danger:hover {
  background: #fef2f2;
}

.btn-dashed {
  border: 1px dashed var(--zinc-300);
  border-radius: 8px;
  background: transparent;
  font-size: 12px;
  color: var(--zinc-500);
  padding: 8px 12px;
  cursor: pointer;
}

.btn-dashed:hover {
  background: #fff;
  border-color: var(--zinc-400);
  color: var(--zinc-800);
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

.btn-ghost-danger {
  border-color: #fecaca;
  color: #dc2626;
}

.btn-ghost-danger:hover {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}

.btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}
</style>
