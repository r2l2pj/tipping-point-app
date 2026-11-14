# L14 — real data only: loader pending semantics + test fixtures

Commit 8522fcf (merged as fb65f4e) delivered the pending semantics; review
fix-forward landed as `1247608` on `unit/l14fix` — "data: no fabricated
series for absent now/ output (L14)". Not pushed.

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

- `bun install` (fresh worktree), `bun test` — **344 pass / 2 fail**.
  The 2 failures (`createMetricsService > no-credential/dead gee init
  still serves manifest data`) are **pre-existing on base 4a7549b** —
  verified via `git stash`: the live fallback branch now answers 200 with
  real data (`metrics.json` has only `wa_2025`), so remote reads win over
  any local copy and `rs_2024` manifest metrics are absent. Files are
  outside this unit's scope — flagging for the conductor (either
  ee-metrics.test.ts needs staging, or the remote fixture needs an
  rs_2024 entry).
- `bun test src/lib/data.test.ts src/lib/contract.test.ts` — 54 pass /
  0 fail.
- `bunx tsc --noEmit -p tsconfig.json` — clean (base TS2304 codegen noise
  absent on this worktree; no new errors).
- `bun run lint --quiet` — exit 0.
- No `bun run build`; no `public/data` edits; not pushed.
