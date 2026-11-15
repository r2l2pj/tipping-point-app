# Tipping Point: project page text (primary artifact)

> **DRAFT — pending approval.** The 2026 guide says "the majority of judges' evaluation will be based on your project submission" (the project page), so this file is the full text. Paste each section into the form field named in its heading.
>
> Every number is traced to the published `metrics.json` (tipping-point-data `origin/main` d04ecab). The headline is the NISAR response line (decided by conductor (delegated), L38); the RS forecast result is reported only in the validation table, with its anchor sensitivity; the WA lead-time median is retired (L35), and the ML skill numbers are pending re-score (L33). `[…]` marks a gap; nothing in brackets ships.
>
> NISAR is the spine of the copy, by request of the conductor (win-odds #3).

---

## High-Level Project Summary (form field 2, ≤200 words)

The Uruguay River will still flood; what can be prevented is the disaster. Tipping Point aims to give responders when, where and who. At Uruguaiana, on the Argentine border, the river reached flood stage on Oct 5, 2026. Our index, fed by NASA satellite rain (GPM IMERG), turned the Uruguaiana region Critical on Sep 30, five days before flood stage; NOAA's forecast from Sep 27 already pointed there, 8 days ahead (when). It is near-real-time rain, and it holds when scaled to the final product; it also raised three smaller false alarms (Sep 20–22). It found the right days, not yet the right streets: NISAR then saw the water through cloud (where), and about 98,000 people live on the low floodplain (who). 54% of the NISAR flood candidates (a teammate's polygons) lie on that floodplain, which is 28% of the land in this case area; our stricter automatic check has not reproduced them yet. In Washington State (December 2025), clouds hid 93% of the area from optical satellites and a NISAR pass pair mapped 27.99 km² of flood candidates. We also tested why radar misses flooded towns and forests (double bounce; supported).

## Detailed Project Description (form field 5)

### What it does
Tipping Point is one operations screen for anyone responding to floods and landslides (a municipal Civil Defense office is one example user). It answers three questions in order:
1. Where is the ground about to fail?
2. Where has radar seen new water (candidates)?
3. Who is affected?

- **Live** (`/`): refreshes every 3 hours over Southern Brazil. It shows today's risk plus three forecast days, OPERA flood candidates, the NISAR pass status (flood candidates only when a comparable pass pair exists; none so far over Southern Brazil), and a ranked list of priority areas with the people exposed.
- **Public Alerts** (`/alerts`): area alerts in plain language. They are an **experimental research product, not official warnings**; official alerts in Brazil come from Defesa Civil (SMS 40199).
- **Replay:** two past disasters, day by day, with no look-ahead. Each day uses only the data and the forecast available that day.

### How it works
- **Tipping Point Index (TPI).** A weighted geometric mean of three scores in [0, 1]:
  - Rain: GPM IMERG 3-day accumulation against each pixel's own P90/P95/P99 climatology.
  - Soil: SMAP L4 root-zone wetness.
  - Terrain: NASADEM slope for landslides; a height-above-drainage proxy for floods.

  A geometric mean only reaches Critical (> 0.6) when all three agree.
- **Forecast.** The next three days extend observed rain with the NOAA GFS 0.25° forecast. This is our only non-NASA input, and every map label says so. In replay we use the run actually issued that day: in Washington, the NOAA GFS run issued Dec 3, 2025 already put slopes at Critical landslide risk for Dec 6, three days before the storm's damage began (Dec 9).
- **Radar response.** For each pair of NISAR radar passes (before and after), we:
  - detect new open water from the HH backscatter change between the passes: a drop of more than 3 dB to below a per-scene threshold (Otsu on bimodal tiles; a fixed −15 dB fallback for these BETA data);
  - keep only low ground near rivers (height above drainage < 15 m);
  - remove permanent water;
  - keep patches ≥ 3 ha.

  NASA OPERA surface water (DSWx-S1) adds C-band radar water candidates. OPERA DIST-ALERT-HLS adds landslide **scar candidates** from vegetation loss once the cloud clears.
