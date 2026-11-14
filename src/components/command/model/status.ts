// Status chip of the Situation panel. Reads the series (replay) or the
// summary (live). The browser computes no TPI and no class.
import { forecastSourceLabel } from "@/lib/contract";
import { cutsFor } from "@/lib/tpi";
import { finite, fmtDate } from "./format";
import type { Step } from "./steps";
import type { CcBundle, Hazard } from "./types";

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

  if (bundle.mode === "live") {
    const km2 = bundle.summary?.critical_km2;
    const value = finite(km2?.[hazard]) ? km2?.[hazard] : km2?.any;
    if (!bundle.summary || !finite(value)) {
      return {
        kind: "no-data",
        label: "No live data yet",
        sentence: "The live run has not published a summary. Nothing here means the risk is low.",
      };
    }
    return value > 0
      ? { kind: "reached", label: "Tipping point reached", sentence: REACHED_SENTENCE }
      : {
          kind: "below",
          label: "Below the tipping point",
          sentence: "The live summary reports no Critical area for this hazard.",
        };
  }

  const day = steps[dayIndex]?.day;
  if (!bundle.series || !day) {
    return {
      kind: "no-data",
      label: "No data for this event",
      sentence: "No daily series is published for this event.",
    };
  }
  const threshold = thresholdFor(bundle);
  const line = valueLine(day.tpi, threshold, day.date);
  if (reaches(day.tpi, threshold)) {
    return day.kind === "observed"
      ? { kind: "reached", label: "Tipping point reached", sentence: `${REACHED_SENTENCE} ${line}` }
      : { kind: "forecast", label: "Tipping point forecast", source, sentence: `${WATCH_SENTENCE} ${line}` };
  }
  // The next day that reaches the threshold. Only a forecast day makes a
  // forecast; an observed day ahead in a replay is not a forecast.
  const later = steps.find(
    (s) => s.index > dayIndex && s.day && reaches(s.day.tpi, threshold)
  );
  if (later?.forecast) {
    return {
      kind: "forecast-later",
      label: `Tipping point forecast for ${fmtDate(later.date)}`,
      source,
      sentence: `${WATCH_SENTENCE} ${line}`,
    };
  }
  return { kind: "below", label: "Below the tipping point", sentence: line };
}
