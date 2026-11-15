# Morning review — Lucas, 2026-11-15

One page. Full detail, sources and history: `submission/REVIEW.md`. Every number in the pack comes from published `metrics.json` (tipping-point-data); no placeholders are left. DRAFT banners stay on until you approve.

## Submit today — deadline Sun Nov 15, 23:59, Local Event time (official 2026 guide)

Paste every field from `submission/FORM.md`, tick "Terms and Conditions" and "Confirm All Work is Original", then click **Submit for Judging**. You can resubmit until the deadline, and only the last save counts. The video must be **≤30 s**; anything longer is not eligible for Global Judging.

1. **Identity:** team name, member names, Local Event. All members must be confirmed at the same event. No one under 18 appears on camera.
2. **Voiceover:** read `submission/captions.srt` (64 words, about 29 s) over the rough cut. Rough cut: `.crew/video/rough-cut-v1.mp4`; the final is re-shot from the 13:00 `freeze-1300` build. If you use TTS instead of your voice, it must be declared (see `ai-declaration.md`).
3. **Host the video:** YouTube Unlisted, or Drive "anyone with the link". Test it in a private window and paste it into FORM §3.
4. **Confirm the AI declaration** (`ai-declaration.md`): the tool list, that the idea doc was written by the team, and human voice vs TTS.
5. **RS event facts need a source** (446 of 497 municipalities, 185 dead, 581,000+ displaced, R$88.9 bn). Public totals differ (e.g. 183 deaths, 478 municipalities). Either cite one official source or cut the figures.
6. **New choices awaiting you (win-odds review; details in REVIEW.md):**
   - Headline candidate to replace the on-hold lead time: "Using the forecast available at the time, 88% of the 16,027 landslides mapped in Rio Grande do Sul were already in High or Critical areas 24 h before May 1, 2024." If you use it, the 48 h run's 0.3% must be stated too.
   - `project-page.md`: the NISAR-led page text, which judges read first.
   - The alternative 54-word VO.
   - Tagline: keep "Radar confirms", or "Radar sees through."
   - Calling public alerts "experimental, not official".
   - Rule-by-rule status: `COMPLIANCE.md`.
7. Backup demo: `.crew/deck/slides.pdf` (7 slides), used only if the video slips. Optional: FortiGuard classification for the vercel.app URL.

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
5. "In replay with the NOAA GFS forecast issued each day (no look-ahead), Washington (Dec 2025) reached Critical a median of [X] h before the damage (IQR [IQR]; [n] of [N] forecast days flagged it); in Rio Grande do Sul (May 2024), [n] of [N] forecast days flagged it, [Y] h ahead. [ON HOLD — L35, re-score ~12:00]" — *summary.md: Summary ¶ (supporting); demo-script.md: beat 2 sub-caption + production note; slides-outline.md: slide 5 footnote*
6. "Tipping Point replays it: extreme rain, saturated soil —" — *demo-script.md: beat 1 VO*
7. "230,000 people in critical areas, prioritized for Civil Defense." — *demo-script.md: beat 5 VO (+ on-screen 229,782, night-light drop 44%)*
8. "May 2024, Rio Grande do Sul: worst floods in state history — 446 of 497 municipalities hit / 185 dead, 581,000+ displaced, ~R$88.9 billion in damage" — *slides-outline.md: slide 2*
9. "Built for municipal Civil Defense in Southern Brazil (RS/SC/PR), the demo replays both events end-to-end, and a live Southern Brazil view refreshes every 3 hours." — *summary.md: Summary ¶* — was "the live operational pipeline is on our roadmap", no longer true (Now job runs every 3 h)
10. "Alerts cover whole municipalities — they say where it could happen, not where it did" — *slides-outline.md: slide 2*
11. "Optical satellites were blind: 100% cloud cover across 20 HLS scenes during the event" — *slides-outline.md: slide 2*
12. "TPI = geometric mean of Rain · Soil · Terrain scores, each in [0,1]" + class bands — *slides-outline.md: slide 3*
13. "WA Dec 2025: <flood sentence> — 27.99 km² flooded within the NISAR swath; landslides remain candidates only" — *slides-outline.md: slide 5*
14. "RS replay (no radar — event predates NISAR, so no flood-overlap score): [Y] h ahead on [n] of [N] forecast days [ON HOLD — L35, re-score ~12:00] — too few to call a median" — *slides-outline.md: slide 5*
15. "lead time counts the area as flagged when any pixel crosses Critical on a D+1..D+3 forecast frame (lenient); GFS under-forecast the RS peak by about half; official warnings still came before the index" — *slides-outline.md: slide 6 limitations* — new honesty caveats; "official warnings still came before the index" is the comparison you had kept out — keep or cut
16. "Optical saw only 7% of the scene in WA (92.9% cloud) and 0% in RS (100% cloud) — that is why radar" — *slides-outline.md: slide 5; demo-script.md beat 4 on-screen (7%)*
17. "229,782 people in critical areas + night-light drop 44% (WA, Dec 12, 2025); 1,488,833 + 33% (RS, peak day May 3, 2024)" — *slides-outline.md: slide 6*
18. nasa-data.md: "Live response" section (OPERA DSWx-S1, NISAR GCOV, MODIS MCD12Q1) + "Non-NASA context and reference layers (never index inputs)": JRC GSW v1.4, IBGE outlines, UFRGS/Cemaden inventory, MERIT Hydro — *nasa-data.md*
19. Limitations + roadmap + NASA-inputs lines — *slides-outline.md: slides 6–7*
20. The ML sentence on slide 3 — see the draft at the end of "ML results" above — *slides-outline.md: slide 3*

