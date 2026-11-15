# Morning review — Lucas, 2026-11-15

One page. Full detail, sources and history: `submission/REVIEW.md`. Every number in the pack comes from published `metrics.json` (tipping-point-data); no placeholders are left. DRAFT banners stay on until you approve.

## Only you can do (2)

1. **ASF OPERA RTC-S1 EULA.** Accept the Alaska Satellite Facility EULA that covers OPERA RTC-S1 for the Earthdata account the pipeline uses (Earthdata Login profile → EULAs, or the prompt ASF shows when you sign in at search.asf.alaska.edu). Today ASF answers "EULA Acceptance Failure", so Rio Grande do Sul 2024 has **no radar flood map** (`flooded_km2` / `people_flooded` null). Then tell the conductor; lead-analysis runs the RS Sentinel-1 flood unit (post May 8/11, 2024).
2. **Optional — external trigger for the 3-hourly Now job.** GitHub sometimes drops scheduled runs (one fired in 6 h on Nov 15). In-repo backup `now-watchdog.yml` is already live and needs nothing. For a trigger outside GitHub: a Cloudflare Worker cron every 3 h that calls GitHub's `workflow_dispatch` for `now.yml`, which needs your Cloudflare account and a fine-grained GitHub PAT (Actions: write on `r2l2pj/tipping-point-data`) stored as a Worker secret, never in a repo. Skip it if the watchdog keeps runs on time.

## Check on your phone

Open https://tipping-point-app.vercel.app on a real phone: the headless capture rendered the mobile Now map mostly black (likely a headless GPU artefact). Prod tour with screenshots: `.crew/review/morning/index.md`.

## Awaiting you (20) — reply "approve all", or edit by number

1. "Tipping Point turns NASA rainfall and soil moisture data into a near real-time landslide and flood warning, then uses NISAR radar to confirm where the ground actually moved or flooded, so civil defense teams know where to act first." — *summary.md: Theme sentence (verbatim from docs/PLAN.md)* — doc-verbatim (L18); note: the UI swept "confirm" to "candidates", only this sentence and the tagline keep "confirm"
2. "Rain warns. Radar confirms." — *summary.md: tagline; demo-script.md: close VO + on-screen; slides-outline.md: slide 1*
3. "Three NASA missions, three layers, one tipping point." — *summary.md: one-liner; slides-outline.md: slide 1*
4. "In May 2024, Rio Grande do Sul suffered the worst floods in state history — 446 of 497 municipalities hit, hundreds of thousands displaced." — *summary.md: Summary ¶*
5. "In replay with the NOAA GFS forecast issued each day (no look-ahead), Washington (Dec 2025) reached Critical a median of 85 h before the damage (IQR 55–115 h; 6 of 8 forecast days flagged it); in Rio Grande do Sul (May 2024), 1 of 4 forecast days flagged it, 111 h ahead." — *summary.md: Summary ¶ (supporting); demo-script.md: beat 2 sub-caption + production note; slides-outline.md: slide 5 footnote*
6. "Tipping Point replays it: extreme rain, saturated soil —" — *demo-script.md: beat 1 VO*
7. "230,000 people in critical areas, prioritized for Civil Defense." — *demo-script.md: beat 5 VO (+ on-screen 229,782, night-light drop 44%)*
8. "May 2024, Rio Grande do Sul: worst floods in state history — 446 of 497 municipalities hit / 185 dead, 581,000+ displaced, ~R$88.9 billion in damage" — *slides-outline.md: slide 2*
9. "Built for municipal Civil Defense in Southern Brazil (RS/SC/PR), the demo replays both events end-to-end, and a live Southern Brazil view refreshes every 3 hours." — *summary.md: Summary ¶* — was "the live operational pipeline is on our roadmap", no longer true (Now job runs every 3 h)
10. "Alerts cover whole municipalities — they say where it could happen, not where it did" — *slides-outline.md: slide 2*
11. "Optical satellites were blind: 100% cloud cover across 20 HLS scenes during the event" — *slides-outline.md: slide 2*
12. "TPI = geometric mean of Rain · Soil · Terrain scores, each in [0,1]" + class bands — *slides-outline.md: slide 3*
13. "WA Dec 2025: <flood sentence> — 27.99 km² flooded within the NISAR swath; landslides remain candidates only" — *slides-outline.md: slide 5*
14. "RS replay (no radar — event predates NISAR, so no flood-overlap score): 111 h ahead on the one forecast day (of 4) that flagged it — too few to call a median" — *slides-outline.md: slide 5*
15. "lead time counts the area as flagged when any pixel crosses Critical on a D+1..D+3 forecast frame (lenient); GFS under-forecast the RS peak by about half; official warnings still came before the index" — *slides-outline.md: slide 6 limitations* — new honesty caveats; "official warnings still came before the index" is the comparison you had kept out — keep or cut
16. "Optical saw only 7% of the scene in WA (92.9% cloud) and 0% in RS (100% cloud) — that is why radar" — *slides-outline.md: slide 5; demo-script.md beat 4 on-screen (7%)*
17. "229,782 people in critical areas + night-light drop 44% (WA, Dec 12, 2025); 1,488,833 + 33% (RS, peak day May 3, 2024)" — *slides-outline.md: slide 6*
18. nasa-data.md: "Live response" section (OPERA DSWx-S1, NISAR GCOV, MODIS MCD12Q1) + "Non-NASA context and reference layers (never index inputs)": JRC GSW v1.4, IBGE outlines, UFRGS/Cemaden inventory, MERIT Hydro — *nasa-data.md*
19. Limitations + roadmap + NASA-inputs lines — *slides-outline.md: slides 6–7*
20. "Alongside the index, a learned XGBoost model gives P(landslide trigger in 24/48/72 h); TPI stays the headline" — *slides-outline.md: slide 3*

