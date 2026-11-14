// Generates mock pre-rendered rasters (RGBA PNGs) for every manifest layer
// that declares `png`, so the app's v4 image-source path is exercised
// without real pipeline output. TPI layers share the lib/tpi.ts mockTpiGrid
// field (radial falloff around priority-zone hotspots, scaled by the day's
// TPI); nisar_*/night_lights_* get their own grayscale/brightness renders.
// Also ensures the wa_2025 manifest layer rows for those products exist.
// Run: bun scripts/mock-png.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DATA = path.resolve(import.meta.dirname, "../public/data");
const CLASSES = [
  [0.2, 0.4, [254, 204, 92, 200]],  // Moderate #FECC5C
  [0.4, 0.6, [253, 141, 60, 200]],  // High     #FD8D3C
  [0.6, 9.9, [189, 0, 38, 230]],    // Critical #BD0026
];
const WA_BOUNDS = [-122.6, 47.0, -121.5, 48.5];
// Layer rows the wa_2025 manifests must carry for the extra products.
const WA_EXTRA_ROWS = [
  { id: "nisar_pre", date: "2025-12-04" },
  { id: "nisar_post", date: "2025-12-16" },
  { id: "night_lights_pre", date: "2025-12-01" },
  { id: "night_lights_post", date: "2025-12-18" },
];

const readJson = (...p) => JSON.parse(readFileSync(path.join(DATA, ...p), "utf-8"));
const writeJson = (p, obj) =>
  writeFileSync(path.join(DATA, p), JSON.stringify(obj, null, 2) + "\n");

// Asset path -> data-root-relative key: case-manifest pngs carry the dir
// ("rs_2024/png/..."), now@2 node paths are now/-relative ("png/...").
const joinKey = (dir, p) =>
  p.startsWith(`${dir}/`) || /^https?:\/\//i.test(p) || p.startsWith("gs://")
    ? p
    : `${dir}/${p}`;

const hash = (i, j) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function hotspots(caseId) {
  try {
    const gj = readJson(caseId, "geojson", "priority_zones.geojson");
    return gj.features
      .filter((f) => f.geometry.type === "Point")
      .map((f) => ({
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        tpi: f.properties?.tpi ?? 0.6,
      }));
  } catch {
    return [];
  }
}

// Image grid sized like the real EPSG:3857 renders (aspect corrected).
function grid(bounds) {
  const [w, s, e, n] = bounds;
  const W = 384;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const H = Math.max(64, Math.round((W * (n - s)) / ((e - w) * Math.cos(midLat))));
  return { w, s, e, n, W, H };
}

const pixels = (W, H) => Buffer.alloc(H * (W * 4 + 1));
const offset = (W, i, j) => j * (W * 4 + 1) + 1 + i * 4;
const lonlat = (g, i, j) => [
  g.w + ((i + 0.5) / g.W) * (g.e - g.w),
  g.n - ((j + 0.5) / g.H) * (g.n - g.s),
];

function renderTpi(layer, spots, scale) {
  const g = grid(layer.bounds);
  const px = pixels(g.W, g.H);
  for (let j = 0; j < g.H; j++) {
    px[j * (g.W * 4 + 1)] = 0; // filter byte
    for (let i = 0; i < g.W; i++) {
      const [lon, lat] = lonlat(g, i, j);
      let v = 0.08 + 0.12 * ((j / g.H) * (1 - i / g.W));
      for (const h of spots) {
        const d = Math.hypot(lon - h.lon, (lat - h.lat) * 1.4);
        v = Math.max(v, h.tpi * Math.exp(-(d * d) / 0.055));
      }
      v *= scale;
      v = Math.min(1, Math.max(0, v + (hash(i, j) - 0.5) * 0.06));
      const cls = CLASSES.find(([lo, hi]) => v >= lo && v < hi);
      if (cls) px.set(cls[2], offset(g.W, i, j));
      // else stays transparent — Low class doesn't paint the map
    }
  }
  return png(g.W, g.H, px);
}

