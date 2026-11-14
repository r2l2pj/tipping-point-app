import { credentialEnv } from "@/lib/ee";
import {
  CredsError,
  getMetrics,
  MetricsNotFoundError,
  MetricsTimeoutError,
} from "@/lib/ee-metrics";

export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("case");
  if (!caseId) {
    return Response.json({ error: "missing required param: case" }, { status: 400 });
  }
  if (!credentialEnv()) {
    return Response.json(
      { error: "gee unavailable", reason: "no service-account key (set GCP_SA_KEY)" },
      { status: 503 }
    );
  }

  try {
    return Response.json(await getMetrics({ caseId }));
  } catch (error) {
    if (error instanceof CredsError) {
      return Response.json(
        { error: "gee unavailable", reason: error.message },
        { status: 503 }
      );
    }
    if (error instanceof MetricsNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof MetricsTimeoutError) {
      return Response.json(
        { error: "gee metrics timeout", reason: error.message },
        { status: 503 }
      );
    }
    return Response.json(
      {
        error: "gee metrics failed",
        reason: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
