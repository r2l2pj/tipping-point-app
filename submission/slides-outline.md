# Tipping Point — slides outline (7 slides)

> **DRAFT — pending approval.**

## Slide 1 — Title
- **Tipping Point** — *Rain warns. Radar sees through.*
- NASA Space Apps 2026 · Challenge: Dancing with the SARs
- One line: NISAR radar sees new flooding through cloud; we turn each pass into a priority list
- Team `[TEAM NAME]` · members `[names]` · Local Event `Florianópolis (Founder Haus, Jurerê)` (the guide requires the team name, the member names and the challenge on the slides)
- *Visual:* our wordmark + tagline over a dark map (no NASA logos or insignia anywhere in the deck: guide rule); the header's "TIPPING POINT | Rain warns. Radar sees through." wordmark

## Slide 2 — The problem (main case: Uruguay River, Uruguaiana and Itaqui)
- The Uruguay River floods our home state's western border towns again and again: red alerts for Itaqui and Uruguaiana on Jul 26–29, 2026 (Defesa Civil RS) and new floods in October 2026: the Uruguaiana gauge (ANA) stayed above its 8.50 m flood stage Oct 5–21, crest 10.02 m on Oct 16, and again Oct 29–31; 29 people displaced in Itaqui on Oct 8 (press)
- Clouds hide the river from optical satellites during the flood; alerts cover whole municipalities, not which streets are under water
- Context: May 2024, Rio Grande do Sul floods — 478 municipalities affected, 185 deaths, 581,638 people displaced at the peak (Government of Rio Grande do Sul, SOS Rio Grande do Sul, updated Aug 19, 2025)
- *Visual:* the Uruguaiana NISAR map from the app ([TBD] screenshot once the series is published)

