// Timeline steps: from the daily series, or from the dates of the manifest
// TPI frames when the case has no series (the live case has none).
import { forecastSourceLabel } from "@/lib/contract";
import {
  forecastChip,
  isForecastLayer,
  isGfsFrame,
  pickTpiFrame,
} from "@/lib/layers";
import type { DayPoint, ManifestLayer } from "@/lib/types";
import { fmtDate, fmtDayShort } from "./format";
import { reaches, thresholdFor } from "./status";
import type { LayerId } from "./layerRegistry";
import { HAZARD_LABEL, RISK_PAUSED_TEXT, type CcBundle, type Hazard } from "./types";

export interface Step {
  index: number;
  date: string;
  // A hindcast is drawn as forecast: it is not an observation (design part 9).
  forecast: boolean;
  kind: DayPoint["kind"];
  offset?: number;
  top: string; // "Dec 10"
  sub: string; // "EVENT", "D-3", "D+2", "NOW" or ""
  day?: DayPoint; // present only when the step comes from the series
  // The TPI frame the map paints for this step — pickTpiFrame, any hazard
  // family (the timeline has no hazard). L22: an issued NOAA GFS frame on
  // a forecast day.
  layer?: ManifestLayer;
}

const tpiFrames = (bundle: CcBundle): ManifestLayer[] =>
  (bundle.manifest?.layers ?? []).filter(
    (l) =>
      l.id.startsWith("tpi_") &&
      l.png &&
      typeof l.date === "string" &&
      // An issued GFS frame never creates a step of its own (L22): it
      // depicts the same day as the regular frame family.
      !isGfsFrame(l)
  );

const offsetLabel = (offset: number, live: boolean): string =>
  offset === 0 ? (live ? "NOW" : "EVENT") : offset < 0 ? `D${offset}` : `D+${offset}`;

export function stepsFor(bundle: CcBundle | undefined): Step[] {
  if (!bundle) return [];
  const live = bundle.mode === "live";
  const reference = bundle.series?.reference_date ?? bundle.reference_date;
  // The frame the map hook paints for a day — same pick and same kind the
  // hook passes (a series day's kind, none when the case has no series).
  const painted = (date: string, kind?: string): ManifestLayer | undefined =>
    pickTpiFrame(bundle.manifest?.layers, { date, kind }, null, reference);
  const days = bundle.series?.days;
  if (days?.length) {
    return days.map((day, index) => ({
      index,
      date: day.date,
      forecast: day.kind !== "observed",
      kind: day.kind,
      offset: day.offset,
      top: fmtDayShort(day.date),
      sub: offsetLabel(day.offset, live),
      day,
      layer: painted(day.date, day.kind),
    }));
  }
  const frames = tpiFrames(bundle);
  const dates = [...new Set(frames.map((l) => l.date as string))].sort();
  return dates.map((date, index) => {
    const forecast = frames.some((l) => l.date === date && isForecastLayer(l));
    return {
      index,
      date,
      forecast,
      kind: forecast ? "forecast" : "observed",
      top: fmtDayShort(date),
      sub: "",
      layer: painted(date),
    };
  });
}

// Step shown when a case opens: the event day (offset 0), else the last
// observed step, else the first step.
export function defaultStepIndex(steps: Step[]): number {
  const event = steps.findIndex((s) => s.offset === 0);
  if (event >= 0) return event;
  for (let i = steps.length - 1; i >= 0; i--) if (!steps[i].forecast) return i;
  return 0;
}

export const NO_STEPS_TEXT = "No frames published yet";

// Forecast source named by the data ("perfect forecast" in Replay,
// "NOAA GFS" in Now). Never a fixed name.
export const forecastSource = (bundle: CcBundle): string | undefined =>
  forecastSourceLabel(
    bundle.manifest?.forecast_source ?? bundle.summary?.forecast_source ??
      bundle.metricsView?.forecast_source
  );

