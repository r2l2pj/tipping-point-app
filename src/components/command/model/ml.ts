// "Did we get it right?" — the landslide models on the TEST split.
// Source (lead-ml, main 1fe4aba): data/ml/ml_card.json, global — RS 2024 and
// WA 2025 are TEST events inside it:
//   split { 3a, 3b: text, rows }
//   t_ml  { <model>: metrics }                                   where (3a)
//   trigger { <24h|48h|72h|7d|14d>: { <gfs|perfect>: { <model>: { test: metrics,
//             by_event: { <case>: metrics } } } } }              when (3b)
//   low_skill_horizons [..], models { key: display name }
// metrics: n, n_pos, base_rate, threshold, precision, recall, f1, pr_auc,
// roc_auc. The file is ~115 KB, so the server builds this small view per
// case (buildMlView) and only the view reaches the browser. A metric is never
// shown without its n.
import { sortHorizons } from "@/lib/layers";
import { finite } from "./format";

type M = Record<string, unknown>;
const isRecord = (v: unknown): v is M => typeof v === "object" && v !== null && !Array.isArray(v);

const FALLBACK_LABEL: Record<string, string> = {
  xgb_all: "XGBoost",
  rf_all: "Random forest",
  rule_slope: "Slope rule",
  rule_tpi: "TPI > 0.6 rule",
  // The served T_ML model (lead-ml has no display name for it in models{}).
  xgb_terrain_landcover: "XGBoost (terrain + land cover)",
};
const T_ML_MODELS = ["xgb_all", "rf_all", "rule_slope"];
const TRIGGER_MODELS = ["xgb_all", "rf_all", "rule_tpi"];
export const HORIZON_ORDER = ["24h", "48h", "72h", "7d", "14d"];
export const SOURCE_LABEL: Record<string, string> = {
  gfs: "NOAA GFS forecast rain",
  perfect: "observed rain (perfect forecast · upper bound)",
};
// Below this many positives a TEST score is labelled fragile.
// L33 (conductor, 2026-11-15): the NOAA GFS tables are superseded (40% of
// the negatives had no GFS run); until lead-ml's v2 (~12:00) the card shows a
// provisional banner and only the perfect-forecast tables (labelled upper
// bound). v2 (data/ml/ml_card_v2.json, version 'v2') lifts it: the loader
// prefers v2 and the view carries `provisional` per card.
export const ML_PROVISIONAL = true; // v1 card (no version key)
export const isV2 = (card: unknown) => isRecord(card) && card.version === "v2";
export const ML_PROVISIONAL_TEXT = "Provisional — being re-scored on more events (v2 today)";

// L32: shown under the T_ML 'where' table until lead-ml's re-export.
export const TML_RETRAIN_NOTE = "Terrain model being retrained without RS 2024 points; numbers will update.";
export const FEW_POSITIVES = 30; // WA 2025: 8 dated reports (8–24 positive samples by horizon)

export interface MlRow {
  model: string;
  label: string;
  n?: number;
  nPos?: number;
  cells: { precision: string; recall: string; f1: string; prAuc: string; rocAuc: string };
  // v2: PR-AUC on the VAL split next to TEST (conductor: always shown together).
  valPrAuc?: string;
  missing: boolean; // no n: no numbers
}

export interface MlTable {
  rows: MlRow[];
  baseLine?: string; // "Base rate 3.8% (38 of 988 test samples)"
  fewPositives?: boolean;
  reason?: string;
}

export interface MlTestEvent { id: string; name: string; nPos?: number; source?: string }
// v2 generalise{h:{model:{pooled,event_median,event_min,event_max,worst_event}}}
export interface MlSpread { model: string; label: string; pooled?: number; eventsN: number; median: number; min: number; max: number; worst?: string }
export interface MlSpreadBlock { source: string; eventsN: number; rows: MlSpread[] }

