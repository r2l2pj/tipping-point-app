# floodsrc implementation

Status: complete, including the conductor-authorized one-line scope extension described below. Full suite and production build now pass. No model switch.

Branch: unit/floodsrc. Verification ran on base SHA 95cf6166c90944476cfa21ba7257ee751e4e8ce6 plus the changes committed with this report.

## Changes

- src/lib/contract.ts: export FloodSource = "nisar" | "opera" | "observed"; add optional MetricsV4.flood_source. Flat spread preserves attribution; legacy branch remains unchanged and makes no source claim. English perfect-forecast label is exactly "perfect forecast"; GEOS-FP unchanged.
- src/lib/contract.test.ts: cover all three sources, absent/null passthrough, legacy source omission (including a mixed payload), and all five percent normalizations without touching attribution; update both English label assertions.
- public/data/metrics.json: only add rs_2024.flood_source = "opera" and wa_2025.flood_source = "nisar"; no existing values changed.
- docs/app-contract.md: document pipeline ownership, sensor meanings for flooded_km2/people_flooded, null/absent behavior, legacy behavior, and the strict NISAR UI-label gate. Align forecast label documentation.
- test/fixtures/metrics.v4.json does not exist; no fixture changed.

## Commands and results

- `pwd && git status --short && git branch --show-current && todo log && ls .herdr`: correct worktree, initially clean, branch unit/floodsrc, logging on.
- `todo add "Add flood_source contract attribution and English forecast label; verify tests and lint"`: request logged; left open because full-suite proof is blocked.
- `bun test src/lib/contract.test.ts` before implementation: 25 pass, 1 fail; expected "perfect forecast", received "previsão perfeita". Attribution tests already passed because flat spread/legacy omission already have the desired runtime semantics.
- `bun test` after implementation: 197 pass, 1 fail, 563 expect() calls, 198 tests across 13 files. Failure: src/components/tabs/tabs.test.tsx:150, alert tab forecast_source badge test expects "previsão perfeita" but rendering correctly contains "perfect forecast". This file is OUTSIDE the assigned scope and was not edited. Full-suite-green requirement is NOT met.
- `bun run lint`: exit 0; `1100 problems (0 errors, 1100 warnings)`. Warnings are in untouched public/maplibre-gl-worker.js and src/types/earthengine.d.ts.
- `git diff --check && git diff && git log -5 --oneline && git rev-parse HEAD`: exit 0; reviewed all changes, no whitespace errors; only four assigned source/data/docs files changed before this report.
- `bun test src/lib/contract.test.ts` final targeted verification: 26 pass, 0 fail, 92 expect() calls, 26 tests across 1 file.
- `hc send t6b ...`: blocker reported to lead-integration; delivered successfully.

## Authorized follow-up — resolved

After initial commit 151c1d4, t6b relayed conductor authorization to change exactly one line in src/components/tabs/tabs.test.tsx:150. Changed only `expect(replay).toContain("previsão perfeita")` to `expect(replay).toContain("perfect forecast")`. Nothing else in that file changed. This follow-up is committed separately rather than rewriting history.

Verification ran on SHA 151c1d4 plus the authorized one-line assertion patch (the code tree of this follow-up commit):

- `bun test`: exit 0; `198 pass`, `0 fail`, `564 expect() calls`, `Ran 198 tests across 13 files.`
- `bun run build`: exit 0. Prebuild sync skipped because the sibling tipping-point-data/data directory was absent (no data overwritten). `Compiled successfully in 12.9s`; `Finished TypeScript in 3.5s`; `Generating static pages ... (11/11)` completed; route table emitted.
- Lint evidence remains the successful `bun run lint` above: 0 errors. The only subsequent code change is the authorized test assertion string.

No dependency, UI implementation, or numeric field rename changes. The full-suite blocker is resolved.
