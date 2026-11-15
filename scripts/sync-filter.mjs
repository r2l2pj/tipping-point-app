// What sync-data copies into public/data (both the root copy and the now/
// bundle). Never pipeline inputs: raw/ and static/ folders at any depth
// (now/static held 4.8 GB of NASADEM/MCD12Q1 that hung `next dev` on
// "Compiling /") and heavy source formats; manifests reference neither.
import path from "node:path";

export const HEAVY_EXT = /\.(hgt|zip|h5|he5|hdf|nc|nc4|grib2?|grb2?|npz)(\.[a-z]+)?$/i;
const SKIP_DIRS = new Set(["raw", "static"]);

// `root`: the folder being copied (data/ or data/now/).
export function keepForPublic(src, root) {
  const rel = path.relative(root, src);
  if (!rel) return true;
  if (rel.split(path.sep).some((part) => SKIP_DIRS.has(part))) return false;
  return !HEAVY_EXT.test(path.basename(src));
}
