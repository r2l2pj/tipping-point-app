// R, S and T for one point and date, read from the data: the GEE point
// endpoint first, else the published COGs. A value that cannot be read stays
// null. Unlike resolvePixelValues in src/lib/layers.ts this never fills a
// missing value with a day-level estimate.
import { readCogPixel, readCogRST, type CogRSTUrls } from "@/lib/cog";
import { canonicalCaseId } from "@/lib/contract";
import { assetUrl } from "@/lib/layers";
import { frameFor } from "./steps";
import type { CcBundle, Hazard } from "./types";

export interface PointValues {
  tpi: number | null;
  r: number | null;
  s: number | null;
  t: number | null;
  source: "GEE point read" | "COG pixel read";
}

export interface PointRequest {
  caseId: string;
  date: string;
  lon: number;
  lat: number;
  hazard: Hazard;
  cogUrl?: string;
  rstUrls: CogRSTUrls;
  bandOrder?: string[];
}

export const pointKey = (q: PointRequest): string =>
  [q.caseId, q.date, q.hazard, q.lon.toFixed(5), q.lat.toFixed(5)].join("|");

export function pointRequest(
  bundle: CcBundle,
  date: string,
  hazard: Hazard,
  at: [number, number]
): PointRequest {
  const caseId = canonicalCaseId(bundle.manifest?.event ?? bundle.id);
  const layers = bundle.manifest?.layers ?? [];
  const cog = (id: string) => assetUrl(caseId, layers.find((l) => l.id === id)?.cog);
  const frame = frameFor(bundle, date, hazard);
  return {
    caseId,
    date,
    lon: at[0],
    lat: at[1],
    hazard,
    cogUrl: assetUrl(caseId, frame?.layer.cog),
    rstUrls: { r: cog("r_series"), s: cog("s_series"), t: cog(hazard === "flood" ? "t_flood" : "t_slide") },
    bandOrder: bundle.series?.days.map((d) => d.date),
  };
}

const KEYS = ["tpi_slide", "tpi_flood", "r", "s", "t_slide", "t_flood"] as const;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// Shape check of the /api/point answer.
export function fromGeeValues(values: unknown, hazard: Hazard): PointValues | null {
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  const v = values as Record<string, unknown>;
  if (!KEYS.every((k) => v[k] === null || num(v[k]) !== null)) return null;
  const out: PointValues = {
    tpi: num(hazard === "flood" ? v.tpi_flood : v.tpi_slide),
    r: num(v.r),
    s: num(v.s),
    t: num(hazard === "flood" ? v.t_flood : v.t_slide),
    source: "GEE point read",
  };
  return [out.tpi, out.r, out.s, out.t].every((x) => x === null) ? null : out;
}

export async function readPoint(
  q: PointRequest,
  fetchImpl: typeof fetch = fetch
): Promise<PointValues | null> {
  try {
    const res = await fetchImpl("/api/point?" + new URLSearchParams({
      case: q.caseId, date: q.date, lat: String(q.lat), lon: String(q.lon),
    }));
    if (res.ok) {
      const gee = fromGeeValues((await res.json()).values, q.hazard);
      if (gee) return gee;
    }
  } catch {}
  const opts = { date: q.date, bandOrder: q.bandOrder };
  const [tpi, rst] = await Promise.all([
    q.cogUrl ? readCogPixel(q.cogUrl, q.lon, q.lat, opts) : null,
    readCogRST(q.rstUrls, q.lon, q.lat, opts),
  ]);
  const out: PointValues = { tpi: tpi ?? null, ...rst, source: "COG pixel read" };
  return [out.tpi, out.r, out.s, out.t].every((x) => x === null) ? null : out;
}
