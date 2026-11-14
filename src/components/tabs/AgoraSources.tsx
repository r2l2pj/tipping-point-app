"use client";

import { forecastSourceLabel } from "@/lib/contract";
import { fmtKm2, fmtPeople } from "@/lib/tpi";
import type { CaseBundle, NisarPass } from "@/lib/types";
import { fmtBrt, pendingIncludes } from "./format";
import NisarPassList from "./NisarPassList";
import { Stat } from "./Stat";

const SOURCE_LABELS: [string, string][] = [
  ["imerg", "IMERG Early — rain"],
  ["smap", "SMAP L4 — soil moisture"],
  ["geos_fp_issued", "GEOS-FP — forecast D+1 to D+3"],
];

// "Agora" card for the live (now/) bundle: what the current run sees — critical
// areas and exposed people from now/summary.json, per-source data dates (BRT)
// and the recent NISAR passes. Rendered only when bundle.mode === "live".
export default function AgoraSources({ bundle }: { bundle: CaseBundle }) {
  const summary = pendingIncludes(bundle, "summary") ? undefined : bundle.summary;
  const dd: Record<string, unknown> = {
    ...(bundle.data_dates ?? {}),
    ...(summary?.data_dates ?? {}),
  };
  const passes = Array.isArray(dd.nisar_passes)
    ? (dd.nisar_passes as NisarPass[])
    : [];
  const source = forecastSourceLabel(
    summary?.forecast_source ?? bundle.manifest?.forecast_source
  );
  const classes = Object.entries(summary?.classes_km2 ?? {});
  const people = summary?.people_critical ?? summary?.people_exposed;

  const known = new Set(SOURCE_LABELS.map(([k]) => k));
  const extraRows = Object.entries(dd).filter(
    ([k, v]) => !known.has(k) && k !== "nisar_passes" && typeof v === "string"
  );

  return (
    <>
      <div className="rounded-md border border-zinc-800 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-300">
          Now — live run
          {bundle.updated_at && (
            <span className="font-normal text-zinc-500">
              {" "}
              · updated {fmtBrt(bundle.updated_at)}
            </span>
          )}
          {source && (
            <span className="ml-2 rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400">
              {source}
            </span>
          )}
        </p>
        {summary ? (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat value={fmtKm2(summary.critical_km2?.any)} label="critical km² (any)" />
            <Stat value={fmtPeople(people)} label="people in critical areas" />
            <Stat value={fmtKm2(summary.critical_km2?.slide)} label="slide km²" />
            <Stat value={fmtKm2(summary.critical_km2?.flood)} label="flood km²" />
          </div>
        ) : (
          <p className="mb-3 text-xs text-zinc-500">
            Live summary pending — awaiting the current run’s summary.json.
          </p>
        )}
        <ul className="space-y-1">
          {SOURCE_LABELS.map(([key, label]) => (
            <li
              key={key}
              className="flex items-center justify-between text-xs text-zinc-400"
            >
              <span>{label}</span>
              <span className="text-zinc-500">
                {typeof dd[key] === "string" ? fmtBrt(dd[key] as string) : "pending"}
              </span>
            </li>
          ))}
          {extraRows.map(([key, v]) => (
            <li
              key={key}
              className="flex items-center justify-between text-xs text-zinc-400"
            >
              <span>{key}</span>
              <span className="text-zinc-500">{fmtBrt(v as string)}</span>
            </li>
          ))}
        </ul>
        {classes.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
            {classes.map(([cls, km2]) => (
              <li
                key={cls}
                className="flex items-center justify-between text-xs text-zinc-400"
              >
                <span>class {cls}</span>
                <span className="text-zinc-500">{fmtKm2(km2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <NisarPassList passes={passes} />
    </>
  );
}
