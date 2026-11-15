# implement — cc-validation

Unit `cc-validation` on branch `unit/cc-validation` (worktree cc-validation),
based on `integrate/command-center` merge cb08715.
Carried main commits 40d6683 + 09533b6 (flood-validation headline, *_raw
secondary, cloud_pct normalization) into the Command Center. Scope respected:
only `src/components/command/model/replayCheck.ts`,
`src/components/command/EvidenceDetails.tsx`, and
`src/components/command/model/replayCheck.test.ts` changed. No `src/lib/**` or
`src/app/**` files touched.

## What changed

**`src/components/command/model/replayCheck.ts`**

- New exported helper `opticalSeenPct(cloudPct)` (semantics from 09533b6):
  normalized 0-1 input passes through (`1` = 100% cloud -> 0% seen); only a
  value `> 1` is treated as a raw 0-100 metrics.json number and rescaled;
  non-finite or out-of-range (`< 0`, `> 100` after rescale) returns `null`.
- `evidence().floodStats` headline = like-for-like NISAR new flood vs OPERA
  DSWx-S1 new flood: IoU, F1, Precision, Recall via `fmtScore` (2 decimals),
  then Landslide catalog hits and Hand validation as before.
- `floodNote` = `metricsView.validation_method` when it is a non-empty string;
  falls back to the existing clear-sky note otherwise.
- New `Evidence.floodSecondary` — set only when any of
  `iou_raw/f1_raw/precision_raw/recall_raw` is non-null. `line` is
  `IoU x · F1 x · P x · R x` (fmtScore, so an absent *_raw value reads
  "not published yet"); `diagnosis` carries `opera_fn_diagnosis` when present.
- `whyRadar` now goes through `opticalSeenPct`: a raw `92.89` renders
  "the optical saw only 7%" instead of -9189%; out-of-range yields the
  existing "not reported" fallback sentence.
- Replay-check row "Flood agreement with the reference" reads the headline
  scores incl. P/R when present: `IoU 0.08 · F1 0.15 · P 0.19 · R 0.13` on the
  wa_2025 values; P/R drop out when absent; the row now appears when any of
  the four scores is finite.

**`src/components/command/EvidenceDetails.tsx`**

- Flood heading renamed to "Flood detection vs reference (NISAR vs OPERA, new
  flood)" (as in 40d6683).
- Renders the secondary block after the note: bordered box titled "All water
  incl. permanent (secondary)" with the score line and the
  `opera_fn_diagnosis` text, only when `floodSecondary` is set.

**`src/components/command/model/replayCheck.test.ts`** — 7 new tests (28 pass
total in the file): flood-agreement row incl. P/R and P/R-absent case;
opticalSeenPct table (0-1, 0-100, 1, 0, null, -3, 250, string); the real
wa_2025 published keys (headline stats, validation_method note, secondary
line "IoU 0.01 · F1 0.01 · P 0.20 · R 0.01", diagnosis, optical 7%); gating
(no *_raw -> no block, one *_raw -> block); out-of-range -> no "optical saw"
sentence; rs_2024 cloud_pct 100 -> 0%; and a real-file check that runs
public/data/metrics.json through both `toMetricsView` and the raw path (wa 7%,
rs 0%).

## Commands and results

- `bun test` — 551 pass, 7 skip (live GEE/Neon smoke), 0 fail, 4028 expects.
- `bun test src/components/command/model/replayCheck.test.ts` — 28 pass, 0 fail.
- `bunx tsc --noEmit` — two pre-existing errors in `src/app/**`
  (`RouteContext` in api/events/[id]/manifest/route.ts, `LayoutProps` in
  app/layout.tsx). Reproduced with my changes stashed — not mine, out of
  scope (Next 16 generated types; no build run per brief).
- `bunx eslint` on the three touched files — 0 errors, 0 warnings.
- `git diff --check` — clean.

No browser/build run per brief (lead does it). Nothing unresolved.
