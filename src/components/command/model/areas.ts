// Priority areas: the zone snapshot sorted by rank. Class, TPI and people
// come from the data; nothing is recomputed here.
import { zoneLabelPoint } from "@/lib/layers";
import { OBSERVED_CLASS, observedOnlyZone, tpiOnlyZone } from "@/lib/zones";
import { classLabel, finite } from "./format";
import { nextLookText, nextPassOf } from "./nextPass";
import type { CcBundle } from "./types";

export interface PriorityArea {
  rank: number;
  name: string;
  label: string; // name, plus the rank when several zones share the name
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
    const name = String(p.name ?? "");
    count.set(name, (count.get(name) ?? 0) + 1);
  }
  return rows.map(({ p, at }) => {
    const name = String(p.name ?? "") || `Area ${p.rank}`;
    return {
      rank: p.rank as number,
      name,
      label: (count.get(String(p.name ?? "")) ?? 0) > 1 ? `${name} #${p.rank}` : name,
      // Seen only by satellite: an observation, never a risk class.
      cls: observedOnlyZone(p) ? OBSERVED_CLASS : typeof p.class === "string" ? classLabel(p.class) : "",
      tpi: observedOnlyZone(p) ? null : finite(p.tpi) ? p.tpi : null,
      hazard: typeof p.hazard === "string" ? p.hazard : "",
      areaKm2: finite(p.area_km2) ? p.area_km2 : null,
      people: peopleOk(p) ? (p.people as number) : null,
      ...(p.people != null && !peopleOk(p) ? { peopleInvalid: true } : {}),
      ...(nextLookText(nextPassOf(p)) ? { nextLook: nextLookText(nextPassOf(p)) } : {}),
      at,
    };
  });
}

export const pinAreas = (areas: PriorityArea[]): PriorityArea[] =>
  areas.filter((a) => a.at !== null).slice(0, MAX_PINS);
