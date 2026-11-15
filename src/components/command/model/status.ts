// Status chip of the Situation panel. Reads the series (replay) or the
// summary (live). The browser computes no TPI and no class.
import { forecastSourceLabel } from "@/lib/contract";
import { forecastChip, isGfsFrame, pickTpiFrame } from "@/lib/layers";
import { cutsFor } from "@/lib/tpi";
import { finite, fmtDate } from "./format";
import type { Step } from "./steps";
import type { CcBundle, Hazard } from "./types";
import type { ManifestLayer } from "@/lib/types";

// Threshold of the tipping point: the series value, else the upper class cut.
export function thresholdFor(bundle: CcBundle | undefined): number {
  const t = bundle?.series?.tpi_threshold;
  return finite(t) ? t : cutsFor(bundle)[2];
}

// The one comparison for "reaches the threshold" (open question Q5: a value
// equal to the threshold counts, as the code did before).
export const reaches = (value: number, threshold: number): boolean =>
  value >= threshold;

export type StatusKind = "reached" | "forecast" | "forecast-later" | "below" | "no-data";

export interface StatusChip {
  kind: StatusKind;
  label: string;
  source?: string; // forecast source label, when the state is a forecast
  sentence: string;
}

const REACHED_SENTENCE =
  "High likelihood of landslide and/or flooding in monitored areas.";
const WATCH_SENTENCE =
  "Elevated risk in monitored areas — conditions trending toward the tipping point.";

const valueLine = (tpi: number, threshold: number, date: string): string =>
  `Region-average TPI ${tpi.toFixed(2)} on ${fmtDate(date)}; threshold ${threshold.toFixed(2)}.`;

export function statusChip(
  bundle: CcBundle,
  steps: Step[],
  dayIndex: number,
  hazard: Hazard
): StatusChip {
  const source = forecastSourceLabel(
    bundle.manifest?.forecast_source ?? bundle.summary?.forecast_source ??
      bundle.metricsView?.forecast_source
  );

  // L22: when the frame the map paints for a forecast step is an issued
  // NOAA GFS run, the chip names it ("NOAA GFS (issued <date>)"); anything
  // else keeps the case/run source. Same pick as the map hook — the series
  // day's kind (none without a series) and this hazard's family.
  const gfsSource = (s: Step | undefined): string | undefined => {
    const l: ManifestLayer | undefined = s && pickTpiFrame(
      bundle.manifest?.layers,
      { date: s.date, kind: s.day?.kind },
      hazard,
      bundle.series?.reference_date ?? bundle.reference_date
    );
    return l?.id.startsWith("tpi_") && isGfsFrame(l)
      ? forecastChip(l, undefined).slice("forecast · ".length)
      : undefined;
  };

  // An output the loader lists as pending is never read as a result.
  const pending = (key: string) => bundle.pending?.includes(key) === true;

  if (bundle.mode === "live") {
    const km2 = bundle.summary?.critical_km2;
    const value = finite(km2?.[hazard]) ? km2?.[hazard] : km2?.any;
    if (!bundle.summary || pending("summary") || !finite(value)) {
      return {
        kind: "no-data",
        label: "No live data yet",
        sentence: "The live run has not published a summary. Nothing here means the risk is low.",
      };
    }
    // The summary describes the day of the run. On a forecast step it is not
    // the status of the selected day: the chip says "today" and the sentence
    // says that no status is published for forecast days.
    const step = steps[dayIndex];
    const today = step?.forecast ? " today" : "";
    const note = step?.forecast
      ? ` This is the status of the latest run; no status is published for ${fmtDate(step.date)}.`
      : "";
    return value > 0
      ? { kind: "reached", label: `Tipping point reached${today}`, sentence: `${REACHED_SENTENCE}${note}` }
      : {
          kind: "below",
          label: `Below the tipping point${today}`,
          sentence: `The live summary reports no Critical area for this hazard.${note}`,
        };
  }

  const day = steps[dayIndex]?.day;
  if (!bundle.series || !day || pending("series") || pending("priority_zones")) {
    return {
      kind: "no-data",
      label: "No data for this event",
      sentence: "No daily series is published for this event.",
    };
  }
  // A day without a TPI value is a gap, never a zero.
  if (!finite(day.tpi)) {
    return {
      kind: "no-data",
      label: "No data for this day",
      sentence: `The series has no TPI value for ${fmtDate(day.date)}.`,
    };
  }
  const threshold = thresholdFor(bundle);
  const line = valueLine(day.tpi, threshold, day.date);
  if (reaches(day.tpi, threshold)) {
    return day.kind === "observed"
      ? { kind: "reached", label: "Tipping point reached", sentence: `${REACHED_SENTENCE} ${line}` }
      : { kind: "forecast", label: "Tipping point forecast", source: gfsSource(steps[dayIndex]) ?? source, sentence: `${WATCH_SENTENCE} ${line}` };
  }
  // The next day that reaches the threshold. Only a forecast day makes a
  // forecast; an observed day ahead in a replay is not a forecast.
  const later = steps.find(
    (s) => s.index > dayIndex && s.day && finite(s.day.tpi) && reaches(s.day.tpi, threshold)
  );
  if (later?.forecast) {
    return {
      kind: "forecast-later",
      label: `Tipping point forecast for ${fmtDate(later.date)}`,
      source: gfsSource(later) ?? source,
      sentence: `${WATCH_SENTENCE} ${line}`,
    };
  }
  return { kind: "below", label: "Below the tipping point", sentence: line };
}
