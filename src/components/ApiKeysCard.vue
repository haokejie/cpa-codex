<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useApiKeysStore } from "../stores/apiKeys";
import ConfirmDialog from "./ConfirmDialog.vue";

const store = useApiKeysStore();

const showEditor = ref(false);
const editingIndex = ref<number | null>(null);
const inputValue = ref("");
const formError = ref("");
const showDeleteDialog = ref(false);
const pendingDeleteIndex = ref<number | null>(null);
const showClearDialog = ref(false);
const copyMessage = ref("");
const copyKind = ref<"success" | "error">("success");
let copyTimer: number | undefined;

onMounted(() => store.fetchKeys());

const totalCount = computed(() => store.keys.length);

function maskKey(value: string): string {
  const raw = value.trim();
  if (raw.length <= 10) return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
  return `${raw.slice(0, 6)}***${raw.slice(-4)}`;
}

function isValidApiKeyCharset(key: string): boolean {
  return /^[\x21-\x7E]+$/.test(key);
}

function setCopyMessage(message: string, kind: "success" | "error") {
  copyMessage.value = message;
  copyKind.value = kind;
  if (copyTimer) window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyMessage.value = "";
  }, 1600);
}

async function handleCopy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    setCopyMessage("已复制到剪贴板", "success");
  } catch {
    setCopyMessage("复制失败", "error");
  }
}

function generateApiKey(): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const length = 17;
  const bytes = new Uint8Array(length);
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const body = Array.from(bytes, (b) => charset[b % charset.length]).join("");
  return `sk-${body}`;
}

function openAdd() {
  editingIndex.value = null;
  inputValue.value = "";
  formError.value = "";
  showEditor.value = true;
}

function openEdit(index: number) {
  editingIndex.value = index;
  inputValue.value = store.keys[index] ?? "";
  formError.value = "";
  showEditor.value = true;
}

function closeEditor() {
  showEditor.value = false;
  inputValue.value = "";
  editingIndex.value = null;
  formError.value = "";
}

function validateInput() {
  const trimmed = inputValue.value.trim();
  if (!trimmed) return "请输入 API 密钥";
  if (!isValidApiKeyCharset(trimmed)) return "API 密钥包含无效字符";
  const existsIndex = store.keys.findIndex((k) => k === trimmed);
  if (existsIndex >= 0 && existsIndex !== editingIndex.value) return "该 API 密钥已存在";
  return "";
}

async function handleSave() {
  const error = validateInput();
  if (error) {
    formError.value = error;
    return;
  }
  const trimmed = inputValue.value.trim();
  try {
    if (editingIndex.value === null) {
      await store.addKey(trimmed);
    } else {
      await store.updateKey(editingIndex.value, trimmed);
    }
    closeEditor();
  } catch (e) {
    formError.value = String(e);
  }
}

function requestDelete(index: number) {
  pendingDeleteIndex.value = index;
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  if (pendingDeleteIndex.value === null) {
    showDeleteDialog.value = false;
    return;
  }
  const index = pendingDeleteIndex.value;
  pendingDeleteIndex.value = null;
  showDeleteDialog.value = false;
  try {
    await store.removeKey(index);
  } catch {
    // 错误由 store.error 展示
  }
}

function requestClear() {
  if (!store.keys.length) return;
  showClearDialog.value = true;
}

