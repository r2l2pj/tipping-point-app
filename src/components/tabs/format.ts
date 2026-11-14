// Private panel helpers — small enough that they stay in tabs/ (src/lib is
// owned by parallel units).
import type { CaseBundle } from "@/lib/types";

// BRT wall time for live timestamps (America/Sao_Paulo, UTC-3). Date-only
// strings render without a clock; anything else gets HH:mm BRT.
export const fmtBrt = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (!/T|\d:\d/.test(iso)) {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
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

// A bundle is mock-derived when the loader flagged it as a fixture fallback or
// it carries neither normalized metrics nor a live summary — the only cases
// where "Illustrative demo data" may be shown.
export const isMockDerived = (bundle: CaseBundle): boolean =>
  (bundle as CaseBundle & { fallback?: boolean }).fallback === true ||
  (!bundle.metricsView && !bundle.summary);
