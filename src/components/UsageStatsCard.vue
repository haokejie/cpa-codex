<script setup lang="ts">
import { useCodexStore } from "../stores/codex";

const store = useCodexStore();

function fmt(n: number) {
  return n.toLocaleString();
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2 class="card-title">使用统计</h2>
      <p class="card-desc">请求成功率与密钥使用情况</p>
    </div>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">总请求</span>
        <span class="stat-value">{{ fmt(store.usage.totalRequests) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">成功</span>
        <span class="stat-value value-green">{{ fmt(store.usage.successCount) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">失败</span>
        <span class="stat-value value-red">{{ fmt(store.usage.failCount) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">成功率</span>
        <span class="stat-value">{{ store.successRate }}%</span>
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
.card-head { margin-bottom: 20px; }
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--zinc-900);
  margin-bottom: 4px;
}
.card-desc {
  font-size: 12px;
  color: var(--zinc-400);
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--zinc-100);
}
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  font-size: 12px;
  color: var(--zinc-400);
}
.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--zinc-900);
}
.value-green { color: var(--green-600); }
.value-red { color: var(--red-600); }
</style>
