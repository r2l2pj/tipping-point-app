# Space Apps 2026 project form: paste-ready

> **DRAFT — pending approval.** One block per field of the official 2026 Project Submission Guide ("Project Page Form Field Instructions", https://www.spaceappschallenge.org/resources/project-submission-guide/). Every field is required, and all text must be in English.
>
> **Deadline:** click **Submit for Judging** before **Sun Nov 15, 23:59, local time of our Local Event**. You can edit and resubmit until then; judges see only the last save.
>
> Before you submit, tick **Terms and Conditions** and **Confirm All Work is Original**.

Before pasting, take out every `[…]` placeholder and every "awaiting Lucas" line. The ML sentence stays without numbers until lead-ml publishes v2 (L33).

---

## 1. Project Name

Tipping Point

## 2. High-Level Project Summary

Source: `summary.md` → Summary ¶ (awaiting Lucas; the headline is decided). Paste it as is:

> In May 2024, Rio Grande do Sul suffered the worst floods in state history — 446 of 497 municipalities hit, hundreds of thousands displaced. Alerts covered entire municipalities, and optical satellites were blind behind storm clouds: in the critical first hours, no one knew which slopes had failed or which neighborhoods were under water. Tipping Point closes that gap. Our Tipping Point Index (TPI) is the geometric mean of three normalized scores in [0,1] — Rain (GPM IMERG vs per-pixel climatology), Soil (SMAP root-zone moisture), Terrain (NASADEM slope and drainage height) — classified Low (<0.2), Moderate, High, or Critical (>0.6). The 2024 flood predates NISAR, so radar confirmation is demonstrated on a second case: in Washington State, December 2025, NISAR GCOV passes before and after the storm confirm flooded area through clouds and darkness, while landslide sites appear only as "candidates" from post-event HLS optical imagery. Built for municipal Civil Defense in Southern Brazil (RS/SC/PR), the demo replays both events end-to-end, and a live Southern Brazil view refreshes every 3 hours. Using the forecast available at the time, Tipping Point flagged the area [X] hours before the damage. In replay with the NOAA GFS forecast issued each day (no look-ahead), Washington (Dec 2025) reached Critical a median of [X] h before the damage (IQR [IQR]; [n] of [N] forecast days flagged it); in Rio Grande do Sul (May 2024), [n] of [N] forecast days flagged it, [Y] h ahead. [ON HOLD — L35, re-score ~12:00]

## 3. Link to Project Demo

`[VIDEO LINK — YouTube Unlisted/Public or Google Drive "anyone with the link"; ≤30 s; test it in a private window]`

The video is built from `storyboard.md` + `captions.srt`. The backup is the 7-slide PDF (`slides.pdf`), linked from GitHub; use it only if the video is missing. A video longer than 30 s, or a deck longer than 7 slides, is not eligible for Global Judging.

## 4. Link to Final Project

https://tipping-point-app.vercel.app

It is public, needs no login, and returns 200. The code links are in the description below:
- https://github.com/r2l2pj/tipping-point-app
- https://github.com/r2l2pj/tipping-point-data

Both repos are public.

## 5. Detailed Project Description

> **What it does.** Tipping Point is a flood and landslide command center for municipal Civil Defense. It answers three questions in order: where is the ground about to fail, did it, and who is affected. A live view of Southern Brazil (Rio Grande do Sul, Santa Catarina, Paraná) refreshes every 3 hours. It shows today's risk plus three forecast days, public area alerts in plain language, and the latest radar and optical flood candidates. Two past disasters can be replayed day by day with no look-ahead: the May 2024 Rio Grande do Sul floods and the December 2025 Washington State atmospheric rivers.
>
> **How it works.** The Tipping Point Index (TPI) is the weighted geometric mean of three scores in [0,1]:
> - Rain: GPM IMERG 3-day accumulation against each pixel's own P90/P95/P99 climatology.
> - Soil: SMAP L4 root-zone wetness.
> - Terrain: NASADEM slope for landslides; a height-above-drainage proxy for floods.
>
> A geometric mean only goes Critical (>0.6) when rain, soil and terrain agree. For the days ahead, the observed rain is extended with the NOAA GFS forecast, our only non-NASA input. In replay we use the forecast actually issued each day, so "how early" is measured honestly. Alongside the index, an XGBoost model ranks the relative likelihood of a rain-triggered landslide `[skill numbers pending re-score — v2]`.
>
> Radar then checks the ground. NISAR L-band GCOV passes before and after the Washington storm show 27.99 km² of flood candidates within the NISAR swath, through cloud. Optical saw only 7% of that scene, and on that 7% our radar flood map overlaps the OPERA reference at F1 0.15. OPERA DSWx-S1 and DIST-ALERT-HLS add flood and landslide-scar candidates. SWOT gives river levels, VIIRS Black Marble gives night-light loss, and GPW population gives who is in the critical areas. Every map label carries its data date and source. Radar and optical outputs are always "candidates", never "confirmed".
>
> **Benefits.** Instead of municipality-wide alerts, Civil Defense gets a ranked list of priority areas with the people exposed, and a confirmation layer that works at night and through cloud. Using the forecast available at the time, Tipping Point flagged the Washington area [X] hours before the damage [ON HOLD — L35, re-score ~12:00]. We also state the limits: thresholds are calibrated on few events`[, and official warnings came first in both cases — awaiting Lucas, MORNING item 15]`. The map adds the "where" and the "who" to those warnings.
>
> **What we hope to achieve.** A municipal Civil Defense team in Southern Brazil should be able to open one page and see where to act first, then get a radar confirmation as soon as NISAR passes. Next steps:
> - Trigger the NISAR check on every new pass after an alert.
> - Calibrate thresholds on the landslide inventory.
> - Send alerts by WhatsApp and e-mail.
> - Extend coverage with a single config change.
>
> **Tools.**
> - App: TypeScript, Next.js 16, React 19, MapLibre GL, Recharts and Tailwind, deployed on Vercel.
> - Data pipeline: Python with uv, earthaccess, asf_search, xarray/rioxarray, rasterio, h5py, geopandas, scikit-image, XGBoost and scikit-learn (with SHAP), and cfgrib/eccodes for GFS GRIB.
> - Compute: Google Earth Engine for one-off compute; GitHub Actions for the 3-hourly live job.
> - Storage and alerts: Neon Postgres (free tier) for the Telegram alert subscriber store.
> - Team: `[TEAM NAME]` — `[member names]` — Local Event `[EVENT]`.

## 6. Use of Super Intelligence (SI)

This field is for data collection only and is not shown to judges. Source: `ai-declaration.md` (awaiting Lucas).

> Yes. We used AI coding assistants (Anthropic Claude via Claude Code, Cognition Devin, OpenAI Codex/GPT) under human direction. They helped write and review code for the data pipeline and the web app, and drafted documentation and submission text. The team wrote the idea and the method — the Tipping Point Index, the choice of NASA datasets, and the replay and radar-confirmation design — in our own project document before any AI-assisted build, and every data source, threshold and reported number was reviewed by the team. The AI use is acknowledged in descriptive text in both repository READMEs ("Use of AI") and in commit metadata (Co-Authored-By trailers). No AI-generated images, video or audio appear in the project or the demo; the demo is a screen recording of the real app with a human voiceover `[if a synthetic voice is used instead: "The demo voiceover is AI-generated text-to-speech" + note in the video description and file metadata]`.

## 7. NASA Data

Source: `nasa-data.md` (awaiting Lucas):

> - **Index:** GPM IMERG V07 (Final; Early in the live view), SMAP L4 (SPL4SMGP v008, root-zone wetness), NASADEM.
> - **Confirmation:** NISAR L2 GCOV (track 172D frame 064, BETA); HLS.
> - **Live flood and scar candidates:** OPERA DSWx-S1 and OPERA DIST-ALERT-HLS V1 (vegetation-loss alerts used to flag landslide scar candidates).
> - **Land cover:** MODIS MCD12Q1.
> - **Impact:** VIIRS Black Marble VNP46A2; GPW v4 (SEDAC).
> - **Validation:** OPERA DSWx, SWOT (Hydrocron river levels), NASA Global Landslide Catalog / COOLR.
>
> Accessed through NASA Earthdata (earthaccess), ASF (asf_search) and Google Earth Engine's NASA collections.

## 8. Space Agency Partner Data and Other References

> **Non-NASA data**
> - NOAA GFS 0.25° forecast rain. This is the only non-NASA index input, declared on every forecast frame.
> - JRC Global Surface Water v1.4: seasonal-water context.
> - MERIT Hydro: validation of the HAND proxy only.
> - IBGE country and municipality outlines.
> - UFRGS/Cemaden landslide inventory (RS 2024): validation.
> - Basemap: CARTO Dark Matter (no labels) — © CARTO, © OpenStreetMap contributors.
>
> **Event facts** (446 of 497 municipalities, 185 dead, 581,000+ displaced, ~R$88.9 billion damage): `[SOURCE NEEDED — these figures have no citation in our docs, and public sources give different totals (e.g. 183 deaths and 478 municipalities in later Defesa Civil RS counts; R$19 bn property damage on Wikipedia). Cite one official source (Defesa Civil RS final bulletin) and align the copy to it, or cut the figures.]`
>
> **Code and tools (open source):** Next.js, React, MapLibre GL, Recharts, Tailwind CSS, geotiff/georaster, the Google Earth Engine API, earthaccess, asf_search, xarray, rioxarray, rasterio, h5py, NumPy, SciPy, pandas, geopandas, scikit-image, scikit-learn, XGBoost, SHAP, cfgrib/ecCodes, Playwright (demo recording) and ffmpeg.
>
> **Services:** Vercel, GitHub Actions, Neon, Telegram Bot API.
>
> **Space Agency Partners:** none used directly. The Brazilian Space Agency is a 2026 partner, and Brazil-specific data (Cemaden, IBGE) is listed above.
>
> We used no copyrighted images; the demo shows only our own app screens.
