# u22-cache — HTTP Cache-Control on read API routes

## What changed

- New helper `src/lib/http-cache.ts`:
  - `cachedJson(body, caseId, init?)` — sets `Cache-Control` by case:
    - `canonicalCaseId(caseId) === "now"` → `public, s-maxage=300, stale-while-revalidate=60`
    - anything else (replay cases, hyphen aliases like `rs-2024-05`) → `public, s-maxage=604800, stale-while-revalidate=86400`
  - `noStoreJson(body, init?)` — `Cache-Control: no-store` for all error responses.
- `src/app/api/{tiles,layers,numbers,metrics,point}/route.ts`: every
  `Response.json` on the happy path is now `cachedJson(..., caseId)`; every
  error path (400/404/502/503) is `noStoreJson`. In-memory service TTLs
  untouched.

## Layers-route decision

The brief said layers has no `case` param — it does (`case` is required,
e.g. `?case=now`). I applied the same rule as the other routes: the header
is keyed off the requested `case` param, so `?case=now` gets the 5m variant
and replay cases get 7d. This is simpler than a probe-based choice and
matches how the route already echoes `canonical`.

## Tests

Added one route-level test per suite ("replay case -> 7d edge cache; now ->
5m; errors -> no-store") in:

- `src/lib/ee-tiles.test.ts` — `now` success needs a manifest asset the
  fixtures lack, so `getTiles` is stubbed via `mock.module("@/lib/ee-tiles")`
  (same seam pattern as the layers suite).
- `src/lib/ee-numbers.test.ts` — `setNumbersServiceForTest` seam.
- `src/lib/ee-point.test.ts` — `setPointServiceForTest` seam.
- `src/lib/ee-metrics.test.ts` — `setMetricsServiceForTest` seam;
  `clearMetricsCache()` between same-case requests (service caches by case).
- `src/lib/ee-layers.test.ts` — `mock.module("@/lib/ee-layers")` seam.

## Proof

- `bun install --frozen-lockfile` — 780 packages installed, clean.
- `bun test` (full suite) — 384 pass, 7 skip (live-only), 0 fail.
- `bun run build` — Next 16.4.6 Turbopack build green, all api routes `ƒ`.
- `bun run lint` on the 11 touched files — clean.
