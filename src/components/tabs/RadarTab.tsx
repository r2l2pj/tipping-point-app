"use client";

import { useEffect, useState } from "react";
import { canonicalCaseId } from "@/lib/contract";
import { assetUrl, fetchGeo, fmtDate, geoUrl } from "@/lib/layers";
import { fmtKm2 } from "@/lib/tpi";
import type { CaseBundle, NisarPass } from "@/lib/types";
import SwipeCompare from "../SwipeCompare";
import NisarPassList from "./NisarPassList";
import { pendingIncludes } from "./format";
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
  const caseDir = canonicalCaseId(bundle.manifest?.event ?? bundle.id);
  // Scar count: the geojson left the bundle (payload ruling) — fetch its URL
  // lazily through the shared cache the map source also uses. null = unknown.
  const scarsUrl = geoUrl(
    bundle,
    caseDir,
    "landslide_candidates",
    "geojson/landslide_candidates.geojson"
  );
  const [fetched, setFetched] = useState<number | null>(null);
  useEffect(() => {
    if (bundle.scars || !scarsUrl) return;
    let live = true;
    fetchGeo(scarsUrl).then(
      (fc) => live && setFetched(fc?.features.length ?? null)
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scarsUrl]);
  const candidates = bundle.scars?.features.length ?? fetched;
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
  const metrics = bundle.metricsView as (CaseBundle["metricsView"] & {
    flooded_km2_scope?: string;
    swath_coverage_pct?: unknown;
  }) | undefined;
  const floodSource = metrics?.flood_source;
  const coverage = metrics?.swath_coverage_pct;
  const swathCoverage = metrics?.flooded_km2_scope === "within NISAR swath" &&
    typeof coverage === "number" && Number.isFinite(coverage)
    ? Math.round(coverage > 1 ? coverage : coverage * 100) : null;
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
        {(hasNisarPair || metrics?.flooded_km2 != null) && (
          <div>
            <StatCard
              label={hasNisarPair ? "Flooded area (NISAR)" :
                floodSource === "opera"
                  ? "Flooded area (optical/OPERA reference)"
                  : "Flooded area (observed reference)"
              }
              value={fmtKm2(metrics?.flooded_km2)}
              accent="blue"
              absent={hasNisarPair && metrics?.flooded_km2 == null}
            />
            {swathCoverage !== null && (
              <p className="mt-1 text-xs text-zinc-500">
                {`within the NISAR swath — ${swathCoverage}% of the area covered`}
              </p>
            )}
          </div>
        )}
        <StatCard
          label="Landslide scar candidates (HLS optical)"
          value={candidates == null ? "—" : String(candidates)}
          accent="amber"
          absent={
            candidates == null ||
            pendingIncludes(bundle, "landslide_candidates")
          }
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
            "No radar for this event (before NISAR launch)."
          )}
        </p>
      </div>

      {hasNisarPair && (
        <div className="rounded-md border border-zinc-800 p-3">
          <p className="text-xs leading-snug text-zinc-400">
            NISAR radar confirms floods only in this case; scar candidates come
            from post-event HLS optical — the GUNW pair spanning the event is a
            declared limitation.
          </p>
        </div>
      )}

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
