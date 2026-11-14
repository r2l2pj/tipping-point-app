import {
  CredsError,
  getMetrics,
  MetricsNotFoundError,
  MetricsTimeoutError,
  MetricsUnavailableError,
} from "@/lib/ee-metrics";

export const maxDuration = 60;

export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("case");
  if (!caseId) {
    return Response.json({ error: "missing required param: case" }, { status: 400 });
  }

  try {
    return Response.json(await getMetrics({ caseId }));
  } catch (error) {
    if (error instanceof MetricsNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof CredsError ||
      error instanceof MetricsTimeoutError ||
      error instanceof MetricsUnavailableError
    ) {
      return Response.json(
        { error: "metrics unavailable", reason: error.message },
        { status: 503 }
      );
    }
    return Response.json(
      {
        error: "metrics failed",
        reason: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
