<script setup lang="ts">
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useCodexStore } from "../stores/codex";
import type { AuthFileItem } from "../types";
import BaseCard from "./BaseCard.vue";
import {
  buildCandidateUsageSourceIds,
  collectUsageDetails,
  formatCompactNumber,
  normalizeAuthIndex,
} from "../utils/usage";
import { buildSourceInfoMap, resolveSourceDisplay, type CredentialInfo } from "../utils/sourceResolver";
import { useAuthFilesStore } from "../stores/authFiles";

const store = useCodexStore();
const { configs, usageRaw, usageLoading } = storeToRefs(store);
const authFilesStore = useAuthFilesStore();
const { files: authFiles } = storeToRefs(authFilesStore);

onMounted(() => {
  authFilesStore.ensureFiles();
});

const authFileMap = computed(() => {
  const map = new Map<string, CredentialInfo>();
  (authFiles.value ?? []).forEach((file: AuthFileItem) => {
    const rawAuthIndex = file.auth_index ?? file.authIndex;
    const key = normalizeAuthIndex(rawAuthIndex);
    if (key) {
      map.set(key, {
        name: file.name || key,
        type: (file.type || file.provider || "").toString(),
      });
    }
  });
  return map;
});

type CredentialRow = {
  key: string;
  displayName: string;
  type: string;
  success: number;
  failure: number;
  total: number;
  successRate: number;
};

type CredentialBucket = {
  success: number;
  failure: number;
};

const rows = computed<CredentialRow[]>(() => {
  const details = collectUsageDetails(usageRaw.value);
  if (!details.length) return [];

  const bySource: Record<string, CredentialBucket> = {};
  const result: CredentialRow[] = [];
  const consumedSourceIds = new Set<string>();
  const authIndexToRowIndex = new Map<string, number>();
  const sourceToAuthIndex = new Map<string, string>();
  const fallbackByAuthIndex = new Map<string, CredentialBucket>();

  details.forEach((detail) => {
    const authIdx = normalizeAuthIndex(detail.auth_index);
    const source = detail.source;
    const isFailed = detail.failed === true;

    if (!source) {
      if (!authIdx) return;
      const fallback = fallbackByAuthIndex.get(authIdx) ?? { success: 0, failure: 0 };
      if (isFailed) {
        fallback.failure += 1;
      } else {
        fallback.success += 1;
      }
      fallbackByAuthIndex.set(authIdx, fallback);
      return;
    }

    const bucket = bySource[source] ?? { success: 0, failure: 0 };
    if (isFailed) {
      bucket.failure += 1;
    } else {
      bucket.success += 1;
    }
    bySource[source] = bucket;

    if (authIdx && !sourceToAuthIndex.has(source)) {
      sourceToAuthIndex.set(source, authIdx);
    }
  });

  const mergeBucketToRow = (index: number, bucket: CredentialBucket) => {
    const target = result[index];
    if (!target) return;
    target.success += bucket.success;
    target.failure += bucket.failure;
    target.total = target.success + target.failure;
    target.successRate = target.total > 0 ? (target.success / target.total) * 100 : 100;
  };

  const configList = Array.isArray(configs.value) ? configs.value : [];
  configList.forEach((config, i) => {
    const candidates = buildCandidateUsageSourceIds({ apiKey: config.apiKey, prefix: config.prefix });
    let success = 0;
    let failure = 0;
    candidates.forEach((id) => {
      const bucket = bySource[id];
      if (bucket) {
        success += bucket.success;
        failure += bucket.failure;
        consumedSourceIds.add(id);
      }
    });
    const total = success + failure;
    if (total > 0) {
      result.push({
        key: `codex:${i}`,
        displayName: config.prefix?.trim() || `Codex #${i + 1}`,
        type: "codex",
        success,
        failure,
        total,
        successRate: (success / total) * 100,
      });
    }
  });

  const sourceInfoMap = buildSourceInfoMap(configList);

  Object.entries(bySource).forEach(([key, bucket]) => {
    if (consumedSourceIds.has(key)) return;
    const total = bucket.success + bucket.failure;
    const authIdx = sourceToAuthIndex.get(key);
    const info = resolveSourceDisplay(key, authIdx, sourceInfoMap, authFileMap.value);
    const rowIndex = result.push({
      key,
      displayName: info.displayName,
      type: info.type,
      success: bucket.success,
      failure: bucket.failure,
      total,
      successRate: total > 0 ? (bucket.success / total) * 100 : 100,
    }) - 1;
    if (authIdx && !authIndexToRowIndex.has(authIdx)) {
      authIndexToRowIndex.set(authIdx, rowIndex);
    }
  });

  fallbackByAuthIndex.forEach((bucket, authIdx) => {
    if (bucket.success + bucket.failure === 0) return;

    let targetRowIndex = authIndexToRowIndex.get(authIdx);
    if (targetRowIndex === undefined) {
      const mapped = authFileMap.value.get(authIdx);
      if (mapped) {
        const matchedIndex = result.findIndex(
          (row) => row.displayName === mapped.name && row.type === mapped.type,
        );
        if (matchedIndex >= 0) {
          targetRowIndex = matchedIndex;
          authIndexToRowIndex.set(authIdx, matchedIndex);
        }
      }
    }

    if (targetRowIndex !== undefined) {
      mergeBucketToRow(targetRowIndex, bucket);
      return;
    }

    const total = bucket.success + bucket.failure;
    const mapped = authFileMap.value.get(authIdx);
    const rowIndex = result.push({
      key: `auth:${authIdx}`,
      displayName: mapped?.name || authIdx,
      type: mapped?.type || "",
      success: bucket.success,
      failure: bucket.failure,
      total,
      successRate: (bucket.success / total) * 100,
    }) - 1;
    authIndexToRowIndex.set(authIdx, rowIndex);
  });

  return result.sort((a, b) => b.total - a.total);
});

