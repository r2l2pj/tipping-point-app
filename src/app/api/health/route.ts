// Liveness probe (Lucas): 200 {"ok":true} whenever the server is up. Used by
// the Docker HEALTHCHECK and the 10-minute keepalive workflow
// (.github/workflows/keepalive.yml). No data, env or version in the body.
export async function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
