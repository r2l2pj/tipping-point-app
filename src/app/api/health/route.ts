// Deploy-check / demo-protection health report. Always 200 JSON — the body
// is the report (env var presence, gee readiness, manifest freshness).
import { collectHealth, healthDeps } from "@/lib/health";

export async function GET() {
  return Response.json(await collectHealth(healthDeps()));
}
