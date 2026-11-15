# u3-basemap — L52 basemap switcher + zoom labels

## What changed

- `src/components/command/model/basemap.ts` (new): pure `basemapSources(basemap, imageryDate)`
  returns the four raster source/layer specs — GIBS VIIRS underlay, CARTO
  `voyager_nolabels` underlay, CARTO `dark_only_labels` and `voyager_only_labels`
  overlay (`top: true`) — plus `parseBasemap`, `BASEMAP_ORDER`, `BASEMAP_LABEL`.
- `src/components/command/state.ts`: `ScreenState.basemap: 'dark'|'satellite'|'streets'`,
  action `{type:'setBasemap'}`, `DeepLink.basemap` (`?basemap=`). Case default:
  featured replay (isFeatured, rs_uruguai_2026) → satellite, else dark;
  selectCase/goTo reset to the case default. Exported `Basemap` type.
- `src/components/MapLayers.tsx`: sources + layers added once after the app
  layers — underlays `beforeId = tp-hillshade` (bottom of the app stack, over
  the dark-matter vector style which stays the base), labels layers on top.
  Update effect toggles visibility per `options.basemap`, `setTiles` re-dates
  the satellite source when the case changes, `moveLayer` re-raises the active
  labels layer to the top so later-added overlays can't cover it.
- `src/components/command/model/overlays.ts`: `MapLayerOptions.basemap` +
  `imageryDate` (optional, additive).
- `src/components/command/MapStage.tsx`: passes `basemap`/`imageryDate`
  (replay = case `reference_date`, live = undefined → GIBS `default`/latest);
  vertical segmented chip `Dark · Satellite · Streets` under MapTools
  (`top-[152px]`, right inset), `aria-pressed`, `role=group`, hidden while
  comparing. Fits 390 px: top-right column is the only spot that clears the
  N arrow, status/featured chips, horizon chips and the legend.
- `src/components/command/CommandCenterLoader.tsx`: `?basemap=` plumbed through.
- `src/components/Map.tsx`: `maxZoom` 13 → 17. `fitBounds maxZoom: 12` calls
  unchanged. CompareOverlay's own maxZoom 13 left as is (out of scope).
- Attributions ride on the raster sources (`Imagery: NASA GIBS VIIRS`,
  `© CARTO © OpenStreetMap contributors`); footer line unchanged.

## Imagery choice (verified with curl)

- HLS L30 `HLS_L30_Nadir_BRDF_Adjusted_Reflectance`: tiles over Uruguaiana /
  Porto Alegre for 2026-10-12 return 200 but fully transparent → too patchy,
  dropped per the plan's fallback clause.
- VIIRS_SNPP_CorrectedReflectance_TrueColor: real jpeg tiles
  (z9 174/300 = 4593 B, 1959 colors; 183/300 = 6188 B). TileMatrixSet
  `GoogleMapsCompatible_Level9` (ids 0–9) → source `maxzoom: 9`, overzooms to 17.
  URL: `…/wmts/epsg3857/best/<layer>/default/<date-or-default>/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg`.
  Dates past the coverage edge (e.g. today 2026-11-15) 404 → live uses
  `default` (latest published = 2026-11-02), replays use the case
  `reference_date` (verified 2026-10-12 over RS).
- CARTO raster: `voyager_nolabels`, `dark_only_labels`, `voyager_only_labels`
  all 200 image/png; `@2x` returns the same 256 px tile → plain tiles used.

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
