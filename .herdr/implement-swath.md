# Swath implementation

Branch unit/swath, based on origin/main at 0d7b80ec7c8a2bb76b87352bfa747e27a82d7c1b. Changes were verified on the working tree committed immediately after this report.

Production change is limited to src/components/tabs/RadarTab.tsx. A shared flooded-card wrapper displays `within the NISAR swath — X% of the area covered` directly below either NISAR or reference StatCard, using text-xs text-zinc-500. Exact scope string plus finite numeric coverage are required. Coverage <=1 is multiplied by 100, otherwise used directly, then rounded to a whole percent. Absent flooded cards never show the line.

Tests added in src/components/tabs/tabs.test.tsx cover both card variants, fraction/percentage inputs, rounding, absent scope, absent coverage, NaN, Infinity, string input and absent card.

Commands/results:
- Before production edit: `bun test src/components/tabs`: exit 1, 25 pass / 1 fail; expected `within the NISAR swath — 43% of the area covered` was absent from rendered markup.
- `bunx eslint src/components/tabs/RadarTab.tsx src/components/tabs/tabs.test.tsx`: exit 0, no diagnostics.
- `bun test src/components/tabs`: exit 0, 26 pass / 0 fail, 115 assertions.
- `bun test`: exit 0, 335 pass / 6 skip / 0 fail, 1054 assertions. Six live GEE smoke tests skipped.
- First `bun run build` found TS2322 in the new test fixture: union of empty object and dates inferred optional undefined keys incompatible with DataDates. Replaced empty object with explicit null pre/post dates.
- Re-ran scoped eslint and tab tests after fixture correction: exit 0.
- Final `bun run build`: exit 0; compiled, TypeScript passed, generated 14/14 pages. Prebuild data sync skipped due to missing sibling tipping-point-data/data, as on cuts.
- `git diff --check`: exit 0.

No browser verification performed. No unrelated source files changed.
