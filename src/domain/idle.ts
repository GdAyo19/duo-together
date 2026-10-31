export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;

export function shouldSignOut(
  lastActivityAt: number,
  now: number,
  timeout: number = IDLE_TIMEOUT_MS
): boolean {
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return false;
  if (!Number.isFinite(now)) return false;
  return now - lastActivityAt >= timeout;
}
