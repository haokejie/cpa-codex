<script setup lang="ts">
import { ref, computed } from "vue";
import BaseCard from "./BaseCard.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { useCodexMonitorState } from "../stores/codexMonitorState";

const monitor = useCodexMonitorState();

const {
  activeTab,
  scanStatus,
  scanStartInput,
  batchSizeInput,
  scanTotal,
  scanProcessed,
  remaining,
  progressPercent,
  cleanableAccounts,
  healthyCount,
  skippedCount,
  fetchingFiles,
  totalCount,
  resultMessage,
  resultMessageType,
  poolWarning,
  scanResults,
  showList,
  selectedNames,
  selectedCount,
  isDeleting,
  deleteProgress,
  autoEnabled,
  autoIsActive,
  manualBusy,
  autoStatusText,
  autoRunStatus,
  autoHasLivePanel,
  autoScanProcessed,
  autoScanTotal,
  autoDeleteProcessed,
  autoDeleteTotal,
  autoCountdown,
  autoLastResult,
  autoLastDurationMs,
  autoHistory,
  autoPausedFrom,
  autoConcurrencyInput,
  autoBatchDelayInput,
  autoIntervalInput,
  autoConfigRef,
  confirmOpen,
  confirmMessage,
  autoStopConfirmOpen,
  autoStopConfirmMessage,
} = monitor;

const stopScan = () => monitor.stopScan();
const startScan = () => monitor.startScan();
const toggleSelect = (name: string) => monitor.toggleSelect(name);
const selectAll = () => monitor.selectAll();
const deselectAll = () => monitor.deselectAll();
const requestDelete = (names: string[], source: "selected" | "all") =>
  monitor.requestDelete(names, source);
const handleAutoPause = () => monitor.handleAutoPause();
const handleAutoResume = () => monitor.handleAutoResume();
const confirmDelete = () => monitor.confirmDelete();
const cancelDelete = () => monitor.cancelDelete();
const requestAutoStop = () => monitor.requestAutoStop();
const confirmAutoStop = () => monitor.confirmAutoStop();
const cancelAutoStop = () => monitor.cancelAutoStop();
const normalizeAutoInputs = () => monitor.normalizeAutoInputs();
const formatCountdown = (sec: number) => monitor.formatCountdown(sec);

const autoConfigOpen = ref(false);
const autoConfigConcurrencyDraft = ref("");
const autoConfigBatchDelayDraft = ref("");
const autoConfigIntervalDraft = ref("");

const autoHistoryOpen = ref(false);

const autoTotalDeleted = computed(() =>
  autoHistory.value.reduce((sum: number, h: { deleted: number }) => sum + h.deleted, 0)
);

const autoScanPercent = computed(() =>
  autoScanTotal.value > 0 ? Math.round((autoScanProcessed.value / autoScanTotal.value) * 100) : 0
);

const autoDeletePercent = computed(() =>
  autoDeleteTotal.value > 0 ? Math.round((autoDeleteProcessed.value / autoDeleteTotal.value) * 100) : 0
);

const openAutoConfig = () => {
  autoConfigConcurrencyDraft.value = autoConcurrencyInput.value;
  autoConfigBatchDelayDraft.value = autoBatchDelayInput.value;
  autoConfigIntervalDraft.value = autoIntervalInput.value;
  autoConfigOpen.value = true;
};

const closeAutoConfig = () => {
  autoConfigOpen.value = false;
};

const saveAutoConfig = () => {
  if (autoIsActive.value) return;
  autoConcurrencyInput.value = autoConfigConcurrencyDraft.value;
  autoBatchDelayInput.value = autoConfigBatchDelayDraft.value;
  autoIntervalInput.value = autoConfigIntervalDraft.value;
  normalizeAutoInputs();
  autoConfigOpen.value = false;
};
</script>