export interface MlView {
  version?: string;
  // v2 headline_status ('held: …'): the scores are not headline numbers yet.
  headlineHeld?: string;
  valNote?: string;
  // v2 served{model, note}: the trigger model the live layer runs.
  servedLine?: string;
  servedNote?: string;
  // v1 card: provisional banner, GFS tables hidden (L33).
  provisional: boolean;
  // v2: T_ML retrained without any RS 2024 point (L32).
  tmlExcludesRs?: boolean;
  testEventList: MlTestEvent[];
  // `${horizon}|${source}`: calibrated PR-AUC across TEST events (v2)
  spread: Record<string, MlSpreadBlock>;
  split3a?: string;
  split3b?: string;
  where?: MlTable; // T_ML susceptibility, 3a TEST
  horizons: string[];
  sources: string[]; // "gfs" first when present
  lowSkill: string[];
  // key `${horizon}|${source}`: all TEST events, and this case's event.
  when: Record<string, MlTable>;
  event: Record<string, MlTable>;
  eventId?: string;
  // TEST events present in by_event (e.g. rs_2024, wa_2025).
  testEvents: string[];
  // lead-ml's t_ml_ranking_note is present: the 'where' scores are the
  // calibrated (served) ones; before calibration the models rank differently.
  calibrationNote?: string;
}

// lead-ml's caveats, in plain words (conductor). The event list and the
// low-skill horizons come from the export; the rest is the setup lead-ml
// documented (split.3b: trained on the dated 2015-2018 catalog, TEST =
// unseen 2024-2025 events).
export function mlCaveats(v: MlView): string[] {
  const ev = v.testEventList?.length ? v.testEventList.map((e) => e.id) : v.testEvents;
  const rs = ev.includes("rs_2024");
  const wa = ev.includes("wa_2025");
  // ML v2 re-scores on more events: the "one event" wording only fits the
  // v1 TEST set (exactly RS 2024 + WA 2025).
  const tested = rs && wa && ev.length === 2
    ? "The TEST is essentially ONE event — Rio Grande do Sul, May 2024 — plus 8 dated landslide reports from Washington 2025: few events, so these scores can move a lot."
    : ev.length > 2
      ? `The TEST covers ${ev.length} events the models never saw; with this few events the scores can still move.`
      : ev.length
      ? `The TEST covers only ${ev.length} event${ev.length === 1 ? "" : "s"}: few events, so these scores can move a lot.`
      : "The TEST covers few events: these scores can move a lot.";
  const years = ev.map((id) => Number(/_(\d{4})$/.exec(id)?.[1])).filter((y) => y > 1990).sort();
  const v2Train = v.version === "v2" && years.length
    ? `Trained on dated landslide catalogs (GLC/COOLR, worldwide); tested on ${ev.length} disaster events from ${years[0]}–${years[years.length - 1]} it never saw.`
    : undefined;
  const out = [
    tested,
    v2Train ?? "Trained on the 2015–2018 landslide catalog; tested on 2024–2025 events it never saw.",
    "Rain decides WHEN a landslide is triggered (the table above); the terrain model decides WHERE (T_ML, below).",
  ];
  if (v.lowSkill.length) out.push(`${v.lowSkill.join(" and ")} horizons rely on long-range forecast: low skill.`);
  return out;
}

// lead-ml: prefer NOAA GFS where any event counts, else observed rain
// (pre-2021 events have no GFS archive).
export function spreadFor(v: MlView, h: string, src?: string): MlSpreadBlock | undefined {
  const order = [src, "gfs", "perfect"].filter((x): x is string => !!x);
  for (const s of order) {
    const b = v.spread[`${h}|${s}`];
    if (b && b.eventsN > 0) return b;
  }
  return undefined;
}

