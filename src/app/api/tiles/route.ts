// Live GEE tiles: GET /api/tiles?layer=tpi_slide&case=rs-2024-05&date=2024-05-01
// → { tiles: [urlFormat], expires_at, data_date, layer, case, date }. 503
// when no service-account key is configured or an EE roundtrip times out;
// 404 when the case asset or date band doesn't exist.
import { credentialEnv } from "@/lib/ee";
import { cachedTilesJson, noStoreJson } from "@/lib/http-cache";
import {
  CredsError,
  getTiles,
  TILE_LAYERS,
  TileNotFoundError,
  TileServiceError,
  type TileLayer,
} from "@/lib/ee-tiles";

export const maxDuration = 60;

const LAYERS = new Set<string>(TILE_LAYERS);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bad = (message: string) =>
  noStoreJson({ error: message }, { status: 400 });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const layer = params.get("layer");
  const caseId = params.get("case");
  const date = params.get("date");

  if (!layer || !LAYERS.has(layer)) {
    return bad(`param layer must be one of: ${TILE_LAYERS.join(", ")}`);
  }
  if (!caseId) {
    return bad("missing required param: case");
  }
  if (!date || !DATE_RE.test(date)) {
    return bad("param date must match YYYY-MM-DD");
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
    return cachedTilesJson(
      await getTiles({ layer: layer as TileLayer, caseId, date }),
      caseId
    );
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
        error: "gee tiles failed",
        reason: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
