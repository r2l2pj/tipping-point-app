# Command Center screen for tipping-point-app

*   **Author:** front-end owner
*   **Status:** Final for implementation. Not reviewed: the review round was dropped at the
    author's request (hackathon scope).
*   **Date:** 2026-11-14

Predecessor: `concepts_brief.md`. Companions: `interaction_inventory.md`,
`test_parity_checklist.md`, `data_request.md` (all in this folder).
App read at `r2l2pj/tipping-point-app` `4a7549b`, then re-read at `347f9a4` (five commits later,
2026-11-14 17:27 -03). Data read at `r2l2pj/tipping-point-data`, branch `fallback`, `19c56df`.
Where the two app commits differ, the text says so.

--------------------------------------------------------------------------------

## Overview

`tipping-point-app` is the web app of the Tipping Point project. It shows a risk index for
landslides and floods (TPI) from NASA rain and soil-moisture data, and it uses NISAR radar to
confirm floods after the event. The user is a municipal Civil Defense operator.

Today the app is a dark screen: a map, a floating layer list and a right panel with four tabs
(Alert, Radar, "Did we get it right?", Impact). This design replaces that screen with the
Command Center from the approved prototype: light chrome around a dark map, a Layers column, one
"Situation overview" panel without tabs, a timeline, a Now / Replay switch and a Public Alerts
view.

The prototype decides layout and interaction. The specialist document and the data contract
decide meaning: classes, cuts, wording about certainty, sources and their limits. Where the two
disagree, the data and the specialist document win and the screen changes.

Only the front end changes. The data pipeline, the data contract and the Telegram bot are owned
by other people. What the screen needs from them is listed in `data_request.md`.

## The Problem

1. **The four tabs hide the answer to the operator's first question.** "Is the tipping point
   reached, where, and how many people" is on the first tab; the confirmation, the proof and the
   impact are on three other tabs. The map changes its overlays when the tab changes, with no
   visible control. The approved prototype puts the situation on one panel and makes each map
   overlay an explicit control.

2. **The prototype is a simulation.** It computes its own index from invented arrays. It cannot
   be copied. Each element needs a real source in the bundle, and 14 of its 71 elements have no
   real data in any case today (`interaction_inventory.md`). The live "Now" case, where the
   prototype opens, is an empty seed.

3. **The app does not show that data is missing.** The loader records missing outputs in
   `bundle.pending`, but no component reads it. Missing zones show as "0.0 km2" and "0" people.
   On a screen for Civil Defense, "no data" shown as "no risk" is the worst error the screen can
   make. At `4a7549b` a Now case without a series was filled with zeros and read as "below the
   tipping point". `347f9a4` removed that fill, so Now has no series at all. The side effect:
   the map picks its TPI frame through the series day (`MapLayers.tsx:131-146`), so Now draws no
   frame and has no timeline steps even after the Now frames are published (read in the code,
   not run).

4. **The tabs are an input of the map code.** `overlayPlan(tab)` and `toggleBudget(tab)` in
   `src/lib/layers.ts` decide which overlays draw and how many layers the user may add. A screen
   without tabs needs another input for both.

5. **The rule tests are bound to the tab panel.** `tabs.test.tsx` pins 25 business rules through
   `SidePanel`. CI passes when no test exists, so removing the panel can remove the rules
   without any failure.

The proposed solution: a new screen built from new shell components, fed by the existing data
loader, with one explicit state for map overlays, one function that says what is missing, and
the 25 rule tests re-pointed at the new screen before the old one is removed.

## Goals

*   **G1. Every element of the inventory is delivered with its final status.** All 71 rows of
    `interaction_inventory.md` end as works, relabelled or cut, and the screen matches the row.
    No row is left as "decision".
*   **G2. No value is invented.** Every number, class, date and sentence on the screen comes
    from the case bundle or from existing app text. The browser computes no TPI and no class.
*   **G3. Missing data is visible as missing.** Each element has a defined state for absent
    data: the text "not published yet", plus the reason from `_null_reasons` when the data
    carries one. A Now case with no series never shows "Below the tipping point". A zone with
    `people: null` never counts as 0.
*   **G4. Nothing the four tabs show is lost.** Lead time with its histogram, the SWOT chart,
    feature importance, the two AUC values, IoU, F1, catalog hits, hand validation, the pass
    list, people flooded, flooded area, night-light drop, the exposure basis, "Why radar", and
    the five map overlays each have a named place and a visible trigger.
*   **G5. The business rules stay tested.** The 25 assertions of `test_parity_checklist.md` pass
    against the new screen. The 5 new assertions listed there are added.
*   **G6. The switch is one commit.** The old screen keeps working until the commit that points
    `src/app/page.tsx` at the new screen. Reverting that commit restores the old screen.
*   **G7. CI is green on every commit of the branch** (`bun run lint`, `bun test`,
    `bun run build`).
*   **G8. Time-dependent limits are settings.** The live refresh is every 3 hours and may
    change. The stale limit is derived from one setting.

## Non-Goals

*   Changes to the data pipeline or the data contract. Needs go to the data owner as requests.
*   A web subscription that stores a location or a consent record. The Telegram bot owns both.
*   A notification service. The screen may list alert candidates it already has; it sends
    nothing.
*   A light basemap. The specialist document requires the dark basemap; the prototype shows it.
*   A second computation of the index, of classes or of per-area values in the browser.
*   Both hazards drawn on the map at the same time. The data has one raster per hazard and the
    app draws one.
*   A sample-data mode. The repository removed its mock data on 2026-11-14.
*   Translation. The screen text stays in English, as the app is today.

