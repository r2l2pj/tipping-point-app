// The two tiles of the Situation panel. Values come from the metrics, the
// summary or the zone snapshot; a missing value is never shown as 0.
import { availability, missingText } from "./availability";
import { priorityAreas } from "./areas";
import { finite, fmtBrt, fmtDate, fmtKm2, fmtPeople } from "./format";
import type { CcBundle, Hazard } from "./types";

export interface Tile {
  label: string;
  value: string; // formatted value, or the missing-data text
  missing: boolean;
  note?: string; // for example "in priority zones"
  asOf?: string; // "as of <date>"
  dimmed: boolean; // the selected step is not the day of the snapshot
}

const snapshot = (bundle: CcBundle): { iso?: string; text?: string } => {
  if (bundle.mode === "live") {
    const iso = bundle.summary?.generated_at ?? bundle.updated_at;
    return { iso, text: iso ? fmtBrt(iso) : undefined };
  }
  const iso = bundle.reference_date;
  return { iso, text: iso ? fmtDate(iso) : undefined };
};

const finish = (
  bundle: CcBundle,
  stepDate: string | undefined,
  label: string,
  value: number | undefined,
  format: (v: unknown) => string,
  missingKey: string,
  note?: string
): Tile => {
  const snap = snapshot(bundle);
  const missing = !finite(value);
  return {
    label,
    value: missing ? missingText(availability(bundle, missingKey)) : format(value),
    missing,
    note: missing ? undefined : note,
    asOf: missing ? undefined : snap.text,
    dimmed: !missing && !!stepDate && !!snap.iso && stepDate.slice(0, 10) !== snap.iso.slice(0, 10),
  };
};

export function criticalAreaTile(bundle: CcBundle, hazard: Hazard, stepDate?: string): Tile {
  const label = "Critical area";
  if (bundle.mode === "live") {
    const km2 = bundle.summary?.critical_km2;
    const byHazard = km2?.[hazard];
    return finite(byHazard)
      ? finish(bundle, stepDate, label, byHazard, fmtKm2, "summary", `${hazard === "flood" ? "flood" : "landslide"} hazard`)
      : finish(bundle, stepDate, label, km2?.any, fmtKm2, "summary", "any hazard");
  }
  const fromMetrics = bundle.metricsView?.critical_area_km2;
  if (finite(fromMetrics)) return finish(bundle, stepDate, label, fromMetrics, fmtKm2, "critical_area_km2");
  const critical = priorityAreas(bundle).filter((a) => a.cls === "Critical");
  const known = critical.filter((a) => a.areaKm2 !== null);
  const sum = bundle.zones && known.length === critical.length && critical.length > 0
    ? known.reduce((acc, a) => acc + (a.areaKm2 as number), 0)
    : undefined;
  return finish(bundle, stepDate, label, sum, fmtKm2,
    bundle.zones ? "critical_area_km2" : "priority_zones", "in priority zones");
}

export function peopleTile(bundle: CcBundle, stepDate?: string): Tile {
  const label = "People potentially exposed";
  if (bundle.mode === "live") {
    const s = bundle.summary;
    return finish(bundle, stepDate, label, s?.people_critical ?? s?.people_exposed, fmtPeople, "summary");
  }
  const fromMetrics = bundle.metricsView?.people_critical;
  if (finite(fromMetrics)) return finish(bundle, stepDate, label, fromMetrics, fmtPeople, "people_critical");
  // Zone sum only when every Critical zone reports people.
  const critical = priorityAreas(bundle).filter((a) => a.cls === "Critical");
  const sum = critical.length > 0 && critical.every((a) => a.people !== null)
    ? critical.reduce((acc, a) => acc + (a.people as number), 0)
    : undefined;
  return finish(bundle, stepDate, label, sum, fmtPeople, "people_critical", "in priority zones");
}

// The zone snapshot has one date. Off that day the list is dimmed.
export function zoneSnapshot(bundle: CcBundle, stepDate?: string): { asOf?: string; dimmed: boolean } {
  const snap = snapshot(bundle);
  return {
    asOf: snap.text,
    dimmed: !!stepDate && !!snap.iso && stepDate.slice(0, 10) !== snap.iso.slice(0, 10),
  };
}
