// Data sources of the timeline: absolute date first, age second.
import { forecastSourceLabel } from "@/lib/contract";
import { NO_RADAR_TEXT } from "./availability";
import { ageText, fmtBrt, fmtDate } from "./format";
import { nisarPasses } from "./radar";
import { NOT_PUBLISHED, type CcBundle } from "./types";

export interface SourceRow {
  id: string;
  name: string;
  date: string; // absolute date in BRT, or the missing-data text
  age?: string; // live case only, after mount
  missing: boolean;
}

export function sourceRows(bundle: CcBundle, nowMs?: number): SourceRow[] {
  const dd: Record<string, unknown> = {
    ...(bundle.data_dates ?? {}),
    ...(bundle.summary?.data_dates ?? {}),
  };
  const live = bundle.mode === "live";
  const row = (id: string, name: string, key: string): SourceRow => {
    const iso = typeof dd[key] === "string" ? (dd[key] as string) : undefined;
    return {
      id,
      name,
      date: iso ? fmtBrt(iso) : NOT_PUBLISHED,
      age: iso && live && nowMs !== undefined ? ageText(iso, nowMs) : undefined,
      missing: !iso,
    };
  };
  const rows = [
    row("imerg", "IMERG rain", "imerg"),
    row("smap", "SMAP soil moisture", "smap"),
  ];
  if (live) {
    rows.push(row("geos", "GEOS-FP forecast", "geos_fp_issued"));
  } else {
    const label = forecastSourceLabel(bundle.manifest?.forecast_source);
    rows.push({
      id: "forecast", name: "Forecast source",
      date: label ?? NOT_PUBLISHED, missing: !label,
    });
  }
  const pre = typeof dd.nisar_pre === "string" ? dd.nisar_pre : undefined;
  const post = typeof dd.nisar_post === "string" ? dd.nisar_post : undefined;
  const passes = nisarPasses(bundle);
  const lastPass = passes.length ? passes[passes.length - 1].date : undefined;
  rows.push({
    id: "nisar",
    name: "NISAR radar",
    date: pre && post
      ? `${fmtDate(pre)} and ${fmtDate(post)}`
      : lastPass ? fmtDate(lastPass)
      : live ? NOT_PUBLISHED : NO_RADAR_TEXT,
    missing: !(pre && post) && !lastPass,
  });
  return rows;
}