<template>
  <BaseCard title="Codex 监控" description="检测失效账号并批量清理" headerGap="lg">
    <div class="monitor-body">
      <div class="tab-bar">
        <button class="tab-btn" :class="{ active: activeTab === 'auto' }" @click="activeTab = 'auto'">
          自动扫描
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'manual' }" @click="activeTab = 'manual'">
          手动扫描
        </button>
      </div>

      <div v-if="activeTab === 'manual'" class="summary">
        <div class="stat-card">
          <div class="stat-value">{{ totalCount }}</div>
          <div class="stat-label">账号总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value danger">
            {{ scanStatus === "idle" ? "-" : cleanableAccounts.length }}
          </div>
          <div class="stat-label">待清理</div>
        </div>
        <div class="stat-card">
          <div class="stat-value success">
            {{ scanStatus === "idle" ? "-" : (healthyCount ?? 0) }}
          </div>
          <div class="stat-label">正常</div>
        </div>
        <div class="stat-card">
          <div class="stat-value muted">
            {{ scanStatus === "idle" ? "-" : skippedCount }}
          </div>
          <div class="stat-label">跳过</div>
        </div>
      </div>

      <div v-if="activeTab === 'manual'" class="scan-controls">
        <div class="scan-actions">
          <button v-if="scanStatus === 'scanning'" class="btn-ghost btn-sm" @click="stopScan">
            停止
          </button>
          <button v-else-if="scanStatus === 'stopping'" class="btn-ghost btn-sm" disabled>
            停止中...
          </button>
          <button v-else class="btn-ghost btn-sm btn-primary" @click="startScan" :disabled="autoIsActive">
            {{ scanStatus === "done" ? "重新检测" : "开始检测" }}
          </button>

          <div class="scan-field">
            <span class="scan-label">从第</span>
            <input v-model="scanStartInput" class="scan-input" type="number" min="1" :max="totalCount"
              :disabled="scanStatus === 'scanning' || scanStatus === 'stopping'" placeholder="1" />
            <span class="scan-hint">/ {{ totalCount }}</span>
          </div>

          <div class="scan-field">
            <span class="scan-label">并发数</span>
            <input v-model="batchSizeInput" class="scan-input" type="number" min="1" max="50"
              :disabled="scanStatus === 'scanning' || scanStatus === 'stopping' || autoIsActive" />
          </div>

          <span v-if="scanStatus === 'done'" class="scan-done">
            检测完成：共 {{ scanTotal }} 个账号，发现 {{ cleanableAccounts.length }} 个过期
          </span>
        </div>

        <div v-if="scanStatus === 'scanning' || scanStatus === 'stopping'" class="progress-area">
          <div v-if="fetchingFiles" class="progress-text">正在获取账号列表...</div>
          <div v-else class="progress-wrap">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              正在检测 {{ scanProcessed }}/{{ scanTotal }}，剩余 {{ remaining }} 个
            </div>
          </div>
        </div>
      </div>

      <div v-if="resultMessage" class="result-banner" :class="`result-${resultMessageType}`">
        {{ resultMessage }}
      </div>
      <div v-if="poolWarning" class="result-banner result-warning">
        {{ poolWarning }}
      </div>

      <div v-if="activeTab === 'manual' && scanStatus === 'done'" class="scan-result">
        <div v-if="scanResults.length === 0" class="empty-result">
          <span class="empty-icon">✓</span>
          <span>所有账号均正常</span>
        </div>
        <div v-else class="result-panel">
          <div class="result-header">
            <div class="result-title">
              扫描结果
              <span class="result-count">待清理 {{ cleanableAccounts.length }}</span>
              <span class="result-count result-count-muted">跳过 {{ skippedCount }}</span>
            </div>
            <div class="result-actions">
              <button class="btn-ghost btn-sm" @click="showList = !showList">
                {{ showList ? "收起列表" : "展开列表" }}
              </button>
              <button class="btn-ghost btn-sm" @click="selectAll"
                :disabled="cleanableAccounts.length === 0 || selectedCount === cleanableAccounts.length">
                全选
              </button>
              <button class="btn-ghost btn-sm" @click="deselectAll" :disabled="selectedCount === 0">
                取消全选
              </button>
              <button class="btn-ghost btn-sm btn-danger" :disabled="selectedCount === 0 || isDeleting"
                @click="requestDelete(Array.from(selectedNames), 'selected')">
                删除选中 ({{ selectedCount }})
              </button>
              <button class="btn-ghost btn-sm btn-danger" :disabled="isDeleting || cleanableAccounts.length === 0"
                @click="requestDelete(cleanableAccounts.map((item) => item.file.name), 'all')">
                一键删除全部
              </button>
            </div>
          </div>

          <div v-if="deleteProgress" class="progress-area">
            <div class="progress-track">
              <div class="progress-fill"
                :style="{ width: Math.round((deleteProgress.done / deleteProgress.total) * 100) + '%' }"></div>
            </div>
            <div class="progress-text">
              正在删除 {{ deleteProgress.done }}/{{ deleteProgress.total }}
            </div>
          </div>

          <div v-if="showList" class="account-list">
            <div v-for="item in scanResults" :key="item.file.name" class="account-row" :class="{
              'account-row-selected': selectedNames.has(item.file.name),
              'account-row-skipped': item.status === 'skipped'
            }" @click="item.status === 'expired' && toggleSelect(item.file.name)">
              <input type="checkbox" class="account-checkbox" :checked="selectedNames.has(item.file.name)"
                :disabled="item.status !== 'expired'" readonly />
              <span class="account-name">{{ item.file.name }}</span>
              <span class="reason-badge" :class="item.status === 'expired' ? 'expired' : 'skipped'">
                <template v-if="item.status === 'expired'">Token 过期</template>
                <template v-else>
                  跳过<span v-if="item.statusCode"> (HTTP {{ item.statusCode }})</span>
                </template>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'auto'" class="auto-panel">
        <div class="auto-hero">
          <div class="auto-hero-main">
            <span class="auto-status" :class="{
              'auto-status-on': autoEnabled && autoRunStatus !== 'paused' && autoRunStatus !== 'pausing',
              'auto-status-paused': autoEnabled && (autoRunStatus === 'paused' || autoRunStatus === 'pausing'),
              'auto-status-off': !autoEnabled
            }">
              <span class="auto-status-dot"></span>
              <span v-if="!autoEnabled">未启用</span>
              <span v-else-if="autoRunStatus === 'paused' || autoRunStatus === 'pausing'">已暂停</span>
              <span v-else>运行中</span>
            </span>
            <div class="auto-hero-title">
              自动扫描
              <span v-if="autoEnabled && autoIsActive" class="auto-hero-subtitle">· {{ autoStatusText }}</span>
            </div>
            <div class="auto-hero-meta">已累计清理 {{ autoTotalDeleted }} 个失效账号</div>
          </div>
          <div class="auto-hero-actions">

            <button class="btn-ghost btn-sm" @click="handleAutoPause" v-if="autoEnabled"
              :disabled="!autoIsActive || autoRunStatus === 'pausing' || autoRunStatus === 'paused'">
              {{ autoRunStatus === "pausing" ? "暂停中..." : "暂停" }}
            </button>
            <button class="btn-ghost btn-sm" @click="handleAutoResume" v-if="autoRunStatus === 'paused'">
              继续
            </button>
            <button class="btn-ghost btn-sm btn-primary" @click="autoEnabled ? requestAutoStop() : (autoEnabled = true)"
              :disabled="manualBusy">
              {{ autoEnabled ? "停止自动扫描" : "启动自动扫描" }}
            </button>
          </div>
        </div>

        <div class="auto-config-bar">
          <div class="auto-config-chips">
            <span class="config-chip">并发 {{ autoConfigRef.concurrency }}</span>
            <span class="config-sep"></span>
            <span class="config-chip">批次 {{ autoConfigRef.batchDelayMs }}ms</span>
            <span class="config-sep"></span>
            <span class="config-chip">间隔 {{ autoConfigRef.intervalMin }} 分钟</span>
          </div>
          <button class="btn-ghost btn-sm" @click="openAutoConfig">
            {{ autoIsActive ? "查看配置" : "修改配置" }}
          </button>
        </div>

        <div v-if="autoConfigOpen" class="mask">
          <div class="dialog auto-config-dialog">
            <div class="dialog-header">
              <h3 class="dialog-title">自动扫描配置</h3>
              <p class="dialog-subtitle">修改后将在下一轮扫描生效</p>
            </div>
            <div class="dialog-body">
              <div class="auto-config-form">
                <div class="auto-config-field">
                  <div class="auto-config-label">并发数量</div>
                  <input v-model="autoConfigConcurrencyDraft" type="number" min="1" max="50" :disabled="autoIsActive" />
                  <div class="auto-config-hint">同时检测的账号数量</div>
                </div>
                <div class="auto-config-field">
                  <div class="auto-config-label">批次间隔 (ms)</div>
                  <input v-model="autoConfigBatchDelayDraft" type="number" min="0" max="60000" :disabled="autoIsActive" />
                  <div class="auto-config-hint">每批检测之间的等待时间</div>
                </div>
                <div class="auto-config-field">
                  <div class="auto-config-label">检查间隔（分钟）</div>
                  <input v-model="autoConfigIntervalDraft" type="number" min="1" max="1440" :disabled="autoIsActive" />
                  <div class="auto-config-hint">两次自动扫描的间隔</div>
                </div>
              </div>
              <div v-if="autoIsActive" class="auto-config-note">自动扫描运行中，暂停后可修改配置。</div>
            </div>
            <div class="dialog-footer">
              <button class="btn-ghost" @click="closeAutoConfig">取消</button>
              <button class="btn-ghost btn-primary" :disabled="autoIsActive" @click="saveAutoConfig">保存配置</button>
            </div>
          </div>
        </div>

        <div v-if="autoHasLivePanel" class="auto-live">
          <template v-if="autoRunStatus === 'scanning' || autoRunStatus === 'pausing' || autoPausedFrom === 'scanning'">
            <div class="live-label-row">
              <span class="live-label">扫描进度</span>
              <span class="live-count">{{ autoScanProcessed }} / {{ autoScanTotal }}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill progress-fill-indigo" :style="{ width: autoScanPercent + '%' }"></div>
            </div>
            <div class="live-meta-row">
              <span class="live-percent">{{ autoScanPercent }}%</span>
              <span class="live-remaining">剩余 {{ Math.max(0, autoScanTotal - autoScanProcessed) }} 个</span>
            </div>
          </template>

          <template v-else-if="autoRunStatus === 'deleting' || autoPausedFrom === 'deleting'">
            <div class="live-label-row">
              <span class="live-label">删除进度</span>
              <span class="live-count live-count-orange">{{ autoDeleteProcessed }} / {{ autoDeleteTotal }}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill progress-fill-orange" :style="{ width: autoDeletePercent + '%' }"></div>
            </div>
            <div class="live-meta-row">
              <span class="live-percent">{{ autoDeletePercent }}%</span>
              <span class="live-remaining">剩余 {{ Math.max(0, autoDeleteTotal - autoDeleteProcessed) }} 个</span>
            </div>
          </template>

          <template v-else-if="autoRunStatus === 'waiting' || autoPausedFrom === 'waiting'">
            <div class="countdown">
              <span class="countdown-value">{{ formatCountdown(autoCountdown) }}</span>
              <span class="countdown-label">下次检查倒计时</span>
            </div>
          </template>
        </div>

        <template v-if="autoLastResult">
          <div class="section-label-row">
            <span class="section-label">上次结果</span>
            <span v-if="autoLastDurationMs" class="section-meta">耗时 {{ (autoLastDurationMs / 1000).toFixed(1) }}s</span>
          </div>
          <div class="auto-result">
            <div class="stat-card">
              <div class="stat-icon stat-icon-default">⟳</div>
              <div class="stat-value">{{ autoLastResult.scanned }}</div>
              <div class="stat-label">扫描账号数</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-danger">✕</div>
              <div class="stat-value danger">{{ autoLastResult.deleted }}</div>
              <div class="stat-label">清理账号数</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-success">✓</div>
              <div class="stat-value success">{{ autoLastResult.scanned - autoLastResult.deleted }}</div>
              <div class="stat-label">正常账号数</div>
            </div>
          </div>
        </template>

        <div v-if="autoHistory.length" class="auto-history">
          <div class="history-header" @click="autoHistoryOpen = !autoHistoryOpen">
            <div class="history-header-left">
              <span class="history-title">执行历史</span>
              <span class="history-count">{{ autoHistory.length }}</span>
            </div>
            <span class="history-toggle">{{ autoHistoryOpen ? '收起 ▲' : '展开 ▼' }}</span>
          </div>
          <template v-if="autoHistoryOpen">
            <table class="history-table">
              <thead>
                <tr>
                  <th>执行时间</th>
                  <th>扫描数</th>
                  <th>清理数</th>
                  <th>正常</th>
                  <th>耗时</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entry, idx) in autoHistory" :key="entry.timestamp"
                  :class="{ 'history-row-latest': idx === 0 }">
                  <td class="history-time">{{ new Date(entry.timestamp).toLocaleTimeString() }}</td>
                  <td>{{ entry.scanned }}</td>
                  <td :class="entry.deleted > 0 ? 'history-deleted' : ''">{{ entry.deleted }}</td>
                  <td :class="(entry.scanned - entry.deleted) > 0 ? 'history-healthy' : ''">{{ entry.scanned - entry.deleted }}</td>
                  <td class="history-muted">{{ (entry.durationMs / 1000).toFixed(1) }}s</td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>
      </div>
    </div>
  </BaseCard>

  <ConfirmDialog :open="confirmOpen" title="确认删除" :message="confirmMessage" :loading="isDeleting"
    @confirm="confirmDelete" @cancel="cancelDelete" />

  <ConfirmDialog :open="autoStopConfirmOpen" title="确认停止" :message="autoStopConfirmMessage" @confirm="confirmAutoStop"
    @cancel="cancelAutoStop" />
