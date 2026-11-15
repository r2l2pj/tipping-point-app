# Morning review — Lucas, 2026-11-15

One page. Full detail, sources and history: `submission/REVIEW.md`. Every number in the pack comes from published `metrics.json` (tipping-point-data); no placeholders are left. DRAFT banners stay on until you approve.

## Compliance gate (L42) — click **Submit by ~20:00 BRT**, then keep editing until 23:59

Fill these before you click (search the files for the brackets):
1. `[TEAM NAME]`: `captions.srt` + `captions.pt-BR.srt` cue 1, video title card (`.crew/video/build-v5.sh` t0_team), `project-page.md` Tools/Team line, slide 1.
2. Member names (`[member names]` on the page, `[names]` on slide 1). Every member must be registered at **Florianópolis** (not waitlisted) and on the **Members** tab; 1–6 people; nobody can be added after submission closes.
3. `[APP URL]` (VPS, L39): FORM §4, project-page "Try it" (4 links), video close card (`APP_URL=… ./build-v5.sh`).
4. `[VIDEO LINK]` in FORM §3, after upload (≤30 s, test it in a private window).
5. Voice: if the VO is text-to-speech, replace `[if the VO is TTS, say so here]` on the page (Use of AI) and in `ai-declaration.md`; if it is a human voice, delete the bracket.
6. Local Event is filled: Florianópolis (Founder Haus, Jurerê).
7. Project page images: upload `.crew/deck/explainer/what-nisar-sees.png` and `future-of-nisar.png` where the page says *Figure (upload as an image here)*, then delete those italic notes.

Then tick both boxes (T&C + original work, all external code/text/images in References = FORM §8) and click **Submit**. Judges see only the last save.

## Submit today — deadline Sun Nov 15, 23:59, Local Event time (official 2026 guide)

Paste every field from `submission/FORM.md`, tick "Terms and Conditions" and "Confirm All Work is Original", then click **Submit for Judging**. You can resubmit until the deadline, and only the last save counts. The video must be **≤30 s**; anything longer is not eligible for Global Judging.

1. **Identity:** team name, member names, Local Event. All members must be confirmed at the same event. No one under 18 appears on camera.
2. **Voiceover (L38):** read `submission/captions.srt` (5 cues, 53 words incl. team name, 28.5 s) over the final cut. The final cut is recorded from a local build of `freeze-1300`. If you use TTS instead of your voice, it must be declared (see `ai-declaration.md`). You can still swap lines; the old 7-beat VO is retired.
3. **Host the video:** YouTube Unlisted, or Drive "anyone with the link". Test it in a private window and paste it into FORM §3.
4. **Confirm the AI declaration** (`ai-declaration.md`): the tool list, that the idea doc was written by the team, and human voice vs TTS.
5. **RS event facts — done (L36d):** one official source, Government of RS "SOS Rio Grande do Sul" (updated Aug 19, 2025): 478 municipalities affected, 185 deaths, 581,638 displaced at the peak. "446 of 497" and "R$88.9 bn" are cut.
6. **New choices awaiting you (win-odds review; details in REVIEW.md):**
   - **Decided by conductor (delegated), L38:** response is the spine. Headline = "Clouds hid 93% of the area from optical satellites; NISAR radar mapped 28 km² of flood candidates through them." The RS forecast result ("Using only the forecast available at the time, 36% of the 16,027 mapped landslides were already in High or Critical areas 27 hours before the first deaths (Critical: 2%)." Earlier runs (issued 51 and 75 hours before) showed 0%.) appears only in the validation table, README and slide-5 footnote, with its anchor sensitivity. The old 88% / May 1 line and "…marked the area as critical before the damage" are retired everywhere.
   - `project-page.md`: the NISAR-led page text, which judges read first.
   - **Decided (L38):** new 53-word VO, NISAR first, then who is affected live, then prediction (no number). LICENSE: Apache-2.0 ships in the app repo.
   - Tagline: keep "Radar confirms", or "Radar sees through."
   - Calling public alerts "experimental, not official".
   - Rule-by-rule status: `COMPLIANCE.md`.
7. Backup demo: `.crew/deck/slides.pdf` (7 slides), used only if the video slips. Optional: check the [APP URL] host is not blocked by school or office filters.

## Only you can do (2)

1. **ASF OPERA RTC-S1 EULA.** Accept the Alaska Satellite Facility EULA that covers OPERA RTC-S1 for the Earthdata account the pipeline uses (Earthdata Login profile → EULAs, or the prompt ASF shows when you sign in at search.asf.alaska.edu). Today ASF answers "EULA Acceptance Failure", so Rio Grande do Sul 2024 has **no radar flood map** (`flooded_km2` / `people_flooded` null). Then tell the conductor; lead-analysis runs the RS Sentinel-1 flood unit (post May 8/11, 2024).
2. **Optional — external trigger for the 3-hourly Now job.** GitHub sometimes drops scheduled runs (one fired in 6 h on Nov 15). In-repo backup `now-watchdog.yml` is already live and needs nothing. For a trigger outside GitHub: a Cloudflare Worker cron every 3 h that calls GitHub's `workflow_dispatch` for `now.yml`, which needs your Cloudflare account and a fine-grained GitHub PAT (Actions: write on `r2l2pj/tipping-point-data`) stored as a Worker secret, never in a repo. Skip it if the watchdog keeps runs on time.

## Check on your phone

Open [APP URL] on a real phone: the headless capture rendered the mobile Now map mostly black (likely a headless GPU artefact). Prod tour with screenshots: `.crew/review/morning/index.md`.

