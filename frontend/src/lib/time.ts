const DAY_MS = 1000 * 60 * 60 * 24;

export function daysUntil(isoDate: string, nowMs = Date.now()): number {
  return Math.ceil((Date.parse(isoDate) - nowMs) / DAY_MS);
}
