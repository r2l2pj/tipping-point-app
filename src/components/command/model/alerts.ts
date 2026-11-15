// Alert list of the Public Alerts view. Built on the server (the loader),
// because candidatesToAlerts reads the clock when no issue time is given.
// Wraps src/lib/alerts.ts; takes over the sort order of the old alerts page.
import { alertDataDates, candidatesToAlerts, type AlertCardData } from "@/lib/alerts";
import type { AlertsFile } from "@/lib/types";
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
