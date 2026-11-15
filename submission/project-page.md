# Tipping Point: project page text (primary artifact)

> **DRAFT — pending approval.** The 2026 guide says "the majority of judges' evaluation will be based on your project submission" (the project page), so this file is the full text. Paste each section into the form field named in its heading.
>
> Every number is traced to the published `metrics.json` (tipping-point-data `origin/main` d04ecab). Lead-time numbers are ON HOLD (L35), and the ML skill numbers are pending re-score (L33). `[…]` marks a gap; nothing in brackets ships.
>
> NISAR is the spine of the copy, by request of the conductor (win-odds #3).

---

## High-Level Project Summary (form field 2, ≤200 words)

NISAR passes over Southern Brazil every 12 days, and its L-band radar sees through cloud and darkness. Tipping Point is built around that pass. Between passes, NASA rain (GPM IMERG), soil moisture (SMAP) and terrain (NASADEM) feed a Tipping Point Index that maps where floods and landslides are about to happen. After each pass, NISAR shows where the ground actually flooded, as candidates for municipal Civil Defense to check first. We built it for Rio Grande do Sul, Santa Catarina and Paraná. During the May 2024 Rio Grande do Sul floods, optical satellites saw nothing: 100% cloud. A live view refreshes every 3 hours with experimental (not official) area alerts. Two past disasters replay day by day with the forecast exactly as it was issued. In Washington State (December 2025), the NISAR Dec 4 → Dec 16 pass pair maps 27.99 km² of flood candidates under 92.9% cloud, and 229,782 people were in critical areas. `[HEADLINE — ON HOLD (L35); candidate awaiting Lucas: RS 88% landslide sentence, see REVIEW.md]`

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
| Washington: radar vs OPERA optical reference (new flood) | F1 0.15 · precision 0.19 · recall 0.13 · IoU 0.08 | scored only on the 7% of the scene optical could see (92.9% cloud); co-pol darkening only |
| Cloud during the events | Washington 92.9% · Rio Grande do Sul 100% | HLS optical scenes over each event window |
| Rio Grande do Sul: landslide scar candidates | 2,849 candidates, 20.0 km² | 46% of the 16,027 inventoried landslides lie within 500 m of a candidate; 55% of candidates lie within 500 m of one |
| Washington: landslide catalog hits | 66.7% | only 15 dated reports, so this is indicative |
| People in critical areas (peak day) | Washington 229,782 (Dec 12, 2025) · Rio Grande do Sul 1,488,833 (May 3, 2024) | GPW v4 counted in TPI ≥ 0.60 cells |
| Night-light drop | Washington 44% · Rio Grande do Sul 33% | VIIRS Black Marble, before vs after |
| Lead time | `[ON HOLD — L35]` | re-scored with an upstream-rain term, ~12:00 |
| ML landslide trigger model | `[pending v2 re-score — L33]` | held-out RS 2024 + WA 2025 |

### Limitations (stated, not hidden)
`[awaiting Lucas — honest flood result]` Our flood index did not flag the Washington river floods ahead of time. 0% of the NISAR-flooded area was High or Critical 24–48 h before the damage, because the index uses only local rain and rivers flood from rain upstream. An upstream-rain term is being tested.

Other limits:
- Official warnings came before the index in both replays.
- Thresholds are calibrated on few events.
- IMERG and SMAP are about 10 km; the detail comes from terrain.
- NISAR revisits every 12 days, so confirmation can arrive a week after the damage.
- Landslides are always candidates, never confirmed.
- The live view covers Southern Brazil only.

### Try it (no login)
- Live view: https://tipping-point-app.vercel.app · public alerts: https://tipping-point-app.vercel.app/alerts
- Rio Grande do Sul replay: https://tipping-point-app.vercel.app/?case=rs_2024 (press Play)
- Washington forecast as issued: https://tipping-point-app.vercel.app/?case=wa_2025&day=-7, then **Forecast issued this day: +3 d**
- NISAR before/after: in the Washington replay, open the **NISAR radar** card and click **Before / after**
- Code (open source): https://github.com/r2l2pj/tipping-point-app · https://github.com/r2l2pj/tipping-point-data

### Use of AI
We used AI coding assistants (Anthropic Claude via Claude Code, Cognition Devin, OpenAI Codex/GPT) under human direction. They helped write and review code and drafted documentation. The idea, method and data choices come from the team's own project document. Every source, threshold and number was reviewed by the team. The repository READMEs and the commit metadata acknowledge this. The project contains no AI-generated images, video or audio. `[if the VO is TTS, say so here]`

### Tools
- **App:** TypeScript, Next.js 16, React 19, MapLibre GL, Recharts, Tailwind (Vercel).
- **Pipeline:** Python with uv, earthaccess, asf_search, xarray/rioxarray, rasterio, h5py, geopandas, scikit-image, XGBoost/scikit-learn/SHAP, cfgrib/ecCodes.
- **Platforms:** Google Earth Engine (one-off compute), GitHub Actions (3-hourly live job), Neon Postgres (alert subscribers).
- **Team:** `[TEAM NAME]` — `[member names]` — Local Event `[EVENT]`.

## NASA Data (form field 7) and References (form field 8)
See `FORM.md` §7–§8 (unchanged).
