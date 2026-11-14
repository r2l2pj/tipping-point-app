# u13-health — GET /api/health

## What changed (new files only)
- `src/lib/health.ts` — `collectHealth(deps)` builds the report: env presence
  booleans for GCP_SA_KEY/GEE_PROJECT/GEE_ASSET_ROOT/DATA_BASE_URL/
  TELEGRAM_TOKEN/TELEGRAM_SECRET (booleans only, never values); gee probe =
  injected ee factory + `imageInfo(ee.Image("NASA/NASADEM_HGT/001"))` under
  `withTimeout` (GEE_HEALTH_TIMEOUT_MS, default 8000); skipped with reason
  "no service-account key" when creds absent; data = manifest read with
  per-case `updated_at` echo (now included), `manifest=false`/`cases={}` on
  read failure. `setHealthDepsForTest` seam for the route.
- `src/app/api/health/route.ts` — GET returns `Response.json(await
  collectHealth(healthDeps()))`, always 200.
- `src/lib/health.test.ts` — 11 tests: per-var env booleans, sentinel-value
  leak check via JSON.stringify, ok logic, ready/timeout/no-creds probe
  paths, manifest echo incl. now, manifest throw → still 200 shape, route
  200 in healthy and degraded cases.

No existing files touched; no new deps.

## Commands run
- `bun install --frozen-lockfile` — 762 pkgs, clean
- `bun test` — 230 pass / 0 fail (baseline 219 incl. unrelated, +11 mine)
- `bun run build` — green (sync:data warn-skipped, worktree has no data repo);
  /api/health listed as dynamic route
- `bun run lint` / `bunx eslint src/lib/health*.ts src/app/api/health/route.ts`
  — 0 errors/warnings on new files (repo-wide run shows pre-existing warnings
  in generated/vendor files only)

## Fix during impl
- `??` + `||` mixing needed parens for bun's TS parse (GEE_HEALTH_TIMEOUT_MS
  fallback).
