# u25-geeflag — L25 runtime default OFF

Branch: `unit/u25-geeflag`; base: `c49932e`. Verification ran on this branch's implementation working tree before commit.

## Changes

- Added `geeEnabled()` accepting only `1` or case-insensitive `true`, read at request time. Added an Earth Engine initialization guard as defense for callers outside the scoped routes. Preserved all credential/auth/init and fake-EE service code.
- Tiles, layers, numbers, and point return the existing no-store 503 error shape with reason `runtime GEE disabled (GEE_ENABLED unset)` when disabled. Existing parameter validation remains first.
- Metrics uses `createMetricsService(undefined)` when disabled. Zero positive/negative cache TTLs prevent the shared service cache from returning a previously cached GEE overlay. Enabled path remains unchanged.
- Health reports enabled/creds/probe, skips initialization and probing when disabled, and can be healthy without GCP_SA_KEY. Disabled health requires DATA_BASE_URL, a readable manifest, and a parseable manifest/now timestamp. No age cutoff existed, so no new age threshold was invented. Enabled probe and readiness behavior are retained.
- Existing fake-EE route suites explicitly enable GEE and restore the flag after each test. Added regression coverage for all four disabled 503 routes, skipped healthy probe, manifest-only metrics despite credentials and a cached overlay, accepted/rejected flag values, and the real initialization guard.

## Commands and results

1. `bun install --frozen-lockfile` — exit 0; 780 packages installed; lockfile unchanged.
2. `bun test` — exit 0; initial run 391 pass / 7 skip / 0 fail. Final run after helper coverage: **392 pass / 7 skip / 0 fail**, 1274 expect calls, 399 tests across 20 files. Skips are six opt-in live GEE smoke tests and the opt-in live Neon store test.
3. `bun run build` — exit 0; compiled successfully, TypeScript finished, 14/14 static pages generated. The prebuild data sync reported the sibling data checkout absent and skipped as designed.
4. `bunx eslint src/lib/ee.ts src/lib/health.ts src/app/api/{tiles,layers,numbers,metrics,point,health}/route.ts src/lib/{ee,ee-tiles,ee-layers,ee-numbers,ee-metrics,ee-point,health}.test.ts` — exit 0, no warnings/errors.
5. `git diff --check` — exit 0.

## Scope notes

No dependencies, service modules, data loaders, or unrelated files changed. `/api/health/route.ts` needs no edit because it delegates to collectHealth. The existing data loader also calls live services; informed lead t69, and guarded the shared initialization entry point within allowed scope. No push performed.
