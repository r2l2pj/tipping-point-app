// What is missing, and why. One function answers for every element of the
// screen, so "no data" never renders as "no risk" (design G3).
import { NOT_PUBLISHED, type CcBundle } from "./types";

export type Availability =
  | { state: "ok" }
  | { state: "pending" } // declared by the contract, not in storage yet
  | { state: "absent"; reason?: string } // null in the data
  | { state: "not-applicable"; text: string }; // the case cannot have it

export const NO_RADAR_TEXT = "No radar for this event (before NISAR launch)";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const BUNDLE_FIELD: Record<string, keyof CcBundle> = {
  series: "series",
  imerg_smap_daily: "series",
  metrics: "metricsView",
  summary: "summary",
  alerts: "nowAlerts",
  swot: "swot",
  priority_zones: "zones",
  permanent_water: "water",
  flood_confirmed: "flood",
  landslide_candidates: "scars",
  landslide_catalog: "catalog",
  municipal_boundaries: "municipalities",
  places: "places",
};

// Reason for a null value: the case node `_null_reasons` (attached by the
// loader component) or the `_null_reasons` of the raw metrics blob.
export function nullReason(bundle: CcBundle, key: string): string | undefined {
  const fromCase = bundle.nullReasons?.[key];
  if (typeof fromCase === "string" && fromCase) return fromCase;
  const raw = bundle.metrics as unknown;
  const fromMetrics = isRecord(raw) && isRecord(raw._null_reasons)
    ? raw._null_reasons[key] : undefined;
  return typeof fromMetrics === "string" && fromMetrics ? fromMetrics : undefined;
}

// True when the case has a NISAR before/after pair: both pass dates, or both
// manifest layers with an asset.
export function hasNisarPair(bundle: CcBundle): boolean {
  const dd = bundle.data_dates ?? {};
  if (typeof dd.nisar_pre === "string" && typeof dd.nisar_post === "string") return true;
  const layers = bundle.manifest?.layers ?? [];
  const pre = layers.find((l) => l.id === "nisar_pre");
  const post = layers.find((l) => l.id === "nisar_post");
  return Boolean(pre && post && (pre.png || pre.cog) && (post.png || post.cog));
}

export function availability(bundle: CcBundle, key: string): Availability {
  if (key === "radar") {
    if (hasNisarPair(bundle) || bundle.flood) return { state: "ok" };
    if (bundle.mode === "replay") return { state: "not-applicable", text: NO_RADAR_TEXT };
    return { state: "pending" };
  }
  const field = BUNDLE_FIELD[key];
  const metrics = bundle.metricsView as Record<string, unknown> | undefined;
  const value = field ? bundle[field] : metrics?.[key];
  if (value !== undefined && value !== null) return { state: "ok" };
  if (bundle.pending?.includes(key)) return { state: "pending" };
  const reason = nullReason(bundle, key);
  const declaredNull =
    (bundle.products as Record<string, unknown> | undefined)?.[key] === null ||
    value === null;
  if (reason || declaredNull) return { state: "absent", reason };
  return { state: "pending" };
}

// Text for a value that is not `ok`.
export function missingText(a: Availability): string {
  if (a.state === "not-applicable") return a.text;
  if (a.state === "absent" && a.reason) return `${NOT_PUBLISHED} (${a.reason})`;
  return NOT_PUBLISHED;
}
