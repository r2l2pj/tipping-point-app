// Live GEE layer metadata: GET /api/layers?case=now[&layer=tpi_slide]
// → { case, canonical, layers: [{id, dates, data_date?, updated_at?}] }.
// 400 when `case` is missing; 503 when no service-account key is configured;
// 502 on unexpected ee init/compute failures. `canonical` echoes the resolved
// case id so hyphen aliases are visible; `layer=` probes a single layer.
import { credentialEnv } from "@/lib/ee";
import {
  getLayerMeta,
  LayersCredsError,
  LayersUnavailableError,
} from "@/lib/ee-layers";

export const maxDuration = 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const caseId = params.get("case");
  const layer = params.get("layer");

  if (!caseId) {
    return Response.json(
      { error: "missing required param: case" },
      { status: 400 }
    );
  }
  if (!credentialEnv()) {
    return Response.json(
      {
        error: "gee unavailable",
        reason: "no service-account key (set GCP_SA_KEY)",
      },
      { status: 503 }
    );
  }

  try {
    const result = await getLayerMeta(caseId, { layer: layer ?? undefined });
    return Response.json({
      case: caseId,
      canonical: result.case,
      layers: result.layers,
    });
  } catch (err) {
    if (
      err instanceof LayersCredsError ||
      err instanceof LayersUnavailableError
    ) {
      return Response.json(
        { error: "gee unavailable", reason: err.message },
        { status: 503 }
      );
    }
    return Response.json(
      {
        error: "gee layers failed",
        reason: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
