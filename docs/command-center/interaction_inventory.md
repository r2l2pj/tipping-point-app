# Interaction inventory: Command Center prototype against the real app

Date: 2026-11-14. Companion to `concepts_brief.md`.
App: `r2l2pj/tipping-point-app` at `4a7549b`. Data: `r2l2pj/tipping-point-data`, branch
`fallback`, commit `19c56df` (2026-11-14 19:54 UTC).

One row per control or element of the prototype (board "Command center (chosen)").
"Data today" says whether real data backs the element in each case: yes, part, no.
"Status" is a proposal under option (b) of decision D1 in the brief (video path on real data,
everything else listed). It is not decided.

Status words:
- works: can be built on real data now.
- works + pending: the control works; where data is missing it shows "not published yet".
- relabel: works with different wording or behavior than the prototype, to keep a business rule.
- cut: removed from the screen.
- decision: depends on an open decision in the brief.

## Header

| # | Element | Real source | Now | WA | RS | Status |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Brand and tagline | static | yes | yes | yes | works |
| H2 | View switch Command Center / Public Alerts | `nowAlerts`, `/alerts` | no | no feed | no feed | works + pending: one shell, `/` and `/alerts` (decided, draft part 10) |
| H3 | Time switch Now / Replay | `bundle.mode`, `activeId` | no data in Now | yes | yes | works + pending |
| H4 | Region or event select | `cases[]` | one option | yes | yes | works; Now shows a label, not a select |
| H5 | Bell with notification list | none | no | no | no | cut, or count of real alert candidates in Now |
| H6 | Freshness (not in prototype) | `updated_at`, `fallback` | `updated_at: null` | null | null | works; "unknown age" for null |

## Layers column

| # | Element | Real source | Now | WA | RS | Status |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | Flood risk toggle | `tpi_flood*` PNG | no | yes | yes | relabel: single choice with L2 |
| L2 | Landslide risk toggle | `tpi_slide*` PNG | no | yes | yes | relabel: single choice with L1 |
| L3 | TPI index toggle | none (L1 and L2 are the TPI) | no | no | no | cut, or show/hide of the chosen hazard raster |
| L4 | Rain 3-day (GPM IMERG) | `imerg_*` PNG | no | no | no | works + pending (greyed, reason shown) |
| L5 | Soil moisture (SMAP) | `smap_*` PNG | no | no | no | works + pending (greyed, reason shown) |
| L6 | Radar (NISAR) toggle | `flood_confirmed` polygons | no | yes | no | relabel: "Flood confirmed by NISAR radar"; RS "no pass in 2024" |
| L7 | NISAR state line "pass in ~18 h", "from D+1" | pass dates (past only) | no | Dec 4, Dec 16 | none | relabel: real pass dates only |
| L8 | Rule line "at most two ..." | `MAX_DATA_LAYERS`, `capToggleQueue` | - | - | - | relabel to match the enforced rule; name the layer that was turned off |
| L9 | Legend: TPI classes and cuts | `cutsFor(bundle)` | yes | yes | yes | works |
| L10 | Legend: "Hatched: forecast" | `isForecastLayer`, day kind | - | yes | yes | works; hindcast needs a rule |
| L11 | Legend row "Landslide scar (radar)" | `landslide_candidates` | no | no | no | relabel: "Landslide scar candidate (HLS optical)"; hidden while null |
| L12 | Collapse the column | UI state | - | - | - | works; legend must stay visible |
| L13 | Data date per layer (not in prototype) | `data_dates` | no | yes | yes | works |

## Map

| # | Element | Real source | Now | WA | RS | Status |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | North arrow, scale bar | MapLibre controls | yes | yes | yes | works |
| M2 | "DEMO - SAMPLE DATA" chip | `isMockDerived(bundle)`, `fallback` | - | - | - | relabel: data status chip (sample, last saved, live, stale) |
| M3 | Caption chip: layer, step, date | layer state, `days[dayIndex]` | no | yes | yes | works + pending |
| M4 | Numbered pins for priority areas | `priority_zones` polygons | no | 44 | 44 | works; top N by rank; pin at polygon center; names repeat |
| M5 | Pin click selects the area | UI state | no | yes | yes | works |
| M6 | Callout: name, class, TPI, hazard | zone properties | no | yes | yes | works |
| M7 | Callout: basin | none | no | no | no | cut, or municipality from `municipal_boundaries` |
| M8 | Callout expand: R, S, T, inputs, dates | point read (`resolvePixelValues`) | no | part | part | relabel: loaded on click, with provenance label |
| M9 | Callout: formula text | specialist document | - | - | - | decision D6 (weighted or not) |
| M10 | Show or hide the Layers column | UI state | - | - | - | works |
| M11 | Recenter | `bundle.bbox`, `fit()` | yes | yes | yes | works |
| M12 | Zoom in, zoom out | MapLibre | yes | yes | yes | works |
| M13 | Inset locator map | none in the app | - | - | - | cut, or static SVG |
| M14 | Forecast steps hatched | `forecast` flag on layers | no | yes | yes | works |
| M15 | Before / after radar swipe | `nisar_pre`, `nisar_post` PNG | no | no (dates only) | no | works + pending; blocked on data (D7) |
| M16 | Click on the map: pixel popup (not in prototype) | existing popup | no | yes | yes | works; keep |