## Open Questions

Two questions stay open. Both go to the specialist, and each has a default so the build does not
wait.

*   **Q5. The 0.60 cut.** Whether a value of exactly 0.60 is Critical. The specialist document
    says "above 0.6"; the code treats 0.60 as Critical and a test pins it. Default: keep the
    code. The comparison lives in one function.
*   **Q6. The formula text.** Whether the area detail may print `TPI = (R x S x T)^(1/3)`,
    given that the plan allows weights. Default: the formula text is not shown.

Closed with a default at wrap-up (2026-11-14). The author asked to close the design; these three
were not confirmed one by one and can be overruled without changing the structure:

*   **Q4. Narrow screens.** The target is a desktop of 1280 px or wider. At 1024 px the three
    columns stay. Below 900 px the page is one column: header, map, right panel, timeline; the
    Layers column becomes a drawer. No other phone work.
*   **Q7. The bell.** Cut. No notification data exists; the alert candidates are already shown
    in the Public Alerts view.
*   **Q9. Page payload.** A known limit, not in scope. The loader reads about 18 MB of GeoJSON
    from the data branch (WA 14.3 MB, of which the municipal boundaries are 8.4 MB; RS 4.0 MB;
    file sizes at `19c56df`). How much of it reaches the browser was not measured: a plain
    request to the deployed home page returned a 2 KB first response. The cheapest fix is under
    "Future Improvements".

Answered earlier: Q1 (overlay mechanism, part 8), Q2 (Public Alerts: one shell, two URLs,
part 10), Q3 (component structure, part 7), Q8 (chart lines), Q10 (hindcast days) and Q11 (bot
address), the last three in part 9.

## Critical User Journeys (CUJs)

Each journey states the real-data rule. "Not published yet" is the missing-data state of G3.
Ids in brackets refer to `interaction_inventory.md`.

### CUJ-1. Open the app

*   **Given** the live bundle has frames, a summary and a run time.
    **When** the operator opens `/`.
    **Then** the screen shows Now for Southern Brazil: the map with today's frame of the chosen
    hazard, the status chip, the two tiles from the summary, the source dates in BRT with their
    age, and the timeline on today's step. [H3, S1, S3, S4, T6]
*   **Given** the live bundle is the empty seed (no layers, no summary).
    **When** the operator opens `/`.
    **Then** the screen still opens on Now. The status chip reads "No live data yet", the tiles,
    the chart and the priority list read "not published yet", and the freshness reads "unknown
    age". Nothing reads "Below the tipping point". The Replay switch is offered next to the
    notice. [S1, H6]

### CUJ-2. Switch between Now and Replay, pick an event

*   **Given** any state.
    **When** the operator selects Replay.
    **Then** the event select lists Washington (Dec 2025) and Rio Grande do Sul (May 2024). The
    last replay event viewed is selected; the first time, the first one. The timeline moves to
    the event day and does not start playing. Area selection, the radar comparison and the open
    details close. [H3, H4]
*   **Given** Replay.
    **When** the operator selects Now.
    **Then** the event select is replaced by the region label "Southern Brazil". [H4]

### CUJ-3. Choose the hazard

*   **Given** a case with both TPI rasters.
    **When** the operator chooses Landslide or Flood.
    **Then** the map draws that raster for the current step, the caption chip names it, and the
    other choice turns off. Exactly one hazard is selected at any time. [L1, L2, L3, M3]

### CUJ-4. Add a map layer

*   **Given** a case and fewer than two extra layers on.
    **When** the operator turns on a layer that has data.
    **Then** the layer draws, its legend row appears, and its data date shows on the row.
    [L4, L5, L6, L13]
*   **Given** two extra layers are on.
    **When** the operator turns on a third.
    **Then** the oldest one turns off and a visible line names it, for example "Rain turned off
    to show Radar". [L8]
*   **Given** a layer has no data in this case.
    **Then** its row is greyed with the reason, for example "no map layer for this case" or
    "no pass in 2024", and cannot be turned on. [L4, L5, L6, L7]

### CUJ-5. Move in time

*   **Given** a case with a series.
    **When** the operator presses play, pause, previous, next, or a step.
    **Then** the map frame, the caption chip, the status chip, the chart marker and the step
    label in the panel header follow the step. Play advances one step at a time and stops at
    the last step. Any manual step, chart click or area selection pauses playback.
    [T1, T2, T3, S1, S10]
*   **Given** the step is a forecast day.
    **Then** the frame is hatched, the step is drawn dashed, and the tag names the forecast
    source from the data: "perfect forecast" in Replay, "GEOS-FP" in Now. [M14, T4, L10]
*   **Given** the step is not the day of the zone snapshot.
    **Then** the tiles and the priority list keep their values, show "as of <date>", and are
    drawn dimmed. They are never recomputed. [S3, S5]

### CUJ-6. Inspect a priority area

*   **Given** a case with priority zones.
    **When** the operator clicks a row of the list or a numbered pin.
    **Then** the map centers on the area, the pin and the row are marked, and a callout shows
    name, class, TPI, hazard and area from the zone data. [M4, M5, M6, S5, S7]
