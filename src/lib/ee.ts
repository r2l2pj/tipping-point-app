// Server-only Google Earth Engine client via service account.
// Docs: developers.google.com/earth-engine/guides/service_account
// Env: GEE_PROJECT + GEE_SERVICE_ACCOUNT_KEY (full JSON of the SA key, one line).
import ee from "@google/earthengine";

let ready: Promise<typeof ee> | null = null;

export function earthEngine(): Promise<typeof ee> {
  if (!ready) {
    ready = new Promise<typeof ee>((resolve, reject) => {
      const raw = process.env.GEE_SERVICE_ACCOUNT_KEY;
      if (!raw) return reject(new Error("GEE_SERVICE_ACCOUNT_KEY not set"));
      const privateKey = JSON.parse(raw);
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
