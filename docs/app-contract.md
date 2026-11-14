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
`metrics` (path), `products` (map), `forecast_source`, `data_dates`,
`tpi_cuts`. A legacy per-case `<dir>/manifest.json` still resolves when the
case isn't in the root map (fallback only).

- **`tpi_cuts`** (optional `number[]`, default `TPI_CUTS = [0.2, 0.4, 0.6]` in
  `contract.ts`): TPI class boundaries — the upper bounds of Low/Moderate/
  High (Critical runs to 1). `getCaseBundle` surfaces the effective cuts as
  `bundle.tpiCuts`; `TPI_CLASSES`/`TPI_THRESHOLD` in `lib/tpi.ts` derive from
  `TPI_CUTS` so the literal lives in one place. Components must read
  `bundle.tpiCuts`, never hard-code cuts.
- **`bbox` / `reference_date`** come from the contract, not call-site
  literals. `getCaseBundle` accepts them optionally; derivation order:
  `bundle.bbox` = case-node `bounds` ?? the caller arg ?? the `events.json`
  entry `bbox` — `bounds` is required by SCHEMA, so the loader throws when
  nothing supplies one (`bundle.bbox` is never null). `bundle.reference_date`
  = caller arg ?? `manifest.updated_at` (first 10 chars) ??
  `data_dates.observed` ?? latest non-forecast `layers[].date` ??
  `series.reference_date` ?? the `events.json` entry `reference_date`.
  Components must not hard-code bounds or "today" — read them off the bundle.

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

## Pending outputs (L14)

Real outputs that haven't shipped surface as **pending**, never fabricated
and never thrown (prerender-safe). `bundle.pending: string[]` is the sorted
marker list components read:

- `'metrics'` — `metrics.json` absent, or present without the case key
  (`bundle.metrics`/`metricsView` are `undefined`).
- `'series'` — no series file resolved (`bundle.series` is `undefined`;
  `now` still derives its timeline from layer dates, so `'series'` only
  appears there when even that yields nothing).
- `<product-id>` — a product **declared** (non-null path) in the products
  map but missing from storage; `null`-declared keys are absent by
  contract, not pending.

`getAlerts()` returns `AlertsFile | undefined` — absent `alerts.json` →
`undefined` (the `/alerts` page renders pending). `getMetrics()` and
`getSeries()` likewise return `undefined` on absence. Only two things still
throw: a missing root `manifest.json`, and a case with no bounds anywhere
(`data: bounds not found`).

## Live overlay (L8)

When GEE service-account creds are present (`GCP_SA_KEY` /
`GEE_SERVICE_ACCOUNT_KEY`), `getCaseBundle` overlays live Earth Engine data
onto the static bundle before returning:

- `getNumbers({caseId, date})` — replay cases query `reference_date`; `now`
  queries the latest observed date (the `_d0` layer date, else
  `data_dates.observed`, else `reference_date`). Applied fields:
  `people_exposed` → `metricsView.people_critical`; `flooded_km2` →
  `metricsView.flooded_km2` and `metricsView.flood_source = 'nisar'` (the live
  flood asset is NISAR GCOV); `people_flooded` → `metricsView.people_flooded`.
  On `now`, `km2_critical` → `summary.critical_km2.any` (only that key) and
  `people_exposed` → `summary.people_exposed` + `summary.people_critical`.
- `getLayerMeta(caseId)` → `bundle.liveLayers: LayerMeta[]`. An answered but
  **empty** layers array means GEE is up yet nothing is published — degraded.

New bundle fields: `liveLayers`, `dataSource` (`'gee'` when live content
applied, `'static'` when credentialed but nothing applied, undefined when not
credentialed), `dataDate` (`numbers.data_date` when live numbers applied).
`fallback` additionally becomes true when credentialed and every live call
failed or the layer probe came back empty — the user sees last-good static
although live was expected. Without creds `fallback` keeps its remote-miss
meaning only. The front renders "Showing last saved data from
`<updated_at ?? dataDate>`" when `fallback` is true.

## metrics.json (flat keys)