- **Impact.** GPW v4.11 population count (2020) inside the NISAR flood candidates and inside the index's critical areas, and VIIRS Black Marble night-light loss.

### What NISAR shows, and why
*Figure (upload as an image here): `.crew/deck/explainer/what-nisar-sees.png` — calm water reads dark, a flooded town or forest stays bright (double bounce), HH and HV.*
- Calm floodwater acts like a mirror to radar. It reflects the L-band pulse away from the satellite, so new flooding appears as new dark patches between the before and after passes.
- Radar passes through cloud, which is why it works when optical cannot; L-band (24 cm) also passes through leaves and is barely affected by rain. Wind-roughened water can look bright (less so at L-band), and wet snow can look dark like water; keeping only low ground near rivers limits that.
- Flooded towns and forests behave differently. Water under walls or trunks bounces the pulse back to the satellite (double bounce), which cancels the darkening. Our current detector reads only the darkening in co-polarization, so it misses that flooding; we tested this and it holds (see the hypothesis below). It is one main reason recall is low, alongside our threshold choice, the 3 ha minimum patch size and the 1-day timing difference with the reference.
- Radar can find landslide scars through coherence loss or an HV backscatter drop where vegetation is stripped. Our Dec 4 → Dec 16 pass pair does span the storm, but no public NISAR interferogram (GUNW) does, and we have not yet tested amplitude change for scars, so scars stay optical candidates.

