# U9 — GEE live tiles + v4 events API

Branch `unit/u9`, commit `5ed00f2`. Cred-blocked: fully coded and tested
without credentials; no new dependencies.

## What changed

- `src/lib/ee.ts` — D10 credential chain: `GCP_SA_KEY` first,
  `GEE_SERVICE_ACCOUNT_KEY` fallback. New `credentialEnv()` export reports
  which env resolved (`"GCP_SA_KEY" | "GEE_SERVICE_ACCOUNT_KEY" | null`).
  Memoized init with retry-after-failure kept as-is.
- `src/lib/ee-tiles.ts` (new) — injectable tile service.
  `createTileService(ee, {assetRoot, now, ttlMs, refreshSkewMs})` →
  `getTiles({layer, caseId, date})`; `getTiles(query)` is the credentialed
  entry used by the route. Asset id
  `${GEE_ASSET_ROOT|projects/$GEE_PROJECT/assets/tpi}/${canonicalCaseId(caseId)}_${layer}_series`;
  band = the date; TPI binned at class mins [0.2, 0.4, 0.6] → raster 0–3,
  class 0 masked, `visualize({min:1, max:3, palette})` where cuts and palette
  are derived from `TPI_CLASSES`. Module-level cache keyed
  `${layer}|${canonical}|${date}`, TTL 2 h with 5 min refresh skew,
  `expires_at = ISO(issued + 2h)`; second call same key does not touch ee.
  Errors: `CredsError` (no SA env → 503), `TileNotFoundError` (missing
  asset/band/date → 404), `TileServiceError` (wrapped init/compute failure
  → 502). `clearTileCache()` exported for tests.
- `src/app/api/tiles/route.ts` (new) — GET only. 400 naming the bad/missing
  param (`layer` whitelist, `case` required, `date` /^\d{4}-\d{2}-\d{2}$/);
  503 `{error:"gee unavailable", reason}` with no SA env; 200
  `{tiles, expires_at}`; 404 band/asset miss; 502 other ee failure.
- `src/app/api/events/route.ts` — keeps `getEventsIndex()` result; when
  `getRootManifest()` resolves adds `{cases: keys, updated_at}`. 503
  `{error}` contract unchanged.
- `src/app/api/events/[id]/manifest/route.ts` — `canonicalCaseId(id)` →
  `root.cases[canonical] ?? root.cases[id]` → manifest assembled like
  `getCaseBundle` (mode, bounds, `updated_at = entry.updated_at ??
  root.updated_at`, data_dates, layers). Miss → `getManifest(canonical)` →
  404 `{error: no manifest for event ${id}}`. `RouteContext` typing kept.
- `src/app/api/ee/status/route.ts` — same 200/503 contract plus
  `credential_env` on both responses.
- `src/types/earthengine.d.ts` — added `MapId`, `ImageVisualizationParams`,
  `List`, `Image` (select/gt/add/updateMask/bandNames/visualize/getMapId/
  getInfo) and `function Image(id)` on the ee object.
- `src/lib/ee-tiles.test.ts` (new) — 11 tests: fake ee records calls; asserts
  asset id `root/rs_2024_tpi_slide_series`, date-band select, bin/mask/
  palette, url_format → tiles, cache hit, expiry refetch (injected clock),
  missing band → TileNotFoundError, no-creds → CredsError, GET → 400/503.

## Verification (run in this worktree)

- `bun install --frozen-lockfile` — 753 packages, clean.
- `bun test src/lib/ee-tiles.test.ts` — 11 pass, 0 fail.
- `bun test` — 56 pass, 0 fail (whole suite).
- `bun run lint` — 0 errors on touched files (the 1100 warnings are
  pre-existing, mostly vendored ee build output + the d.ts `typeof`
  pattern that predates this change; verified identical on base via stash).
- `bun run build` — green; `sync:data` warn-skipped (data repo not a
  sibling of the worktree, as expected). `/api/tiles` listed as dynamic.
