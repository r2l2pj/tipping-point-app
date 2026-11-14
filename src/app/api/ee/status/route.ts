// Health check for the live-GEE path (stretch goal). 200 when the service
// account initializes; 503 with the reason otherwise.
import { earthEngine } from "@/lib/ee";

export async function GET() {
  try {
    await earthEngine();
    return Response.json({ gee: "ready", project: process.env.GEE_PROJECT });
  } catch (err) {
    return Response.json(
      { gee: "unavailable", reason: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
