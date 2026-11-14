"use client";

import { forecastSourceLabel } from "@/lib/contract";
import { fmtKm2, fmtPeople } from "@/lib/tpi";
import type { CaseBundle, PriorityZone } from "@/lib/types";
import TpiChart from "../TpiChart";
import AgoraSources from "./AgoraSources";
import { isMockDerived } from "./format";
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
  const critical = zones.filter((z) => z.tpi >= 0.6);
  const reached = critical.length > 0;
  const areaKm2 = critical.reduce((a, z) => a + z.area_km2, 0);
  const people = critical.reduce((a, z) => a + z.people, 0);
  const mock = isMockDerived(bundle);
  const source = forecastSourceLabel(
    bundle.manifest?.forecast_source ?? bundle.summary?.forecast_source
  );

  return (
    <div className="space-y-3">
      <div
        className={`rounded-md border p-3 ${
          reached ? "border-red-800 bg-red-950/60" : "border-amber-800 bg-amber-950/40"
        }`}
      >
        <div className="flex items-center gap-2">
          <WarnIcon />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`text-sm font-bold tracking-wide ${
                  reached ? "text-red-400" : "text-amber-400"
                }`}
              >
                {reached ? "TIPPING POINT REACHED" : "TIPPING POINT WATCH"}
              </p>
              {source && (
                <span className="rounded border border-zinc-700 bg-zinc-900/70 px-1.5 py-0.5 text-xs text-zinc-400">
                  {source}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {reached
                ? "High likelihood of landslide and/or flooding in monitored areas."
                : "Elevated risk in monitored areas — conditions trending toward the tipping point."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-5">
          <Stat big value={fmtKm2(areaKm2)} label="critical" />
          <Stat big value={fmtPeople(people)} label="people exposed" />
          {mock && (
            <span className="ml-auto text-right text-xs leading-tight text-zinc-500">
              Illustrative
              <br />
              demo data.
            </span>
          )}
        </div>
      </div>

      {bundle.series && <TpiChart series={bundle.series} dayIndex={dayIndex} />}

      {bundle.mode === "live" && <AgoraSources bundle={bundle} />}

      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-300">
          Priority zones (TPI ≥ 0.60)
        </p>
        <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
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
