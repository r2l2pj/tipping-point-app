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