*   **When** the operator expands the callout.
    **Then** R, S and T load once for that area and date and show with a source label ("GEE
    point read", "COG pixel read" or "day estimate") and the input dates. [M8]
*   **When** the operator clicks the same row or pin again, presses Esc, or changes the case.
    **Then** the callout closes and the selection clears.
*   **Given** a zone has `people: null`.
    **Then** its people cell and the people tile read "not published yet". [S4, S6]

### CUJ-7. Read the rain and soil chart

*   **Given** a case with a series.
    **When** the operator clicks a bar.
    **Then** the timeline moves to that day and playback pauses. [S9, S10]
*   **When** the operator selects "Table".
    **Then** the same days show as a table with date, rain, soil moisture and kind. [S11]

### CUJ-8. Confirm with radar

*   **Given** Washington, with confirmed flood polygons and the two pass dates.
    **When** the operator selects "Confirm with NISAR radar".
    **Then** the flood polygons draw on the map and the radar card shows the two pass dates, the
    flooded area labelled by its source, and "within the NISAR swath - 74% of the area covered".
    The timeline does not move. [S13, S14, S16, L6]
*   **Given** the before and after images are published.
    **When** the operator selects "Before / after".
    **Then** a comparison covers the map with a draggable divider and the two dated labels. One
    "Close compare" control returns to the map with the layers as they were. [M15, S15]
*   **Given** the two images are not published.
    **Then** "Before / after" reads "images not published yet" and is disabled.
*   **Given** Rio Grande do Sul.
    **Then** the radar card reads "No radar for this event (before NISAR launch)" and the radar
    controls are disabled. [S13]
*   **Given** any case with landslide marks.
    **Then** they are called "Landslide scar candidates (HLS optical)". The words "confirmed
    scar" and "confirmed landslide" never appear. [L11]

### CUJ-9. Check the replay

*   **Given** a Replay case.
    **Then** the "Replay check" card shows one row per metric that the case has. A lead time
    shows as median with IQR and n together, never alone. A missing metric shows "not published
    yet" with its reason. [S17, S18]
*   **When** the operator opens the details.
    **Then** the validation and impact content of G4 is shown, and the operator can turn on the
    catalog points, the OPERA mask and the night-light raster from there. [S19]
*   **Given** Now.
    **Then** the card is not shown.

### CUJ-10. See the public alerts

*   **When** a visitor opens `/alerts`.
    **Then** the same screen opens on Now with the Public Alerts view in the right panel. The
    map, the Layers column and the timeline are present. [H2]
*   **When** the operator selects "Public Alerts" or "Command Center" in the header.
    **Then** the right panel changes, the address changes between `/alerts` and `/`, and the
    map, the selected step and the layers stay as they were. The browser's back button returns
    to the previous view. [H2]
*   **Given** Now with alert candidates.
    **When** a visitor opens the Public Alerts view.
    **Then** each alert shows its title, region, validity, certainty, the "held" label when set,
    the generated guidance and the contact line "SMS 40199". [P1, P2, P3, P4]
*   **Given** the alert data loaded and has no candidates.
    **Then** the view reads "No active alerts" with the time of the data.
*   **Given** the alert data failed to load or is not published.
    **Then** the view reads "Alert data unavailable" with the last known time. It never reads
    "No active alerts".
*   **Given** Replay.
    **Then** the view states that there is no public feed in replay and offers "Go to Now".

### CUJ-11. Get alerts for an area

*   **Given** a bot address is configured.
    **When** a visitor selects "Get alerts on Telegram".
    **Then** the Telegram bot opens. The card states that the bot asks for consent and for an
    approximate location. The web page reads no location and stores nothing. [S20, S21, S22]
*   **Given** no bot address is configured.
    **Then** the card is not shown.

### CUJ-12. Notice old or substitute data

*   **Given** the app fell back to the last saved data.
    **Then** a notice next to the status chip reads "Showing last saved data from <date>". [S23]
*   **Given** the live run is older than the stale limit, or its time is unknown.
    **Then** the freshness reads "stale" or "unknown age". It never reads "live". [H6]
*   **Given** the bundle is sample-derived.
    **Then** the map chip reads "Illustrative demo data". On real data the chip is absent. [M2]

### CUJ-13. Use the map tools

*   **When** the operator hides the Layers column.
    **Then** the map widens and a compact legend stays visible on the map. [L12, M10]
*   **When** the operator selects recenter, zoom in or zoom out.
    **Then** the map fits the case bounds, or zooms one level. During a comparison the same
    controls act on the comparison. [M11, M12]
*   **When** the operator clicks a point of the TPI frame.
    **Then** the existing pixel popup opens with class, TPI, R, S, T, dates and source. [M16]

### CUJ-14. Narrow screen

*   **Given** a window narrower than 900 px.
    **Then** the page is one column in this order: header, map, right panel, timeline. The
    Layers column opens as a drawer from the map tools, and the compact legend stays on the map.
    [R1, R2]

The bell of the prototype is not built (Q7). [H5]

## Technical Plan

Status of this section: parts 1 to 10 are decided.

### 1. Data flow

```
tipping-point-data (branch "fallback", or DATA_BASE_URL)
        |
        v
src/lib/data.ts  getCaseBundle()            server, unchanged
        |   CaseBundle[]  (rs_2024, wa_2025, now)
        v
src/app/page.tsx, src/app/alerts/page.tsx    server, both render one shared loader (part 10)
        |
        v
Command Center root (client)
   |-- screen state (part 2)
   |-- panel model (part 3): pure functions over (bundle, state)
   |       status chip, tiles, areas, check rows, layer rows, data status
   |-- map: existing <Map> + useMapLayers(...)   overlay input changes (part 8)
   '-- shell components: header, layers column, situation panel, timeline
```

The loader, the API routes and the contract types are not changed, with two possible additive
exceptions that are named where they appear (part 3, "Now series"; part 8).

### 2. Screen state

One state object with named actions. Now / Replay is not stored; it is derived from the active
case.

| Key | Values | Reset on case change |
| --- | --- | --- |
| `activeId` | case id | - |
| `lastReplayId` | case id of the last replay viewed | no |
| `dayIndex` | step index | to the event day (offset 0), or the last observed day |
| `playing` | boolean | false |
| `hazard` | `slide`, `flood` | kept if the case has it, else the other |
| `extraLayers` | ordered list, at most 2 (budget rule in part 8) | emptied of layers the case lacks |
| `view` | `command`, `public`; not stored, derived from the address (part 10) | no |
| `selectedArea` | zone rank or none | none |
| `calloutExpanded` | boolean | false |
| `compareOpen` | boolean | false |
| `detailsOpen` | boolean | false |
| `layersOpen`, `listExpanded`, `chartAsTable` | boolean | no |

Rules:
- A manual step, a chart click or an area selection sets `playing` to false.
- Opening the comparison keeps `extraLayers`; closing it restores the map as it was.
- The existing playback timer (1200 ms per step) is kept. It stops at the last step.

The reset logic is plain code with unit tests (`bun test`), with no component involved.

### 3. Panel model: where each value comes from

A set of pure functions takes the bundle and the screen state and returns what the panel shows.
They contain every rule of G2 and G3, so the rules are tested once and not per component.

**Availability.** `availability(bundle, key)` returns one of:

| Result | Condition | Shown as |
| --- | --- | --- |
| `ok` | value present | the value |
| `pending` | key listed in `bundle.pending` (declared, not in storage) | "not published yet" |
| `absent` | product or metric is `null` in the data | "not published yet" plus the reason from `_null_reasons` |
| `not-applicable` | the case cannot have it (radar for 2024) | the specific sentence, for example "No radar for this event (before NISAR launch)" |

**Data status.** `dataStatus(bundle)` returns one of `live`, `stale`, `unknown-age`,
`last-saved`, `sample`. It replaces three separate signals of today (`fallback` banner, stale
pill, `isMockDerived`). `sample` is true only when the bundle comes from the fixture fallback
and has neither metrics nor a summary. `last-saved` is true when the loader fell back to stored
data; it shows the date and is not called "illustrative". `stale` compares `updated_at` with the
stale limit: two refresh periods, with the period read from one setting (default 3 hours).

**Status chip.** Threshold is `series.tpi_threshold`, else `cutsFor(bundle)[2]`.

| Case | Condition | Chip |
| --- | --- | --- |
| Replay | no series | "No data for this event" |
| Replay | selected day is observed and its TPI reaches the threshold | "Tipping point reached" |
| Replay | selected day is forecast or hindcast and its TPI reaches the threshold | "Tipping point forecast" with the source label |
| Replay | selected day is below, a later forecast day reaches the threshold | "Tipping point forecast for <date>" |
| Replay | otherwise | "Below the tipping point" |
| Now | no summary | "No live data yet" |
| Now | `summary.critical_km2` of the chosen hazard is above 0 | "Tipping point reached" |
| Now | summary present and the value is 0 | "Below the tipping point" |

"Reaches" follows the current code (a value equal to the threshold counts) until Q5 is answered;
the comparison lives in one function.

**Steps without a series.** At `347f9a4` the loader no longer builds a zero-filled series for
Now, so `bundle.series` is undefined there and the earlier idea of a `series.synthetic` flag is
dropped. The contract gives Now no series file, so the new screen cannot take its steps from
the series alone. Rule, in `model/steps.ts`:

- A case with a series: steps are `series.days`, as today.
- A case without a series: steps are the distinct dates of the manifest's TPI frames, in order.
  A step is forecast when its frame carries the forecast flag. A step has a date and a kind and
  no rain, soil or TPI value. The chart and the status chip do not read steps of this kind; they
  follow the "Now" rows above and show "not published yet" where a value is missing.
- A case with neither: no steps. The timeline reads "No frames published yet".

The map hook takes the frame date as an additive option (`frameDate`, part 8) because it reads
the date from `bundle.series` today.

**Tiles.**

| Tile | Replay | Now |
| --- | --- | --- |
| Critical area | `metricsView.critical_area_km2`; else the sum of `area_km2` over Critical zones, labelled "in priority zones" | `summary.critical_km2` for the chosen hazard |
| People potentially exposed | `metricsView.people_critical`; else the sum of zone `people` only if no zone is null | `summary.people_critical` |

Both tiles carry "as of <date>". They follow the hazard choice only where the data splits by
hazard.

**Priority areas.** `priority_zones` sorted by `rank`. The list shows the first 5 and "View all".
The pin sits at the center of the zone polygon (the current code reads the geometry as a point;
the real zones are polygons). Zones with the same name show the name and the rank. Class comes
from the data, not from a comparison in the browser.

**Replay check rows.** One row per metric present in `metricsView`, from a fixed order: lead
time (median, IQR, n, never-critical share, placeholder flag), zones warned before the event,
flood agreement (IoU, F1), landslide catalog hits, model against slope rule (two labelled AUC
values), flooded area with source and swath scope. A metric that is `null` shows its reason.

**Layer rows.** One registry lists every row of the Layers column: id, group, label, manifest
layer prefix or product, data-date key. A row is available when the case has the raster or the
product. The registry replaces the hard-coded list of `LayersPanel.tsx`.

**Text.** Sentences, labels and the alert contact line are taken from the current components
and `src/lib/alerts.ts`. No sentence is taken from the prototype file.

### 4. Map

- The existing `Map` and `useMapLayers` stay the map engine. The dark basemap, the paint values
  and the 15% hillshade are not changed.
- Zoom, recenter, north and scale: the prototype's buttons call the map instance (`zoomIn`,
  `zoomOut`, `fitBounds` to the case bounds). The MapLibre navigation control is hidden so the
  controls are not doubled.
