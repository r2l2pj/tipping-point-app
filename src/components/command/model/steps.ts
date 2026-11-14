// Timeline steps: from the daily series, or from the dates of the manifest
// TPI frames when the case has no series (the live case has none).
import { forecastSourceLabel } from "@/lib/contract";
import { isForecastLayer } from "@/lib/layers";
import type { DayPoint, ManifestLayer } from "@/lib/types";
import { fmtDate, fmtDayShort } from "./format";
import { reaches, thresholdFor } from "./status";
import type { LayerId } from "./layerRegistry";
import { HAZARD_LABEL, type CcBundle, type Hazard } from "./types";

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
}

const tpiFrames = (bundle: CcBundle): ManifestLayer[] =>
  (bundle.manifest?.layers ?? []).filter(
    (l) => l.id.startsWith("tpi_") && l.png && typeof l.date === "string"
  );

const offsetLabel = (offset: number, live: boolean): string =>
  offset === 0 ? (live ? "NOW" : "EVENT") : offset < 0 ? `D${offset}` : `D+${offset}`;

export function stepsFor(bundle: CcBundle | undefined): Step[] {
  if (!bundle) return [];
  const live = bundle.mode === "live";
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
// "GEOS-FP" in Now). Never a fixed name.
export const forecastSource = (bundle: CcBundle): string | undefined =>
  forecastSourceLabel(
    bundle.manifest?.forecast_source ?? bundle.summary?.forecast_source ??
      bundle.metricsView?.forecast_source
  );

// Forecast tag of the timeline.
export function forecastTag(bundle: CcBundle): string {
  const label = forecastSource(bundle);
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

// The TPI frame the map hook draws for a date and a hazard choice. Mirrors
// the pick in useMapLayers: frames of that date, the wanted hazard first,
// else the first frame of the date. `hazard` is the hazard of the frame that
// is really drawn, so the caption never names the wrong one.
export function frameFor(
  bundle: CcBundle,
  date: string | undefined,
  wanted: Hazard
): Frame | undefined {
  if (!date) return undefined;
  const candidates = (bundle.manifest?.layers ?? []).filter(
    (l) => l.png && l.date === date
  );
  const layer = candidates.find((l) => l.id.includes(wanted)) ?? candidates[0];
  if (!layer || !layer.id.startsWith("tpi_")) return undefined;
  return {
    layer,
    hazard: layer.id.includes("flood") ? "flood" : "slide",
    forecast: isForecastLayer(layer),
  };
}

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
  on: readonly LayerId[]
): { text: string; forecast: boolean } {
  const step = steps[dayIndex];
  if (!step) return { text: NO_STEPS_TEXT, forecast: false };
  const when = `${fmtDate(step.date)}${step.sub ? ` (${step.sub})` : ""}`;
  if (!on.includes("tpi")) return { text: `TPI index off · ${when}`, forecast: false };
  const frame = frameFor(bundle, step.date, hazard);
  // The map hook shows its own note for a missing frame; the caption stays short.
  if (!frame) return { text: `${when} · no map frame`, forecast: false };
  const forecast = frame.forecast || step.forecast;
  return {
    text: `${HAZARD_LABEL[frame.hazard]} TPI · ${when}` +
      (forecast ? ` · ${forecastTag(bundle).toLowerCase()}` : ""),
    forecast,
  };
}

// Step line of the panel. Rule 2: observed and forecast are never confused.
// The forecast source is named on forecast days only; an observed day
// (the event day included) reads "observed", never "perfect forecast".
export function stepLabel(bundle: CcBundle, step: Step): string {
  const source = forecastSource(bundle);
  const kind = step.kind === "observed" ? "observed"
    : `${step.kind}${source ? ` · ${source}` : ""}`;
  return `${step.top}${step.sub ? ` (${step.sub})` : ""} · ${kind}`;
}

// Provenance of the frame of a step ("final data, hindcast", ...): the
// frame's own data_basis wins over the case-level field.
export const frameBasis = (bundle: CcBundle, date: string | undefined, hazard: Hazard): string | undefined =>
  frameFor(bundle, date, hazard)?.layer.data_basis ?? bundle.manifest?.data_basis;
