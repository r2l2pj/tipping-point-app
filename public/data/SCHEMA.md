# Data contract — `data/` (doc v4)

Everything the app reads comes from this directory. Pipelines write it; the
app never computes. This file is the single source of truth for the contract
between this repo and `tipping-point-app` — the app's `docs/app-contract.md`
only points here and lists what the app does with each item.

**Case ids.** Canonical case keys are `rs_2024` and `wa_2025` — they name the
data directories (`data/rs_2024/`, `data/wa_2025/`), the manifest keys,
config.yaml and the `<caso>` filename stems. Event ids `rs-2024-05` /
`wa-2025-12` remain ONLY as each manifest node's `event_id` and the
`events.json` entry ids. `now` is both the key and the directory for the
live bundle. The app's `caseAlias()` maps both directions, so asset paths are
always written out explicitly — the app never derives a path from a key.

**Write order.** Every manifest is written LAST of its unit:
`data/now/manifest.json` after each live run's files, `data/manifest.json`
after everything else, `metrics.json` via atomic merge. Readers key on a
non-null `updated_at`; a null/absent `updated_at` means a run is in progress.
The app must never glob — every file it reads is either a fixed name below or
listed in the manifest.

CRS rules (v4):
- **COGs and GeoJSON: EPSG:4326** (COGs may also keep the NISAR product's
  native CRS).
- **PNGs for MapLibre image sources: EPSG:3857.** A 4326 PNG stretched over
  lon/lat corner coordinates misaligns at these latitudes; `live/render.py`
  warps class grids to Web Mercator before encoding, and each manifest layer
  carries `bounds` = the 3857 image extent in lon/lat `[w, s, e, n]`.

## Layout

```
data/
├── events.json                  # case index the app loads first
├── manifest.json                # the contract the app reads — written LAST
├── metrics.json                 # ONE file: per-case blobs keyed by case id
├── SCHEMA.md                    # this file
├── raw/                         # downloads — gitignored, never app-read
├── <case-id>/                   # one dir per case (rs_2024, wa_2025)
│   ├── cog/                     # rasters, clipped to AOI, keep each <= ~20 MB
│   ├── png/                     # pre-rendered EPSG:3857 PNGs (one per layer/day)
│   ├── geojson/                 # polygons/points, EPSG:4326
│   ├── series/                  # time series JSON for charts
│   └── nisar_products.json      # granule ids used (→ metrics collections)
└── now/                         # live bundle, overwritten every 3 h
    ├── manifest.json            # schema tipping-point/now@2 — written LAST
    ├── summary.json             # headline numbers for the side panel
    ├── alerts.json              # alert candidates for the bot/side panel
    ├── prev_classes.npz         # internal state (upgrade detection)
    ├── cog/                     # today's + D+1 TPI COGs (EPSG:4326)
    ├── geojson/critical_areas.geojson
    └── png/<layer>_d<k>.png     # tpi_{slide,flood}_d0..d3
```

## File naming

Stable app-read names, per case directory — the app reads exactly these:

