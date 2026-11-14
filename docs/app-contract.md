# App data contract — consumer checklist

**Source of truth:** `tipping-point-data/data/SCHEMA.md` (the data lead owns the
contract). This file does NOT re-spec it — it lists what the app does with each
contract item so the data side can check coverage. App-side normalization lives
in `src/lib/contract.ts`.

## Case ids

- Root `manifest.json` case keys are the **canonical underscore ids**
  (`rs_2024`, `wa_2025`, `now`). Each case node carries `event_id`
  (`rs-2024-05`, `wa-2025-12`) — the hyphen alias used for directory names.
- `caseAlias()` maps both directions; `canonicalCaseId()` returns the
  underscore form (unknown ids pass through).
- Asset paths are always explicit in the manifest. The app never derives a
  path from a case key or event id.

## Root manifest (`manifest.json`)

`{ updated_at, cases: { <canonical-id>: ManifestCase, now: {…} } }`.
Per-case fields the app reads: `mode`, `bounds`, `updated_at`, `layers`,
`metrics` (path), `products` (map), `forecast_source`, `data_dates`. A legacy
per-case `<dir>/manifest.json` still resolves when the case isn't in the root
map (fallback only).

## Layers

Each manifest layer renders as a MapLibre image source: `png` (EPSG:3857) +
`bounds` [w,s,e,n]; `cog` is offered as a download link; `date` binds the
layer to a timeline day. `asset` is the full GEE asset id — the live path
served via `/api/tiles`, with `png`/`cog` as the static fallback. `legend`
is a pt-BR array `[Baixo, Moderado, Alto, Crítico]` — the app maps classes
by index 0-3.

| Layer id | App behavior |
| --- | --- |
| `tpi_slide`, `tpi_flood` | Main radar overlays; slide/flood toggles are mutually exclusive (2-layer budget). |
| `tpi_slide_d0..d3`, `tpi_flood_d0..d3` | now/ forecast days — never rendered like observed. See forecast rule below. |
| `nisar_pre`, `nisar_post` | Radar tab swipe pair (before/after). |
| `night_lights_pre`, `night_lights_post` | Impact tab swipe pair; `night_lights` overlay uses viridis. |
| `opera_validation` | Validation overlay: #2166AC both / #92C5DE NISAR-only / #F4A582 OPERA-only / #BDBDBD cloud. |
| `t_ml` | Optional ML output palette (skipped when absent; no `coherence_drop`). |
| `hillshade` | 15% basemap shading; Terrarium only when the manifest has no hillshade. |
| `municipal_boundaries` | White 0.5px 40% reference lines + point-in-polygon lookup for popups. |
| `landslide_catalog` | 6px white/black reference points in doc layer order. |

**Forecast rule:** `forecast: true` on a layer means forecast day; when the
flag is absent, a `*_d[1-3]` id is treated as forecast (explicit flag wins).
`toNowView()` resolves this into `NowLayer.forecast`.

## Products map

`products` on a case node (or on `now`) maps a product key to an explicit
bucket-relative path. The app reads the path from the map; when a key is
absent it falls back to fixed filenames under the case dir.

| Product key | Consumed by |
| --- | --- |
| `summary` | `now/summary.json` — Agora tab: `critical_km2`, `people_critical`/`people_exposed`, `classes_km2`, `forecast_source` (`NowSummary`). |
| `alerts` | `now/alerts.json` — `/alerts` page cards; `candidates[{class:int, label, centroid:[lon,lat], pixels:int, hold:bool}]` (`NowAlertsFile`). |
| `critical_areas` | Critical-areas polygons overlay. |
| `municipal_boundaries` | Municipio lines + popup lookup (`CaseBundle.municipalities`). |
| `landslide_catalog` | Validation tab catalog points (`CaseBundle.catalog`). |
| `places` | Nearest-place fallback for popup labels. |
| `priority_zones`, `permanent_water`, `flood_confirmed`, `landslide_candidates` | Radar/reference overlays (`zones`/`water`/`flood`/`scars`). |
| `imerg_smap_daily` | `series/` rain/soil chart (`SeriesDaily`). |
| `swot` | `series/` SWOT line chart, meters (`CaseBundle.swot` — shape settled by data lead). |
| `catalog`, `municipalities`, `simular` | `simular.json` feeds the Telegram `/simular` flow (app-hosted fixture fallback). |

## now/ bundle (schema `tipping-point/now@2`)

`toNowView()` normalizes the node: top-level `nisar_passes` (hoisted from
`data_dates` on legacy syncs), `products`, per-layer resolved `forecast`,
`forecast_source`. Written last by the pipeline — the app never reads a
half-updated set, and treats `updated_at: null` as "mid-run" (no fresh
update). `now/` ships without a series file: timeline days derive from
manifest layer dates + forecast flag. `events.json` remains the case index;
its entries use the hyphen `event_id` forms.

## metrics.json (flat keys)

`toMetricsView()` accepts the flat v4 metrics and the legacy nested mock
(`flood`/`model`/`alert`/`cloud`/`impact`) and returns one `MetricsView`.
Percent fields (`cloud_pct`, `landslide_hit_pct`, `hand_validation`,
`night_light_drop_pct`, `warned_before_pct`) arriving on a 0-100 scale are
divided by 100 — **the UI always gets 0-1 fractions**. Scores (`iou`, `f1`,
`*_auc`) are ratios and pass through; unknown flat keys (e.g. `landslide_ml`)
pass through untouched. Legacy mapping: `flood.area_km2→flooded_km2`,
`model.auc→rf_auc`, `alert.lead_hours_median→lead_time_median_h`,
`impact.people_exposed→people_critical`, `impact.lights_out_pct→night_light_drop_pct`.

## forecast_source

Case-level or now-level string. UI labels via `forecastSourceLabel()`:
`perfect-forecast` → "previsão perfeita" (replay), `geos-fp` → "GEOS-FP"
(live). Unknown values pass through verbatim.

## Asset paths

`resolveAsset(base, caseDir, path)`: null/empty → `undefined`; absolute
http(s) passthrough; `gs://bucket/key` →
`https://storage.googleapis.com/bucket/key`; otherwise `base/caseDir/key`
(keys already carrying the case dir are not doubled).
