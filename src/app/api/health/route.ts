// /api/health (Lucas): 200 {"ok":true} when the server is up and the live
// (Now) data is at most 6 h old; 503 {"ok":false} when it is older or
// unreadable (the uptime monitor / keepalive workflow then fails). Nothing
// else in the body. `?live=1` is the plain liveness probe (Docker
// HEALTHCHECK): 200 whenever the server answers.
import { getDataJson } from "@/lib/data";
import { healthOk } from "@/lib/health";

export async function GET(req: Request) {
  const headers = { "Cache-Control": "public, max-age=30" };
  if (new URL(req.url).searchParams.has("live")) return Response.json({ ok: true }, { headers });
  let updated: unknown;
  try {
    const m = (await getDataJson("manifest.json", "now")) as { updated_at?: unknown } | undefined;
    updated = m?.updated_at;
  } catch {
    updated = undefined;
  }
  const ok = healthOk(updated, Date.now());
  return Response.json({ ok }, { status: ok ? 200 : 503, headers });
}