## Slide 3 — Prevent the disaster, not the flood: when · where · who (Uruguaiana, Oct 2026)
- **When:** our index, fed by NASA satellite rain (GPM IMERG), turned the Uruguay River corridor Critical on Sep 30, five days before Uruguaiana reached flood stage (Oct 5); NOAA's forecast the day before already showed High. Caveat: the near-real-time rain runs wetter than the final product, so this may be optimistic
- **Where:** it flagged the low-lying river corridor, which holds 54% of the about 1.8 km² a teammate's NISAR change map (Sep 30 → Oct 12; 7 polygons, small sample) shows newly flooded, in 36% of the land (1.5× chance); our stricter automatic check did not reproduce that map
- **Who:** about 20,900 people live in that corridor (about 29 inside the teammate's flood polygons)
- **Also tested (post-event):** upstream-basin rain was above its 99th percentile on Sep 30; the upstream term is not yet live (on Washington it added 32% more false Critical area); an experimental upstream-aware model adds lead time, not location (it flags 82–88% of the area). No claim of being earlier than official warnings
- **Then radar:** NISAR sees the river through cloud; our automatic check (HH drop > 3 dB below a per-scene threshold, low ground near rivers, ≥ 3 ha) found darkening along the corridor (1.76 km²) but rejected every Uruguaiana pair at its threshold clamp, so no automatic flood map yet
- How: Tipping Point Index of NASA rain (IMERG), soil (SMAP) and terrain (NASADEM); builds on NASA's LHASA (doi:10.3389/feart.2021.640043; LHASA-F doi:10.3389/feart.2022.878996); an experimental XGBoost trigger model sits beside it

## Slide 4 — The demo
- **Uruguaiana, Oct–Nov 2026:** NISAR pass pair Oct 24 → Nov 5, 2026 (HH + HV) over the Uruguay River — flood candidates [TBD] km², about [TBD] people inside; Itaqui is outside the swath
- Ops dashboard `/` (**Command Center**): top-bar **Now / Replay** switch + **Past event** selector, timeline D-10 → EVENT → D+n, Play control; map control **Forecast issued this day: Off / +1 d / +2 d / +3 d** replays each day's GFS run
- **Tipping point reached** (Situation overview) + ranked **Priority areas** (Critical and High)
- Right panel: **Now on the ground** (NISAR radar card: "Check with NISAR radar →", **Before / after**), **Who is affected**, **Prediction**, **Replay check**; **Show details: validation and impact** opens **How early? (in replay)** / **Why radar** / **Impact**
- Public feed `/alerts` (**Public Alerts** view): Civil-Defense-style alert cards ("Tipping Point: <level> <hazard> risk"), an **experimental research product, not official warnings** (official: Defesa Civil, SMS 40199)
- Forecast rain = **NOAA GFS 0.25°** in replay and live, labelled "forecast · NOAA GFS (issued <date>)"; replay D+1..D+3 uses the forecast issued on each day
- *Visual:* 2–3 real screenshots — **Tipping point reached** over the heated Taquari valley map (RS, Apr 30), NISAR radar **Before / after** swipe (WA), /alerts card

## Slide 5 — Did it work?
- **NISAR, Washington Dec 2025:** "Clouds hid 93% of the area from optical satellites; NISAR radar mapped 28 km² of flood candidates through them" — home to about 950 people. C-band radar (NASA OPERA surface water, our reference) sees open flood through cloud too; NISAR's L-band also reaches water under vegetation
- **Radar physics checked:** candidates stable Nov 10 → Dec 4 (−9.7 dB), then −6.5 dB by Dec 16; double-bounce hypothesis supported — 45% of the missed flood is in towns or forest (vs 5% of what we caught), recall 25% open land vs 3% towns, 1% forest
- **Prediction, tied to NISAR:** the forecast shows where risk is rising; NISAR shows when radar will check it. Washington: the GFS run issued Dec 3, 2025 showed Critical landslide risk for Dec 6. Rio Grande do Sul: scored consistently, 5.8% of the 16,027 landslides were already High or Critical in the forecast issued 27 h before the first deaths, while it flagged only 2.1% of the area (2.7× better than chance); runs issued 51 and 75 h before: 0%; Washington's flooded places were not flagged ahead (upstream rain)
- **Official warnings came first** in both replays; the index adds where and who. RS flood index vs independent EU emergency maps during the flood: F1 0.33 (Taquari valley)
- *Visual:* NISAR before/after swipe still + a 4-row metrics table

## Slide 6 — Impact + honest limitations
- Impact: WA about 950 people inside the NISAR flood candidates; 225,583 in index-critical areas and night-light drop 44% (Dec 12, 2025); RS 1,627,862 in index-critical areas + 33% (peak day May 3, 2024) — night lights indicative only (cloud/snow)
- Limitations: Thresholds are not yet calibrated for Brazil; validated on 2 replay events + 11 disaster events for the ML; IMERG/SMAP inputs ~10 km; NISAR revisits every 12 days; GFS under-forecast the RS peak by about half; official warnings still came before the index
- The video demo is a replay; the live view covers Southern Brazil every 3 h. The replay forecast is NOAA GFS as issued at the time (our only non-NASA input) — perfect-forecast frames appear only as a labelled upper bound
- Landslides are **candidates only**, never confirmed — no GUNW pair spans the WA event
- *Visual:* **Impact** block (under **Show details: validation and impact**) + a short "What we don't claim" callout box

## Slide 7 — Roadmap + credits
- Roadmap: refresh on each IMERG update (today every 3 h) → NISAR check per pass → threshold calibration on the landslide catalog
- Future of NISAR: InSAR slow slope motion (flags some creeping slopes; fast shallow slides often give no warning) · ~200 m soil moisture · flooding under forest canopy · 12-day radar coverage of Brazil
- Other regions after local threshold calibration
- NASA inputs: GPM IMERG · SMAP L4 · NASADEM · NISAR (L-band radar) · HLS · VIIRS Black Marble · GPW · OPERA DSWx · OPERA DIST-ALERT · SWOT
- Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation is NASA
- MERIT Hydro used as a validation reference only, not a NASA input
- Repo + live app links; built with AI assistants under human review
- *Visual:* data-source grid as plain text (no mission or agency logos: the 2026 guide forbids NASA branding in team-made content) + QR code to the app/repo

*Note: cloud %, optical %, people and night-light figures come from the published `metrics.json` (tipping-point-data f450b72, = Neon copy of 2026-11-15). Slide 5 flood score is from the published `metrics.json` (tipping-point-data 864cf95, GitHub `fallback` branch) (Lucas's wording, 2026-11-15); "% warned" is dropped. RS forecast result from the published `metrics.json` (tipping-point-data b5c21df): `cases.rs_2024.slide_warned_gfs_24h_pct` 36.45 (Critical 1.87; run issued 2024-04-28), `_48h_pct` 0, `_72h_pct` 0, anchor onset 2024-04-29 03Z; WA `flood_warned_gfs_{24,48,72}h_pct` 0 / 0 / 0.14, onset 2025-12-08 08Z. The WA lead-time median is retired (L35).*
