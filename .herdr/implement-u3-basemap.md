# u3-basemap — L52 basemap switcher + zoom labels

## What changed

- `src/components/command/model/basemap.ts` (new): pure `basemapPlan(basemap,
  imageryDate)` returns the satellite raster spec + which grafted label set /
  streets underlay shows — plus `parseBasemap`, `BASEMAP_ORDER`, `BASEMAP_LABEL`,
  style URLs and `tp-bm-*` id prefixes.
- `src/components/command/state.ts`: `ScreenState.basemap: 'dark'|'satellite'|'streets'`,
  action `{type:'setBasemap'}`, `DeepLink.basemap` (`?basemap=`). Case default:
  featured replay (isFeatured, rs_uruguai_2026) → satellite, else dark;
  selectCase/goTo reset to the case default. Exported `Basemap` type.
- `src/components/MapLayers.tsx`: satellite raster source+layer added once
  (`beforeId = tp-hillshade`); the two CARTO GL style JSONs fetch once and
  their layers graft with prefixed ids — voyager nonsym below the app stack,
  symbol label sets on top. `syncBasemap` toggles visibility per
  `options.basemap`, `setTiles` re-dates the satellite source per case,
  `moveLayer` re-raises the labels so later overlays can't cover them.
- `src/components/command/model/overlays.ts`: `MapLayerOptions.basemap` +
  `imageryDate` (optional, additive).
- `src/components/command/MapStage.tsx`: passes `basemap`/`imageryDate`
  (replay = case `reference_date`, live = undefined → GIBS `default`/latest);
  segmented row `Dark · Satellite · Streets` at bottom-right above the
  locator inset, `aria-pressed`, `role=group`, hidden while comparing.
- `src/components/command/CommandCenterLoader.tsx`: `?basemap=` plumbed through.
- `src/components/Map.tsx`: `maxZoom` 13 → 17. `fitBounds maxZoom: 12` calls
  unchanged. CompareOverlay's own maxZoom 13 left as is (out of scope).
- Attributions ride on the raster sources (`Imagery: NASA GIBS VIIRS`,
  `© CARTO © OpenStreetMap contributors`); footer line unchanged.

## Fix commit e96e045 (browser-check failures)

- CARTO rastertiles are the 'API KEY REQUIRED' watermark → replaced by
  grafted keyless vector layers: the `protomaps` source + glyphs are
  identical across CARTO GL styles, so dark-matter symbol layers (light
  text = labels on Dark/Satellite) and voyager non-symbol + symbol layers
  (Streets) are addLayer'ed verbatim with `tp-bm-*` prefixed ids —
  underlays below `tp-hillshade`, labels on top + re-raised via moveLayer.
- Satellite switched to `VIIRS_NOAA20_CorrectedReflectance_TrueColor`
  (coverage through 2026-11-15; SNPP ended 2026-11-02 and 'default' tiles
  were black). Verified non-black: PIL mean 67–110 at both cities, `default`
  and 2026-10-12.
- Chips moved to a horizontal row bottom-right, above the locator inset.

## Imagery choice (verified with curl)

- HLS L30: tiles over Uruguaiana/Porto Alegre fully transparent → too patchy.
- VIIRS NOAA-20 true colour: real jpeg tiles (z9 174/300 = 4381–9408 B).
  TileMatrixSet `GoogleMapsCompatible_Level9` → source `maxzoom: 9`,
  overzooms to 17. Live uses `default` (latest = today), replays the case
  `reference_date` (verified 2026-10-12 over RS).
- Style JSONs fetched once per map: dark-matter-gl-style (symbol layers) +
  voyager-gl-style (nonsym + symbol layers).

## Commands + results (all under the systemd memory cap)

- `bun test` — 790 pass / 0 fail / 17 skip (baseline 780 + 10 new).
- `bun x tsc --noEmit -p .` — only the two pre-existing errors in
  `app/layout.tsx` (`LayoutProps`) and `api/events/[id]/manifest/route.ts`
  (`RouteContext`); identical on the untouched tree (verified via stash).
- `bun x eslint src/components` — 0 errors, 4 pre-existing warnings.
- `bun test basemap.test.ts state.test.ts` — 51 pass / 0 fail.

## Check in the browser

- `/?case=rs_uruguai_2026` opens on Satellite; chips switch all three;
  `?basemap=streets` link wins; labels densify with zoom on every basemap.
- Chips sit under the top-right tools — check 390 px and 1280 px.
- Satellite past z9 is VIIRS overzoomed (soft) — expected, not a bug.
