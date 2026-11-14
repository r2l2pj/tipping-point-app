"use client";

import { forecastSourceLabel } from "@/lib/contract";
import { cutsFor, fmtKm2, fmtPeople } from "@/lib/tpi";
import type { CaseBundle, PriorityZone } from "@/lib/types";
import TpiChart from "../TpiChart";
import AgoraSources from "./AgoraSources";
import { isMockDerived, pendingIncludes } from "./format";
import { Stat } from "./Stat";

export default function AlertTab({
  bundle,
  zones,
  dayIndex,
  onConfirmRadar,
}: {
  bundle: CaseBundle;
  zones: PriorityZone[];
  dayIndex: number;
  onConfirmRadar: () => void;
}) {
  const seriesThreshold = bundle.series?.tpi_threshold;
  const threshold = typeof seriesThreshold === "number" && Number.isFinite(seriesThreshold)
    ? seriesThreshold : cutsFor(bundle)[2];
  const critical = zones.filter((z) => /^critical$/i.test(z.class));
  const monitoring =
    (!bundle.series && zones.length === 0) ||
    pendingIncludes(bundle, "series") ||
    pendingIncludes(bundle, "priority_zones");
  const reached = !monitoring &&
    (bundle.series?.days[dayIndex]?.tpi ?? -Infinity) >= threshold;
  const areaKm2 = critical.reduce((a, z) => a + z.area_km2, 0);
  // GPW population join is optional in the pipeline — when every zone
  // ships people:null the exposed count is pending, not zero.
  const hasPeople = zones.some(
    (z) => typeof z.people === "number" && Number.isFinite(z.people)
  );
  const people = critical.reduce(
    (a, z) => a + (typeof z.people === "number" ? z.people : 0),
    0
  );
  const mock = isMockDerived(bundle);
  const source = forecastSourceLabel(
    bundle.manifest?.forecast_source ?? bundle.summary?.forecast_source
  );

  return (
    <div className="space-y-3">
      <div
        className={`rounded-md border p-3 ${
          monitoring ? "border-zinc-700 bg-zinc-900"
            : reached ? "border-red-800 bg-red-950/60" : "border-amber-800 bg-amber-950/40"
        }`}
      >
        <div className="flex items-center gap-2">
          <WarnIcon />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`text-sm font-bold tracking-wide ${
                  monitoring ? "text-zinc-400"
                    : reached ? "text-red-400" : "text-amber-400"
                }`}
              >
                {monitoring ? "MONITORING PENDING"
                  : reached ? "TIPPING POINT REACHED" : "TIPPING POINT WATCH"}
              </p>
              {source && (
                <span className="rounded border border-zinc-700 bg-zinc-900/70 px-1.5 py-0.5 text-xs text-zinc-400">
                  {source}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {monitoring
                ? "No risk data published for this case yet — the pipeline has not produced a TPI series or monitored zones."
                : reached
                  ? "High likelihood of landslide and/or flooding in monitored areas."
                  : "Elevated risk in monitored areas — conditions trending toward the tipping point."}
            </p>
          </div>
        </div>
        {!monitoring && (
          <div className="mt-3 flex items-center gap-5">
            <Stat big value={fmtKm2(areaKm2)} label="critical" absent={zones.length === 0} />
            <Stat big value={fmtPeople(people)} label="people exposed" absent={!hasPeople} />
            {mock && (
              <span className="ml-auto text-right text-xs leading-tight text-zinc-500">
                Data
                <br />
                pending.
              </span>
            )}
          </div>
        )}
      </div>

      {bundle.series && <TpiChart series={bundle.series} dayIndex={dayIndex} />}

      {bundle.mode === "live" && <AgoraSources bundle={bundle} />}

      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-300">
          Priority zones (TPI ≥ {threshold.toFixed(2)})
        </p>
        <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
          {zones.length === 0 && (
            <li className="px-2.5 py-2 text-xs text-zinc-500">
              Pending — no monitored zones for this case.
            </li>
          )}
          {zones.map((z) => (
            <li key={z.rank} className="flex items-center gap-2.5 px-2.5 py-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-red-700 text-xs font-bold text-white">
                {z.rank}
              </span>
              <span className="flex-1 text-xs text-zinc-200">{z.name}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-bold tracking-wide ${
                  z.class === "Critical"
                    ? "bg-red-800 text-red-100"
                    : "bg-orange-700 text-orange-100"
                }`}
              >
                {z.class.toUpperCase()}
              </span>
              <span className="w-14 text-right text-xs text-zinc-400">
                {z.area_km2.toFixed(1)} km²
              </span>
              <span className="w-14 text-right text-xs text-zinc-400">
                {fmtPeople(z.people)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onConfirmRadar}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-600 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500"
      >
        <RadarIcon /> Confirm with NISAR radar →
      </button>
    </div>
  );
}

function WarnIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#f87171"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 3 2 20h20z" strokeLinejoin="round" />
      <path d="M12 10v4M12 17.5v.5" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" strokeDasharray="3 2" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <path d="M8 8 12.5 3.5" />
    </svg>
  );
}
