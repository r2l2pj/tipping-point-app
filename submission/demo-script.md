# Tipping Point — demo video script (≤30 s)

> **DRAFT — pending approval.**

Voiceover total: **66 words** (limit 75). All on-screen text matches real UI labels. Beats are numbered onto the doc's 5-step demo flow (steps 1–5).

| Step | Time | On screen | Voiceover |
| --- | --- | --- | --- |
| Cold open | 0–4 s | News-style stills of the May 2024 Rio Grande do Sul floods; caption "May 2024 · Rio Grande do Sul, Brazil" | "May 2024, Rio Grande do Sul. The alert said where floods could happen — not where they did." |
| 1 | 4–8 s | Ops dashboard `/` opens already on the event (Replay cases → **RS · May 2024**). Cursor clicks **EVENT REPLAY · DEMO** and presses play on the timeline (**D-5 → EVENT**); the TPI heatmap turns red over the Taquari valley as the rain accumulates. | "Tipping Point replays it: extreme rain, saturated soil —" |
| 2 | 8–11 s | The alert card appears as areas cross the tipping point: **TIPPING POINT REACHED** banner + card "⚠ Tipping Point: CRITICAL landslide risk — 3-day rain above the 99th percentile. Soil saturated." | "the index turns critical days before." |
| 3 | 11–16 s | Click **"Confirm with NISAR radar →"**: case selector to **WA · Dec 2025**, RADAR tab. **NISAR GCOV — before / after** swipe (Dec 4 / Dec 16). **Flooded area (NISAR GCOV): 41.6 km²**; dark-blue confirmed flood polygons; purple landslide marks labeled **candidates**. | "Then NISAR radar confirms through the clouds: 41.6 square kilometers flooded." |
| 4 | 16–22 s | **"Acertamos?"** (VALIDATION tab): cards **IoU 0.71**, **F1 0.83**, **Median lead time 52 h**, **Zones warned before event 87%**; **Why radar — Cloud cover during the event: 94%.** SWOT river-level chart beside the cards. | "Did we get it right? IoU 0.71, 52-hour lead time, 87% warned early." |
| 5 | 22–27 s | **"Impacto"** (IMPACT tab): **People exposed 8,400**, **Lights-out area (Black Marble) 18%**, priority zones list. Brief glimpse of the `/alerts` public feed. | "8,400 people exposed, prioritized for Civil Defense." |
| Close | 27–30 s | Logo + tagline "TIPPING POINT \| Rain warns. Radar confirms." over dark map; credit line "Data: NASA GPM · SMAP · NASADEM · NISAR". | "Rain warns. Radar confirms." |

## Production notes

- **Forecast label.** Every forecast frame on the map carries the **FORECAST** label and forecast days show as hollow dashed dots on the timeline. The replay uses a declared **"perfect forecast"** — observed IMERG stands in for the D+1..D+3 forecast (`forecast_source=perfect-forecast`), labeled in the app and declared in the README. Keep any forecast shot visibly labeled.
- **RS-2024 has no radar confirmation.** The event predates NISAR, so the RS case's RADAR tab shows "Awaiting NISAR pair". The radar beat (step 3, 11–16 s) is on the WA Dec 2025 case only — do not imply NISAR data exists for RS.
- **Landslides are always "candidates".** Purple marks are landslide candidates (post-event HLS optical); the UI labels them candidates and never confirmed. Never say or caption anything stronger.
- **Illustrative data.** The app labels replay figures "Illustrative demo data." — keep that caption visible in at least one frame or mirror it in the end credits.
- Numbers on screen are the real demo metrics (WA: IoU 0.71, F1 0.83, 41.6 km², 52 h, 87%, 94% cloud, 8,400 people, 18% lights-out) — do not substitute other figures.
- Pace: ~2.2 words/second voiceover. If VO runs long, trim step 4 to "IoU 0.71, 52-hour lead, 87% warned early."
