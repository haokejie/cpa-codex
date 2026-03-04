<script setup lang="ts">
import { ref } from "vue";
import { useUsageStore } from "../stores/usage";
import { saveTextToFile } from "../utils/download";
import BaseCard from "./BaseCard.vue";

const store = useUsageStore();
const importFile = ref<File | null>(null);
const importFileName = ref("");
const importError = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const handleExport = async () => {
  importError.value = null;
  try {
    const payload = await store.runExport();
    const text = JSON.stringify(payload ?? {}, null, 2);
    await saveTextToFile(text, "usage-export.json");
  } catch (e) {
    importError.value = String(e);
  }
};

const pickImportFile = () => {
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  importFile.value = file;
  importFileName.value = file.name;
  importError.value = null;
  input.value = "";
};

const handleImport = async () => {
  importError.value = null;
  if (!importFile.value) {
    importError.value = "请先选择导入文件";
    return;
  }
  try {
    const content = await importFile.value.text();
    const parsed = JSON.parse(content);
    await store.runImport(parsed);
  } catch (e) {
    importError.value = String(e);
  }
};
</script>

<template>
  <BaseCard title="使用统计导入/导出" description="导出或导入使用统计快照" headerGap="sm">
    <div class="usage-actions">
      <button class="btn-ghost btn-sm" @click="handleExport" :disabled="store.exporting">
        {{ store.exporting ? "导出中..." : "导出统计" }}
      </button>
    </div>

    <div class="import-section">
      <div class="import-row">
        <button class="btn-ghost btn-sm" @click="pickImportFile">选择文件</button>
        <span class="file-name" :class="{ 'file-muted': !importFileName }">
          {{ importFileName || '未选择文件' }}
        </span>
        <button class="btn-primary btn-sm" @click="handleImport" :disabled="store.importing">
          {{ store.importing ? "导入中..." : "导入" }}
        </button>
      </div>
      <input ref="fileInput" type="file" accept=".json,application/json" style="display:none" @change="handleFileChange" />

      <div v-if="store.importResult" class="result-box">
        <div class="result-title">导入结果</div>
        <div class="result-list">
          <div class="result-item">
            <span>新增</span>
            <span>{{ store.importResult.added ?? 0 }}</span>
          </div>
          <div class="result-item">
            <span>跳过</span>
            <span>{{ store.importResult.skipped ?? 0 }}</span>
          </div>
          <div class="result-item">
            <span>总请求</span>
            <span>{{ store.importResult.total_requests ?? 0 }}</span>
          </div>
          <div class="result-item">
            <span>失败请求</span>
            <span>{{ store.importResult.failed_requests ?? 0 }}</span>
          </div>
        </div>
      </div>

      <div v-if="store.exportError" class="error-text">导出失败：{{ store.exportError }}</div>
      <div v-if="store.importError" class="error-text">导入失败：{{ store.importError }}</div>
      <div v-if="importError" class="error-text">{{ importError }}</div>
    </div>
  </BaseCard>
</template>

<style scoped>
.usage-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.import-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.import-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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
  margin-bottom: 8px;
}

.result-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 6px;
  font-size: 12px;
  color: var(--zinc-600);
}

.result-item {
  display: flex;
  justify-content: space-between;
}

.error-text {
  font-size: 12px;
  color: #dc2626;
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

.btn-primary {
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}
</style>
