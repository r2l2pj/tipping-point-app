// Priority areas: the zone snapshot, most severe first. Class, TPI and
// people come from the data; only the order and the list number are set here.
import { zoneLabelPoint } from "@/lib/layers";
import { OBSERVED_CLASS, observedOnlyZone, tpiOnlyZone } from "@/lib/zones";
import { classLabel, finite } from "./format";
import { nextLookText, nextPassOf } from "./nextPass";
import type { CcBundle } from "./types";

export interface PriorityArea {
  // Position in the list, 1 = most severe. It is the number on the row and
  // on the map pin, and the id of a selection.
  rank: number;
  dataRank: number; // `rank` of the data file (the pipeline ranks by people)
  name: string;
  label: string; // name, plus the list number when several zones share the name
  cls: string;
  tpi: number | null;
  hazard: string;
  areaKm2: number | null;
  people: number | null; // null: not published. Never read as 0.
  // Conductor guard: a published but impossible count (negative, raster fill
  // like -1e40, above world population) renders as "—", never as a number.
  peopleInvalid?: boolean;
  nextLook?: string; // L43: "Next NISAR look: …" (zone next_nisar_pass_utc)
  at: [number, number] | null; // pin position: center of the zone polygon
}

export const LIST_COLLAPSED = 5;

// Jhonatan: a count is read against its area. Impossible counts (negative,
// fill, above world population, or denser than any real place) are not shown.
export const MAX_DENSITY_PER_KM2 = 60_000;
function peopleOk(p: Record<string, unknown>): boolean {
  const n = p.people;
  if (!finite(n) || n < 0 || n > 8e9) return false;
  const a = p.area_km2;
  return !(finite(a) && a > 0 && n / a > MAX_DENSITY_PER_KM2);
}
export const MAX_PINS = 10;

// Order of the list: an observed flood first (it is on the ground already),
// then the risk classes from Critical down. The data file ranks by people,
// which put a High area above a Critical one and left the TPI column
// jumping up and down the list.
const SEVERITY: Record<string, number> = { [OBSERVED_CLASS]: 5, Critical: 4, High: 3, Moderate: 2, Low: 1 };
export const severityOf = (cls: string): number => SEVERITY[cls] ?? 0;

export function priorityAreas(bundle: CcBundle | undefined): PriorityArea[] {
  const features = bundle?.zones?.features ?? [];
  const rows = features
    .map((f) => ({ p: (f.properties ?? {}) as Record<string, unknown>, at: zoneLabelPoint(f) }))
    .filter((x) => finite(x.p.rank))
    // An unverified live run: municipalities flagged only by the TPI are
    // held back with the rest of the risk outputs.
    .filter((x) => !(bundle?.riskPaused && tpiOnlyZone(x.p)))
    .sort((a, b) => (a.p.rank as number) - (b.p.rank as number));
  const count = new Map<string, number>();
  for (const { p } of rows) {
    const name = String(p.name ?? "") || `Area ${p.rank}`;
    count.set(name, (count.get(name) ?? 0) + 1);
  }
  const classOf = (p: Record<string, unknown>) =>
    // Seen only by satellite: an observation, never a risk class.
    observedOnlyZone(p) ? OBSERVED_CLASS : typeof p.class === "string" ? classLabel(p.class) : "";
  const tpiOf = (p: Record<string, unknown>) =>
    observedOnlyZone(p) ? null : finite(p.tpi) ? p.tpi : null;
  return rows
    .map(({ p, at }) => {
      const name = String(p.name ?? "") || `Area ${p.rank}`;
      return {
        dataRank: p.rank as number,
        name,
        label: name,
        cls: classOf(p),
        tpi: tpiOf(p),
        hazard: typeof p.hazard === "string" ? p.hazard : "",
        areaKm2: finite(p.area_km2) ? p.area_km2 : null,
        people: peopleOk(p) ? (p.people as number) : null,
        ...(p.people != null && !peopleOk(p) ? { peopleInvalid: true } : {}),
        ...(nextLookText(nextPassOf(p)) ? { nextLook: nextLookText(nextPassOf(p)) } : {}),
        at,
      };
    })
    // Class, then TPI, then the data rank (already ascending: the sort is stable).
    .sort((a, b) => severityOf(b.cls) - severityOf(a.cls) || (b.tpi ?? -1) - (a.tpi ?? -1))
    .map((a, i) => ({ rank: i + 1, ...a }))
    .map((a) => ({ ...a, label: (count.get(a.name) ?? 0) > 1 ? `${a.name} #${a.rank}` : a.name }));
}

export const pinAreas = (areas: PriorityArea[]): PriorityArea[] =>
  areas.filter((a) => a.at !== null).slice(0, MAX_PINS);
