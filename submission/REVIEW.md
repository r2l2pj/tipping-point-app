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

## Open items

**Source for every filled number:** published `metrics.json` — tipping-point-data f450b72, byte-identical to the Neon copy (2026-11-15 00:28Z).

**Held for Lucas — the published numbers do not support the current sentence as written:**

- **Lead-time headline X / A / B / N.** Observed (as-available) replay is *negative*: RS median −33 h (IQR −33 to −33 h, n = 5,609 clusters), only 2.9% warned before the damage anchor; WA has no dated landslide inventory (null). The positive numbers are the L22 **forecast** lead time (NOAA GFS replay): RS would-have-warned 135 h, median 123 h (IQR 117–129 h, n = 2 of 16 issue days); WA 145 h, median 85 h (IQR 55–115 h, n = 6 of 21 issue days). Using them needs new wording — the template says "using only data available at the time … before mapped landslides (n = N)", but the forecast metric's n is issue days, and the forecast is NOAA, not NASA. Decide: GFS-forecast headline with reworded support line, or drop the hours headline.
- **IoU / F1.** WA IoU 0.0075, F1 0.015 (HLS-OPERA reference: IoU 0.013, F1 0.026); RS IoU/F1 null. Quoting these in the VO ("IoU X") or on slide 5 would undercut the pitch. Decide: drop IoU from beat 4 and slide 5, or explain the reference mismatch.
- **P% warned first.** RS 2.9% (as-available), WA null. Same call as the lead time.
- **"Perfect forecast" copy is stale vs L22.** Replay now has real NOAA GFS forecast frames; the slides (4, 6), demo notes and nasa-data.md still say "declared perfect forecast", and the app chip still reads "perfect forecast". Rewrite once the app shows the GFS label; nasa-data.md must then declare NOAA GFS as the only non-NASA input (L22).

- **X** — metric values (median lead time h, IoU, F1, flooded km², optical/cloud %, people in critical areas): filled by final `metrics.json` from the real pipeline.
- **A, B** — IQR bounds of lead time: lead-time pipeline (lead-analysis).
- **N** — number of mapped landslides in the lead-time sample: lead-time pipeline.
- **P** — zones warned before event / night-light drop %: metrics pipeline.
- **Official-warning comparison** — REMOVED from public copy: real deltas are negative (official forecast warnings preceded our observed-rain crossing: rs_2024 -31.2 h vs INMET aviso 2024-04-26T16:50Z; wa_2025 -71.8 h vs NWS watch 2025-12-06T00:10Z). Never claim earlier-than-official; the lead-time headline stays vs the damage anchor. Lucas decides whether the honest comparison is shown.
- **U5** — RADAR before/after swipe component (slide 4 visual, demo beat 3).
- **Copy approval** — Lucas reviews all of the above on the morning of 2026-11-15 (L18).
