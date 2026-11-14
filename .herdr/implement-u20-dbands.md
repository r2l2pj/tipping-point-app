# u20-dbands implementation

Branch: unit/u20-dbands. Base tested: 2746e35 (working-tree changes committed with this report).

## Changes

- Accept dYYYYMMDD window-end date bands alongside YYYY-MM-DD and YYYYMMDD in tile selection, point sampling, TPI numbers selection, and optional flood numbers selection.
- Preserve existing matching precedence and single-band fallbacks. Manifest dates are not band IDs and remain unchanged.
- Update band-naming comments to document all three forms and window-end semantics.
- Add fake-EE regression tests using d20240421/d20240422 and query 2024-04-22. Assert selected band and getMapId, point reduceRegion sampling, and computed TPI/flood reductions and returned values.
- No dependencies added; only the six assigned code/test paths and this report changed.

## Commands and results

- `bun install --frozen-lockfile`: exit 0; 780 packages installed.
- `bun test src/lib/ee-tiles.test.ts src/lib/ee-point.test.ts src/lib/ee-numbers.test.ts --test-name-pattern 'dYYYYMMDD'` BEFORE resolver changes: exit 1; 0 pass, 3 fail. Tiles and numbers threw missing-band errors; point returned null instead of 0.42.
- `bun test` AFTER resolver changes: exit 0; 376 pass, 7 skip, 0 fail, 1191 expect calls; 383 tests across 20 files. Skips are six credential-gated GEE smoke tests and one DATABASE_URL-gated live Neon test. All three new regression tests passed.
- `bun run build`: exit 0; Next.js 16.4.6 compiled successfully, TypeScript passed, 14/14 static pages generated. Prebuild sync skipped the absent sibling data repository as designed.
- `bun run lint src/lib/ee-tiles.ts src/lib/ee-point.ts src/lib/ee-numbers.ts src/lib/ee-tiles.test.ts src/lib/ee-point.test.ts src/lib/ee-numbers.test.ts`: exit 0; no warnings or errors.
- `git diff --check`: exit 0.
- `git diff --stat`, `git diff -- src/lib/ee-tiles.ts src/lib/ee-point.ts src/lib/ee-numbers.ts`, `git log -5 --oneline`, `git status --short --branch`: inspected scope, implementation, commit conventions, and branch state.

No live GEE claim is made: behavioral proof uses the requested fake-EE suites.

## Follow-up: bound computed reductions

Base: 331add9; follow-up working tree committed with this report update.

Lead reported a real-EE failure aggregating an unbounded image without geometry. Updated only ee-numbers.ts and its test file (plus this evidence report):

- Retain the complete case entry from the root manifest lookup, including bounds, using the existing canonical/event/alias resolution.
- Construct ee.Geometry.Rectangle from case bounds [west, south, east, north] once and pass the same geometry to every TPI/flood area/population reduceRegion call.
- Add the minimal Geometry.Rectangle seam and a bounds override for injected test services. Reject missing/nonfinite/unordered bounds instead of issuing unbounded reductions. The properties fast path does not require geometry.
- Add a fake-EE test exercising the default root-manifest lookup with the hyphenated case query. It asserts the rs_2024 bounds [-52.5, -30.5, -50.5, -29] reach Rectangle and all four reduceRegion calls.

Follow-up verification:

- `bun install --frozen-lockfile`: exit 0; checked 836 installs across 874 packages, no changes.
- `bun test src/lib/ee-numbers.test.ts --test-name-pattern 'manifest case rectangle'` before the fix: exit 1, 0 pass / 1 fail; recorded reduceRegion params lacked geometry and no Rectangle call occurred.
- `bun test src/lib/ee-numbers.test.ts` after fix: exit 0; 21 pass, 0 fail, 57 expect calls.
- `bun test`: exit 0; 377 pass, 7 environment-gated skips, 0 fail, 1197 expect calls; 384 tests across 20 files.
- `bun run build`: exit 0; compiled successfully, TypeScript passed, 14/14 pages generated. Missing sibling-data sync skipped as designed.
- `bun run lint src/lib/ee-numbers.ts src/lib/ee-numbers.test.ts`: exit 0; clean.
- `git diff --check`: exit 0. `git diff --stat` and `git status --short --branch` confirmed the scoped source/test changes on unit/u20-dbands.

No live-EE rerun was performed in this worker; the lead owns the real-project verification.

## Follow-up 2: explicit getMapId parameters

Base: 1f7a849; follow-up working tree committed with this report update.

- Change tile wrapper to `img.getMapId({}, callback)` so the callback is not consumed as the params argument.
- Fake getMapId now takes params as its first argument and callback only as its second argument; callback-only calls do not fire, reproducing the reported SDK behavior.
- Add a regression test asserting explicit empty params and successful tile output. Update the d-band test to assert the same signature.
- Audit of all src/lib/ee-*.ts found only this one getMapId call, no evaluate calls, and callback-only getInfo calls in ee-numbers, ee-shared, and ee-layers. Those getInfo calls remain unchanged per the lead's live verification. The existing Earth Engine declaration already supports the params-plus-callback overload.

Commands and results:

- `bun install --frozen-lockfile`: exit 0; checked 836 installs across 874 packages, no changes.
- `bun test src/lib/ee-tiles.test.ts --test-name-pattern 'getMapId receives explicit params'` before wrapper fix: exit 1, 0 pass / 1 fail; `timeout after 20ms waiting for getMapId on root/rs_2024/tpi_slide_series`.
- `bun test` after wrapper fix: exit 0; 378 pass, 7 environment-gated skips, 0 fail; 1199 expect calls; 385 tests across 20 files.
- `bun run build`: exit 0; compiled successfully, TypeScript passed, 14/14 pages generated. Missing sibling-data sync skipped as designed.
- `bun run lint src/lib/ee-tiles.ts src/lib/ee-tiles.test.ts`: exit 0; no warnings/errors.
- `git diff --check`: exit 0; inspected diff and scoped status before commit.

Only ee-tiles.ts, its tests, and this report changed in follow-up 2. Live verification remains with the lead.