- `series/imerg_smap_daily.json`
- `geojson/{priority_zones,permanent_water,flood_confirmed,landslide_candidates,places,municipal_boundaries,landslide_catalog}.geojson`
- `png/<layer-id>_<YYYYMMDD>.png` — EPSG:3857, `YYYYMMDD` = the day the layer
  depicts (the layer's `date` field), `<layer-id>` = the manifest layer `id`
  (incl. `_d<k>` forecast suffixes)

Dated pipeline outputs keep the `<caso>_<camada>_<AAAAMMDD>.*` stem under
`cog/`, `geojson/` and `series/` — e.g. `rs_2024_tpi_slide_20240502.tif`,
`wa_2025_swot_20251210.json`. `<caso>` is the config.yaml case key
(`rs_2024`, `wa_2025`) — the same id that names the directory.

`now/` forecast PNGs are `png/<layer>_d<k>.png` (d0 = today, d1..d3 =
forecast days).

## data/events.json

The case index, schema `tipping-point/events-index@1`:

```json
{ "schema": "tipping-point/events-index@1",
  "events": [
    { "id": "rs-2024-05", "title": "...", "bbox": [w, s, e, n],
      "reference_date": "2024-05-02", "layers": [] } ] }
```

Entry `id` is the hyphen **event id** — it equals the manifest node's
`event_id`, NOT the underscore manifest case key (which names the directory
and `<caso>` stems). `layers[]` is refreshed at publish time (runtime only;
the app uses it for layer hints).

## data/manifest.json (root)

```json
{ "updated_at": "2026-11-15T09:00:00Z",
  "cases": {
    "rs_2024": {
      "event_id": "rs-2024-05",
      "mode": "replay",
      "bounds": [-52.5, -30.5, -50.5, -29.0],
      "forecast_source": "perfect-forecast",
      "layers": [
        { "id": "tpi_slide", "date": "2024-05-02",
          "png": "rs_2024/png/tpi_slide_20240502.png",
          "cog": "rs_2024/cog/rs_2024_tpi_slide_20240502.tif",
          "asset": "projects/<GEE_PROJECT>/assets/tipping-point/rs_2024/tpi_slide_series",
          "legend": ["Baixo", "Moderado", "Alto", "Crítico"],
          "bounds": [-52.6, -30.6, -50.4, -28.9] },
        { "id": "tpi_slide_d1", "date": "2024-05-03",
          "png": "rs_2024/png/tpi_slide_d1_20240503.png",
          "cog": "rs_2024/cog/rs_2024_tpi_forecast_d1_20240502.tif",
          "asset": null,
          "legend": ["Baixo", "Moderado", "Alto", "Crítico"],
          "bounds": [-52.6, -30.6, -50.4, -28.9],
          "forecast": true },
        { "id": "r_series", "date": "2024-05-02",
          "png": null, "cog": "rs_2024/cog/rs_2024_r_series_20240502.tif",
          "asset": "projects/<GEE_PROJECT>/assets/tipping-point/rs_2024/r_series" }
      ],
      "metrics": "metrics.json#rs_2024",
      "data_dates": { "imerg": "2024-05-02", "smap": "2024-04-30" },
      "products": { "places": "rs_2024/geojson/places.geojson", "...": "..." },
      "_null_reasons": { "flood_confirmed": "no NISAR coverage — event predates launch (Jul 2025)" }
    },
    "wa_2025": { "event_id": "wa-2025-12", "...": "..." },
    "now": { "...": "copied verbatim from data/now/manifest.json" }
  } }
```

- Case keys are the canonical underscore ids (`rs_2024`, `wa_2025`, `now`).
- Every asset path is a repo-relative path under `data/` (which syncs to the
  app's `public/data/`): `rs_2024/png/...`, `now/summary.json`. Never
  derived from the key or `event_id`.
- Per-case node fields: `event_id`, `mode` (`replay` | `live`), `bounds`
  `[w, s, e, n]`, `layers[]`, `metrics` (`metrics.json#<case>` fragment into
  the single root metrics file), `data_dates`, `products`,
  `forecast_source`, `_null_reasons`.
- `data_dates`: the freshest date of each input actually used —
  `{imerg, smap, geos_fp_issued?, nisar_pre?, nisar_post?, ...}`.
- `forecast_source`: `"perfect-forecast"` for replay cases (D+1..D+3 =
  observed IMERG as forecast), `"geos-fp"` for the live bundle. The app must
  render forecast days differently (never like observed).
- `data_basis`: provenance/latency honesty label. Replay cases carry
  `"hindcast — IMERG_V07 + SMAP SPL4SMGP as archived in GEE (no real-time
  latency modelled); not as-available"` — the frames answer "what TPI would
  have said on day D with the archive we have now", NOT "what was visible at
  D". The lead-time series (live-acceptance A5) is the only as-available
  view: IMERG Early ~4 h latency + SMAP at its real L4 latency, no D+k
  data.
- The `now` node is copied from `data/now/manifest.json` by
  `tools/build_manifest.py` (schema `tipping-point/now@2`).
- Per-case `data/<case>/manifest.json` files are not part of the contract —
  the root manifest is authoritative (the app only falls back to them for
  legacy synced data).

### Layer fields

`{id, date, png, cog, asset, legend, bounds, forecast?}`:

- `id` — one of the layer ids below; repeated ids with different `date`s are
  a per-day series.
- `date` — `YYYY-MM-DD`, the day the layer depicts.
- `png` — EPSG:3857 pre-render for the MapLibre image source; `null` on
  COG-only layers (`bounds`/`legend` then unused).
- `cog` — download/reproducibility raster (EPSG:4326 or NISAR native); may be
  `null` on PNG layers, required on COG-only layers.
- `asset` — full GEE asset id backing the layer
  (`projects/<GEE_PROJECT>/assets/tipping-point/...`), or `null` for
  file-only layers. `asset` is the primary source (served via the app
  server); `png`/`cog` stay as fallback — see "GEE assets".
- `legend` — pt-BR class names in index order, pinned exactly as
  `live/config.py LABELS`: `["Baixo", "Moderado", "Alto", "Crítico"]` for
  class values 0–3. The app maps by index to its own label names — order
  must never change.
- `bounds` — the PNG extent in lon/lat `[w, s, e, n]` (image-source corners).
- `forecast: true` — forecast layers only (`<layer>_d<k>` ids, k = 1..3).

### Layer ids

`tpi_slide`, `tpi_flood` — classified TPI geomean (class legend above);
forecast variants `tpi_slide_d1..d3`, `tpi_flood_d1..d3` carry
`forecast: true`. Reference/validation layers: `hillshade` (NASADEM terrain
shade), `nisar_pre`, `nisar_post` (NISAR GCOV backscatter),
`opera_validation` (OPERA DSWx water map used for flood validation),
`night_lights_pre`, `night_lights_post` (VIIRS Black Marble composites),
`t_ml` (XGBoost-modeled hazard; same class legend).

COG-only score layers — for geotiff.js range reads; `png: null`, EPSG:4326,
still listed in `layers[]`: `r_series`, `s_series` (per-day R/S score
series, one band per day named `YYYYMMDD`), `t_slide`, `t_flood` (static
terrain-score rasters). Files `<caso>_r_series_<AAAAMMDD>.tif` etc. under
`cog/`. `tpi_slide`/`tpi_flood` remain the CLASS renders — different layers
from the score series.

**Date-label convention:** a band/layer named `YYYYMMDD` is labeled by the
**end** of its accumulation window — the 3-day rain sum filtered
`[end − 3 days, end)`. A layer labeled `20240503` therefore covers rain
from Apr 30 through May 2 and a TPI peak on that label is *before or on*
the event date (2024-05-02). The series reads correctly when interpreted
as "conditions at the end of day D".

### products map

Non-raster discovery, per case node (D3). Every value is a repo-relative
path or `null`:

```json
"products": {
  "municipal_boundaries": "rs_2024/geojson/municipal_boundaries.geojson",
  "landslide_catalog":    "rs_2024/geojson/landslide_catalog.geojson",
  "places":               "rs_2024/geojson/places.geojson",
  "priority_zones":       "rs_2024/geojson/priority_zones.geojson",
  "permanent_water":      "rs_2024/geojson/permanent_water.geojson",
  "flood_confirmed":      "rs_2024/geojson/flood_confirmed.geojson",
  "landslide_candidates": "rs_2024/geojson/landslide_candidates.geojson"
},
"_null_reasons": {
  "flood_confirmed": "no NISAR coverage — event predates launch (Jul 2025)"
}
```

`products` values are strictly `string | null`. A `null` product carries its
reason under the case node's `_null_reasons` (a sibling of `products`, same
convention as metrics.json) — never inside the map itself.
`flood_confirmed` is only non-null when a NISAR or
otherwise validated flood mask exists. Landslide outputs are always
**candidates**, never "confirmed" — no ground-truth confirmation step exists.
`municipal_boundaries` (IBGE for RS, US Census TIGER for WA) and
`landslide_catalog` (GLC for WA, UFRGS/Cemaden inventory for RS) are
reference layers — never index inputs, credited in the footer.

## Series files

### `series/imerg_smap_daily.json`

The chart series per event:

```json
{ "event": "rs-2024-05",
  "reference_date": "2024-05-02",
  "rain_p95_mm": 45.0,
  "tpi_threshold": 0.6,
  "days": [
    { "date": "2024-05-01", "offset": -1, "kind": "observed",
      "imerg_mm": 12.4, "smap": 0.71, "tpi": 0.55, "river_m": null },
    { "date": "2024-05-03", "offset": 1, "kind": "forecast",
      "imerg_mm": 8.0, "smap": 0.73, "tpi": 0.62, "river_m": 4.1 }
  ] }
```

- `offset` — days relative to `reference_date` (0 = event day).
- `kind` — `"observed"` | `"forecast"` | `"hindcast"`; replay forecast days
  (perfect forecast) are `"forecast"`.
- `smap`, `tpi` — 0–1. `river_m` — SWOT reach level, `null` when no reach.
- `rain_p95_mm` — the p95 daily-rain climatology used for the rain axis;
  `tpi_threshold` — the Alto cut (config.yaml `tpi_classes`).

### `series/<caso>_swot_<AAAAMMDD>.json`

Dated SWOT river-level series per reach (pipeline output, e.g.
`rs_2024_swot_20240502.json`); the publisher merges it into
`imerg_smap_daily.json`'s `river_m`.

## GeoJSON feature shapes

All FeatureCollections are EPSG:4326. `priority_zones` features carry:

```json
{ "rank": 1, "name": "Canoas", "tpi": 0.78,
  "class": "Critical", "hazard": "landslide",
  "area_km2": 3.4, "people": 12400 }
```

`rank` (1 = worst), `name` (nearest place), `tpi` (0–1),
`class` (`Low|Moderate|High|Critical`), `hazard`, `area_km2`, `people`
(population in zone or `null` + reason). Other products
(`flood_confirmed`, `landslide_candidates`, `permanent_water`, `places`,
`municipal_boundaries`, `landslide_catalog`) are plain FeatureCollections;
landslide polygons are always `landslide_candidates`.

## data/metrics.json

ONE root file, per-case blobs keyed by case id. Each blob holds the flat v4
key set plus `_null_reasons` and `collections`; the manifest case node points
at its blob via the `metrics` field (`"metrics.json#rs_2024"`).

```json
{ "cases": {
    "rs_2024": {
      "event": "rs-2024-05",
      "iou": 0.0, "f1": 0.0, "cloud_pct": 0.0,
      "landslide_hit_pct": 0.0, "hand_validation": 0.0,
      "people_critical": 0, "people_flooded": 0, "flooded_km2": 0.0,
      "flood_source": "opera",
      "night_light_drop_pct": 0.0,
      "lead_time_mean_h": 0.0, "lead_time_median_h": 0.0,
      "warned_before_pct": 0.0,
      "rf_auc": 0.0, "rule_auc": 0.0, "feature_importance": {},
      "forecast_source": "perfect-forecast",
      "collections": { "...": "..." },
      "_null_reasons": { "...": "..." }
    },
    "wa_2025": { "event": "wa-2025-12", "...": "same flat key set" }
  } }
```

- `flood_source` — flat string identifying the input behind the flood numbers:
  `"nisar"` for a NISAR GCOV flood-mask asset, `"opera"` for a validated OPERA
  DSWx product, `"observed"` for other observed inputs; `null` with a reason
  when no flood number is emitted. A null update never clobbers a written
  source (`tp.metrics.merge_metrics`). Mock cases use `wa_2025: "nisar"` and
  `rs_2024: "opera"`; runtime values describe the input actually used.
- `forecast_source` — `"perfect-forecast"` for replay cases; the live now
  bundle uses `"geos-fp"`.
- `collections` — `{ "<dataset>": "<collection id/version>" }` for the inputs
  that produced the numbers (e.g. `NISAR_L2_GCOV_BETA_V1`,
  `OPERA_L3_DSWX-HLS_V1`, IMERG V07, SMAP L4, GPW epoch). General rule:
  record what was actually used.
- `_null_reasons` — `{ "<key>": "<why>" }` inside each case blob; any key
  written `null` must have a reason. `tp.metrics.merge_metrics` merges
  atomically into the root file keyed by case: never drops keys or cases,
  never overwrites a written non-null value.
- `iou`/`f1`/AUCs are 0–1 ratios; `*_pct` keys are 0–100 (the app normalizes
  `> 1` values to 0–1 for display).
- `hand_validation` is a scalar 0–100 percentage: the HAND<5 m zone IoU
  against MERIT at the selected radius, suitable for the app `MetricsV4`
  percentage renderer. `hand_validation_radii` preserves per-radius `{r, iou}`
  ratios; `hand_best_radius_m` is selected by maximum `r + iou` and written
  back to `config.yaml` `thresholds.hand_proxy_radius_m`. No valid comparison
  produces null plus `_null_reasons`, not an object in `hand_validation`.
- `rf_auc` is the XGBoost model AUC — the key name stays for contract
  stability; public text says "XGBoost". Detailed sub-results may nest under
  extra sections (e.g. `landslide_ml`); the keys above stay flat.

Writers (merge via `tp.metrics.merge_metrics` into the case's blob in the
root file, never `write_text` on the file): `04_validation.py` (iou, f1,
cloud_pct), `gee/09_impact.js` /
`gee/impact.py` (people_critical, people_flooded, flooded_km2,
night_light_drop_pct — merge its CSV printout), `gee/04_hand_vs_merit.js` /
`gee/hand.py` (hand_validation), `08_landslide_hit.py` (landslide_hit_pct),
`ml/lead_time.py` (lead_time_*, warned_before_pct), `ml/evaluate.py`
(rf_auc = learned-model AUC, rule_auc = manual slope rule,
feature_importance; XGBoost stands in for the doc's in-GEE Random Forest —
see ml/README.md), `07_forecast.py` (forecast_source).

## data/now/ — the live bundle

Moved from repo-root `now/` so `scripts/sync-data.mjs` copies it with
everything else. Overwritten every 3 h by `live/run_now.py` via
`.github/workflows/now.yml`; all files are written before
`manifest.json`, which is written LAST — a consumer keying on a non-null
`updated_at` never reads a half-updated set.

### `data/now/manifest.json` — schema `tipping-point/now@2`

```json
{ "schema": "tipping-point/now@2",
  "mode": "live", "updated_at": "2026-11-15T09:00:00Z",
  "bounds": [-58.0, -34.0, -48.0, -22.5],
  "data_dates": { "imerg": "...", "smap": "...", "geos_fp_issued": "..." },
  "layers": [
    { "id": "tpi_slide_d0", "date": "2026-11-15",
      "png": "png/tpi_slide_d0.png", "cog": "cog/tpi_slide_today.tif",
      "asset": "projects/<GEE_PROJECT>/assets/tipping-point/now/tpi_slide_d0",
      "legend": ["Baixo", "Moderado", "Alto", "Crítico"],
      "bounds": [-58.0, -34.0, -48.0, -22.5], "forecast": false },
    { "id": "tpi_slide_d1", "forecast": true,
      "asset": "projects/<GEE_PROJECT>/assets/tipping-point/now/tpi_slide_d1",
      "...": "..." }
  ],
  "products": { "critical_areas": "geojson/critical_areas.geojson",
                "summary": "summary.json", "alerts": "alerts.json" },
  "nisar_passes": [ { "date": "...", "track": "...", "note": "..." } ] }
```

Paths inside this file are relative to `data/now/`. Layers are
`tpi_{slide,flood}_d0` (today) plus `_d1..d3` with `forecast: true`.

### `data/now/summary.json`

```json
{ "generated_at": "...",
  "critical_km2": { "slide": 0.0, "flood": 0.0, "any": 0.0 },
  "people_critical": 0,
  "people_exposed": 0,
  "forecast_source": "geos-fp",
  "classes_km2": { "Baixo": 0.0, "Moderado": 0.0, "Alto": 0.0, "Crítico": 0.0 },
  "data_dates": { "imerg": "...", "smap": "...", "geos_fp_issued": "..." } }
```

`people_critical` and `people_exposed` are both emitted with the same value
(the flat metrics key and the legacy alias).

### `data/now/alerts.json`

```json
{ "generated_at": "...",
  "quiet_hours": false,
  "rule": "upgrade to Alto/Crítico today or D+1; quiet 23h-6h unless Crítico",
  "candidates": [
    { "class": 3, "label": "Crítico", "centroid": [-51.2, -29.9],
      "pixels": 42, "hold": false } ] }
```

`candidates[]` pinned exactly as `live/alerts.py` emits it: `class` int
(2 = Alto, 3 = Crítico), `label` pt-BR class name, `centroid` `[lon, lat]`,
`pixels` int, `hold` = quiet-hours (23h–6h) held flag (only set on Alto
upgrades; Crítico is never held). These are alert *candidates* — the bot owns
sending and rate limiting.

`prev_classes.npz` is internal state for upgrade detection between runs —
not app-read.

## GEE assets

The rasters also live under the GEE asset namespace
`projects/<GEE_PROJECT>/assets/tipping-point/` so the app server can read
them server-side (geotiff.js/ee range reads). Tree:

```
tipping-point/
├── static/<domain>/             # domain = south_brazil | wa_2025
│   ├── clim_rain                # ImageCollection, `doy` property;
│   │                            #   bands p90|p95|p99 = 3-day-sum mm percentiles,
│   │                            #   int16 mm*10 (config.yaml climatology.scale)
│   ├── slope                    # degrees
│   └── hand                     # metres
├── <case>/                      # rs_2024, wa_2025
│   ├── tpi_slide_series, tpi_flood_series, r_series, s_series
│   │                            # multiband, one band per day named YYYYMMDD
│   ├── t_slide, t_flood         # single-band static terrain scores
│   ├── landslide_candidates_hls
│   └── ...                      # further ingested rasters — names in data/<case>/assets.json
└── now/
    ├── imerg_early, smap_l4, geosfp                            # input collections
    └── tpi_slide_d0..d3, tpi_flood_d0..d3, r_d0..d3, s_d0..d3   # single-day images
```

- Every derived asset carries the image properties `data_date`
  (YYYY-MM-DD) and `updated_at` (ISO-8601) — readers can check freshness
  without the manifest.
- Climatology layout (approved): per-case `static/<case>/clim_rain`
  collections cover the case's event window (~25 doys over the case AOI);
  the live now mode uses a rolling ~75-doy window over the `domains.now`
  bbox in config.yaml at `static/south_brazil/clim_rain`. Percentile bands
  are stored int16 mm*10 (~0.9 GB total). The read interface is unchanged —
  `doy` image property, `p90|p95|p99` bands — with consumers dividing by
  `climatology.scale` (`tp.config.clim_scale()`) before scoring.
- Reader rule: a manifest layer's `asset` is the PRIMARY source (served via
  the app server); `png`/`cog` remain the fallback, unchanged.