## ML results (**provisional — being re-scored, v2 ~12:00**; v1 = data ea5b2cd, `.crew/research/model-metrics.md`)

**L33: every number below is v1 and superseded — 40% of the GFS-source negatives had no GFS run. Do not quote any of them; v2 re-scored numbers ~12:00.**

TEST = events never seen in training: one Rio Grande do Sul storm (3,000 inventory points, May 2024) + 8 dated Washington reports. Thresholds and calibration from VAL only; TEST read once.

- **Trigger, P(landslide within 24 h) with the NOAA GFS forecast (provisional — being re-scored, v2 ~12:00):** v1 PR-AUC XGBoost **0.752** vs RandomForest 0.733 vs TPI > 0.6 rule 0.613 (base rate 0.154; ROC 0.934 / 0.900 / 0.808). XGBoost leads at 24/48/72 h; 7 d and 14 d are labelled low skill.
- **Withdrawn (L32):** the "when × where" figures (trigger × T_ML, what the live map serves) and the T_ML terrain-model figures are pulled: RS points leaked into the terrain model. Do not quote any of them until lead-ml republishes. The trigger-only v1 numbers are now also provisional (L33).
- **Raw vs calibrated (v1, provisional):** the trigger numbers above are calibrated scores (what is served). Raw scores rank 0.00–0.03 PR-AUC higher.
- **Caveats (say them with any number):** one RS storm, so the effective n is small and intervals would be wide; training data is mostly 2015–2018; scores are relative rankings (case-control), not real-world probabilities; a day-of-year-only baseline looks near-perfect on RS (calendar artefact, excluded).

**Draft slide 3 sentence (awaiting Lucas, also in REVIEW.md):** "Alongside the index, an XGBoost model ranks the relative likelihood of a rain-triggered landslide within 24 h (up to 14 days, low skill past 72 h); on held-out events it never saw (Rio Grande do Sul, May 2024, plus 8 Washington reports), driven by the NOAA GFS forecast, it reached PR-AUC [X] vs [Y] for the TPI > 0.6 rule (base rate [B]) [numbers pending v2 re-score, ~12:00] — TPI stays the headline."

## Decided by you (2026-11-15)

- **ON HOLD (L35)** "Using the forecast available at the time, Tipping Point flagged the area [X] hours before the damage." — *summary.md: Summary ¶; demo-script.md: beat 2 on-screen caption + production notes; slides-outline.md: slide 5 headline*
- "May 2024, Rio Grande do Sul. Alerts said where floods could happen, not where." — *demo-script.md: cold open VO*
- **ON HOLD (L35)** "Flagged [X] hours before the damage." — *demo-script.md: beat 2 VO (short form; full headline on screen)*
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
