// Client-side COG pixel reader built on geotiff.js. The click popup uses it to
// range-read per-pixel values out of the manifest's `cog` layers: R and S
// daily series, static T_slide/T_flood, and the multiband TPI series (one band
// per day, GDAL band description = YYYYMMDD). All rasters are EPSG:4326.
//
// Every read degrades to null — on network failure, missing metadata, or
// nodata — so the popup can fall back to day-level values. Isomorphic:
// geotiff.js only needs fetch with HTTP Range support, so the same code runs
// in the browser and under bun.

import {
  fromUrl,
  type GeoTIFF,
  type GeoTIFFImage,
  type RemoteSourceOptions,
} from "geotiff";

import { resolveAsset } from "./contract";

// fromUrl forwards leftover options to the range BlockedSource, but its
// RemoteSourceOptions typing omits them — intersect to keep blockSize typed.
type OpenOptions = RemoteSourceOptions & { blockSize?: number };

export interface CogPixelOptions {
  // Explicit 0-based band (sample) index; wins over `date`.
  band?: number;
  // Day to read on a multiband series COG: "YYYY-MM-DD" or "YYYYMMDD".
  date?: string;
  // Fallback band order (dates, same normalization as `date`) for series COGs
  // whose GDAL band descriptions are absent.
  bandOrder?: string[];
}

export interface CogRSTUrls {
  r?: string;
  s?: string;
  t?: string;
}

export interface CogRST {
  r: number | null;
  s: number | null;
  t: number | null;
}

// --- URL + open cache --------------------------------------------------------

// Thin wrapper over resolveAsset for a manifest layer's `cog` field.
export const cogLayerUrl = (
  manifestPath: string | null | undefined,
  base: string,
  caseDir: string
): string | undefined => resolveAsset(base, caseDir, manifestPath);

// Lazy-open cache keyed by URL: the popup reads several pixels from the same
// COGs, so each file is opened (header range-read) once. blockSize enables
// geotiff's block cache so pixel reads share fetched ranges.
const cogCache = new Map<string, Promise<GeoTIFF>>();

export function openCog(url: string): Promise<GeoTIFF> {
  let cached = cogCache.get(url);
  if (!cached) {
    const opts: OpenOptions = { blockSize: 65536 };
    cached = fromUrl(url, opts);
    // Failed opens are evicted so a later click retries.
    cached.catch(() => {
      if (cogCache.get(url) === cached) cogCache.delete(url);
    });
    cogCache.set(url, cached);
  }
  return cached;
}

// --- band resolution ---------------------------------------------------------

const normDate = (d: string): string => d.replace(/-/g, "").trim();

// GDAL writes per-band names as <Item name="DESCRIPTION" sample="k"> in the
// GDAL_METADATA tag; geotiff exposes them via getGDALMetadata(sample).
const bandNameMatches = (meta: Record<string, unknown>, want: string): boolean => {
  const named = meta.DESCRIPTION ?? meta.description ?? meta.BAND_NAME;
  if (typeof named === "string" && normDate(named) === want) return true;
  return Object.values(meta).some(
    (v) => typeof v === "string" && normDate(v) === want
  );
};

async function resolveBand(
  image: GeoTIFFImage,
  opts: CogPixelOptions
): Promise<number | null> {
  const bands = image.getSamplesPerPixel();
  if (opts.band !== undefined) {
    return opts.band >= 0 && opts.band < bands ? Math.floor(opts.band) : null;
  }
  if (!opts.date) return 0;
  const want = normDate(opts.date);

  // getGDALMetadata(null-sample) is null when the tag is absent entirely —
  // a cheap probe before scanning every band.
  const probe = await image.getGDALMetadata(0).catch(() => null);
  if (probe !== null) {
    for (let i = 0; i < bands; i++) {
      const meta = await image.getGDALMetadata(i).catch(() => null);
      if (meta && bandNameMatches(meta, want)) return i;
    }
  }
  if (opts.bandOrder) {
    const idx = opts.bandOrder.findIndex((d) => normDate(d) === want);
    if (idx >= 0) return idx < bands ? idx : null;
  }
  // Single-band static layer (T_slide/T_flood): a date opt is meaningless
  // there, so fall through to band 0 rather than failing the read.
  return bands === 1 ? 0 : null;
}

// --- pixel reads -------------------------------------------------------------

// Reads the nearest sample at lon/lat (EPSG:4326). Returns null when the point
// is outside the raster, the band can't be resolved, the pixel is nodata, or
// any step fails — the popup treats null as "no per-pixel value".
export async function readCogPixel(
  url: string,
  lon: number,
  lat: number,
  opts: CogPixelOptions = {}
): Promise<number | null> {
  try {
    const tiff = await openCog(url);
    const image = await tiff.getImage();
    const [w, s, e, n] = image.getBoundingBox();
    if (lon < w || lon > e || lat < s || lat > n || e === w || n === s) {
      return null;
    }
    const width = image.getWidth();
    const height = image.getHeight();
    const x = Math.min(
      Math.max(Math.floor(((lon - w) / (e - w)) * width), 0),
      width - 1
    );
    const y = Math.min(
      Math.max(Math.floor(((n - lat) / (n - s)) * height), 0),
      height - 1
    );
    const band = await resolveBand(image, opts);
    if (band === null) return null;

    const raster = (await image.readRasters({
      window: [x, y, x + 1, y + 1],
      samples: [band],
      width: 1,
      height: 1,
    })) as unknown as ArrayLike<number>[];
    const value = raster[0]?.[0];
    if (value === undefined || !Number.isFinite(value)) return null;
    const nodata = image.getGDALNoData();
    if (nodata !== null && value === nodata) return null;
    return value;
  } catch {
    return null;
  }
}

// Convenience for the popup: read the R/S/T layers for one click in parallel.
// `opts` applies to all three; single-band layers ignore `date`.
export async function readCogRST(
  urls: CogRSTUrls,
  lon: number,
  lat: number,
  opts: CogPixelOptions = {}
): Promise<CogRST> {
  const [r, s, t] = await Promise.all([
    urls.r ? readCogPixel(urls.r, lon, lat, opts) : null,
    urls.s ? readCogPixel(urls.s, lon, lat, opts) : null,
    urls.t ? readCogPixel(urls.t, lon, lat, opts) : null,
  ]);
  return { r: r ?? null, s: s ?? null, t: t ?? null };
}
