// Alert list of the Public Alerts view. Built on the server (the loader),
// because candidatesToAlerts reads the clock when no issue time is given.
// Wraps src/lib/alerts.ts; takes over the sort order of the old alerts page.
import { alertDataDates, candidatesToAlerts, type AlertCardData } from "@/lib/alerts";
import type { AlertsFile } from "@/lib/types";
import { finite, fmtBrt, fmtKm2 } from "./format";
import type { CcBundle } from "./types";

export type AlertListState = "alerts" | "none" | "unavailable" | "paused";

export interface AlertList {
  state: AlertListState;
  alerts: AlertCardData[];
  // Time of the data, or the last known run time when unavailable.
  dataTime?: string;
  // Set by capAlertList: the full count and the region rows of ALL alerts,
  // when only the first cards are sent to the browser.
  total?: number;
  regions?: RegionRow[];
}

// Cards sent to the browser. The live run can raise hundreds of candidates
// (541 on 2026-11-15 = 303 KB of page); the panel shows the most severe
// cards, says how many more there are, and keeps exact counts per region.
export const ALERTS_SHOWN = 20;

export function capAlertList(list: AlertList, n = ALERTS_SHOWN): AlertList {
  if (list.alerts.length <= n) return list;
  return {
    ...list,
    alerts: list.alerts.slice(0, n),
    total: list.alerts.length,
    regions: alertsByRegion(list.alerts),
  };
}

export const moreAlertsText = (list: AlertList): string | undefined => {
  const more = (list.total ?? list.alerts.length) - list.alerts.length;
  return more > 0 ? `and ${more} more ${more === 1 ? "alert" : "alerts"} of the same run` : undefined;
};

const LEVEL_ORDER: Record<string, number> = { emergency: 0, warning: 1, watch: 2 };

export const sortAlerts = (alerts: AlertCardData[]): AlertCardData[] =>
  [...alerts].sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9));

// `now`: the live bundle, or null/undefined when it failed to load.
// `legacy`: the legacy alerts@1 file, or null/undefined when not published.
export function buildAlertList(input: {
  now?: CcBundle | null;
  legacy?: AlertsFile | null;
}): AlertList {
  const { now, legacy } = input;
  const dataTime = now?.updated_at ?? now?.summary?.generated_at;
  const candidates = now?.nowAlerts?.candidates;
  // The run marked itself paused (checks failed): no card from it.
  if (now?.nowAlerts?.paused === true) return { state: "paused", alerts: [], dataTime };
  if (now && Array.isArray(candidates)) {
    const alerts = candidatesToAlerts(candidates, {
      places: now.places ?? now.municipalities,
      issuedAt: dataTime,
      dataDates: alertDataDates(now.data_dates),
    });
    return alerts.length
      ? { state: "alerts", alerts: sortAlerts(alerts), dataTime }
      : { state: "none", alerts: [], dataTime };
  }
  if (legacy && Array.isArray(legacy.alerts)) {
    return legacy.alerts.length
      ? { state: "alerts", alerts: sortAlerts(legacy.alerts), dataTime }
      : { state: "none", alerts: [], dataTime };
  }
  return { state: "unavailable", alerts: [], dataTime };
}

export const NO_ALERTS_TEXT = "No active alerts";
export const ALERTS_PAUSED_TEXT = "Alerts paused while we verify today's data";

// Public alerts go out only from a run the live pipeline marked verified
// (now node `verified: true`) and did not pause (`alerts_paused: true`).
// A run without the flag is paused: no card is shown from unverified data.
// ALERTS_PAUSED=1 (server env) pauses regardless of the data.
export function alertsPaused(node: Record<string, unknown> | undefined, env = process.env.ALERTS_PAUSED): boolean {
  if (env === "1" || env === "true") return true;
  if (!node) return true;
  return node.alerts_paused === true || node.verified !== true;
}

// "Observed by radar (candidates)" on the public view: satellite flood
// candidates grouped per source and municipality (alerts.json observed[]),
// else the NISAR response summary. Observations, never alerts: no level.
export interface ObservedRow {
  key: string;
  hazard?: "flood" | "landslide"; // section: radar flood, or optical scar candidates
  source: string; // "NISAR radar"
  places: string; // "Cananéia, SP · Iguape, SP · Registro, SP and 4 more"
  acquired?: string; // formatted newest pass
  area: string;
  people?: string;
  polygons?: number;
}

export const OBSERVED_TITLE = "Observed by radar (candidates)";
export const OBSERVED_NOTE =
  "Flood seen by satellite between two passes — candidates, not yet checked on the ground. Not an alert.";
export const LANDSLIDE_OBSERVED_TITLE = "Landslide scar candidates (OPERA DIST-ALERT-HLS)";
export const LANDSLIDE_OBSERVED_NOTE =
  "Vegetation loss on steep slopes seen by optical satellite — candidates, never confirmed. Outside a rain event it is mostly forestry harvest or fire; the product is published 1–2 weeks after the pass. Not an alert.";
export const PLACES_SHOWN = 3;
export const PLACES_UNNAMED = "municipalities not named yet";

const SOURCE_LABEL: Array<[RegExp, string]> = [
  [/nisar/i, "NISAR radar"],
  [/dswx[-_]?s1/i, "OPERA DSWx-S1 radar"],
  [/dswx/i, "OPERA DSWx"],
  [/dist/i, "OPERA DIST-ALERT-HLS (optical, vegetation loss)"],
];
const sourceLabel = (s?: string): string =>
  (s && SOURCE_LABEL.find(([re]) => re.test(s))?.[1]) ?? s ?? "satellite";

