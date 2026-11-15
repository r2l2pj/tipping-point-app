// "Replay check" rows and the evidence sections (validation and impact
// content of the old tabs). Every metric read goes through metricsView.
import { count } from "@/lib/contract";
import type { DayPoint } from "@/lib/types";
import { availability, missingText, nullReason } from "./availability";
import { finite, fmtDate, fmtDayShort, fmtKm2, fmtPct, fmtPeople, fmtScore } from "./format";
import { floodLabels, swathLine } from "./radar";
import { thresholdFor } from "./status";
import { NOT_PUBLISHED, type CcBundle } from "./types";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

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
// -9189%. Out of range -> null: no "clouds hid" sentence.
export function opticalSeenPct(cloudPct: unknown): number | null {
  if (!finite(cloudPct)) return null;
  const frac = cloudPct > 1 ? cloudPct / 100 : cloudPct;
  if (frac < 0 || frac > 1) return null;
  return Math.round((1 - frac) * 100);
}

// Lead time is never shown alone: median with IQR and n in one value.
// Number of damage points behind the lead-time stat: metrics `lead_time_n`
// only. The legacy `n_points` belongs to the old event-anchor run (RS:
// median -57 h, IQR -57–-57, n_points 5678) and does not qualify a stat —
// until the forecast rebuild publishes lead_time_n the stat is pending.
// Lead time of the NOAA GFS forecast replay (lead-analysis,
// data/<case>/forecast_lead_time.json, also metrics `forecast_lead_time`):
// for each forecast issue day D (00Z run), did the replayed index reach
// Critical for a day up to the damage anchor; lead = anchor minus issue
// time. Only issue days dated before the anchor day can score (their D+1
// frame depicts a day up to the anchor), so they are the denominator. This
// is the only lead-time stat shown: the older event-anchor run
// (lead_time_median_h, e.g. RS -57 h over 5,678 points) does not qualify.
export interface ForecastLead {
  median: number;
  iqr?: [number, number];
  warned: number; // issue days that flagged Critical before the anchor
  scorable: number; // issue days dated before the anchor day
  leads: number[]; // lead of each flagging issue day, h
  earliest?: string;
  anchor?: string;
}

const isObj = (v: unknown): v is M => typeof v === "object" && v !== null && !Array.isArray(v);

export function forecastLead(bundle: CcBundle): ForecastLead | undefined {
  const m = (bundle.metricsView ?? {}) as M;
  const r = isObj(bundle.forecastLeadTime) ? bundle.forecastLeadTime as M
    : isObj(m.forecast_lead_time) ? m.forecast_lead_time as M : undefined;
  if (!r || !finite(r.lead_h_median) || !finite(r.n_warned) || r.n_warned < 1) return undefined;
  const anchor = typeof r.anchor_utc === "string" ? r.anchor_utc : undefined;
  const days = Array.isArray(r.issue_days) ? (r.issue_days as unknown[]).filter(isObj) : [];
  const anchorDay = anchor?.slice(0, 10);
  const scorable = anchorDay
    ? days.filter((d) => typeof d.issue === "string" && d.issue.slice(0, 10) < anchorDay)
    : [];
  const leads = days.filter((d) => d.warned === true && finite(d.lead_h)).map((d) => d.lead_h as number);
  const iqr = Array.isArray(r.lead_h_iqr) && finite(r.lead_h_iqr[0]) && finite(r.lead_h_iqr[1])
    ? [r.lead_h_iqr[0], r.lead_h_iqr[1]] as [number, number] : undefined;
  return {
    median: r.lead_h_median,
    iqr,
    warned: r.n_warned,
    // Without per-day records the denominator is unknown: fall back to the
    // flagged days only (never the all-days n_issue_days).
    scorable: scorable.length || r.n_warned,
    leads: leads.length ? leads : [r.lead_h_median],
    earliest: typeof r.earliest_critical_issue === "string" ? r.earliest_critical_issue : undefined,
    anchor,
  };
}