</template>

<style scoped>
.monitor-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tab-bar {
  display: flex;
  gap: 8px;
}

.tab-btn {
  border: 1px solid var(--zinc-200);
  background: #fff;
  color: var(--zinc-600);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.tab-btn.active {
  background: var(--zinc-900);
  color: #fff;
  border-color: var(--zinc-900);
}

.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  background: var(--zinc-50);
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  padding: 12px;
  text-align: left;
  position: relative;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--zinc-900);
}

.stat-value.danger {
  color: #dc2626;
}

.stat-value.success {
  color: #16a34a;
}

.stat-value.muted {
  color: var(--zinc-500);
}

.stat-label {
  font-size: 12px;
  color: var(--zinc-500);
  margin-top: 4px;
}

.scan-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  background: #fff;
}

.scan-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.scan-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--zinc-600);
}

.scan-label {
  color: var(--zinc-500);
}

.scan-input {
  width: 72px;
  padding: 4px 8px;
  border: 1px solid var(--zinc-200);
  border-radius: 6px;
  font-size: 12px;
  color: var(--zinc-700);
}

.scan-hint {
  color: var(--zinc-400);
}

.scan-done {
  font-size: 12px;
  color: var(--zinc-500);
}

.progress-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-track {
  height: 8px;
  background: var(--zinc-100);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #3b82f6);
  transition: width 0.2s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--zinc-500);
}

