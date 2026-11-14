# implement — v4 app delta (t52 brief v4-app-delta)

Aligned the app with the doc v4 data contract + viz rules. Note: the doc text
referenced in the brief (`~/.crew/tp4.txt`) does not exist; the same normative
sections ("Armazenamento e disponibilização", "Mapa", "Regras de
visualização") live in `/home/lucascoelho/code/r2l2pj/.crew/tp3.txt` and were
used as the spec. Prior report: `.herdr/implement.md`.

## What changed

**Manifest schema → v4** (`src/lib/types.ts`, `src/lib/data.ts`)

- `ManifestLayer` now carries `png` (EPSG:3857 pre-rendered), `cog` (download),
  `bounds` [w,s,e,n], `date`, `legend` (label array or v3 key); v3
  `type`/`path`/`source`/`bands` kept optional for legacy per-case files.
- New `RootManifest` / `ManifestCase` types matching the v4 contract:
  `{ updated_at, cases: { <id>: { mode, bounds, layers, metrics, data_dates },
  now: { mode:"live", bounds, data_dates } } }`.
- `getCaseBundle` now resolves each case from the root `public/data/manifest.json`
  `cases` map first (case-level `updated_at` falls back to root `updated_at`),
  and falls back to a legacy per-case `manifest.json` when the case isn't
  listed — sync:data merges can't break the app.

**PNG layer support** (`src/components/MapLayers.tsx`, `src/lib/tpi.ts`)

- New image-source renderer: when a manifest layer has `png` matching the
  current timeline day (`layer.date === day.date`; prefers the id matching the
  active toggle — `slide`/`flood`), the app does
  `addSource({type:'image', url, coordinates: boundsToImageCoordinates(bounds)})`
  + a raster layer inserted below permanent water (v4 layer order). Day/frame
  changes call `ImageSource.updateImage` — timeline playback swaps PNGs as the
  doc intends. `resolveDataUrl` maps bucket-relative paths to `/data/...`.
- The synthetic `mockTpiGrid` GeoJSON remains as fallback only for days with no
  PNG in the manifest.
- Forecast frames (`day.kind === "forecast"`) per v4 "observed/predicted never
  look alike": raster at 50% opacity, diagonal `tp-hatch` overlay over the
  frame bounds (`tp-fcast` source + `tp-fcast-hatch` fill), and a "FORECAST"
  label marker pinned to the top edge of the frame (new `.tp-forecast-label`
  style in `globals.css`). Same label+hatch now also covers mock-grid forecast
  frames.

**Click popup → v4** (`src/components/MapLayers.tsx`, `src/lib/tpi.ts`)

- Popup now shows: place name (nearest city/town point from `places.geojson`,
  mock proxy for the município lookup), TPI class + value, R/S/T component
  scores, and the data date (frame date + IMERG/SMAP source dates). Works on
  both paths: per-cell values queried from the mock grid, or day-level values
  on PNG raster frames. `rstFor()` derives R (IMERG/P95), S (SMAP), and backs
  out T so (R·S·T)^(1/3) = TPI per the v4 formula.

**"Agora" parity** (`src/components/SidePanel.tsx`)

- In Live mode the ALERT tab now shows a "Live data sources" card with
  updated-at and per-source dates (IMERG Early, SMAP L4, GEOS-FP issued,
  D+1–D+3), plus the recent NISAR passes list — extracted into a shared
  `NisarPassList` also used by the RADAR tab. km² critical / people exposed
  were already in the banner; live TPI + D+1..D+3 are in the chart/timeline.
- `now/` series extended with a D+3 forecast day (2026-11-17) so the live
  mode really carries D+1..D+3.

**Mock data** (`public/data/`, `scripts/mock-png.mjs`)

- New root `public/data/manifest.json` in the exact v4 shape (`updated_at` +
  `cases` map for wa-2025-12, rs-2024-05, now; each with mode/bounds/
  data_dates/layers/metrics pointer).
- Per-case `manifest.json` files rewritten to v4 layer entries
  `{id,date,png,cog,bounds,legend}` (one entry per raster layer per day);
  non-raster rows (geojson/series paths) retained for metadata.
- New `scripts/mock-png.mjs` (no deps, hand-rolled PNG encoder): renders a
  384-px-wide RGBA raster per `png` layer using the same hotspot-falloff field
  as `mockTpiGrid`, scaled by the day's TPI, in YlOrRd class colors (Low
  transparent). Wrote **33 PNGs** under `public/data/<case>/png/`.

## Commands run & results

- `bun scripts/mock-png.mjs` — 33 rasters written; `file` confirms valid
  RGBA PNGs (e.g. 384×779 wa frame, 384×501 now frame).
- `bun run lint` — 0 errors (warnings only in vendored
  `public/maplibre-gl-worker.js` + `src/types/earthengine.d.ts`, both
  pre-existing/untouched).
- `bun run sync:data && bun run build` — **green**; `/` and `/alerts`
  prerendered partial-static.
- Dev evidence: an existing `next dev` server on :3000 (PID 2281391, started
  before this session — left running) served the updated tree. `curl` →
  `/` 200, `/alerts` 200, `/data/manifest.json` 200,
  `/data/wa-2025-12/png/tpi_slide_20251212.png` 200. SSR HTML for `/` contains
  the alert banner and, in the RSC payload, the v4 manifest (all 8
  `tpi_slide_*.png` paths, `nisar_passes`, `geos_fp_issued`) — i.e. the root
  manifest → CaseBundle → client path is exercised end to end.
- No headless browser available (playwright-core not installed, no orca) — no
  screenshot; curl evidence above.

## Notes / deviations

- `tp4.txt` missing — used `tp3.txt` normative sections as spec.
- R/S/T values in the popup for mock/PNG frames are derived from daily
  aggregates (`rstFor`), not pixel-exact — real COG pixel reads stay the
  documented geotiff.js follow-up; the popup shows place + class + R/S/T +
  data date as specified.
- imerg/smap/nisar toggle layers still use `mockScalarGrid` — the v4 png
  contract is exercised on the TPI frames; scalar mock layers have no manifest
  `png` entries.
- `sync:data` confirmed non-destructive: root `manifest.json` and `png/` dirs
  survive; it only overlays `tipping-point-data/data` files.
- No git commands, no child agents, no new deps, no credentials. Stayed on
  SWE-2 High.
