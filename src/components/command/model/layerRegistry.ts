// Rows of the Layers column and the two-layer budget (specialist rule 5: at
// most two data layers at once, besides the basemap and the relief). The TPI
// raster is a data layer and counts. Replaces the hard-coded list of the old
// LayersPanel and toggleBudget(tab) / capToggleQueue for the new screen.
import {
  manifestRaster,
  MAX_DATA_LAYERS,
  probFrame,
  probHorizonsAvailable,
  probLayerNote,
  probLayerTitle,
  type ProbHorizon,
} from "@/lib/layers";
import { availability, hasNisarPair, missingText, NO_RADAR_TEXT } from "./availability";
import { declared } from "./lazy";
import { fmtDataStamp, fmtDate } from "./format";
import type { MapOverlays } from "./overlays";
import { CANDIDATES_LABEL, floodLabels } from "./radar";
import { frameBasis, partlyForecastText } from "./steps";
import { HAZARD_LABEL, RISK_PAUSED_SHORT, type CcBundle, type Hazard } from "./types";

export type LayerId =
  | "tpi" | "imerg" | "smap" | "tml" | "ptrigger"
  | "flood" | "candidates"
  | "catalog" | "opera" | "ems" | "hand";

export type LayerGroup = "Analysis" | "Observations" | "Replay evidence";

export const MAX_LAYERS = MAX_DATA_LAYERS;
export const DEFAULT_LAYERS: LayerId[] = ["tpi"];

// L48 (conductor, Lucas idea): in Now the landslide view opens on the ML
// likelihood (p_trigger × NOAA GFS forecast) when published; the landslide
// TPI becomes the secondary rain-index toggle. Flood stays TPI.
export const ML_SKILL_LINE =
  "Tested on unseen events: catches 65% of landslides on the day, 48% 3 days ahead (rain index: 27% / 16%, but fewer false alarms). Missed RS 2024 and Petrópolis.";

// lead-ml: one line per horizon (relative index, not a probability).
export function mlHorizonTip(h: string, obsThrough?: string, gfsIssued?: string): string {
  const obs = obsThrough ? fmtDate(obsThrough.slice(0, 10)) : "the latest day";
  const gfs = gfsIssued ? fmtDate(gfsIssued.slice(0, 10)) : "the latest run";
  switch (h) {
    case "24h": return `Landslide trigger, next 24 h: ML (XGBoost on rain + soil) using observed IMERG to ${obs} and the NOAA GFS run of ${gfs}, weighted by landslide susceptibility. Higher = more likely than elsewhere today; not a % chance.`;
    case "48h": return `Landslide trigger, next 48 h: same model over the next two forecast days (GFS ${gfs}). In tests it ranked landslide sites about as well as a simple forecast-rain-vs-local-extreme rule, and better than TPI.`;
    case "72h": return "Landslide trigger, next 72 h: same model over three forecast days. Forecast skill falls with lead time; read it as an outlook.";
    case "7d": return "Landslide trigger, next 7 days: low forecast skill beyond ~3 days (GFS); use only as a heads-up, never as a warning.";
    default: return "Relative index, not a probability.";
  }
}
export function defaultLayersFor(bundle: CcBundle, hazard: Hazard): LayerId[] {
  if (bundle.mode === "live" && hazard === "slide" && layerAvailable(bundle, "ptrigger", hazard)) return ["ptrigger"];
  return [...DEFAULT_LAYERS];
}
// Hazard switch in Now: the ML layer is landslide-only — flood gets the TPI,
// back to landslide gets the ML layer again (when the TPI stood in for it).
export function swapForHazard(bundle: CcBundle, on: readonly LayerId[], hazard: Hazard): LayerId[] {
  if (bundle.mode !== "live") return [...on];
  if (hazard === "flood" && on.includes("ptrigger")) return on.map((id) => (id === "ptrigger" ? "tpi" : id)).filter((id, i, a) => a.indexOf(id) === i);
  if (hazard === "slide" && on.includes("tpi") && !on.includes("ptrigger") && layerAvailable(bundle, "ptrigger", hazard)) {
    return on.map((id) => (id === "tpi" ? "ptrigger" : id));
  }
  return [...on];
}
export const NO_MAP_LAYER_TEXT = "no map layer for this case";

