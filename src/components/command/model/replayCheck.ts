// "Replay check" rows and the evidence sections (validation and impact
// content of the old tabs). Every metric read goes through metricsView.
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

// Lead time is never shown alone: median with IQR and n in one value.
export function leadTimeText(m: M): string {
  const iqr = Array.isArray(m.lead_time_iqr_h) ? m.lead_time_iqr_h : [];
  return `Median ${round(m.lead_time_median_h)} h · IQR ${round(iqr[0])}–${round(iqr[1])} h · n = ${round(m.n_points)}`;
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

  if (finite(m.lead_time_median_h)) {
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
    rows.push(missingRow("lead-time", "Lead time before mapped landslides", "lead_time_median_h"));
  }

  optional("warned", "Zones warned before the event", "warned_before_pct", () =>
    finite(m.warned_before_pct)
      ? { id: "warned", name: "Zones warned before the event", value: fmtPct(m.warned_before_pct), missing: false }
      : undefined);
  optional("flood-agreement", "Flood agreement with the reference", "iou", () =>
    finite(m.iou) || finite(m.f1)
      ? {
          id: "flood-agreement", name: "Flood agreement with the reference",
          value: `IoU ${fmtScore(m.iou)} · F1 ${fmtScore(m.f1)}`, missing: false,
        }
      : undefined);
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
  modelTitle: string;
  modelStats: Stat[];
  leadTime?: LeadTimeBlock; // hidden when the median is absent
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

function leadTimeBlock(m: M): LeadTimeBlock | undefined {
  if (!finite(m.lead_time_median_h)) return undefined;
  const iqr = Array.isArray(m.lead_time_iqr_h) ? m.lead_time_iqr_h : [];
  const assumptions = m.lead_time_assumptions;
  const note = typeof assumptions === "string" ? assumptions
    : assumptions && typeof assumptions === "object" ? JSON.stringify(assumptions).slice(0, 400)
    : "IMERG Early ~4 h and SMAP L4 release latency applied; perfect-forecast layers excluded.";
  const precision = m.anchor_precision === "hour" ? "hour-precision anchors"
    : m.anchor_precision === "date" ? "date-precision anchors"
    : m.anchor_precision === "mixed" ? "mixed-precision anchors" : null;
  const shares = ([
    ["warned_before_pct", "Flagged before damage"],
    ["warned_24h_pct", "Warned >= 24 h early"],
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
    median: `Median ${round(m.lead_time_median_h)} h before mapped landslides`,
    iqr: `IQR ${round(iqr[0])}–${round(iqr[1])} h · n = ${round(m.n_points)}${precision ? ` · ${precision}` : ""}`,
    shares,
    lines,
    histogram: m.lead_time_hist,
    note: `In replay: ${note}`,
  };
}

export function evidence(bundle: CcBundle): Evidence {
  const m = (bundle.metricsView ?? {}) as M;
  const cloud = m.cloud_pct;
  return {
    hasMetrics: !!bundle.metricsView,
    floodStats: [
      stat(bundle, "IoU", "iou", fmtScore),
      stat(bundle, "F1", "f1", fmtScore),
      stat(bundle, "Landslide catalog hits", "landslide_hit_pct", fmtPct),
      stat(bundle, "Hand validation", "hand_validation", fmtPct),
    ],
    floodNote:
      "Scores are computed on clear-sky reference cells only — no cloud pixels are counted.",
    modelTitle: "Landslide model — learned vs manual slope rule",
    modelStats: [
      stat(bundle, "ML model AUC (XGBoost)", "rf_auc", fmtScore),
      stat(bundle, "Manual slope-rule AUC", "rule_auc", fmtScore),
    ],
    leadTime: leadTimeBlock(m),
    whyRadar: finite(cloud)
      ? `During the event the optical saw only ${Math.round((1 - cloud) * 100)}% of the scene — the rest was cloud. SAR sees through.`
      : "Cloud cover during the event is not reported for this case — SAR sees through either way.",
    featureImportance:
      m.feature_importance && typeof m.feature_importance === "object"
        ? (m.feature_importance as Record<string, number>) : undefined,
    impactStats: [
      stat(bundle, "People in critical areas", "people_critical", fmtPeople),
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
