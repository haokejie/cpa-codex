import { computed, effectScope, ref, watch, type ComputedRef } from "vue";
import type { AuthFileItem } from "../types";
import { useAuthFilesStore } from "./authFiles";
import { deleteAuthFile, listAuthFiles } from "../api/authFiles";
import { getCodexQuotaByAuthIndex } from "../api/codex";
import { normalizeAuthIndex } from "../utils/usage";
import { resolveCodexChatgptAccountId } from "../utils/codexQuota";

type CleanableReason = "expired" | "error";
type ScanStatus = "idle" | "scanning" | "stopping" | "done";
type AutoRunStatus = "idle" | "scanning" | "deleting" | "waiting" | "pausing" | "paused";
type AutoPausedFrom = "scanning" | "deleting" | "waiting";

type ScanResult = {
  file: AuthFileItem;
  status: "expired" | "skipped";
  statusCode?: number | null;
};

type ScanOutcome =
  | { kind: "ok" }
  | { kind: "expired"; statusCode?: number | null }
  | { kind: "skipped"; statusCode?: number | null };

const DEFAULT_BATCH_SIZE = 9;
const BATCH_DELAY_MS = 2000;
const DELETE_BATCH_SIZE = 10;
const DELETE_BATCH_DELAY_MS = 300;
const DEFAULT_AUTO_INTERVAL_MIN = 60;
const AUTO_HISTORY_MAX = 10;

class CodexMonitorState {
  static instance: CodexMonitorState | null = null;

  static getInstance() {
    if (!CodexMonitorState.instance) {
      CodexMonitorState.instance = new CodexMonitorState();
    }
    return CodexMonitorState.instance;
  }

  private authFilesStore = useAuthFilesStore();
  private scope = effectScope(true);

  activeTab = ref<"manual" | "auto">("auto");

  monitorFiles = ref<AuthFileItem[]>([]);
  monitorFilesBackup = ref<AuthFileItem[]>([]);
  poolWarning = ref("");

  scanStatus = ref<ScanStatus>("idle");
  scanProcessed = ref(0);
  scanTotal = ref(0);
  scanResults = ref<ScanResult[]>([]);
  selectedNames = ref<Set<string>>(new Set());
  showList = ref(false);
  fetchingFiles = ref(false);
  refreshing = ref(false);

  scanStartInput = ref("");
  batchSizeInput = ref(String(DEFAULT_BATCH_SIZE));

  isDeleting = ref(false);
  deleteProgress = ref<{ done: number; total: number } | null>(null);
  deleteSource = ref<"selected" | "all" | null>(null);

  confirmOpen = ref(false);
  confirmMessage = ref("");
  pendingDeleteNames = ref<string[]>([]);

  autoStopConfirmOpen = ref(false);
  autoStopConfirmMessage = ref("确认停止自动扫描？停止后需手动重新启动。");

  resultMessage = ref("");
  resultMessageType = ref<"success" | "warning" | "">("");

  abortRef = ref(false);

  autoEnabled = ref(false);
  autoRunStatus = ref<AutoRunStatus>("idle");
  autoCountdown = ref(0);
  autoLastResult = ref<{ scanned: number; deleted: number } | null>(null);
  autoScanProcessed = ref(0);
  autoScanTotal = ref(0);
  autoDeleteProcessed = ref(0);
  autoDeleteTotal = ref(0);
  autoCleanableItems = ref<{ name: string; reason: CleanableReason }[]>([]);
  autoHistory = ref<{ timestamp: number; scanned: number; deleted: number; durationMs: number }[]>([]);
  autoLastDurationMs = ref(0);
  autoPausedFrom = ref<AutoPausedFrom | null>(null);

  autoConcurrencyInput = ref(String(DEFAULT_BATCH_SIZE));
  autoBatchDelayInput = ref(String(BATCH_DELAY_MS));
  autoIntervalInput = ref(String(DEFAULT_AUTO_INTERVAL_MIN));

