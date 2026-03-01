export const AUTO_REFRESH_DEFAULT_SECONDS = 60;
export const AUTO_REFRESH_MIN_SECONDS = 10;
export const AUTO_REFRESH_MAX_SECONDS = 3600;

export function normalizeAutoRefreshIntervalSeconds(value?: number | null): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return AUTO_REFRESH_DEFAULT_SECONDS;
  }
  const rounded = Math.round(value);
  if (rounded < AUTO_REFRESH_MIN_SECONDS) return AUTO_REFRESH_MIN_SECONDS;
  if (rounded > AUTO_REFRESH_MAX_SECONDS) return AUTO_REFRESH_MAX_SECONDS;
  return rounded;
}
