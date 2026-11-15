# Tipping Point — slides outline (7 slides)

> **DRAFT — pending approval.**

## Slide 1 — Title
- **Tipping Point** — *Rain warns. Radar confirms.*
- NASA Space Apps 2026 · Challenge: Dancing with the SARs
- One line: three NASA missions, three layers, one tipping point
- Team name + local event
- *Visual:* app logo + tagline over a dark map; the header's "TIPPING POINT | Rain warns. Radar confirms." wordmark

## Slide 2 — The problem
- May 2024, Rio Grande do Sul: worst floods in state history — 446 of 497 municipalities hit
- 185 dead, 581,000+ displaced, ~R$88.9 billion in damage
- Alerts cover whole municipalities — they say where it *could* happen, not where it *did*
- Optical satellites were blind: 100% cloud cover across 20 HLS scenes during the event
- *Visual:* RS-2024 flood photo or dark map of the Taquari valley with the cloud-cover stat

## Slide 3 — The solution
- TPI = geometric mean of Rain · Soil · Terrain scores, each in [0,1] — if any factor is zero, risk is zero
- Three missions, three layers: GPM IMERG (rain vs climatology), SMAP (soil saturation), NASADEM (slope + drainage height)
- Classes: Low <0.2 · Moderate · High · Critical >0.6 — Critical = the tipping point
- Same logic family as NASA's LHASA landslide model
- Alongside the index, a learned XGBoost model gives P(landslide trigger in 24/48/72 h); TPI stays the headline
- *Visual:* formula `TPI = (R·S·T)^(1/3)` with three icons (cloud/satellite, soil, terrain) feeding one gauge

## Slide 4 — The demo
- Ops dashboard `/` (**Command Center**): top-bar **Now / Replay** switch + **Past event** selector, timeline D-10 → EVENT → D+n, Play control
- **Tipping point reached** (Situation overview) + ranked **Priority areas** (TPI ≥ 0.60)
- Right panel: **Now on the ground** (NISAR radar card: "Confirm with NISAR radar →", **Before / after**), **Who is affected**, **Prediction**, **Replay check**; **Show details: validation and impact** opens **How early? (in replay)** / **Why radar** / **Impact**
- Public feed `/alerts` (**Public Alerts** view): Civil-Defense-style alert cards ("Tipping Point: <level> <hazard> risk")
- Forecast rain = **NOAA GFS 0.25°** in replay and live, labelled "forecast · NOAA GFS (issued <date>)"; replay D+1..D+3 uses the forecast issued on each day
- *Visual:* 2–3 real screenshots — **Tipping point reached** over the heated Taquari valley map (RS, Apr 30), NISAR **Before / after** GCOV swipe (WA), /alerts card

## Slide 5 — Did it work?
- WA Dec 2025: "Optical satellites were 92.9% blind under the clouds. On the 7% they could see, our radar flood map overlaps at F1 0.15 (precision 0.19, recall 0.13, new flood only). Radar maps the rest." — 27.99 km² flooded within the NISAR swath; landslides remain candidates only
- Early warning headline: **"Using the forecast available at the time, Tipping Point flagged the area 85 hours before the damage."** (decided by Lucas 2026-11-15: 85 h = WA median, n = 6 of 8 forecast days)
- "With the forecast available at the time, the index marked the area as critical before the damage, adding a map of where and who to the official warnings."
  - supporting line (footnote): "In replay with the NOAA GFS forecast issued each day (no look-ahead), Washington (Dec 2025) reached Critical a median of 85 h before the damage (IQR 55–115 h; 6 of 8 forecast days flagged it); in Rio Grande do Sul (May 2024), 1 of 4 forecast days flagged it, 111 h ahead."
- RS replay (no radar — event predates NISAR, so no flood-overlap score): 111 h ahead on the one forecast day (of 4) that flagged it — too few to call a median
- **Optical saw only 7% of the scene in WA (92.9% cloud) and 0% in RS (100% cloud) — that is why radar**
- *Visual:* **Replay check** panel (with **Show details: validation and impact** open) screenshot next to a small metrics table for both cases

## Slide 6 — Impact + honest limitations
- Impact numbers the demo reports: 229,782 people in critical areas + night-light drop 44% (WA, Dec 12, 2025); 1,488,833 + 33% (RS, May 2, 2024)
- Limitations: thresholds calibrated on a single event; IMERG/SMAP inputs ~10 km; NISAR revisits every 12 days; lead time counts the area as flagged when any pixel crosses Critical on a D+1..D+3 forecast frame (lenient); GFS under-forecast the RS peak by about half; official warnings still came before the index
- Demo is a replay, not live ops; the replay forecast is NOAA GFS as issued at the time (our only non-NASA input) — perfect-forecast frames appear only as a labelled upper bound
- Landslides are **candidates only**, never confirmed — no GUNW pair spans the WA event
- *Visual:* **Impact** block (under **Show details: validation and impact**) + a short "What we don't claim" callout box

## Slide 7 — Roadmap + credits
- Roadmap: auto-pipeline on each IMERG update → NISAR confirmation trigger per pass → threshold calibration on the landslide catalog → WhatsApp/e-mail alerts → OPERA water integration
- Global coverage at release — one config edit
- NASA inputs: GPM IMERG · SMAP L4 · NASADEM · NISAR GCOV · HLS · VIIRS Black Marble · GPW · OPERA DSWx
- Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA
- MERIT Hydro used as a validation reference only, not a NASA input
- Repo + live app links; built with AI assistants under human review
- *Visual:* mission-logo strip / data-source grid + QR code to the repo

*Note: cloud %, optical %, people and night-light figures come from the published `metrics.json` (tipping-point-data f450b72, = Neon copy of 2026-11-15). Slide 5 flood score is from the published `metrics.json` (tipping-point-data 864cf95, GitHub `fallback` branch) (Lucas's wording, 2026-11-15); "% warned" is dropped. Lead time from tipping-point-data 0dc5b58 (`forecast_lead_time`, rebuilt L28/L28b): WA median 85 h, IQR 55–115 h, 6 of 8 forecast days; RS 111 h on 1 of 4 forecast days (never a median).*