export const BUDGET_RULE_TEXT =
  `Up to ${MAX_LAYERS} data layers (TPI included); a new one turns off the oldest.`;

export const REFERENCE_TEXT =
  "Always on: municipal boundaries, city labels, permanent water, relief.";

interface Def {
  id: LayerId;
  group: LayerGroup;
  short: string; // name used in the "turned off" line
}

const DEFS: Def[] = [
  { id: "tpi", group: "Analysis", short: "TPI index" },
  { id: "imerg", group: "Analysis", short: "Rain" },
  { id: "hand", group: "Analysis", short: "Low ground (HAND ≤ 5 m)" },
  { id: "smap", group: "Analysis", short: "Soil moisture" },
  { id: "tml", group: "Analysis", short: "Modeled landslide hazard" },
  { id: "ptrigger", group: "Analysis", short: "Rain-triggered landslide likelihood" },
  { id: "flood", group: "Observations", short: "Flood" },
  { id: "candidates", group: "Observations", short: "Scar candidates" },
  { id: "catalog", group: "Replay evidence", short: "Landslide catalog" },
  { id: "opera", group: "Replay evidence", short: "NISAR vs OPERA flood check" },
  { id: "ems", group: "Replay evidence", short: "Independent flood map (EU emergency service)" },
];

export const LAYER_SHORT = Object.fromEntries(
  DEFS.map((d) => [d.id, d.short])
) as Record<LayerId, string>;

export interface LayerRow {
  id: LayerId;
  group: LayerGroup;
  label: string;
  available: boolean;
  on: boolean;
  sub?: string; // data date when available, else the reason
}

const dateOf = (bundle: CcBundle, key: string): string | undefined => {
  const v = bundle.data_dates?.[key];
  return typeof v === "string" ? v : undefined;
};

const pngLayer = (bundle: CcBundle, id: string) =>
  (bundle.manifest?.layers ?? []).find((l) => l.id === id && l.png);

// Risk outputs of the live run, held back while the run is unverified.
const RISK_LAYERS: readonly LayerId[] = ["tpi", "ptrigger"];

export function layerAvailable(bundle: CcBundle, id: LayerId, hazard: Hazard): boolean {
  if (bundle.riskPaused && RISK_LAYERS.includes(id)) return false;
  switch (id) {
    case "tpi":
      return manifestRaster(bundle.manifest?.layers, hazard === "flood" ? "tpiFlood" : "tpiSlide")?.png !== undefined;
    case "imerg":
      return manifestRaster(bundle.manifest?.layers, "imerg")?.png !== undefined;
    case "hand":
      return manifestRaster(bundle.manifest?.layers, "hand")?.png !== undefined;
    case "smap":
      return manifestRaster(bundle.manifest?.layers, "smap")?.png !== undefined;
    case "tml":
      return !!pngLayer(bundle, "t_ml");
    case "ptrigger":
      // Horizon-keyed frames (p_trigger_<h>) or the legacy single family.
      return (
        probHorizonsAvailable(bundle.manifest?.layers).length > 0 ||
        probFrame(bundle.manifest?.layers, "24h")?.png !== undefined
      );
    case "opera":
      return !!pngLayer(bundle, "opera_validation");
    case "flood":
      // Live: the OPERA DSWx-S1 candidates draw in the same layer.
      return hasProduct(bundle, bundle.flood, "flood_confirmed") ||
        (bundle.mode === "live" && declared(bundle, "flood_dswx"));
    case "candidates":
      return hasProduct(bundle, bundle.scars, "landslide_candidates");
    case "catalog":
      return hasProduct(bundle, bundle.catalog, "landslide_catalog");
    case "ems":
      // Declared product, or the RS EMS scores published (file at the
      // agreed geojson/flood_ems.geojson).
      return declared(bundle, "flood_ems") ||
        typeof (bundle.metricsView as Record<string, unknown> | undefined)?.flood_ems_iou === "number";
  }
}