// "PR-AUC across 7 events (NOAA GFS forecast): median 0.41 (range 0.12–0.80; weakest: Helene 2024)"
export function spreadLine(r: MlSpread, source: string): string {
  const src = source === "gfs" ? "NOAA GFS forecast" : "observed rain";
  return `PR-AUC across ${r.eventsN} event${r.eventsN === 1 ? "" : "s"} (${src}): median ${r.median.toFixed(2)} ` +
    `(range ${r.min.toFixed(2)}–${r.max.toFixed(2)}${r.worst ? `; weakest: ${r.worst}` : ""})`;
}

const score = (v: unknown) => (finite(v) ? v.toFixed(2) : "—");
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

function row(model: string, label: string, t: unknown, val?: unknown): MlRow | undefined {
  if (!isRecord(t)) return undefined;
  const n = finite(t.n) && t.n > 0 ? t.n : undefined;
  const ok = n !== undefined;
  return {
    model,
    label,
    n,
    nPos: finite(t.n_pos) ? t.n_pos : undefined,
    cells: {
      precision: ok ? score(t.precision) : "—",
      recall: ok ? score(t.recall) : "—",
      f1: ok ? score(t.f1) : "—",
      prAuc: ok ? score(t.pr_auc) : "—",
      rocAuc: ok ? score(t.roc_auc) : "—",
    },
    valPrAuc: ok && isRecord(val) && finite(val.n) && val.n > 0 && finite(val.pr_auc) ? score(val.pr_auc) : undefined,
    missing: !ok,
  };
}

function table(models: string[], labels: Record<string, string>, pick: (m: string) => unknown, pickVal?: (m: string) => unknown): MlTable {
  const rows = models.map((m) => row(m, labels[m] ?? FALLBACK_LABEL[m] ?? m, pick(m), pickVal?.(m))).filter((r): r is MlRow => !!r);
  const ref = rows.find((r) => !r.missing);
  const t = ref ? pick(ref.model) : undefined;
  const base = isRecord(t) && finite(t.base_rate) ? t.base_rate : undefined;
  const nPos = ref?.nPos;
  return {
    rows,
    baseLine: ref?.n !== undefined && base !== undefined
      ? `Base rate ${pct1(base)} (${(nPos ?? Math.round(base * ref.n)).toLocaleString("en-US")} of ${ref.n.toLocaleString("en-US")} test samples)`
      : undefined,
    fewPositives: nPos !== undefined && nPos < FEW_POSITIVES,
  };
}

