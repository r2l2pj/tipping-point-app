import { geeEnabled } from "@/lib/ee";
import { cachedJson, noStoreJson } from "@/lib/http-cache";
import {
  CredsError,
  createMetricsService,
  getMetrics,
  MetricsNotFoundError,
  MetricsTimeoutError,
  MetricsUnavailableError,
} from "@/lib/ee-metrics";

export const maxDuration = 60;

export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("case");
  if (!caseId) {
    return noStoreJson({ error: "missing required param: case" }, { status: 400 });
  }

  try {
    const result = geeEnabled()
      ? await getMetrics({ caseId })
      : await createMetricsService(undefined, { ttlMs: 0, negTtlMs: 0 }).getMetrics({ caseId });
    return cachedJson(result, caseId);
  } catch (error) {
    if (error instanceof MetricsNotFoundError) {
      return noStoreJson({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof CredsError ||
      error instanceof MetricsTimeoutError ||
      error instanceof MetricsUnavailableError
    ) {
      return noStoreJson(
        { error: "metrics unavailable", reason: error.message },
        { status: 503 }
      );
    }
    return noStoreJson(
      {
        error: "metrics failed",
        reason: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
