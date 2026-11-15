// Rows of the Layers column and the two-layer budget (specialist rule 5: at
// most two data layers at once, besides the basemap and the relief). The TPI
// raster is a data layer and counts. Replaces the hard-coded list of the old
// LayersPanel and toggleBudget(tab) / capToggleQueue for the new screen.
import { manifestRaster, MAX_DATA_LAYERS } from "@/lib/layers";
import { availability, missingText, NO_RADAR_TEXT } from "./availability";
import { declared } from "./lazy";
import { fmtDataDate, fmtDate } from "./format";
import type { MapOverlays } from "./overlays";
import { CANDIDATES_LABEL, floodLabels } from "./radar";
import { frameBasis } from "./steps";
import { HAZARD_LABEL, type CcBundle, type Hazard } from "./types";

export type LayerId =
  | "tpi" | "imerg" | "smap" | "tml"
  | "flood" | "candidates"
  | "catalog" | "opera";

export type LayerGroup = "Analysis" | "Observations" | "Replay evidence";

export const MAX_LAYERS = MAX_DATA_LAYERS;
export const DEFAULT_LAYERS: LayerId[] = ["tpi"];
export const NO_MAP_LAYER_TEXT = "no map layer for this case";

export const BUDGET_RULE_TEXT =
  `At most ${MAX_LAYERS} data layers at once, the TPI index included. Turning on another one turns off the oldest.`;

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
  { id: "smap", group: "Analysis", short: "Soil moisture" },
  { id: "tml", group: "Analysis", short: "Modeled landslide hazard" },
  { id: "flood", group: "Observations", short: "Flood" },
  { id: "candidates", group: "Observations", short: "Scar candidates" },
  { id: "catalog", group: "Replay evidence", short: "Landslide catalog" },
  { id: "opera", group: "Replay evidence", short: "OPERA water map" },
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

export function layerAvailable(bundle: CcBundle, id: LayerId, hazard: Hazard): boolean {
  switch (id) {
    case "tpi":
      return manifestRaster(bundle.manifest?.layers, hazard === "flood" ? "tpiFlood" : "tpiSlide")?.png !== undefined;
    case "imerg":
      return manifestRaster(bundle.manifest?.layers, "imerg")?.png !== undefined;
    case "smap":
      return manifestRaster(bundle.manifest?.layers, "smap")?.png !== undefined;
    case "tml":
      return !!pngLayer(bundle, "t_ml");
    case "opera":
      return !!pngLayer(bundle, "opera_validation");
    case "flood":
      return hasProduct(bundle, bundle.flood, "flood_confirmed");
    case "candidates":
      return hasProduct(bundle, bundle.scars, "landslide_candidates");
    case "catalog":
      return hasProduct(bundle, bundle.catalog, "landslide_catalog");
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
  stepDate?: string
): LayerRow[] {
  const radar = availability(bundle, "radar");
  const passDates = [dateOf(bundle, "nisar_pre"), dateOf(bundle, "nisar_post")]
    .filter((d): d is string => !!d).map((d) => fmtDate(d));
  const label: Record<LayerId, string> = {
    tpi: `TPI index (${HAZARD_LABEL[hazard]})`,
    imerg: "Rain (GPM IMERG)",
    smap: "Soil moisture (SMAP)",
    tml: "Modeled landslide hazard (XGBoost)",
    flood: floodLabels(bundle).layer,
    candidates: CANDIDATES_LABEL,
    catalog: "Landslide catalog",
    opera: "OPERA water map",
  };
  const okSub: Partial<Record<LayerId, string | undefined>> = {
    tpi: [stepDate ? `data ${fmtDataDate(stepDate)}` : undefined, frameBasis(bundle, stepDate, hazard)]
      .filter(Boolean).join(" · ") || undefined,
    imerg: dateOf(bundle, "imerg") ? `data ${fmtDataDate(dateOf(bundle, "imerg"))}` : undefined,
    smap: dateOf(bundle, "smap") ? `data ${fmtDataDate(dateOf(bundle, "smap"))}` : undefined,
    flood: passDates.length ? `NISAR passes: ${passDates.join(", ")}` : undefined,
    opera: pngLayer(bundle, "opera_validation")?.date
      ? `data ${fmtDataDate(pngLayer(bundle, "opera_validation")?.date)}` : undefined,
  };
  const reason: Record<LayerId, string> = {
    tpi: NO_MAP_LAYER_TEXT,
    imerg: NO_MAP_LAYER_TEXT,
    smap: NO_MAP_LAYER_TEXT,
    tml: NO_MAP_LAYER_TEXT,
    opera: NO_MAP_LAYER_TEXT,
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

// Input of the map hook.
export const overlaysFor = (on: readonly LayerId[]): MapOverlays => ({
  floodPolygons: on.includes("flood"),
  landslideCandidates: on.includes("candidates"),
  catalogPoints: on.includes("catalog"),
  operaValidation: on.includes("opera"),
  mlHazard: on.includes("tml"),
});

export const layerStateFor = (on: readonly LayerId[], hazard: Hazard) => ({
  tpiSlide: on.includes("tpi") && hazard === "slide",
  tpiFlood: on.includes("tpi") && hazard === "flood",
  imerg: on.includes("imerg"),
  smap: on.includes("smap"),
  nisar: false,
  pTrigger: false, // wired by the P(trigger) horizon unit
});
