# Tipping Point: project page text (primary artifact)

> **DRAFT — pending approval.** The 2026 guide says "the majority of judges' evaluation will be based on your project submission" (the project page), so this file is the full text. Paste each section into the form field named in its heading.
>
> Every number is traced to the published `metrics.json` (tipping-point-data `origin/main` d04ecab). The headline is the NISAR response line (decided by conductor (delegated), L38); the RS forecast result is reported only in the validation table, with its anchor sensitivity; the WA lead-time median is retired (L35), and the ML skill numbers are pending re-score (L33). `[…]` marks a gap; nothing in brackets ships.
>
> NISAR is the spine of the copy, by request of the conductor (win-odds #3).

---

## High-Level Project Summary (form field 2, ≤200 words)

NISAR's L-band radar maps new flooding through cloud and darkness. Tipping Point turns each 12-day NISAR pass into a priority list for municipal Civil Defense: where the ground newly flooded, as candidates to check first, and how many people live there. In Washington State (December 2025), clouds hid 93% of the area from optical satellites; the NISAR Dec 4 → Dec 16 pass pair mapped 27.99 km² of flood candidates through them, and more than 229,000 people were in critical areas. NISAR also passes over Southern Brazil, our home region, and the live view shows the latest pass pair. Between passes, a Tipping Point Index built from NASA rain (GPM IMERG), soil moisture (SMAP) and terrain (NASADEM) shows where to look next. The live view refreshes every 3 hours with experimental (not official) area alerts, and two past disasters replay day by day with the forecast as it was issued. We tested why radar misses flooded towns and forests (double bounce; supported) and list what future NISAR products would add.

## Detailed Project Description (form field 5)

### What it does
Tipping Point is one operations screen for municipal Civil Defense. It answers three questions in order:
1. Where is the ground about to fail?
2. Did it?
3. Who is affected?

- **Live** (`/`): refreshes every 3 hours over Southern Brazil. It shows today's risk plus three forecast days, the latest NISAR and OPERA flood candidates, and a ranked list of priority areas with the people exposed.
- **Public Alerts** (`/alerts`): area alerts in plain language. They are an **experimental research product, not official warnings**; official alerts in Brazil come from Defesa Civil (SMS 40199).
- **Replay:** two past disasters, day by day, with no look-ahead. Each day uses only the data and the forecast available that day.

### How it works
- **Tipping Point Index (TPI).** A weighted geometric mean of three scores in [0, 1]:
  - Rain: GPM IMERG 3-day accumulation against each pixel's own P90/P95/P99 climatology.
  - Soil: SMAP L4 root-zone wetness.
  - Terrain: NASADEM slope for landslides; a height-above-drainage proxy for floods.

  A geometric mean only reaches Critical (> 0.6) when all three agree.
- **Forecast.** The next three days extend observed rain with the NOAA GFS 0.25° forecast. This is our only non-NASA input, and every map label says so. In replay we use the run actually issued that day.
- **Radar response.** For each pair of NISAR radar passes (before and after), we:
  - detect new open water as a drop in co-polarized backscatter (per-scene threshold);
  - gate it with height above drainage;
  - remove permanent water;
  - keep patches ≥ 3 ha.

  OPERA DSWx-S1 adds Sentinel-1 water candidates. OPERA DIST-ALERT-HLS adds landslide **scar candidates** from vegetation loss once the cloud clears.
- **Impact.** GPW v4 population inside critical areas, and VIIRS Black Marble night-light loss.

### What NISAR shows, and why
- Calm floodwater acts like a mirror to radar. It reflects the L-band pulse away from the satellite, so new flooding appears as new dark patches between the before and after passes.
- L-band (24 cm) also passes through cloud and rain, which is why it works when optical cannot.
- Flooded towns and forests can do the opposite. Water under walls or trunks bounces the pulse straight back (double bounce), so they turn bright. Our current detector reads only the darkening in co-polarization, so it misses that flooding. This is a main reason recall is low (see Validation).
- Landslide scars need a coherence (InSAR) pair spanning the event. No public NISAR pair spans the Washington storm, so scars stay optical candidates.

### Hypothesis: why radar misses flooded towns and forests — tested, supported
- **What we saw.** Our NISAR flood candidates catch only 13% of the new water in OPERA's Sentinel-1 water map for the same days (recall 0.13; see Validation).
- **Hypothesis.** Calm open floodwater acts like a mirror, so it goes dark in HH (sent and received horizontally). In a flooded town or forest, the water and the walls or trunks bounce the pulse back to the satellite (double bounce), which cancels the darkening. A detector that only looks for HH darkening should therefore miss flooding in built-up and forested places.
- **Test.** Over the same NISAR pass pair (Dec 4 → Dec 16, 2025), we split the flood OPERA saw by land cover (MODIS, 500 m) and measured the HH change.
- **Result: supported.** Of the 60,936 OPERA new-flood pixels our detector missed, 45% are on urban or forest land, against 5% of the pixels it caught (8.6× enriched). Flooded open land darkened by 2.72 dB on average; flooded urban land by only 0.66 dB and flooded forest by 0.18 dB (dry controls drifted +0.2 to +0.4 dB). So recall is 24.7% on open land but 3.4% in towns and 1.3% in forest: a darkening-only rule misses exactly where people live.
- **What it does not show.** Flooded towns and forests did not turn clearly *brighter* (a +3 dB brightening rule recovers only 0.01% of the misses); the double bounce cancels the darkening rather than reversing it. Closing the gap needs the cross-polarized HV channel, texture, or land-cover-aware detection. Full numbers: [nisar_hypothesis.json](https://github.com/r2l2pj/tipping-point-data/blob/main/data/wa_2025/nisar_hypothesis.json).

### The future of NISAR for this problem
- **Ground motion before failure.** Repeat-pass radar interferometry (InSAR) can measure slopes creeping by centimetres before they collapse. Today our landslide marks are only optical candidates after the fact.
- **Soil moisture at high resolution.** NISAR's planned soil-moisture product (about 200 m) is far finer than SMAP's ~9 km, which would sharpen the "soil" part of the index.
- **Flooding under forest canopy.** L-band passes through leaves; the double-bounce signal in the hypothesis above is also how flooded forest becomes visible.
- **Regular coverage of Brazil.** NISAR images Brazil on a 12-day repeat, ascending and descending, so every municipality can get a radar check after each storm without waiting for clear skies.

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
| Washington: NISAR vs OPERA DSWx-S1 (Sentinel-1 radar water maps), new flood | F1 0.15 · precision 0.19 · recall 0.13 · IoU 0.08 | like-for-like new flood (water on Dec 15/17, not water Dec 1–7); co-pol darkening only |
| Washington: NISAR 3-pass time series (HH) | flood candidates −9.7 dB (Nov 10) → −9.7 dB (Dec 4) → −16.2 dB (Dec 16): stable for a month, then dropped ~6.5 dB when the river flooded; control areas stayed within 2.9 dB | the candidates were picked by the Dec 4 → Dec 16 drop, so Nov 10 = Dec 4 is the independent check |
| Washington: NISAR vs optical HLS water | F1 0.026 | clouds covered most of the optical scenes |
| Rio Grande do Sul: flood index vs Copernicus EMS flood maps (EMSR720) | IoU 0.19 · F1 0.31 · precision 0.46 · recall 0.24 (High or above, observed rain, May 6, 2024). Before the onset, only 0.21% (observed rain) / 6.6% (NOAA GFS forecast) of that flooded area was flagged | Taquari valley only (5 EMS map areas, 32 km² of mapped flood); Porto Alegre was not mapped by EMS. This is agreement during the flood, not a warning |
| Optical cloud cover | Washington 92.9% (OPERA DSWx-HLS, Dec 15/17, after the storm) · Rio Grande do Sul 100% (20 HLS scenes during the event) | why radar |
| Rio Grande do Sul: landslide scar candidates | 2,849 candidates, 20.0 km² | 46% of the 16,027 inventoried landslides lie within 500 m of a candidate; 55% of candidates lie within 500 m of one |
| Washington: landslide inventory hits (Washington Geological Survey landslide inventory (licence to confirm)) | 66.7% of 15 points | the points are undated; scored on the peak day (Dec 12, 2025), after the Dec 9 damage, so this is not a forecast |
| People in critical areas (peak day) | Washington more than 229,000 (229,782; Dec 12, 2025) · Rio Grande do Sul at least 1.49 million (1,488,833; May 3, 2024) | GPW v4 counted in Critical cells (TPI > 0.6); lower bounds — the ~1 km resample reads about 12% low (see Limitations) |
| Night-light drop | Washington 44% · Rio Grande do Sul 33% | VIIRS Black Marble, before vs after |
| Rio Grande do Sul: mapped landslides in High or Critical areas, forecast as issued | Using only the forecast available at the time, 36% of the 16,027 mapped landslides were already in High or Critical areas 27 hours before the first deaths (Critical: 2%). Earlier runs (issued 51 and 75 hours before) showed 0%. (NOAA GFS run issued Apr 28, 2024: 36.45%, Critical 1.87%; runs issued Apr 27 and Apr 26: 0%; observed rain: 0.25%) | n = 16,027 UFRGS/Cemaden inventory points (validation only, never an input); onset = first deaths, Apr 29, 2024 00:00 BRT (MetSul report; Jornal do Comércio). Fragile: with onset Apr 30 (first landslide deaths) the 24 h run shows 0% and the 48 h run 36.45%; the old May 1 anchor gave 88.13%. One forecast run carries the result |
| Washington: NISAR-flooded area in High or Critical areas, forecast as issued | 0% (runs issued 24 h and 48 h before onset) · 0.14% High, 0% Critical (run issued 72 h before) | onset Dec 8, 2025 00:00 PST (WA EMD situation report 25-4783); the index uses local rain only; rivers flooded from rain upstream (see Limitations) |
| ML landslide trigger model (experimental) | median per-event ROC 0.93 across 9 held-out disasters · about as good as a forecast-rain-vs-local-extreme rule · ~4–5 alarm-days per site per year | independent audit ([overfit audit](https://github.com/r2l2pj/tipping-point-data/blob/main/docs/science-review/07-overfit-audit.md)); 24 h horizon, NOAA GFS as issued |

An XGBoost trigger model ranks landslide-prone places well inside extreme storms (median per-event ROC 0.93 across 9 held-out disasters) but an independent audit found it performs about as well as a simple forecast-rain-vs-local-extreme rule, and in everyday use it would raise ~4–5 alarm-days per site per year. We present it as experimental. Details: [overfit audit](https://github.com/r2l2pj/tipping-point-data/blob/main/docs/science-review/07-overfit-audit.md).

### Limitations (stated, not hidden)
Our flood index did not flag the Washington river floods ahead of time. None of the NISAR-flooded area was High in the forecasts issued 24 h or 48 h before the onset (Dec 8, 2025), and only 0.14% in the run issued 72 h before, because the index uses only local rain and rivers flood from rain upstream. An upstream-rain term is being tested.

Other limits:
- Official warnings came before the index in both replays.
- Thresholds are not yet calibrated for Brazil; validated on 2 replay events + 11 disaster events for the ML.
- IMERG and SMAP are about 10 km; the detail comes from terrain.
- People counts in the replays are lower bounds: they use a ~1 km resample of the GPW population grid that reads about 12% low (Rio Grande do Sul peak 1.49 million vs about 1.68 million on the native grid).
- NISAR revisits every 12 days, so confirmation can arrive a week after the damage.
- Landslides are always candidates, never confirmed.
- The live view covers Southern Brazil only.

### Try it (no login)
- Live view: [APP URL] · public alerts: [APP URL]/alerts
- Rio Grande do Sul replay: [APP URL]/?case=rs_2024 (press Play)
- Washington forecast as issued: [APP URL]/?case=wa_2025&day=-7, then **Forecast issued this day: +3 d**
- NISAR before/after: in the Washington replay, open the **NISAR radar** card and click **Before / after**
- Code (open source): https://github.com/r2l2pj/tipping-point-app · https://github.com/r2l2pj/tipping-point-data

### Use of AI
We used AI coding assistants (Anthropic Claude via Claude Code, Cognition Devin, OpenAI Codex/GPT) under human direction. They helped write and review code and drafted documentation. The idea, method and data choices come from the team's own project document. Every source, threshold and number was reviewed by the team. The repository READMEs and the commit metadata acknowledge this. The project contains no AI-generated images, video or audio. `[if the VO is TTS, say so here]`

### Tools
- **App:** TypeScript, Next.js 16, React 19, MapLibre GL, Recharts, Tailwind (self-hosted on a VPS).
- **Pipeline:** Python with uv, earthaccess, asf_search, xarray/rioxarray, rasterio, h5py, geopandas, scikit-image, XGBoost/scikit-learn/SHAP, cfgrib/ecCodes.
- **Platforms:** Google Earth Engine (one-off compute), GitHub Actions (3-hourly live job), Neon Postgres (alert subscribers).
- **Team:** `[TEAM NAME]` — `[member names]` — Local Event `Florianópolis (Founder Haus, Jurerê)`.

## NASA Data (form field 7) and References (form field 8)
See `FORM.md` §7–§8 (unchanged).
