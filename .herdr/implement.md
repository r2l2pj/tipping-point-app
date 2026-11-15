# cc-horizons — P(trigger) probability layer + horizon selector

Carries main commits 724b1d1 + c60c1db (old LayersPanel/Dashboard deleted) into
the Command Center screen.

## Changed

- `src/components/command/model/layerRegistry.ts`
  - `LayerId` += `"ptrigger"`; DEFS entry in group "Analysis",
    `short: "Trigger probability"` (after `tml`; TPI stays first/headline).
  - `layerAvailable`: `probHorizonsAvailable(layers).length > 0 ||
    probFrame(layers, "24h")?.png !== undefined` (legacy single family).
  - `layerRows` gained a 5th param `probHorizon: ProbHorizon = "24h"`;
    label = `PROB_LAYER_TITLE`; sub = `probLayerNote(probFrame(layers,
    probHorizon, stepDate))`; unavailable reason = `NO_MAP_LAYER_TEXT`.
  - `layerStateFor`: `pTrigger: on.includes("ptrigger")` (was stubbed false).
- `src/components/command/state.ts`
  - `ScreenState.probHorizon: ProbHorizon` + action
    `{ type: "setProbHorizon"; horizon }`.
  - `initialState` and `selectCase` set it to the first horizon the case
    ships (`probHorizonsAvailable(...)[0]`), else `"24h"`.
- `src/components/command/LayersColumn.tsx`
  - New props `probHorizon`, `stepDate`, `onProbHorizon`.
  - Under the ptrigger row (when available): `probLayerNote` of the selected
    horizon's frame (recomputed live so it follows the selector — rows carry
    the registry default), a `role="radiogroup"` (`aria-label="Probability
    horizon"`) of `probHorizonsAvailable` only, labels `PROB_HORIZON_LABEL`,
    and a visible `LONG_RANGE_NOTE` in `text-cc-warn` when 7d/14d selected.
- `src/components/command/MapStage.tsx`
  - `useMapLayers` options memo now passes `probHorizon: state.probHorizon`
    (hook already paints `probFrame(layers, options.probHorizon, frameDate)`).
- `src/components/command/CommandCenter.tsx`
  - `<LayersColumn>` props only: `probHorizon`, `stepDate`, `onProbHorizon`
    dispatching `setProbHorizon`.

## Tests

- `layerRegistry.test.ts`: new "P(trigger) probability row" describe
  (availability on horizon ids / legacy family, horizon-aware sub, shared
  missing reason, `layerStateFor` wiring); budget-loop `ids` now includes
  `ptrigger`; new eviction test naming "Trigger probability" both ways.
- `state.test.ts`: new "probability horizon" describe — default = first
  shipped horizon or "24h"; `setProbHorizon`; reset on case change (to "24h"
  when the new case ships none, to "48h" when it ships 48h/72h).
- `LayersColumn.test.tsx` (new): selector lists shipped horizons only, checked
  state; 7d/14d show LONG_RANGE_NOTE, short horizons don't; no p_trigger →
  unavailable row + no selector; legacy family → row but no selector.

## Commands run

- `bun test` — 557 pass, 7 skip (live-network smoke), 0 fail.
- `bunx tsc --noEmit` — 2 errors, both pre-existing on the branch and outside
  scope (verified via stash): `src/app/api/events/[id]/manifest/route.ts`
  `RouteContext`, `src/app/layout.tsx` `LayoutProps` (Next 16 generated types).
- `bunx eslint <8 touched files>` — 0 errors, 0 warnings.

## Unresolved

- The two `src/app/**` tsc errors above are not this unit's (src/app excluded
  from scope); presumably another unit owns the Next 16 page-prop types.