## Decided by you (2026-11-15)

- "Using the forecast available at the time, Tipping Point flagged the area 85 hours before the damage." — *summary.md: Summary ¶; demo-script.md: beat 2 on-screen caption + production notes; slides-outline.md: slide 5 headline*
- "May 2024, Rio Grande do Sul. Alerts said where floods could happen, not where." — *demo-script.md: cold open VO*
- "Flagged 85 hours before the damage." — *demo-script.md: beat 2 VO (short form; full headline on screen)*
- "NISAR radar sees through the clouds: 28 square kilometers of flood candidates." — *demo-script.md: beat 3 VO (+ on-screen 27.99 km² within the NISAR swath)*
- "On the 7% optical could see, radar overlaps at F1 0.15." — *demo-script.md: beat 4 VO (lead-submission's 11-word cut of Lucas's flood sentence, to fit 6 s)*
- "Optical satellites were 92.9% blind under the clouds. On the 7% they could see, our radar flood map overlaps at F1 0.15 (precision 0.19, recall 0.13, new flood only). Radar maps the rest." — *demo-script.md: beat 4 on-screen caption; slides-outline.md: slide 5*
- "With the forecast available at the time, the index marked the area as critical before the damage, adding a map of where and who to the official warnings." — *demo-script.md: beat 4 on-screen caption; slides-outline.md: slide 5*
- "Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA" (replay uses the GFS forecast issued each day; live uses the latest run; GEOS-FP removed) — *README: Forecast & model, live job; slides-outline.md: slides 4, 6, 7; nasa-data.md: intro + Forecast; demo-script.md production note*

## Decided overnight without you (logged in REVIEW.md, revertible)

- Demo beat 1 stays on the RS replay; beat 2 is WA (your call), shot on the GFS run issued Dec 3 (+3 d → Dec 6 Critical, landslide TPI).
- Demo/slides on-screen labels resynced to the Command Center UI; voiceover unchanged (64 words).
- README seams table rewritten for the Command Center; "replay, not real time" → live Southern Brazil view every 3 h.
- Slides: priority areas "Critical and High" (not "TPI ≥ 0.60"); roadmap drops already-shipped items.
- RS people figure dated to its peak day (May 3, 2024).

## Known gaps (being fixed by others)

- Landslide scar candidates on the map and the WA river-level (SWOT) chart: lead-analysis. The demo script marks both.
- No trigger-model metric is quoted until the ML run publishes one (slide 3 names the model only).