`toMetricsView()` accepts the flat v4 metrics and the legacy nested mock
(`flood`/`model`/`alert`/`cloud`/`impact`) and returns one `MetricsView`.
Percent fields (`cloud_pct`, `landslide_hit_pct`, `hand_validation`,
`night_light_drop_pct`, `warned_before_pct`) arriving on a 0-100 scale are
divided by 100 — **the UI always gets 0-1 fractions**. `*_pct` is authored
0-100 per SCHEMA, so any value `>= 1` is read as 0-100 (an authored `1` means
1% → `0.01`); only values `< 1` get the 0-1 tolerance. Scores (`iou`, `f1`,
`*_auc`) are ratios and pass through; unknown flat keys (e.g. `landslide_ml`)
pass through untouched. Legacy mapping: `flood.area_km2→flooded_km2`,
`model.auc→rf_auc`, `alert.lead_hours_median→lead_time_median_h`,
`impact.people_exposed→people_critical`, `impact.lights_out_pct→night_light_drop_pct`.

Optional analysis keys (all absent-safe, passthrough unless noted):
`swath_coverage_pct` (percent → 0-1), `flooded_km2_scope` (e.g. "within
NISAR swath"), `flood_top_clusters` (`{area_km2, lat, lon, where?}[]`),
`hand_validation_radii` (`radius_m -> iou` map), `hand_best_radius_m`.

`flood_source` is an optional pipeline-written enum: `'nisar'|'opera'|'observed'|null`.
It identifies the sensor source of `flooded_km2` and `people_flooded`:
`nisar` means NISAR GCOV confirmed, `opera` means OPERA DSWx/optical reference,
and `observed` means anything else. Null or absent means no source claim.
Flat metrics pass it through untouched; legacy nested metrics leave it undefined.
The UI labels "Flooded area (NISAR)" only when `flood_source === 'nisar'`.

### lead time (retrospective)

Flat metrics.json keys describing lead time in a retrospective replay of the
event. All optional; all pass through `toMetricsView()` untouched except the
`*_pct` keys, which normalize to 0-1 like every other percent field. Legacy
nested metrics never synthesize these keys — they stay absent.

| Key | Type | Meaning |
| --- | --- | --- |
| `lead_time_iqr_h` | `[number, number]` | `[p25, p75]` hours |
| `warned_24h_pct` | number | share with lead >= 24h (0-1 after normalization) |
| `never_critical_pct` | number | share never flagged critical (0-1 after normalization) |
| `n_points` | number | damage points used in the calculation |
| `anchor_precision` | `'hour'\|'date'\|'mixed'` | precision of the damage timestamps |
| `event_lead_h` | number | event-level anchor lead, hours |
| `official_warning_delta_h` | `number\|null` | + = TPI earlier than first official warning |
| `critical_area_km2` | number | area flagged critical |
| `critical_area_with_damage_pct` | number | share of critical area with damage (0-1) |
| `lead_time_hist` | `LeadTimeHist` | `{bin_h, from_h, counts[]}` — `counts[i]` covers `[from_h+i*bin_h, +bin_h)`; negative bins allowed |
| `lead_time_assumptions` | `LeadTimeAssumptions` | `{imerg?, smap?, geos_fp?, quality?: 'measured'\|'placeholder', …}` |
| `damage_anchor` | `DamageAnchor` | `{at, source?, url?}` — `at` is ISO 8601 or `YYYY-MM-DD` |

Honesty note: these are retrospective replay numbers only. The UI always shows
median + IQR + `n_points` + `never_critical_pct` together; placeholder values
are flagged via `lead_time_assumptions.quality === 'placeholder'`. The
`damage_anchor` is also mirrored in `events/*.json` — keep them consistent.

## forecast_source

Case-level or now-level string. UI labels via `forecastSourceLabel()`:
`perfect-forecast` → "perfect forecast" (replay), `geos-fp` → "GEOS-FP"
(live). Unknown values pass through verbatim.

## Asset paths

`resolveAsset(base, caseDir, path)`: null/empty → `undefined`; absolute
http(s) passthrough; otherwise `base/caseDir/key`
(keys already carrying the case dir are not doubled).