// L35 (conductor, 2026-11-15): the forecast lead-time headline (WA "median
// 85 h") is held until lead-analysis re-scores it — WA's flooded places were
// not flagged before the damage. Set to false once L35 publishes.
export const LEAD_TIME_HELD = true;
export const LEAD_TIME_REEVALUATED = "being re-evaluated";

export const hasLeadTime = (bundle: CcBundle): boolean => !LEAD_TIME_HELD && forecastLead(bundle) !== undefined;

export const LEAD_TIME_PENDING_REBUILD = "pending: forecast rebuild";
export const LEAD_TIME_PENDING = LEAD_TIME_HELD ? LEAD_TIME_REEVALUATED : LEAD_TIME_PENDING_REBUILD;
export const LEAD_TIME_NAME = "Lead time before the damage (NOAA GFS forecast replay)";

const ofDays = (f: ForecastLead) => `${round(f.warned)} of ${round(f.scorable)} forecast days`;
const hours = (v: number) => `${round(v)} h`;

// Same words as the submission headline. Three or more flagging days:
// "median 85 h (IQR 55–115 h, 6 of 8 forecast days)". Fewer: no median,
// the single values — "1 of 4 forecast days flagged it, 111 h ahead".
export function leadTimeText(bundle: CcBundle): string {
  const f = forecastLead(bundle);
  if (!f) return LEAD_TIME_PENDING;
  if (f.warned < 3) {
    const vals = [...f.leads].sort((a, b) => b - a).map(hours).join(" and ");
    return `${ofDays(f)} flagged it, ${vals} ahead`;
  }
  const range = f.iqr ? `IQR ${round(f.iqr[0])}–${round(f.iqr[1])} h, ` : "";
  return `median ${hours(f.median)} (${range}${ofDays(f)})`;
}

// L37 (conductor): lead-analysis's onset-anchored lead time
// (forecast_lead_time_onset) replaces the held 'How early?' only labelled for
// what it measures: TPI Critical ANYWHERE in the case region before the event
// start — not at the damage sites (the warned row covers those).
export const ONSET_LEAD_NAME = "Critical anywhere in the region before the event start (NOAA GFS replay)";
export const ONSET_LEAD_SCOPE = "Critical anywhere in the region — not at the damage sites (see the High-or-Critical row for those).";
export interface OnsetLead { text: string; lines: string[] }
export function onsetLead(m: M): OnsetLead | undefined {
  const o = m.forecast_lead_time_onset;
  if (!isRecord(o) || o.anchor_basis !== "onset") return undefined;
  if (!/anywhere/i.test(String(o.definition ?? ""))) return undefined;
  if (!finite(o.n_warned) || !finite(o.n_issue_days) || o.n_issue_days < 1) return undefined;
  const runs = `${o.n_warned} of ${o.n_issue_days} forecast runs`;
  const leads = (Array.isArray(o.issue_days) ? o.issue_days : [])
    .filter((d): d is M => isRecord(d) && d.warned === true && finite(d.lead_h))
    .map((d) => d.lead_h as number).sort((a, b) => b - a);
  let text: string;
  if (o.n_warned === 0) text = `none of ${o.n_issue_days} forecast runs reached Critical before the event start`;
  else if (o.n_warned >= 3 && finite(o.lead_h_median)) {
    const iqr = Array.isArray(o.lead_h_iqr) && o.lead_h_iqr.length === 2 && o.lead_h_iqr.every(finite)
      ? `IQR ${round(o.lead_h_iqr[0])}–${round(o.lead_h_iqr[1])} h, ` : "";
    text = `median ${hours(o.lead_h_median)} (${iqr}${runs})`;
  } else text = `${runs} reached it, ${leads.map(hours).join(" and ")} ahead`;
  const day = typeof o.anchor_local === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.anchor_local)
    ? o.anchor_local.slice(0, 10) : typeof o.anchor_utc === "string" ? o.anchor_utc.slice(0, 10) : undefined;
  const lines = [
    `Event start: ${anchorShort(o)}${day ? ` (${fmtDate(day)})` : ""}`,
    typeof o.earliest_critical_issue === "string"
      ? `Earliest forecast run that reached it: ${fmtDate(o.earliest_critical_issue)} (00Z)` : undefined,
  ].filter((x): x is string => !!x);
  return { text, lines };
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

  if (hasLeadTime(bundle)) {
    rows.push({
      id: "lead-time",
      name: LEAD_TIME_NAME,
      value: leadTimeText(bundle),
      detail: isPlaceholder(m) ? "Illustrative numbers" : undefined,
      missing: false,
    });
  } else {
    const onset = onsetLead(m);
    rows.push(onset
      ? { id: "lead-time", name: ONSET_LEAD_NAME, value: onset.text, detail: [ONSET_LEAD_SCOPE, ...onset.lines].join(" "), missing: false }
      : { id: "lead-time", name: LEAD_TIME_NAME, value: LEAD_TIME_PENDING, missing: true });
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
  const warned = warnedRow(m);
  if (warned) rows.push(warned);
  // Model scores are shown only with their n, in the 'Did we get it right?'
  // card (lead-ml ml_card.json); the bare rf_auc / rule_auc row is gone.
  optional("flooded", floodLabels(bundle).area, "flooded_km2", () =>
    finite(m.flooded_km2)
      ? {
          id: "flooded", name: floodLabels(bundle).area, value: fmtKm2(m.flooded_km2),
          detail: swathLine(bundle), missing: false,
        }
      : undefined);
  return rows;
}

