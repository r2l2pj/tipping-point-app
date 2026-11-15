// Server-only Google Earth Engine client via service account.
// Docs: developers.google.com/earth-engine/guides/service_account
// Env: GEE_PROJECT + GCP_SA_KEY (full JSON of the SA key, one line) —
// GEE_SERVICE_ACCOUNT_KEY accepted as fallback (ruling D10), or
// GOOGLE_APPLICATION_CREDENTIALS pointing at the SA key JSON file.
import { readFile } from "node:fs/promises";

import ee from "@google/earthengine";

const SA_KEY_ENVS = [
  "GCP_SA_KEY",
  "GEE_SERVICE_ACCOUNT_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
] as const;
export type CredentialEnv = (typeof SA_KEY_ENVS)[number];

// L25 runtime default OFF.
export function geeEnabled(): boolean {
  return ["1", "true"].includes(process.env.GEE_ENABLED?.toLowerCase() ?? "");
}

// Which env currently provides the service-account key, or null when none
// is set. Read at request time so the status route can report it.
export function credentialEnv(): CredentialEnv | null {
  for (const k of SA_KEY_ENVS) if (process.env[k]) return k;
  return null;
}

// Load the service-account key from whichever credential env is set.
// GOOGLE_APPLICATION_CREDENTIALS holds a file path; the other two hold
// inline JSON. Errors name the env var and reason — never the path or
// file/env contents.
export async function loadServiceAccount(): Promise<{
  env: CredentialEnv;
  privateKey: Record<string, unknown>;
}> {
  const env = credentialEnv();
  if (!env)
    throw new Error(
      "no service-account key (set GCP_SA_KEY, GEE_SERVICE_ACCOUNT_KEY, or GOOGLE_APPLICATION_CREDENTIALS)"
    );
  const value = process.env[env] as string;
  if (env !== "GOOGLE_APPLICATION_CREDENTIALS") {
    try {
      return { env, privateKey: JSON.parse(value) };
    } catch {
      throw new Error(`${env} is not valid JSON`);
    }
  }
  let contents: string;
  try {
    contents = await readFile(value, "utf8");
  } catch {
    throw new Error(`${env} key file is missing or unreadable`);
  }
  try {
    return { env, privateKey: JSON.parse(contents) };
  } catch {
    throw new Error(`${env} key file is not valid JSON`);
  }
}

let ready: Promise<typeof ee> | null = null;

// Bound the auth+init roundtrip: a hung authenticate/initialize (unreachable
// endpoint, malformed key) must reject so callers degrade instead of pending
// forever. GEE_INIT_TIMEOUT_MS overrides the 8s default.
export function earthEngine(): Promise<typeof ee> {
  if (!geeEnabled()) return Promise.reject(new Error("runtime GEE disabled (GEE_ENABLED unset)"));
  if (!ready) {
    const timeoutMs = Number(process.env.GEE_INIT_TIMEOUT_MS) || 8000;
    ready = Promise.race([
      loadServiceAccount().then(
        ({ privateKey }) =>
          new Promise<typeof ee>((resolve, reject) => {
            ee.data.authenticateViaPrivateKey(
              privateKey as Parameters<
                typeof ee.data.authenticateViaPrivateKey
              >[0],
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
          })
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`gee init timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
    ready.catch(() => {
      ready = null; // allow retry after a failed init
    });
  }
  return ready;
}
