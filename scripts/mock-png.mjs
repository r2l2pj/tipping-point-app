// Generates mock pre-rendered TPI rasters (RGBA PNGs) for every manifest
// layer that declares `png`, so the app's v4 image-source path is exercised
// without real pipeline output. Same field as lib/tpi.ts mockTpiGrid:
// radial falloff around priority-zone hotspots, scaled by the day's TPI.
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

const readJson = (...p) => JSON.parse(readFileSync(path.join(DATA, ...p), "utf-8"));

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

function render(layer, spots, scale) {
  const [w, s, e, n] = layer.bounds;
  const W = 384;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const H = Math.max(
    64,
    Math.round((W * (n - s)) / ((e - w) * Math.cos(midLat)))
  );
  const px = Buffer.alloc(H * (W * 4 + 1));
  for (let j = 0; j < H; j++) {
    px[j * (W * 4 + 1)] = 0; // filter byte
    for (let i = 0; i < W; i++) {
      const lon = w + ((i + 0.5) / W) * (e - w);
      const lat = n - ((j + 0.5) / H) * (n - s);
      let v = 0.08 + 0.12 * ((j / H) * (1 - i / W));
      for (const h of spots) {
        const d = Math.hypot(lon - h.lon, (lat - h.lat) * 1.4);
        v = Math.max(v, h.tpi * Math.exp(-(d * d) / 0.055));
      }
      v *= scale;
      v = Math.min(1, Math.max(0, v + (hash(i, j) - 0.5) * 0.06));
      const cls = CLASSES.find(([lo, hi]) => v >= lo && v < hi);
      const o = j * (W * 4 + 1) + 1 + i * 4;
      if (cls) px.set(cls[2], o);
      // else stays transparent — Low class doesn't paint the map
    }
  }
  return png(W, H, px);
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

let count = 0;
for (const caseId of ["wa-2025-12", "rs-2024-05", "now"]) {
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
    const out = path.join(DATA, layer.png);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, render(layer, spots, scaleOf(layer.date)));
    count++;
  }
}
console.log(`mock-png: wrote ${count} rasters under ${DATA}`);
