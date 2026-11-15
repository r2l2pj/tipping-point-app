# Tipping Point

> **DRAFT — pending approval.**

**Rain warns. Radar confirms.**

NASA Space Apps 2026 — Challenge: **Dancing with the SARs**

*Three NASA missions, three layers, one tipping point.*

## Theme sentence

> Tipping Point turns NASA rainfall and soil moisture data into a near real-time landslide and flood warning, then uses NISAR radar to confirm where the ground actually moved or flooded, so civil defense teams know where to act first.

## Summary (~240 words)

In May 2024, floods hit Rio Grande do Sul: 478 municipalities affected, 185 deaths and 581,638 people displaced at the peak (Government of Rio Grande do Sul, SOS Rio Grande do Sul, updated Aug 19, 2025). Alerts covered entire municipalities, and optical satellites were blind behind storm clouds: in the critical first hours, no one knew which slopes had failed or which neighborhoods were under water. Tipping Point closes that gap. Our Tipping Point Index (TPI) is the geometric mean of three normalized scores in [0,1] — Rain (GPM IMERG vs per-pixel climatology), Soil (SMAP root-zone moisture), Terrain (NASADEM slope and drainage height) — classified Low (<0.2), Moderate, High, or Critical (>0.6). The 2024 flood predates NISAR, so radar confirmation is demonstrated on a second case: in Washington State, December 2025, NISAR GCOV passes before and after the storm confirm flooded area through clouds and darkness, while landslide sites appear only as "candidates" from post-event HLS optical imagery. Built for municipal Civil Defense in Southern Brazil (RS/SC/PR), the demo replays both events end-to-end, and a live Southern Brazil view refreshes every 3 hours. Using the forecast available at the time, 88% of the 16,027 landslides mapped in Rio Grande do Sul were already in High or Critical areas 24 h before May 1, 2024. Single forecast runs vary: the NOAA GFS run issued 48 h before flagged only 0.27% of them; the run issued 72 h before, 70.9%. Our flood index missed the Washington river floods (0.14% of the NISAR-flooded area was High 24–48 h ahead) because it uses local rain only.

## Target awards

Best Use of Data · Local Impact · Galactic Impact