// The case's real issued forecast (L22): the GFS frame the map paints on the
// first forecast day, when there is one — "NOAA GFS (issued May 2, 2024)".
export function issuedForecastLabel(bundle: CcBundle): string | undefined {
  const first = bundle.series?.days.find((d) => d.kind === "forecast");
  if (!first) return undefined;
  const frame = pickTpiFrame(
    bundle.manifest?.layers, first, null,
    bundle.series?.reference_date ?? bundle.reference_date
  );
  return frame && isGfsFrame(frame) ? gfsChipSource(frame) : undefined;
}

export const UPPER_BOUND_TEXT = "perfect forecast · upper bound";

// Legend of the GFS 3-day forecast bars: "Forecast rain 3-day (NOAA GFS,
// issued May 1, 2024)", or the range of issue dates when the forecast days
// come from several runs. Undefined when no forecast day has a value.
export function gfsRain3Label(days: readonly { gfs_rain3_mm?: number | null; gfs_rain3_issued?: string | null }[]): string | undefined {
  const issued = days
    .filter((d) => typeof d.gfs_rain3_mm === "number" && typeof d.gfs_rain3_issued === "string")
    .map((d) => d.gfs_rain3_issued as string)
    .sort();
  if (!issued.length) return undefined;
  const first = fmtDate(issued[0]);
  const last = fmtDate(issued[issued.length - 1]);
  return `Forecast rain 3-day (NOAA GFS, issued ${first === last ? first : `${first} – ${last}`})`;
}

// Source of the forecast-day values in the chart (series). Perfect forecast
// is copied observation: it is only ever labelled as the upper bound.
export function chartForecastLabel(bundle: CcBundle): string | undefined {
  const src = forecastSource(bundle);
  return src === "perfect forecast" ? UPPER_BOUND_TEXT : src;
}

// Forecast tag of the timeline.
export function forecastTag(bundle: CcBundle): string {
  const label = forecastSource(bundle);
  return label ? `Forecast (${label})` : "Forecast";
}

// Timeline chip when the map shows no forecast frame: the source of the
// case's forecast days. A case with issued NOAA GFS frames names NOAA GFS;
// "perfect forecast" (copied observation) is only ever the labelled upper
// bound (L22), never the bare source.
export function timelineForecastTag(bundle: CcBundle): string {
  if ((bundle.manifest?.layers ?? []).some((l) => isGfsFrame(l))) return "Forecast (NOAA GFS)";
  const label = forecastSource(bundle);
  if (label === "perfect forecast") return `Forecast (${UPPER_BOUND_TEXT})`;
  return label ? `Forecast (${label})` : "Forecast";
}

export interface StepMark {
  index: number;
  label: "first Critical" | "first damage";
  color: "amber" | "red";
}

// Marks of the old timeline: first day at or above the threshold, and the
// day of the first reported damage.
export function stepMarks(bundle: CcBundle, steps: Step[]): StepMark[] {
  const marks: StepMark[] = [];
  const threshold = thresholdFor(bundle);
  const firstCritical = steps.findIndex(
    (s) => s.day && typeof s.day.tpi === "number" && reaches(s.day.tpi, threshold)
  );
  if (firstCritical >= 0) marks.push({ index: firstCritical, label: "first Critical", color: "amber" });
  const m = bundle.metricsView as Record<string, unknown> | undefined;
  const anchor = m?.damage_anchor;
  const at = anchor && typeof anchor === "object"
    ? (anchor as Record<string, unknown>).at : m?.first_damage_at;
  if (typeof at === "string") {
    const i = steps.findIndex((s) => s.date.slice(0, 10) === at.slice(0, 10));
    if (i >= 0) marks.push({ index: i, label: "first damage", color: "red" });
  }
  return marks;
}

export interface Frame {
  layer: ManifestLayer;
  hazard: Hazard;
  forecast: boolean;
}

