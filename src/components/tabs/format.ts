// Private panel helpers — small enough that they stay in tabs/ (src/lib is
// owned by parallel units).
import { fmtDate } from "@/lib/layers";
import type { CaseBundle } from "@/lib/types";

// BRT wall time for live timestamps (America/Sao_Paulo, UTC-3). Date-only
// strings render without a clock; anything else gets HH:mm BRT.
export const fmtBrt = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (!/T|\d:\d/.test(iso)) {
    // Date-only values are calendar dates — delegate to layers.fmtDate, which
    // anchors them at noon UTC so BRT doesn't shift them back a day.
    return fmtDate(iso);
  }
  return (
    d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }) + " BRT"
  );
};

// Integer hours ("52 h"); absent -> em dash.
export const fmtHours = (v?: number): string =>
  v == null ? "—" : `${Math.round(v)} h`;

// A bundle is mock-derived when it carries neither normalized metrics nor a
// live summary — the only case where a "Data pending" marker may be shown. A
// fallback bundle is real last-saved data (the L8 banner already warns about
// staleness), so it does not count as mock.
export const isMockDerived = (bundle: CaseBundle): boolean =>
  !bundle.metricsView && !bundle.summary;

// bundle.pending[] lists outputs the pipeline has not published for this case
// (tokens: 'metrics', 'series', 'summary', 'alerts', product ids like
// 'landslide_candidates', 'priority_zones'). Read defensively — the field may
// be absent on older bundles.
export const pendingIncludes = (bundle: CaseBundle, key: string): boolean => {
  const p = (bundle as CaseBundle & { pending?: unknown }).pending;
  return Array.isArray(p) && p.includes(key);
};
