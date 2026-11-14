# implement-contractfix — N3 + S5 (app contract surface)

Unit: audit N3 + S5, ruling A10. Branch `unit/contractfix`.

## Changes

### Task 1 — N3 percent edge (`src/lib/contract.ts`, `contract.test.ts`)
- `pct()` now `n >= 1 ? n / 100 : n` (was `n > 1`), so an authored 0-100 value
  of exactly `1` normalizes to `0.01` (1%), not `1` (100%). Comment updated:
  `*_pct` is authored 0-100; only `< 1` gets the 0-1 tolerance.
- `contract.test.ts`: new regression test "percent edge: values >= 1 read as
  the 0-100 scale" asserting `0 -> 0`, `0.99 -> 0.99`, `1 -> 0.01`,
  `50 -> 0.5`, `100 -> 1`. Updated the old "0-1 pass through" test which
  asserted `cloud_pct: 1 -> 1` — semantically wrong under the 0-100 authoring
  convention; it now uses `0.5 -> 0.5`.

### Task 2 — S5 surface class cuts / now bounds / reference date (A10)
- `src/lib/contract.ts`: exported `TPI_CUTS = [0.2, 0.4, 0.6] as const` —
  the single place the class-cut literal lives. Exported `FORECAST_DAY_RE`
  (was module-private) so `data.ts` reuses the forecast-day rule.
- `src/lib/types.ts`:
  - `ManifestCase.tpi_cuts?: number[]` and `EventManifest.tpi_cuts?: number[]`
    (v4 case-node override key).
  - `ManifestLayer.forecast?: boolean` (was only on `NowLayer`; needed to
    pick the latest *non-forecast* layer date on merged manifests).
  - `CaseBundle.bbox` stays non-null `[w,s,e,n]` (revised after lead review —
    nullable broke 12 front sites). `CaseBundle.reference_date` is optional
    (`string | undefined`) — absent only when the case ships none of the
    fallback sources.
- `src/lib/tpi.ts`: `TPI_CLASSES`/`TPI_THRESHOLD` now derive from `TPI_CUTS`
  (import from contract.ts). Same exported names and values; class metadata
  (key/label/color/opacity) kept in a `TPI_CLASS_META` table. `ee-numbers.ts`
  import of `TPI_THRESHOLD` unaffected (= 0.6); `ee-tiles.ts` slice of
  `TPI_CLASSES` unaffected.
- `src/lib/data.ts`:
  - `getCaseBundle(id, title, bbox?, reference_date?, opts?)` — `bbox` and
    `reference_date` optional (existing callers unchanged).
  - `bundle.bbox = manifest.bounds ?? bbox ?? events.json entry bbox`; when
    nothing supplies bounds it throws `data: bounds for <id> not found` —
    `bounds` is a required contract field, so a bound-less case is a contract
    violation (same spirit as `must` on required files).
  - `bundle.reference_date` derivation chain: caller arg ??
    `manifest.updated_at.slice(0,10)` ?? `data_dates.observed` (sliced to 10)
    ?? latest non-forecast `layers[].date` (forecast = `forecast: true`, or
    `_d[1-3]` id when the flag is absent) ?? `series.reference_date` ??
    `events.json` entry matching `event_id`/`id` -> `reference_date`.
  - `tpiCuts` surfaced on `LoadedCaseBundle` (`manifest.tpi_cuts ?? TPI_CUTS`);
    `tpi_cuts` carried through the merged `EventManifest` for both the `now`
    node and replay nodes.
  - GEE `numbers` query date now uses the derived `referenceDate`; the
    `livePending` kick moved after the product `Promise.all` so it can see
    `series.reference_date`. `numbers` is skipped when no date derives.
  - `nowSeriesFromLayers` accepts an optional reference_date; last fallback
    is the latest layer date.
- `src/lib/data.test.ts`: new describe "contract-derived bbox /
  reference_date / tpiCuts" — omitted args derive bbox from case-node bounds
  and reference_date from `entry.updated_at`; without any `updated_at` it
  falls to the latest non-forecast layer date (a forecast `d1` layer's later
  date must not win); `tpi_cuts: [0.1,0.5,0.9]` on the case node overrides
  the default.
- `docs/app-contract.md`: documented `tpi_cuts` (optional key, default,
  `bundle.tpiCuts`), the bbox/reference_date derivation order with the "do
  not hard-code" rule, and the `>= 1` percent boundary.

### Scope add — optional MetricsV4 analysis keys (lead request)

- `MetricsV4` gains `swath_coverage_pct?` (added to `PCT_KEYS` → normalizes
  to 0-1), `flooded_km2_scope?: string`, `flood_top_clusters?: {area_km2,
  lat, lon, where?}[]`, `hand_validation_radii?: Record<string, number>`
  (radius_m → iou), `hand_best_radius_m?: number` — all optional,
  passthrough, absent-safe.
- `contract.test.ts`: new test covering normalization of
  `swath_coverage_pct` and passthrough/absence of the rest.
- `docs/app-contract.md`: one-line optional-keys note under metrics.json.

## Commands run

- `bun install` (worktree had no node_modules — first `bun test` failed on
  missing deps, unrelated to the change).
- `bun test` — 323 pass, 6 skip (live GEE smoke), 0 fail.
- `bun run lint --quiet` — exit 0.
- `bunx tsc --noEmit -p tsconfig.json` — 5 errors, all pre-existing on main:
  2 TS2304 codegen noise (RouteContext/LayoutProps) + 3 TS2339 in
  `src/lib/ee-metrics.ts` (verified: file and its ee-* deps are identical to
  `main`; errors reproduce with my changes stashed).
- `bun run build` NOT run (prebuild sync:data would touch public/data).

## Notes for lead

- `CaseBundle.bbox` kept non-null: the `| null` widening type-broke 12 front
  sites (Dashboard/MapLayers/RadarTab). Resolution order is now
  manifest.bounds ?? arg ?? events.json `bbox` ?? throw. `reference_date`
  stays optional — zero front errors.
- Front still passes literal args (lead-front's scope); the bundle now works
  with them omitted.
- `reference_date` is never undefined on today's data (manifests always carry
  `updated_at` or layer dates).
