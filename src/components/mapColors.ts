// Geographic colours on the dark basemap: water is blue, vegetation green,
// land a dark earth tone. The style's own greys made sea, lake and land
// read as one black surface. Still dark, so the class colours keep their
// contrast.
export const GEO_COLORS = {
  land: "#262b24",
  vegetation: "#1f3a2a",
  water: "#17456b",
  river: "#2f74a8",
} as const;

export type StyleLayer = { id: string; type: string; "source-layer"?: string };

// Which paint property of a basemap layer takes which colour. Layers are
// matched by their vector-tile source layer. Two schemas are known: the
// OpenMapTiles names (water, waterway, landcover, park) and CARTO's, where
// rivers are lines of `water` and vegetation is the `landcover` and `park_*`
// layers of `landuse` (that source layer also holds residential areas, so
// there the style id tells them apart).
const VEGETATION_ID = /^(landcover|park)/;

export function geoPaint(layer: StyleLayer): [property: string, color: string] | undefined {
  const from = layer["source-layer"];
  if (layer.type === "background") return ["background-color", GEO_COLORS.land];
  if (layer.type === "fill" && from === "water") return ["fill-color", GEO_COLORS.water];
  if (layer.type === "line" && (from === "waterway" || from === "water")) return ["line-color", GEO_COLORS.river];
  if (layer.type === "fill" && (from === "landcover" || from === "park")) return ["fill-color", GEO_COLORS.vegetation];
  if (layer.type === "fill" && from === "landuse" && VEGETATION_ID.test(layer.id)) return ["fill-color", GEO_COLORS.vegetation];
  return undefined;
}
