export type AutoMonitorConfig = {
  concurrency: number;
  batchDelayMs: number;
  intervalMin: number;
  toggleThreshold: number;
  cooldownHours: number;
  autoDeleteExpired: boolean;
};

const STORAGE_KEY = "cpa-codex:monitor-auto-config";

export function readAutoMonitorConfig(): Partial<AutoMonitorConfig> | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<AutoMonitorConfig> = {};
    const applyNumber = (
      key: Exclude<keyof AutoMonitorConfig, "autoDeleteExpired">,
    ) => {
      const value = parsed[key];
      const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
      if (Number.isFinite(num)) {
        out[key] = num;
      }
    };
    const applyBoolean = (key: "autoDeleteExpired") => {
      const value = parsed[key];
      if (typeof value === "boolean") {
        out[key] = value;
      } else if (value === "true" || value === "false") {
        out[key] = value === "true";
      }
    };
    applyNumber("concurrency");
    applyNumber("batchDelayMs");
    applyNumber("intervalMin");
    applyNumber("toggleThreshold");
    applyNumber("cooldownHours");
    applyBoolean("autoDeleteExpired");
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function writeAutoMonitorConfig(config: AutoMonitorConfig): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // 忽略本地存储错误
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
