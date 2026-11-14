# L14 — real data only: loader pending semantics + test fixtures

Commit: `6e728c7` on `unit/l14pending` — "data: pending semantics for absent
real outputs + test fixtures (L14)". Not pushed.

## What changed

**src/lib/data.ts**
- `dataDir()` seam: `DATA_FS_DIR` env override; under `bun test`
  (`NODE_ENV=test`) the bundled-copy root defaults to
  `test/fixtures/public-data` — production stays on `public/data`. This is
  what keeps the whole suite green after the mock sweep without touching
  other test files (ee-metrics.test.ts etc. read through this seam).
- `getCaseBundle`: throws `data: manifest.json not found` when the root
  manifest is absent everywhere (previously it silently degraded to the
  per-case manifest). Per-case `manifest.json` absent already merged fine —
  no change needed there.
- `bundle.pending: string[]` (required, sorted) on `LoadedCaseBundle`:
  - `'metrics'` when `loadMetrics` resolves `undefined` (metrics.json
    missing or case key absent).
  - `'series'` when no series file resolved AND (for `now`) the
    layer-derived timeline also produced nothing — `now/` derives series
    from layers as before, so a working derived timeline is not pending.
  - each product id whose products-map entry was **declared** (string
    path) but missing from storage; `null`-declared keys are
    absent-by-contract, not pending.
- `getAlerts()` → `Promise<AlertsFile | undefined>` (was throwing `must`).
  Caller `src/app/alerts/page.tsx` already does `.catch(() => null)?.alerts
  ?? []` — compiles unchanged.
- `getMetrics()` → `Promise<EventMetrics | undefined>` (was throwing
  `data: metrics for <id> not found`). The only non-test caller is
  `ee-metrics.ts` `defaultReadManifest`, which already tolerates
  `undefined` and still catches the old message for legacy paths.
- `getSeries()` → `Promise<SeriesDaily | undefined>`; no non-test callers.
- `getManifest()` left throwing — only caller is the
  `/api/events/[id]/manifest` route, which catches to a 404 (route wrapper
  keeps the throw, per spec).
- `getEventsIndex()` left throwing via `must` — `events.json` remains in
  the repo and page.tsx already catches.
- GEE overlay (L8) untouched.

**src/lib/types.ts** — `CaseBundle.pending?: string[]` documented.

**test/fixtures/** — `public-data/` holds a copy of every JSON/geojson
mock previously read from `public/data` (manifest, metrics, events,
alerts, simular, now/*, per-case manifests/assets/nisar_products, geojsons,
series). `public-data-empty/.gitkeep` is the "ships nothing" dir for
pending tests.

**src/lib/data.test.ts**
- Bundled-copy assertions now resolve through the fixture dir (comments
  updated); the suite never reads `public/data`.
- New `describe("pending semantics for absent real outputs (L14)")`:
  empty `pending` when all present; metrics-key-absent → `metricsView`
  undefined + `pending` has `metrics`; missing series → `series` undefined
  + `pending` has `series`/`imerg_smap_daily`; declared-but-missing
  `priority_zones` → pending lists it while `null`-declared
  `flood_confirmed` does not; `getAlerts()` resolves `undefined` on
  absence; root-manifest absence still throws.

**docs/app-contract.md** — new "Pending outputs (L14)" section.

## Commands run / results

- `bun install` — 762 packages (node_modules was absent).
- `bun test` — 346 pass, 6 skip, 0 fail.
- Post-sweep simulation (`DATA_FS_DIR=/tmp/post-sweep` with only
  manifest/metrics-wa/events/real geojsons): pre-seam it failed 2
  ee-metrics tests that read bundled rs_2024 metrics; after the
  `NODE_ENV=test` fixture default, `bun test` = 0 fail (bundled reads
  resolve fixtures, so the sweep can't affect the suite).
- `bunx tsc --noEmit -p tsconfig.json` — only pre-existing TS2304
  (`RouteContext`, `LayoutProps`) codegen noise; verified identical output
  on the pre-change tree via stash. One transient error (`import.meta.dir`
  TS2339) fixed by using `process.cwd()`.
- `bun run lint --quiet` — exit 0.
- Not run: `bun run build` (per instructions); no `public/data` files
  deleted (sweep is lead-integration's commit).

## Notes for leads

- Signature changes for lead-front/lead-back: `getAlerts`,
  `getMetrics`, `getSeries` now return `T | undefined`. `bundle.pending`
  is the render marker (sorted string ids: `metrics`, `series`, product
  ids like `priority_zones`).
- After the sweep, rs_2024 bundles will report e.g.
  `pending: ["imerg_smap_daily","landslide_catalog","metrics","municipal_boundaries","places","series"]`
  only for products the (kept) root manifest declares — `null`-declared
  keys stay silent by design.
