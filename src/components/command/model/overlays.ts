import type { ManifestLayer } from "@/lib/types";
import type { ProbHorizon } from "@/lib/layers";
// Pure part of the additive `options` argument of useMapLayers. Without
// options the result equals what the hook computed before (tab plan, or
// showFlood when there is no tab), so the old screen is not affected.
import { overlayPlan, type TabKey } from "@/lib/layers";

export interface MapOverlays {
  floodPolygons: boolean;
  landslideCandidates: boolean;
  catalogPoints: boolean;
  operaValidation: boolean;
  mlHazard: boolean; // t_ml raster; before the options it was always on
  emsFlood?: boolean; // RS: Copernicus EMS EMSR720 flood outline
}

export interface MapLayerOptions {
  // false: do not draw the hook's own zone pins (and their popup).
  zoneMarkers?: boolean;
  // When given, the TPI frame is chosen by this date and not by
  // bundle.series.days[dayIndex] (cases without a series).
  frameDate?: string;
  // When given, replaces overlayPlan(tab) and showFlood.
  overlays?: MapOverlays;
  // P(trigger) horizon painted by the pTrigger toggle (default 24h).
  probHorizon?: ProbHorizon;
  // When given, this TPI frame is painted instead of the one picked for the
  // date (replay "forecast issued this day": the GFS frame for D+k).
  frameLayer?: ManifestLayer;
}

export interface OverlayVisibility {
  flood: boolean;
  scars: boolean;
  catalog: boolean;
  opera: boolean;
  nightLights: boolean;
  tml: boolean;
  ems: boolean;
}

export function resolveOverlays(
  tab: TabKey | string | undefined,
  showFlood: boolean,
  nisarToggle: boolean,
  overlays?: MapOverlays
): OverlayVisibility {
  if (overlays) {
    return {
      flood: overlays.floodPolygons,
      scars: overlays.landslideCandidates,
      catalog: overlays.catalogPoints,
      opera: overlays.operaValidation,
      // The hook looks for a layer id `night_lights` that the contract does
      // not define; the new screen shows night lights as a before/after pair.
      nightLights: false,
      tml: overlays.mlHazard,
      ems: !!overlays.emsFlood,
    };
  }
  const plan = overlayPlan(tab);
  const noTab = tab === undefined;
  return {
    flood: noTab ? showFlood : plan.floodPolygons,
    scars: noTab ? showFlood || nisarToggle : plan.landslideCandidates,
    catalog: noTab ? false : plan.catalogPoints,
    opera: noTab ? false : plan.operaValidation,
    nightLights: noTab ? false : plan.nightLights,
    tml: true,
    ems: false,
  };
}

// Date that selects the TPI frame.
export const resolveFrameDate = (
  seriesDate: string | undefined,
  options?: MapLayerOptions
): string | undefined => options?.frameDate ?? seriesDate;

export const zoneMarkersOn = (options?: MapLayerOptions): boolean =>
  options?.zoneMarkers !== false;
