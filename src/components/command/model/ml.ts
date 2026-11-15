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
export const FEW_POSITIVES = 30; // WA 2025: 8 dated reports (8–24 positive samples by horizon)

export interface MlRow {
  model: string;
  label: string;
  n?: number;
  nPos?: number;
  cells: { precision: string; recall: string; f1: string; prAuc: string; rocAuc: string };
  missing: boolean; // no n: no numbers
}

export interface MlTable {
  rows: MlRow[];
  baseLine?: string; // "Base rate 3.8% (38 of 988 test samples)"
  fewPositives?: boolean;
  reason?: string;
}

export interface MlView {
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
}

// lead-ml's caveats, in plain words (conductor). The event list and the
// low-skill horizons come from the export; the rest is the setup lead-ml
// documented (split.3b: trained on the dated 2015-2018 catalog, TEST =
// unseen 2024-2025 events).
export function mlCaveats(v: MlView): string[] {
  const ev = v.testEvents;
  const rs = ev.includes("rs_2024");
  const wa = ev.includes("wa_2025");
  const tested = rs && wa
    ? "The TEST is essentially ONE event — Rio Grande do Sul, May 2024 — plus 8 dated landslide reports from Washington 2025: few events, so these scores can move a lot."
    : ev.length
      ? `The TEST covers only ${ev.length} event${ev.length === 1 ? "" : "s"}: few events, so these scores can move a lot.`
      : "The TEST covers few events: these scores can move a lot.";
  const out = [
    tested,
    "Trained on the 2015–2018 landslide catalog; tested on 2024–2025 events it never saw.",
    "Rain decides WHEN a landslide is triggered (the table above); the terrain model decides WHERE (T_ML, below).",
  ];
  if (v.lowSkill.length) out.push(`${v.lowSkill.join(" and ")} horizons rely on long-range forecast: low skill.`);
  return out;
}

const score = (v: unknown) => (finite(v) ? v.toFixed(2) : "—");
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

function row(model: string, label: string, t: unknown): MlRow | undefined {
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
    missing: !ok,
  };
}

function table(models: string[], labels: Record<string, string>, pick: (m: string) => unknown): MlTable {
  const rows = models.map((m) => row(m, labels[m] ?? FALLBACK_LABEL[m] ?? m, pick(m))).filter((r): r is MlRow => !!r);
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
    labels[served] = `${labels[served] ?? served.replace(/_/g, " ")} — the model on the map`;
  }
  // The served model replaces xgb_all (not served); random forest and the
  // slope rule stay as comparisons on the same TEST blocks (conductor).
  const whereModels = served ? [served, "rf_all", "rule_slope"] : T_ML_MODELS;
  const split = isRecord(card.split) ? card.split : {};
  const where = tml ? table(whereModels, labels, (m) => tml[m]) : undefined;
  const trig = isRecord(card.trigger) ? card.trigger : {};
  const horizons = HORIZON_ORDER.filter((h) => isRecord(trig[h]));
  const sources = ["gfs", "perfect"].filter((s) => horizons.some((h) => isRecord((trig[h] as M)[s])));
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
      when[`${h}|${s}`] = table(TRIGGER_MODELS, labels, (m) => (isRecord(block[m]) ? (block[m] as M).test : undefined));
      if (caseId) {
        const ev = table(TRIGGER_MODELS, labels, (m) => {
          const b = block[m];
          return isRecord(b) && isRecord(b.by_event) ? (b.by_event as M)[caseId] : undefined;
        });
        if (ev.rows.length) event[`${h}|${s}`] = ev;
      }
    }
  }
  const view: MlView = {
    split3a: typeof split["3a"] === "string" ? split["3a"] : undefined,
    split3b: typeof split["3b"] === "string" ? split["3b"] : undefined,
    where: where && where.rows.length ? where : undefined,
    horizons,
    sources,
    lowSkill: Array.isArray(card.low_skill_horizons) ? card.low_skill_horizons.filter((x): x is string => typeof x === "string") : [],
    when,
    event,
    eventId: caseId && Object.keys(event).length ? caseId : undefined,
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
