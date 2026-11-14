# U4 — doc-order map stack + tab overlays + BRT popup + município pip

Lead: t68 lead-front · worker: u4 · branch `unit/u4`

## What changed

**`src/lib/layers.ts` (new, pure — no maplibre, node-testable)**

- `TabKey = "alert" | "radar" | "validation" | "impact"`.
- `isForecastLayer(l)` — explicit `forecast` flag wins; absent the flag,
  `/_d[1-3]$/` on the id marks a forecast frame (mirrors `toNowView`).
- `overlayPlan(tab)` — plain serializable `{tpi, floodPolygons,
  landslideCandidates, catalogPoints, operaValidation, nightLights}`.
  alert: tpi only · radar: +flood +candidates · validation: +catalog +OPERA ·
  impact: +night_lights. Unknown/undefined tab behaves like alert.
- `pointInPolygons(fc, lon, lat)` — ray-cast over Polygon + MultiPolygon
  (holes excluded); name falls back `name ?? nome ?? NM_MUN`.
- `assetUrl(caseDir, p)` — `resolveAsset("/data", caseDir, p)` (gs:// and
  http(s) pass through, caseDir-prefixed keys not doubled).
- `fmtDate` / `fmtDateTime` / `fmtDataDate` — America/Sao_Paulo;
  `fmtDateTime("2026-11-15T05:00:00Z") === "02:00"`; `fmtDate` gives the long
  en-US form ("Nov 15, 2026"). Date-only strings stay on the calendar day
  (no UTC-midnight shift into the previous BRT day).
- Color consts: `TPI_STOPS` (YlOrRd #FFFFB2→#BD0026), `TML_STOPS`,
  `OPERA` ({both #2166AC, nisarOnly #92C5DE, operaOnly #F4A582, cloud
  #BDBDBD}), `VIRIDIS` (#440154→#FDE725). No coherence_drop anywhere.
- `resolvePixelValues(cogUrl, lon, lat, ctx?)` — **L5 seam** for the geotiff
  reader landing later: `null` without a cog URL, else the `rstFor()`
  day-level approximation. Real COG pixel reads swap inside this function;
  callers don't change.

**`src/lib/layers.test.ts` (new)** — 21 bun tests covering all of the above
incl. explicit-flag-beats-suffix, hole exclusion, MultiPolygon parts,
gs:// + already-prefixed asset paths, and BRT conversion.

**`src/components/MapLayers.tsx`**

- Signature now `useMapLayers(map, bundle, dayIndex, layers, showFlood,
  tab?)` — additive; existing callers compile unchanged.
- `caseDir = canonicalCaseId(bundle.manifest?.event ?? bundle.id)` per L4 —
  v4 folders are the canonical underscore ids.
- Doc-order stack: manifest `hillshade` PNG renders as an image source at
  `raster-opacity 0.15`; Terrarium raster-dem stays as the fallback
  (exaggeration 0.4 → 0.2). New `tp-muni` line (white, 0.5 px, 40%) and
  `tp-catalog` circle (3 px radius = 6 px dot, white fill, black stroke)
  sources+layers slotted between scars and labels.
- Manifest PNG overlays `opera_validation`, `night_lights`, `t_ml` render as
  lazily-created image sources **below the municipal lines** (`t_ml` shows
  whenever published; the other two follow `overlayPlan`). All PNG/COG URLs
  via `assetUrl`. `ensureImageLayer()` helper keeps creation/update in one
  place; `DYNAMIC_IMG` list drives unmount cleanup.
- Visibility: `tab === undefined` keeps the legacy `showFlood`/`nisar`
  behavior; with a tab, flood/candidates/catalog/opera/night_lights follow
  `overlayPlan(tab)`.
- Forecast: `isForecastLayer(activePng) || day.kind === "forecast"` →
  `raster-opacity 0.5` + hatch bbox + marker label whose text is
  `forecastSourceLabel(manifest.forecast_source) ?? "previsão"`.
- Popup: município via `pointInPolygons(bundle.municipalities)` with
  `nearestPlace` fallback; data dates via BRT `fmtDataDate`; COG download
  link (`assetUrl`) when the active frame has `cog`; async
  `resolvePixelValues` seam — renders "day estimate" immediately and swaps
  to "COG pixel read" when the promise resolves (`clickSeq` drops stale
  resolutions).
- City/river label `text-size` floored at 12 px.

**`src/components/LayersPanel.tsx`** — slide/flood marked mutually
exclusive: hint text ("Slide and flood TPI are mutually exclusive — max two
data layers at once") + `EXCLUSIVE` map; enabling one clears the other.
Data dates now via `fmtDataDate` (BRT). `text-[10px]` → `text-xs`.

**`src/app/page.tsx`** — `now` bundle `reference_date` derives from
`manifest.updated_at.slice(0, 10)` instead of the hardcoded "2026-11-14".

**`src/app/globals.css`** — viz rule 9: `.tp-popup-body`,
`.tp-forecast-label`, `.tp-zone-name`, `.tp-zone-badge`, `.tp-zone-sub` all
≥ 12 px on dark (contrast unchanged, ≥ 4.5:1); `.tp-popup-body a` link
color for the COG download.

`src/components/Map.tsx` was in scope but needed no change.

## Commands run + results

- `bun install` — 753 packages, ok.
- `bunx tsc --noEmit` — only pre-existing errors (`RouteContext` in
  api/events/[id]/manifest/route.ts, `LayoutProps` in layout.tsx); verified
  identical on a clean `git stash` tree — not mine.
- `bun test src/lib/layers.test.ts` — **21 pass, 0 fail**.
- `grep -nE 'text-\[(9|10|11)px\]'` over my files — **no matches**
  (exit 1).
- `bunx eslint` over my files — clean.
- `bun run build` — sync-data no-ops in worktree ("data repo not found —
  skipping"); **Next 16.4.6 build green** (compiled, types, 8/8 pages).

## Notes / decisions

- `overlayPlan` keys follow the spec naming (floodPolygons,
  landslideCandidates, catalogPoints, operaValidation, nightLights); each
  tab lists only its own extras — TPI stays user-toggled everywhere.
- Catalog-point "6 px" read as dot diameter → `circle-radius: 3`.
- `t_ml` renders whenever the manifest publishes it (below muni lines,
  opacity 0.7); it's not tab-gated since the spec assigns it no tab.
- `bundle.municipalities` / `bundle.catalog` are contract fields the data
  side fills (products map); popup falls back to `nearestPlace` meanwhile.
- Mock PNG paths still carry hyphen dirs while `caseDir` is canonical —
  expected until U3 lands the renamed folders; coded to the contract.
