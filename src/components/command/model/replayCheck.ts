// "Replay check" rows and the evidence sections (validation and impact
// content of the old tabs). Every metric read goes through metricsView.
import { count } from "@/lib/contract";
import type { DayPoint } from "@/lib/types";
import { availability, missingText, nullReason } from "./availability";
import { finite, fmtKm2, fmtPct, fmtPeople, fmtScore } from "./format";
import { floodLabels, swathLine } from "./radar";
import { thresholdFor } from "./status";
import { NOT_PUBLISHED, type CcBundle } from "./types";

export interface CheckRow {
  id: string;
  name: string;
  value: string;
  detail?: string;
  missing: boolean;
}

type M = Record<string, unknown>;

const round = (v: unknown): string => (finite(v) ? String(Math.round(v)) : "not reported");

// Share of the scene the optical sensor saw (100 - cloud %), as an integer
// percent. metricsView already normalizes cloud_pct to 0-1, so 1 means 100%
// cloud here; only a value > 1 can be a raw 0-100 metrics.json number (e.g.
// 92.9) that skipped normalization — rescale it so it can never render as
// -9189%. Out of range -> null: no "the optical saw" sentence.
export function opticalSeenPct(cloudPct: unknown): number | null {
  if (!finite(cloudPct)) return null;
  const frac = cloudPct > 1 ? cloudPct / 100 : cloudPct;
  if (frac < 0 || frac > 1) return null;
  return Math.round((1 - frac) * 100);
}

// Lead time is never shown alone: median with IQR and n in one value.
// Number of damage points behind the lead-time stat (metrics `lead_time_n`,
// legacy `n_points`). Undefined when not a positive count.
export const leadTimeN = (m: M): number | undefined => {
  const n = finite(m.lead_time_n) ? m.lead_time_n : finite(m.n_points) ? m.n_points : undefined;
  return n !== undefined && n > 0 ? n : undefined;
};

// A lead-time stat is shown only with its n (conductor ruling): a median
// without the number of points behind it is not a result.
export const hasLeadTime = (m: M): boolean =>
  finite(m.lead_time_median_h) && leadTimeN(m) !== undefined;

export const LEAD_TIME_PENDING = "pending: forecast rebuild";

export function leadTimeText(m: M): string {
  const iqr = Array.isArray(m.lead_time_iqr_h) ? m.lead_time_iqr_h : [];
  const range = finite(iqr[0]) && finite(iqr[1]) ? ` · IQR ${round(iqr[0])}–${round(iqr[1])} h` : "";
  return `Median ${round(m.lead_time_median_h)} h${range} · n = ${round(leadTimeN(m))}`;
}

const isPlaceholder = (m: M): boolean => {
  const a = m.lead_time_assumptions;
  return !!a && typeof a === "object" && (a as M).quality === "placeholder";
};

