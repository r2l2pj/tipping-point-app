# u13-smoke: implementation report

Branch unit/u13-smoke, base main 8d65729. No new dependencies. No existing files changed.

## Changed
- `src/lib/ee.smoke.test.ts` (new). Live GEE smoke tests that only run when credentials exist.
  - Gate: `HAS_CREDS = Boolean(GCP_SA_KEY || GEE_SERVICE_ACCOUNT_KEY) && Boolean(GEE_PROJECT)`, applied with `test.skipIf(!HAS_CREDS)`. I checked that `typeof test.skipIf === "function"` on Bun 1.4.4.
  - `earthEngine()` is called once per file, wrapped in `withTimeout(..., 30s)` from ee-shared, and the call is memoized. If init hangs or fails, the file costs one 30s wait rather than one per test.
  - Reachability: `imageInfo(ee.Image(...))` on `NASA/NASADEM_HGT/001` and `NASA/GPM_L3/IMERG_V07` must resolve.
  - Service checks: `tolerant()` returns either the result or one of the allowed not-found classes. Any other error is rethrown, so the test fails.
    - tiles: `createTileService(ee).getTiles({layer:"tpi_slide", caseId:"rs_2024", date:"2024-05-01"})`. Passes with 1 tile containing `{z}/{x}/{y}` and a `data_date` key, or with `TileNotFoundError`.
    - layers: `createLayerService(ee, {manifest:null}).probe(canonicalCaseId("rs_2024"))`. Passes when every meta has a string `id` and a `dates` array, or with `LayersUnavailableError` / `TileNotFoundError`.
    - numbers: `createNumbersService(ee).getNumbers({caseId, date})`. Passes with at least 1 finite numeric field, or with `NumbersNotFoundError`.
    - metrics: `createMetricsService(ee).getMetrics({caseId})`. Passes with a `metrics` object and a string `data_date`, or with `MetricsNotFoundError`.
  - Each service prints one line saying which branch ran. The only values printed are band counts, layer ids, `source` and the metric key count. No env values are printed anywhere.
  - A `# how to run:` comment block is at the bottom, using a placeholder key.

## Commands and results
- `bun install --frozen-lockfile`: 762 packages, ok.
- `bun test` (full suite): **219 pass, 6 skip, 0 fail**, 225 tests across 15 files.
- `bun test src/lib/ee.smoke.test.ts` without creds: 0 pass, **6 skip**, 0 fail. All 6 show as `(skip)`.
- Negative check that skipped tests don't silently pass: `GCP_SA_KEY='{}' GEE_PROJECT=dummy bun test src/lib/ee.smoke.test.ts` gives 0 pass, **6 fail**, in 30.4s total because of the memoized init.
- `bunx eslint src/lib/ee.smoke.test.ts`: clean, no output. `bun run lint` gives 0 errors and 1100 warnings, all from existing files.
- `bunx tsc --noEmit -p .`: no errors in ee.smoke.test.ts.

## Caveats
- `TileNotFoundError` comes from EE messages matching `NOT_FOUND_RE`. EE's permission-denied text ("does not exist or caller does not have access") matches it too. So a missing role on the *project* assets can look like "not ingested yet". The two public-catalog reachability tests are what catch permission and role outages.
- `LayersUnavailableError` is tolerated because the brief asked for it. In the code it means no probed layer answered, i.e. outage or timeout. Missing assets come back as `[]` instead. Consider dropping that class from the allowed list once assets are ingested.
- Live run not done: no credentials are present here.

## How to run
`GCP_SA_KEY="$(cat key.json)" GEE_PROJECT=hermes-fesolucoes bun test src/lib/ee.smoke.test.ts`