- Area pins move out of the HTML-string markers of `MapLayers.tsx` into one marker layer owned
  by the new screen: numbered, clickable, built from text nodes. This removes the unescaped
  name and the point-geometry assumption.
- The callout is a card anchored to the selected pin. The expanded part calls the existing
  `resolvePixelValues` once per (case, date, area), caches the result, and shows its source.
- The inset locator is a static SVG drawn from the case bounds. It is not a second map.
- The comparison mounts the existing `SwipeCompare` over the map container while
  `compareOpen` is true and unmounts it on close. It is the only time more than one map
  instance exists.

### 5. Theme

- Light chrome, dark map card. Colors are semantic tokens in `@theme`, scoped to the new screen
  root, so the old screen is not restyled before the switch.
- Text on the map keeps the existing rule: at least 12 px and 4.5:1 on the dark map.
- Class colors and their opacities stay as in `src/lib/tpi.ts`.

### 6. Tests and checks

- Unit tests for the panel model and the state resets (`bun test`), including the 5 new
  assertions of `test_parity_checklist.md`.
- The 25 rule assertions are re-pointed at the new screen: the test renders the new root over
  the existing fixtures and checks the same strings. The old test file is removed in the switch
  commit, not before.
- `layers.test.ts` stays green; new overlay rules get new tests next to it.
- Interactions (CUJ-1 to CUJ-13) are checked by a scripted browser pass over the three cases.
  It is a script in the repository, not a CI job, because the project has no browser in CI.
