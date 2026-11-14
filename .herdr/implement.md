# implement — app-dashboard (t52 brief + v3 update)

Built the Tipping Point ops dashboard (`/`) and public alert feed (`/alerts`) in
`tipping-point-app`, driven entirely by mock JSON under `public/data/`.

## What was built

**`/` ops dashboard** (matches mockup + v3 visual spec):

- `src/app/page.tsx` — async server component loads every case bundle
  (`events.json` entries + `now/`) inside `<Suspense>`, hands all of it to the
  client dashboard.
- `src/components/Header.tsx` — logo, "TIPPING POINT | Rain warns. Radar
  confirms.", case selector (Replay cases optgroup + Live optgroup),
  `EVENT REPLAY · DEMO` button. Live mode shows a `NOW · Updated Xh ago` pill
  computed client-side (Date.now is a request-time API), plus a discreet
  "showing last good data" warning when data is >6h stale.
- `src/components/Map.tsx` — extended: `bounds` (fitBounds, zoom 5–13 clamp),
  CARTO dark-matter-nolabels basemap, ScaleControl, `onReady` exposing the map
  instance, `children` overlay slot.
- `src/components/MapLayers.tsx` — imperative layer stack in v3 order:
  hillshade (Terrarium raster-dem, below risk layers) → IMERG/SMAP/NISAR mock
  scalar grids → TPI grid (YlOrRd classes, critical 1px outline, diagonal
  hatch overlay on forecast frames) → permanent water (#9ECAE1 60%) + river
  lines → confirmed flood (#2166AC 75%, #08306B outline) → landslide
  candidates (#7B3294 80%, white 1px) → priority-zone HTML markers → city/river
  labels on top. Click on a TPI cell opens a popup with class, TPI and data
  dates (v3 click spec).
- `src/lib/tpi.ts` — TPI classes/palette, `mockTpiGrid(bbox, hotspots, scale)`
  synthetic raster stand-in (smooth radial falloff around priority zones,
  scaled per timeline day), `mockScalarGrid` for the other layer toggles,
  formatters.
- `src/components/LayersPanel.tsx` — 5 layer checkboxes with per-layer data
  dates; enforces the v3 "max two data layers" rule (third toggle drops the
  oldest).
- `src/components/SidePanel.tsx` — ALERT (banner + 12.0 km² / 8,400 stats
  computed from priority_zones + "Illustrative demo data" marker + chart +
  ranked priority zones + NISAR CTA), RADAR (before/after swipe placeholder
  with NISAR dates, flooded-area stats, live-mode NISAR pass list, awaiting-
  pair card when no data), VALIDATION (IoU, F1, AUC, precision/recall @0.60,
  lead hours, warned-before %, cloud-cover "why radar" card), IMPACT (people
  exposed, km² flooded, lights-out %, exposure basis).
- `src/components/TpiChart.tsx` — Recharts ComposedChart per v3 chart spec:
  IMERG bars #2166AC, SMAP line #8C510A (right axis 0–1), TPI line #BD0026,
  dashed threshold + P95 lines, EVENT vertical marker, cyan playhead line,
  gray forecast shading.
- `src/components/Timeline.tsx` — transport controls, D-5…EVENT…D+2 markers
  (red EVENT node, dashed forecast nodes), "+72h (projection)" dashed box.
  Playing animates the TPI map layer via the day scale.
- Footer legend — 4 TPI classes with ranges + `Data: NASA GPM · SMAP ·
  NASADEM · NISAR · © OpenStreetMap`.

**`/alerts` public feed**: `src/app/alerts/page.tsx` — cards in the v3
"Mensagem de alerta" template (level word + hazard, region, rain-vs-P99, soil,
forecast, NASA data dates, guidance, "Follow Civil Defense guidance. SMS
40199."), level badge (watch/warning/emergency), certainty band, valid window.

## Mock data created (all inside `public/data/`)

- `wa-2025-12/`: manifest.json, metrics.json, series/imerg_smap_daily.json,
  geojson/{priority_zones,flood_confirmed,landslide_candidates,permanent_water,places}.geojson
- `rs-2024-05/`: manifest.json, metrics.json, series + geojson/{priority_zones,permanent_water,places}
- `now/`: live-mode case — manifest.json (mode:"live", bounds, updated_at,
  data_dates incl. nisar_passes), series (D+1/D+2 kind:"forecast"), geojson
- `alerts.json` — `{alerts:[{id,area,hazard,level,certainty,valid_from,
  valid_to,guidance}]}` + optional template fields (region, rain, soil,
  forecast, data_dates, map)

## Deviations / extensions (all additive, SCHEMA fields unchanged)

- `metrics.json` gained a `model` object `{auc, threshold, precision, recall}`
  — required by t52's v3 update for the VALIDATION tab. Original
  flood/alert/cloud/impact fields untouched.
- `manifest.json` gained `mode`, `bounds`, `updated_at`, `data_dates` (per the
  v3 doc's manifest shape). `data_dates` may hold a `nisar_passes` array.
- `events.json` left schema-exact — mode/data_dates live on the manifest so
  `sync:data` (which overwrites `events.json`) can't clobber them.
- Basemap switched to `dark-matter-nolabels` (v3: labels on top, separate
  layer). Hillshade uses public Mapzen Terrarium tiles; degrades silently
  offline.
- Event marker in the chart uses a light stroke (#E5E5E5) rather than #252525
  — the spec color fails its own 4.5:1 contrast rule on the dark UI; mockup
  shows a light line.
- rs-2024-05 got a minimal mock bundle so the event selector never dead-ends.
- No new npm deps. `package.json` untouched except README "Seams" table update.

## Commands run & results

- `bun run build` — green (`/` and `/alerts` prerendered partial-static,
  routes listed ◐). Also ran `sync:data` — merges, does not delete mocks.
- `bun run lint` — 0 errors (2 pre-existing warnings in
  `src/types/earthengine.d.ts`, untouched).
- `bun run dev` — `curl /` → 200, `curl /alerts` → 200; SSR HTML contains
  "TIPPING POINT REACHED", "12.0 km² critical", "8,400 people exposed",
  priority zones, all four tabs; /alerts renders all three cards with
  SMS 40199 line. Dev log shows no runtime errors on either route.
- No screenshots — no headless browser (orca/playwright/chromium) in this
  environment; curl evidence above.
- Note: `predev`/`prebuild` run `sync:data`; it copies the data repo over
  `public/data` non-destructively, so committed mocks persist (verified).

No git commands run, no child agents, no new deps. Stayed on SWE-2 High.