async function confirmClear() {
  showClearDialog.value = false;
  try {
    await store.clearKeys();
  } catch {
    // 错误由 store.error 展示
  }
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">API 密钥</h2>
        <p class="card-desc">管理代理 API 密钥（{{ totalCount }} 个）</p>
      </div>
      <div class="head-actions">
        <button class="btn-ghost btn-sm" @click="store.fetchKeys" :disabled="store.loading || store.working">刷新</button>
        <button class="btn-ghost btn-sm" @click="openAdd" :disabled="store.loading || store.working">添加</button>
        <button class="btn-ghost btn-sm btn-ghost-danger" @click="requestClear" :disabled="!store.keys.length || store.working">清空</button>
      </div>
    </div>

    <div v-if="store.error" class="error-banner">
      <span class="error-text">{{ store.error }}</span>
      <button class="btn-ghost btn-sm" @click="store.fetchKeys">重试</button>
    </div>

    <div v-if="copyMessage" class="info-banner" :class="copyKind === 'success' ? 'info-success' : 'info-error'">
      {{ copyMessage }}
    </div>

    <div v-if="store.loading" class="empty-state keep-height">
      <p class="empty-text">加载中...</p>
    </div>

    <div v-else-if="!store.keys.length" class="empty-state">
      <p class="empty-text">暂无 API 密钥</p>
      <button class="btn-dashed" @click="openAdd">+ 添加 API 密钥</button>
    </div>

    <div v-else class="key-list">
      <div class="key-header">
        <span class="col-index">序号</span>
        <span class="col-key">密钥</span>
        <span class="col-ops">操作</span>
      </div>
      <div class="key-body">
        <div v-for="(key, index) in store.keys" :key="`${key}-${index}`" class="key-row">
          <span class="col-index">#{{ index + 1 }}</span>
          <span class="col-key key-text" :title="key">{{ maskKey(key) }}</span>
          <span class="col-ops key-actions">
            <button class="btn-row" @click="handleCopy(key)">复制</button>
            <button class="btn-row" @click="openEdit(index)">编辑</button>
            <button class="btn-row btn-row-danger" @click="requestDelete(index)">删除</button>
          </span>
        </div>
      </div>
    </div>

    <div v-if="!store.loading" class="hint">每个条目代表一个 API 密钥（对应 /api-keys 接口）。</div>
  </section>

  <ConfirmDialog
    :open="showDeleteDialog"
    title="删除 API 密钥"
    :message="pendingDeleteIndex !== null ? `确定要删除第 ${pendingDeleteIndex + 1} 个 API 密钥吗？此操作不可撤销。` : '确定要删除该 API 密钥吗？此操作不可撤销。'"
    :loading="store.working"
    @confirm="confirmDelete"
    @cancel="showDeleteDialog = false"
  />

  <ConfirmDialog
    :open="showClearDialog"
    title="清空 API 密钥"
    message="确定要清空所有 API 密钥吗？此操作不可撤销。"
    :loading="store.working"
    @confirm="confirmClear"
    @cancel="showClearDialog = false"
  />

  <div v-if="showEditor" class="mask">
    <div class="dialog">
      <div class="dialog-header">
        <h3 class="dialog-title">{{ editingIndex === null ? '添加 API 密钥' : '编辑 API 密钥' }}</h3>
      </div>
      <div class="dialog-body">
        <label class="input-label">API 密钥</label>
        <div class="input-row">
          <input
            v-model="inputValue"
            type="text"
            class="input"
            placeholder="粘贴你的 API 密钥"
            :disabled="store.working"
          />
          <button class="btn-ghost btn-sm" type="button" @click="inputValue = generateApiKey()" :disabled="store.working">
            生成
          </button>
        </div>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <p class="input-hint">此处直接修改 API 密钥列表，会同步到 /api-keys 接口。</p>
      </div>
      <div class="dialog-footer">
        <button class="btn-ghost" :disabled="store.working" @click="closeEditor">取消</button>
        <button class="btn-primary" :disabled="store.working" @click="handleSave">
          {{ editingIndex === null ? '添加' : '更新' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: #fff;
  border: 1px solid var(--zinc-200);
  border-radius: 12px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 52px - 56px);
  min-height: 0;
}
.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--zinc-900);
  margin-bottom: 4px;
}
.card-desc {
  font-size: 12px;
  color: var(--zinc-500);
}
.head-actions {
  display: flex;
  gap: 8px;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: 8px;
  margin-bottom: 10px;
}
.error-text {
  font-size: 13px;
  color: var(--red-600);
}

.info-banner {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  margin-bottom: 10px;
}
.info-success {
  background: var(--green-50);
  color: var(--green-600);
}
.info-error {
  background: var(--red-50);
  color: var(--red-600);
}

.empty-state {
  padding: 40px 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.keep-height {
  flex: 1;
}
.empty-text {
  font-size: 13px;
  color: var(--zinc-500);
}

.key-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.key-header {
  display: flex;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--zinc-200);
  font-size: 11px;
  font-weight: 500;
  color: var(--zinc-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.key-body {
  flex: 1;
  overflow-y: auto;
}
.key-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--zinc-100);
}
.key-row:last-child {
  border-bottom: none;
}
.col-index {
  width: 60px;
  flex-shrink: 0;
  color: var(--zinc-500);
  font-size: 12px;
}
.col-key {
  flex: 1;
  min-width: 0;
}
.key-text {
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 13px;
  color: var(--zinc-800);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.col-ops {
  width: 150px;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
}
.key-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hint {
  font-size: 12px;
  color: var(--zinc-400);
  margin-top: 8px;
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
.btn-ghost-danger {
  border-color: var(--red-200);
  color: var(--red-600);
}
.btn-ghost-danger:hover {
  background: var(--red-50);
  border-color: var(--red-200);
  color: var(--red-600);
}
.btn-sm { font-size: 12px; padding: 4px 10px; height: 28px; }

.btn-dashed {
  height: 34px;
  padding: 0 18px;
  background: transparent;
  color: var(--zinc-600);
  border: 1px dashed var(--zinc-300);
  border-radius: 7px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease;
}
.btn-dashed:hover {
  border-color: var(--zinc-400);
  color: var(--zinc-900);
}

.btn-row {
  background: transparent;
  border: 1px solid var(--zinc-200);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-family: inherit;
  color: var(--zinc-600);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}
.btn-row:hover {
  background: var(--zinc-50);
  border-color: var(--zinc-300);
  color: var(--zinc-900);
}
.btn-row-danger {
  color: var(--red-600);
  border-color: var(--red-200);
}
.btn-row-danger:hover {
  background: var(--red-50);
  border-color: var(--red-200);
  color: var(--red-600);
}

.mask {
  position: fixed;
  inset: 0;
  background: rgba(9, 9, 11, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(2px);
}

.dialog {
  width: 420px;
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.14);
  overflow: hidden;
}

.dialog-header {
  padding: 20px 20px 0;
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #18181B;
}

.dialog-body {
  padding: 10px 20px 16px;
}

.input-label {
  font-size: 12px;
  color: var(--zinc-500);
  margin-bottom: 6px;
  display: block;
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input {
  flex: 1;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 13px;
  font-family: inherit;
  color: var(--zinc-800);
}

.input:focus {
  outline: none;
  border-color: var(--indigo-500);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.10);
}

.form-error {
  margin-top: 8px;
  font-size: 12px;
  color: var(--red-600);
}

.input-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--zinc-400);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 20px;
}

.dialog-footer .btn-ghost {
  height: 34px;
  padding: 0 14px;
  border-radius: 7px;
  font-size: 13px;
}

.btn-primary {
  height: 34px;
  padding: 0 16px;
  background: var(--zinc-900);
  color: #FFFFFF;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--zinc-800);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
