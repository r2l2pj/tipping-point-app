# audit-b implementation report

Branch: unit/u-b. Files touched: src/lib/layers.ts, src/lib/layers.test.ts,
src/components/MapLayers.tsx, src/components/LayersPanel.tsx,
src/components/Dashboard.tsx (footer + layer-cap only).

## B3 — no synthetic layers

- Removed `mockScalarGrid`/`mockTpiGrid` usage and imports from MapLayers.tsx.
  The imerg/smap/nisar GeoJSON fill sources+layers and the mock TPI grid
  (source `tp-tpi`, layers `tp-tpi-fill`, `tp-tpi-critical-line`,
  `tp-tpi-hatch`) are deleted. `tp-fcast` stays — it only hatches the real
  forecast PNG's bounds.
- Toggles now paint through the same image-source/assetUrl mechanism as the
  other overlays: new `rasterToggle(key, src, lyr)` uses
  `manifestRaster(bundle.manifest.layers, key, day.date)` (new helper in
  layers.ts, matches by id prefix imerg_*/smap_*/nisar_*/tpi_*; nisar excludes
  the nisar_pre/nisar_post swipe pair) and `ensureImageLayer` below the muni
  lines at 0.7 opacity. No manifest raster -> no pixels.
- Click popup now reads only the raster frame's day-level value.
- `layerAvailable(bundle, key)` added in layers.ts (true when a manifest
  layer with the key's prefix has a png or cog). LayersPanel filters ROWS by
  it — a row only renders when the real raster exists.
- `mockScalarGrid`/`mockTpiGrid` remain defined in src/lib/tpi.ts — that file
  is outside this unit's write scope, so they were left; nothing in the
  in-scope files references them anymore.

## S21 — two-layer budget incl. tab overlays

- `overlayPlan` now returns `count` (sum of non-TPI plan flags):
  alert 0, radar 2, validation 2, impact 1. `MAX_DATA_LAYERS = 2` and
  `toggleBudget(tab) = max(0, 2 - count)` exported from layers.ts.
- Dashboard: `budget = toggleBudget(tab)` replaces the constant in the
  queue-eviction `toggleLayer`, and a new effect on `budget` evicts the
  oldest enabled toggles when a tab switch shrinks the budget.
- LayersPanel gets a `budget` prop: when budget is 0, unchecked rows render
  disabled (50% opacity, `cursor-not-allowed`) with a title explaining the
  two-layer cap. Footer text updated to say tab overlays count.
- Reviewer fix (round 2): queue entries whose raster isn't in the bundle are
  dead and must not consume budget slots. `capToggleQueue(queue, budget,
  available)` in layers.ts prunes dead keys and evicts the oldest live ones
  over budget, returning {queue, off}; used by both `toggleLayer` and the
  tab-switch effect (effect deps now bundle+budget). Dead keys are also
  switched off in state.

## N9 — hillshade exaggeration 0.2 -> 0.15 (Terrarium fallback + manifest PNG
opacity already 0.15).

## N6 + S15 — footer legend

- Title: "TPI index (0–1) — Risk class".
- Added `data {fmtDataDate(days[dayIndex]?.date)}` after the class chips.
- Credits: "Data: NASA GPM · SMAP · NASADEM · NISAR · Basemap © CARTO ©
  OpenStreetMap · Boundaries © IBGE · Population: GPW (NASA SEDAC) / US
  Census". Footer is now `min-h-9 flex-wrap`; credits take a full row on
  narrow widths (`basis-full sm:basis-auto`). All text stays text-xs (12px).

## Tests (src/lib/layers.test.ts)

- overlayPlan expects now include `count` per tab; new "counts drive the
  toggle budget" test asserts toggleBudget per tab.
- New `layerAvailable` truth table: png/cog/no-raster, prefix routing,
  nisar swipe-pair exclusion, undefined/empty bundle.
- New test reads MapLayers.tsx and asserts no mockScalarGrid/mockTpiGrid
  references.

## Commands & results

- `bun install` — ok
- `bunx eslint <5 changed files>` — clean
- `bun test src/lib/layers.test.ts` — 39 pass, 0 fail
- `bun test` — 323 pass, 6 skip, 0 fail (19 files)
- `bun run build` — compiled, TypeScript clean, 14/14 pages generated
