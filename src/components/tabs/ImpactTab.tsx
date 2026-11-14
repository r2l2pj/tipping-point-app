"use client";

import { fmtKm2, fmtPct, fmtPeople } from "@/lib/tpi";
import type { CaseBundle } from "@/lib/types";
import { isMockDerived } from "./format";
import { StatCard } from "./Stat";

export default function ImpactTab({ bundle }: { bundle: CaseBundle }) {
  const m = bundle.metricsView;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="People in critical areas"
          value={fmtPeople(m?.people_critical)}
          accent="red"
        />
        <StatCard
          label="People flooded"
          value={fmtPeople(m?.people_flooded)}
          accent="red"
        />
        <StatCard
          label="Flooded area"
          value={fmtKm2(m?.flooded_km2)}
          accent="blue"
        />
        <StatCard
          label="Night-light drop"
          value={fmtPct(m?.night_light_drop_pct)}
          accent="amber"
        />
      </div>
      <div className="rounded-md border border-zinc-800 p-3">
        <p className="text-xs font-medium text-zinc-300">Exposure basis</p>
        <p className="mt-1 text-xs leading-snug text-zinc-400">
          Population: GPW v4 (NASA SEDAC), counted in TPI ≥ 0.60 cells.
          Lights-out compares VIIRS Black Marble radiance before/after the
          event.
        </p>
      </div>
      {isMockDerived(bundle) && (
        <p className="text-xs text-zinc-600">Illustrative demo data.</p>
      )}
    </div>
  );
}
