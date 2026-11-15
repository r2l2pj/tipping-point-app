// Maps now/alerts.json candidates (NowAlertCandidate: class/label/centroid/
// pixels/hold) onto the Alert card shape the /alerts page renders — the same
// "Mensagem de alerta" format the Telegram bot sends (project doc v4). Pure
// helpers, no next/maplibre imports, so they run under `bun test`.

import type { NowAlertCandidate } from "./contract";
import { nearestPlace } from "./tpi";
import type { Alert, AlertLevel } from "./types";

// Alert plus the fields the /alerts card needs that alerts@1 doesn't carry:
// the rendered message title and the quiet-hours flags.
export interface AlertCardData extends Alert {
  title?: string;
  // Rain behind the alert when it is (partly) forecast: "based on forecast
  // rain (NOAA GFS, issued Nov 15, 00:00 UTC)".
  basis?: string;
  first_issued_at?: string;
  last_confirmed_at?: string;
  next_nisar_pass_utc?: string; // L43
  next_nisar_track?: string | number;
  // 'when' = d1: today's class of the same area, only when the data gives
  // it (class_today); "below" = under High. Absent = not known: not shown.
  today_level?: AlertLevel | "below";
  area_km2?: number;
  when?: string; // "today" | "d1"
  // Where the alert is (lead-live candidates: lon/lat and [w, s, e, n]):
  // "View on the map" frames it.
  centroid?: [number, number];
  bbox?: [number, number, number, number];
  held?: boolean; // held by the quiet-hours rule (23:00–06:00 BRT)
  quiet?: boolean; // issued during quiet hours — Critical still goes out
}

export interface AlertsContext {
  places?: GeoJSON.FeatureCollection;
  issuedAt?: Date | string; // issue time; defaults to now
  dataDates?: Record<string, string>; // passthrough onto Alert.data_dates
  // L28b: the frames behind "today" and "d1" alerts use NOAA GFS forecast
  // rain; this text ("NOAA GFS, issued Nov 15, 00:00 UTC") goes on the card.
  forecastBasis?: string;
  // "active": the public list of every current High/Critical area — the
  // send-rule states (held, quiet hours) do not apply to it.
  mode?: "candidates" | "active";
}

// Badge word per level — shared by the generated message title and the card
// heading so both always match.
export const ALERT_LEVEL_WORDS: Record<AlertLevel, string> = {
  emergency: "CRITICAL",
  warning: "HIGH",
  watch: "ELEVATED",
};

// Judge report #7 (conductor): every live alert says what it is.
export const EXPERIMENTAL_TEXT = "Experimental — not an official warning; follow Defesa Civil";
export const ALERT_FOOTER = "Follow Civil Defense guidance. SMS 40199.";

// Candidate `class` arrives either as the 0-3 class index (2 = Alto, 3 =
// Crítico) or as a raw 0-1 TPI float. Integers read as class indices;
// fractional values read as TPI on the same 0.4/0.6 class edges. Only
// Alto/Crítico upgrade to an alert — anything lower is suppressed.
export function levelForClass(c: number | undefined): AlertLevel | undefined {
  if (typeof c !== "number" || !Number.isFinite(c)) return undefined;
  if (Number.isInteger(c)) {
    if (c === 3) return "emergency";
    if (c === 2) return "warning";
    return undefined;
  }
  if (c >= 0.6 && c <= 1) return "emergency";
  if (c >= 0.4 && c < 0.6) return "warning";
  return undefined;
}

const brtHour = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hour: "numeric",
  hourCycle: "h23",
});

// Quiet-hours rule (project doc: never send between 23h and 6h BRT unless the
// class is Crítico). Alerts raised inside the window are held; Crítico still
// goes out but is flagged.
export function isQuietHourBRT(d: Date): boolean {
  const h = Number(brtHour.format(d)) % 24;
  return Number.isFinite(h) && (h >= 23 || h < 6);
}

// 'held' display label for the card badge. Accepts a raw NowAlertCandidate
// (`hold`) or a generated AlertCardData (`held`).
export function heldLabel(a: {
  hold?: boolean;
  held?: boolean;
}): string | undefined {
  return a.hold === true || a.held === true ? "held" : undefined;
}

// Hazard of a candidate: its `hazard` field, else a hazard word in its label.
// A candidate that names neither is never guessed as one hazard (the class
// label "Crítico" says nothing about it): it reads "flood or landslide".
export const EITHER_HAZARD = "flood or landslide";
const hazardFor = (c: NowAlertCandidate): string => {
  for (const t of [c.hazard, c.label].map((v) => v?.toLowerCase() ?? "")) {
    if (/flood|enchente|inunda/.test(t)) return "flood";
    if (/slide|desliza|landslide/.test(t)) return "landslide";
  }
  return EITHER_HAZARD;
};

const certaintyFor = (pixels?: number): Alert["certainty"] =>
  (pixels ?? 0) >= 50 ? "high" : (pixels ?? 0) >= 10 ? "medium" : "low";