// The TPI frame the map hook draws for a date and a hazard choice — the
// hook's own pick (pickTpiFrame): on a forecast day the latest GFS run
// issued on or before the reference date wins over the perfect-forecast
// upper bound, and a run issued after it is never shown. The kind is the
// series day's, none for a case without a series — as the hook passes it.
// `hazard` is the hazard of the frame that is really drawn, so the caption
// never names the wrong one.
export function frameFor(
  bundle: CcBundle,
  date: string | undefined,
  wanted: Hazard
): Frame | undefined {
  if (!date) return undefined;
  const layer = pickTpiFrame(
    bundle.manifest?.layers,
    { date, kind: bundle.series?.days.find((d) => d.date === date)?.kind },
    wanted,
    bundle.series?.reference_date ?? bundle.reference_date
  );
  if (!layer || !layer.id.startsWith("tpi_")) return undefined;
  return {
    layer,
    hazard: layer.id.includes("flood") ? "flood" : "slide",
    forecast: isForecastLayer(layer),
  };
}

// "Forecast issued this day" (replay): the NOAA GFS frame of the run issued
// on day D (00Z) that depicts D+k, k = 1..3 (lead-analysis L28b layers
// tpi_<hazard>_gfs_d<k>, grouped by `issued`). Runs issued after the case's
// reference day are never shown (no peeking).
export type IssueLead = 0 | 1 | 2 | 3;
export const ISSUE_LEADS: readonly IssueLead[] = [1, 2, 3];

export function issuedFrame(
  bundle: CcBundle,
  issueDate: string | undefined,
  hazard: Hazard,
  k: IssueLead
): Frame | undefined {
  if (!issueDate || k === 0 || bundle.mode !== "replay") return undefined;
  const day = issueDate.slice(0, 10);
  const ref = (bundle.series?.reference_date ?? bundle.reference_date)?.slice(0, 10);
  if (ref && day > ref) return undefined;
  const layer = (bundle.manifest?.layers ?? []).find(
    (l) => l.id === `tpi_${hazard}_gfs_d${k}` && l.issued === day && !!l.png
  );
  return layer ? { layer, hazard, forecast: true } : undefined;
}

// Leads with a frame for the day (either hazard): the control shows only
// when there is at least one.
export const issueLeadsFor = (bundle: CcBundle, issueDate: string | undefined, hazard: Hazard): IssueLead[] =>
  ISSUE_LEADS.filter((k) => issuedFrame(bundle, issueDate, hazard, k));

export const caseHasHazard = (bundle: CcBundle, hazard: Hazard): boolean =>
  (bundle.manifest?.layers ?? []).some(
    (l) => l.id.startsWith(`tpi_${hazard}`) && (l.png || l.cog)
  );

// Caption chip of the map: what is drawn, for which step. Says so when the
// step has no frame, so an empty map is never read as "no risk".
export function mapCaption(
  bundle: CcBundle,
  steps: Step[],
  dayIndex: number,
  hazard: Hazard,
  on: readonly LayerId[],
  issueLead: IssueLead = 0
): { text: string; forecast: boolean } {
  const step = steps[dayIndex];
  if (!step) return { text: NO_STEPS_TEXT, forecast: false };
  const when = `${fmtDate(step.date)}${step.sub ? ` (${step.sub})` : ""}`;
  if (issueLead > 0 && on.includes("tpi")) {
    const f = issuedFrame(bundle, step.date, hazard, issueLead);
    const ahead = `${issueLead} ${issueLead === 1 ? "day" : "days"} ahead`;
    return f
      ? { text: `${HAZARD_LABEL[f.hazard]} TPI · ${fmtDate(f.layer.date ?? "")} · ${forecastChip(f.layer, undefined)}, ${ahead}`, forecast: true }
      : { text: `No NOAA GFS forecast issued ${fmtDate(step.date)} for ${ahead}`, forecast: false };
  }
  if (bundle.riskPaused) return { text: `${RISK_PAUSED_TEXT} · ${when}`, forecast: false };
  const partly = partlyForecastText(bundle, step.date);
  if (partly && on.includes("tpi")) {
    const f = frameFor(bundle, step.date, hazard);
    // Dashed caption = forecast content on the map (here, part of it).
    return { text: `${HAZARD_LABEL[f?.hazard ?? hazard]} TPI · ${partly} (partly forecast)`, forecast: true };
  }
  if (!on.includes("tpi")) return { text: `TPI index off · ${when}`, forecast: false };
  const frame = frameFor(bundle, step.date, hazard);
  // The map hook shows its own note for a missing frame; the caption stays short.
  if (!frame) return { text: `${when} · no map frame`, forecast: false };
  const forecast = frame.forecast || step.forecast;
  // L22: an issued GFS frame names its issue day; anything else keeps the
  // case-level source wording.
  const tag = isGfsFrame(frame.layer)
    ? forecastChip(frame.layer, undefined)
    : forecastTag(bundle).toLowerCase();
  return {
    text: `${HAZARD_LABEL[frame.hazard]} TPI · ${when}` +
      (forecast ? ` · ${tag}` : ""),
    forecast,
  };
}

