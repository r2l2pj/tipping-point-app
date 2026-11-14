# U3 — data source seam + sync + all public/data fixtures

## What changed

### src/lib/data.ts (rewritten, exports unchanged)
- All current export names kept: `getEventsIndex`, `getRootManifest`,
  `getManifest(id)`, `getMetrics(id)`, `getSeries(id)`, `getAlerts`,
  `getCaseBundle`. No signature changes.
- Remote-first reads: when `DATA_BASE_URL` is set every JSON/GeoJSON read
  goes through `fetchJson`, an async fn carrying `"use cache"` +
  `cacheLife("minutes")`. Any error/404 falls back to `public/data` on disk
  and sets `bundle.fallback = true` (`LoadedCaseBundle extends CaseBundle`
  adds `fallback`, `criticalAreas`, `nisarPasses` — types.ts untouched).
  Absolute http(s)/gs:// product paths are fetched even without
  `DATA_BASE_URL`.
- `cacheLife` is wrapped in try/catch — under `bun test` there is no cache
  scope and the call would throw; under Next it configures the minutes
  profile inside the `use cache` fn.
- Case lookup: `canonicalCaseId(id)` is both the manifest key and the data
  dir (L4 dirs are `rs_2024/`, `wa_2025/`, `now/`); `caseAlias` supplies the
  legacy hyphen dir as a second candidate for per-case manifest/metrics
  fallback (`dirsFor`).
- Manifest merge = root `cases[key]` node over legacy per-case manifest;
  per-case file is only fetched when the root node is missing pieces.
- Products map first, fixed names fallback; explicit `null` = absent and is
  never fetched (load decisions use the *raw* products map — `toNowView`
  exposes strings-only on `manifest.products`). `_null_reasons` stays a
  case-node sibling per the contract.
- `metrics` ref `metrics.json#<case>` → reads root metrics.json, indexes
  `cases[<case>]` → `bundle.metrics` + `bundle.metricsView` via
  `toMetricsView`. Bare-path/legacy per-case `metrics.json` still resolves
  (`getMetrics(id)` same behavior).
- `now`: `toNowView` on the verbatim now@2 node; loads
  `summary`/`alerts`/`critical_areas` via products map (fixed-name
  fallback); when no series resolves, timeline days derive from layer
  dates + forecast flags (`nowSeriesFromLayers`, ref = last observed date).
- Remote mode rewrites `layer.png`/`layer.cog` through `resolveAsset` so
  the client hits the bucket; fs mode leaves them data-root-relative.

### scripts/sync-data.mjs
- `now/` excluded from the main copy and synced separately ONLY when
  `<data-repo>/now/manifest.json` exists AND `updated_at` is non-null;
  absent `now/` tolerated. Default sibling path unchanged (warns + skips in
  this worktree; tested with `DATA_REPO`).

### scripts/mock-png.mjs
- Canonical dirs (`wa_2025`, `rs_2024`, `now`); `joinKey` resolves
  now-relative vs dir-prefixed png paths.
- New renderers: `nisar_*` (cool grayscale; `_post` adds bright flood
  backscatter at hotspots), `night_lights_*` (warm city glow; `_post` dims
  ×0.42). `ensureWaRows()` idempotently appends the 4 layer rows to the
  root manifest `wa_2025` node and `wa_2025/manifest.json`.

### public/data/** (sole owner — L4/L5 conversion)
- Dirs renamed `rs-2024-05/ → rs_2024/`, `wa-2025-12/ → wa_2025/`; all asset
  paths rewritten canonical (`rs_2024/png/...`). Hyphen ids survive only as
  `event_id` / `event` payload fields / events.json ids.
- Root `manifest.json`: keys `rs_2024`/`wa_2025`/`now`; `event_id`,
  `forecast_source` (`perfect-forecast` ×2, `geos-fp` on now), pt-BR legends
  `[Baixo, Moderado, Alto, Crítico]`, products maps with string|null
  values, `_null_reasons` as case-node sibling, `metrics.json#<case>` refs;
  `now` node = verbatim now@2 manifest.
