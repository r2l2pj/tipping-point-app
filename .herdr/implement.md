# L52 WA — merged "forecast + NISAR" replay view (re-scoped)

Re-scope per lead-app 15:1x: NOT a separate one-tap view — merge forecast +
NISAR into the normal case view for replays that ship the NISAR flood
outlines (WA 2025; Uruguaiana when its flood carries a pass date). The
'forecast-nisar' view/deep link was dropped (all that code reverted;
`?view=` stays unparsed). Radar swipe ('Before / after') untouched.

## What changed

- `src/components/command/model/steps.ts` — three new helpers:
  - `floodPostDate(bundle)` — the post-pass day: the `nisar_post` /
    `radar_post` manifest layer `date`, else `data_dates.nisar_post` /
    `radar_post` (string values only).
  - `floodShownOn(bundle, date)` — replay with a post date: outlines only
    on/after it. Live cases, missing dates, or missing post → unchanged.
  - `floodCaptionNote(bundle, date, on)` — ` · NISAR flood outlines (pass
    <Mon D>)` while the flood layer is on and the shown day is ≥ the pass.
- `src/components/command/model/layerRegistry.ts` — `defaultLayersFor`: a
  replay that ships the NISAR flood outlines (flood product + published
  pass date) opens `['tpi','flood']`; live/ptrigger logic unchanged; other
  replays keep `['tpi']`.
- `src/components/command/state.ts` — `selectCase`: same merged default on
  a case change into such a replay (`replayMix`). `initialState` and `goTo`
  already go through `defaultLayersFor`; `?layers=`/`?lead=`/`?compare=` /
  `?case=`/`?day=`/`?fit=`/`?basemap=`/`?city=` deep links unchanged
  (`?layers=` still wins over the default).
- `src/components/MapLayers.tsx` — `wantFlood = overlay.flood &&
  floodShownOn(bundle, frameDate)`: before the pass the geojson isn't
  fetched and `floodFill/floodLine/floodDot` stay hidden; from the pass day
  on the outlines draw on top (layer order already had flood above
  `tpiRaster` — inserted before `waterFill`, flood below nothing extra).
- `src/components/command/MapStage.tsx` — the map caption appends
  `captionNote` (` · NISAR flood outlines (pass Dec 16, 2025)` on WA) only
  while the outlines are actually on screen. No numbers, no hit/miss claim.
- `src/components/command/model/floodPost.test.ts` (new, 15 tests):
  floodPostDate (layer date / data_dates / absent), floodShownOn
  (before/on/after, no-post, live, no date), floodCaptionNote (on/quiet
  cases), defaultLayersFor (merged / no-flood / no-pass-date / live ML),
  state (initial `['tpi','flood']`, `?layers=` wins, selectCase & goTo).

## Commands run (memory-capped)

```
B=$HOME/.local/share/mise/installs/bun/1.4.4/bin/bun
systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=1G \
  --working-directory=$PWD -E PATH=$PATH -E TMPDIR=$HOME/.cache/lead-app/tmp
```

- `$B test` (full suite): **821 pass / 0 fail / 17 skip** (was 791 on my
  previous run; +13 new tests here, +others from the rebase).
- `$B x tsc --noEmit -p .`: clean except 2 pre-existing errors in untouched
  files: `src/app/api/events/[id]/manifest/route.ts` (RouteContext),
  `src/app/layout.tsx` (LayoutProps).
- `$B x eslint src/components`: 0 errors, 4 warnings — all pre-existing
  (unused ProbHorizon/tag/DEFAULT_LAYERS, loading.current cleanup).

## Notes for the browser check

- `wa_2025` qualifies: `nisar_post` layer date `2025-12-16` +
  `flood_confirmed` product → opens `['tpi','flood']`; days before Dec 16
  show no outlines, Dec 16+ shows them over the day's TPI/GFS frame;
  caption gets ` · NISAR flood outlines (pass Dec 16, 2025)`.
- `rs_2024` has no flood product → unchanged. `now` is live → unchanged.
- Uruguaiana (`rs_uruguai_2026`) isn't in the local manifest; if its flood
  product publishes `nisar_post`/`radar_post` (layer date or data_dates)
  it gets the same behavior automatically.
- The 'Forecast issued this day' +1 d chips still switch the TPI frame to
  the issued GFS run; the outlines gate on the step date, not the frame.