// The chip name an issued GFS frame gives a step ("NOAA GFS (issued May 2,
// 2024)") — forecastChip without its "forecast · " lead, for spots whose
// text already says "forecast".
export const gfsChipSource = (l: ManifestLayer): string =>
  forecastChip(l, undefined).slice("forecast · ".length);

// Step line of the panel. Rule 2: observed and forecast are never confused.
// The forecast source is named on forecast days only; an observed day
// (the event day included) reads "observed", never "perfect forecast".
// L28b (lead-live): the live "today" frame = observed IMERG through
// yesterday + NOAA GFS forecast rain for today (data_dates.imerg_obs_through,
// forecast_from, gfs_issued). It is labelled partly forecast everywhere
// (honesty rule 2); undefined for any other frame or case.
const dayMonth = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function partlyForecastText(bundle: CcBundle, date: string | undefined): string | undefined {
  if (bundle.mode !== "live" || !date) return undefined;
  const dd = bundle.data_dates ?? {};
  // lead-live 82b4037: each layer carries partly_forecast + basis_label
  // ("observed to Nov 14 + NOAA GFS forecast for Nov 15 (issued …)"); the
  // published label wins (it also covers D+1).
  const layer = (bundle.manifest?.layers ?? []).find((l) => l.id.startsWith("tpi_") && l.date?.slice(0, 10) === date.slice(0, 10)) as
    (ManifestLayer & { partly_forecast?: boolean; basis_label?: string }) | undefined;
  if (layer?.partly_forecast === true && typeof layer.basis_label === "string" && layer.basis_label) {
    const today = typeof dd.forecast_from === "string" && dd.forecast_from.slice(0, 10) === date.slice(0, 10);
    return `${today ? "Today · " : ""}${layer.basis_label}`;
  }
  const obs = typeof dd.imerg_obs_through === "string" ? dd.imerg_obs_through : undefined;
  const from = typeof dd.forecast_from === "string" ? dd.forecast_from : undefined;
  if (!obs || !from || date.slice(0, 10) !== from.slice(0, 10)) return undefined;
  return `Today · observed to ${dayMonth(obs)} + NOAA GFS forecast for ${dayMonth(from)}`;
}

// "NOAA GFS, issued Nov 15, 00:00 UTC" from data_dates.gfs_issued.
export function gfsIssuedText(bundle: CcBundle): string | undefined {
  const v = bundle.data_dates?.gfs_issued;
  if (typeof v !== "string") return undefined;
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return undefined;
  const hh = String(t.getUTCHours()).padStart(2, "0");
  return `NOAA GFS, issued ${dayMonth(v)}, ${hh}:00 UTC`;
}

export function stepLabel(bundle: CcBundle, step: Step): string {
  const partly = partlyForecastText(bundle, step.date);
  if (partly) return `${step.top} · ${partly} (partly forecast)`;
  const gfs = step.forecast && step.layer && isGfsFrame(step.layer)
    ? step.layer
    : undefined;
  const source = gfs ? gfsChipSource(gfs) : forecastSource(bundle);
  const kind = step.kind === "observed" ? "observed"
    : `${step.kind}${source ? ` · ${source}` : ""}`;
  return `${step.top}${step.sub ? ` (${step.sub})` : ""} · ${kind}`;
}

// Provenance of the frame of a step ("final data, hindcast", ...): the
// frame's own data_basis wins over the case-level field.
export const frameBasis = (bundle: CcBundle, date: string | undefined, hazard: Hazard): string | undefined =>
  frameFor(bundle, date, hazard)?.layer.data_basis ?? bundle.manifest?.data_basis;