// Rows in a fixed order. The lead-time row is always present in Replay
// (missing reads "not published yet"); the other rows follow the metrics the
// case has, or a null with a reason.
export function replayCheckRows(bundle: CcBundle): CheckRow[] {
  if (bundle.mode !== "replay") return [];
  const m = (bundle.metricsView ?? {}) as M;
  const rows: CheckRow[] = [];
  const missingRow = (id: string, name: string, key: string): CheckRow => ({
    id, name, value: missingText(availability(bundle, key)), missing: true,
  });
  const optional = (id: string, name: string, key: string, row: () => CheckRow | undefined) => {
    const made = row();
    if (made) rows.push(made);
    else if (m[key] === null || nullReason(bundle, key)) rows.push(missingRow(id, name, key));
  };

  if (hasLeadTime(m)) {
    const never = finite(m.never_critical_pct)
      ? `${fmtPct(m.never_critical_pct)} never crossed Critical` : undefined;
    rows.push({
      id: "lead-time",
      name: "Lead time before mapped landslides",
      value: leadTimeText(m),
      detail: [never, isPlaceholder(m) ? "Illustrative numbers" : undefined].filter(Boolean).join(" · ") || undefined,
      missing: false,
    });
  } else {
    rows.push({ id: "lead-time", name: "Lead time before mapped landslides", value: LEAD_TIME_PENDING, missing: true });
  }
  // "% of zones warned first" was dropped (Lucas, 2026-11-15): no row.
  optional("flood-agreement", "Flood agreement with the reference", "iou", () => {
    if (![m.iou, m.f1, m.precision, m.recall].some(finite)) return undefined;
    const pr = [
      finite(m.precision) ? `P ${fmtScore(m.precision)}` : undefined,
      finite(m.recall) ? `R ${fmtScore(m.recall)}` : undefined,
    ].filter(Boolean).join(" · ");
    return {
      id: "flood-agreement", name: "Flood agreement with the reference",
      value: `IoU ${fmtScore(m.iou)} · F1 ${fmtScore(m.f1)}${pr ? ` · ${pr}` : ""}`,
      missing: false,
    };
  });
  optional("catalog-hits", "Landslide catalog hits", "landslide_hit_pct", () =>
    finite(m.landslide_hit_pct)
      ? { id: "catalog-hits", name: "Landslide catalog hits", value: fmtPct(m.landslide_hit_pct), missing: false }
      : undefined);
  optional("model", "Model against the slope rule", "rf_auc", () =>
    finite(m.rf_auc) || finite(m.rule_auc)
      ? {
          id: "model", name: "Model against the slope rule",
          value: `ML model AUC (XGBoost) ${fmtScore(m.rf_auc)} · Manual slope-rule AUC ${fmtScore(m.rule_auc)}`,
          missing: false,
        }
      : undefined);
  optional("flooded", floodLabels(bundle).area, "flooded_km2", () =>
    finite(m.flooded_km2)
      ? {
          id: "flooded", name: floodLabels(bundle).area, value: fmtKm2(m.flooded_km2),
          detail: swathLine(bundle), missing: false,
        }
      : undefined);
  return rows;
}

// --- evidence details (G4) ----------------------------------------------------

export interface Stat {
  label: string;
  value: string;
  missing: boolean;
}

export interface LeadTimeBlock {
  // Set when the case has metrics and no lead time: the block shows this
  // text and nothing else.
  missing?: string;
  placeholder: boolean;
  median: string;
  iqr: string;
  shares: Stat[];
  lines: string[];
  histogram: unknown;
  note: string;
}

export interface Evidence {
  hasMetrics: boolean;
  floodStats: Stat[];
  floodNote: string;
  // Secondary check: every OPERA water pixel incl. permanent water
  // (iou_raw/f1_raw/precision_raw/recall_raw). Set only when a *_raw key
  // exists; `diagnosis` is the pipeline's opera_fn_diagnosis text.
  floodSecondary?: { line: string; diagnosis?: string };
  modelTitle: string;
  modelStats: Stat[];
  leadTime?: LeadTimeBlock; // hidden when the case has no metrics at all
  whyRadar: string;
  featureImportance?: Record<string, number>;
  impactStats: Stat[];
  exposureBasis: string;
}

const stat = (bundle: CcBundle, label: string, key: string, format: (v: unknown) => string): Stat => {
  const v = (bundle.metricsView as M | undefined)?.[key];
  return finite(v)
    ? { label, value: format(v), missing: false }
    : { label, value: missingText(availability(bundle, key)), missing: true };
};

function leadTimeBlock(bundle: CcBundle, m: M): LeadTimeBlock | undefined {
  if (!bundle.metricsView) return undefined;
  if (!hasLeadTime(m)) {
    return {
      missing: `Lead time: ${LEAD_TIME_PENDING}.`,
      placeholder: false, median: "", iqr: "", shares: [], lines: [], histogram: undefined, note: "",
    };
  }
  const iqr = Array.isArray(m.lead_time_iqr_h) ? m.lead_time_iqr_h : [];
  const assumptions = m.lead_time_assumptions;
  const note = typeof assumptions === "string" ? assumptions
    : assumptions && typeof assumptions === "object" ? JSON.stringify(assumptions).slice(0, 400)
    : "IMERG Early ~4 h and SMAP L4 release latency applied; perfect-forecast layers excluded.";
  const precision = m.anchor_precision === "hour" ? "hour-precision anchors"
    : m.anchor_precision === "date" ? "date-precision anchors"
    : m.anchor_precision === "mixed" ? "mixed-precision anchors" : null;
  // The "% warned first" shares were dropped (Lucas, 2026-11-15).
  const shares = ([
    ["never_critical_pct", "Never crossed Critical"],
  ] as const).flatMap(([key, label]) =>
    finite(m[key]) ? [{ label, value: fmtPct(m[key]), missing: false }] : []);
  const lines: string[] = [];
  if (finite(m.official_warning_delta_h)) {
    lines.push(`vs first official warning: ${m.official_warning_delta_h >= 0 ? "+" : ""}${round(m.official_warning_delta_h)} h (+ = we flagged earlier)`);
  }
  if (finite(m.event_lead_h)) lines.push(`Event-level anchor lead: ${round(m.event_lead_h)} h`);
  if (finite(m.critical_area_with_damage_pct)) {
    lines.push(`Critical area that had damage: ${fmtPct(m.critical_area_with_damage_pct)}` +
      (finite(m.critical_area_km2) ? ` · Critical area: ${round(m.critical_area_km2)} km²` : ""));
  }
  return {
    placeholder: isPlaceholder(m),
    median: `Tipping Point would have warned ${round(m.lead_time_median_h)} hours earlier`,
    iqr: `${finite(iqr[0]) && finite(iqr[1]) ? `IQR ${round(iqr[0])}–${round(iqr[1])} h · ` : ""}n = ${round(leadTimeN(m))}${precision ? ` · ${precision}` : ""}`,
    shares,
    lines,
    histogram: m.lead_time_hist,
    note: `In replay: ${note}`,
  };
}