- `bun run lint`, `bun test` and `bun run build` pass on every commit.
- Since `347f9a4` `tsconfig.json` excludes `**/*.test.ts` and `**/*.test.tsx`, so the build no
  longer type-checks test files and `bun test` runs them without a type check. A test that
  calls a removed prop still fails at run time, not at build time. The old test file therefore
  does not block the build while both screens exist.

### 7. Component structure

**Decided by the author (2026-11-14): a new tree on the panel model.** Every visible component
is new and renders only what the panel model returns. The old components are deleted in the
switch commit. The two rejected options are recorded under "Alternatives Considered".

Known cost of this choice: a fix that lands on an old component after the fork must be carried
to the new tree by hand. The control for it is a check before the switch: list every commit on
`main` since the fork that touched `src/components`, and confirm each against the new tree.

What stays and what is new:

| Part | Decision | Reason |
| --- | --- | --- |
| `src/components/Map.tsx` | stays | map engine, no screen layout in it |
| `useMapLayers` in `src/components/MapLayers.tsx` | stays, with additive options (part 8) | map engine; audited layer order, hatching and pixel popup |
| `src/lib/**` | stays | owned by the data and contract work |
| `src/lib/swipe.ts` | stays, used by the new comparison | pure helpers with tests |
| Everything else under `src/components` | replaced | screen layout and panel content |

`MapLayers.tsx` has to change in any case: the hook creates the old HTML zone markers itself,
and the new screen draws its own pins. The change is one additive option that turns the old
markers off. The old screen does not pass it and behaves as before.

New folder `src/components/command/`:

```
command/
  CommandCenterLoader.tsx  server: loads the bundles and the alert list, used by both routes
  CommandCenter.tsx        root (client): state, layout, wiring
  state.ts                 reducer, actions, resets
  model/
    steps.ts               timeline steps from the series, or from frame dates (part 3)
    availability.ts        ok / pending / absent / not-applicable
    dataStatus.ts          live / stale / unknown-age / last-saved / sample
    status.ts              status chip derivation
    tiles.ts               critical area, people
    areas.ts               priority areas, pin positions
    replayCheck.ts         replay check rows, evidence sections
    layerRegistry.ts       rows of the Layers column
    sources.ts             source dates and ages
    alerts.ts              alert list for the public view (wraps src/lib/alerts.ts)
    format.ts              date, hour and number text (takes over tabs/format.ts)
  TopBar.tsx               brand, view switch, Now / Replay, event select, freshness
  LayersColumn.tsx         hazard choice, layer rows, rule line, legend
  MapStage.tsx             Map + useMapLayers, caption chip, data-status chip
  AreaPins.tsx             numbered pins
  AreaCallout.tsx          area card, expandable R / S / T
  MapTools.tsx             layers toggle, recenter, zoom, compact legend
  LocatorInset.tsx         static SVG locator
  CompareOverlay.tsx       before / after comparison
  SituationPanel.tsx       panel frame
  StatusBlock.tsx          chip, sentence, last-saved notice
  Tiles.tsx
  PriorityAreas.tsx
  RainSoilChart.tsx        chart and table view
  RadarCard.tsx
  ReplayCheck.tsx          headline rows
  EvidenceDetails.tsx      validation and impact content (G4)
  charts/                  lead-time histogram, river level, feature importance
  GetAlertsCard.tsx
  TimelineBar.tsx          transport, steps, marks, forecast tag
  SourceAges.tsx
  PublicAlertsPanel.tsx    right panel of the public view (part 10)
  AlertCard.tsx            one alert; takes over the card of the old src/app/alerts/page.tsx
```

The model and the state live under `src/components/command/` and not under `src/lib`, because
`src/lib` is edited by other work (the comment in `tabs/format.ts` states this).

