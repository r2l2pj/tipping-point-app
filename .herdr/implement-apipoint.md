# L10d implementation

Commit: `9311163` — `L10d: popup prefers /api/point GEE read, COG as fallback`.

## Changes

Only the three owned source files changed:
- `src/lib/layers.ts`: resolvePixelValues requests `/api/point` first when caseId/date exist, validates all six nullable numeric fields, selects hazard-specific TPI and terrain (terrain falls back to the other hazard), and returns authoritative GEE values even when all null. Non-OK responses, network exceptions, invalid JSON and malformed values fall through to the unchanged COG/estimate path. Results carry optional gee/cog provenance; no COG or failed TPI still returns null.
- `src/components/MapLayers.tsx`: passes canonical case directory and active hazard, labels GEE/COG/day estimates honestly, and formats null numeric fields as `no data`, including absent TPI risk. Download COG link logic is unchanged.
- `src/lib/layers.test.ts`: restores fetch after each test; covers slide/flood/unknown hazard, query parameters, all-null authority, alternate terrain, 404/503/network/malformed JSON/malformed values fallback against a real local range-serving COG, skipped endpoint without case/date, and no-COG null behavior.

## Commands and results

Commands ran on the working tree based on `0461363`; the resulting tested source is committed unchanged as `9311163`.

- `bun install`: exit 0; 762 packages installed; no dependency or lockfile changes.
- `bun test src/lib/layers.test.ts` before resolver implementation: **24 pass, 10 fail**. New authoritative-GEE tests received null; fallback tests lacked cog provenance. This demonstrates the previously missing behavior.
- `bun test src/lib/layers.test.ts` after implementation/final test refinement: **34 pass, 0 fail, 86 expect() calls**.
- `bunx eslint src/lib/layers.ts src/lib/layers.test.ts src/components/MapLayers.tsx`: exit 0, no output (also rerun after final refinement).
- Initial `bunx tsc --noEmit`: exit 2, missing generated `RouteContext` in `src/app/api/events/[id]/manifest/route.ts` and `LayoutProps` in `src/app/layout.tsx`; neither file is owned or changed here.
- `bun test`: **257 pass, 6 skip, 0 fail, 759 expect() calls**, 263 tests across 16 files. Six live GEE smoke tests skipped because service-account/project credentials were not set.
- `bun run build`: exit 0; `Compiled successfully`, TypeScript finished, **13/13 static pages generated**. Prebuild sync reported sibling data repo absent and skipped (its existing behavior). `/api/point` is not present yet in this branch's route table; lead-back owns that endpoint and must integrate it.
- Post-build `bunx tsc --noEmit`: exit 0, no errors; Next build supplied the missing generated globals.
- `git diff --check`: exit 0.
- `git status --short` before commit: only the three owned files modified.
- `git log -4 --oneline`: inspected existing commit style.
- `git add src/lib/layers.ts src/lib/layers.test.ts src/components/MapLayers.tsx` and requested `git commit`: exit 0, commit `9311163`, three files / 141 insertions / 11 deletions.

Read the installed Next client-side data-fetching guide before coding. No browser/live GEE claim is made: endpoint handling is proven hermetically; the endpoint itself is another unit. No new dependencies, no push, no changes outside owned source scope other than this requested report.
