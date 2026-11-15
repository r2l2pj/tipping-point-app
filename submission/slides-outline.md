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
- Ops dashboard `/`: **EVENT REPLAY · DEMO** button, timeline D-5 → EVENT, Play control
- **TIPPING POINT REACHED** banner + ranked priority zones (TPI ≥ 0.60)
- Side tabs ALERT / RADAR / Did we get it right? / IMPACT; "Confirm with NISAR radar →"
- Public feed `/alerts`: Civil-Defense-style alert cards
- Replay D+1..D+3 uses the real **NOAA GFS** forecast issued on each day, labelled "forecast · NOAA GFS (issued <date>)"; live mode uses NASA GEOS-FP
- *Visual:* 2–3 real screenshots — banner over the heated Taquari valley map, RADAR NISAR before/after swipe, /alerts card

## Slide 5 — Did it work?
- WA Dec 2025: "Optical satellites were 92.9% blind under the clouds. On the 7% they could see, our radar flood map overlaps at F1 0.15 (precision 0.19, recall 0.13, new flood only). Radar maps the rest." — 27.99 km² flooded within the NISAR swath; landslides remain candidates only
- Early warning headline: **"Tipping Point would have warned X hours earlier"** (X = median; quoted only after the rebuilt forecast numbers, with n)
- "With the forecast available at the time, the index marked the area as critical before the damage, adding a map of where and who to the official warnings."
  - supporting line (footnote): "In replay, using only data available at the time, the index crossed Critical a median of X h (IQR A-B h) before mapped landslides (n = N)" (in replay; median, IQR A-B h, n = N)
- RS replay (no radar — event predates NISAR, so no flood-overlap score): median X h (IQR A-B h, n = N)
- **Optical saw only 7% of the scene in WA (92.9% cloud) and 0% in RS (100% cloud) — that is why radar**
- *Visual:* Did we get it right? tab screenshot next to a small metrics table for both cases

## Slide 6 — Impact + honest limitations
- Impact numbers the demo reports: 229,782 people in critical areas + night-light drop 44% (WA, Dec 12, 2025); 1,488,833 + 33% (RS, May 2, 2024)
- Limitations: thresholds calibrated on a single event; IMERG/SMAP inputs ~10 km; NISAR revisits every 12 days
- Demo is a replay, not live ops; the replay forecast is NOAA GFS as issued at the time (our only non-NASA input) — perfect-forecast frames appear only as a labelled upper bound
- Landslides are **candidates only**, never confirmed — no GUNW pair spans the WA event
- *Visual:* IMPACT tab cards + a short "What we don't claim" callout box

## Slide 7 — Roadmap + credits
- Roadmap: auto-pipeline on each IMERG update → NISAR confirmation trigger per pass → threshold calibration on the landslide catalog → WhatsApp/e-mail alerts → OPERA water integration
- Global coverage at release — one config edit
- NASA inputs: GPM IMERG · SMAP L4 · NASADEM · NISAR GCOV · HLS · VIIRS Black Marble · GPW · GEOS-FP · OPERA DSWx
- One declared non-NASA input: NOAA GFS forecasts, replay D+1..D+3 only
- MERIT Hydro used as a validation reference only, not a NASA input
- Repo + live app links; built with AI assistants under human review
- *Visual:* mission-logo strip / data-source grid + QR code to the repo

*Note: cloud %, optical %, people and night-light figures come from the published `metrics.json` (tipping-point-data f450b72, = Neon copy of 2026-11-15). Slide 5 flood score is from the published `metrics.json` (tipping-point-data 864cf95, GitHub `fallback` branch) (Lucas's wording, 2026-11-15); "% warned" is dropped. Remaining X/A/B/N placeholders are the lead time only — quoted after the rebuilt forecast numbers, with n.*
