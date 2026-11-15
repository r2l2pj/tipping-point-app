# NASA data used

> **DRAFT — pending approval.**

Every model input is a NASA mission dataset, with one declared exception: NOAA GFS forecasts for the replay forecast (see Forecast).

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

- **GEOS-FP (GMAO)** — forecast rain for live mode
- **NOAA GFS 0.25 (non-NASA, declared)** — historical forecasts issued on each replay day, used ONLY as the replay D+1..D+3 forecast and labelled "forecast · NOAA GFS (issued <date>)". No NASA-archived precipitation forecast covers both replay windows (Apr–May 2024, Dec 2025), so L22 falls back to GFS. Perfect-forecast frames (observed IMERG as D+1..D+3) are kept only as a labelled upper bound.

## Validation references

- **OPERA DSWx** — surface water product used for validation
- **SWOT Hydrocron** — river levels for the "Did we get it right?" river chart
- **GLC (Global Landslide Catalog / COOLR)** — validation reference for the landslide-hit metric (WA case)

*MERIT Hydro is used as a validation reference for the HAND proxy only — it is not a NASA input.*
