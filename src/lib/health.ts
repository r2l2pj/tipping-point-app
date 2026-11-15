// /api/health (Lucas): body is only {"ok":true|false}. ok = the live (Now)
// data was updated within the last 6 h — two missed 3-hourly runs — and is
// readable. The timestamp never leaves the server.
export const STALE_AFTER_MS = 6 * 3_600_000;

export function healthOk(updatedAt: unknown, nowMs: number): boolean {
  if (typeof updatedAt !== "string" || !updatedAt.trim()) return false;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= STALE_AFTER_MS;
}