const isLoading = computed(() => usageLoading.value);
</script>

<template>
  <BaseCard title="凭证统计" description="按密钥/前缀聚合成功率">

    <div v-if="isLoading && rows.length === 0" class="empty-state keep-height">
      <p class="empty-text">加载中...</p>
    </div>

    <div v-else-if="rows.length === 0" class="empty-state">
      <p class="empty-text">暂无数据</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>凭证</th>
            <th>请求数</th>
            <th>成功率</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <td class="credential-cell">
              <span>{{ row.displayName }}</span>
              <span v-if="row.type" class="credential-type">{{ row.type }}</span>
            </td>
            <td>
              <span class="request-count">
                <span>{{ formatCompactNumber(row.total) }}</span>
                <span class="request-breakdown">
                  (<span class="stat-success">{{ row.success.toLocaleString() }}</span>
                  <span class="stat-failure">{{ row.failure.toLocaleString() }}</span>)
                </span>
              </span>
            </td>
            <td>
              <span :class="row.successRate >= 95 ? 'stat-success' : row.successRate >= 80 ? 'stat-neutral' : 'stat-failure'">
                {{ row.successRate.toFixed(1) }}%
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </BaseCard>
</template>

<style scoped>
.empty-state {
  padding: 16px 0;
  text-align: center;
}

.keep-height {
  min-height: 120px;
}

.empty-text {
  font-size: 13px;
  color: var(--zinc-500);
}

.table-wrapper {
  overflow-x: auto;
  max-height: 320px;
  overflow-y: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.table thead th {
  text-align: left;
  color: var(--zinc-500);
  font-weight: 600;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--zinc-100);
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}

.table tbody td {
  padding: 10px 0;
  border-bottom: 1px solid var(--zinc-50);
  color: var(--zinc-700);
}

.credential-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.credential-type {
  font-size: 10px;
  color: var(--zinc-500);
  background: var(--zinc-100);
  padding: 2px 6px;
  border-radius: 999px;
  text-transform: uppercase;
}

.request-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.request-breakdown {
  color: var(--zinc-400);
  font-size: 11px;
}

.stat-success {
  color: var(--green-600);
}

.stat-neutral {
  color: #d97706;
}

.stat-failure {
  color: var(--red-600);
}
</style>
