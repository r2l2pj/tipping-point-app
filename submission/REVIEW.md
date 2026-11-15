# Submission copy — review sheet for Lucas

> **DRAFT — pending approval.**

One page: every public-facing sentence in the pack, where it appears, and which placeholders still need real values. All sentences below are **awaiting Lucas** (copy review 2026-11-15 morning, per L18).

| Sentence | Where | Open placeholders | Status |
| --- | --- | --- | --- |
| "Tipping Point turns NASA rainfall and soil moisture data into a near real-time landslide and flood warning, then uses NISAR radar to confirm where the ground actually moved or flooded, so civil defense teams know where to act first." | summary.md: Theme sentence (verbatim from docs/PLAN.md) | none | awaiting Lucas |
| "Rain warns. Radar confirms." | summary.md: tagline; demo-script.md: close VO + on-screen; slides-outline.md: slide 1 | none | awaiting Lucas |
| "Three NASA missions, three layers, one tipping point." | summary.md: one-liner; slides-outline.md: slide 1 | none | awaiting Lucas |
| "In May 2024, Rio Grande do Sul suffered the worst floods in state history — 446 of 497 municipalities hit, hundreds of thousands displaced." | summary.md: Summary ¶ | none (documented facts) | awaiting Lucas |
| "Tipping Point would have warned X hours earlier." | summary.md: Summary ¶; demo-script.md: beat 2 VO; slides-outline.md: slide 5 headline | X (median lead time) | awaiting Lucas |
| "In replay, using only data available at the time, the index crossed Critical a median of X h (IQR A-B h) before mapped landslides (n = N)" | summary.md: Summary ¶ (supporting); demo-script.md: beat-2 supporting card + production note; slides-outline.md: slide 5 footnote | X, A, B, N | awaiting Lucas |
| "May 2024, Rio Grande do Sul. The alert said where floods could happen — not where they did." | demo-script.md: cold open VO | none | awaiting Lucas |
| "Tipping Point replays it: extreme rain, saturated soil —" | demo-script.md: beat 1 VO | none | awaiting Lucas |
| "NISAR radar confirms through the clouds: 28 square kilometers flooded within the NISAR swath." | demo-script.md: beat 3 VO (+ on-screen 27.99 km²) | none — filled (flooded_km2 27.99, swath 74.1% of AOI) | awaiting Lucas |
| "On the 7% optical could see, radar overlaps at F1 0.15." | demo-script.md: beat 4 VO (lead-submission's 11-word cut of Lucas's flood sentence, to fit 6 s) | none | **check with Lucas** — compression of a decided sentence |
| "Optical satellites were 92.9% blind under the clouds. On the 7% they could see, our radar flood map overlaps at F1 0.15 (precision 0.19, recall 0.13, new flood only). Radar maps the rest." | demo-script.md: beat 4 on-screen caption; slides-outline.md: slide 5 | none — F1 0.1509 / P 0.1873 / R 0.1263 (like-for-like) | **decided by Lucas 2026-11-15** |
| "With the forecast available at the time, the index marked the area as critical before the damage, adding a map of where and who to the official warnings." | demo-script.md: beat 4 on-screen caption; slides-outline.md: slide 5 | none | **decided by Lucas 2026-11-15** (replaces "% warned first" everywhere) |
| "230,000 people in critical areas, prioritized for Civil Defense." | demo-script.md: beat 5 VO (+ on-screen 229,782, night-light drop 44%) | none — filled (WA people_critical 229,782 on Dec 12, 2025) | awaiting Lucas |
| "May 2024, Rio Grande do Sul: worst floods in state history — 446 of 497 municipalities hit / 185 dead, 581,000+ displaced, ~R$88.9 billion in damage" | slides-outline.md: slide 2 | none (documented facts) | awaiting Lucas |
| "Alerts cover whole municipalities — they say where it could happen, not where it did" | slides-outline.md: slide 2 | none | awaiting Lucas |
| "Optical satellites were blind: 100% cloud cover across 20 HLS scenes during the event" | slides-outline.md: slide 2 | none — filled (RS cloud_pct 100.0, hls_scenes 20) | awaiting Lucas |
| "TPI = geometric mean of Rain · Soil · Terrain scores, each in [0,1]" + class bands | slides-outline.md: slide 3 | none | awaiting Lucas |
| "WA Dec 2025: <flood sentence> — 27.99 km² flooded within the NISAR swath; landslides remain candidates only" | slides-outline.md: slide 5 | none | flood sentence decided by Lucas; km² line awaiting Lucas |
| "RS replay (no radar — event predates NISAR, so no flood-overlap score): median X h (IQR A-B h, n = N)" | slides-outline.md: slide 5 | X, A, B, N (lead time) | awaiting t174 numbers |
| "Optical saw only 7% of the scene in WA (92.9% cloud) and 0% in RS (100% cloud) — that is why radar" | slides-outline.md: slide 5; demo-script.md beat 4 on-screen (7%) | none — filled | awaiting Lucas |
| "229,782 people in critical areas + night-light drop 44% (WA, Dec 12, 2025); 1,488,833 + 33% (RS, May 2, 2024)" | slides-outline.md: slide 6 | none — filled | awaiting Lucas |
| Limitations + roadmap + NASA-inputs lines | slides-outline.md: slides 6–7 | none | awaiting Lucas |
| "Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA" (replay uses the GFS forecast issued each day; live uses the latest run; GEOS-FP removed) | README: Forecast & model, live job; slides-outline.md: slides 4, 6, 7; nasa-data.md: intro + Forecast; demo-script.md production note | none | **decided by Lucas 2026-11-15 (L30)** |
| "Alongside the index, a learned XGBoost model gives P(landslide trigger in 24/48/72 h); TPI stays the headline" | slides-outline.md: slide 3 | none — no model metric quoted until published (L25) | awaiting Lucas |

