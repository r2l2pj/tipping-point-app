# Tipping Point — demo video script (≤30 s)

> **DRAFT — pending approval.**

Voiceover total: **70 words** (limit 75). On-screen text uses the ruled English labels, which have landed in the UI at 8d65729 (see production notes). Verified against the UI at 8d65729. Beats are numbered onto the doc's 5-step demo flow (steps 1–5).

| Step | Time | On screen | Voiceover |
| --- | --- | --- | --- |
| Cold open | 0–4 s | News-style stills of the May 2024 Rio Grande do Sul floods; caption "May 2024 · Rio Grande do Sul, Brazil" | "May 2024, Rio Grande do Sul. The alert said where floods could happen — not where they did." |
| 1 | 4–8 s | Ops dashboard `/` opens already on the event (case selector → **Rio Grande do Sul flood, May 2024**). Cursor clicks **EVENT REPLAY · DEMO** and presses play on the timeline (**D-5 → EVENT**); the TPI heatmap turns red over the Taquari valley as the rain accumulates. | "Tipping Point replays it: extreme rain, saturated soil —" |
| 2 | 8–11 s | The alert card appears as areas cross the tipping point: **TIPPING POINT REACHED** banner with the **perfect forecast** chip; public feed card titled "⚠ Tipping Point: CRITICAL landslide risk". | "would have crossed Critical a median of X hours before the landslides." |
| 3 | 11–16 s | Select **Washington atmospheric rivers, Dec 2025** (opens on ALERT), then click **Confirm with NISAR radar →** (opens RADAR). **RADAR tab:** **NISAR GCOV — before / after**, Dec 4, 2025 → Dec 16, 2025 [swipe pending U5]. **Flooded area (NISAR): X km²**; dark-blue confirmed flood polygons; purple landslide candidates; card **Landslide scar candidates (HLS optical)**, note: candidates, never confirmed. | "Then NISAR radar confirms through the clouds: X square kilometers flooded." |
| 4 | 16–22 s | **Did we get it right?** tab: cards **IoU X**, **F1 X**, **Median lead time X h (IQR A-B h, n = N)**, **Zones warned before event P%**; **Why radar:** During the event the optical saw only X% of the scene. SWOT river-level chart below the cards. | "IoU X, median X hours early, P% warned first." |
| 5 | 22–27 s | **IMPACT** tab: **People in critical areas X**, **Night-light drop P%**, exposure basis GPW v4 / VIIRS Black Marble. Brief glimpse of the `/alerts` public feed. | "X people in critical areas, prioritized for Civil Defense." |
| Close | 27–30 s | Logo + tagline "TIPPING POINT \| Rain warns. Radar confirms." over dark map; credit line "Data: NASA GPM · SMAP · NASADEM · NISAR". | "Rain warns. Radar confirms." |

## Production notes

- **English labels landed at 8d65729.** SidePanel now labels the tab "Did we get it right?" and the forecast chip reads "perfect forecast" — no more Portuguese/English discrepancy. Still verify every on-screen string on the recorded build before shooting.
- **Forecast label.** Forecast frames carry a source label: on replay it reads "perfect forecast" (contract.ts `forecastSourceLabel` at 8d65729), on live "GEOS-FP". Replay uses a declared **perfect forecast** (observed IMERG as D+1..D+3, `forecast_source=perfect-forecast`), stated in the README. Keep any forecast shot visibly labeled.
- **RS-2024 has no radar confirmation.** The event predates NISAR. The RS case's RADAR tab shows "Awaiting a NISAR pair over the AOI." The radar beat (step 3, 11–16 s) is on the WA Dec 2025 case only — do not imply NISAR data exists for RS.
- **RS RADAR flooded-area gated at 8d65729.** The flooded-area number is now gated on a real NISAR pair (nisar_pre/post/passes), with an observed/optical-OPERA fallback via `metricsView.flood_source`. Verify on the recorded build before shooting that tab.
- **Landslides are always "candidates".** Purple marks are landslide candidates (post-event HLS optical). The RADAR tab card is **Landslide scar candidates (HLS optical)** with the note "candidates, never confirmed." Never say or caption anything stronger.
- **Illustrative data.** The app labels replay figures "Illustrative demo data." — keep that caption visible in at least one frame or mirror it in the end credits. Shown on mock-derived bundles only.
- ALL metric numbers are placeholders (X/A/B/N/P/D style) pending the real pipeline — every figure (IoU, F1, flooded km², median lead X h (IQR A-B h, n = N), P% warned, optical %, cloud %, people in critical areas, night-light drop %) is mock-derived, not a validated result. Documented event facts (446 of 497 municipalities, 185 dead, 581,000+ displaced, ~R$88.9 billion damage) are kept as citable disaster facts, not pipeline metrics — only demo-metric numbers are placeholders. Do not substitute other figures.
- **Headline lead-time sentence uses the spec template:** "In replay, using only data available at the time, the index crossed Critical a median of X h (IQR A-B h) before mapped landslides (n = N)". All placeholders (X, A, B, N, P) await the lead-time pipeline (lead-analysis, E7 metrics) plus Lucas's wording approval. Bare "X hours" phrasing is banned per the spec's honesty rules — median + IQR + n must travel together. VO may compress to median-only (a median of X hours); the on-screen card and any written claim always carry median + IQR + n together.
- Selecting a case resets the tab to ALERT.
- Pace: ~2.2 words/second voiceover. If VO runs long, trim step 4 to "IoU X, median X h early, P% warned first."
