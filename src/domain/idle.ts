export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const IDLE_WARNING_MS = 2 * 60 * 1000;

export function shouldSignOut(
  lastActivityAt: number,
  now: number,
  timeout: number = IDLE_TIMEOUT_MS
): boolean {
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return false;
  if (!Number.isFinite(now)) return false;
  return now - lastActivityAt >= timeout;
}

export function idleRemainingMs(
  lastActivityAt: number,
  now: number,
  timeout: number = IDLE_TIMEOUT_MS
): number {
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(now)) return Number.POSITIVE_INFINITY;
  return Math.max(0, timeout - (now - lastActivityAt));
}

export function shouldWarnIdle(
  lastActivityAt: number,
  now: number,
  timeout: number = IDLE_TIMEOUT_MS,
  warning: number = IDLE_WARNING_MS
): boolean {
  const remaining = idleRemainingMs(lastActivityAt, now, timeout);
  return Number.isFinite(remaining) && remaining > 0 && remaining <= warning;
}
