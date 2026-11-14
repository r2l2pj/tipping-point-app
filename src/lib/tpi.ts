// TPI classes, palette and the synthetic grid used while no real COG exists.
// Palette per project doc v3 (ColorBrewer YlOrRd, colorblind-safe).

export const TPI_CLASSES = [
  { key: "low", label: "Low", min: 0.0, max: 0.2, color: "#FFFFB2", opacity: 0.0 },
  { key: "moderate", label: "Moderate", min: 0.2, max: 0.4, color: "#FECC5C", opacity: 0.65 },
  { key: "high", label: "High", min: 0.4, max: 0.6, color: "#FD8D3C", opacity: 0.65 },
  { key: "critical", label: "Critical", min: 0.6, max: 1.0, color: "#BD0026", opacity: 0.75 },
] as const;

export const TPI_THRESHOLD = 0.6;

export function tpiClass(v: number) {
  return (
    TPI_CLASSES.find((c) => v >= c.min && v < c.max) ??
    TPI_CLASSES[TPI_CLASSES.length - 1]
  );
}

interface Hotspot {
  lon: number;
  lat: number;
  tpi: number;
}

// Deterministic smooth field: radial falloff around each hotspot plus a broad
// gradient, so the grid reads like rain pooled along valleys/foothills.
// `scale` (0..1) animates the field over the replay window.
export function mockTpiGrid(
  bbox: [number, number, number, number],
  hotspots: Hotspot[],
  scale = 1
): GeoJSON.FeatureCollection {
  const [w, s, e, n] = bbox;
  const cols = 46;
  const rows = 30;
  const dx = (e - w) / cols;
  const dy = (n - s) / rows;
  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = w + (i + 0.5) * dx;
      const cy = s + (j + 0.5) * dy;
      let v = 0.08 + 0.12 * ((j / rows) * (1 - i / cols));
      for (const h of hotspots) {
        const d = Math.hypot(cx - h.lon, (cy - h.lat) * 1.4);
        v = Math.max(v, h.tpi * Math.exp(-(d * d) / 0.055));
      }
      v *= scale;
      v = Math.min(1, Math.max(0, v + (hash(i, j) - 0.5) * 0.06));
      if (v < 0.2) continue; // Low class stays transparent in overview
      features.push({
        type: "Feature",
        properties: { tpi: Math.round(v * 100) / 100, class: tpiClass(v).label },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [w + i * dx, s + j * dy],
            [w + (i + 1) * dx, s + j * dy],
            [w + (i + 1) * dx, s + (j + 1) * dy],
            [w + i * dx, s + (j + 1) * dy],
            [w + i * dx, s + j * dy],
          ]],
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

// Simple blue ramp for the IMERG rain mock layer.
export function mockScalarGrid(
  bbox: [number, number, number, number],
  seed: number,
  scale = 1
): GeoJSON.FeatureCollection {
  const [w, s, e, n] = bbox;
  const cols = 30;
  const rows = 20;
  const dx = (e - w) / cols;
  const dy = (n - s) / rows;
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const v =
        (0.5 +
          0.5 *
            Math.sin((i + seed * 3) * 0.42) *
            Math.cos((j - seed * 2) * 0.5)) *
        scale;
      if (v < 0.35) continue;
      features.push({
        type: "Feature",
        properties: { v: Math.round(v * 100) / 100 },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [w + i * dx, s + j * dy],
            [w + (i + 1) * dx, s + j * dy],
            [w + (i + 1) * dx, s + (j + 1) * dy],
            [w + i * dx, s + (j + 1) * dy],
            [w + i * dx, s + j * dy],
          ]],
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function hash(i: number, j: number) {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// --- v4 PNG-layer helpers -------------------------------------------------

// MapLibre image-source corner order: top-left, top-right, bottom-right,
// bottom-left. Manifest `bounds` are [w, s, e, n] (EPSG:4326; PNGs are
// rendered in EPSG:3857 and reprojected by MapLibre).
export function boundsToImageCoordinates(
  b: [number, number, number, number]
): [[number, number], [number, number], [number, number], [number, number]] {
  const [w, s, e, n] = b;
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ];
}

// Manifest png/cog paths are relative to the data root (gs://tipping-point-data),
// which the app serves at /data. Accept absolute URLs unchanged.
export function resolveDataUrl(p: string): string {
  return p.startsWith("http") || p.startsWith("/") ? p : `/data/${p}`;
}

export function bboxPolygon(
  b: [number, number, number, number]
): GeoJSON.FeatureCollection {
  const [w, s, e, n] = b;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      },
    ],
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Approximate R/S/T component scores for a TPI value on a given day.
// v4: TPI = (R·S·T)^(1/3). With only daily aggregates in the mock bundle we
// take R from IMERG vs the P95 climatology, S from SMAP soil wetness, and
// back out T so the geomean equals v. Illustrative, not pixel-exact.
export function rstFor(
  day: { imerg_mm: number; smap: number } | undefined,
  rainP95: number | undefined,
  v: number
): { r: number; s: number; t: number } {
  const r = day ? clamp01(day.imerg_mm / (rainP95 || 60)) : v;
  const s = day ? clamp01(day.smap) : v;
  const t = clamp01(
    Math.pow(Math.max(v, 0.001), 3) / Math.max(r * s, 0.001)
  );
  return { r, s, t };
}

// Nearest named place (city/town, not rivers) to a click — mock proxy for the
// município lookup in the v4 click spec.
export function nearestPlace(
  places: GeoJSON.FeatureCollection | undefined,
  lon: number,
  lat: number
): string | undefined {
  let best: { name: string; d: number } | undefined;
  for (const f of places?.features ?? []) {
    if (f.geometry.type !== "Point" || f.properties?.kind === "river") continue;
    const [fx, fy] = f.geometry.coordinates;
    const d = Math.hypot(fx - lon, (fy - lat) * Math.cos((lat * Math.PI) / 180));
    if (!best || d < best.d) best = { name: String(f.properties?.name ?? ""), d };
  }
  return best?.name || undefined;
}

export function fmtKm2(v?: number) {
  return v == null ? "—" : `${v.toFixed(1)} km²`;
}

export function fmtPeople(v?: number) {
  return v == null ? "—" : `${(Math.round(v / 100) * 100).toLocaleString("en-US")}`;
}

export function fmtPct(v?: number) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
