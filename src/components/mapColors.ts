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
// matched by their vector-tile source layer (OpenMapTiles names), not by
// style ids, so a renamed or added layer of the same kind is still found.
export function geoPaint(layer: StyleLayer): [property: string, color: string] | undefined {
  const from = layer["source-layer"];
  if (layer.type === "background") return ["background-color", GEO_COLORS.land];
  if (layer.type === "fill" && from === "water") return ["fill-color", GEO_COLORS.water];
  if (layer.type === "line" && from === "waterway") return ["line-color", GEO_COLORS.river];
  if (layer.type === "fill" && (from === "landcover" || from === "park")) return ["fill-color", GEO_COLORS.vegetation];
  return undefined;
}
