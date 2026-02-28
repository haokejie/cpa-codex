<script setup lang="ts">
import { onMounted } from "vue";
import { useAuthFilesStore } from "../stores/authFiles";

const store = useAuthFilesStore();
onMounted(() => store.fetchFiles());

function typeLabel(type?: string) {
  return type || "unknown";
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div class="head-row">
        <div>
          <h2 class="card-title">认证文件</h2>
          <p class="card-desc">管理 OAuth 认证文件（{{ store.files.length }} 个）</p>
        </div>
        <div class="head-actions">
          <button class="btn-ghost btn-sm" @click="store.fetchFiles" :disabled="store.loading">刷新</button>
          <button class="btn-danger btn-sm" @click="store.removeAll" :disabled="!store.files.length">清空</button>
        </div>
      </div>
    </div>

    <div v-if="store.error" class="error-banner">
      <span class="error-text">{{ store.error }}</span>
      <button class="btn-ghost btn-sm" @click="store.fetchFiles">重试</button>
    </div>

    <div v-if="store.loading" class="empty-state">
      <p class="empty-text">加载中...</p>
    </div>

    <div v-else-if="!store.files.length && !store.error" class="empty-state">
      <p class="empty-text">暂无认证文件</p>
    </div>

    <div v-else class="file-list">
      <div v-for="f in store.files" :key="f.name" class="file-row">
        <div class="file-info">
          <span class="file-name" :class="{ 'file-disabled': f.disabled }">{{ f.name }}</span>
          <span class="file-type">{{ typeLabel(f.type) }}</span>
        </div>
        <div class="file-actions">
          <span v-if="f.unavailable" class="badge badge-unavailable">不可用</span>
          <span v-else-if="f.disabled" class="badge badge-disabled">已禁用</span>
          <span v-else class="badge badge-active">启用</span>
          <button
            v-if="!f.runtimeOnly"
            class="btn-ghost btn-xs"
            @click="store.toggleDisabled(f.name, !f.disabled)"
          >{{ f.disabled ? "启用" : "禁用" }}</button>
          <button
            v-if="!f.runtimeOnly"
            class="btn-danger btn-xs"
            @click="store.remove(f.name)"
          >删除</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card {
  background: #fff;
  border: 1px solid var(--zinc-200);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 16px;
}
.card-head { margin-bottom: 16px; }
.head-row { display: flex; justify-content: space-between; align-items: flex-start; }
.head-actions { display: flex; gap: 8px; }
.card-title { font-size: 14px; font-weight: 600; color: var(--zinc-900); margin-bottom: 4px; }
.card-desc { font-size: 12px; color: var(--zinc-400); }
.error-banner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; background: #fef2f2; border-radius: 8px;
  margin-bottom: 12px; font-size: 12px; color: #dc2626;
}
.empty-state { padding: 24px 0; text-align: center; }
.empty-text { font-size: 13px; color: var(--zinc-400); }
.file-list { display: flex; flex-direction: column; gap: 1px; }
.file-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid var(--zinc-100);
}
.file-row:last-child { border-bottom: none; }
.file-info { display: flex; align-items: center; gap: 8px; min-width: 0; }
.file-name { font-size: 12px; color: var(--zinc-800); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
.file-disabled { color: var(--zinc-400); text-decoration: line-through; }
.file-type { font-size: 11px; color: var(--zinc-400); flex-shrink: 0; }
.file-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 500; }
.badge-active { background: #f0fdf4; color: #16a34a; }
.badge-disabled { background: var(--zinc-100); color: var(--zinc-400); }
.badge-unavailable { background: #fef2f2; color: #dc2626; }
.btn-ghost { background: none; border: 1px solid var(--zinc-200); border-radius: 6px; color: var(--zinc-600); cursor: pointer; }
.btn-ghost:hover { background: var(--zinc-50); }
.btn-danger { background: none; border: 1px solid #fecaca; border-radius: 6px; color: #dc2626; cursor: pointer; }
.btn-danger:hover { background: #fef2f2; }
.btn-sm { font-size: 12px; padding: 4px 10px; }
.btn-xs { font-size: 11px; padding: 2px 8px; }
</style>