// `servedModel`: the T_ML model the map layer paints (ml/t_ml.json `model`,
// e.g. xgb_terrain_landcover) — first row of the 'where' table, labelled so.
export function buildMlView(card: unknown, caseId?: string, servedModel?: string): MlView | undefined {
  if (!isRecord(card)) return undefined;
  const labels: Record<string, string> = { ...FALLBACK_LABEL, ...(isRecord(card.models) ? card.models as Record<string, string> : {}) };
  const tml = isRecord(card.t_ml) ? card.t_ml : undefined;
  const served = servedModel && tml && isRecord(tml[servedModel]) ? servedModel : undefined;
  if (served) {
    const base = labels[served] ?? served.replace(/_/g, " ");
    // lead-ml's own label may already say "(served T_ML)".
    labels[served] = /served/i.test(base) ? base.replace(/\(served T_ML\)/i, "— the model on the map") : `${base} — the model on the map`;
  }
  // The served model replaces xgb_all (not served); random forest and the
  // slope rule stay as comparisons on the same TEST blocks (conductor).
  const whereModels = served ? [served, "rf_all", "rule_slope"] : T_ML_MODELS;
  const split = isRecord(card.split) ? card.split : {};
  const where = tml ? table(whereModels, labels, (m) => tml[m]) : undefined;
  const trig = isRecord(card.trigger) ? card.trigger : {};
  // v2: the served trigger model first (labelled), then the comparisons and
  // the no-rain/soil baseline (lead-ml 'climatology').
  const servedTrig = isRecord(card.served) && typeof card.served.model === "string" ? card.served.model : undefined;
  const v2 = isV2(card);
  if (v2 && servedTrig) labels[servedTrig] = `${labels[servedTrig] ?? servedTrig} — the model live`;
  if (v2 && labels.climatology) labels.climatology = `${labels.climatology} (baseline)`;
  const trigModels = v2
    ? [...new Set([servedTrig, ...TRIGGER_MODELS, "climatology"].filter((m): m is string => !!m))]
    : TRIGGER_MODELS;
  // Horizons from the export itself (ML v2: 24h / 72h / 7d), by duration.
  const horizons = sortHorizons(Object.keys(trig).filter((h) => isRecord(trig[h])));
  const published = ["gfs", "perfect"].filter((s) => horizons.some((h) => isRecord((trig[h] as M)[s])));
  const provisional = !isV2(card);
  // L33: no GFS tables while the card is provisional.
  const sources = provisional && published.includes("perfect") ? published.filter((s) => s !== "gfs") : published;
  const when: Record<string, MlTable> = {};
  const event: Record<string, MlTable> = {};
  for (const h of horizons) {
    for (const s of sources) {
      const block = (trig[h] as M)[s];
      if (!isRecord(block)) continue;
      if (typeof block.reason === "string") {
        when[`${h}|${s}`] = { rows: [], reason: block.reason };
        continue;
      }
      when[`${h}|${s}`] = table(trigModels, labels,
        (m) => (isRecord(block[m]) ? (block[m] as M).test : undefined),
        (m) => (isRecord(block[m]) ? (block[m] as M).val : undefined));
      if (caseId) {
        const ev = table(trigModels, labels, (m) => {
          const b = block[m];
          return isRecord(b) && isRecord(b.by_event) ? (b.by_event as M)[caseId] : undefined;
        });
        if (ev.rows.length) event[`${h}|${s}`] = ev;
      }
    }
  }
  const evNames = new Map<string, string>();
  const testEventList: MlTestEvent[] = (Array.isArray(card.test_events) ? card.test_events : [])
    .filter((e): e is M => isRecord(e) && typeof e.id === "string")
    .map((e) => {
      const name = typeof e.name === "string" ? e.name : (e.id as string);
      evNames.set(e.id as string, name);
      return {
        id: e.id as string,
        name,
        nPos: finite(e.n_pos) ? e.n_pos : finite(e.n_pos_24h) ? e.n_pos_24h : undefined,
        source: typeof e.source === "string" ? e.source
          : Array.isArray(e.sources)
            ? (e.sources.includes("gfs") ? "NOAA GFS forecast + observed rain" : "observed rain only (no GFS archive)")
            : undefined,
      };
    });
  // v2 generalise.{gfs|perfect}.{h}.{model} = {pooled, events_n,
  // event_median, event_min, event_max, worst_event (id), ...}: calibrated
  // PR-AUC; only events with >= 20 positives count (events_n).
  const spread: Record<string, MlSpreadBlock> = {};
  const gen = isRecord(card.generalise) ? card.generalise : {};
  for (const s of ["gfs", "perfect"]) {
    const bySrc = gen[s];
    if (!isRecord(bySrc)) continue;
    for (const h of Object.keys(bySrc)) {
      const g = bySrc[h];
      if (!isRecord(g)) continue;
      let eventsN = 0;
      const rows = trigModels.flatMap((m): MlSpread[] => {
        const r = g[m];
        if (!isRecord(r)) return [];
        const n = finite(r.events_n) ? r.events_n : 0;
        if (n < 1 || !finite(r.event_median) || !finite(r.event_min) || !finite(r.event_max)) return [];
        eventsN = Math.max(eventsN, n);
        return [{
          model: m,
          label: labels[m] ?? FALLBACK_LABEL[m] ?? m,
          pooled: finite(r.pooled) ? r.pooled : undefined,
          eventsN: n,
          median: r.event_median, min: r.event_min, max: r.event_max,
          worst: typeof r.worst_event === "string" ? evNames.get(r.worst_event) ?? r.worst_event : undefined,
        }];
      });
      if (rows.length) spread[`${h}|${s}`] = { source: s, eventsN, rows };
    }
  }
  const view: MlView = {
    version: typeof card.version === "string" ? card.version : undefined,
    headlineHeld: typeof card.headline_status === "string" && /^held/i.test(card.headline_status)
      ? `Not a headline yet — ${card.headline_status.replace(/^held:\s*/i, "")}.` : undefined,
    valNote: typeof card.val_vs_test_note === "string" ? card.val_vs_test_note : undefined,
    servedLine: servedTrig ? `The live layer runs ${labels[servedTrig]?.replace(/ — the model live$/, "") ?? servedTrig}.` : undefined,
    servedNote: isRecord(card.served) && typeof card.served.note === "string" ? card.served.note : undefined,
    provisional,
    tmlExcludesRs: card.t_ml_excludes_rs === true,
    testEventList,
    spread,
    split3a: typeof split["3a"] === "string" ? split["3a"] : undefined,
    split3b: typeof split["3b"] === "string" ? split["3b"] : undefined,
    where: where && where.rows.length ? where : undefined,
    horizons,
    sources,
    lowSkill: Array.isArray(card.low_skill_horizons) ? card.low_skill_horizons.filter((x): x is string => typeof x === "string") : [],
    when,
    event,
    eventId: caseId && Object.keys(event).length ? caseId : undefined,
    calibrationNote: typeof card.t_ml_ranking_note === "string"
      ? (v2
          ? "Scores of the calibrated models, as served on the map."
          : "Scores of the calibrated models, as served on the map. Before calibration the models rank in a different order (calibration ties lower PR-AUC).")
      : undefined,
    testEvents: [...new Set(horizons.flatMap((h) => sources.flatMap((s) => {
      const b = (trig[h] as M)[s];
      const x = isRecord(b) && isRecord(b.xgb_all) && isRecord((b.xgb_all as M).by_event) ? (b.xgb_all as M).by_event as M : {};
      return Object.keys(x);
    })))].sort(),
  };
  return view.where || horizons.length ? view : undefined;
}