## Awaiting you (20) — note: `summary.md` is RETIRED (items quoting it no longer ship) — reply "approve all", or edit by number

1. "Tipping Point turns NASA rainfall and soil moisture data into a near real-time landslide and flood warning, then uses NISAR radar to confirm where the ground actually moved or flooded, so civil defense teams know where to act first." — *summary.md: Theme sentence (verbatim from docs/PLAN.md)* — doc-verbatim (L18); note: the UI swept "confirm" to "candidates", only this sentence and the tagline keep "confirm"
2. "Rain warns. Radar sees through." (L42) — *tagline; demo-script.md: close VO + on-screen; slides-outline.md: slide 1*
3. "NISAR radar sees new flooding through cloud; we turn each pass into a priority list." — *slides-outline.md: slide 1 one-liner* (win-odds-v2)
4. "In May 2024, floods hit Rio Grande do Sul: 478 municipalities affected, 185 deaths and 581,638 people displaced at the peak (Government of Rio Grande do Sul, SOS Rio Grande do Sul, updated Aug 19, 2025)." — *summary.md: Summary ¶* (L36d)
5. "Using only the forecast available at the time, 36% of the 16,027 mapped landslides were already in High or Critical areas 27 hours before the first deaths (Critical: 2%). Earlier runs (issued 51 and 75 hours before) showed 0%." — *project-page.md validation table, README #validation, slide 5 footnote* (decided, L38; never headline)
6. Video VO (L38): "Team [TEAM NAME], Brazil. / In Washington, clouds hid 93% of the area from optical satellites; NISAR radar mapped flood candidates through them. / Civil Defense could see who is affected, ranked, refreshed every 3 hours across southern Brazil. / Tipping Point maps where NASA rain, soil and slope data tip toward failure. / Rain warns. Radar confirms." — *captions.srt*
7. (retired: "230,000 people…" is no longer spoken; 229,782 stays on screen in beat D)
8. "May 2024, Rio Grande do Sul floods: 478 municipalities affected, 185 deaths, 581,638 people displaced at the peak" + source footnote — *slides-outline.md: slide 2* (L36d)
9. "Built for municipal Civil Defense in Southern Brazil (RS/SC/PR), the demo replays both events end-to-end, and a live Southern Brazil view refreshes every 3 hours." — *summary.md: Summary ¶* — was "the live operational pipeline is on our roadmap", no longer true (Now job runs every 3 h)
10. "Alerts cover whole municipalities — they say where it could happen, not where it did" — *slides-outline.md: slide 2*
11. "Optical satellites were blind: 100% cloud cover across 20 HLS scenes during the event" — *slides-outline.md: slide 2*
12. "TPI = geometric mean of Rain · Soil · Terrain scores, each in [0,1]" + class bands — *slides-outline.md: slide 3*
13. "WA Dec 2025: <flood sentence> — 27.99 km² flooded within the NISAR swath; landslides remain candidates only" — *slides-outline.md: slide 5*
14. "WA flood, honestly: 0.14% of the NISAR-flooded area was High (none Critical) in the forecasts issued 24–48 h before — the index uses local rain only" — *slides-outline.md: slide 5* (L36a)
15. "GFS under-forecast the RS peak by about half; official warnings still came before the index" — *slides-outline.md: slide 6 limitations*
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

**Draft slide 3 sentence (awaiting Lucas, also in REVIEW.md):** "Alongside the index, an XGBoost model ranks the relative likelihood of a rain-triggered landslide within 24 h (up to 14 days, low skill past 72 h); on held-out events it never saw ([v2 TEST events — pending re-score, L33]), driven by the NOAA GFS forecast, it reached PR-AUC [X] vs [Y] for the TPI > 0.6 rule (base rate [B]) [numbers pending v2 re-score, ~12:00] — TPI stays the headline."

## Decided by you (2026-11-15)

- "May 2024, Rio Grande do Sul. Alerts said where floods could happen, not where." — *demo-script.md: cold open VO*
- "NISAR radar sees through the clouds: 28 square kilometers of flood candidates." — *demo-script.md: beat 3 VO (+ on-screen 27.99 km² within the NISAR swath)*
- "Clouds hid 93% of the area from optical satellites." — *demo-script.md: beat 4 VO (9-word cut of Lucas's flood sentence, to fit 6 s; beat 3 already says the 28 km²)*
- "Clouds hid 93% of the area from optical satellites; NISAR radar mapped 28 km² of flood candidates through them." — *demo-script.md: beat 4 on-screen caption; slides-outline.md: slide 5*
- RETIRED (L36): "…the index marked the area as critical before the damage…" — removed from the script and slide 5.
- "Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA" (replay uses the GFS forecast issued each day; live uses the latest run; GEOS-FP removed) — *README: Forecast & model, live job; slides-outline.md: slides 4, 6, 7; nasa-data.md: intro + Forecast; demo-script.md production note*

## Decided overnight without you (logged in REVIEW.md, revertible)

- Demo beat 1 stays on the RS replay; beat 2 is WA (your call), shot on the GFS run issued Dec 3 (+3 d → Dec 6 Critical, landslide TPI).
- Demo/slides on-screen labels resynced to the Command Center UI; voiceover unchanged (64 words).
- README seams table rewritten for the Command Center; "replay, not real time" → live Southern Brazil view every 3 h.
- Slides: priority areas "Critical and High" (not "TPI ≥ 0.60"); roadmap drops already-shipped items.
- RS people figure dated to its peak day (May 3, 2024).

## Known gaps (being fixed by others)

- Landslide scar candidates on the map and the WA river-level (SWOT) chart: lead-analysis. The demo script marks both.