.result-banner {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  border: 1px solid transparent;
}

.result-success {
  background: #ecfdf3;
  color: #15803d;
  border-color: #bbf7d0;
}

.result-warning {
  background: #fff7ed;
  color: #c2410c;
  border-color: #fed7aa;
}

.scan-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: 10px;
  background: #f0fdf4;
  color: #15803d;
  font-size: 13px;
}

.empty-icon {
  font-weight: 700;
}

.result-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--zinc-800);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.result-count {
  background: var(--zinc-100);
  color: var(--zinc-700);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
}

.result-count-muted {
  background: var(--zinc-50);
  color: var(--zinc-500);
}

.result-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.account-list {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  overflow: hidden;
}

.account-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--zinc-100);
  cursor: pointer;
  background: #fff;
}

.account-row:last-child {
  border-bottom: none;
}

.account-row-selected {
  background: var(--zinc-50);
}

.account-row-skipped {
  opacity: 0.7;
  cursor: default;
}

.account-checkbox {
  pointer-events: none;
}

.account-name {
  font-size: 12px;
  color: var(--zinc-700);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reason-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.reason-badge.expired {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}

.reason-badge.error {
  background: #fff7ed;
  color: #c2410c;
  border-color: #fed7aa;
}

.reason-badge.skipped {
  background: var(--zinc-100);
  color: var(--zinc-600);
  border-color: var(--zinc-200);
}

.btn-ghost {
  background: none;
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  color: var(--zinc-600);
  font-family: inherit;
  cursor: pointer;
  padding: 6px 10px;
}

.btn-ghost:hover:not(:disabled) {
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
  height: 28px;
}

.btn-primary {
  background: var(--zinc-900);
  color: #fff;
  border-color: var(--zinc-900);
}

.btn-primary:hover:not(:disabled) {
  background: var(--zinc-800);
  border-color: var(--zinc-800);
  color: #fff;
}

.btn-danger {
  border-color: #fecaca;
  color: #dc2626;
}

.btn-danger:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #b91c1c;
}

