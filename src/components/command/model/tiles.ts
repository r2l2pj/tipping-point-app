// The two tiles of the Situation panel. Values come from the metrics, the
// summary or the zone snapshot; a missing value is never shown as 0.
import { count, liveCriticalKm2, liveSummaryV2 } from "@/lib/contract";
import type { DayPoint, ManifestLayer } from "@/lib/types";
import { availability, missingText } from "./availability";
import { priorityAreas } from "./areas";
import { finite, fmtBrt, fmtDate, fmtKm2, fmtPeople } from "./format";
import { RISK_PAUSED_SHORT, type CcBundle, type Hazard } from "./types";

const pausedTile = (label: string): Tile =>
  ({ label, value: RISK_PAUSED_SHORT, missing: true, dimmed: false });

export interface Tile {
  label: string;
  value: string; // formatted value, or the missing-data text
  missing: boolean;
  note?: string; // for example "in priority zones"
  asOf?: string; // "as of <date>"
  dimmed: boolean; // the selected step is not the day of the snapshot
  title?: string; // tooltip on the value
}

const snapshot = (bundle: CcBundle): { iso?: string; text?: string } => {
  if (bundle.mode === "live") {
    const iso = bundle.summary?.generated_at ?? bundle.updated_at;
    return { iso, text: iso ? fmtBrt(iso) : undefined };
  }
  const iso = bundle.reference_date;
  return { iso, text: iso ? fmtDate(iso) : undefined };
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

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

// Critical zones by the class of the data, in any letter case.
const isCritical = (a: { cls: string }): boolean => /^critical$/i.test(a.cls);

// While only the trimmed inline zones are loaded the sum covers those zones
// only, and the note says so.
const zoneNote = (bundle: CcBundle, count: number): string =>
  bundle.zonesTrimmed ? `in the ${count} top-ranked priority zones` : "in priority zones";

// A value of the selected day: its date is the step, so it is never dimmed.
const dayTile = (label: string, value: string, date: string, note?: string): Tile => ({
  label, value, missing: false, note, asOf: fmtDate(date), dimmed: false,
});

// Per-hazard split of the day, with the chosen hazard first.
const splitNote = (day: DayPoint, hazard: Hazard): string | undefined => {
  const parts: Record<Hazard, string | undefined> = {
    slide: finite(day.critical_slide_km2) ? `landslide ${fmtKm2(day.critical_slide_km2)}` : undefined,
    flood: finite(day.critical_flood_km2) ? `flood ${fmtKm2(day.critical_flood_km2)}` : undefined,
  };
  const order: Hazard[] = hazard === "flood" ? ["flood", "slide"] : ["slide", "flood"];
  const text = order.map((h) => parts[h]).filter(Boolean).join(" · ");
  return text || undefined;
};

// Order of sources (same as the old ALERT card on main): the value of the
// selected day, else the metrics scalar with its date, else the labelled sum
// over the priority zones.
// Replay "forecast issued this day": the tiles follow the GFS frame on the
// map (lead-analysis adds critical_km2 / people_critical per GFS layer);
// until a frame carries them the tile says so, never the observed day's 0.
export const FRAME_FIGURES_PENDING = "pending for this forecast frame";

const frameNote = (frame: ManifestLayer): string =>
  `forecast for ${fmtDate(frame.date ?? "")}${frame.issued ? ` (issued ${fmtDate(frame.issued)})` : ""}`;

function frameTile(label: string, frame: ManifestLayer, value: number | undefined, fmt: (v: number) => string): Tile {
  return finite(value)
    ? { label, value: fmt(value), missing: false, note: frameNote(frame), dimmed: false }
    : { label, value: FRAME_FIGURES_PENDING, missing: true, note: frameNote(frame), dimmed: false };
}

const frameField = (frame: ManifestLayer, key: string): unknown => (frame as unknown as Record<string, unknown>)[key];

export function criticalAreaTile(bundle: CcBundle, hazard: Hazard, stepDate?: string, day?: DayPoint, frame?: ManifestLayer): Tile {
  const label = "Critical area";
  if (frame && bundle.mode === "replay") {
    const v = frameField(frame, "critical_km2");
    return frameTile(label, frame, finite(v) ? v : undefined, fmtKm2);
  }
  if (bundle.mode === "live" && bundle.riskPaused) return pausedTile(label);
  if (bundle.mode !== "live" && day && finite(day.critical_km2)) {
    return dayTile(label, fmtKm2(day.critical_km2), day.date,
      splitNote(day, hazard) ?? "landslide or flood");
  }
  const scalar = bundle.metricsView?.critical_km2;
  if (bundle.mode !== "live" && finite(scalar)) {
    const iso = bundle.metricsView?.critical_km2_date;
    return {
      label, value: fmtKm2(scalar), missing: false, note: "landslide or flood",
      asOf: iso ? fmtDate(iso) : undefined,
      dimmed: !!iso && !!stepDate && stepDate.slice(0, 10) !== iso.slice(0, 10),
    };
  }
  if (bundle.mode === "live") {
    // Critical only, per hazard (summary v1 or v2; see liveCriticalKm2).
    const own = bundle.summary?.critical_km2?.[hazard];
    const value = liveCriticalKm2(bundle.summary, hazard);
    const v3 = isRecord((bundle.summary as Record<string, unknown> | undefined)?.alert_km2);
    const note = (liveSummaryV2(bundle.summary) || finite(own) || v3
      ? `${hazard === "flood" ? "flood" : "landslide"} hazard` : "any hazard") +
      // lead-analysis v3: areas count Brazilian land only (stats_domain).
      (v3 ? " · Brazilian land only" : "");
    return finish(bundle, stepDate, label, value, fmtKm2, "summary", note);
  }
  const fromMetrics = bundle.metricsView?.critical_area_km2;
  if (finite(fromMetrics)) return finish(bundle, stepDate, label, fromMetrics, fmtKm2, "critical_area_km2");
  const critical = priorityAreas(bundle).filter(isCritical);
  const known = critical.filter((a) => a.areaKm2 !== null);
  const sum = bundle.zones && known.length === critical.length && critical.length > 0
    ? known.reduce((acc, a) => acc + (a.areaKm2 as number), 0)
    : undefined;
  return finish(bundle, stepDate, label, sum, fmtKm2,
    bundle.zones ? "critical_area_km2" : "priority_zones", zoneNote(bundle, critical.length));
}

// Conductor: replay counts come from GPW resampled to ~1 km, ~12% low —
// shown as lower bounds ("at least 1,488,833"); Now counts stay exact.
export const PEOPLE_LOWER_BOUND_TITLE = "GPW ~1 km resample, ~12% low";
export const atLeast = (v: unknown): string => `at least ${Math.floor(Number(v)).toLocaleString("en-US")}`;

export function peopleTile(bundle: CcBundle, stepDate?: string, day?: DayPoint, frame?: ManifestLayer): Tile {
  const label = "People potentially exposed";
  const replay = bundle.mode === "replay";
  const t = peopleTileRaw(bundle, stepDate, day, frame, label, replay ? atLeast : fmtPeople);
  return replay && !t.missing ? { ...t, title: PEOPLE_LOWER_BOUND_TITLE } : t;
}

function peopleTileRaw(bundle: CcBundle, stepDate: string | undefined, day: DayPoint | undefined, frame: ManifestLayer | undefined, label: string,
  fmtPeople: (v: unknown) => string): Tile {
  if (frame && bundle.mode === "replay") {
    // Exact count as a lower bound (no silent rounding to hundreds).
    return frameTile(label, frame, count(frameField(frame, "people_critical")), (n) => fmtPeople(n));
  }
  if (bundle.mode === "live" && bundle.riskPaused) return pausedTile(label);
  // count() drops raster fill values and negatives: not data.
  const ofDay = bundle.mode !== "live" ? count(day?.people_critical) : undefined;
  if (day && ofDay !== undefined) return dayTile(label, fmtPeople(ofDay), day.date);
  if (bundle.mode === "live") {
    const s = bundle.summary;
    // v3 (alert_km2 present): people_critical = Critical only, today or D+1.
    const v3 = isRecord((s as Record<string, unknown> | undefined)?.alert_km2);
    return finish(bundle, stepDate, label, s?.people_critical ?? s?.people_exposed, fmtPeople, "summary",
      v3 && finite(s?.people_critical) ? "in Critical areas, today or tomorrow" : undefined);
  }
  const fromMetrics = bundle.metricsView?.people_critical;
  if (finite(fromMetrics)) return finish(bundle, stepDate, label, fromMetrics, fmtPeople, "people_critical");
  // Zone sum only when every Critical zone reports people.
  const critical = priorityAreas(bundle).filter(isCritical);
  const sum = critical.length > 0 && critical.every((a) => a.people !== null)
    ? critical.reduce((acc, a) => acc + (a.people as number), 0)
    : undefined;
  return finish(bundle, stepDate, label, sum, fmtPeople, "people_critical", zoneNote(bundle, critical.length));
}

// The zone snapshot has one date. Off that day the list is dimmed.
export function zoneSnapshot(bundle: CcBundle, stepDate?: string): { asOf?: string; dimmed: boolean; iso?: string } {
  const snap = snapshot(bundle);
  return {
    asOf: snap.text,
    iso: snap.iso,
    dimmed: !!stepDate && !!snap.iso && stepDate.slice(0, 10) !== snap.iso.slice(0, 10),
  };
}
