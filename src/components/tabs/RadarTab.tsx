"use client";

import { fmtDate, fmtKm2 } from "@/lib/tpi";
import type { CaseBundle, NisarPass } from "@/lib/types";
import NisarPassList from "./NisarPassList";
import { StatCard } from "./Stat";

export default function RadarTab({ bundle }: { bundle: CaseBundle }) {
  const dd = bundle.data_dates ?? {};
  const pre = typeof dd.nisar_pre === "string" ? dd.nisar_pre : null;
  const post = typeof dd.nisar_post === "string" ? dd.nisar_post : null;
  const passes = Array.isArray(dd.nisar_passes)
    ? (dd.nisar_passes as NisarPass[])
    : null;
  const candidates = bundle.scars?.features.length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Flooded area (NISAR)"
          value={fmtKm2(bundle.metricsView?.flooded_km2)}
          accent="blue"
        />
        <StatCard
          label="Landslide scar candidates (HLS optical)"
          value={candidates == null ? "—" : String(candidates)}
          accent="amber"
        />
      </div>
      <p className="text-xs leading-snug text-zinc-500">
        Landslide scar candidates (HLS optical) — candidates, never confirmed.
      </p>

      <div className="rounded-md border border-dashed border-zinc-700 p-3">
        <p className="text-xs font-medium text-zinc-300">
          NISAR GCOV — before / after
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {pre && post
            ? `${fmtDate(pre)} → ${fmtDate(post)}. `
            : "Awaiting a NISAR pair over the AOI. "}
          The before/after swipe lands on the map in a follow-up.
        </p>
      </div>

      <div className="rounded-md border border-zinc-800 p-3">
        <p className="text-xs leading-snug text-zinc-400">
          NISAR radar confirms floods only in this case; scar candidates come
          from post-event HLS optical — the GUNW pair spanning the event is a
          declared limitation.
        </p>
      </div>

      {passes && <NisarPassList passes={passes} />}
    </div>
  );
}
