# L14: honest "pending" states — implement report

Branch: unit/pending. Scope held to the 10 owned files; no changes to
Dashboard/MapLayers/Header/src/lib/public.

## What changed

- **format.ts**: `isMockDerived` no longer fires on `fallback === true`
  (fallback = real last-saved data; L8 banner covers staleness). Kept the
  degenerate `!metricsView && !summary` branch. Added `pendingIncludes(bundle,
  key)` — defensive reader for the new `bundle.pending: string[]` contract
  (tokens 'metrics', 'series', 'summary', 'alerts', 'landslide_candidates',
  'priority_zones', …; CaseBundle type has no `pending` field yet, so it is
  read through a cast).
- **Stat.tsx**: `Stat` and `StatCard` accept `absent?: boolean` — renders
  literal lowercase `pending` in `text-zinc-600` at normal weight instead of
  the value. `fmt*` helpers unchanged ("—" stays for in-sentence use).
- **ImpactTab.tsx**: pending dashed card ("Impact metrics pending" /
  "Exposure metrics are computed per case — none published yet.") when
  `!metricsView || pendingIncludes('metrics')`; Exposure basis box still
  renders. Four StatCards get `absent={m.field == null}`. Footer:
  "Data pending — pipeline output not published." (was "Illustrative demo
  data").
- **ValidationTab.tsx**: whole-section dashed card now also triggers on
  `pending: ['metrics']`. `absent` on IoU/F1/landslide hits/hand validation/
  both AUC cards. Same footer text change.
- **RadarTab.tsx**: flooded card gets `absent` when `hasNisarPair &&
  flooded_km2 == null` (label "Flooded area (NISAR)", confirmation in
  flight); hidden-card case unchanged when no pair. Scar candidates card
  `absent` when `scars == null || pendingIncludes('landslide_candidates')`;
  `features: []` still renders real `0`.
- **AlertTab.tsx**: third neutral banner state — `monitoring = (!series &&
  zones.length === 0) || pending 'series' || pending 'priority_zones'` →
  `border-zinc-700 bg-zinc-900`, "MONITORING PENDING", body naming the missing
  pipeline outputs; critical km²/people stat row hidden entirely. Zones list
  renders "Pending — no monitored zones for this case." row when empty.
  Mock badge text now "Data\npending." WATCH/REACHED logic untouched.
- **LeadTimeCard.tsx**: never returns null — `!m || !finite(median)` renders
  dashed "How early? (in replay)" card with "Lead-time hindcast pending —
  IMERG latency-aware rerun not published for this case." Partial fields keep
  "not reported"; "Illustrative numbers" placeholder note kept (only renders
  on flagged data).
- **AgoraSources.tsx**: summary absent OR `pending: ['summary']` → pending
  line "Live summary pending — awaiting the current run's summary.json."
  inside the Now card. All three SOURCE_LABELS rows always render;
  non-string `dd[key]` → "pending" instead of omission. extraRows unchanged.
- **alerts/page.tsx**: three-state loader — now/ candidates → unchanged;
  alerts.json exists with empty `alerts[]` → "No active alerts…"; getAlerts
  undefined or throws → dashed "Alerts feed pending — the alert pipeline has
  not published for this cycle yet." Footer "· Illustrative demo data"
  removed. `getAlerts` still throws via `must()` today — `.catch(() =>
  undefined)` maps both error and absent to the pending state per contract.
- **tabs.test.tsx**: rewrote the "Illustrative" describe → "Data pending"
  marker tests (incl. fallback-bundle negative); updated two tests broken by
  the neutral state / never-null LeadTimeCard; `render()` helper gained a
  `zones` param. New "pending states (L14)" describe: 8 tests covering
  MONITORING PENDING (absence + both tokens), impact pending card (+token),
  validation per-field pending + real values, radar pending flood card /
  hidden card / scars pending vs real zero, AgoraSources summary + source
  rows, lead-time pending card. Real-value rendering asserted alongside
  every pending path.

## Commands run

- `bun install` — 762 packages, clean.
- `bunx eslint` on all changed files — clean (fixed one
  react/no-unescaped-entities on an apostrophe).
- `bun test` (full) — **350 pass, 0 fail, 6 skip** across 19 files. The 6
  skips are the credential-gated `gee smoke (live)` tests (need GEE
  credentials; unchanged by this diff).
- `bun test src/components/tabs` — 36 pass.
- `bun run build` — clean: compiled, TypeScript passed, 14/14 static pages
  generated (sync-data skipped, no data repo — pre-existing).
- `git diff --check` — clean.

## L18 follow-up

- LeadTimeCard headline "Median N h before mapped landslides" → "Tipping
  Point would have warned N hours earlier" (plural "hours" always, N =
  rounded median). IQR/n/precision line and "in replay" note unchanged.
  Three test assertions updated; full suite re-run: 350 pass / 0 fail.

## Notes

- `bundle.pending` is not yet on the `CaseBundle` type (src/lib is owned by
  lead-integration); `pendingIncludes` reads it defensively so this lands
  either way.
- `CaseBundle.series`/`metricsView`/`summary` still come back undefined when
  absent — absence is the primary trigger everywhere, pending[] corroborates.
