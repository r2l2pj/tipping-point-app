# L14 — real data only: loader pending semantics + test fixtures

Commit 8522fcf (merged as fb65f4e) delivered the pending semantics; review
fix-forward landed on `unit/l14fix`: `253afe4` "data: no fabricated series
for absent now/ output (L14)" + `e2727bd` "test: pin manifest-fallback
metrics tests to unreachable remote" + `69d5236` "contract: map nested
landslide_hit to flat landslide_hit_pct + real-metrics fixture". Not pushed.

## Real metrics mapping (69d5236)

- `test/fixtures/metrics-19c56df.json` — real pinned fallback-branch
  metrics (wa_2025 flat flood keys; rs_2024 nested `landslide_hit`).
- `contract.ts`: new `LandslideHit`/`LandslideHitDay` types; `MetricsV4`
  gains `landslide_hit`, `water_km2`, `threshold_db`, `flood_bright_km2`
  (nested object passes `toMetricsView` through untouched — never
  synthesizes a flat value). New `flattenLandslideHit(view, refDate)`:
  flat `landslide_hit_pct` = event-day `hit_pct` (entry matching
  reference_date, else last per_day) normalized by the `*_pct` rule;
  already-flat wins, no data → absent.
- `data.ts`: `metricsView` built via `flattenLandslideHit(toMetricsView(
  metrics), referenceDate)` — rs_2024 yields 0.85855 (2024-05-02).
- Tests: contract.test asserts wa_2025 keys (swath_coverage_pct → 0.741,
  scope, clusters) + flatten rules; data.test asserts `metrics.json#
  rs_2024` resolves through the `cases` wrapper against the real fixture
  and landslide_hit_pct → 0.85855 on the bundle.
- `docs/app-contract.md`: documents the nested shape + event-day
  flattening rule.

## Test determinism fix (c2c9dd0)

`src/lib/ee-metrics.test.ts`: the four tests exercising the real
`getMetrics` entry with the default manifest reader
(`no-credential/dead gee init still serves manifest data`, and the two
`nope-9999` absent-manifest cases) now set
`DATA_BASE_URL=https://example.invalid/` via `withEnv` — the remote read
always misses so the fs fixture serves deterministically. Root cause was
remote-first nondeterminism: a reachable fallback branch answers the real
wa-only metrics.json, making `rs_2024` manifest metrics absent. All other
tests in the file inject `readManifest`/fake ee, so no remote hazard.

## Fix-forward (1247608)

Review finding: `nowSeriesFromLayers()` fabricated `imerg_mm:0, smap:0,
tpi:0` day points for `now/` when no series file existed — a fabricated
value under L14.

- Deleted `nowSeriesFromLayers` entirely (function + call; `NowView` and
  `DayPoint` imports dropped). `effectiveSeries = series` — an absent
  series file is `undefined` + `pending` contains `'series'` for every
  case, `now` included.
- `FORECAST_DAY_RE` kept — still used by reference-date derivation.
- Rewrote the now@2 test: "no series file -> series undefined + pending
  'series' (no fabricated days)" (manifest forecast-layer ids still
  asserted).
- `docs/app-contract.md` updated: now/ ships without a series file →
  `bundle.series` undefined + `'series'` pending; the pending-table
  bullet no longer mentions layer-derived timelines.

## Original change (8522fcf)

- `getCaseBundle`: sorted `bundle.pending: string[]` — `'metrics'`,
  `'series'`, and product ids declared (non-null) but missing; `null`-
  declared keys are absent-by-contract, not pending. Throws only for a
  missing root `manifest.json` and the existing bounds case.
- `getAlerts`/`getMetrics`/`getSeries` return `T | undefined` on absence
  (callers verified: alerts/page catches, ee-metrics tolerates undefined,
  getManifest keeps throwing for the manifest route's 404).
- `dataDir()` seam: `DATA_FS_DIR` override; under `NODE_ENV=test` bundled
  reads default to `test/fixtures/public-data` (all mocks copied there) —
  no test reads `public/data`, so the suite is green pre- and post-sweep.
- `docs/app-contract.md`: "Pending outputs (L14)" section.

## Commands run / results

- `bun install` (fresh worktree), `bun test` twice back-to-back —
  **346 pass / 0 fail** both runs (6 gee-smoke skips).
- `bunx tsc --noEmit -p tsconfig.json` — clean, no new errors.
- `bun run lint --quiet` — exit 0.
- No `bun run build`; no `public/data` edits; not pushed.
