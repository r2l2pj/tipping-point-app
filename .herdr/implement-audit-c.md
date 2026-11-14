# audit-c implementation

Base SHA: 50882d5 (branch unit/u-c). Verification ran against this base plus the scoped working-tree diff committed with this report.

## Changes

- S14: AlertTab derives reached/watch from bundle.series.days[dayIndex].tpi, not the presence of critical zones. Uses finite series.tpi_threshold first, otherwise cutsFor(bundle)[2]. Missing series/day safely shows watch. Dashboard -> SidePanel -> AlertTab already passed dayIndex, so those files were left unchanged.
- S5: Added defensive cutsFor(bundle), preferring classCuts, then manifest.tpi_cuts, then manifest.classes; rejects malformed, nonfinite, out-of-range or unordered cuts and defaults to [0.2, 0.4, 0.6]. Supports numeric tuples and four class rows with min values. tpiClass accepts the optional bundle and returns contract-derived boundaries. AlertTab uses the resolved threshold for critical totals and its displayed priority-zone cutoff.
- S5: DashboardLoader overrides the initial live bbox with now.manifest.bounds when provided; preserves manifest.updated_at reference-date derivation.
- N5: Alerts page and NisarPassList import layers.ts fmtDate directly. Removed the UTC implementation from tpi.ts, retaining a compatibility re-export of the existing canonical BRT-aware implementation. layers.ts already exports the needed helper, so it was not modified.
- Tests added for selected playback day, equality/rewind/missing data, custom cut fallback and priority label, cut validation/precedence, and date-only/BRT timestamp behavior.
- No footer, toggle-layer logic, or files outside the authorized code/test scope were changed.

## Commands and results

1. `bun install`: exit 0; 762 packages installed; no lockfile diff.
2. Before implementation, `bun test src/components/tabs/tabs.test.tsx`: exit 1, `SyntaxError: Export named 'cutsFor' not found` (new regression tests first).
3. After implementation, `bun test src/components/tabs/tabs.test.tsx`: exit 0, `21 pass`, `0 fail`.
4. `bunx eslint src/app/page.tsx src/app/alerts/page.tsx src/lib/tpi.ts src/components/tabs/AlertTab.tsx src/components/tabs/NisarPassList.tsx src/components/tabs/tabs.test.tsx`: exit 0, no diagnostics.
5. `bun test`: exit 0, `322 pass`, `6 skip`, `0 fail`, `996 expect() calls`, `Ran 328 tests across 19 files`. Six skipped tests are live GEE smoke checks requiring credentials. Full command output: /tmp/devin-overflows-1000/shell-126f1f-06757ed2f4896551/content.txt.
6. `bun run build`: exit 0; `Compiled successfully in 17.1s`, TypeScript finished, all 14 static pages generated. Prebuild sync reported absent sibling data repo and skipped as designed; build used existing bundled data. Routes / and /alerts generated successfully.
7. `git diff --check`: exit 0, no whitespace errors.

## Canonical contract follow-up

On base 56e2e7e, lead-integration pinned bundle.tpiCuts as the normalized field. cutsFor now prefers tpiCuts > classCuts > manifest.tpi_cuts > manifest.classes > defaults. Added regression assertions for normalized-field precedence and malformed normalized-field fallback.

- Before the one-line fix: `bun test src/components/tabs/tabs.test.tsx` failed at line 91: expected [0.15, 0.45, 0.85], received [0.1, 0.3, 0.8] (20 pass, 1 fail).
- After fix: `bun test src/components/tabs/tabs.test.tsx` passed (21 pass, 0 fail, 95 assertions).
- `bunx eslint src/lib/tpi.ts src/components/tabs/tabs.test.tsx` and `git diff --check` exited 0 without diagnostics.
- Full suite/build evidence above is from the initial implementation; the follow-up only adds the normalized candidate and precedence assertions.

## Integration note

The scoped branch currently has no declared classCuts/tpi_cuts fields in CaseBundle/EventManifest and no loader normalization for them. cutsFor accepts unknown input defensively to remain compatible with the parallel integration contract work without changing out-of-scope types/data files. Lead t68 was notified of supported input shapes. Other class consumers (Dashboard footer, map legends/styles) were deliberately not widened into this unit.