.auto-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auto-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--zinc-200);
  border-radius: 12px;
  background: #fff;
}

.auto-hero-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.auto-hero-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--zinc-900);
  display: flex;
  align-items: center;
  gap: 6px;
}

.auto-hero-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--zinc-500);
}

.auto-hero-meta {
  font-size: 12px;
  color: var(--zinc-400);
}

.auto-hero-desc {
  font-size: 12px;
  color: var(--zinc-500);
  margin-top: 4px;
}

.auto-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--zinc-200);
  color: var(--zinc-600);
  background: var(--zinc-50);
  width: fit-content;
}

.auto-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--zinc-400);
}

.auto-status-on {
  color: #0f766e;
  border-color: #99f6e4;
  background: #f0fdfa;
}

.auto-status-on .auto-status-dot {
  background: #14b8a6;
}

.auto-status-paused {
  color: #b45309;
  border-color: #fde68a;
  background: #fffbeb;
}

.auto-status-paused .auto-status-dot {
  background: #f59e0b;
}

.auto-status-off {
  color: var(--zinc-500);
  border-color: var(--zinc-200);
  background: var(--zinc-50);
}

.auto-hero-actions {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}

.auto-config-bar {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  background: #FAFAFA;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.auto-config-chips {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
  gap: 6px;
}