The app's `AGENTS.md` says this Next.js version differs from older ones and that the guides in
`node_modules/next/dist/docs/` must be read before code is written. `next.config.ts` enables
`cacheComponents`. Two consequences for the design: time-dependent text (ages, "stale") is
computed on the client after mount, as `FreshnessPill` does today; and the alert list for the
public view is built on the server from the bundle, because `candidatesToAlerts` reads the
current time when no issue time is given.

### 8. Map overlays and the layer budget

**Mechanism: an explicit overlay set passed to the map hook.** Of the three options in the brief
(D2), two are closed by decisions already taken. Option (a), no tab and no overlay state, loses
the catalog, OPERA and night-light overlays, which goal G4 keeps. Option (c), a hidden tab value,
keeps the tab model that the "all new" decision removes, and it cannot count one overlay as one
layer: the radar tab always brings two overlays and takes the whole budget, so the TPI raster
turns off when the flood is shown. Option (b) remains. The author can overrule this at the
section gate.

`useMapLayers` gets one optional argument. Without it the hook behaves as today, so the old
screen and `layers.test.ts` are not affected. `src/lib/layers.ts` is not changed.

```
options?: {
  zoneMarkers?: boolean        // false: do not create the old HTML zone markers
  frameDate?: string           // when given, the TPI frame is chosen by this date and not by
                               // bundle.series.days[dayIndex] (cases without a series, part 3)
  overlays?: {                 // when given, replaces overlayPlan(tab) and showFlood
    floodPolygons: boolean
    landslideCandidates: boolean
    catalogPoints: boolean
    operaValidation: boolean
    mlHazard: boolean          // t_ml raster; today it is always on when published
  }
}
```

**Budget rule.** Specialist rule 5: at most two data layers at the same time, besides the
basemap and the relief. The TPI raster is a data layer and counts, as it does in the code today.
The prototype's rule line ("two analysis or observation layers", hazards not counted) is not
used.

| Row of the Layers column | Group | Draws | Counts |
| --- | --- | --- | --- |
| Hazard: Landslide or Flood (single choice) | Hazards | selects which TPI raster | no |
| TPI index (show / hide) | Analysis | the raster of the chosen hazard, per step | 1 |
| Rain (GPM IMERG) | Analysis | `imerg_*` raster | 1 |
| Soil moisture (SMAP) | Analysis | `smap_*` raster | 1 |
| Modeled landslide hazard (XGBoost) | Analysis | `t_ml` raster | 1 |
| Flood confirmed by radar (NISAR); label follows `flood_source` | Observations | `flood_confirmed` polygons | 1 |
| Landslide scar candidates (HLS optical) | Observations | `landslide_candidates` polygons | 1 |
| Landslide catalog | Replay evidence | catalog points | 1 |
| OPERA water map | Replay evidence | `opera_validation` raster | 1 |
| Municipal boundaries, city labels, permanent water, relief | Reference | always on | no |

- At most two counted rows are on. Turning on a third turns off the oldest and a visible line
  names it.
- Default: TPI index on, nothing else.
- "Confirm with NISAR radar" sets the counted rows to exactly TPI index plus Flood confirmed by
  radar. The rain warning and the radar confirmation are then visible together.
- The Replay evidence rows are shown in Replay only. They can also be turned on from the
  evidence details (CUJ-9).
- The budget is a pure function in `command/model/layerRegistry.ts` with tests. It replaces
  `toggleBudget(tab)` and `capToggleQueue` for the new screen.

**Where the five old overlays go.**

| Overlay | Old trigger | New trigger |
| --- | --- | --- |
| Flood polygons | Radar tab | row "Flood confirmed by radar"; "Show on map"; "Confirm with NISAR radar" |
| Landslide candidates | Radar tab, or the NISAR toggle | row "Landslide scar candidates (HLS optical)" |
| Catalog points | Validation tab | row "Landslide catalog"; evidence details |
| OPERA mask | Validation tab | row "OPERA water map"; evidence details |
| Night lights | Impact tab | before / after comparison of the night-light pair, opened from the evidence details |

The night-light entry changes form. The hook looks for a layer id `night_lights`, but the
contract defines `night_lights_pre` and `night_lights_post`, so the old overlay can never draw.
The specialist document asks for a before / after view of night lights. `CompareOverlay` takes a
pair (radar or night lights) and serves both.

The NISAR toggle no longer draws optical candidates. That removes the case where optical data
appears under a radar label.

### 9. Smaller decisions taken on existing rules

- **Chart.** The chart keeps the TPI line, the dashed P95 rain threshold and the event marker of
  the current chart, which follows the specialist chart specification. The prototype's "soil
  held at last value" segment is drawn in the soil color, dashed, not in red, so the red dashed
  line keeps one meaning.
- **Hindcast days.** A `hindcast` day is drawn as forecast (hatched frame, dashed step) with the
  label of the forecast source. Rule 2 says observed and forecast are never confused; a hindcast
  is not an observation.
- **Telegram address.** One public setting holds the bot URL (`NEXT_PUBLIC_TELEGRAM_BOT_URL`).
  The card is hidden when it is not set.
- **Stale limit.** One public setting holds the refresh period in hours
  (`NEXT_PUBLIC_REFRESH_HOURS`, default 3). The stale limit is two periods.

### 10. Routes and the public view

**Decided by the author (2026-11-14): one shell, two URLs.** `/` and `/alerts` open the same
screen. The address decides which view the right panel shows. The two rejected options (a view
inside `/` only; a separate light page at `/alerts`) are recorded under "Alternatives
Considered".

