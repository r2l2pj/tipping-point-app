# u12-metrics implementation

## Scope and changes

Branch: `unit/u12-metrics`. Starting HEAD was `9ed2126` (already included requested base `95cf616`). No existing files changed; no dependencies added; no credentials accessed; no push.

- `src/lib/ee-metrics.ts`: injectable structural EE service reads `${eeAssetRoot()}/${canonicalCaseId(caseId)}/metrics` image properties using shared `imageInfo`, `withTimeout`, and compute-error mapping. Exactly nine numeric validation keys plus `flood_source` are whitelisted. Numbers are not normalized; absent metrics stay absent. Required string timestamps are echoed; malformed missing timestamps fail as 502. Default service uses `earthEngine()` and checks the credential env chain. Timeout defaults to 8 seconds and honors `GEE_TIMEOUT_MS`.
- Module-level canonical-keyed cache stores successful payloads for ten minutes and typed 404/timeout failures for thirty seconds; 502 failures are not cached. The requested case is attached after cache lookup so aliases share reads without returning a previous caller's id.
- `src/app/api/metrics/route.ts`: GET query validation and 400/503/404/502/200 mappings.
- `src/lib/ee-metrics.test.ts`: 17 fake-EE tests cover required HTTP paths, exact response whitelist, absent keys, numeric passthrough, null/string flood sources, dates, canonical assets, alias cache sharing, both credential env names, TTL expiry, typed negative caching, noncached compute errors, synchronous image errors, and timeout env configuration.

## Commands and results

Verification ran against starting SHA `9ed2126` plus the three new staged source/test files committed with this report.

1. `bun install --frozen-lockfile` — exit 0, 762 packages installed; package manifests and lockfile untouched.
2. Read Next 16 route-handler guide and requested EE/contract/types reference files before implementation.
3. `todo log` — logging on; added the requested implementation item through `todo add`.
4. `bun test` — exit 0:
   ```text
   212 pass
   0 fail
   592 expect() calls
   Ran 212 tests across 14 files.
   ```
   This is the baseline 195 tests plus 17 metrics tests. All EE metrics tests use fakes, never real credentials.
5. `bun run build` — exit 0:
   ```text
   sync-data: .../tipping-point-app-wt/tipping-point-data/data not found — skipping (set DATA_REPO to override)
   Compiled successfully
   Finished TypeScript
   Generating static pages ... (12/12)
   ƒ /api/metrics
   ```
   The worktree sync-data warning/skip is expected.
6. `bun run lint src/lib/ee-metrics.ts src/lib/ee-metrics.test.ts src/app/api/metrics/route.ts` — exit 0, no warnings or errors.
7. `bun run lint` — exit 0, 0 errors and 1100 pre-existing warnings confined to `public/maplibre-gl-worker.js` and `src/types/earthengine.d.ts`; neither was changed.
8. `git diff --check` and `git diff --cached --check` — exit 0; no whitespace errors.
9. Reviewed staged scope/stat: only the three allowed new code/test files, plus this report for the commit.

## Limitations

Live EE asset access remains credential-blocked as specified. HTTP status behavior is exercised through the real route handler with injected fake EE services. No browser evidence is needed for this API-only unit.
