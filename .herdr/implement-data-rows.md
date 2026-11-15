# implement — cc-l27-panel (L27: response first, prediction second)

Reordered the Situation overview panel (command view) and pinned the
last-saved/stale banner rule in a dedicated model test.

## Files changed

- `src/components/command/PanelSection.tsx` (new) — labelled `<section>`
  wrapper for the two panel groups ("Now on the ground", "Prediction"),
  `aria-label` + visible `h2`, top divider suppressed on the first group.
- `src/components/command/CommandCenter.tsx` — command-view panel reordered:
  1. **Now on the ground**: RadarCard (NISAR flooded area, passes,
     confirm/compare), "Who is affected" group (Tiles people + critical-area
     tiles, then the area-by-class list), then PriorityAreas (where to act).
  2. **Prediction**: StatusBlock (TPI chip stays the prediction headline,
     step line, sentence, last-saved/stale notice, replay-offer children
     unchanged), RainSoilChart, one-line pointer "Model probabilities
     (24 h–14 d) are in the Layers column."
  3. ReplayCheck/EvidenceDetails (replay only) and GetAlertsCard after;
     SourceAges stays last. Public view untouched; `<LayersColumn .../>`
     element untouched. All props preserved.
- `src/components/command/model/dataStatus.test.ts` (new) — banner rule:
  `fallback: true` → `last-saved` (replay and live), non-fallback replay →
  `archive`, live 7 h old → `stale`, 5 h old → `live`, `staleLimitMs()`
  default = 6 h.
- `src/components/command/command.test.tsx` — new describe "response-first
  section order (L27)": Now on the ground before Prediction; Radar/flooded,
  Who-is-affected/people and Priority areas before the TPI chip; chip →
  chart → Layers pointer inside Prediction; Replay check and Data sources
  after; sections absent from the public view. No existing assertions or
  banned-string rules changed.

## Verification of model/dataStatus.ts (no change needed)

`dataStatus()` already matches the ruling: `bundle.fallback === true` →
`last-saved` (loader sets `fallback` only for the bundled copy /
degraded-credentialed run, src/lib/data.ts:721), replay without fallback →
`archive`, live → `stale` past `2 × NEXT_PUBLIC_REFRESH_HOURS` (default
6 h) else `live`. StatusBlock renders the notice only for `last-saved` and
`stale`.

## Commands run

- `bun test` — 550 pass, 7 skip, 0 fail (557 tests, 33 files; skips are the
  live GEE/Neon smoke specs).
- `bunx tsc --noEmit` — two pre-existing errors in `src/app/**`
  (`RouteContext`, `LayoutProps` — Next typegen, also present on the clean
  tree, verified via `git stash`), outside my scope; none from my files.
- `bunx eslint` on the four touched files — clean, no output.

## Unresolved

- Nothing. `Situation overview` h1 lives inside StatusBlock (not editable),
  so the panel's h1 sits at the top of the Prediction section — per the
  ruling (keep every component and its props).
