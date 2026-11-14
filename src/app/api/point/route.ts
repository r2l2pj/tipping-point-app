// Live GEE point sample: GET /api/point?case=rs-2024-05&date=2024-05-01&lat=-29.7&lon=-51.1
// → { case, canonical, date, lat, lon, data_date, values: { tpi_slide,
//     tpi_flood, r, s, t_slide, t_flood } } with every value number|null.
// 400 on missing/invalid params; 503 when no service-account key is
// configured or an EE roundtrip times out; 404 when no point asset answers
// for the case; 502 on other EE failures.
import { credentialEnv } from "@/lib/ee";
import { cachedJson, noStoreJson } from "@/lib/http-cache";
import {
  CredsError,
  getPoint,
  TileNotFoundError,
  TileServiceError,
} from "@/lib/ee-point";

export const maxDuration = 60;

const DASHED_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMPACT_RE = /^\d{8}$/;

const bad = (message: string) =>
  noStoreJson({ error: message }, { status: 400 });

// Accepts YYYY-MM-DD or YYYYMMDD; returns the normalized dashed form or null.
function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const dashed = COMPACT_RE.test(raw)
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : raw;
  if (!DASHED_RE.test(dashed)) return null;
  const ms = Date.parse(`${dashed}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10) === dashed ? dashed : null;
}

function parseCoord(raw: string | null, min: number, max: number) {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const caseId = params.get("case");
  const date = normalizeDate(params.get("date"));
  const lat = parseCoord(params.get("lat"), -90, 90);
  const lon = parseCoord(params.get("lon"), -180, 180);

  if (!caseId) {
    return bad("missing required param: case");
  }
  if (!date) {
    return bad("param date must match YYYY-MM-DD");
  }
  if (lat === null) {
    return bad("param lat must be a finite number within [-90, 90]");
  }
  if (lon === null) {
    return bad("param lon must be a finite number within [-180, 180]");
  }
  if (!credentialEnv()) {
    return noStoreJson(
      {
        error: "gee unavailable",
        reason: "no service-account key (set GCP_SA_KEY)",
      },
      { status: 503 }
    );
  }

  try {
    return cachedJson(await getPoint({ caseId, date, lat, lon }), caseId);
  } catch (err) {
    if (err instanceof CredsError) {
      return noStoreJson(
        { error: "gee unavailable", reason: err.message },
        { status: 503 }
      );
    }
    if (err instanceof TileServiceError && err.message.startsWith("timeout")) {
      return noStoreJson(
        { error: "gee unavailable", reason: err.message },
        { status: 503 }
      );
    }
    if (err instanceof TileNotFoundError) {
      return noStoreJson({ error: err.message }, { status: 404 });
    }
    return noStoreJson(
      {
        error: "gee point failed",
        reason: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
