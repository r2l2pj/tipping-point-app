# Tipping Point — slides outline (7 slides)

> **DRAFT — pending approval.**

## Slide 1 — Title
- **Tipping Point** — *Rain warns. Radar sees through.*
- NASA Space Apps 2026 · Challenge: Dancing with the SARs
- One line: NISAR radar sees new flooding through cloud; we turn each pass into a priority list
- Team `[TEAM NAME]` · members `[names]` · Local Event `Florianópolis (Founder Haus, Jurerê)` (the guide requires the team name, the member names and the challenge on the slides)
- *Visual:* our wordmark + tagline over a dark map (no NASA logos or insignia anywhere in the deck: guide rule); the header's "TIPPING POINT | Rain warns. Radar sees through." wordmark

## Slide 2 — The problem
- May 2024, Rio Grande do Sul floods: 478 municipalities affected, 185 deaths, 581,638 people displaced at the peak
  - footnote: Government of Rio Grande do Sul, "SOS Rio Grande do Sul — Situação nos municípios", updated Aug 19, 2025
- Alerts cover whole municipalities — they say where it *could* happen, not where it *did*
- Optical satellites were blind: 100% cloud cover across 20 HLS scenes during the event
- *Visual:* dark map (our own screen; no third-party news photos unless licensed and credited) of the Taquari valley with the cloud-cover stat

## Slide 3 — The solution
- **Radar change first:** for each NISAR pass pair, new water = HH backscatter drop of more than 3 dB to below a per-scene threshold, on low ground near rivers, patches ≥ 3 ha → flood candidates through cloud, with the people inside them
- **Between passes, where to look next:** Tipping Point Index TPI = (R·S·T)^(1/3) from GPM IMERG rain, SMAP soil moisture and NASADEM terrain; Critical > 0.6 only when all three agree
- Builds on NASA's LHASA: LHASA v2 already uses XGBoost + IMERG + SMAP (doi:10.3389/feart.2021.640043) and LHASA-F forecasts ~3 days (doi:10.3389/feart.2022.878996); new here: no-look-ahead GFS replay, explicit horizons, held-out events with published misses, radar response on the same screen
- An experimental XGBoost trigger model sits beside the index (independent audit: about as good as a simple forecast-rain-vs-local-extreme rule)
- *Visual:* NISAR before/after swipe on the left; the TPI gauge small on the right

## Slide 4 — The demo
- Ops dashboard `/` (**Command Center**): top-bar **Now / Replay** switch + **Past event** selector, timeline D-10 → EVENT → D+n, Play control; map control **Forecast issued this day: Off / +1 d / +2 d / +3 d** replays each day's GFS run
- **Tipping point reached** (Situation overview) + ranked **Priority areas** (Critical and High)
- Right panel: **Now on the ground** (NISAR radar card: "Check with NISAR radar →", **Before / after**), **Who is affected**, **Prediction**, **Replay check**; **Show details: validation and impact** opens **How early? (in replay)** / **Why radar** / **Impact**
- Public feed `/alerts` (**Public Alerts** view): Civil-Defense-style alert cards ("Tipping Point: <level> <hazard> risk"), an **experimental research product, not official warnings** (official: Defesa Civil, SMS 40199)
- Forecast rain = **NOAA GFS 0.25°** in replay and live, labelled "forecast · NOAA GFS (issued <date>)"; replay D+1..D+3 uses the forecast issued on each day
- *Visual:* 2–3 real screenshots — **Tipping point reached** over the heated Taquari valley map (RS, Apr 30), NISAR radar **Before / after** swipe (WA), /alerts card

## Slide 5 — Did it work?
- **NISAR, Washington Dec 2025:** "Clouds hid 93% of the area from optical satellites; NISAR radar mapped 28 km² of flood candidates through them" — home to about 1,150 people. Sentinel-1 radar sees open flood through cloud too (our reference); NISAR's L-band also reaches water under vegetation
- **Radar physics checked:** candidates stable Nov 10 → Dec 4 (−9.7 dB), then −6.5 dB by Dec 16; double-bounce hypothesis supported — 45% of the missed flood is in towns or forest (vs 5% of what we caught), recall 25% open land vs 3% towns, 1% forest
- **Prediction, tied to NISAR:** the forecast tells Civil Defense where risk is rising; NISAR tells when radar will check it. Washington: the GFS run issued Dec 3, 2025 showed Critical landslide risk for Dec 6. Rio Grande do Sul: the forecast issued a day before the first deaths flagged only 4% of the case area as High risk, and that 4% held 36% of the 16,027 landslides that followed (8.8× better than chance); runs issued 51 and 75 h before: 0%; Washington's flooded places were not flagged ahead (upstream rain)
- **Official warnings came first** in both replays; the index adds where and who. RS flood index vs Copernicus EMS maps during the flood: F1 0.31 (Taquari valley)
- *Visual:* NISAR before/after swipe still + a 4-row metrics table

## Slide 6 — Impact + honest limitations
- Impact: WA about 1,150 people inside the NISAR flood candidates; 254,263 in index-critical areas and night-light drop 44% (Dec 12, 2025); RS 1,681,783 in index-critical areas + 33% (peak day May 3, 2024) — night lights indicative only (cloud/snow)
- Limitations: Thresholds are not yet calibrated for Brazil; validated on 2 replay events + 11 disaster events for the ML; IMERG/SMAP inputs ~10 km; NISAR revisits every 12 days; GFS under-forecast the RS peak by about half; official warnings still came before the index
- The video demo is a replay; the live view covers Southern Brazil every 3 h. The replay forecast is NOAA GFS as issued at the time (our only non-NASA input) — perfect-forecast frames appear only as a labelled upper bound
- Landslides are **candidates only**, never confirmed — no GUNW pair spans the WA event
- *Visual:* **Impact** block (under **Show details: validation and impact**) + a short "What we don't claim" callout box

## Slide 7 — Roadmap + credits
- Roadmap: refresh on each IMERG update (today every 3 h) → NISAR check per pass → threshold calibration on the landslide catalog → WhatsApp/e-mail alerts
- Future of NISAR: InSAR slow slope motion (flags some creeping slopes; fast shallow slides often give no warning) · ~200 m soil moisture · flooding under forest canopy · 12-day radar coverage of Brazil
- Other regions after local threshold calibration
- NASA inputs: GPM IMERG · SMAP L4 · NASADEM · NISAR (L-band radar) · HLS · VIIRS Black Marble · GPW · OPERA DSWx · OPERA DIST-ALERT · SWOT
- Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA
- MERIT Hydro used as a validation reference only, not a NASA input
- Repo + live app links; built with AI assistants under human review
- *Visual:* data-source grid as plain text (no mission or agency logos: the 2026 guide forbids NASA branding in team-made content) + QR code to the app/repo

*Note: cloud %, optical %, people and night-light figures come from the published `metrics.json` (tipping-point-data f450b72, = Neon copy of 2026-11-15). Slide 5 flood score is from the published `metrics.json` (tipping-point-data 864cf95, GitHub `fallback` branch) (Lucas's wording, 2026-11-15); "% warned" is dropped. RS forecast result from the published `metrics.json` (tipping-point-data b5c21df): `cases.rs_2024.slide_warned_gfs_24h_pct` 36.45 (Critical 1.87; run issued 2024-04-28), `_48h_pct` 0, `_72h_pct` 0, anchor onset 2024-04-29 03Z; WA `flood_warned_gfs_{24,48,72}h_pct` 0 / 0 / 0.14, onset 2025-12-08 08Z. The WA lead-time median is retired (L35).*