**Routes.** `src/app/page.tsx` and `src/app/alerts/page.tsx` both render
`CommandCenterLoader`, a server component that loads the case bundles and the alert list once
and renders `CommandCenter`. Page metadata lives in `src/app/layout.tsx` today; the alerts route
adds its own title.
The alert card markup, the level styles and the sort order of the old `alerts/page.tsx` move
into `AlertCard.tsx` and `model/alerts.ts`.

**View from the address.** `view` is `public` when the path is `/alerts`, otherwise `command`.
It is read with `usePathname` and is not kept in the state object, so the address and the
screen cannot disagree.

**Switching.** The header switch calls `window.history.pushState` with the other path. No
server request is made and the client root is not remounted, so the map, the selected step,
the layers and the playback state are kept. Back and forward work through the browser history.

This was checked against the documentation shipped with the app's Next.js version (16.4.6),
not run:

- `01-app/01-getting-started/04-linking-and-navigating.md`, "Native History API": `pushState`
  and `replaceState` calls are integrated into the router and `usePathname` follows them.
- `01-app/03-api-reference/04-functions/use-pathname.md`, "Cache Components": on a static route
  the path is known at build time, so the hook needs no `Suspense` boundary. Both routes are
  static.

A `<Link>` between the two routes is not used for the switch: it would be a route navigation,
and whether it keeps the client root mounted across two page files is not something this
design should depend on.

**What the public view changes.** Only the right panel, as in the prototype: the Situation
panel is replaced by `PublicAlertsPanel` (heading, alert cards, "Alerts by region", the contact
line, the "Get alerts" card). The header, the Layers column, the map and the timeline stay.
Opening `/alerts` directly starts on Now. In Replay the panel states that there is no public
feed in replay and offers "Go to Now".

**Alert list.** Built on the server in the loader and passed as one prop:

| State | Condition | Panel text |
| --- | --- | --- |
| `alerts` | the Now bundle loaded and `nowAlerts.candidates` has entries, or the legacy `alerts.json` resolved with entries | the cards |
| `none` | an alert source loaded and it is an empty list | "No active alerts" with the time of the data |
| `unavailable` | the Now bundle failed to load, or no alert source is published | "Alert data unavailable" with the last known time, or "no run recorded" |

Today the state is `unavailable`: `now/alerts.json` is not published and the data branch has no
`alerts.json` (tree of `19c56df`, 140 files, none with "alert" in the name). The old page shows
this case as "No active alerts - the monitor is running", which is the defect of problem 3.

Every field of the current card is kept: title, level, region, rain and soil text, forecast
text, the NASA data dates, validity, certainty, hazard, the "held" label, the guidance and the
fixed footer `ALERT_FOOTER`. The card's "View on the map" link becomes an action: it returns to
the Command Center view and selects the area. "Call 199" from the prototype is not used.

**Consequences.**

- `/alerts` now loads the map library and the full page payload (Q9). A resident on a phone gets
  the same weight as the operator. This raises the cost of leaving Q9 and Q4 open.
- The old `/alerts` page had a link back to the dashboard and a dark, text-only layout. Both are
  replaced by the shell.
- A deep link to `/alerts` in Replay cannot exist: the path carries the view only, not the case.
  Case and step in the address are listed under "Future Improvements".

## Alternatives Considered

**Build approach.**

| Option | Mechanism | Outcome |
| --- | --- | --- |
| New tree on the panel model | every visible component is new and renders what pure model functions return | chosen (part 7) |
| Replace in place | restyle and move the existing components into the new layout | Rejected by author: "all new". The tabs are an input of the map code and the missing-data rules would stay spread over the components. |
| New shell, reuse the tab blocks | new layout around the existing tab components | Rejected by author: "all new". Keeps the tests green at first, but the blocks carry the dark theme and the tab-shaped content. |
| Restyle only | keep the tabs, apply the light theme | Rejected: does not deliver the interactions of the prototype, which is the done criterion. |
| New shell on its own route | build at `/command`, switch the home route later | Rejected: the switch commit (G6) gives the same safety without a second public URL. |

**Public Alerts.**

| Option | Outcome |
| --- | --- |
| One shell, two URLs | chosen (part 10) |
| A view inside `/` only | Rejected by author. The existing `/alerts` address, which the Telegram messages can link to, would stop working or need a redirect. |
| A separate light page at `/alerts` | Rejected by author. Light for a phone, but two layouts and two alert renderings to keep in step. |

**Map overlays.**

| Option | Outcome |
| --- | --- |
| Explicit overlay set passed to `useMapLayers` | chosen (part 8) |
| Keep `overlayPlan(tab)` and pass a made-up tab | Rejected: the screen has no tabs; a hidden tab value would decide what draws. |
| A second map hook for the new screen | Rejected: two copies of the layer order, the hatching and the pixel popup. |

**Missing data.** A sample-data mode was rejected by the author: the repository removed its mock
data on 2026-11-14, and a sample value on a Civil Defense screen can be read as real.

## Non-Functional Requirements

*   **Truthfulness.** No value is invented in the browser. A missing value reads "not published
    yet"; a load failure never reads as "no risk" or "no alerts".
*   **Accessibility.** Specialist rules 3, 4 and 9: the legend is always visible, color is never
    the only signal (class word next to every class color, hatch for forecast), text on the map
    is at least 12 px with 4.5:1 contrast. Every control is a button or a link with a name and
    works from the keyboard.
*   **Privacy.** The web page reads no location and stores nothing. Consent and location belong
    to the Telegram bot.