.config-chip {
  font-size: 11px;
  color: var(--zinc-600);
  background: var(--zinc-100);
  border-radius: 6px;
  padding: 2px 8px;
}

.config-sep {
  width: 1px;
  height: 14px;
  background: var(--zinc-200);
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

.dialog-subtitle {
  font-size: 12px;
  color: #71717A;
  margin-top: 6px;
}

.dialog-body {
  padding: 12px 20px 16px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 20px;
}

.auto-config-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auto-config-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auto-config-field input {
  padding: 6px 8px;
  border: 1px solid var(--zinc-200);
  border-radius: 6px;
  font-size: 12px;
  color: var(--zinc-700);
}

.auto-config-note {
  margin-top: 12px;
  font-size: 12px;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  padding: 8px 10px;
  border-radius: 8px;
}

.auto-live {
  padding: 14px 16px;
  border: 1px dashed var(--zinc-200);
  border-radius: 10px;
  background: var(--zinc-50);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.live-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.live-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--zinc-600);
}

.live-count {
  font-size: 12px;
  font-weight: 600;
  color: #6366F1;
}

.live-count-orange {
  color: #F97316;
}

.live-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.live-percent {
  font-size: 11px;
  color: var(--zinc-500);
}

.live-remaining {
  font-size: 11px;
  color: var(--zinc-400);
}

.progress-fill-indigo {
  height: 100%;
  background: linear-gradient(90deg, #818CF8, #6366F1);
  border-radius: 999px;
  transition: width 0.2s ease;
}

.progress-fill-orange {
  height: 100%;
  background: linear-gradient(90deg, #FB923C, #F97316);
  border-radius: 999px;
  transition: width 0.2s ease;
}

.countdown {
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--zinc-600);
  font-size: 12px;
}

.countdown-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--zinc-800);
}

.auto-result {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.section-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--zinc-500);
}

.section-meta {
  font-size: 11px;
  color: var(--zinc-400);
}

.stat-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.stat-icon-default {
  background: var(--zinc-100);
  color: var(--zinc-500);
}

.stat-icon-danger {
  background: #FEF2F2;
  color: #DC2626;
}

.stat-icon-success {
  background: #F0FDF4;
  color: #16A34A;
}

.auto-history {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
}

.history-header:hover {
  background: var(--zinc-50);
}

.history-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.history-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--zinc-600);
}

.history-toggle {
  font-size: 11px;
  color: var(--zinc-400);
}

.history-count {
  background: var(--zinc-100);
  border-radius: 5px;
  padding: 1px 7px;
  font-size: 11px;
  color: var(--zinc-600);
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: var(--zinc-600);
}

.history-table th,
.history-table td {
  text-align: left;
  padding: 7px 14px;
  border-bottom: 1px solid var(--zinc-100);
}

.history-table th {
  font-size: 11px;
  color: var(--zinc-400);
  font-weight: 500;
  background: var(--zinc-50);
  border-top: 1px solid var(--zinc-100);
}

.history-table tr:last-child td {
  border-bottom: none;
}

.history-row-latest td {
  background: #FAFAFA;
}

.history-time {
  font-family: "SF Mono", "JetBrains Mono", monospace;
  color: var(--zinc-500);
}

.history-deleted {
  color: #DC2626;
  font-weight: 500;
}

.history-healthy {
  color: #16A34A;
  font-weight: 500;
}

.history-muted {
  color: var(--zinc-400);
}

@media (max-width: 900px) {
  .auto-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .auto-hero-actions {
    width: 100%;
  }
}
</style>