// A vector product is there when the bundle carries features, or when the
// bundle does not carry the file and the products map declares it (the map
// fetches it by URL when the row is turned on).
const hasProduct = (
  bundle: CcBundle,
  inline: GeoJSON.FeatureCollection | undefined,
  key: string
): boolean =>
  inline ? inline.features.length > 0
    : declared(bundle, key) && bundle.lazy?.[key as "landslide_candidates"] !== "missing";

// Rows for a case. `stepDate` is the date of the selected step. Replay
// evidence rows exist in Replay only.
export function layerRows(
  bundle: CcBundle,
  on: readonly LayerId[],
  hazard: Hazard,
  stepDate?: string,
  probHorizon: ProbHorizon = "24h"
): LayerRow[] {
  const radar = availability(bundle, "radar");
  const passDates = [dateOf(bundle, "nisar_pre"), dateOf(bundle, "nisar_post")]
    .filter((d): d is string => !!d).map((d) => fmtDate(d));
  const label: Record<LayerId, string> = {
    tpi: bundle.mode === "live" && hazard === "slide" && layerAvailable(bundle, "ptrigger", hazard)
      ? "Rain index (TPI, landslide)" : `TPI index (${HAZARD_LABEL[hazard]})`,
    imerg: "Rain (GPM IMERG)",
    hand: "Low ground (HAND ≤ 5 m)",
    smap: "Soil moisture (SMAP)",
    tml: "Modeled landslide hazard (XGBoost)",
    ptrigger: probLayerTitle(probHorizon),
    flood: floodLabels(bundle).layer,
    candidates: CANDIDATES_LABEL,
    catalog: "Landslide catalog",
    opera: "NISAR vs OPERA flood check",
    ems: "Independent flood map (EU emergency service, Taquari valley only)",
  };
  const okSub: Partial<Record<LayerId, string | undefined>> = {
    tpi: partlyForecastText(bundle, stepDate) ? `${partlyForecastText(bundle, stepDate)} (partly forecast)`
      : [stepDate ? `data ${fmtDataStamp(stepDate)}` : undefined, frameBasis(bundle, stepDate, hazard)]
      .filter(Boolean).join(" · ") || undefined,
    imerg: dateOf(bundle, "imerg") ? `data ${fmtDataStamp(dateOf(bundle, "imerg"))}` : undefined,
    smap: dateOf(bundle, "smap") ? `data ${fmtDataStamp(dateOf(bundle, "smap"))}` : undefined,
    ptrigger: probLayerNote(probFrame(bundle.manifest?.layers, probHorizon, stepDate)),
    flood: passDates.length ? `NISAR passes: ${passDates.join(", ")}` : undefined,
    opera: pngLayer(bundle, "opera_validation")?.date
      ? `data ${fmtDataStamp(pngLayer(bundle, "opera_validation")?.date)}` : undefined,
  };
  const reason: Record<LayerId, string> = {
    tpi: bundle.riskPaused ? RISK_PAUSED_SHORT : NO_MAP_LAYER_TEXT,
    imerg: NO_MAP_LAYER_TEXT,
    smap: NO_MAP_LAYER_TEXT,
    tml: NO_MAP_LAYER_TEXT,
    ptrigger: bundle.riskPaused ? RISK_PAUSED_SHORT : NO_MAP_LAYER_TEXT,
    opera: NO_MAP_LAYER_TEXT,
    ems: NO_MAP_LAYER_TEXT,
    hand: NO_MAP_LAYER_TEXT,
    flood: radar.state === "not-applicable" ? NO_RADAR_TEXT : missingText(availability(bundle, "flood_confirmed")),
    candidates: missingText(availability(bundle, "landslide_candidates")),
    catalog: missingText(availability(bundle, "landslide_catalog")),
  };
  return DEFS.filter((d) => d.group !== "Replay evidence" || bundle.mode === "replay").map((d) => {
    const available = layerAvailable(bundle, d.id, hazard);
    return {
      id: d.id,
      group: d.group,
      label: label[d.id],
      available,
      on: available && on.includes(d.id),
      // The pass dates are real data: they show on the flood row even
      // while the polygons are missing.
      sub: available ? okSub[d.id]
        : d.id === "flood" && okSub.flood ? `${reason.flood} · ${okSub.flood}` : reason[d.id],
    };
  });
}

