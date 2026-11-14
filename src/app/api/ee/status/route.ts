// Health check for the live-GEE path (stretch goal). 200 when the service
// account initializes; 503 with the reason otherwise. `credential_env` says
// which env provided the key (GCP_SA_KEY or the GEE_SERVICE_ACCOUNT_KEY
// fallback), null when neither is set.
import { credentialEnv, earthEngine } from "@/lib/ee";

export async function GET() {
  try {
    await earthEngine();
    return Response.json({
      gee: "ready",
      project: process.env.GEE_PROJECT,
      credential_env: credentialEnv(),
    });
  } catch (err) {
    return Response.json(
      {
        gee: "unavailable",
        reason: err instanceof Error ? err.message : String(err),
        credential_env: credentialEnv(),
      },
      { status: 503 }
    );
  }
}
