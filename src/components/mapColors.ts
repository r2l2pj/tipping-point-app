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
// matched by their vector-tile source layer and kind, not by a fixed list
// of style ids. The CARTO tiles keep rivers (lines) and lakes (polygons)
// in one `water` layer, and woods, parks and other land uses in one
// `landuse` layer told apart by the style id; the OpenMapTiles names
// (waterway, landcover, park) are accepted too.
const GREEN = /landcover|park|wood|forest|grass/;

export function geoPaint(layer: StyleLayer): [property: string, color: string] | undefined {
  const from = layer["source-layer"];
  if (layer.type === "background") return ["background-color", GEO_COLORS.land];
  if (from === "water" || from === "waterway") {
    // The style's water shadow is transparent on purpose: leave it.
    if (layer.type === "fill" && !layer.id.includes("shadow")) return ["fill-color", GEO_COLORS.water];
    if (layer.type === "line") return ["line-color", GEO_COLORS.river];
    return undefined;
  }
  if (layer.type === "fill" && (from === "landcover" || from === "park")) return ["fill-color", GEO_COLORS.vegetation];
  if (layer.type === "fill" && from === "landuse") {
    if (GREEN.test(layer.id)) return ["fill-color", GEO_COLORS.vegetation];
    // Cemeteries and stadiums were near-black patches on the new land tone.
    if (layer.id === "landuse") return ["fill-color", GEO_COLORS.land];
  }
  return undefined;
}