- Extra ingested rasters beyond the names above are recorded by asset id in
  `data/<case>/assets.json` (per case, written by the gathering ingest tool).

## Fallback branch (no GCS)

There is no Cloud Storage bucket anywhere in this pipeline (ruling L10).
`tools/export_fallback.py --now|--case` writes fallback files **locally**
into `data/` — PNGs via `getThumbURL` (EPSG:3857), JSON numbers via
`reduceRegion().getInfo()`, GeoJSON via `reduceToVectors().getInfo()`, and
COGs only via `getDownloadURL` when the download is under 10 MB (larger
rasters are skipped with a logged reason). The live workflow then publishes
`data/` to the orphan branch `fallback` of this repo (force-pushed each run
so history does not grow), and the app reads it via
`DATA_BASE_URL=https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/`.
The layout on that branch is exactly the `data/` tree above, with manifests
written last (`data/now/manifest.json` last in its group, `data/manifest.json`
last overall).

## Who writes what

| File | Writer |
|---|---|
| `data/events.json` | hand-maintained; `layers[]` refreshed by `tools/publish_case.py` |
| `data/manifest.json` | `tools/build_manifest.py` — merges per-case nodes + `data/now/manifest.json`; written LAST |
| `data/metrics.json` | `pipeline/tp/metrics.py::merge_metrics` — atomic merge into the per-case blob keyed by case id; contributors listed above |
| `data/<case>/cog/<caso>_tpi_{slide,flood}_<AAAAMMDD>.tif` | `python -m gee.tpi` (`gee/01_tpi_index.js`, `gee/07_tpi_wa.js` — multiband, one band per day) |
| `data/<case>/cog/<caso>_{r,s}_series_<AAAAMMDD>.tif`, `<caso>_t_{slide,flood}_<AAAAMMDD>.tif` | `python -m gee.tpi` — score series + static terrain scores (COG-only geotiff.js layers) |
| `data/<case>/cog/<caso>_tpi_forecast_d{1,2,3}_<AAAAMMDD>.tif` | `pipeline/scripts/07_forecast.py` / `tp/forecast.py` (perfect forecast) |
| `data/<case>/cog/<caso>_water_nisar_<AAAAMMDD>.tif` | `pipeline/scripts/02_flood_mask.py` / `tp/flood_mask.py` (NISAR GCOV, wa) |
| `data/<case>/cog/<caso>_landslide_candidates_<AAAAMMDD>.tif` | `pipeline/scripts/03_landslide_coh.py` (coherence) / `09_hls_scar.py` / `tp/hls_scar.py` (wa HLS optical) |
| `data/<case>/cog/<caso>_hazard_slide_series_*.tif`, `hazard_classes.tif` | `ml/predict.py` (XGBoost — source of the `t_ml` layer) |
| `data/<case>/geojson/<dated>.geojson` | `pipeline/scripts/06_polygonize.py` / `tp/polygonize.py` |
| stable `geojson/*.geojson`, `png/<layer>_<YYYYMMDD>.png`, `series/imerg_smap_daily.json` | `tools/publish_case.py` / `tp/bundle.py` — PNGs via `live/render.layer_png_3857` + `tpi.classify` |
| `geojson/municipal_boundaries.geojson`, `geojson/landslide_catalog.geojson` | lead-gathering fetchers (IBGE / US Census TIGER; GLC / UFRGS-Cemaden) |
| `data/<case>/series/<caso>_swot_<AAAAMMDD>.json` | `pipeline/scripts/05_swot.py` / `tp/swot.py` |
| `data/<case>/nisar_products.json` | `pipeline/scripts/01_get_nisar.py` / `tp/nisar.py` (granule ids → `collections`) |
| `data/now/*` | `live/run_now.py` (static grid `static/sul_static.npz` from `live/build_static.py`) |
| `projects/<GEE_PROJECT>/assets/tipping-point/**` | `python -m gee.tpi` (static/<case>), `live/run_now.py` (now/), publish ingest (`tools/publish_case.py`) |
| `data/<case>/assets.json` | lead-gathering ingest tool — records extra ingested asset ids per case |
| `data/raw/**` | fetch scripts (NISAR, OPERA DSWx, HLS, MODIS NRT) — gitignored |
| `simular.json` | `tools/build_simular.py` — an **app-side fixture** for the Telegram `/simular` demo, NOT a contract product |

## Conventions

- Nodata: rasters carry a written nodata value (uint8 class grids use 255);
  PNG renders mask nodata transparent; GeoJSON omits empty geometries.
- `data/raw/` is gitignored — never commit downloads; commit only clipped
  outputs.