  autoConfigRef = ref({
    concurrency: DEFAULT_BATCH_SIZE,
    batchDelayMs: BATCH_DELAY_MS,
    intervalMin: DEFAULT_AUTO_INTERVAL_MIN,
  });

  autoRunningRef = ref(false);
  autoPausedRef = ref(false);
  autoPauseResolveRef = ref<(() => void) | null>(null);

  codexFiles!: ComputedRef<AuthFileItem[]>;
  totalCount!: ComputedRef<number>;
  remaining!: ComputedRef<number>;
  progressPercent!: ComputedRef<number>;
  cleanableAccounts!: ComputedRef<ScanResult[]>;
  skippedAccounts!: ComputedRef<ScanResult[]>;
  skippedCount!: ComputedRef<number>;
  healthyCount!: ComputedRef<number | null>;
  selectedCount!: ComputedRef<number>;
  autoIsActive!: ComputedRef<boolean>;
  manualBusy!: ComputedRef<boolean>;
  autoStatusText!: ComputedRef<string>;
  autoHasLivePanel!: ComputedRef<boolean>;

  private constructor() {
    this.scope.run(() => {
      this.codexFiles = computed(() =>
        (this.monitorFiles.value ?? []).filter((file) => this.isCodexFile(file) && !this.isRuntimeOnly(file)),
      );
      this.totalCount = computed(() => this.codexFiles.value.length);
      this.remaining = computed(() => Math.max(0, this.scanTotal.value - this.scanProcessed.value));
      this.progressPercent = computed(() =>
        this.scanTotal.value > 0 ? Math.round((this.scanProcessed.value / this.scanTotal.value) * 100) : 0,
      );
      this.cleanableAccounts = computed(() =>
        this.scanResults.value.filter((item) => item.status === "expired"),
      );
      this.skippedAccounts = computed(() =>
        this.scanResults.value.filter((item) => item.status === "skipped"),
      );
      this.skippedCount = computed(() => this.skippedAccounts.value.length);
      this.healthyCount = computed(() =>
        this.scanStatus.value === "idle"
          ? null
          : this.scanProcessed.value - this.cleanableAccounts.value.length - this.skippedCount.value,
      );
      this.selectedCount = computed(() => this.selectedNames.value.size);
      this.autoIsActive = computed(() => this.autoRunStatus.value !== "idle");
      this.manualBusy = computed(
        () => this.scanStatus.value === "scanning" || this.scanStatus.value === "stopping" || this.isDeleting.value,
      );
      this.autoStatusText = computed(() => {
        if (!this.autoEnabled.value) return "自动扫描未启用";
        if (this.autoRunStatus.value === "pausing") return "暂停中...";
        if (this.autoRunStatus.value === "paused") return "已暂停";
        if (this.autoRunStatus.value === "scanning" && this.fetchingFiles.value) return "正在获取账号列表...";
        if (this.autoRunStatus.value === "scanning") return "自动扫描中...";
        if (this.autoRunStatus.value === "deleting") return "自动删除中...";
        if (this.autoRunStatus.value === "waiting") {
          return `下次检查: ${this.formatCountdown(this.autoCountdown.value)}`;
        }
        return "准备中";
      });
      this.autoHasLivePanel = computed(() =>
        this.autoRunStatus.value === "scanning"
        || this.autoRunStatus.value === "deleting"
        || this.autoRunStatus.value === "waiting"
        || this.autoRunStatus.value === "pausing"
        || this.autoRunStatus.value === "paused"
        || Boolean(this.autoPausedFrom.value)
      );

      watch([this.autoConcurrencyInput, this.autoBatchDelayInput, this.autoIntervalInput], () => {
        const concurrency = this.parsePositiveInt(this.autoConcurrencyInput.value, DEFAULT_BATCH_SIZE, 1, 50);
        const batchDelayMs = this.parsePositiveInt(this.autoBatchDelayInput.value, BATCH_DELAY_MS, 0, 60000);
        const intervalMin = this.parsePositiveInt(this.autoIntervalInput.value, DEFAULT_AUTO_INTERVAL_MIN, 1, 1440);
        this.autoConfigRef.value = { concurrency, batchDelayMs, intervalMin };
      });

      watch(this.autoEnabled, (enabled) => {
        if (enabled) {
          this.normalizeAutoInputs();
          this.runAutoLoop();
        } else {
          this.stopAutoLoop();
        }
      });
    });
  }

