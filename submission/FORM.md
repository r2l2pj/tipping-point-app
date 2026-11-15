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

Paste from `project-page.md` → "High-Level Project Summary". That is the NISAR-led version, 155 words plus the headline. The headline is ON HOLD (L35); the RS 88% candidate is awaiting Lucas. The older 240-word version in `summary.md` is kept as an alternative (awaiting Lucas).

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

Paste from `project-page.md` → "Detailed Project Description". Its sections are:
- what it does
- how it works
- what NISAR shows and why
- what's new vs LHASA / OPERA / GFMS
- a validation table with n and caveats
- limitations
- try-it links
- **Use of AI** (judge-visible, as the guide requires; the SI field below is not shown to judges)
- tools and team

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
> - NASA Global Landslide Catalog / COOLR: WA validation (also listed under NASA Data).
> - Basemap: CARTO Dark Matter (no labels) — © CARTO, © OpenStreetMap contributors.
>
> **Event facts** (446 of 497 municipalities, 185 dead, 581,000+ displaced, ~R$88.9 billion damage): `[SOURCE NEEDED — these figures have no citation in our docs, and public sources give different totals (e.g. 183 deaths and 478 municipalities in later Defesa Civil RS counts; R$19 bn property damage on Wikipedia). Cite one official source (Defesa Civil RS final bulletin) and align the copy to it, or cut the figures.]`
>
> **Code and tools (open source):** Next.js, React, MapLibre GL, Recharts, Tailwind CSS, geotiff/georaster, the Google Earth Engine API, earthaccess, asf_search, xarray, rioxarray, rasterio, h5py, NumPy, SciPy, pandas, geopandas, scikit-image, scikit-learn, XGBoost, SHAP, cfgrib/ecCodes, Playwright (demo recording) and ffmpeg.
>
> **Services:** Vercel, GitHub Actions, Neon, Telegram Bot API.
>
> **Space Agency Partners:** ESA Sentinel-1 radar, through NASA OPERA DSWx-S1 (live flood candidates and the Washington validation reference). The Brazilian Space Agency is also a 2026 partner; Brazil-specific data (Cemaden, IBGE) is listed above.
>
> We used no copyrighted images; the demo shows only our own app screens.
