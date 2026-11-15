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
| "IoU X, P% warned first." | demo-script.md: beat 4 VO | X, P | awaiting Lucas |
| "230,000 people in critical areas, prioritized for Civil Defense." | demo-script.md: beat 5 VO (+ on-screen 229,782, night-light drop 44%) | none — filled (WA people_critical 229,782 on Dec 12, 2025) | awaiting Lucas |
| "May 2024, Rio Grande do Sul: worst floods in state history — 446 of 497 municipalities hit / 185 dead, 581,000+ displaced, ~R$88.9 billion in damage" | slides-outline.md: slide 2 | none (documented facts) | awaiting Lucas |
| "Alerts cover whole municipalities — they say where it could happen, not where it did" | slides-outline.md: slide 2 | none | awaiting Lucas |
| "Optical satellites were blind: 100% cloud cover across 20 HLS scenes during the event" | slides-outline.md: slide 2 | none — filled (RS cloud_pct 100.0, hls_scenes 20) | awaiting Lucas |
| "TPI = geometric mean of Rain · Soil · Terrain scores, each in [0,1]" + class bands | slides-outline.md: slide 3 | none | awaiting Lucas |
| "WA Dec 2025 replay vs NISAR GCOV reference: IoU X, F1 X over X km² confirmed flooded" | slides-outline.md: slide 5 | X, X, X | awaiting Lucas |
| "RS replay ... IoU X, F1 X, median X h (IQR A-B h, n = N), P% warned" | slides-outline.md: slide 5 | X, X, X, A, B, N, P | awaiting Lucas |
| "Optical saw only 7% of the scene in WA (92.9% cloud) and 0% in RS (100% cloud) — that is why radar" | slides-outline.md: slide 5; demo-script.md beat 4 on-screen (7%) | none — filled | awaiting Lucas |
| "229,782 people in critical areas + night-light drop 44% (WA, Dec 12, 2025); 1,488,833 + 33% (RS, May 2, 2024)" | slides-outline.md: slide 6 | none — filled | awaiting Lucas |
| Limitations + roadmap + NASA-inputs lines | slides-outline.md: slides 6–7 | none | awaiting Lucas |
| "Replay D+1..D+3 uses the real NOAA GFS forecast issued on each day …; live mode uses NASA GEOS-FP" / "One declared non-NASA input: NOAA GFS forecasts, replay D+1..D+3 only" | slides-outline.md: slides 4, 6, 7; nasa-data.md: Forecast; demo-script.md beat 2 | none (L22) | awaiting Lucas |
| "Alongside the index, a learned XGBoost model gives P(landslide trigger in 24/48/72 h); TPI stays the headline" | slides-outline.md: slide 3 | none — no model metric quoted until published (L25) | awaiting Lucas |

## Open items

**Source for every filled number:** published `metrics.json` — tipping-point-data f450b72, byte-identical to the Neon copy (2026-11-15 00:28Z).

**Held for Lucas — the published numbers do not support the current sentence as written:**

- **Lead-time headline X / A / B / N.** Observed (as-available) replay is *negative*: RS median −33 h (IQR −33 to −33 h, n = 5,609 clusters), only 2.9% warned before the damage anchor; WA has no dated landslide inventory (null). The L22 **forecast** lead time (NOAA GFS replay) is the candidate positive figure, but its current values are **PROVISIONAL and withheld**: the GFS forecast grid was one row off and lead-analysis is rebuilding it — figures go here only after the rebuilt numbers are published. Using it will need new wording — the template says "using only data available at the time … before mapped landslides (n = N)", but the forecast metric's n is issue days, and the forecast is NOAA, not NASA. Wording decision pending with Lucas (via conductor): how to state the GFS-forecast figure next to the negative observed one.
- **IoU / F1 (WA, NISAR flood vs OPERA DSWx, 5 scenes Dec 15 + 17, 2025).** IoU 0.0075, F1 0.015 over n ≈ 16.25 M clear OPERA pixels (TP 9,287 · FP 37,576 · FN ≈ 1.19 M). Context: the scene was 92.9% cloud and the NISAR post scene covers 74.1% of the AOI; the score is driven by FN — OPERA marks ≈ 1.19 M water pixels that the 27.99 km² NISAR flood mask does not (cause not yet diagnosed: permanent water vs out-of-swath vs date gap). Against the HLS-based OPERA subset (6 scenes, n ≈ 1.52 M clear pixels): IoU 0.013, F1 0.026, TP 8,137 · FP 34 · FN ≈ 603 k — where both see water, they agree (precision 99.6%), but recall is low. RS: no IoU/F1 (event predates NISAR). Wording decision pending with Lucas; whatever is quoted carries n and cloud %.
- **P% warned first.** RS 2.9% of n = 5,609 landslide clusters crossed Critical before the damage anchor (as-available basis, 2024-04-27, MetSul); WA null (no dated landslide inventory). Wording decision pending with Lucas, together with the lead time.
- **L22 forecast copy — updated, needs app check.** Slides 3/4/6/7, demo script and nasa-data.md now say the replay forecast is NOAA GFS (issued that day, the only non-NASA input) and perfect forecast is an upper bound only. App chip on main (c60c1db) reads "forecast · GFS (issued <date>)" on GFS frames; prod not yet redeployed. Copy uses "forecast · NOAA GFS (issued <date>)" — lead-app (t173) agreed: chip becomes "forecast · NOAA GFS (issued <date>)" in the cc-gfs-chip unit (Command Center merge, 2026-11-15); re-check on prod after redeploy.

- **X** — metric values (median lead time h, IoU, F1, flooded km², optical/cloud %, people in critical areas): filled by final `metrics.json` from the real pipeline.
- **A, B** — IQR bounds of lead time: lead-time pipeline (lead-analysis).
- **N** — number of mapped landslides in the lead-time sample: lead-time pipeline.
- **P** — zones warned before event / night-light drop %: metrics pipeline.
- **Official-warning comparison** — REMOVED from public copy: real deltas are negative (official forecast warnings preceded our observed-rain crossing: rs_2024 -31.2 h vs INMET aviso 2024-04-26T16:50Z; wa_2025 -71.8 h vs NWS watch 2025-12-06T00:10Z). Never claim earlier-than-official; the lead-time headline stays vs the damage anchor. Lucas decides whether the honest comparison is shown.
- **U5** — landed: RADAR NISAR before/after swipe is wired and the published wa_2025 manifest has `nisar_pre`/`nisar_post`; verify on the recorded build.
- **Copy approval** — Lucas reviews all of the above on the morning of 2026-11-15 (L18).
