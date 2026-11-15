# NASA data used

> **DRAFT — pending approval.**

Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA (see Forecast).

## Index inputs (Rain · Soil · Terrain)

- **GPM IMERG V07** — 3-day accumulated rain vs per-pixel P90/P95/P99 climatology (Rain score)
- **SMAP L4 SPL4SMGP/008** — root-zone soil moisture (`sm_rootzone_wetness`, Soil score)
- **NASADEM** — slope + HAND proxy (Terrain score)

## Confirmation (radar + optical)

- **NISAR GCOV** — flood confirmation, before/after backscatter (track 172D frame 064, BETA products)
- **HLS (Harmonized Landsat Sentinel-2)** — post-event landslide *candidates* when clouds clear

## Impact

- **VIIRS Black Marble VNP46A2** — lights-out (power-loss) estimate
- **GPW v4 (SEDAC Gridded Population of the World)** — population exposure

## Forecast

- **NOAA GFS 0.25° (non-NASA, declared)** — forecast rain for both modes, labelled "forecast · NOAA GFS (issued <date>)": replay D+1..D+3 uses the forecast issued on each replay day, live mode uses the latest run. One model everywhere, so the replay's "how early" check measures the forecast the live view uses. No NASA-archived precipitation forecast covers both replay windows (Apr–May 2024, Dec 2025). Perfect-forecast frames (observed IMERG as D+1..D+3) are kept only as a labelled upper bound.

## Validation references

- **OPERA DSWx** — surface water product used for validation
- **SWOT Hydrocron** — river levels for the "Did we get it right?" river chart
- **GLC (Global Landslide Catalog / COOLR)** — validation reference for the landslide-hit metric (WA case)

*MERIT Hydro is used as a validation reference for the HAND proxy only — it is not a NASA input.*