// Judge report #6 (conductor): a toggle that can never turn on for this case
// ("no map layer for this case") is hidden, not shown greyed out. Rows with
// a reason that can change (risk paused, radar pending, pass dates) stay.
export const visibleLayerRows = <T extends { available: boolean; sub?: string }>(rows: T[]): T[] =>
  rows.filter((r) => r.available || r.sub !== NO_MAP_LAYER_TEXT);

export interface ToggleResult {
  layers: LayerId[]; // oldest first, at most MAX_LAYERS
  evicted?: LayerId;
  notice?: string; // for example "Rain turned off to show Flood"
}

// Turn a row on or off. Turning on a third counted row turns off the oldest
// one and names it.
export function toggleLayer(on: readonly LayerId[], id: LayerId): ToggleResult {
  if (on.includes(id)) return { layers: on.filter((k) => k !== id) };
  const next = [...on, id];
  if (next.length <= MAX_LAYERS) return { layers: next };
  const evicted = next[0];
  return {
    layers: next.slice(next.length - MAX_LAYERS),
    evicted,
    notice: `${LAYER_SHORT[evicted]} turned off to show ${LAYER_SHORT[id]}`,
  };
}

// "Confirm with NISAR radar": exactly the TPI index plus the flood polygons,
// so the rain warning and the radar confirmation are visible together.
export function confirmRadarLayers(on: readonly LayerId[]): ToggleResult {
  const layers: LayerId[] = ["tpi", "flood"];
  const dropped = on.filter((k) => !layers.includes(k));
  return {
    layers,
    evicted: dropped[0],
    notice: dropped.length
      ? `${dropped.map((k) => LAYER_SHORT[k]).join(" and ")} turned off to show ${LAYER_SHORT.flood}`
      : undefined,
  };
}

// On a case change: drop the layers the new case lacks, keep the order.
export const keepAvailable = (
  bundle: CcBundle,
  on: readonly LayerId[],
  hazard: Hazard
): LayerId[] => on.filter((id) => layerAvailable(bundle, id, hazard)).slice(-MAX_LAYERS);

// Now with a published NISAR pair opens with the radar flood candidates on
// (L27: what is on the ground first), next to the TPI index. Replay cases and
// a Now without a pair keep the layers they were given.
export function withRadarDefault(bundle: CcBundle, on: readonly LayerId[], hazard: Hazard): LayerId[] {
  // A replay with no index layer (Uruguay v0: radar only) opens on its
  // flooded-area layer instead of an empty map.
  if (bundle.mode !== "live" && on.length === 0 && layerAvailable(bundle, "flood", hazard)) return ["flood"];
  if (bundle.mode !== "live" || on.includes("flood")) return [...on];
  if (!hasNisarPair(bundle) && !declared(bundle, "flood_dswx")) return [...on];
  if (!layerAvailable(bundle, "flood", hazard)) return [...on];
  return toggleLayer(on, "flood").layers;
}

// Input of the map hook.
export const overlaysFor = (on: readonly LayerId[]): MapOverlays => ({
  floodPolygons: on.includes("flood"),
  landslideCandidates: on.includes("candidates"),
  catalogPoints: on.includes("catalog"),
  operaValidation: on.includes("opera"),
  mlHazard: on.includes("tml"),
  emsFlood: on.includes("ems"),
});

export const layerStateFor = (on: readonly LayerId[], hazard: Hazard) => ({
  tpiSlide: on.includes("tpi") && hazard === "slide",
  tpiFlood: on.includes("tpi") && hazard === "flood",
  imerg: on.includes("imerg"),
  smap: on.includes("smap"),
  nisar: false,
  pTrigger: on.includes("ptrigger"),
  hand: on.includes("hand"),
});
