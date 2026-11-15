// City search (Lucas): lead-analysis data/now/places.json
// (schema tipping-point/places@1, listed as now products.places). Loaded in
// the browser on first use of the search box — ~1,300 municipalities would
// not fit the page budget.
type M = Record<string, unknown>;
const isRecord = (v: unknown): v is M => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const nums = (v: unknown): (number | null)[] => (Array.isArray(v) ? v.slice(0, 4).map(num) : []);

export type Bbox = [number, number, number, number];

export interface HazardDays { cls: (number | null)[]; max: (number | null)[] }
export interface Place {
  id: string;
  name: string;
  uf: string;
  centroid: [number, number];
  bbox: Bbox;
  pop: number | null;
  flood: HazardDays;
  slide: HazardDays;
  pTrigger: Record<string, { max: number | null; p90: number | null } | null>;
  alert: boolean;
  alertLevel: string | null;
  alertHazard: string | null;
  peopleHigh: number | null;
  key: string; // normalized "name uf" for search
}
export interface Places { dates: string[]; generatedAt?: string; nowUpdatedAt?: string; places: Place[] }

// "São José dos Pinhais" -> "sao jose dos pinhais"
export const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const hazard = (v: unknown): HazardDays => (isRecord(v) ? { cls: nums(v.cls), max: nums(v.max) } : { cls: [], max: [] });

export function parsePlaces(raw: unknown): Places | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.places)) return undefined;
  const d = isRecord(raw.dates) ? raw.dates : {};
  const dates = ["d0", "d1", "d2", "d3"].map((k) => (typeof d[k] === "string" ? (d[k] as string) : "")).filter(Boolean);
  const places = raw.places.flatMap((p): Place[] => {
    if (!isRecord(p) || typeof p.name !== "string") return [];
    const c = Array.isArray(p.centroid) && p.centroid.length === 2 ? (p.centroid as [number, number]) : null;
    const b = Array.isArray(p.bbox) && p.bbox.length === 4 ? (p.bbox as Bbox) : null;
    if (!c || !b) return [];
    const pt = isRecord(p.p_trigger) ? p.p_trigger : {};
    const uf = typeof p.uf === "string" ? p.uf : "";
    return [{
      id: String(p.id ?? `${p.name}-${uf}`),
      name: p.name,
      uf,
      centroid: c,
      bbox: b,
      pop: num(p.pop),
      flood: hazard(p.flood),
      slide: hazard(p.slide),
      pTrigger: Object.fromEntries(["24h", "48h", "72h", "7d"].map((h) => {
        const v = pt[h];
        return [h, isRecord(v) ? { max: num(v.max), p90: num(v.p90) } : null];
      })),
      alert: p.alert === true,
      alertLevel: typeof p.alert_level === "string" ? p.alert_level : null,
      alertHazard: typeof p.alert_hazard === "string" ? p.alert_hazard : null,
      peopleHigh: num(p.people_high),
      key: fold(`${p.name} ${uf}`),
    }];
  });
  return {
    dates,
    generatedAt: typeof raw.generated_at === "string" ? raw.generated_at : undefined,
    nowUpdatedAt: typeof raw.now_updated_at === "string" ? raw.now_updated_at : undefined,
    places,
  };
}

// Fuzzy, accent-insensitive: every query word must match a word prefix
// (best), a substring, or — for words of 4+ letters — an in-order
// subsequence of one word (typos like "florinopolis"). Ranked by match
// quality, then by population.
export function searchPlaces<P extends Place>(list: readonly P[], query: string, limit = 8): P[] {
  const q = fold(query);
  if (!q) return [];
  const qWords = q.split(" ");
  const scored: { p: P; s: number }[] = [];
  for (const p of list) {
    const words = p.key.split(" ");
    let s = 0;
    let ok = true;
    for (const w of qWords) {
      if (words.some((x) => x === w)) s += 4;
      else if (words.some((x) => x.startsWith(w))) s += 3;
      else if (p.key.includes(w)) s += 2;
      else if (w.length >= 4 && words.some((x) => subseq(w, x))) s += 1;
      else { ok = false; break; }
    }
    if (!ok) continue;
    if (p.key.startsWith(q)) s += 3;
    if (fold(p.name) === q) s += 5; // the exact name beats a longer one
    scored.push({ p, s });
  }
  return scored
    .sort((a, b) => b.s - a.s || (b.p.pop ?? 0) - (a.p.pop ?? 0) || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => x.p);
}

function subseq(needle: string, hay: string): boolean {
  if (needle.length > hay.length + 1) return false;
  let i = 0;
  for (const ch of hay) if (i < needle.length && ch === needle[i]) i++;
  return needle.length - i <= 1 && Math.abs(hay.length - needle.length) <= 3;
}

export const CLASS_NAMES = ["Low", "Moderate", "High", "Critical"];
export const CLASS_COLORS = ["#ffffb2", "#fecc5c", "#fd8d3c", "#bd0026"];
export const className = (c: number | null): string => (c === null ? "no data" : CLASS_NAMES[c] ?? "no data");
