# Tipping Point — slides outline (7 slides)

> **DRAFT — pending approval.**

## Slide 1 — Title
- **Tipping Point** — *Rain warns. Radar confirms.*
- NASA Space Apps 2026 · Challenge: Dancing with the SARs
- One line: three NASA missions, three layers, one tipping point
- Team `[TEAM NAME]` · members `[names]` · Local Event `[EVENT]` (the guide requires the team name, the member names and the challenge on the slides)
- *Visual:* our wordmark + tagline over a dark map (no NASA logos or insignia anywhere in the deck: guide rule); the header's "TIPPING POINT | Rain warns. Radar confirms." wordmark

## Slide 2 — The problem
- May 2024, Rio Grande do Sul floods: 478 municipalities affected, 185 deaths, 581,638 people displaced at the peak
  - footnote: Government of Rio Grande do Sul, "SOS Rio Grande do Sul — Situação nos municípios", updated Aug 19, 2025
- Alerts cover whole municipalities — they say where it *could* happen, not where it *did*
- Optical satellites were blind: 100% cloud cover across 20 HLS scenes during the event
- *Visual:* dark map (our own screen; no third-party news photos unless licensed and credited) of the Taquari valley with the cloud-cover stat

## Slide 3 — The solution
- TPI = geometric mean of Rain · Soil · Terrain scores, each in [0,1] — if any factor is zero, risk is zero
- Three missions, three layers: GPM IMERG (rain vs climatology), SMAP (soil saturation), NASADEM (slope + drainage height)
- Classes: Low <0.2 · Moderate · High · Critical >0.6 — Critical = the tipping point
- Same logic family as NASA's LHASA landslide model
- Alongside the index, an XGBoost model ranks the relative likelihood of a rain-triggered landslide within 24 h (up to 14 days, low skill past 72 h); on held-out events it never saw ([v2 TEST events — pending re-score, L33]), driven by the NOAA GFS forecast, it reached PR-AUC [X] vs [Y] for the TPI > 0.6 rule (base rate [B]) [numbers pending v2 re-score, ~12:00] — TPI stays the headline
- *Visual:* formula `TPI = (R·S·T)^(1/3)` with three icons (cloud/satellite, soil, terrain) feeding one gauge

## Slide 4 — The demo
- Ops dashboard `/` (**Command Center**): top-bar **Now / Replay** switch + **Past event** selector, timeline D-10 → EVENT → D+n, Play control; map control **Forecast issued this day: Off / +1 d / +2 d / +3 d** replays each day's GFS run
- **Tipping point reached** (Situation overview) + ranked **Priority areas** (Critical and High)
- Right panel: **Now on the ground** (NISAR radar card: "Check with NISAR radar →", **Before / after**), **Who is affected**, **Prediction**, **Replay check**; **Show details: validation and impact** opens **How early? (in replay)** / **Why radar** / **Impact**
- Public feed `/alerts` (**Public Alerts** view): Civil-Defense-style alert cards ("Tipping Point: <level> <hazard> risk"), an **experimental research product, not official warnings** (official: Defesa Civil, SMS 40199)
- Forecast rain = **NOAA GFS 0.25°** in replay and live, labelled "forecast · NOAA GFS (issued <date>)"; replay D+1..D+3 uses the forecast issued on each day
- *Visual:* 2–3 real screenshots — **Tipping point reached** over the heated Taquari valley map (RS, Apr 30), NISAR **Before / after** GCOV swipe (WA), /alerts card

## Slide 5 — Did it work?
- WA Dec 2025: "Clouds hid 93% of the area from optical satellites; NISAR radar mapped 28 km² of flood candidates through them." — 27.99 km² flooded within the NISAR swath; landslides remain candidates only
- Headline (L36): **"Using the forecast available at the time, [X]% of the 16,027 landslides mapped in Rio Grande do Sul were already in High or Critical areas [H] h before [ONSET]."**
  - footnote (required): "Single forecast runs vary: [per-run values — ON HOLD, L37]. n = 16,027 UFRGS/Cemaden inventory points; anchor = documented onset [ONSET]."
- WA flood, honestly: 0.14% of the NISAR-flooded area was High (none Critical) in the forecasts issued 24–48 h before — the index uses local rain only; rivers flood from rain upstream
- Official warnings came before the index in both replays: the index adds where and who, not an earlier warning
- **Optical saw only 7% of the scene in WA (92.9% cloud) and 0% in RS (100% cloud) — that is why radar**
- *Visual:* **Replay check** panel (with **Show details: validation and impact** open) screenshot next to a small metrics table for both cases

## Slide 6 — Impact + honest limitations
- Impact numbers the demo reports: 229,782 people in critical areas + night-light drop 44% (WA, Dec 12, 2025); 1,488,833 + 33% (RS, peak day May 3, 2024)
- Limitations: thresholds not yet validated across many events; IMERG/SMAP inputs ~10 km; NISAR revisits every 12 days; GFS under-forecast the RS peak by about half; official warnings still came before the index
- The video demo is a replay; the live view covers Southern Brazil every 3 h. The replay forecast is NOAA GFS as issued at the time (our only non-NASA input) — perfect-forecast frames appear only as a labelled upper bound
- Landslides are **candidates only**, never confirmed — no GUNW pair spans the WA event
- *Visual:* **Impact** block (under **Show details: validation and impact**) + a short "What we don't claim" callout box

## Slide 7 — Roadmap + credits
- Roadmap: refresh on each IMERG update (today every 3 h) → NISAR confirmation trigger per pass → threshold calibration on the landslide catalog → WhatsApp/e-mail alerts
- Global coverage at release — one config edit
- NASA inputs: GPM IMERG · SMAP L4 · NASADEM · NISAR GCOV · HLS · VIIRS Black Marble · GPW · OPERA DSWx · OPERA DIST-ALERT · SWOT
- Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA
- MERIT Hydro used as a validation reference only, not a NASA input
- Repo + live app links; built with AI assistants under human review
- *Visual:* data-source grid as plain text (no mission or agency logos: the 2026 guide forbids NASA branding in team-made content) + QR code to the app/repo

*Note: cloud %, optical %, people and night-light figures come from the published `metrics.json` (tipping-point-data f450b72, = Neon copy of 2026-11-15). Slide 5 flood score is from the published `metrics.json` (tipping-point-data 864cf95, GitHub `fallback` branch) (Lucas's wording, 2026-11-15); "% warned" is dropped. RS headline numbers ON HOLD (L37): recomputed by lead-analysis from the documented onset (the May 1 anchor was likely after onset). The WA lead-time median is retired (L35/L36).*