// now.data_dates mixes strings, nulls and NisarPass[]; Alert.data_dates is
// string-only — keep just the string entries.
export function alertDataDates(
  dd: Record<string, unknown> | undefined
): Record<string, string> | undefined {
  if (!dd) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dd)) {
    // G4 (lead-live): SMAP's age in days rides along for the card.
    if (k === "smap_age_days" && typeof v === "number" && Number.isFinite(v)) {
      out[k] = String(Math.round(v));
      continue;
    }
    if (typeof v !== "string") continue;
    // L28b: the IMERG stamp is the end of the window; observed rain runs
    // through imerg_obs_through (the day before).
    if (k === "imerg" && typeof dd.imerg_obs_through === "string") {
      out[k] = dd.imerg_obs_through.slice(0, 10);
      continue;
    }
    // The live run stamps some sources with a run id or a granule name
    // ("2026-11-14T00Z", "SMAP_L4_SM_gph_20261110T223000_...h5"): the card
    // shows the calendar date in it, never the raw stamp.
    out[k] = stampDate(v) ?? v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function stampDate(v: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v; // a real ISO time stays
  const m = /(\d{4})-?(\d{2})-?(\d{2})/.exec(v);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

const allFinite = (v: unknown, n: number): v is number[] =>
  Array.isArray(v) && v.length === n && v.every((x) => typeof x === "number" && Number.isFinite(x));
const lonLatOf = (v: unknown): { centroid?: [number, number] } =>
  allFinite(v, 2) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 ? { centroid: [v[0], v[1]] } : {};
const bboxOf = (v: unknown): { bbox?: [number, number, number, number] } =>
  allFinite(v, 4) && v[0] <= v[2] && v[1] <= v[3] ? { bbox: [v[0], v[1], v[2], v[3]] } : {};

// NowAlertCandidate[] -> Alert[]. Candidates below Alto are skipped. `hold`
// candidates and anything raised during quiet hours carry the held flag;
// Crítico raised during quiet hours is still emitted, flagged `quiet`.
export function candidatesToAlerts(
  candidates: NowAlertCandidate[] | undefined,
  ctx: AlertsContext = {}
): AlertCardData[] {
  const issued = ctx.issuedAt ? new Date(ctx.issuedAt) : new Date();
  const validTo = new Date(issued.getTime() + 12 * 3600 * 1000);
  const quiet = isQuietHourBRT(issued);

  const out: AlertCardData[] = [];
  (candidates ?? []).forEach((c, i) => {
    // Observations are never alerts: only TPI candidates (kind "tpi", or
    // no kind in runs before the field) become cards.
    if (c.kind !== undefined && c.kind !== "tpi") return;
    const level = levelForClass(c.class);
    if (!level) return;

    const hazard = hazardFor(c);
    const active = ctx.mode === "active";
    const held = !active && (c.hold === true || (quiet && level === "warning"));
    const quietFlag = !active && quiet && level === "emergency";
    const region =
      (c.municipality ? `${c.municipality}${c.uf ? `, ${c.uf}` : ""}` : undefined) ??
      (c.centroid
        ? nearestPlace(ctx.places, c.centroid[0], c.centroid[1])
        : undefined) ?? "monitored region";
    const advice =
      hazard === "flood"
        ? "Stay away from riverbanks and flooded streets"
        : hazard === "landslide"
          ? "Stay away from steep slopes and riverbanks"
          : "Stay away from steep slopes, riverbanks and flooded streets";
    const urgency =
      level === "emergency"
        ? "; be ready to leave if Civil Defense orders it"
        : "";
    const notes = held
      ? " Held by the quiet-hours rule (23:00–06:00 BRT)."
      : quietFlag
        ? " Issued during quiet hours — Critical alerts always go out."
        : "";

    out.push({
      id: `now-${i}-${hazard.replace(/ /g, "-")}-${level}`,
      title: `Tipping Point: ${ALERT_LEVEL_WORDS[level]} ${hazard} risk`,
      area: region,
      region,
      hazard,
      level,
      // lead-live's own certainty wins when published.
      certainty: typeof (c as { certainty?: unknown }).certainty === "string" && (c as { certainty: string }).certainty
        ? (c as { certainty: string }).certainty : certaintyFor(c.pixels),
      held,
      quiet: quietFlag,
      valid_from: (active && c.first_issued_at && !Number.isNaN(Date.parse(c.first_issued_at))
        ? new Date(c.first_issued_at) : issued).toISOString(),
      ...(active && c.first_issued_at ? { first_issued_at: c.first_issued_at } : {}),
      ...(c.when === "d1" && typeof (c as { class_today?: unknown }).class_today === "number"
        ? { today_level: levelForClass((c as { class_today: number }).class_today) ?? "below" } : {}),
      ...(active && c.last_confirmed_at ? { last_confirmed_at: c.last_confirmed_at } : {}),
      ...(typeof (c as { next_nisar_pass_utc?: unknown }).next_nisar_pass_utc === "string"
        ? { next_nisar_pass_utc: (c as { next_nisar_pass_utc: string }).next_nisar_pass_utc,
            ...((c as { next_nisar_track?: unknown }).next_nisar_track != null
              ? { next_nisar_track: (c as { next_nisar_track: string | number }).next_nisar_track } : {}) }
        : {}),
      valid_to: validTo.toISOString(),
      guidance:
        `${ALERT_LEVEL_WORDS[level]} ${hazard} risk in your region. ` +
        `${advice}${urgency}.${notes} ${ALERT_FOOTER}`,
      data_dates: ctx.dataDates,
      ...lonLatOf((c as { centroid?: unknown }).centroid),
      ...bboxOf((c as { bbox?: unknown }).bbox),
      ...(typeof c.area_km2 === "number" && Number.isFinite(c.area_km2) ? { area_km2: c.area_km2 } : {}),
      ...(c.when === "today" || c.when === "d1" ? { when: c.when } : {}),
      // lead-live's basis_note wins; else the run's GFS issue (L28b frames).
      ...(typeof (c as { basis_note?: unknown }).basis_note === "string"
        ? { basis: (c as { basis_note: string }).basis_note }
        : ctx.forecastBasis && (c.when === "today" || c.when === "d1" || c.when === undefined)
          ? { basis: `based on forecast rain (${ctx.forecastBasis})` } : {}),
    });
  });
  return out;
}
