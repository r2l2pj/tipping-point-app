// Server-only Google Earth Engine client via service account.
// Docs: developers.google.com/earth-engine/guides/service_account
// Env: GEE_PROJECT + GCP_SA_KEY (full JSON of the SA key, one line) —
// GEE_SERVICE_ACCOUNT_KEY accepted as fallback (ruling D10).
import ee from "@google/earthengine";

const SA_KEY_ENVS = ["GCP_SA_KEY", "GEE_SERVICE_ACCOUNT_KEY"] as const;
export type CredentialEnv = (typeof SA_KEY_ENVS)[number];

// Which env currently provides the service-account key, or null when neither
// is set. Read at request time so the status route can report it.
export function credentialEnv(): CredentialEnv | null {
  for (const k of SA_KEY_ENVS) if (process.env[k]) return k;
  return null;
}

let ready: Promise<typeof ee> | null = null;

export function earthEngine(): Promise<typeof ee> {
  if (!ready) {
    ready = new Promise<typeof ee>((resolve, reject) => {
      const env = credentialEnv();
      if (!env)
        return reject(
          new Error("no service-account key (set GCP_SA_KEY)")
        );
      const privateKey = JSON.parse(process.env[env] as string);
      ee.data.authenticateViaPrivateKey(
        privateKey,
        () =>
          ee.initialize(
            null,
            null,
            () => resolve(ee),
            reject,
            undefined,
            process.env.GEE_PROJECT
          ),
        reject
      );
    });
    ready.catch(() => {
      ready = null; // allow retry after a failed init
    });
  }
  return ready;
}