// "Did the alert come before?" (lead-analysis tools/warned_before.py, SCHEMA
// 'Did the alert come before?'): share of the damage the TPI already flagged
// High or above in the NOAA GFS frames issued 24-48 h before the damage
// anchor. The *_warned*_pct values are authored 0-100 and are NOT in the
// contract's PCT_KEYS (whose >= 1 heuristic turned 0.98 into 98%): they are
// printed as published.
const pct100 = (v: number) => `${v < 1 && v > 0 ? v.toFixed(2) : v.toFixed(1)}%`;
// L36 headline wording (lead-submission): "forecast as issued".
export const WARNED_NAME = {
  slide: "Mapped landslides in High or Critical areas (forecast as issued)",
  flood: "Flooded area in High or Critical areas (forecast as issued)",
};
// L37 (conductor): the RS landslide anchor (May 1) is under review — the
// event likely started Apr 29-30. A warned row (landslide or flood) shows its
// numbers only when lead-analysis marks the anchor as the event onset.
export const WARNED_REANCHOR = "being re-anchored to the event start";
// Short name of the anchor event: lead-analysis anchor_short when present,
// else the head of anchor_label ("event onset: first deaths of the event
// (…)" -> "the first deaths"; "event onset day: heavy rain begins
// 2025-12-08; …" -> "heavy rain began"), else "the event start".
export function anchorShort(obj: M): string {
  if (typeof obj.anchor_short === "string" && obj.anchor_short.trim()) return obj.anchor_short.trim();
  const label = typeof obj.anchor_label === "string" ? obj.anchor_label : "";
  const head = label.replace(/^event onset( day)?:\s*/i, "").split(/[(;]/)[0].trim()
    .replace(/\s*\d{4}-\d{2}-\d{2}\s*$/, "").replace(/ of the event$/i, "").trim();
  if (!head || head === label.trim()) return "the event start";
  if (/^first /i.test(head)) return `the ${head}`;
  return head.replace(/\bbegins$/i, "began");
}
export function warnedRow(m: M): CheckRow | undefined {
  for (const hz of ["slide", "flood"] as const) {
    const v = m[`${hz}_warned_pct`];
    if (!finite(v)) continue;
    const obj = (m[`${hz}_warned`] ?? {}) as M;
    if (obj.anchor_basis !== "onset") {
      return { id: "warned-before", name: WARNED_NAME[hz], value: WARNED_REANCHOR, missing: true };
    }
    const crit = m[`${hz}_warned_critical_pct`];
    const obs = m[`${hz}_warned_observed_pct`];
    const of = hz === "slide"
      ? (finite(obj.n_points) ? ` of ${obj.n_points.toLocaleString("en-US")} mapped landslides` : " of mapped landslides")
      : (finite(obj.confirmed_flood_km2) ? ` of ${fmtKm2(obj.confirmed_flood_km2)} radar-mapped flood` : " of the radar-mapped flood");
    // L37: the anchor is the documented event start; date shown in the
    // event's local day (anchor_local), else the UTC day.
    const day = typeof obj.anchor_local === "string" && /^\d{4}-\d{2}-\d{2}/.test(obj.anchor_local)
      ? obj.anchor_local.slice(0, 10)
      : typeof obj.anchor_utc === "string" ? obj.anchor_utc.slice(0, 10) : undefined;
    const anchor = `${anchorShort(obj)}${day ? ` (${fmtDate(day)})` : ""}`;
    // One forecast run per lead (lead-analysis by_lead 24/48/72: the 00Z run
    // issued at least that long before the anchor), nearest first: "27 h
    // before the first deaths (Apr 29, 2024): 36.5%; 51 h before: 0.0%; …".
    // Older exports: by_issue_gfs runs < 73 h. Single runs vary (L36).
    const byLead = isRecord(obj.by_lead) ? obj.by_lead : undefined;
    const runs = (byLead
      ? Object.values(byLead).map((x) => (isRecord(x) && isRecord(x.gfs) ? x.gfs : undefined))
      : (Array.isArray(obj.by_issue_gfs) ? obj.by_issue_gfs as M[] : []).filter((r) => finite(r?.hours_before_anchor) && (r.hours_before_anchor as number) < 73))
      .filter((r): r is M => isRecord(r) && finite(r.hours_before_anchor) && finite(r.alto_or_critico_pct))
      .sort((a, b) => (a.hours_before_anchor as number) - (b.hours_before_anchor as number));
    const runText = runs.map((r, i) =>
      `${Math.round(r.hours_before_anchor as number)} h before${i === 0 ? ` ${anchor}` : ""}: ${pct100(r.alto_or_critico_pct as number)}`);
    const detail = [
      (runText.length
        ? `NOAA GFS forecast issued ${runText.join("; ")}${runText.length > 1 ? " — single runs vary" : ""}`
        : `TPI High or above in the NOAA GFS forecast issued 24 h before ${anchor}`) +
        (finite(obs) ? `; with observed rain instead: ${pct100(obs)}` : "") + ".",
      typeof obj.explanation === "string" ? obj.explanation : undefined,
    ].filter(Boolean).join(" ");
    return {
      id: "warned-before",
      name: WARNED_NAME[hz],
      value: `${pct100(v)}${of}${finite(crit) ? ` (Critical ${pct100(crit)})` : ""}`,
      detail,
      missing: false,
    };
  }
  return undefined;
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
  // "Rain check" line (metrics.imerg_vs_gauge, lead-analysis): IMERG Final
  // daily vs INMET gauges. Hidden when the case ships no gauge check.
  rainCheck?: string;
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
  if (!hasLeadTime(bundle)) {
    const onset = onsetLead(m);
    if (onset) {
      return {
        placeholder: false,
        median: `Using the forecast available at the time: ${onset.text}`,
        iqr: "", shares: [], histogram: undefined,
        lines: [ONSET_LEAD_SCOPE, ...onset.lines],
        note: "",
      };
    }
    return {
      missing: `Lead time: ${LEAD_TIME_PENDING}.`,
      placeholder: false, median: "", iqr: "", shares: [], lines: [], histogram: undefined, note: "",
    };
  }
  const f = forecastLead(bundle)!;
  // The shares, histogram and official-warning delta belong to the older
  // event-anchor run: not mixed with the forecast-replay stat.
  const lines: string[] = [];
  if (f.earliest) lines.push(`Earliest forecast run that flagged it: ${fmtDate(f.earliest)} (00Z)`);
  // The anchor is a UTC time; its calendar day is the UTC one (in BRT the
  // WA anchor, Dec 9 00:35 UTC, would read Dec 8).
  if (f.anchor) {
    const hm = /[T ](\d{2}:\d{2})/.exec(f.anchor)?.[1];
    lines.push(`Damage anchor: ${fmtDate(f.anchor.slice(0, 10))}${hm ? ` ${hm} UTC` : ""}`);
  }
  if (finite(m.critical_area_with_damage_pct)) {
    lines.push(`Critical area that had damage: ${fmtPct(m.critical_area_with_damage_pct)}` +
      (finite(m.critical_area_km2) ? ` · Critical area: ${round(m.critical_area_km2)} km²` : ""));
  }
  const after = f.median < 0;
  return {
    placeholder: isPlaceholder(m),
    // Measured against the damage anchor, never against official warnings;
    // a negative lead is "after the damage", never "warned earlier".
    median: after
      ? `The NOAA GFS forecast replay reached Critical after the damage`
      : `Using the forecast available at the time: ${leadTimeText(bundle)}`,
    iqr: "",
    shares: [],
    lines,
    histogram: undefined,
    note: "In replay: forecast issued at 00Z on each issue day; only IMERG days before the issue day are used, soil moisture held at the day before.",
  };
}

// The gauge-check window ("2024-04-20..2024-05-15" or a [start, end] pair)
// as "Apr 20 to May 15, 2024"; an unrecognized shape is printed as authored.
const gaugeWindow = (w: unknown): string | undefined => {
  const parts = (typeof w === "string" ? w.split("..") : Array.isArray(w) ? w : [])
    .map((p) => (typeof p === "string" ? p.trim() : ""));
  return parts.length === 2 && parts[0] && parts[1]
    ? `${fmtDayShort(parts[0])} to ${fmtDate(parts[1])}`
    : typeof w === "string" && w ? w : undefined;
};

// "Rain check" (lead-analysis imerg_vs_gauge, validation only): IMERG Final
// daily at each station's 0.1 deg cell vs the INMET gauge in it. The line
// always carries its n — without the counts it does not render at all.
// bias_pct_median is authored as a percent: printed as written, never ×100.
export function rainCheckLine(m: M): string | undefined {
  const g = m.imerg_vs_gauge;
  if (!isObj(g)) return undefined;
  const { n_stations: nStations, n_station_days: nDays, pearson_r_median: r, bias_pct_median: bias } = g;
  if (![nStations, nDays, r, bias].every(finite)) return undefined;
  const win = gaugeWindow(g.window);
  const caveat = typeof g.caveat === "string" && g.caveat ? g.caveat : undefined;
  return (
    `IMERG vs ${nStations} INMET rain gauges (${nDays} station-days${win ? `, ${win}` : ""}): ` +
    `median r ${(r as number).toFixed(2)}, IMERG ${(bias as number) > 0 ? "+" : ""}${bias}%` +
    `${caveat ? `; ${caveat}` : ""} (validation only)`
  );
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
      // hand_validation is hidden (conductor, 2026-11-15): the published value
      // is already a percent (0.98 %) and lead-analysis is re-checking what it
      // measures (G2). Brought back once G2 settles the unit and meaning.
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
    rainCheck: rainCheckLine(m),
    whyRadar: optical != null
      // Conductor: the cloud share is measured on the optical scenes named
      // in cloud_pct_source (WA: OPERA DSWx-HLS, Dec 15/17, after the storm),
      // never "during the event".
      ? (/HLS/.test(String(m.cloud_pct_source ?? ""))
          ? `In the optical (HLS) scenes after the storm, clouds hid ${100 - optical}% of the area. Radar sees through cloud.`
          : `In the optical scenes, clouds hid ${100 - optical}% of the area. Radar sees through cloud.`)
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