## Open items

**Source for every filled number:** published `metrics.json` — tipping-point-data f450b72, byte-identical to the Neon copy (2026-11-15 00:28Z).

**Flood-score source:** tipping-point-data 864cf95 (`opera_dswx_like_for_like` on the GitHub `fallback` branch = flat `f1`/`precision`/`recall` on Neon).

**Decisions and held items:**

- **Lead-time headline X / A / B / N.** Observed (as-available) replay is *negative*: RS median −33 h (IQR −33 to −33 h, n = 5,609 clusters), only 2.9% warned before the damage anchor; WA has no dated landslide inventory (null). The L22 **forecast** lead time (NOAA GFS replay) is the candidate positive figure, but its current values are **PROVISIONAL and withheld**: the GFS forecast grid was one row off and lead-analysis is rebuilding it — figures go here only after the rebuilt numbers are published. Using it will need new wording — the template says "using only data available at the time … before mapped landslides (n = N)", but the forecast metric's n is issue days, and the forecast is NOAA, not NASA. **Decided by Lucas 2026-11-15:** the lead time is quoted only after lead-analysis's (t174) rebuilt numbers, always with n; until then X/A/B/N stay.
- **Flood score — DECIDED by Lucas 2026-11-15.** Public sentence: "Optical satellites were 92.9% blind under the clouds. On the 7% they could see, our radar flood map overlaps at F1 0.15 (precision 0.19, recall 0.13, new flood only). Radar maps the rest." Numbers (like-for-like, new flood only = post-water and not pre-water Dec 1–7, cloud-free on both dates): F1 0.1509, precision 0.1873, recall 0.1263, IoU 0.0816 (TP 8,777 · FP 38,086 · FN 60,704). Context kept: the raw all-water comparison scores IoU 0.0075 / F1 0.015 / precision 0.198 / recall 0.008 because its FN was permanent water (data 3f7f969); the HLS-OPERA subset scores IoU 0.013 / F1 0.026. Cloud 92.9% (OPERA DSWx-HLS cloud class, Dec 15/17). RS: no flood score (event predates NISAR). Landslides stay "candidates".
- **"% warned first" — DROPPED by Lucas 2026-11-15** from demo beat 4 and slide 5. Replaced by: "With the forecast available at the time, the index marked the area as critical before the damage, adding a map of where and who to the official warnings." Context kept: as-available, RS 2.9% of n = 5,609 landslide clusters crossed Critical before the damage anchor (2024-04-27, MetSul); WA null (no dated landslide inventory).
- **L22 forecast copy — updated, needs app check.** Slides 3/4/6/7, demo script and nasa-data.md now say the replay forecast is NOAA GFS (issued that day, the only non-NASA input) and perfect forecast is an upper bound only. App chip on main (c60c1db) reads "forecast · GFS (issued <date>)" on GFS frames; prod not yet redeployed. Copy uses "forecast · NOAA GFS (issued <date>)" — lead-app (t173) agreed: chip becomes "forecast · NOAA GFS (issued <date>)" in the cc-gfs-chip unit (Command Center merge, 2026-11-15); re-check on prod after redeploy.

- **X** — metric values (median lead time h, IoU, F1, flooded km², optical/cloud %, people in critical areas): filled by final `metrics.json` from the real pipeline.
- **A, B** — IQR bounds of lead time: lead-time pipeline (lead-analysis).
- **N** — number of mapped landslides in the lead-time sample: lead-time pipeline.
- **Official-warning comparison** — REMOVED from public copy: real deltas are negative (official forecast warnings preceded our observed-rain crossing: rs_2024 -31.2 h vs INMET aviso 2024-04-26T16:50Z; wa_2025 -71.8 h vs NWS watch 2025-12-06T00:10Z). Never claim earlier-than-official; the lead-time headline stays vs the damage anchor. Lucas decides whether the honest comparison is shown.
- **U5** — landed: RADAR NISAR before/after swipe is wired and the published wa_2025 manifest has `nisar_pre`/`nisar_post`; verify on the recorded build.
- **Copy approval** — Lucas reviews all of the above on the morning of 2026-11-15 (L18).