// NISAR GCOV backscatter: cool grayscale. pre = calm scene; post adds
// bright flood backscatter pooling around the hotspots.
function renderNisar(layer, spots, post) {
  const g = grid(layer.bounds);
  const px = pixels(g.W, g.H);
  for (let j = 0; j < g.H; j++) {
    px[j * (g.W * 4 + 1)] = 0;
    for (let i = 0; i < g.W; i++) {
      const [lon, lat] = lonlat(g, i, j);
      let v = 34 + 26 * hash(i, j) + 12 * (j / g.H);
      if (post) {
        for (const h of spots) {
          const d = Math.hypot(lon - h.lon, (lat - h.lat) * 1.4);
          v += 170 * Math.exp(-(d * d) / 0.09);
        }
      }
      v = Math.min(255, Math.max(0, v));
      px.set([v * 0.82, v * 0.88, v, 255], offset(g.W, i, j));
    }
  }
  return png(g.W, g.H, px);
}

// VIIRS night lights: warm city glow around the hotspots; post dims to
// simulate the post-event lights-out drop.
function renderLights(layer, spots, post) {
  const g = grid(layer.bounds);
  const px = pixels(g.W, g.H);
  const dim = post ? 0.42 : 1;
  for (let j = 0; j < g.H; j++) {
    px[j * (g.W * 4 + 1)] = 0;
    for (let i = 0; i < g.W; i++) {
      const [lon, lat] = lonlat(g, i, j);
      let v = 0;
      for (const h of spots) {
        const d = Math.hypot(lon - h.lon, (lat - h.lat) * 1.2);
        v = Math.max(v, Math.exp(-(d * d) / 0.012));
      }
      v = Math.min(1, v * (0.85 + 0.3 * hash(i, j))) * dim;
      if (v > 0.04)
        px.set([255 * v, 205 * v, 128 * v, 235], offset(g.W, i, j));
    }
  }
  return png(g.W, g.H, px);
}

// Minimal PNG encoder: 8-bit RGBA, filter 0, zlib-deflated scanlines.
function png(W, H, data) {
  const chunk = (type, payload) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length);
    const body = Buffer.concat([Buffer.from(type), payload]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(data)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// Appends the wa_2025 nisar/night-lights layer rows when absent — to the
// root manifest's wa_2025 node and the per-case manifest alike.
function ensureWaRows() {
  const rowFor = ({ id, date }) => ({
    id,
    date,
    png: `wa_2025/png/${id}_${date.replaceAll("-", "")}.png`,
    cog: `wa_2025/cog/wa_2025_${id}_${date.replaceAll("-", "")}.tif`,
    bounds: WA_BOUNDS,
  });
  for (const target of [
    ["manifest.json", (m) => m.cases?.wa_2025],
    [path.join("wa_2025", "manifest.json"), (m) => m],
  ]) {
    const [rel, pick] = target;
    const doc = readJson(rel);
    const node = pick(doc);
    if (!node?.layers) continue;
    const have = new Set(node.layers.map((l) => l.id));
    const missing = WA_EXTRA_ROWS.filter((r) => !have.has(r.id)).map(rowFor);
    if (missing.length) {
      node.layers.push(...missing);
      writeJson(rel, doc);
      console.log(`mock-png: added ${missing.length} layer rows to ${rel}`);
    }
  }
}

ensureWaRows();

let count = 0;
for (const caseId of ["wa_2025", "rs_2024", "now"]) {
  const manifest = readJson(caseId, "manifest.json");
  const series = readJson(caseId, "series", "imerg_smap_daily.json");
  const threshold = series.tpi_threshold ?? 0.6;
  const spots = hotspots(caseId);
  const scaleOf = (date) => {
    const day = series.days.find((d) => d.date === date);
    return day ? Math.max(0.15, day.tpi / threshold / 1.3) : 1;
  };
  for (const layer of manifest.layers ?? []) {
    if (!layer.png || !layer.bounds) continue;
    const out = path.join(DATA, joinKey(caseId, layer.png));
    mkdirSync(path.dirname(out), { recursive: true });
    const id = layer.id ?? "";
    const buf = id.startsWith("nisar_")
      ? renderNisar(layer, spots, id.endsWith("_post"))
      : id.startsWith("night_lights_")
        ? renderLights(layer, spots, id.endsWith("_post"))
        : renderTpi(layer, spots, scaleOf(layer.date));
    writeFileSync(out, buf);
    count++;
  }
}
console.log(`mock-png: wrote ${count} rasters under ${DATA}`);
