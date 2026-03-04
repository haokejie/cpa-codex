<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Codemirror from "./Codemirror.vue";
import { yaml } from "@codemirror/lang-yaml";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { keymap } from "@codemirror/view";
import { parse as parseYaml, parseDocument } from "yaml";
import BaseCard from "./BaseCard.vue";
import VisualConfigEditor from "./config/VisualConfigEditor.vue";
import DiffModal from "./config/DiffModal.vue";
import { useVisualConfig } from "../composables/useVisualConfig";
import { useConfigFileStore } from "../stores/configFile";
import { useAuthStore } from "../stores/auth";

type ConfigTab = "visual" | "source";

const authStore = useAuthStore();
const store = useConfigFileStore();

const {
  visualValues,
  visualDirty,
  loadVisualValuesFromYaml,
  applyVisualChangesToYaml,
  setVisualValues,
} = useVisualConfig();

const activeTab = ref<ConfigTab>("visual");
const content = ref("");
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const dirty = ref(false);
const diffModalOpen = ref(false);
const serverYaml = ref("");
const mergedYaml = ref("");
const infoMessage = ref("");

const searchQuery = ref("");
const searchResults = ref<{ current: number; total: number }>({ current: 0, total: 0 });
const lastSearchedQuery = ref("");
const editorView = ref<any>(null);

const disableControls = computed(() => !authStore.currentAccount);
const isDirty = computed(() => dirty.value || visualDirty.value);

const extensions = computed(() => [
  yaml(),
  search(),
  highlightSelectionMatches(),
  keymap.of(searchKeymap),
]);

function readCommercialModeFromYaml(yamlContent: string): boolean {
  try {
    const parsed = parseYaml(yamlContent);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    return Boolean((parsed as Record<string, unknown>)["commercial-mode"]);
  } catch {
    return false;
  }
}

const loadConfig = async () => {
  loading.value = true;
  error.value = "";
  infoMessage.value = "";
  try {
    const data = await store.load();
    content.value = data;
    dirty.value = false;
    diffModalOpen.value = false;
    serverYaml.value = data;
    mergedYaml.value = data;
    loadVisualValuesFromYaml(data);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
};

const handleChange = (value: string) => {
  content.value = value;
  dirty.value = true;
};

const handleTabChange = (tab: ConfigTab) => {
  if (tab === activeTab.value) return;
  if (tab === "source") {
    if (visualDirty.value) {
      const nextContent = applyVisualChangesToYaml(content.value);
      if (nextContent !== content.value) {
        content.value = nextContent;
        dirty.value = true;
      }
    }
  } else {
    loadVisualValuesFromYaml(content.value);
  }
  activeTab.value = tab;
};

const handleSave = async () => {
  saving.value = true;
  infoMessage.value = "";
  try {
    const nextMergedYaml = activeTab.value === "source" ? content.value : applyVisualChangesToYaml(content.value);
    const latestServerYaml = await store.load();

    let diffOriginal = latestServerYaml;
    if (activeTab.value !== "source") {
      try {
        const doc = parseDocument(latestServerYaml);
        diffOriginal = doc.toString({ indent: 2, lineWidth: 120, minContentWidth: 0 });
      } catch {
        diffOriginal = latestServerYaml;
      }
    }

    if (diffOriginal === nextMergedYaml) {
      dirty.value = false;
      content.value = latestServerYaml;
      serverYaml.value = latestServerYaml;
      mergedYaml.value = nextMergedYaml;
      loadVisualValuesFromYaml(latestServerYaml);
      infoMessage.value = "没有检测到变更";
      return;
    }

    serverYaml.value = diffOriginal;
    mergedYaml.value = nextMergedYaml;
    diffModalOpen.value = true;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : "保存失败";
  } finally {
    saving.value = false;
  }
};

const handleConfirmSave = async () => {
  saving.value = true;
  infoMessage.value = "";
  try {
    const previousCommercialMode = readCommercialModeFromYaml(serverYaml.value);
    const nextCommercialMode = readCommercialModeFromYaml(mergedYaml.value);
    const commercialModeChanged = previousCommercialMode !== nextCommercialMode;

    await store.save(mergedYaml.value);
    const latestContent = await store.load();
    dirty.value = false;
    diffModalOpen.value = false;
    content.value = latestContent;
    serverYaml.value = latestContent;
    mergedYaml.value = latestContent;
    loadVisualValuesFromYaml(latestContent);
    infoMessage.value = commercialModeChanged ? "商业模式变更后需重启服务端" : "保存成功";
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : "保存失败";
  } finally {
    saving.value = false;
  }
};

const performSearch = (query: string, direction: "next" | "prev" = "next") => {
  const view = editorView.value;
  if (!query || !view) return;

  const doc = view.state.doc.toString();
  const matches: number[] = [];
  const lowerQuery = query.toLowerCase();
  const lowerDoc = doc.toLowerCase();

  let pos = 0;
  while (pos < lowerDoc.length) {
    const index = lowerDoc.indexOf(lowerQuery, pos);
    if (index === -1) break;
    matches.push(index);
    pos = index + 1;
  }

  if (matches.length === 0) {
    searchResults.value = { current: 0, total: 0 };
    return;
  }

  const selection = view.state.selection.main;
  const cursorPos = direction === "prev" ? selection.from : selection.to;
  let currentIndex = 0;

  if (direction === "next") {
    for (let i = 0; i < matches.length; i++) {
      if (matches[i] > cursorPos) {
        currentIndex = i;
        break;
      }
      if (i === matches.length - 1) {
        currentIndex = 0;
      }
    }
  } else {
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i] < cursorPos) {
        currentIndex = i;
        break;
      }
      if (i === 0) {
        currentIndex = matches.length - 1;
      }
    }
  }

  const matchPos = matches[currentIndex];
  searchResults.value = { current: currentIndex + 1, total: matches.length };

  view.dispatch({
    selection: { anchor: matchPos, head: matchPos + query.length },
    scrollIntoView: true,
  });
  view.focus();
};

