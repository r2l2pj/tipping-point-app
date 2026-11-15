# Tipping Point — slides outline (7 slides)

> **DRAFT — pending approval.**

## Slide 1 — Title
- **Tipping Point** — *Rain warns. Radar sees through.*
- NASA Space Apps 2026 · Challenge: Dancing with the SARs
- One line: three NASA missions, three layers, one tipping point
- Team `[TEAM NAME]` · members `[names]` · Local Event `Florianópolis (Founder Haus, Jurerê)` (the guide requires the team name, the member names and the challenge on the slides)
- *Visual:* our wordmark + tagline over a dark map (no NASA logos or insignia anywhere in the deck: guide rule); the header's "TIPPING POINT | Rain warns. Radar sees through." wordmark

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
- Builds on NASA's LHASA: LHASA v2 already uses XGBoost + IMERG + SMAP (doi:10.3389/feart.2021.640043) and LHASA-F forecasts ~3 days (doi:10.3389/feart.2022.878996); new here: no-look-ahead GFS replay, 24 h/48 h/72 h/7 d horizons, held-out events with onset-anchored lead time and published misses, index + radar response on one screen
- Alongside the index, an XGBoost model ranks the relative likelihood of a rain-triggered landslide within 24 h (up to 14 days, low skill past 72 h), driven by the NOAA GFS forecast; experimental: median per-event ROC 0.93 across 9 held-out disasters, but an independent audit found it about as good as a simple forecast-rain-vs-local-extreme rule (~4–5 alarm-days per site per year) — TPI stays the headline
- *Visual:* formula `TPI = (R·S·T)^(1/3)` with three icons (cloud/satellite, soil, terrain) feeding one gauge

## Slide 4 — The demo
- Ops dashboard `/` (**Command Center**): top-bar **Now / Replay** switch + **Past event** selector, timeline D-10 → EVENT → D+n, Play control; map control **Forecast issued this day: Off / +1 d / +2 d / +3 d** replays each day's GFS run
- **Tipping point reached** (Situation overview) + ranked **Priority areas** (Critical and High)
- Right panel: **Now on the ground** (NISAR radar card: "Check with NISAR radar →", **Before / after**), **Who is affected**, **Prediction**, **Replay check**; **Show details: validation and impact** opens **How early? (in replay)** / **Why radar** / **Impact**
- Public feed `/alerts` (**Public Alerts** view): Civil-Defense-style alert cards ("Tipping Point: <level> <hazard> risk"), an **experimental research product, not official warnings** (official: Defesa Civil, SMS 40199)
- Forecast rain = **NOAA GFS 0.25°** in replay and live, labelled "forecast · NOAA GFS (issued <date>)"; replay D+1..D+3 uses the forecast issued on each day
- *Visual:* 2–3 real screenshots — **Tipping point reached** over the heated Taquari valley map (RS, Apr 30), NISAR radar **Before / after** swipe (WA), /alerts card

## Slide 5 — Did it work?
- Headline (decided by conductor (delegated), L38): **"Clouds hid 93% of the area from optical satellites; NISAR radar mapped 28 km² of flood candidates through them."** — WA Dec 2025, 27.99 km² within the NISAR swath; landslides remain candidates only
- Who is affected: 229,782 people in critical areas (WA, Dec 12, 2025), ranked by priority area for Civil Defense; live view every 3 h over Southern Brazil
- Prediction (supporting): "Using only the forecast available at the time, 36% of the 16,027 mapped landslides were already in High or Critical areas 27 hours before the first deaths (Critical: 2%)."
  - footnote (required): "Earlier runs (issued 51 and 75 hours before) showed 0%. Onset = first deaths, Apr 29, 2024 00:00 BRT. Anchor-sensitive: with onset Apr 30 the 24 h run shows 0%; the earlier May 1 anchor gave 88%. n = 16,027 UFRGS/Cemaden inventory points."
- WA flood, honestly: none of the NISAR-flooded area was High in the forecasts issued 24 h or 48 h before onset (Dec 8, 2025); 0.14% in the run issued 72 h before — the index uses local rain only; rivers flood from rain upstream
- Official warnings came before the index in both replays: the index adds where and who, not an earlier warning
- Hypothesis (testable): radar misses flooded towns and forests because water + walls/trunks bounce the pulse back (double bounce) and HH brightens instead of darkening; test = HH vs HV over the missed cells (result pending)
- **Optical saw only 7% of the scene in WA (92.9% cloud) and 0% in RS (100% cloud) — that is why radar**
- *Visual:* NISAR **Before / after** swipe still + **Replay check** panel (with **Show details: validation and impact** open) next to a small metrics table for both cases

## Slide 6 — Impact + honest limitations
- Impact numbers the demo reports: 229,782 people in critical areas + night-light drop 44% (WA, Dec 12, 2025); 1,488,833 + 33% (RS, peak day May 3, 2024)
- Limitations: Thresholds are not yet calibrated for Brazil; validated on 2 replay events + 11 disaster events for the ML; IMERG/SMAP inputs ~10 km; NISAR revisits every 12 days; GFS under-forecast the RS peak by about half; official warnings still came before the index
- The video demo is a replay; the live view covers Southern Brazil every 3 h. The replay forecast is NOAA GFS as issued at the time (our only non-NASA input) — perfect-forecast frames appear only as a labelled upper bound
- Landslides are **candidates only**, never confirmed — no GUNW pair spans the WA event
- *Visual:* **Impact** block (under **Show details: validation and impact**) + a short "What we don't claim" callout box

## Slide 7 — Roadmap + credits
- Roadmap: refresh on each IMERG update (today every 3 h) → NISAR confirmation trigger per pass → threshold calibration on the landslide catalog → WhatsApp/e-mail alerts
- Future of NISAR: InSAR ground motion before slope failure · ~200 m soil moisture · flooding under forest canopy · 12-day radar coverage of Brazil
- Global coverage at release — one config edit
- NASA inputs: GPM IMERG · SMAP L4 · NASADEM · NISAR (L-band radar) · HLS · VIIRS Black Marble · GPW · OPERA DSWx · OPERA DIST-ALERT · SWOT
- Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA
- MERIT Hydro used as a validation reference only, not a NASA input
- Repo + live app links; built with AI assistants under human review
- *Visual:* data-source grid as plain text (no mission or agency logos: the 2026 guide forbids NASA branding in team-made content) + QR code to the app/repo

*Note: cloud %, optical %, people and night-light figures come from the published `metrics.json` (tipping-point-data f450b72, = Neon copy of 2026-11-15). Slide 5 flood score is from the published `metrics.json` (tipping-point-data 864cf95, GitHub `fallback` branch) (Lucas's wording, 2026-11-15); "% warned" is dropped. RS forecast result from the published `metrics.json` (tipping-point-data b5c21df): `cases.rs_2024.slide_warned_gfs_24h_pct` 36.45 (Critical 1.87; run issued 2024-04-28), `_48h_pct` 0, `_72h_pct` 0, anchor onset 2024-04-29 03Z; WA `flood_warned_gfs_{24,48,72}h_pct` 0 / 0 / 0.14, onset 2025-12-08 08Z. The WA lead-time median is retired (L35).*
