# Data request for the Command Center screen

Date: 2026-11-14. From the front end to the data owner.
Checked against `tipping-point-data`, branch `fallback`, commit `19c56df` (2026-11-14 19:54 UTC)
and `data/SCHEMA.md` on that branch.

The new screen needs the items below. Part A is already in the contract and is only missing
from the published data. Part B is not in the contract; each item is either added to the
contract or dropped from the screen. Any value that cannot be produced should be `null` with a
reason in `_null_reasons`; the screen then shows "not published yet" with that reason.

## Part A - in the contract, missing today

### A1. Now (live bundle) - the screen opens here and it is empty

| Item | Contract place | Today |
| --- | --- | --- |
| TPI frames for today and D+1 to D+3, flood and landslide | `now/manifest.json` `layers[]`: `tpi_{slide,flood}_d0..d3` with `png`, `bounds`, `date`, `forecast` | `layers: []` |
| Run time | `now/manifest.json` `updated_at` | `null` |
| Input dates | `data_dates.imerg`, `data_dates.smap`, `data_dates.geos_fp_issued` | `{}` |
| Critical km2 and people | `now/summary.json` (`critical_km2`, `people_critical`, `classes_km2`, `forecast_source`) | file absent |
| Alert candidates | `now/alerts.json` (`candidates[]`, `quiet_hours`) | file absent |
| Critical areas | `now/geojson/critical_areas.geojson` | file absent |
| Recent NISAR passes over the area | `nisar_passes[]` | `[]` |

### A2. Both replay cases (rs_2024, wa_2025)

| Item | Contract place | Today |
| --- | --- | --- |
| Every daily TPI frame listed in the manifest | `cases.<id>.layers[]`, one entry per day and hazard | PNG files exist for 16 to 21 days (`png/_index.json`), but the manifest lists 4 dates only. The app reads the manifest, so the other days show no map frame. |
| People per priority zone | `priority_zones` feature `people` | `null` in all 44 zones of both cases |
| Case run time | `cases.<id>.updated_at` | `null` |
| Landslide candidates (post-event HLS optical) | `products.landslide_candidates` | `null` |
| Validation metrics | `metrics.json`: `iou`, `f1`, `cloud_pct`, `landslide_hit_pct`, `hand_validation` | absent (RS has `landslide_hit` as a nested block only) |
| Lead time | `lead_time_median_h` with IQR, n, never-critical share, histogram, `warned_before_pct`, `damage_anchor` | absent |
| Model scores | `rf_auc`, `rule_auc`, `feature_importance` | absent |
| Impact | `people_critical`, `people_flooded`, `night_light_drop_pct` | absent |
| Flood source | `flood_source` (`nisar`, `opera`, `observed`) | absent |
| Reference rasters | `hillshade`, `opera_validation`, `night_lights_pre`, `night_lights_post`, `t_ml` | not listed |
| River level series | `series/<case>_swot_<date>.json` | absent |

### A3. Washington only - the radar confirmation

| Item | Contract place | Today |
| --- | --- | --- |
| NISAR before image (2025-12-04) | layer `nisar_pre` with `png`, `bounds`, `date` | dates only, no image |
| NISAR after image (2025-12-16) | layer `nisar_post` with `png`, `bounds`, `date` | dates only, no image |

Without these two images the before / after swipe has nothing to show. The confirmed flood
polygons (`flood_confirmed`, 28 km2 inside the swath, 74.1% of the area covered) are present.

## Part B - not in the contract

| # | Need of the screen | Why | If not provided |
| --- | --- | --- | --- |
| B1 | Rain map layer and soil-moisture map layer as PNG per day (`imerg_<date>`, `smap_<date>`) | two rows of the Layers column | the rows stay greyed with "no map layer for this case" |
| B2 | A daily series for Now (rain, soil, regional TPI per day) | the rain and soil chart and the status chip in Now | Now shows the summary numbers only; chart and chip read "not published yet" |
| B3 | Priority areas for Now with `rank`, `name`, `tpi`, `class`, `hazard`, `area_km2`, `people` | the priority list and the pins in Now | Now has no priority list |
| B4 | A distinct label per priority zone | 44 zones share 4 names ("Darrington" five times in the top seven) | the list groups zones by name or shows name plus rank |
| B5 | Fewer, merged priority zones, or zones of every class | all 44 zones are Critical, so the class column carries no information | the list shows the top N by rank |
| B6 | Priority zone values per day | the prototype list follows the timeline | the list is a snapshot with its date and does not follow the timeline |
| B7 | R, S and T per zone | the area detail | read on click from the score rasters, labelled with its source |
| B8 | Basin or municipality per zone | one line of the area detail | municipality from the boundaries file, or the line is dropped |
| B9 | Date of the next expected NISAR pass | the Layers state line "next pass" | the line shows past pass dates only |
| B10 | The formula as configured (weights or plain cube root) | the formula text in the area detail | the formula text is not shown |

## Confirmed by the front-end owner

- Refresh cadence of the live bundle: every 3 hours. It may change, so the screen reads the
  stale limit from one setting.