const executeSearch = (direction: "next" | "prev" = "next") => {
  if (!searchQuery.value) return;
  lastSearchedQuery.value = searchQuery.value;
  performSearch(searchQuery.value, direction);
};

const handleSearchKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    executeSearch(event.shiftKey ? "prev" : "next");
  }
};

const handlePrevMatch = () => {
  if (!lastSearchedQuery.value) return;
  performSearch(lastSearchedQuery.value, "prev");
};

const handleNextMatch = () => {
  if (!lastSearchedQuery.value) return;
  performSearch(lastSearchedQuery.value, "next");
};

onMounted(() => {
  loadConfig();
});
</script>

<template>
  <BaseCard title="配置文件编辑" description="支持可视化与源码双模式" headerGap="lg">
    <div class="tab-bar">
      <button
        class="tab-item"
        :class="{ active: activeTab === 'visual' }"
        :disabled="saving || loading"
        @click="handleTabChange('visual')"
      >
        可视化编辑
      </button>
      <button
        class="tab-item"
        :class="{ active: activeTab === 'source' }"
        :disabled="saving || loading"
        @click="handleTabChange('source')"
      >
        源码编辑
      </button>
    </div>

    <div class="config-body">
      <div v-if="error" class="error-box">{{ error }}</div>

      <template v-if="activeTab === 'visual'">
        <VisualConfigEditor :values="visualValues" :disabled="disableControls || loading" :onChange="setVisualValues" />
      </template>

      <template v-else>
        <div class="search-bar">
          <input
            class="search-input"
            v-model="searchQuery"
            placeholder="搜索配置内容..."
            :disabled="disableControls || loading"
            @keydown="handleSearchKeyDown"
          />
          <div class="search-actions">
            <span v-if="searchQuery && lastSearchedQuery === searchQuery" class="search-count">
              {{ searchResults.total ? `${searchResults.current} / ${searchResults.total}` : "无结果" }}
            </span>
            <button class="btn-ghost" :disabled="!searchQuery || loading" @click="executeSearch('next')">搜索</button>
            <button class="btn-ghost" :disabled="searchResults.total === 0" @click="handlePrevMatch">上一个</button>
            <button class="btn-ghost" :disabled="searchResults.total === 0" @click="handleNextMatch">下一个</button>
          </div>
        </div>
        <div class="editor-wrapper">
          <Codemirror
            :model-value="content"
            :extensions="extensions"
            :editable="!disableControls && !loading"
            :style="{ height: '420px' }"
            @update:model-value="handleChange"
            @ready="(payload: any) => (editorView = payload.view)"
          />
        </div>
      </template>
    </div>

    <div class="action-bar">
      <span class="status-text">
        <template v-if="disableControls">未连接</template>
        <template v-else-if="loading">加载中...</template>
        <template v-else-if="saving">保存中...</template>
        <template v-else-if="isDirty">已修改</template>
        <template v-else>已加载</template>
      </span>
      <span v-if="infoMessage" class="info-text">{{ infoMessage }}</span>
      <div class="action-buttons">
        <button class="btn-ghost" :disabled="loading" @click="loadConfig">重载</button>
        <button class="btn-action" :disabled="disableControls || loading || saving || !isDirty || diffModalOpen" @click="handleSave">
          保存
        </button>
      </div>
    </div>
  </BaseCard>

  <DiffModal
    :open="diffModalOpen"
    :original="serverYaml"
    :modified="mergedYaml"
    :loading="saving"
    @confirm="handleConfirmSave"
    @cancel="diffModalOpen = false"
  />
</template>

<style scoped>
.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tab-item {
  height: 30px;
  padding: 0 14px;
  border-radius: 7px;
  border: 1px solid var(--zinc-200);
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  color: var(--zinc-600);
}
.tab-item.active {
  background: var(--zinc-900);
  color: #fff;
  border-color: var(--zinc-900);
}

.config-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.search-input {
  flex: 1;
  min-width: 160px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--zinc-200);
  padding: 0 10px;
  font-size: 12px;
}
.search-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.search-count {
  font-size: 11px;
  color: var(--zinc-500);
}

.editor-wrapper {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  overflow: hidden;
}

.action-bar {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.status-text {
  font-size: 12px;
  color: var(--zinc-500);
}
.info-text {
  font-size: 12px;
  color: var(--green-600);
}
.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-ghost {
  height: 30px;
  padding: 0 12px;
  background: transparent;
  color: var(--zinc-600);
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-action {
  height: 30px;
  padding: 0 14px;
  background: var(--zinc-900);
  color: #fff;
  border: 1px solid var(--zinc-900);
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-box {
  background: var(--red-50);
  color: var(--red-600);
  border: 1px solid var(--red-100);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
}
</style>
