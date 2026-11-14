# u14-point — GET /api/point

Commit `7d4d8e2` on `unit/u14-point` (base main `0461363`).

## What changed

- `src/lib/ee-point.ts` (new) — `createPointService(ee, opts)` samples six
  assets in parallel via `Promise.allSettled`:
  `tpi_slide`, `tpi_flood`, `r`, `s` at
  `<assetRoot>/<canonical>/<id>_series` (date band, dashed or compact
  `YYYYMMDD`) and `t_slide`, `t_flood` at the bare `<id>` statics.
  A manifest `layers[].asset` matched on id+date always wins
  (`manifestAsset` option injectable, default reads `getRootManifest`
  with canonical + alias lookup like ee-numbers). Each asset: `getInfo`
  → select the date band (single-band assets used as-is) →
  `reduceRegion({reducer: ee.Reducer.first(), geometry:
  ee.Geometry.Point(lon, lat), scale})` promisified through
  `imageInfo` + `withTimeout` (ee-shared), `GEE_TIMEOUT_MS` env or 8 s,
  `GEE_POINT_SCALE_M` or 1000 m. Missing asset or missing band → null for
  that field; `TileNotFoundError` at the asset `getInfo` also marks the
  asset unanswered — only when *no* asset `getInfo` succeeds is a
  `TileNotFoundError` thrown (404). Any non-not-found rejection (compute
  error → `TileServiceError` 502, timeout → `TileServiceError` starting
  "timeout" 503) fails the request. `data_date` from the first answered
  asset's `properties.data_date ?? updated_at`. Cache: 10 min success
  TTL + 30 s negative TTL keyed
  `canonical|date|lat3|lon3` with lat/lon rounded to 3 decimals *before*
  the EE call (same pixel never sampled twice). `getPoint` credentialed
  entry checks `credentialEnv()` first (CredsError → 503);
  `setPointServiceForTest` / `clearPointCache` test seams.
- `src/app/api/point/route.ts` (new) — `GET
  /api/point?case=<id|alias>&date=YYYY-MM-DD|YYYYMMDD&lat=<f>&lon=<f>`.
  400 on missing case / bad date (compact `YYYYMMDD` normalized, real
  calendar dates only) / lat outside [-90,90] / non-finite lon outside
  [-180,180]. 503 no creds or timeout; 404 `TileNotFoundError`; 502
  other. 200 payload `{case, canonical, date, lat, lon, data_date,
  values:{tpi_slide, tpi_flood, r, s, t_slide, t_flood}}` — every value
  number|null.
- `src/lib/ee-point.test.ts` (new) — 19 fake-ee tests, no creds: asset
  resolution + parallel sampling, manifest override, partial missing →
  nulls, missing band → null, dashed vs compact bands, single-band
  static used as-is, masked pixel → null, all-missing → 404 error,
  service error, timeout, `data_date` echo, 3-decimal cache dedup,
  negative cache, CredsError, and route tests for every status incl.
  `YYYYMMDD` date normalization and alias echo.

## Commands & results

- `bun install --frozen-lockfile` — 762 packages, clean.
- `bun test` — **271 pass, 6 skip, 0 fail** (baseline 252 + 19 new;
  skips are the creds-gated live smoke tests).
- `bun run build` — green (sync:data warn-skipped, DATA_REPO absent);
  `/api/point` listed as a dynamic route.
- `bun run lint` — 0 errors repo-wide; no warnings on the three new
  files.

## Notes / deviations

- "Answered" = asset-level `getInfo` resolved (missing date band still
  counts → null), per the pinned definition.
- A `reduceRegion` not-found after a successful `getInfo` degrades to
  null (asset answered), non-not-found reduce errors propagate to 502.
- Only 404/timeout errors are negative-cached (mirrors ee-numbers'
  intent); a 502 compute error is not cached.