## Situation overview

| # | Element | Real source | Now | WA | RS | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | Status chip (reached, forecast, below) | `series.days[].tpi`, threshold, day kind | no (zeros) | yes | yes | works + pending; fourth state "no data" |
| S2 | One sentence on the situation | existing app text | - | - | - | works; app text, not prototype text |
| S3 | Tile: Critical area km2 | zones `area_km2`, or `summary` | no | yes | yes | works + pending; "as of" date |
| S4 | Tile: People potentially exposed | zones `people`, `metricsView` | no | no (null) | no (null) | works + pending ("not published yet") |
| S5 | Priority areas list: rank, name, class, TPI | `priority_zones` | no | yes | yes | works; snapshot, does not follow the timeline |
| S6 | Priority areas: people column | zones `people` | no | no | no | works + pending |
| S7 | Row click selects and centers | UI state, `flyTo` | no | yes | yes | works |
| S8 | "View all" / "Show less" | UI state | - | 44 rows | 44 rows | works |
| S9 | Chart: rain bars and soil line | `series.days` | no | yes | yes | works + pending |
| S10 | Chart: bar click moves the timeline | UI state | - | yes | yes | works; pauses playback |
| S11 | Chart: "Table" toggle | `series.days` | - | yes | yes | works |
| S12 | Chart: threshold and TPI line (not in prototype) | `TpiChart` | - | yes | yes | decision: keep or drop |
| S13 | Radar card: status text | `data_dates`, `flood_source` | no | yes | "no radar, before launch" | works |
| S14 | Radar card: "Show on map" | `flood_confirmed` | no | yes | no | works |
| S15 | Radar card: "Before / after" | NISAR PNG pair | no | no | no | works + pending; blocked on data (D7) |
| S16 | "Confirm with NISAR radar" | pass dates, flood polygons | no | yes | no | relabel: opens the confirmation, does not move the timeline |
| S17 | Replay check: lead time row | `metricsView.lead_time_*` | - | no | no | works + pending; median with IQR and n when present |
| S18 | Replay check: other rows | `metricsView` | - | flooded km2, swath | catalog hit rate | relabel: rows follow the metrics each case has |
| S19 | Replay check: details (not in prototype) | existing tab components | - | part | part | works; home for validation and impact content |
| S20 | Opt-in: share approximate location | none | - | - | - | cut, or device-only region lookup |
| S21 | Opt-in: consent checkbox | bot owns consent | - | - | - | relabel: consent text plus link |
| S22 | Opt-in: Telegram button | bot URL (no env var yet) | - | - | - | works when a bot URL is set; hidden otherwise |
| S23 | "Last saved data" notice (not in prototype) | `fallback` | - | - | - | works; keep, next to the status chip |

## Timeline

| # | Element | Real source | Now | WA | RS | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | Play / pause | existing | no steps | yes | yes | works |
| T2 | Previous / next step | existing buttons jump to first and last | no | yes | yes | works; changed to one step |
| T3 | Step buttons | `series.days` | no | Nov 30 to Dec 20 | Apr 22 to May 7 | works; real range, not D-5 to D+2 |
| T4 | Forecast steps and tag | `forecast_source` | no | "perfect forecast" | "perfect forecast" | relabel: tag from `forecastSourceLabel`, never fixed "GEOS-FP" |
| T5 | Marks "first Critical", "first damage" (not in prototype) | series, `damage_anchor` | - | part | part | works; keep |
| T6 | Data sources with age | `data_dates`, `updated_at` | no | dates only | dates only | relabel: absolute date first, age second |

## Public Alerts view

| # | Element | Real source | Now | WA | RS | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Main alert card in plain words | `candidatesToAlerts` | no (`alerts.json` absent) | no feed | no feed | works + pending; three states |
| P2 | "Alerts by region" list | same | no | no | no | works + pending |
| P3 | Contact line "Call 199" | `ALERT_FOOTER` | - | - | - | relabel: "SMS 40199" text from the app |
| P4 | Validity, certainty, held label (not in prototype) | alert fields | - | - | - | works; keep |
| P5 | Opt-in card | see S20 to S22 | - | - | - | same as S20 to S22 |

## Responsive

| # | Element | Status |
| --- | --- | --- |
| R1 | 1024 px: three columns | works; map width to check |
| R2 | 600 px and 390 px: one column | decision D5 |

## Count

71 rows: 33 works, 15 works + pending, 14 relabel, 5 cut (some with a cheaper replacement named
in the row), 3 decision, 1 repeats other rows (P5). H2 moved from decision to works + pending on
2026-11-14. Elements with no real data in any case today: L3, L4, L5, L11, M7, M13, M15, S4, S6,
S15, S17, S20, P1, P2, and everything in Now.