- `metrics.json`: ONE root file `{cases:{rs_2024,wa_2025}}` flat v4 keys +
  `collections` + `_null_reasons`; per-case metrics.json deleted (legacy
  read path kept in code).
- `now/` → now@2: `schema`, products {critical_areas,summary,alerts},
  top-level `nisar_passes`, layers `tpi_{slide,flood}_d0..d3`
  (`forecast:true` on d1–d3), pngs renamed `png/<layer>_d<k>.png`;
  `summary.json`, `alerts.json` (3 candidates incl. one `hold:true`),
  `geojson/critical_areas.geojson` written.
- `wa_2025`: nisar_pre/post + night_lights_pre/post layer rows + PNGs;
  series gains 3 `kind:"forecast"` days (observed values shifted forward);
  new `geojson/municipal_boundaries.geojson` (5 county polys),
  `geojson/landslide_catalog.geojson` (4 GLC points), `series/swot.json`.
- `simular.json` (Telegram /simular Encantado 2024 sequence) written.
- L5 cog-only layers `r_series`/`s_series`/`t_slide`/`t_flood` (png:null,
  dated cog stems) added to both replay case nodes + per-case manifests.
- `SCHEMA.md` copied from data repo — the committed copy already carries
  the L4 amendments (canonical dirs, metrics#frag, _null_reasons sibling).

### Other
- `.env.example` — all names incl. `EARTHDATA_TOKEN` +
  `EDL_USER`/`EDL_PASS` (L6). Force-added: `.gitignore` `.env*` pattern
  covers it.
- `docs/DEPLOY.md` — "Data pipeline secrets (GitHub)" (L6), "GEE asset
  ingestion (staging)" (L7), "Scheduled jobs (GitHub Actions)" (L8).
- `test/fixtures/manifest.root.json` — L4 paths + `metrics.json#` refs.
- `src/lib/data.test.ts` — Bun.serve fixture bucket: remote read, 404 +
  refused → fs fallback + `fallback:true`, products-map resolution,
  metrics#frag, summary/alerts load, derived now timeline, fs-only mode.
  Hermetic env save/restore.

- Post-sync note: the data repo grew real `rs_2024` + `wa_2025`
  `geojson/{municipal_boundaries,landslide_catalog}.geojson` during this
  unit (IBGE / UFRGS) — `sync:data` pulled them in and they committed with
  the rest (real contract data beats mocks; landslide_catalog is ~3.5 MB).
  `rs_2024` products map was updated to point at them instead of null.

## Deviations to flag
- `src/lib/contract.test.ts`: one-line edit — the swot product path
  assertion updated to the canonical `rs_2024/series/swot.json` (required
  by the sanctioned fixture update; without it `bun test` fails). Out of
  the nominal write scope but unavoidable for a green suite.
- L8 check: `updated_at`/`data_dates` land on every bundle via the
  manifest merge — on fs/last-good fallback paths the bundled manifest's
  dates are what the Header banner will show. Confirmed.
- `next build` typecheck is clean; `bunx tsc --noEmit` still shows two
  pre-existing `RouteContext`/`LayoutProps` typegen errors unrelated to
  this work.

## Proof (this worktree, unit/u3)
- `bun test` → 53 pass, 0 fail (incl. 8 new data.test.ts cases)
- `bun run lint` → 0 errors (1100 warnings, all pre-existing in
  public/maplibre-gl-worker.js + src/types/earthengine.d.ts)
- `DATA_REPO=.../tipping-point-data bun run sync:data` → synced; repo's
  `now/manifest.json` has `updated_at: null` → correctly skipped
  ("run in progress"); events.json + SCHEMA.md overwrote as designed
- `bun run build` → green (prebuild sync warns+skips without DATA_REPO)
- `bun run dev` + `curl localhost:3000/` → 200, contains "Tipping Point"