// `day`: the selected timeline day. People in critical areas follow it when
// the series carries a per-day count (same rule as the tile).
export function evidence(bundle: CcBundle, day?: DayPoint): Evidence {
  const m = (bundle.metricsView ?? {}) as M;
  const peopleOfDay = bundle.metricsView ? count(day?.people_critical) : undefined;
  const optical = opticalSeenPct(m.cloud_pct);
  const hasRaw = [m.iou_raw, m.f1_raw, m.precision_raw, m.recall_raw].some((v) => v != null);
  return {
    hasMetrics: !!bundle.metricsView,
    // Headline: like-for-like NISAR new flood vs OPERA DSWx-S1 new flood.
    floodStats: [
      stat(bundle, "IoU", "iou", fmtScore),
      stat(bundle, "F1", "f1", fmtScore),
      stat(bundle, "Precision", "precision", fmtScore),
      stat(bundle, "Recall", "recall", fmtScore),
      stat(bundle, "Landslide catalog hits", "landslide_hit_pct", fmtPct),
      stat(bundle, "Hand validation", "hand_validation", fmtPct),
    ],
    floodNote:
      typeof m.validation_method === "string" && m.validation_method
        ? m.validation_method
        : "Scores are computed on clear-sky reference cells only — no cloud pixels are counted.",
    floodSecondary: hasRaw
      ? {
          line: `IoU ${fmtScore(m.iou_raw)} · F1 ${fmtScore(m.f1_raw)} · P ${fmtScore(m.precision_raw)} · R ${fmtScore(m.recall_raw)}`,
          diagnosis:
            typeof m.opera_fn_diagnosis === "string" && m.opera_fn_diagnosis
              ? m.opera_fn_diagnosis : undefined,
        }
      : undefined,
    modelTitle: "Landslide model — learned vs manual slope rule",
    modelStats: [
      stat(bundle, "ML model AUC (XGBoost)", "rf_auc", fmtScore),
      stat(bundle, "Manual slope-rule AUC", "rule_auc", fmtScore),
    ],
    leadTime: leadTimeBlock(bundle, m),
    whyRadar: optical != null
      ? `During the event the optical saw only ${optical}% of the scene — the rest was cloud. SAR sees through.`
      : "Cloud cover during the event is not reported for this case — SAR sees through either way.",
    featureImportance:
      m.feature_importance && typeof m.feature_importance === "object"
        ? (m.feature_importance as Record<string, number>) : undefined,
    impactStats: [
      peopleOfDay !== undefined
        ? { label: "People in critical areas", value: fmtPeople(peopleOfDay), missing: false }
        : stat(bundle, "People in critical areas", "people_critical", fmtPeople),
      stat(bundle, "People flooded", "people_flooded", fmtPeople),
      stat(bundle, "Flooded area", "flooded_km2", fmtKm2),
      stat(bundle, "Night-light drop", "night_light_drop_pct", fmtPct),
    ],
    exposureBasis:
      `Population: GPW v4 (NASA SEDAC), counted in TPI ≥ ${thresholdFor(bundle).toFixed(2)} cells. ` +
      "Lights-out compares VIIRS Black Marble radiance before/after the event.",
  };
}

export { NOT_PUBLISHED };
