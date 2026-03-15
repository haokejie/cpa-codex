<script setup lang="ts">
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
            <div class="auto-hero-title">
              自动扫描
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
            </div>
            <div class="auto-hero-desc">{{ autoStatusText }}</div>
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

        <div class="auto-config-grid">
          <div class="auto-config-item">
            <div class="auto-config-label">并发数量</div>
            <input v-model="autoConcurrencyInput" type="number" min="1" max="50" :disabled="autoIsActive"
              @blur="normalizeAutoInputs" />
            <div class="auto-config-hint">同时检测的账号数量</div>
          </div>
          <div class="auto-config-item">
            <div class="auto-config-label">批次间隔 (ms)</div>
            <input v-model="autoBatchDelayInput" type="number" min="0" max="60000" :disabled="autoIsActive"
              @blur="normalizeAutoInputs" />
            <div class="auto-config-hint">每批检测之间的等待时间</div>
          </div>
          <div class="auto-config-item">
            <div class="auto-config-label">检查间隔（分钟）</div>
            <input v-model="autoIntervalInput" type="number" min="1" max="1440" :disabled="autoIsActive"
              @blur="normalizeAutoInputs" />
            <div class="auto-config-hint">两次自动扫描的间隔</div>
          </div>
        </div>

        <div v-if="autoHasLivePanel" class="auto-live">
          <div v-if="autoRunStatus === 'scanning' || autoRunStatus === 'pausing' || autoPausedFrom === 'scanning'"
            class="progress-area">
            <div class="progress-track">
              <div class="progress-fill"
                :style="{ width: Math.round((autoScanProcessed / Math.max(1, autoScanTotal)) * 100) + '%' }"></div>
            </div>
            <div class="progress-text">
              正在检测 {{ autoScanProcessed }}/{{ autoScanTotal }}
            </div>
          </div>

          <div v-else-if="autoRunStatus === 'deleting' || autoPausedFrom === 'deleting'" class="progress-area">
            <div class="progress-track">
              <div class="progress-fill"
                :style="{ width: Math.round((autoDeleteProcessed / Math.max(1, autoDeleteTotal)) * 100) + '%' }"></div>
            </div>
            <div class="progress-text">
              正在删除 {{ autoDeleteProcessed }}/{{ autoDeleteTotal }}
            </div>
          </div>

          <div v-else-if="autoRunStatus === 'waiting' || autoPausedFrom === 'waiting'" class="countdown">
            <span class="countdown-value">{{ formatCountdown(autoCountdown) }}</span>
            <span class="countdown-label">下次检查倒计时</span>
          </div>
        </div>

        <div v-if="autoLastResult" class="auto-result">
          <div class="stat-card">
            <div class="stat-value">{{ autoLastResult.scanned }}</div>
            <div class="stat-label">扫描数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value danger">{{ autoLastResult.deleted }}</div>
            <div class="stat-label">清理数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value success">{{ autoLastResult.scanned - autoLastResult.deleted }}</div>
            <div class="stat-label">正常</div>
          </div>
          <div v-if="autoLastDurationMs" class="auto-duration">
            耗时 {{ (autoLastDurationMs / 1000).toFixed(1) }}s
          </div>
        </div>

        <details v-if="autoHistory.length" class="auto-history">
          <summary class="history-title">
            执行历史 <span class="history-count">{{ autoHistory.length }}</span>
          </summary>
          <table class="history-table">
            <thead>
              <tr>
                <th>执行时间</th>
                <th>扫描数</th>
                <th>清理数</th>
                <th>耗时</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in autoHistory" :key="entry.timestamp">
                <td>{{ new Date(entry.timestamp).toLocaleTimeString() }}</td>
                <td>{{ entry.scanned }}</td>
                <td>{{ entry.deleted }}</td>
                <td>{{ (entry.durationMs / 1000).toFixed(1) }}s</td>
              </tr>
            </tbody>
          </table>
        </details>
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
  text-align: center;
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

.auto-hero-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--zinc-900);
  display: inline-flex;
  align-items: center;
  gap: 10px;
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
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--zinc-200);
  color: var(--zinc-600);
  background: var(--zinc-50);
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

.auto-config-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.auto-config-item {
  padding: 12px;
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auto-config-label {
  font-size: 12px;
  color: var(--zinc-600);
}

.auto-config-item input {
  padding: 6px 8px;
  border: 1px solid var(--zinc-200);
  border-radius: 6px;
  font-size: 12px;
  color: var(--zinc-700);
}

.auto-config-hint {
  font-size: 11px;
  color: var(--zinc-400);
}

.auto-live {
  padding: 12px;
  border: 1px dashed var(--zinc-200);
  border-radius: 10px;
  background: var(--zinc-50);
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.auto-duration {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--zinc-500);
}

.auto-history {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  padding: 12px;
  background: #fff;
}

.history-title {
  font-size: 12px;
  color: var(--zinc-600);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.history-count {
  background: var(--zinc-100);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--zinc-600);
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: var(--zinc-600);
  margin-top: 8px;
}

.history-table th,
.history-table td {
  text-align: left;
  padding: 6px 0;
  border-bottom: 1px solid var(--zinc-100);
}

.history-table tr:last-child td {
  border-bottom: none;
}

@media (max-width: 900px) {
  .auto-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .auto-hero-actions {
    width: 100%;
  }

  .auto-config-grid {
    grid-template-columns: 1fr;
  }
}
</style>