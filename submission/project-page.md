# Tipping Point: project page text (primary artifact)

> **DRAFT — pending approval.** The 2026 guide says "the majority of judges' evaluation will be based on your project submission" (the project page), so this file is the full text. Paste each section into the form field named in its heading.
>
> Every number is traced to the published `metrics.json` (tipping-point-data `origin/main` d04ecab). The headline is the NISAR response line (decided by conductor (delegated), L38); the RS forecast result is reported only in the validation table, with its anchor sensitivity; the WA lead-time median is retired (L35), and the ML skill numbers are pending re-score (L33). `[…]` marks a gap; nothing in brackets ships.
>
> NISAR is the spine of the copy, by request of the conductor (win-odds #3).

---

## High-Level Project Summary (form field 2, ≤200 words)

NISAR passes over Southern Brazil every 12 days, and its L-band radar sees through cloud and darkness. Tipping Point is built around that pass. Between passes, NASA rain (GPM IMERG), soil moisture (SMAP) and terrain (NASADEM) feed a Tipping Point Index that maps where floods and landslides are about to happen. After each pass, NISAR shows where the ground actually flooded, as candidates for municipal Civil Defense to check first. Built for Southern Brazil, a live view refreshes every 3 hours with experimental (not official) area alerts, and two past disasters replay day by day with the forecast as it was issued. In Washington State (December 2025), clouds hid 93% of the area from optical satellites; the NISAR Dec 4 → Dec 16 pass pair mapped 27.99 km² of flood candidates through them, and 229,782 people were in critical areas.

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
- **Radar response.** For each NISAR GCOV pass pair, we:
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

### What's new compared with existing NASA tools
- **vs LHASA (NASA's landslide nowcast):** same family of idea (rain plus susceptibility). We add:
  - soil moisture and a flood hazard in the same index;
  - a replay that uses each forecast as it was issued;
  - municipality-level priority lists with people exposed;
  - a NISAR radar response layer on the same screen.
- **vs OPERA DSWx-S1 (operational water maps):** we use it as one live input. We add NISAR L-band, the pre-event risk map and the population, so the output is a ranked list of where to go rather than a water mask.
- **vs GFMS (global flood model driven by IMERG):** we do not route water downstream. That is our main known gap; see Limitations. In exchange, the map gives local terrain detail plus a radar check and alerts.

### Validation (every number has its n and caveat)
| Check | Result | n / caveat |
|---|---|---|
| Washington: NISAR flood candidates | 27.99 km² within the NISAR swath | post pass covers 74% of the area of interest; NISAR products are BETA |
| Washington: NISAR vs OPERA DSWx-S1 (Sentinel-1 radar water maps), new flood | F1 0.15 · precision 0.19 · recall 0.13 · IoU 0.08 | like-for-like new flood (water on Dec 15/17, not water Dec 1–7); co-pol darkening only |
| Washington: NISAR vs optical HLS water | F1 0.026 | clouds covered most of the optical scenes |
| Optical cloud cover | Washington 92.9% (OPERA DSWx-HLS, Dec 15/17, after the storm) · Rio Grande do Sul 100% (20 HLS scenes during the event) | why radar |
| Rio Grande do Sul: landslide scar candidates | 2,849 candidates, 20.0 km² | 46% of the 16,027 inventoried landslides lie within 500 m of a candidate; 55% of candidates lie within 500 m of one |
| Washington: landslide catalog hits | 66.7% of 15 points | the points are undated; scored on the peak day (Dec 12, 2025), after the Dec 9 damage, so this is not a forecast |
| People in critical areas (peak day) | Washington 229,782 (Dec 12, 2025) · Rio Grande do Sul 1,488,833 (May 3, 2024) | GPW v4 counted in Critical cells (TPI > 0.6) |
| Night-light drop | Washington 44% · Rio Grande do Sul 33% | VIIRS Black Marble, before vs after |
| Rio Grande do Sul: mapped landslides in High or Critical areas, forecast as issued | Using only the forecast available at the time, 36% of the 16,027 mapped landslides were already in High or Critical areas 27 hours before the first deaths (Critical: 2%). Earlier runs (issued 51 and 75 hours before) showed 0%. (NOAA GFS run issued Apr 28, 2024: 36.45%, Critical 1.87%; runs issued Apr 27 and Apr 26: 0%; observed rain: 0.25%) | n = 16,027 UFRGS/Cemaden inventory points (validation only, never an input); onset = first deaths, Apr 29, 2024 00:00 BRT (MetSul report; Jornal do Comércio). Fragile: with onset Apr 30 (first landslide deaths) the 24 h run shows 0% and the 48 h run 36.45%; the old May 1 anchor gave 88.13%. One forecast run carries the result |
| Washington: NISAR-flooded area in High or Critical areas, forecast as issued | 0% (runs issued 24 h and 48 h before onset) · 0.14% High, 0% Critical (run issued 72 h before) | onset Dec 8, 2025 00:00 PST (WA EMD situation report 25-4783); the index uses local rain only; rivers flooded from rain upstream (see Limitations) |
| ML landslide trigger model | `[pending v2 re-score — L33]` | held-out RS 2024 + WA 2025 |

### Limitations (stated, not hidden)
Our flood index did not flag the Washington river floods ahead of time. None of the NISAR-flooded area was High in the forecasts issued 24 h or 48 h before the onset (Dec 8, 2025), and only 0.14% in the run issued 72 h before, because the index uses only local rain and rivers flood from rain upstream. An upstream-rain term is being tested.

Other limits:
- Official warnings came before the index in both replays.
- Thresholds have not yet been validated across many events.
- IMERG and SMAP are about 10 km; the detail comes from terrain.
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
- **Team:** `[TEAM NAME]` — `[member names]` — Local Event `[EVENT]`.

## NASA Data (form field 7) and References (form field 8)
See `FORM.md` §7–§8 (unchanged).