*   **Performance.** Not a goal of this change. The comparison map is mounted only while it is
    open. The payload limit is stated in Q9.
*   **Security.** Pins, callouts and alert cards are built from text nodes, never from
    `innerHTML` with data values.

## Additional Resources

*   Prototype: board "Command center (chosen)", https://claude.ai/artifact/U3TUFRUw5n8E57wN4ptVt3
*   `concepts_brief.md`, `interaction_inventory.md`, `test_parity_checklist.md`,
    `data_request.md` in this folder.
*   App: https://github.com/r2l2pj/tipping-point-app (`347f9a4`). Data:
    https://github.com/r2l2pj/tipping-point-data (branch `fallback`, `19c56df`).
*   Contract: `data/SCHEMA.md` in the data repository; `docs/app-contract.md` in the app.
*   Next.js guides for this version: `node_modules/next/dist/docs/` (the app's `AGENTS.md`
    requires reading them before code is written).

## Future Improvements

*   **Payload.** Leave the four heavy GeoJSON files out of the page props and load them in the
    browser after mount from `/data/<case>/geojson/...`. The deployed site serves these paths
    (checked 2026-11-14: `municipal_boundaries.geojson` and `flood_confirmed.geojson` return
    200). The map hook already accepts a bundle whose layers arrive later.
*   Case and step in the address, so a view can be shared as a link.
*   A real phone layout for the public view.
*   Light basemap, both hazards at once, web subscription: see Non-Goals.

## Detailed Implementation Plan

### Target Files

New, all under `src/components/command/` (tree in part 7):

| Files | Rationale |
| --- | --- |
| `model/*.ts` with `*.test.ts` next to each | every rule of the screen as a pure function over (bundle, state); carries the 25 re-pointed assertions and the 5 new ones |
| `state.ts`, `state.test.ts` | one reducer; reset rules of part 2 |
| `CommandCenterLoader.tsx` | server loading shared by `/` and `/alerts`; builds the alert list and its state |
| `CommandCenter.tsx` and the shell components | the screen of the prototype, light theme, rendering only model output |
| `AlertCard.tsx`, `PublicAlertsPanel.tsx` | the public view; card fields of the old alerts page |

Changed:

| File | Change | Rationale |
| --- | --- | --- |
| `src/components/MapLayers.tsx` | additive `options` argument: `zoneMarkers`, `frameDate`, `overlays` (part 8) | the new screen has no tabs and draws its own pins; the old call keeps its behavior |
| `src/app/page.tsx` | render `CommandCenterLoader` | the switch |
| `src/app/alerts/page.tsx` | render `CommandCenterLoader`; own title | one shell, two URLs |
| `src/app/globals.css` | semantic color tokens scoped to the new root | light chrome without touching the old screen before the switch |
| `.env.example`, `docs/DEPLOY.md` | `NEXT_PUBLIC_TELEGRAM_BOT_URL`, `NEXT_PUBLIC_REFRESH_HOURS` | two new settings |
| `scripts/` (one new script) | scripted browser pass over the three cases | interactions have no CI coverage |

Deleted in the switch commit (list of `src/components` at `347f9a4`): `Dashboard.tsx`,
`Header.tsx`, `LayersPanel.tsx`, `SidePanel.tsx`, `Timeline.tsx`, `TpiChart.tsx`,
`SwipeCompare.tsx` (replaced by `CompareOverlay.tsx`) and `tabs/**` including `tabs.test.tsx`.
The three files of `charts/` move to `command/charts/` and take the new theme. `Map.tsx` and
`MapLayers.tsx` stay.

Not changed: `src/lib/**`, `src/app/api/**`, `Map.tsx`, the data repository.

### Order of work

1. `model/` and `state.ts` with their tests, against the existing fixtures. Nothing visible.
2. `MapLayers.tsx` options, with tests next to `layers.test.ts`. The old screen is unaffected.
3. Shell components and `CommandCenter.tsx`, reachable only from a temporary route file that
   is not linked and is removed in step 5.
4. Public view and `CommandCenterLoader.tsx`.
5. The switch commit: both route files render the loader, the old components and the old test
   file are deleted, the temporary route is removed. Before it: list the commits on `main`
   that touched `src/components` since `347f9a4` and carry each fix over.

Each step is one or more commits that pass `bun run lint`, `bun test` and `bun run build`.

### Verification Plan

*   **Rules.** `bun test`: the 25 assertions of `test_parity_checklist.md` against the new
    screen, the 6 `overlayPlan` tests unchanged, the 5 new assertions.
*   **Interactions.** The browser script walks CUJ-1 to CUJ-14 on Now, WA and RS and fails on a
    console error, on a missing legend, and on more than two data layers.
*   **Missing data.** Run once against the data branch as it is today: Now reads "No live data
    yet", people read "not published yet", `/alerts` reads "Alert data unavailable", the
    before / after control is disabled with its reason.
*   **Routes.** `/` to Public Alerts and back: the address changes, the map does not reload,
    the browser back button returns to the previous view. A direct open of `/alerts` shows the
    public view on Now.
*   **Banned text.** No "confirmed scar", "confirmed landslide" or "WorldPop" in either view.
*   **Inventory.** Every row of `interaction_inventory.md` is checked off against the running
    screen: works, shows its pending state, or is cut as listed.

Not verified by this document: nothing here was run in a browser. The findings about the
current app come from reading the code at `4a7549b` and `347f9a4`.

--------------------------------------------------------------------------------

*Drafted with EGM*