// People counts are estimates: shown exactly, labelled by the caller.
const people = (v: unknown) => (finite(v) ? Math.round(v).toLocaleString("en-US") : undefined);

// Top places by flooded area, then how many more.
export function placesText(names: readonly string[], shown = PLACES_SHOWN): string {
  const unique = [...new Set(names)];
  if (!unique.length) return PLACES_UNNAMED;
  const more = unique.length - shown;
  return unique.slice(0, shown).join(" · ") + (more > 0 ? ` and ${more} more` : "");
}

const sumOf = (vals: unknown[]): number | undefined => {
  const nums = vals.filter(finite) as number[];
  return nums.length ? nums.reduce((a, b) => a + b, 0) : undefined;
};

// One card per satellite source. Data, in order: alerts.json observed[]
// (lead-live, per source and municipality), the R3 response summary per
// source with municipality names from the R3 zones, the NISAR meta.
export function observedRows(bundle: CcBundle | undefined): ObservedRow[] {
  if (!bundle || bundle.mode !== "live") return [];
  if (bundle.observedSummary) return bundle.observedSummary;
  const named = bundle.observedPlaces ?? {};
  const observed = (bundle.nowAlerts?.observed ?? [])
    .filter((o) => (o.kind === undefined || o.kind === "observed") && finite(o.area_km2));
  const fromObserved = (items: typeof observed, hazard: ObservedRow["hazard"]): ObservedRow[] => {
    const groups = new Map<string, typeof observed>();
    for (const o of items) groups.set(o.source ?? "", [...(groups.get(o.source ?? "") ?? []), o]);
    return [...groups.entries()].map(([source, group]) => {
      const sorted = [...group].sort((a, b) => (b.area_km2 as number) - (a.area_km2 as number));
      const newest = group.map((o) => o.acquired).filter(Boolean).sort().pop();
      return {
        key: `observed-${source}`,
        hazard,
        source: sourceLabel(source || undefined),
        places: placesText(sorted.filter((o) => o.municipality)
          .map((o) => `${o.municipality}${o.uf ? `, ${o.uf}` : ""}`)),
        acquired: newest ? fmtBrt(newest) : undefined,
        area: fmtKm2(sumOf(group.map((o) => o.area_km2))),
        people: people(sumOf(group.map((o) => o.people))),
        polygons: sumOf(group.map((o) => o.polygons)),
      };
    }).sort((a, b) => a.source.localeCompare(b.source));
  };
  const isLandslide = (o: { hazard?: string; source?: string }) =>
    /landslide/i.test(o.hazard ?? "") || /dist/i.test(o.source ?? "");

  // Flood: the R3 per-source totals first — standard confidence, the same
  // numbers as the map and the Now card (alerts.json observed[] also sums
  // the lower-confidence polygons); else observed[]; else the NISAR meta.
  let flood: ObservedRow[] = [];
  if (bundle.responseSources?.length) {
    flood = [...bundle.responseSources]
      .sort((a, b) => b.flooded_km2 - a.flooded_km2)
      .map((r) => ({
        key: `r3-${r.source}`,
        hazard: "flood" as const,
        source: sourceLabel(r.source),
        places: placesText(named[r.source] ?? []),
        acquired: r.latest_acquired ? fmtBrt(r.latest_acquired) : undefined,
        area: fmtKm2(r.flooded_km2),
        people: people(r.people_flooded),
        polygons: r.features,
      }));
  } else if (observed.some((o) => !isLandslide(o))) {
    flood = fromObserved(observed.filter((o) => !isLandslide(o)), "flood");
  } else if (bundle.response && finite(bundle.response.flooded_km2)) {
    const r = bundle.response;
    flood = [{
      key: "response",
      hazard: "flood",
      source: sourceLabel(r.source),
      places: placesText(named[r.source] ?? named["nisar-gcov"] ?? []),
      acquired: r.post_acquired ? fmtBrt(r.post_acquired) : undefined,
      area: fmtKm2(r.flooded_km2),
      people: people(r.people_flooded),
      polygons: r.polygons,
    }];
  }
  // Landslide scar candidates (OPERA DIST-ALERT-HLS): their own section.
  const landslide = fromObserved(observed.filter(isLandslide), "landslide");
  return [...flood, ...landslide];
}

// The live run was checked and marked verified by lead-live.
export const runVerified = (node: Record<string, unknown> | undefined): boolean =>
  node?.verified === true;

export function pausedAlertList(list: AlertList): AlertList {
  return { state: "paused", alerts: [], dataTime: list.dataTime };
}
export const ALERTS_UNAVAILABLE_TEXT = "Alert data unavailable";
export const NO_RUN_TEXT = "no run recorded";
export const REPLAY_NO_FEED_TEXT = "There is no public alert feed in replay.";

export interface RegionRow {
  region: string;
  level: AlertCardData["level"];
  count: number;
}

// "Alerts by region": one row per region with its highest level.
export function alertsByRegion(alerts: AlertCardData[]): RegionRow[] {
  const rows = new Map<string, RegionRow>();
  for (const a of sortAlerts(alerts)) {
    const region = a.region ?? a.area;
    const row = rows.get(region);
    if (row) row.count += 1;
    else rows.set(region, { region, level: a.level, count: 1 });
  }
  return [...rows.values()];
}
