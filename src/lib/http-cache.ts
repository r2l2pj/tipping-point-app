// Edge-cache directives (Cache-Control) for the read API routes — the GEE
// quota saver. Replay cases are immutable, so their responses can sit in the
// CDN for 7d (+1d stale-while-revalidate). `now` is the live bundle and
// follows the Modo Agora refresh cadence (5m + 1m SWR). Error responses are
// never cached.
import { canonicalCaseId } from "./contract";

export const CACHE_REPLAY =
  "public, s-maxage=604800, stale-while-revalidate=86400";
export const CACHE_NOW = "public, s-maxage=300, stale-while-revalidate=60";
export const CACHE_NO_STORE = "no-store";

export const caseCacheControl = (caseId: string | null | undefined): string =>
  canonicalCaseId(caseId ?? "") === "now" ? CACHE_NOW : CACHE_REPLAY;

const withCacheControl = (
  body: unknown,
  cacheControl: string,
  init?: ResponseInit
): Response => {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", cacheControl);
  return Response.json(body, { ...init, headers });
};

export const cachedJson = (
  body: unknown,
  caseId: string | null | undefined,
  init?: ResponseInit
): Response => withCacheControl(body, caseCacheControl(caseId), init);

export const noStoreJson = (body: unknown, init?: ResponseInit): Response =>
  withCacheControl(body, CACHE_NO_STORE, init);
