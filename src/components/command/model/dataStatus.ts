// One data-status signal for the screen. Replaces the fallback banner, the
// stale pill and isMockDerived of the old screen.
import { ageText, fmtBrt } from "./format";
import type { CcBundle } from "./types";

export type DataStatusKind =
  | "live"
  | "stale"
  | "unknown-age"
  | "last-saved"
  // Replay bundle with a known run time. The design names five kinds and
  // defines them for the live run; a replay is never "live" or "stale".
  | "archive";

export interface DataStatus {
  kind: DataStatusKind;
  date?: string; // run time, or the data date of the saved copy
}

// Refresh period of the live run, in hours. One public setting
// (NEXT_PUBLIC_REFRESH_HOURS, default 3); the stale limit is two periods.
export function refreshHours(raw: string | undefined = process.env.NEXT_PUBLIC_REFRESH_HOURS): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export const staleLimitMs = (hours = refreshHours()): number =>
  2 * hours * 3600 * 1000;

// `nowMs` is the browser clock after mount. Without it a live run with a
// run time reads "unknown-age": the screen never claims "live" unchecked.
export function dataStatus(
  bundle: CcBundle,
  nowMs?: number,
  hours: number = refreshHours()
): DataStatus {
  const date = bundle.updated_at ?? bundle.dataDate;
  // A fallback bundle is real last-saved data (the repository holds no mock
  // data since 2026-11-14), so there is no "sample" status and no
  // "Illustrative demo data" label.
  if (bundle.fallback === true) return { kind: "last-saved", date };
  if (!bundle.updated_at) return { kind: "unknown-age" };
  if (bundle.mode !== "live") return { kind: "archive", date: bundle.updated_at };
  const t = new Date(bundle.updated_at).getTime();
  if (nowMs === undefined || Number.isNaN(t)) return { kind: "unknown-age", date: bundle.updated_at };
  return {
    kind: nowMs - t > staleLimitMs(hours) ? "stale" : "live",
    date: bundle.updated_at,
  };
}


// Freshness text of the header. "live" is only said for a checked age.
export function freshnessText(status: DataStatus, nowMs?: number): string {
  const when = status.date ? fmtBrt(status.date) : undefined;
  const age = status.date && nowMs !== undefined ? ageText(status.date, nowMs) : undefined;
  switch (status.kind) {
    case "live":
      return `Live · updated ${age ?? when}`;
    case "stale":
      return `Stale · last run ${when}${age ? ` (${age})` : ""}`;
    case "unknown-age":
      return when ? `Unknown age · run ${when}` : "Unknown age · run time not published yet";
    case "last-saved":
      return `Showing last saved data from ${when ?? "an unknown date"}`;
    case "archive":
      return `Replay data · snapshot ${when}`;
  }
}

// Short word for the chip on the map.
export const STATUS_WORD: Record<DataStatusKind, string> = {
  live: "Live data",
  stale: "Stale data",
  "unknown-age": "Unknown age",
  "last-saved": "Last saved data",
  archive: "Replay data",
};
