"use client";

import { canonicalCaseId } from "@/lib/contract";
import { assetUrl, fmtDate } from "@/lib/layers";
import { fmtKm2 } from "@/lib/tpi";
import type { CaseBundle, NisarPass } from "@/lib/types";
import SwipeCompare from "../SwipeCompare";
import NisarPassList from "./NisarPassList";
import { StatCard } from "./Stat";

type BBox = [number, number, number, number];

const unionBounds = (a?: BBox, b?: BBox): BBox | undefined =>
  a && b
    ? [
        Math.min(a[0], b[0]),
        Math.min(a[1], b[1]),
        Math.max(a[2], b[2]),
        Math.max(a[3], b[3]),
      ]
    : (a ?? b);

export default function RadarTab({ bundle }: { bundle: CaseBundle }) {
  const dd = bundle.data_dates ?? {};
  const pre = typeof dd.nisar_pre === "string" ? dd.nisar_pre : null;
  const post = typeof dd.nisar_post === "string" ? dd.nisar_post : null;
  const passes = Array.isArray(dd.nisar_passes)
    ? (dd.nisar_passes as NisarPass[])
    : null;
  const candidates = bundle.scars?.features.length;

  const caseDir = canonicalCaseId(bundle.manifest?.event ?? bundle.id);
  const ml = bundle.manifest?.layers ?? [];
  const preLayer = ml.find((l) => l.id === "nisar_pre");
  const postLayer = ml.find((l) => l.id === "nisar_post");
  const preUrl = assetUrl(caseDir, preLayer?.png);
  const postUrl = assetUrl(caseDir, postLayer?.png);
  const hasNisarPair = Boolean(
    (pre && post) ||
      (preLayer &&
        postLayer &&
        (preUrl || assetUrl(caseDir, preLayer.cog)) &&
        (postUrl || assetUrl(caseDir, postLayer.cog)))
  );
  const floodSource = (
    bundle.metricsView as { flood_source?: string } | undefined
  )?.flood_source;
  const swipe =
    preLayer && postLayer && preUrl && postUrl
      ? {
          bounds:
            unionBounds(preLayer.bounds, postLayer.bounds) ?? bundle.bbox,
          before: {
            url: preUrl,
            label: `pre-event GCOV — ${fmtDate(preLayer.date ?? pre)}`,
            bounds: preLayer.bounds,
          },
          after: {
            url: postUrl,
            label: `post-event GCOV — ${fmtDate(postLayer.date ?? post)}`,
            bounds: postLayer.bounds,
          },
        }
      : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {hasNisarPair ? (
          <StatCard
            label="Flooded area (NISAR)"
            value={fmtKm2(bundle.metricsView?.flooded_km2)}
            accent="blue"
          />
        ) : (
          bundle.metricsView?.flooded_km2 != null && (
            <StatCard
              label={
                floodSource === "opera"
                  ? "Flooded area (optical/OPERA reference)"
                  : "Flooded area (observed reference)"
              }
              value={fmtKm2(bundle.metricsView.flooded_km2)}
              accent="blue"
            />
          )
        )}
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
          {hasNisarPair ? (
            <>
              {pre && post ? `${fmtDate(pre)} → ${fmtDate(post)}. ` : null}
              {swipe ? "Drag the divider below to compare." : null}
            </>
          ) : bundle.mode === "live" ? (
            "Awaiting a NISAR pair over the AOI."
          ) : (
            "No radar for this event (before NISAR launch). The optical/observed reference is shown where available."
          )}
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

      {swipe && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-300">
            NISAR before/after — drag to compare
          </p>
          <div className="h-56 overflow-hidden rounded-md border border-zinc-700">
            <SwipeCompare
              bounds={swipe.bounds}
              before={swipe.before}
              after={swipe.after}
            />
          </div>
        </div>
      )}
    </div>
  );
}
