// Priority areas: the zone snapshot sorted by rank. Class, TPI and people
// come from the data; nothing is recomputed here.
import { zoneLabelPoint } from "@/lib/layers";
import { finite } from "./format";
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
  at: [number, number] | null; // pin position: center of the zone polygon
}

export const LIST_COLLAPSED = 5;
export const MAX_PINS = 10;

export function priorityAreas(bundle: CcBundle | undefined): PriorityArea[] {
  const features = bundle?.zones?.features ?? [];
  const rows = features
    .map((f) => ({ p: (f.properties ?? {}) as Record<string, unknown>, at: zoneLabelPoint(f) }))
    .filter((x) => finite(x.p.rank))
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
      cls: typeof p.class === "string" ? p.class : "",
      tpi: finite(p.tpi) ? p.tpi : null,
      hazard: typeof p.hazard === "string" ? p.hazard : "",
      areaKm2: finite(p.area_km2) ? p.area_km2 : null,
      people: finite(p.people) ? p.people : null,
      at,
    };
  });
}

export const pinAreas = (areas: PriorityArea[]): PriorityArea[] =>
  areas.filter((a) => a.at !== null).slice(0, MAX_PINS);
