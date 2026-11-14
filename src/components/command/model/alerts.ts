// Alert list of the Public Alerts view. Built on the server (the loader),
// because candidatesToAlerts reads the clock when no issue time is given.
// Wraps src/lib/alerts.ts; takes over the sort order of the old alerts page.
import { alertDataDates, candidatesToAlerts, type AlertCardData } from "@/lib/alerts";
import type { AlertsFile } from "@/lib/types";
import type { CcBundle } from "./types";

export type AlertListState = "alerts" | "none" | "unavailable";

export interface AlertList {
  state: AlertListState;
  alerts: AlertCardData[];
  // Time of the data, or the last known run time when unavailable.
  dataTime?: string;
}

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