  private isCodexFile(file: AuthFileItem) {
    return file.type === "codex" || file.provider === "codex";
  }

  private isRuntimeOnly(file: AuthFileItem) {
    return Boolean(file.runtimeOnly);
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  formatCountdown(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  private getStatusFromError(err: unknown): number | null {
    const message = err instanceof Error ? err.message : String(err);
    const match = message.match(/\b(\d{3})\b/);
    if (!match) return null;
    const status = Number(match[1]);
    return Number.isFinite(status) ? status : null;
  }

  private reasonFromStatus(status: number | null): CleanableReason {
    return status === 401 ? "expired" : "error";
  }

  private async checkFile(file: AuthFileItem): Promise<ScanOutcome> {
    const authIndex = normalizeAuthIndex(file.auth_index ?? file.authIndex);
    if (!authIndex) {
      return { kind: "skipped", statusCode: null };
    }
    const accountId = resolveCodexChatgptAccountId(file);
    if (!accountId) {
      return { kind: "skipped", statusCode: null };
    }
    try {
      await getCodexQuotaByAuthIndex(authIndex, accountId);
      return { kind: "ok" };
    } catch (err) {
      const status = this.getStatusFromError(err);
      if (status === 401) {
        return { kind: "expired", statusCode: status };
      }
      return { kind: "skipped", statusCode: status };
    }
  }

  async refreshMonitorPool() {
    this.refreshing.value = true;
    this.poolWarning.value = "";
    try {
      const items = await listAuthFiles();
      const filtered = items.filter((file) => this.isCodexFile(file) && !this.isRuntimeOnly(file));
      if (filtered.length === 0 && this.monitorFilesBackup.value.length > 0) {
        this.poolWarning.value = "账号池为空，已保留上次监控列表";
        this.monitorFiles.value = this.monitorFilesBackup.value;
        return this.monitorFiles.value;
      }
      this.monitorFiles.value = filtered;
      if (filtered.length > 0) {
        this.monitorFilesBackup.value = filtered;
      }
      return filtered;
    } catch (err) {
      if (this.monitorFilesBackup.value.length > 0) {
        this.poolWarning.value = "账号池刷新失败，已使用备份列表";
        this.monitorFiles.value = this.monitorFilesBackup.value;
        return this.monitorFiles.value;
      }
      this.poolWarning.value = err instanceof Error ? err.message : "账号池刷新失败";
      return [];
    } finally {
      this.refreshing.value = false;
    }
  }

  async refreshFiles() {
    await this.refreshMonitorPool();
  }

  async startScan() {
    this.abortRef.value = false;
    this.scanStatus.value = "scanning";
    this.scanProcessed.value = 0;
    this.scanTotal.value = 0;
    this.scanResults.value = [];
    this.selectedNames.value = new Set();
    this.showList.value = false;
    this.resultMessage.value = "";
    this.resultMessageType.value = "";

    this.fetchingFiles.value = true;
    const files = await this.refreshMonitorPool();
    this.fetchingFiles.value = false;

    if (files.length === 0 || this.abortRef.value) {
      this.scanStatus.value = "done";
      this.scanTotal.value = 0;
      return;
    }

    const startNum = parseInt(this.scanStartInput.value, 10);
    const resolvedStartIndex =
      !Number.isNaN(startNum) && startNum >= 1
        ? Math.min(startNum - 1, files.length - 1)
        : 0;

    const batchNum = parseInt(this.batchSizeInput.value, 10);
    const batchSize = !Number.isNaN(batchNum) && batchNum >= 1 ? batchNum : DEFAULT_BATCH_SIZE;

    const targets = files.slice(resolvedStartIndex);
    this.scanTotal.value = targets.length;

    let processed = 0;
    for (let i = 0; i < targets.length; i += batchSize) {
      if (this.abortRef.value) break;
      const batch = targets.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((file) => this.checkFile(file)));
      const batchResults: ScanResult[] = [];
      results.forEach((outcome, idx) => {
        if (outcome.kind === "expired") {
          batchResults.push({ file: batch[idx], status: "expired", statusCode: outcome.statusCode });
        } else if (outcome.kind === "skipped") {
          batchResults.push({ file: batch[idx], status: "skipped", statusCode: outcome.statusCode });
        }
      });
      if (batchResults.length) {
        this.scanResults.value = this.scanResults.value.concat(batchResults);
      }
      processed += batch.length;
      this.scanProcessed.value = processed;
      if (this.abortRef.value) break;
      if (i + batchSize < targets.length) {
        await this.sleep(BATCH_DELAY_MS);
      }
    }

    this.scanStatus.value = "done";
  }

  stopScan() {
    this.abortRef.value = true;
    this.scanStatus.value = "stopping";
  }

  toggleSelect(name: string) {
    const next = new Set(this.selectedNames.value);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    this.selectedNames.value = next;
  }

  selectAll() {
    this.selectedNames.value = new Set(this.cleanableAccounts.value.map((item) => item.file.name));
  }

  deselectAll() {
    this.selectedNames.value = new Set();
  }

  requestDelete(names: string[], source: "selected" | "all") {
    if (!names.length) return;
    this.pendingDeleteNames.value = names;
    this.deleteSource.value = source;
    this.confirmMessage.value = `确定删除${source === "all" ? "全部" : "选中"}的 ${names.length} 个失效账号？此操作不可撤销。`;
    this.confirmOpen.value = true;
  }

  async runDelete(names: string[]) {
    this.isDeleting.value = true;
    this.deleteProgress.value = { done: 0, total: names.length };
    this.resultMessage.value = "";
    this.resultMessageType.value = "";

    const deleted: string[] = [];
    let failed = 0;

    for (let i = 0; i < names.length; i += DELETE_BATCH_SIZE) {
      const batch = names.slice(i, i + DELETE_BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((name) => deleteAuthFile(name)));
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          deleted.push(batch[idx]);
        } else {
          failed += 1;
        }
      });
      this.deleteProgress.value = { done: Math.min(i + batch.length, names.length), total: names.length };
      if (i + DELETE_BATCH_SIZE < names.length) {
        await this.sleep(DELETE_BATCH_DELAY_MS);
      }
    }

    if (deleted.length) {
      const deletedSet = new Set(deleted);
      this.scanResults.value = this.scanResults.value.filter((item) => !deletedSet.has(item.file.name));
      this.selectedNames.value = new Set(
        Array.from(this.selectedNames.value).filter((name) => !deletedSet.has(name)),
      );
      this.monitorFiles.value = this.monitorFiles.value.filter((file) => !deletedSet.has(file.name));
      this.monitorFilesBackup.value = this.monitorFiles.value.length ? this.monitorFiles.value : this.monitorFilesBackup.value;
      this.authFilesStore.fetchFiles().catch(() => {});
    }

    if (failed === 0) {
      this.resultMessage.value = `成功删除 ${deleted.length} 个账号`;
      this.resultMessageType.value = "success";
    } else {
      this.resultMessage.value = `删除完成：成功 ${deleted.length} 个，失败 ${failed} 个`;
      this.resultMessageType.value = "warning";
    }

    this.isDeleting.value = false;
    this.deleteProgress.value = null;
    this.deleteSource.value = null;
  }

  async confirmDelete() {
    const names = this.pendingDeleteNames.value;
    this.confirmOpen.value = false;
    this.pendingDeleteNames.value = [];
    if (!names.length) return;
    await this.runDelete(names);
  }

  cancelDelete() {
    this.confirmOpen.value = false;
    this.pendingDeleteNames.value = [];
  }

  private parsePositiveInt(value: string, fallback: number, min: number, max: number) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  normalizeAutoInputs() {
    const concurrency = this.parsePositiveInt(this.autoConcurrencyInput.value, DEFAULT_BATCH_SIZE, 1, 50);
    const batchDelayMs = this.parsePositiveInt(this.autoBatchDelayInput.value, BATCH_DELAY_MS, 0, 60000);
    const intervalMin = this.parsePositiveInt(this.autoIntervalInput.value, DEFAULT_AUTO_INTERVAL_MIN, 1, 1440);
    this.autoConcurrencyInput.value = String(concurrency);
    this.autoBatchDelayInput.value = String(batchDelayMs);
    this.autoIntervalInput.value = String(intervalMin);
    this.autoConfigRef.value = { concurrency, batchDelayMs, intervalMin };
  }

  private waitForUnpause(phase: AutoPausedFrom): Promise<void> {
    if (!this.autoPausedRef.value) return Promise.resolve();
    this.autoPausedFrom.value = phase;
    this.autoRunStatus.value = "paused";
    return new Promise<void>((resolve) => {
      this.autoPauseResolveRef.value = () => {
        this.autoPausedFrom.value = null;
        resolve();
      };
    });
  }

  handleAutoPause() {
    if (!this.autoEnabled.value) return;
    this.autoPausedRef.value = true;
    if (this.autoRunStatus.value === "scanning") {
      this.autoPausedFrom.value = "scanning";
      this.autoRunStatus.value = "pausing";
    } else if (this.autoRunStatus.value === "deleting") {
      this.autoPausedFrom.value = "deleting";
      this.autoRunStatus.value = "pausing";
    } else if (this.autoRunStatus.value === "waiting") {
      this.autoPausedFrom.value = "waiting";
      this.autoRunStatus.value = "paused";
    }
  }

  handleAutoResume() {
    this.autoPausedRef.value = false;
    if (this.autoPauseResolveRef.value) {
      this.autoPauseResolveRef.value();
      this.autoPauseResolveRef.value = null;
    }
  }

  stopAutoLoop() {
    this.autoRunningRef.value = false;
    this.autoPausedRef.value = false;
    if (this.autoPauseResolveRef.value) {
      this.autoPauseResolveRef.value();
      this.autoPauseResolveRef.value = null;
    }
    this.autoRunStatus.value = "idle";
    this.autoCountdown.value = 0;
    this.autoScanProcessed.value = 0;
    this.autoScanTotal.value = 0;
    this.autoDeleteProcessed.value = 0;
    this.autoDeleteTotal.value = 0;
    this.autoCleanableItems.value = [];
    this.autoPausedFrom.value = null;
  }

  handleAutoStop() {
    this.autoEnabled.value = false;
    this.stopAutoLoop();
  }

  requestAutoStop() {
    if (!this.autoEnabled.value) return;
    this.autoStopConfirmOpen.value = true;
  }

  confirmAutoStop() {
    this.autoStopConfirmOpen.value = false;
    this.handleAutoStop();
  }

  cancelAutoStop() {
    this.autoStopConfirmOpen.value = false;
  }

  async runAutoLoop() {
    if (this.autoRunningRef.value) return;
    this.autoRunningRef.value = true;
    this.autoPausedRef.value = false;

    while (this.autoRunningRef.value) {
      this.autoRunStatus.value = "scanning";
      this.fetchingFiles.value = true;
      const files = await this.refreshMonitorPool();
      this.fetchingFiles.value = false;

      if (!this.autoRunningRef.value) break;

      const roundStart = Date.now();
      const config = this.autoConfigRef.value;
      const cleanableNames: string[] = [];
      const cleanableReasons = new Map<string, CleanableReason>();

      this.autoScanTotal.value = files.length;
      this.autoScanProcessed.value = 0;
      this.autoCleanableItems.value = [];

      let processed = 0;
      for (let i = 0; i < files.length; i += config.concurrency) {
        if (!this.autoRunningRef.value) break;
        if (this.autoPausedRef.value) {
          await this.waitForUnpause("scanning");
          if (!this.autoRunningRef.value) break;
          this.autoRunStatus.value = "scanning";
        }
        const batch = files.slice(i, i + config.concurrency);
        const results = await Promise.all(batch.map((file) => this.checkFile(file)));
        results.forEach((outcome, idx) => {
          if (outcome.kind !== "expired") return;
          const name = batch[idx].name;
          cleanableNames.push(name);
          cleanableReasons.set(name, this.reasonFromStatus(outcome.statusCode ?? null));
        });
        processed += batch.length;
        this.autoScanProcessed.value = processed;
        this.autoCleanableItems.value = cleanableNames.map((name) => ({
          name,
          reason: cleanableReasons.get(name) ?? "error",
        }));
        if (i + config.concurrency < files.length) {
          await this.sleep(config.batchDelayMs);
        }
      }

      if (!this.autoRunningRef.value) break;

      if (cleanableNames.length > 0) {
        this.autoRunStatus.value = "deleting";
        this.autoDeleteTotal.value = cleanableNames.length;
        this.autoDeleteProcessed.value = 0;
        const deletedNames: string[] = [];
        let deletedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < cleanableNames.length; i += DELETE_BATCH_SIZE) {
          if (!this.autoRunningRef.value) break;
          if (this.autoPausedRef.value) {
            await this.waitForUnpause("deleting");
            if (!this.autoRunningRef.value) break;
            this.autoRunStatus.value = "deleting";
          }
          const batch = cleanableNames.slice(i, i + DELETE_BATCH_SIZE);
          const results = await Promise.allSettled(batch.map((name) => deleteAuthFile(name)));
          results.forEach((result, idx) => {
            if (result.status === "fulfilled") {
              deletedCount += 1;
              deletedNames.push(batch[idx]);
            } else {
              failedCount += 1;
            }
          });
          this.autoDeleteProcessed.value = Math.min(i + batch.length, cleanableNames.length);
          if (i + DELETE_BATCH_SIZE < cleanableNames.length) {
            await this.sleep(DELETE_BATCH_DELAY_MS);
          }
        }

        if (!this.autoRunningRef.value) break;
        if (deletedNames.length > 0) {
          const deletedSet = new Set(deletedNames);
          this.monitorFiles.value = this.monitorFiles.value.filter((file) => !deletedSet.has(file.name));
          this.monitorFilesBackup.value = this.monitorFiles.value.length ? this.monitorFiles.value : this.monitorFilesBackup.value;
          this.authFilesStore.fetchFiles().catch(() => {});
        }
        if (failedCount > 0) {
          this.resultMessage.value = `自动清理完成：成功 ${deletedCount} 个，失败 ${failedCount} 个`;
          this.resultMessageType.value = "warning";
        } else if (deletedCount > 0) {
          this.resultMessage.value = `自动清理完成：删除 ${deletedCount} 个失效账号`;
          this.resultMessageType.value = "success";
        }
      }

      const durationMs = Date.now() - roundStart;
      this.autoLastDurationMs.value = durationMs;
      this.autoLastResult.value = { scanned: files.length, deleted: cleanableNames.length };
      this.autoHistory.value = [
        { timestamp: roundStart, scanned: files.length, deleted: cleanableNames.length, durationMs },
        ...this.autoHistory.value,
      ].slice(0, AUTO_HISTORY_MAX);

      this.autoRunStatus.value = "waiting";
      const waitSec = this.autoConfigRef.value.intervalMin * 60;
      for (let sec = waitSec; sec > 0; sec--) {
        if (!this.autoRunningRef.value) break;
        if (this.autoPausedRef.value) {
          await this.waitForUnpause("waiting");
          if (!this.autoRunningRef.value) break;
          this.autoRunStatus.value = "waiting";
        }
        this.autoCountdown.value = sec;
        await this.sleep(1000);
      }
      this.autoCountdown.value = 0;
    }

    this.stopAutoLoop();
  }
}

export function useCodexMonitorState() {
  return CodexMonitorState.getInstance();
}
