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
- Optical satellites were blind: ~97% cloud cover during the event
- *Visual:* RS-2024 flood photo or dark map of the Taquari valley with the cloud-cover stat

## Slide 3 — The solution
- TPI = geometric mean of Rain · Soil · Terrain scores, each in [0,1] — if any factor is zero, risk is zero
- Three missions, three layers: GPM IMERG (rain vs climatology), SMAP (soil saturation), NASADEM (slope + drainage height)
- Classes: Low <0.2 · Moderate · High · Critical >0.6 — Critical = the tipping point
- Same logic family as NASA's LHASA landslide model
- *Visual:* formula `TPI = (R·S·T)^(1/3)` with three icons (cloud/satellite, soil, terrain) feeding one gauge

## Slide 4 — The demo
- Ops dashboard `/`: **EVENT REPLAY · DEMO** button, timeline D-5 → EVENT, Play control
- **TIPPING POINT REACHED** banner + ranked priority zones (TPI ≥ 0.60)
- Side tabs ALERT / RADAR / VALIDATION / IMPACT; "Confirm with NISAR radar →"
- Public feed `/alerts`: Civil-Defense-style alert cards
- Replay runs on a declared **perfect forecast** (observed IMERG as D+1..D+3), labeled FORECAST on every frame
- *Visual:* 2–3 real screenshots — banner over the heated Taquari valley map, RADAR before/after swipe, /alerts card

## Slide 5 — Did it work?
- WA Dec 2025 replay vs NISAR GCOV reference: **IoU 0.71, F1 0.83** over **41.6 km²** confirmed flooded
- Early warning: **X h median lead time (placeholder — real figure lands with validation), 87% of zones warned before the event**
- RS replay (no radar — event predates NISAR): IoU 0.64, F1 0.78, X h lead (placeholder), 81% warned
- **94–97% cloud cover** during both events — that's why radar
- *Visual:* VALIDATION tab screenshot next to a small metrics table for both cases

## Slide 6 — Impact + honest limitations
- Impact numbers the demo reports: 8,400 people exposed + 18% lights-out (WA); 41,200 exposed + 31% lights-out (RS)
- Limitations: thresholds calibrated on a single event; IMERG/SMAP inputs ~10 km; NISAR revisits every 12 days
- Demo is a replay, not live ops; forecast in replay is a declared "perfect forecast"
- Landslides are **candidates only**, never confirmed — no GUNW pair spans the WA event
- *Visual:* IMPACT tab cards + a short "What we don't claim" callout box

## Slide 7 — Roadmap + credits
- Roadmap: auto-pipeline on each IMERG update → NISAR confirmation trigger per pass → threshold calibration on the landslide catalog → WhatsApp/e-mail alerts → OPERA water integration
- NASA inputs only: GPM IMERG · SMAP L4 · NASADEM · NISAR GCOV · HLS · MODIS · VIIRS Black Marble · GPW · GEOS-FP · OPERA DSWx
- MERIT Hydro used as a validation reference only, not a NASA input
- Repo + live app links; built with AI assistants under human review
- *Visual:* mission-logo strip / data-source grid + QR code to the repo
