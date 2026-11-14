# u21-layerdates

## Change
`src/lib/ee-layers.ts`: `normalizeBandDate` now accepts `dYYYYMMDD` in addition
to `YYYYMMDD` — regex `/^d?\d{8}$/` matches both forms and the last 8 digits are
sliced into `YYYY-MM-DD`. `YYYY-MM-DD` and anything else still pass through.
Both call sites (probed-meta `toLayerMeta` and the declared-fallback
`dates: [normalizeBandDate(d.date)]`) get the fix automatically since they
already route through the normalizer. Comment updated to name all three input
forms.

`src/lib/ee-layers.test.ts`: added "dYYYYMMDD band ids normalize to sorted
YYYY-MM-DD" — fake-ee series asset with bands `d20251201`, `d20251130` asserts
`meta.dates === ['2025-11-30', '2025-12-01']`.

## Commands & results
- `bun install --frozen-lockfile` — 780 packages installed, clean.
- `bun test` — 379 pass, 7 skip (live smoke), 0 fail across 20 files.
- `bun run build` — Next 16.4.6 Turbopack build green, TypeScript clean,
  14/14 static pages generated.
- `bun run lint` / `npx eslint src/lib/ee-layers.ts src/lib/ee-layers.test.ts` —
  0 errors; the two touched files produce no warnings (repo-wide warnings are
  pre-existing elsewhere).

## Commit
`25db6c7` on `unit/u21-layerdates` — only the two in-scope files committed.
Not pushed.