### Why L-band (NISAR), not just any radar
C-band radar (5.6 cm wavelength; NASA's OPERA surface-water product, our reference) also sees open floodwater through cloud; it is our yardstick, not a competitor. NISAR's longer L-band wavelength (24 cm) adds three things this problem needs: it reaches water **under vegetation canopy**, where C-band mostly sees the leaves; it keeps **interferometric coherence over vegetated slopes**, which landslide work needs; and it gives **regular 12-day, dual-polarization (HH and HV) coverage** of Brazil.

### Hypothesis: why radar misses flooded towns and forests — tested, supported
- **What we saw.** Our NISAR flood candidates catch only 13% of the new water in NASA OPERA's C-band surface-water map for the same days (recall 0.13; see Validation).
- **Hypothesis.** Calm open floodwater acts like a mirror, so it goes dark in HH (sent and received horizontally). In a flooded town or forest, the water and the walls or trunks bounce the pulse back to the satellite (double bounce), which cancels the darkening. A detector that only looks for HH darkening should therefore miss flooding in built-up and forested places.
- **Test.** Over the same NISAR pass pair (Dec 4 → Dec 16, 2025), we split the flood OPERA saw by land cover (MODIS, 500 m) and measured the HH change.
- **Result: supported.** Of the 60,936 OPERA new-flood pixels our detector missed, 45% are on urban or forest land, against 5% of the pixels it caught (8.6× enriched). Flooded open land darkened by 2.72 dB on average; flooded urban land by only 0.66 dB and flooded forest by 0.18 dB (dry controls drifted +0.2 to +0.4 dB). So recall is 24.7% on open land but 3.4% in towns and 1.3% in forest: a darkening-only rule misses exactly where people live.
- **What it does not show.** Flooded towns and forests did not turn clearly *brighter* (a +3 dB brightening rule recovers only 0.01% of the misses); the double bounce cancels the darkening rather than reversing it. Closing the gap needs the cross-polarized HV channel, texture, or land-cover-aware detection. Full numbers: [nisar_hypothesis.json](https://github.com/r2l2pj/tipping-point-data/blob/main/data/wa_2025/nisar_hypothesis.json).

### The future of NISAR for this problem
*Figure (upload as an image here): `.crew/deck/explainer/future-of-nisar.png`.*
- **Slow slope motion.** Repeat-pass radar interferometry (InSAR) can measure slow slope motion (millimetres to centimetres per pass) and flag some slopes that creep before they fail; fast, rain-triggered shallow slides such as Rio Grande do Sul 2024 often give no warning. Today our landslide marks are only optical candidates after the fact.
- **Soil moisture at high resolution.** NISAR's planned high-resolution soil-moisture product (~200 m; NISAR Science Users' Handbook) could sharpen the "soil" part of the index (SMAP is ~9 km), except under dense forest.
- **Flooding under forest canopy.** L-band passes through leaves; the double-bounce signal in the hypothesis above is also how flooded forest becomes visible.
- **Regular coverage of Brazil.** NISAR images Brazil on a 12-day repeat, ascending and descending, so every municipality gets a radar check within days of a storm (each spot is imaged at least every 12 days), whatever the weather.

### What's new compared with existing NASA tools
- **vs LHASA v2 and LHASA-F (NASA's landslide nowcast and forecast):** NASA already does the core of the landslide side. LHASA v2 uses XGBoost with IMERG rain and SMAP soil moisture (Stanley et al. 2021, doi:10.3389/feart.2021.640043). LHASA-F forecasts about 3 days ahead from GEOS-FP rain (Khan et al. 2022, doi:10.3389/feart.2022.878996). So a machine-learning, soil-moisture or forecast-driven landslide model is **not** new here. What we add:
  - past disasters replayed with the NOAA GFS forecast exactly as issued each day (no look-ahead);
  - explicit horizons: landslide trigger probability within 24 h, 48 h, 72 h and 7 days;
  - "when × where": the trigger probability multiplied by a regional susceptibility model;
  - evaluation on held-out disaster events the model never saw, with lead time measured from the documented onset and the misses published;
  - the index (rain · soil · terrain, landslide and flood) next to the NISAR/OPERA radar response and the people exposed, on one screen.

  We have not run LHASA on our events, so we make no better-or-worse claim.
- **vs OPERA DSWx-S1 (operational water maps):** we use it as one live input. We add NISAR L-band, the pre-event risk map and the population, so the output is a ranked list of where to go rather than a water mask.
- **vs GFMS (global flood model driven by IMERG):** we do not route water downstream. That is our main known gap; see Limitations. In exchange, the map gives local terrain detail plus a radar check and alerts.

### Validation (every number has its n and caveat)
| Check | Result | n / caveat |
|---|---|---|
| Washington: NISAR flood candidates | 27.99 km² within the NISAR swath | post pass covers 74% of the area of interest; NISAR products are BETA |
| Washington: NISAR vs NASA OPERA surface water (DSWx-S1, C-band radar), new flood | F1 0.15 · precision 0.19 · recall 0.13 · IoU 0.08 | like-for-like new flood (water on Dec 15/17, not water Dec 1–7); co-pol darkening only; reference = NASA OPERA's C-band water model, not ground truth |
| Washington: NISAR 3-pass time series (HH) | flood candidates −9.7 dB (Nov 10) → −9.7 dB (Dec 4) → −16.2 dB (Dec 16): stable for a month, then dropped ~6.5 dB when the river flooded; control areas stayed within 2.9 dB | the candidates were picked by the Dec 4 → Dec 16 drop, so Nov 10 = Dec 4 is the independent check |
| Washington: NISAR vs optical HLS water | not meaningful | optical saw only 7% of the area |
| Rio Grande do Sul: flood index vs independent EU emergency maps (EMSR720) | IoU 0.20 · F1 0.33 · precision 0.75 · recall 0.21 (High or above, observed rain, May 6, 2024). None of that flooded area was flagged in the NOAA GFS run issued before the onset | Taquari valley only (5 EMS map areas, 32 km² of mapped flood); Porto Alegre was not mapped by EMS. This is agreement during the flood, not a warning |
| Southern Brazil live NISAR, first pair (Oct 25 → Nov 6, 2026) | rejected — no flood candidates published | the first candidate strip (2.35 km²) was in São Miguel Arcanjo, São Paulo (outside our RS/SC/PR scope), on the swath edge, from a pair with different acquisition modes. Two passes in between (Oct 29, Nov 1) saw it mid-swath as ordinary land (HH −5.6 / −5.1 dB). The live check now rejects mixed-mode pairs, threshold fallbacks and swath-edge patches |
| Uruguaiana (Uruguay River, Oct 2026): flood-index replay | Local flood index (NASA IMERG rain, SMAP soil, terrain) turned the Uruguaiana region Critical on Sep 30, 2026: 13,129 km², 6,121 km² of it on the low floodplain (height above drainage ≤ 5 m), 5 days before Uruguaiana reached flood stage (8.50 m, Oct 5, ANA gauge). The NOAA GFS run issued Sep 27 already showed Critical on the floodplain for Sep 29–30: 8 days ahead. Specificity, Sep 15 → Oct 31: 15 Critical days; 3 of them (Sep 20–22, small: 182 / 256 / 127 km²) had no flood stage within 10 days. Critical area concentrated on the floodplain only 1.34× (box-size dependent): right days, not yet the right streets. 54% of the NISAR flood candidates (a teammate's polygons, Sep 30 → Oct 12; 7 small polygons near Uruguaiana, 1.85 km²) lie on the floodplain, which is 28% of the land in this case area (1.92×; it was 1.5× on a smaller box); about 98,000 people live on the floodplain (GPW v4.11, whole case area). Our stricter automatic check (010D stack) rejected every pair at its −15 dB threshold clamp: no gated flood area, only darkening along the river (1.76 km²) and over fields (15.7 km², possibly rice irrigation) | near-real-time IMERG Early rain; scaled to the final product (÷1.34) the floodplain is still Critical on Sep 30 (3,541 km²). The 'Uruguaiana region' is a box around the reach (lon −58.0 to −55.3, lat −30.6 to −28.2); the km² depend on that box. No claim of being earlier than official warnings |
| Optical cloud cover | Washington 92.9% (OPERA DSWx-HLS, Dec 15/17, after the storm) · Rio Grande do Sul 100% (20 HLS scenes during the event) | why radar |
| Rio Grande do Sul: landslides in independent EU emergency maps (EMSR720), forecast as issued | 0% of the 497 mapped slides were in High-or-above cells in the NOAA GFS run issued 27 h before the first deaths | Taquari valley only (5 EMS areas, 258 km²); slides undated (post-event imagery). An honest miss for this sub-area |
| Rio Grande do Sul: landslide scar candidates (OPERA DIST-ALERT-HLS, optical) | 2,849 candidates, 20.0 km² | 17.5% of the 16,027 inventoried landslides lie within 100 m of a candidate. Against the 497 slides in the independent EU emergency maps (Taquari valley), candidates are 3.3× a random steep-terrain baseline at 100 m; at 500 m only 1.1×, so wider-radius matches are mostly chance |
| Washington: landslide inventory hits (Washington Geological Survey landslide inventory (licence to confirm)) | 66.7% of 15 points | the points are undated; scored on the peak day (Dec 12, 2025), after the Dec 9 damage, so this is not a forecast |
| Washington: people inside the NISAR flood candidates | about 950 | GPW v4.11 population count (2020) inside the 27.99 km² of radar flood candidates |
| People in the index's Critical areas (peak day) | Washington 225,583 (Dec 12, 2025) · Rio Grande do Sul 1,627,862 (May 3, 2024) | GPW v4.11 population count (2020) on its native ~1 km grid, in Critical cells (TPI > 0.6) |
| Night-light drop | Washington 44% · Rio Grande do Sul 33% | VIIRS Black Marble, before vs after; not corrected for residual cloud or snow, indicative only |
| Rio Grande do Sul: mapped landslides in High or Critical areas, forecast as issued | Scored consistently (IMERG Final against a Final climatology), 5.8% of the 16,027 landslides were already High or Critical in the NOAA GFS forecast issued 27 h before the first deaths, while that forecast flagged only 2.1% of the area: 2.7× better than chance (Critical: 0.18% of slides in 0.11% of the area, 1.6×). Runs issued 51 and 75 h before: 0% | n = 16,027 UFRGS/Cemaden inventory points (validation only); onset = first deaths, Apr 29, 2024 00:00 BRT (MetSul report; Jornal do Comércio). One forecast run carries the result. Our first number (36%) used near-real-time IMERG Early, 1.34× wetter than Final on Apr 27, against a Final climatology; it is an as-available sensitivity only |
| Washington: NISAR-flooded area in High or Critical areas, forecast as issued | 0% in the runs issued 24, 48 and 72 h before onset | onset Dec 8, 2025 00:00 PST (WA EMD situation report 25-4783); the index uses local rain only; rivers flooded from rain upstream (see Limitations) |
| Forecast alarms by municipality (NOAA GFS as issued) | Rio Grande do Sul: 34.8% of the municipality-days the forecast put at Critical (330 of 948) were in municipalities with mapped landslides, vs 24.9% for a random alarm (1.4×). Washington: 20.3% (14 of 69) vs 10.0% (2.0×) | unit = municipality × forecast issue day; the landslide maps are undated, so every slide is assumed inside the trigger window |
| ML landslide trigger model (experimental) | median per-event ROC 0.93 across 9 held-out disasters · about as good as a forecast-rain-vs-local-extreme rule · ~4–5 alarm-days per site per year | independent audit ([overfit audit](https://github.com/r2l2pj/tipping-point-data/blob/main/docs/science-review/07-overfit-audit.md)); 24 h horizon, NOAA GFS as issued |

An XGBoost trigger model ranks landslide-prone places well inside extreme storms (median per-event ROC 0.93 across 9 held-out disasters) but an independent audit found it performs about as well as a simple forecast-rain-vs-local-extreme rule, and in everyday use it would raise ~4–5 alarm-days per site per year. We present it as experimental. Details: [overfit audit](https://github.com/r2l2pj/tipping-point-data/blob/main/docs/science-review/07-overfit-audit.md).

### Limitations (stated, not hidden)
Our flood index did not flag the Washington river floods ahead of time. None of the NISAR-flooded area was High in the forecasts issued 24, 48 or 72 h before the onset (Dec 8, 2025), because the index uses only local rain and rivers flood from rain upstream. An upstream-rain term is being tested.

Other limits:
- Official warnings came before the index in both replays.
- Thresholds are not yet calibrated for Brazil; validated on 2 replay events + 11 disaster events for the ML.
- IMERG and SMAP are about 10 km; the detail comes from terrain.
- NISAR revisits every 12 days, so the radar check can arrive a week after the damage.
- NISAR's regular coverage of Southern Brazil began in late October 2026; no comparable pass pair over our area has passed the live checks yet, so the NISAR flood evidence here is the Washington replay.
- Landslides are always candidates, never confirmed.
- The live view covers Southern Brazil only.

### Try it (no login)
- Live view: https://tippingpoint.l17s.dev · public alerts: https://tippingpoint.l17s.dev/alerts
- Rio Grande do Sul replay: https://tippingpoint.l17s.dev/?case=rs_2024 (press Play)
- Washington forecast as issued: https://tippingpoint.l17s.dev/?case=wa_2025&day=-7, then **Forecast issued this day: +3 d**
- NISAR before/after: in the Washington replay, open the **NISAR radar** card and click **Before / after**
- Code (open source): https://github.com/r2l2pj/tipping-point-app · https://github.com/r2l2pj/tipping-point-data

### Use of AI
We used AI coding assistants (Anthropic Claude via Claude Code, Cognition Devin, OpenAI Codex/GPT) under human direction. They helped write and review code and drafted documentation. The idea, method and data choices come from the team's own project document. Every source, threshold and number was reviewed by the team. The repository READMEs and the commit metadata acknowledge this. The project contains no AI-generated images, video or audio. `[if the VO is TTS, say so here]`

### Tools
- **App:** TypeScript, Next.js 16, React 19, MapLibre GL, Recharts, Tailwind (self-hosted on a VPS).
- **Pipeline:** Python with uv, earthaccess, asf_search, xarray/rioxarray, rasterio, h5py, geopandas, scikit-image, XGBoost/scikit-learn/SHAP, cfgrib/ecCodes.
- **Platforms:** Google Earth Engine (one-off compute), GitHub Actions (3-hourly live job).
- **Team:** `[TEAM NAME]` — `[member names]` — Local Event `Florianópolis (Founder Haus, Jurerê)`.

## NASA Data (form field 7) and References (form field 8)
See `FORM.md` §7–§8 (unchanged).
