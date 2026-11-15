// Basemap switcher (L52 U3): the CARTO dark-matter-nolabels GL style stays the
// map's base style. "Satellite" (NASA GIBS imagery) and "Streets" (CARTO
// raster) are raster underlays added below the app layers, plus a labels-only
// raster above them — toggled by visibility, never by setStyle (which would
// wipe the app layers).

export type Basemap = "dark" | "satellite" | "streets";

export const BASEMAP_ORDER: readonly Basemap[] = ["dark", "satellite", "streets"];

export const BASEMAP_LABEL: Record<Basemap, string> = {
  dark: "Dark",
  satellite: "Satellite",
  streets: "Streets",
};

export const parseBasemap = (v: string | undefined): Basemap | undefined =>
  BASEMAP_ORDER.find((b) => b === v?.trim().toLowerCase());

// Source ids; each source paints one raster layer `<id>-lyr`.
export const BASEMAP_SRC = {
  satellite: "tp-basemap-satellite",
  streets: "tp-basemap-streets",
  labelsDark: "tp-basemap-labels-dark",
  labelsLight: "tp-basemap-labels-light",
} as const;

export interface BasemapSourceSpec {
  /** map.addSource id */
  id: string;
  /** map.addLayer id (raster) */
  layer: string;
  tiles: string[];
  tileSize: number;
  /** Highest zoom the tile set serves; MapLibre overzooms beyond it. */
  maxzoom?: number;
  attribution: string;
  /** Painted when this basemap is selected. */
  on: boolean;
  /** Labels draw above the app layers; underlays below them. */
  top?: boolean;
}

const CARTO_ATTR = "© CARTO © OpenStreetMap contributors";
const CARTO = (path: string) =>
  ["a", "b", "c", "d"].map(
    (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/${path}/{z}/{x}/{y}.png`
  );

// NASA GIBS WMTS, EPSG:3857 GoogleMapsCompatible tiles (order {z}/{y}/{x}).
// VIIRS_SNPP true colour serves levels 0-9 (~250 m/px) and overzooms to the
// map's maxZoom; HLS L30 verified too patchy over Rio Grande do Sul (empty
// tiles), so VIIRS alone carries the satellite view.
const GIBS_VIIRS = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg`;

// `imageryDate` is the case reference day (replays). "default" serves the
// latest day GIBS published — live, whose reference day may be past the
// imagery edge yet. Anything not YYYY-MM-DD also falls back to "default".
const gibsDate = (d?: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? d! : "default";

// Source+layer specs the map adds once; `on`/`top` drive the update pass.
// Cities → neighbourhoods → streets appear with zoom from the labels tiles.
export function basemapSources(
  basemap: Basemap,
  imageryDate?: string
): BasemapSourceSpec[] {
  return [
    {
      id: BASEMAP_SRC.satellite,
      layer: `${BASEMAP_SRC.satellite}-lyr`,
      tiles: [GIBS_VIIRS(gibsDate(imageryDate))],
      tileSize: 256,
      maxzoom: 9,
      attribution: "Imagery: NASA GIBS VIIRS",
      on: basemap === "satellite",
    },
    {
      id: BASEMAP_SRC.streets,
      layer: `${BASEMAP_SRC.streets}-lyr`,
      tiles: CARTO("voyager_nolabels"),
      tileSize: 256,
      maxzoom: 20,
      attribution: CARTO_ATTR,
      on: basemap === "streets",
    },
    {
      id: BASEMAP_SRC.labelsDark,
      layer: `${BASEMAP_SRC.labelsDark}-lyr`,
      tiles: CARTO("dark_only_labels"),
      tileSize: 256,
      maxzoom: 20,
      attribution: CARTO_ATTR,
      on: basemap !== "streets",
      top: true,
    },
    {
      id: BASEMAP_SRC.labelsLight,
      layer: `${BASEMAP_SRC.labelsLight}-lyr`,
      tiles: CARTO("voyager_only_labels"),
      tileSize: 256,
      maxzoom: 20,
      attribution: CARTO_ATTR,
      on: basemap === "streets",
      top: true,
    },
  ];
}
