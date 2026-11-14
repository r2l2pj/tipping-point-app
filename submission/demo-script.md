# Tipping Point — demo video script (≤30 s)

> **DRAFT — pending approval.**

Voiceover total: **68 words** (limit 75). On-screen text uses the ruled English labels; the UI at 7ee116a still shows the Portuguese strings (see production notes). Verified against the UI at 7ee116a. Beats are numbered onto the doc's 5-step demo flow (steps 1–5).

| Step | Time | On screen | Voiceover |
| --- | --- | --- | --- |
| Cold open | 0–4 s | News-style stills of the May 2024 Rio Grande do Sul floods; caption "May 2024 · Rio Grande do Sul, Brazil" | "May 2024, Rio Grande do Sul. The alert said where floods could happen — not where they did." |
| 1 | 4–8 s | Ops dashboard `/` opens already on the event (case selector → **Rio Grande do Sul flood, May 2024**). Cursor clicks **EVENT REPLAY · DEMO** and presses play on the timeline (**D-5 → EVENT**); the TPI heatmap turns red over the Taquari valley as the rain accumulates. | "Tipping Point replays it: extreme rain, saturated soil —" |
| 2 | 8–11 s | The alert card appears as areas cross the tipping point: **TIPPING POINT REACHED** banner with the **perfect forecast** chip; public feed card titled "⚠ Tipping Point: CRITICAL landslide risk". | "the index turns critical — it would have warned X hours earlier." |
| 3 | 11–16 s | Select **Washington atmospheric rivers, Dec 2025** (opens on ALERT), then click **Confirm with NISAR radar →** (opens RADAR). **RADAR tab:** **NISAR GCOV — before / after**, Dec 4, 2025 → Dec 16, 2025 [swipe pending U5]. **Flooded area (NISAR): 41.6 km²**; dark-blue confirmed flood polygons; purple landslide candidates; card **Landslide scar candidates (HLS optical)**, note: candidates, never confirmed. | "Then NISAR radar confirms through the clouds: 41.6 square kilometers flooded." |
| 4 | 16–22 s | **Did we get it right?** tab: cards **IoU 0.71**, **F1 0.83**, **Median lead time X h**, **Zones warned before event 87%**; **Why radar:** During the event the optical saw only 6% of the scene. SWOT river-level chart below the cards. | "IoU 0.71, X-hour lead time, 87% warned early." |
| 5 | 22–27 s | **IMPACT** tab: **People in critical areas 8,400**, **Night-light drop 18%**, exposure basis GPW v4 / VIIRS Black Marble. Brief glimpse of the `/alerts` public feed. | "8,400 people in critical areas, prioritized for Civil Defense." |
| Close | 27–30 s | Logo + tagline "TIPPING POINT \| Rain warns. Radar confirms." over dark map; credit line "Data: NASA GPM · SMAP · NASADEM · NISAR". | "Rain warns. Radar confirms." |

## Production notes

- **UI still Portuguese at 7ee116a.** The UI still shows the Portuguese strings: tab "Acertamos?", forecast chip "previsão perfeita", fallback "previsão". This copy uses the ruled English labels ("Did we get it right?", "perfect forecast"). The English-label change is routed to lead-front and lead-integration. Until it lands, the recorded UI will show the Portuguese strings; re-check every on-screen label before recording.
- **Forecast label.** Forecast frames carry a source label: on replay it reads "perfect forecast" (UI string "previsão perfeita" at 7ee116a), on live "GEOS-FP". Replay uses a declared **perfect forecast** (observed IMERG as D+1..D+3, `forecast_source=perfect-forecast`), stated in the README. Keep any forecast shot visibly labeled.
- **RS-2024 has no radar confirmation.** The event predates NISAR. The RS case's RADAR tab shows "Awaiting a NISAR pair over the AOI." The radar beat (step 3, 11–16 s) is on the WA Dec 2025 case only — do not imply NISAR data exists for RS.
- **OPEN DEFECT:** the RS RADAR tab also shows **Flooded area (NISAR) 118.3 km2**, not gated on a NISAR pair. Do not record the RS RADAR tab until it is fixed.
- **Landslides are always "candidates".** Purple marks are landslide candidates (post-event HLS optical). The RADAR tab card is **Landslide scar candidates (HLS optical)** with the note "candidates, never confirmed." Never say or caption anything stronger.
- **Illustrative data.** The app labels replay figures "Illustrative demo data." — keep that caption visible in at least one frame or mirror it in the end credits. Shown on mock-derived bundles only.
- Numbers on screen are the real demo metrics (WA: IoU 0.71, F1 0.83, 41.6 km2, X h median lead, 87% warned, optical saw 6% (94% cloud), 8,400 people in critical areas, night-light drop 18%) — do not substitute other figures.
- **"Would have warned X hours earlier" is a public claim: awaiting Lucas's approval of the wording before recording (E7 ruling).**
- Selecting a case resets the tab to ALERT.
- Pace: ~2.2 words/second voiceover. If VO runs long, trim step 4 to "IoU 0.71, X-hour lead, 87% warned early."
