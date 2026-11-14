# U6 — side panel + charts on v4 metrics

## What changed

`src/components/SidePanel.tsx` is now only the tab-nav shell — same props,
still exports `TabKey = "alert" | "radar" | "validation" | "impact"`
(Dashboard.tsx untouched and compiling). Tab bodies moved under
`src/components/tabs/`; all metric reads go through `bundle.metricsView`
(0-1 percents rendered via `fmtPct`).

- `tabs/Stat.tsx` — shared `Stat` / `StatCard`.
- `tabs/format.ts` — private `fmtBrt` (America/Sao_Paulo wall time for live
  timestamps), `fmtHours` (integer "N h"), `isMockDerived` (fallback flag or
  neither metricsView nor summary). `bundle.fallback` isn't on `CaseBundle`
  in this base yet (sibling unit owns types.ts) — read via an intersection
  cast so it activates when it lands.
- `tabs/AlertTab.tsx` — banner + TpiChart + priority zones kept; "Illustrative
  demo data" only when `isMockDerived`; forecast_source badge via
  `forecastSourceLabel(manifest?.forecast_source ?? summary?.forecast_source)`;
  live mode mounts `AgoraSources`.
- `tabs/AgoraSources.tsx` — live card: summary `critical_km2.any/slide/flood`,
  `people_critical ?? people_exposed`, `classes_km2` rows, source badge,
  per-source `data_dates` in BRT (summary data_dates merged over bundle's),
  `nisar_passes` list.
- `tabs/RadarTab.tsx` — `flooded_km2` (blue), `scars.features.length` as
  "Landslide scar candidates (HLS optical)" + "candidates, never confirmed",
  minimal before/after placeholder (real swipe is U5b), the declared-limitation
  note card, `NisarPassList` from `data_dates.nisar_passes`.
- `tabs/ValidationTab.tsx` — nav label "Acertamos?"; IoU/F1 2-dec,
  landslide_hit_pct, hand_validation, "learned vs manual slope rule"
  (rf_auc vs rule_auc), mean+median lead hours (integer), warned_before_pct,
  optical-visible share (`round((1-cloud_pct)*100)` → "the optical saw only
  X%"), "no cloud pixels" note, FeatureImportanceChart, SwotChart.
- `tabs/ImpactTab.tsx` — people_critical, people_flooded, flooded_km2,
  night_light_drop_pct; "GPW v4 (NASA SEDAC)"; no "WorldPop" anywhere.
- `tabs/NisarPassList.tsx` — extracted pass list.
- `charts/FeatureImportanceChart.tsx` — Record<string,number> → horizontal
  bars, YlOrRd ramp, sorted desc (plain divs, SSR-safe).
- `charts/SwotChart.tsx` — defensive parse of `bundle.swot` (array of
  {date, river_m|value_m|level_m} or {days|points:[...]}) → Recharts line
  #08306B meters; unrecognizable → "No SWOT river data" placeholder.
- `tabs/tabs.test.tsx` — renderToStaticMarkup tests (no new deps).
- `TpiChart.tsx` — all text bumped to >=12px (ticks/labels/tooltip/legend).

All tailwind text >= text-xs; km² 1 decimal, people to hundreds, hours
integer; BRT for live datetimes.

## Commands & results

- `bun install` — clean, 753 packages.
- `bun test src/components/tabs` — 9 pass / 0 fail (optical-saw-5%,
  learned-vs-manual, candidates/never-confirmed, nisar passes, banned-string
  sweep, demo-marker on/off, forecast badge).
- `bun test` — 54 pass / 0 fail.
- `bun run build` — green (sync:data no-ops in worktree: data repo sibling
  path absent; TypeScript step passed).
- `bunx eslint <my files>` — 0 warnings.
- Greps: no `text-[9px|10px|11px]` in my files; `confirmed (scar|landslide)`
  and `WorldPop` appear only inside the test's negative assertions.
- `bunx tsc --noEmit` — 2 errors (`RouteContext`, `LayoutProps` in src/app) —
  verified identical on the base commit via `git stash`; Next 16 typegen
  resolves them during `next build` (which passed).

## Notes

- `bundle.metricsView`/`summary`/`swot`/`scars` aren't populated by data.ts
  on this base — components read them defensively ("—"/placeholders), per
  "code against contract types".
- `data_dates.nisar_pre/nisar_post` used for the minimal before/after line
  when present.
