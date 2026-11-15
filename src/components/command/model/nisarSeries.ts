// L42: NISAR radar time series over the WA case (lead-analysis
// data/wa_2025/nisar_timeseries.json, listed as products.nisar_timeseries):
// HH (and HV) backscatter in dB over the flood candidates vs control areas
// on the reference, pre-event and post-event passes, plus the three frames.
// Rendered only when the product is present.
import { assetUrl, fmtDate } from "@/lib/layers";
import { canonicalCaseId } from "@/lib/contract";
import type { CcBundle } from "./types";

type M = Record<string, unknown>;
const isRecord = (v: unknown): v is M => typeof v === "object" && v !== null && !Array.isArray(v);
const nums = (v: unknown): (number | null)[] | undefined =>
  Array.isArray(v) ? v.map((x) => (typeof x === "number" && Number.isFinite(x) ? x : null)) : undefined;

// What the server keeps of the product (page budget).
export interface NisarSeriesRaw {
  dates: string[];
  roles?: Record<string, string>;
  units?: string;
  areas: Record<string, { label?: string; hh_db?: (number | null)[]; hv_db?: (number | null)[]; km2?: number }>;
  frames?: { date: string; layer_id?: string; png?: string }[];
  reading?: Record<string, string>;
  readingLine?: string;
  geometryNote?: string;
  // dates whose pass has a different orbit/geometry than the change pair
  otherGeometry?: string[];
  status?: string;
}

export function slimNisarSeries(raw: unknown): NisarSeriesRaw | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.dates) || !isRecord(raw.areas)) return undefined;
  const dates = raw.dates.filter((d): d is string => typeof d === "string");
  if (dates.length < 2) return undefined;
  const areas: NisarSeriesRaw["areas"] = {};
  for (const [id, a] of Object.entries(raw.areas)) {
    if (!isRecord(a)) continue;
    const hh = nums(a.hh_db);
    if (!hh || hh.length !== dates.length) continue;
    const hv = nums(a.hv_db);
    areas[id] = {
      label: typeof a.label === "string" ? a.label : id.replace(/_/g, " "),
      hh_db: hh,
      hv_db: hv && hv.length === dates.length ? hv : undefined,
      km2: typeof a.km2 === "number" ? a.km2 : undefined,
    };
  }
  if (!Object.keys(areas).length) return undefined;
  return {
    dates,
    roles: isRecord(raw.roles) ? (raw.roles as Record<string, string>) : undefined,
    units: typeof raw.units === "string" ? raw.units : undefined,
    areas,
    frames: Array.isArray(raw.frames)
      ? raw.frames.filter(isRecord).map((f) => ({
          date: String(f.date ?? ""),
          layer_id: typeof f.layer_id === "string" ? f.layer_id : undefined,
          png: typeof f.png === "string" ? f.png : undefined,
        }))
      : undefined,
    reading: isRecord(raw.reading) ? (raw.reading as Record<string, string>) : undefined,
    readingLine: typeof raw.reading_line === "string" ? raw.reading_line : undefined,
    geometryNote: typeof raw.geometry_note === "string" ? raw.geometry_note : undefined,
    otherGeometry: Array.isArray(raw.passes)
      ? raw.passes.filter((p): p is M => isRecord(p) && p.same_geometry === false && typeof p.date === "string").map((p) => p.date as string)
      : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
  };
}

export interface SeriesLine { id: string; label: string; hh: (number | null)[]; hv?: (number | null)[]; flood: boolean }
export interface NisarSeriesView {
  dates: string[]; // "Nov 10" labels
  roles: string[];
  units: string;
  lines: SeriesLine[];
  min: number;
  max: number;
  frames: { label: string; role?: string; url: string }[];
  reading?: string;
  geometryNote?: string;
  otherGeometry: boolean[]; // per date: a pass from another orbit (hollow point)
  status?: string;
}

export function nisarSeriesView(bundle: CcBundle): NisarSeriesView | undefined {
  const s = bundle.nisarSeries;
  if (!s) return undefined;
  const lines: SeriesLine[] = Object.entries(s.areas).map(([id, a]) => ({
    id,
    label: a.label ?? id,
    hh: a.hh_db ?? [],
    hv: a.hv_db,
    flood: id === "flood_candidates",
  })).sort((a, b) => Number(b.flood) - Number(a.flood));
  const all = lines.flatMap((l) => l.hh).filter((v): v is number => v !== null);
  if (!all.length) return undefined;
  const caseDir = canonicalCaseId(bundle.manifest?.event ?? bundle.id);
  const layers = bundle.manifest?.layers ?? [];
  const frames = (s.frames ?? []).flatMap((f) => {
    const layer = f.layer_id ? layers.find((l) => l.id === f.layer_id) : undefined;
    const url = assetUrl(caseDir, layer?.png ?? f.png);
    return url ? [{ label: fmtDate(f.date), role: s.roles?.[f.date], url }] : [];
  });
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = Math.max(0.5, (hi - lo) * 0.1);
  return {
    dates: s.dates.map((d) => fmtDate(d).replace(/,\s*\d{4}$/, "")),
    roles: s.dates.map((d) => s.roles?.[d] ?? ""),
    units: s.units ?? "dB",
    lines,
    min: lo - pad,
    max: hi + pad,
    frames,
    reading: s.readingLine ?? s.reading?.flood_candidates,
    geometryNote: s.geometryNote,
    otherGeometry: s.dates.map((d) => (s.otherGeometry ?? []).includes(d)),
    status: s.status,
  };
}

// L42: lead-analysis's double-bounce test (data/wa_2025/nisar_hypothesis.json).
export interface NisarHypothesis { verdict: string; enrichment?: number; recallOpen?: number; recallUrban?: number }
export function slimHypothesis(raw: unknown): NisarHypothesis | undefined {
  if (!isRecord(raw) || typeof raw.verdict !== "string") return undefined;
  const e = isRecord(raw.enrichment) ? raw.enrichment : {};
  const r = isRecord(raw.recall_by_group) ? raw.recall_by_group : {};
  const rec = (g: string) => (isRecord(r[g]) && typeof (r[g] as M).recall === "number" ? (r[g] as M).recall as number : undefined);
  return {
    verdict: raw.verdict,
    enrichment: typeof e.enrichment_missed_vs_detected === "number" ? e.enrichment_missed_vs_detected : undefined,
    recallOpen: rec("open"),
    recallUrban: rec("urban"),
  };
}
// "Test (WA Dec 2025): our misses are 8.6× more likely in towns and forest,
// where water doesn't turn dark — recall 25% in open fields vs 3% in towns."
export function hypothesisLine(bundle: CcBundle): string | undefined {
  const h = bundle.nisarHypothesis;
  if (!h || h.verdict !== "supported" || h.enrichment === undefined) return undefined;
  const where = canonicalCaseId(bundle.manifest?.event ?? bundle.id) === "wa_2025" ? "Test (WA Dec 2025)" : "Test (this event)";
  const recall = h.recallOpen !== undefined && h.recallUrban !== undefined
    ? ` — recall ${Math.round(h.recallOpen * 100)}% in open fields vs ${Math.round(h.recallUrban * 100)}% in towns`
    : "";
  return `${where}: our misses are ${h.enrichment.toFixed(1)}× more likely in towns and forest, where water doesn't turn dark${recall}.`;
}
