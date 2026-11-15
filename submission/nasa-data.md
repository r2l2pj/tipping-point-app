# NASA data used

> **DRAFT — pending approval.**

Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA (see Forecast). A few non-NASA context and reference layers are shown or used for checks but never enter the index (see the last section).

## Index inputs (Rain · Soil · Terrain)

- **GPM IMERG V07** — 3-day accumulated rain vs per-pixel P90/P95/P99 climatology (Rain score); IMERG Early in the live view
- **SMAP L4 SPL4SMGP/008** — root-zone soil moisture (`sm_rootzone_wetness`, Soil score)
- **NASADEM** — slope + HAND proxy (Terrain score)

## Confirmation (radar + optical)

- **NISAR GCOV** — flood confirmation, before/after backscatter (track 172D frame 064, BETA products)
- **HLS (Harmonized Landsat Sentinel-2)** — post-event landslide *candidates* when clouds clear

## Live response (every 3 h, Southern Brazil)

- **OPERA Land Surface Disturbance Alert from HLS (DIST-ALERT-HLS) V1** (LP DAAC, `OPERA_L3_DIST-ALERT-HLS_V1`) — vegetation-loss alerts used to flag landslide scar candidates (RS replay and live); always "candidates"
- **OPERA DSWx-S1** — near-real-time flood candidates against a 60-day water-frequency baseline (always "candidates")
- **NISAR GCOV** — radar flood candidates on the latest pass pair over the domain, same change detection as the WA case
- **MODIS MCD12Q1 land cover** — removes permanent wetland/water and marks cropland as lower confidence; also a feature of the trigger model, never a TPI input

## Impact

- **VIIRS Black Marble VNP46A2** — lights-out (power-loss) estimate
- **GPW v4 (SEDAC Gridded Population of the World)** — population exposure

## Forecast

- **NOAA GFS 0.25° (non-NASA, declared)** — forecast rain for both modes, labelled "forecast · NOAA GFS (issued <date>)": replay D+1..D+3 uses the forecast issued on each replay day, live mode uses the latest run. One model everywhere, so the replay's "how early" check measures the forecast the live view uses. No NASA-archived precipitation forecast covers both replay windows (Apr–May 2024, Dec 2025). Perfect-forecast frames (observed IMERG as D+1..D+3) are kept only as a labelled upper bound.

## Validation references

- **OPERA DSWx** — surface water product used for validation
- **SWOT Hydrocron** — river levels for the "Did we get it right?" river chart
- **GLC (Global Landslide Catalog / COOLR)** — ML training labels (2,348+ dated points worldwide) and NASA event inventories for the Petrópolis, Angra dos Reis and São Sebastião TEST events. Not used for the Washington replay points (Washington Geological Survey).

## Non-NASA context and reference layers (never index inputs)
- **Washington Geological Survey landslide inventory (licence to confirm)** — validation reference for the landslide-hit metric (Washington case)

- **JRC Global Surface Water v1.4** — marks seasonal water as lower confidence in the live flood candidates
- **IBGE country and municipality outlines** — Brazil clip, municipality ranking of priority zones
- **UFRGS/Cemaden landslide inventory** — validation reference for the RS case
- **MERIT Hydro** — validation reference for the HAND proxy only
