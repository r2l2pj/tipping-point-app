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
| "Then NISAR radar confirms through the clouds: X square kilometers flooded." | demo-script.md: beat 3 VO | X (flooded km²; provisional 27.99 within NISAR swath) | awaiting Lucas |
| "IoU X, median X hours early, P% warned first." | demo-script.md: beat 4 VO | X, X, P | awaiting Lucas |
| "X people in critical areas, prioritized for Civil Defense." | demo-script.md: beat 5 VO | X | awaiting Lucas |
| "May 2024, Rio Grande do Sul: worst floods in state history — 446 of 497 municipalities hit / 185 dead, 581,000+ displaced, ~R$88.9 billion in damage" | slides-outline.md: slide 2 | none (documented facts) | awaiting Lucas |
| "Alerts cover whole municipalities — they say where it could happen, not where it did" | slides-outline.md: slide 2 | none | awaiting Lucas |
| "Optical satellites were blind: ~X% cloud cover during the event" | slides-outline.md: slide 2 | X | awaiting Lucas |
| "TPI = geometric mean of Rain · Soil · Terrain scores, each in [0,1]" + class bands | slides-outline.md: slide 3 | none | awaiting Lucas |
| "WA Dec 2025 replay vs NISAR GCOV reference: IoU X, F1 X over X km² confirmed flooded" | slides-outline.md: slide 5 | X, X, X | awaiting Lucas |
| "D h before the first official warning" | slides-outline.md: slide 5 | D (sourced timestamp pending) | awaiting Lucas |
| "RS replay ... IoU X, F1 X, median X h (IQR A-B h, n = N), P% warned" | slides-outline.md: slide 5 | X, X, X, A, B, N, P | awaiting Lucas |
| "Optical saw only X% of the scene in both events (X% cloud) — that is why radar" | slides-outline.md: slide 5 | X, X | awaiting Lucas |
| "X people in critical areas + night-light drop P% (WA); X + P% (RS)" | slides-outline.md: slide 6 | X, P, X, P | awaiting Lucas |
| Limitations + roadmap + NASA-inputs lines | slides-outline.md: slides 6–7 | none | awaiting Lucas |

## Open items

- **X** — metric values (median lead time h, IoU, F1, flooded km², optical/cloud %, people in critical areas): filled by final `metrics.json` from the real pipeline.
- **A, B** — IQR bounds of lead time: lead-time pipeline (lead-analysis).
- **N** — number of mapped landslides in the lead-time sample: lead-time pipeline.
- **P** — zones warned before event / night-light drop %: metrics pipeline.
- **D** — hours before the first official warning: needs a sourced official-warning timestamp.
- **U5** — RADAR before/after swipe component (slide 4 visual, demo beat 3).
- **Copy approval** — Lucas reviews all of the above on the morning of 2026-11-15 (L18).
