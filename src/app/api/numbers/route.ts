// Live GEE numbers: GET /api/numbers?case=rs-2024-05&date=2024-05-01
// → { case, date, km2_critical, people_exposed, flooded_km2?, people_flooded?,
//     data_date?, source }. 503 when no service-account key is configured or
// an EE roundtrip times out; 404 when the case asset or date band is absent.
import { credentialEnv } from "@/lib/ee";
import {
  CredsError,
  getNumbers,
  NumbersNotFoundError,
  NumbersTimeoutError,
} from "@/lib/ee-numbers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bad = (message: string) =>
  Response.json({ error: message }, { status: 400 });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const caseId = params.get("case");
  const date = params.get("date");

  if (!caseId) {
    return bad("missing required param: case");
  }
  if (!date || !DATE_RE.test(date)) {
    return bad("param date must match YYYY-MM-DD");
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
    return Response.json(await getNumbers({ caseId, date }));
  } catch (err) {
    if (err instanceof CredsError) {
      return Response.json(
        { error: "gee unavailable", reason: err.message },
        { status: 503 }
      );
    }
    if (err instanceof NumbersNotFoundError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof NumbersTimeoutError) {
      return Response.json(
        { error: "gee numbers timeout", reason: err.message },
        { status: 503 }
      );
    }
    return Response.json(
      {
        error: "gee numbers failed",
        reason: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
