// What sync-data copies into public/data (both the root copy and the now/
// bundle). Never pipeline inputs: raw/ and static/ folders at any depth
// (now/static held 4.8 GB of NASADEM/MCD12Q1 that hung `next dev` on
// "Compiling /") and heavy source formats; manifests reference neither.
// GeoTIFF COGs (~1 GB) are skipped too: prod reads them from GitHub raw /
// Neon, and in the bundled copy the click popup falls back to the day
// estimate. Only a .tif that a manifest layer uses as its `png` is kept.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const HEAVY_EXT = /\.(hgt|zip|h5|he5|hdf|nc|nc4|grib2?|grb2?|npz)(\.[a-z]+)?$/i;
export const TIF_EXT = /\.tiff?$/i;
const SKIP_DIRS = new Set(["raw", "static"]);

// `root`: the folder being copied (data/ or data/now/). `keepTif`: absolute
// paths of .tif files a manifest needs as a `png` (neededTifs).
export function keepForPublic(src, root, keepTif = new Set()) {
  const rel = path.relative(root, src);
  if (!rel) return true;
  if (rel.split(path.sep).some((part) => SKIP_DIRS.has(part))) return false;
  const base = path.basename(src);
  if (TIF_EXT.test(base)) return keepTif.has(path.resolve(src));
  return !HEAVY_EXT.test(base);
}

// Layer `png` values ending in .tif, resolved like the app does: relative to
// the data root ("<case>/png/x.tif") or to the case folder ("png/x.tif").
export function tifPngPaths(manifest, dataRoot, caseDir) {
  const out = [];
  const visit = (v, key) => {
    if (typeof v === "string") {
      if (key === "png" && TIF_EXT.test(v) && !/^https?:/.test(v)) {
        const clean = v.replace(/^\/+/, "").replace(/^data\//, "");
        out.push(path.resolve(dataRoot, clean), path.resolve(dataRoot, caseDir, clean));
      }
    } else if (Array.isArray(v)) v.forEach((x) => visit(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) visit(x, k);
  };
  visit(manifest, "");
  return out;
}

// Every manifest.json at the data root and one level down (cases, now/).
export function neededTifs(dataRoot) {
  const keep = new Set();
  const read = (file, caseDir) => {
    if (!existsSync(file)) return;
    try { for (const p of tifPngPaths(JSON.parse(readFileSync(file, "utf-8")), dataRoot, caseDir)) keep.add(p); } catch { /* bad JSON: skip */ }
  };
  read(path.join(dataRoot, "manifest.json"), "");
  for (const d of readdirSync(dataRoot, { withFileTypes: true })) {
    if (d.isDirectory()) read(path.join(dataRoot, d.name, "manifest.json"), d.name);
  }
  return keep;
}