// Feature importance by group (lead-ml data/ml/feature_importance_3b.json —
// the trigger model): rows { feature, group, gain_share (XGB total-gain
// share, sums to 1), group_permutation_pr_auc_drop (TEST) }, group_labels.
export interface GroupImportance {
  group: string;
  label: string;
  gain: number; // 0..1, sum of the group's features
  permDrop?: number;
  top: string[];
}

export interface ImportanceView {
  model?: string;
  groups: GroupImportance[];
}

export function groupImportance(raw: unknown): ImportanceView | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.rows)) return undefined;
  const labels = isRecord(raw.group_labels) ? raw.group_labels : {};
  const by = new Map<string, { gain: number; perm?: number; feats: { f: string; g: number }[] }>();
  for (const r of raw.rows) {
    if (!isRecord(r) || typeof r.group !== "string") continue;
    const e = by.get(r.group) ?? { gain: 0, feats: [] };
    if (finite(r.gain_share)) {
      e.gain += r.gain_share;
      if (typeof r.feature === "string" && r.gain_share > 0) e.feats.push({ f: r.feature, g: r.gain_share });
    }
    if (finite(r.group_permutation_pr_auc_drop)) e.perm = r.group_permutation_pr_auc_drop;
    by.set(r.group, e);
  }
  const groups = [...by.entries()]
    .map(([group, e]) => ({
      group,
      label: typeof labels[group] === "string" ? labels[group] as string : group,
      gain: e.gain,
      permDrop: e.perm,
      top: e.feats.sort((a, b) => b.g - a.g).slice(0, 3).map((x) => x.f),
    }))
    .sort((a, b) => b.gain - a.gain);
  // No gain at all (a smoke export): nothing to chart.
  if (!groups.some((g) => g.gain > 0)) return undefined;
  return { model: typeof raw.model === "string" ? raw.model : undefined, groups };
}
