// Basemap switcher (L52 U3): the CARTO dark-matter-nolabels GL style stays the
// map's base style. "Satellite" adds a NASA GIBS imagery underlay below the
// app layers; "Streets" grafts the voyager GL style's non-symbol layers the
// same way; labels are the GL styles' own symbol layers grafted on top — all
// toggled by visibility, never by setStyle (which would wipe the app layers).

export type Basemap = "dark" | "satellite" | "streets";

export const BASEMAP_ORDER: readonly Basemap[] = ["dark", "satellite", "streets"];

export const BASEMAP_LABEL: Record<Basemap, string> = {
  dark: "Dark",
  satellite: "Satellite",
  streets: "Streets",
};

export const parseBasemap = (v: string | undefined): Basemap | undefined =>
  BASEMAP_ORDER.find((b) => b === v?.trim().toLowerCase());

// Keyless CARTO GL styles whose layers graft onto the running style: the
// shared `protomaps` vector source and the glyph endpoint are identical across
// CARTO styles, so their layer specs can be addLayer'ed verbatim with the ids
// prefixed (their ids collide with the base style's otherwise).
export const BASEMAP_STYLE_URL = {
  /** dark-matter WITH labels — symbol layers = light-text labels */
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  /** voyager — non-symbol layers = streets underlay, symbol layers = labels */
  voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
} as const;

// Source/layer ids of the grafted basemap pieces (all under "tp-bm-").
export const BM_SAT_SRC = "tp-bm-sat";
export const BM_SAT_LYR = "tp-bm-sat-lyr";
export const BM_PREFIX = {
  streets: "tp-bm-st-", // voyager non-symbol layers, below the app layers
  labelsDark: "tp-bm-lab-d-", // dark-matter symbol layers (light text), on top
  labelsVoy: "tp-bm-lab-v-", // voyager symbol layers (dark text), on top
} as const;

// NASA GIBS WMTS, EPSG:3857 GoogleMapsCompatible tiles (order {z}/{y}/{x}).
// VIIRS NOAA-20 true colour serves levels 0-9 (~250 m/px), coverage through
// today (SNPP ended 2026-11-02 and its 'default' tiles go dark) — it
// overzooms to the map's maxZoom. HLS L30 verified too patchy over Rio
// Grande do Sul (empty tiles), so VIIRS alone carries the satellite view.
const GIBS_VIIRS = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg`;

// `imageryDate` is the case reference day (replays). "default" serves the
// latest day GIBS published (live). Anything not YYYY-MM-DD falls back.
const gibsDate = (d?: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? d! : "default";

export interface BasemapPlan {
  /** The raster satellite underlay spec (source + layer ids, tiles, zoom). */
  satellite: {
    source: string;
    layer: string;
    tiles: string[];
    tileSize: number;
    maxzoom: number;
    attribution: string;
    on: boolean;
  };
  /** voyager's non-symbol layers grafted below the app layers (Streets). */
  streetsOn: boolean;
  /** Which grafted symbol-label set shows on top (cities → streets). */
  labels: "dark" | "voyager";
  /** GL style JSONs to fetch for the grafted layers. */
  styleUrls: { dark: string; voyager: string };
}

export function basemapPlan(basemap: Basemap, imageryDate?: string): BasemapPlan {
  return {
    satellite: {
      source: BM_SAT_SRC,
      layer: BM_SAT_LYR,
      tiles: [GIBS_VIIRS(gibsDate(imageryDate))],
      tileSize: 256,
      maxzoom: 9,
      attribution: "Imagery: NASA GIBS VIIRS",
      on: basemap === "satellite",
    },
    streetsOn: basemap === "streets",
    labels: basemap === "streets" ? "voyager" : "dark",
    styleUrls: { dark: BASEMAP_STYLE_URL.dark, voyager: BASEMAP_STYLE_URL.voyager },
  };
}
