# U12 — /api/tiles: every registry layer + `now`, timeouts, data_date

Branch `unit/u12-tiles`, base 35b6c18. Cred-blocked: no creds, no new deps,
fake-ee tests. Includes the t69 contract update (manifest-first asset
resolution, `_series` convention + YYYYMMDD bands, `now` manifest-only,
single-band as-is).

## What changed

- `src/lib/ee-shared.ts` (new) — shared EE plumbing, moved out of ee-tiles
  without a module cycle: `CredsError`/`TileNotFoundError`/`TileServiceError`
  (ee-tiles re-exports them — public API stable), `errMessage`,
  `NOT_FOUND_RE` + `mapComputeError`, `withTimeout(promise, ms, label)`
  (Promise.race → `TileServiceError("timeout after …")`, timer cleared on
  settle), and `imageInfo(img, context)` — promisified getInfo returning
  `{bands?: [{id}], properties?}`.
- `src/lib/ee-tiles.ts` —
  - `LAYER_VIS` registry (exported, `satisfies`d) with 14 layers and 4 vis
    kinds: `classes` (tpi_slide/tpi_flood/t_ml — gte binning at TPI_CLASSES
    slice(1) mins, `cls.gt(0)` mask, palette slice(1) colors, unchanged),
    `ramp` (nisar_pre/nisar_post −25→−5 bw, night_lights_pre/post 0→10
    viridis-4, hillshade 0→255 bw, imerg 0→50 blues, smap 0→1 brown-white-blue;
    `updateMask(gte(min)).visualize{min,max,palette}`), `mask`
    (flood_confirmed/permanent_water/landslide_candidates —
    `selfMask().visualize{palette:[color]}`), `categorical` (opera_validation
    1–4 both/NISAR/OPERA/cloud — `updateMask(gt(0)).visualize{min,max,palette}`).
    `TILE_LAYERS = Object.keys(LAYER_VIS)`; `TileLayer = keyof typeof`.
  - Asset resolution (contract update): injectable
    `opts.manifestAsset(caseId, layer, date)` — default impl reads
    `getRootManifest()` (read-only import from lib/data), finds
    `cases[canonical] ?? cases[caseId]` → `layers.find(id+date)` → `asset`
    (SCHEMA-pinned field, absent on current syncs → falls through). Explicit
    asset wins; else `<assetRoot>/<canonical>/<layer>_series` where assetRoot =
    `GEE_ASSET_ROOT ?? projects/$GEE_PROJECT/assets/tipping-point` (was
    `assets/tpi`). `now` resolves ONLY via manifest asset → `TileNotFoundError`
    before touching ee when absent.
  - One `getInfo` per call before selecting: `bands[].id` must contain the
    date in either `YYYY-MM-DD` or `YYYYMMDD` form → `select(band)`; if no
    date band but exactly one band → image used as-is (single-day
    `now/<layer>_dN`, masks); else `TileNotFoundError`.
  - `data_date` captured from `props.data_date ?? props.updated_at ?? null`,
    returned in the response and stored in the cache entry.
  - Every EE roundtrip (getInfo, getMapId) wrapped in `withTimeout`,
    `opts.timeoutMs ?? GEE_TIMEOUT_MS env ?? 8000`.
  - `TileResult` = `{tiles, expires_at, data_date, layer, case, date}`
    (case/date echo the request). Cache still 2 h / 5 min skew, now stores
    `dataDate`.
- `src/app/api/tiles/route.ts` — same contract + new-field passthrough;
  `TileServiceError` whose message starts with `timeout` → 503
  `{error:"gee unavailable", reason}` (added before the 404/502 branches);
  layer whitelist now lists all 14 registry ids.
- `src/types/earthengine.d.ts` — added `Image.selfMask()` (only extension
  needed; gte/getInfo/updateMask/visualize/getMapId already declared).
- `src/lib/ee-tiles.test.ts` — 32 tests. Fake ee now returns
  `getInfo {bands:[{id}], properties}` plus hang/infoErr/mapErr hooks.
  `mock.module("@/lib/ee" + "./ee")` stubs credentialEnv (mirrors env check)
  and earthEngine (resolves a globalThis-installed fake), so the route's full
  credentialed path runs against the fake — covers the 400/503/404/502 matrix
  plus a 200 echo and the `now` 404 (against the real synced manifest).
  Covers: manifest asset precedence + seam args, `_series` fallback, hyphen
  alias, `now` manifest-only + no-ee-on-404, both band forms, single-band
  as-is, every registry id (14) producing its vis calls, data_date capture/
  fallback/null/cache, cache hit + expiry, error mapping, timeout →
  TileServiceError("timeout…"), no-creds → CredsError.

## Commands run and results

- `bun install --frozen-lockfile` — 762 packages, clean.
- `bun test src/lib/ee-tiles.test.ts` — 32 pass, 0 fail.
- `bun test` — 123 pass, 0 fail (whole suite, 9 files).
- `bun run build` — green; `sync:data` warn-skipped (data repo not a sibling
  of the worktree — expected); `/api/tiles` listed dynamic (ƒ); TypeScript
  clean.
- `bunx eslint <my files>` — 0 errors; 2 pre-existing warnings on
  earthengine.d.ts (`data`/`initialize` typeof pattern, predates this change,
  same as u9).

## Notes / seams for follow-ups

- `opts.manifestAsset` is the documented seam for manifest-provided assets;
  when the pipeline writes `asset` on manifest layers (incl. `now`
  `…_d{0..3}`), resolution picks it up with no code change.
- The synced `public/data/manifest.json` in this worktree keys cases by the
  hyphen event id (`rs-2024-05`); the lookup tries `cases[canonical]` first
  then `cases[caseId]`, matching the events-manifest route pattern — robust
  to either key form.
- `imageInfo`/`withTimeout`/`mapComputeError` in ee-shared are ready for
  other EE readers (status route, alerts) without cycles.
