# tipping-point-app

Fullstack app for **Tipping Point** — NASA Space Apps Challenge 2026,
"Dancing with the SARs". Rain warns. Radar confirms.

Next.js 16 (App Router) + MapLibre + `@google/earthengine`. Serves the artifacts
published by [`r2l2pj/tipping-point-data`](https://github.com/r2l2pj/tipping-point-data).
Earth Engine is not on the runtime path — it is used only for one-off compute and
hosted copies; live EE layers stay off by default, opt-in via `GEE_ENABLED`
(`1`/`true`).

## Run

```bash
bun install
bun run dev          # predev syncs ../tipping-point-data/data -> public/data
```

`DATA_REPO=/path/to/tipping-point-data` overrides the sibling-repo default.

## Use of AI

Built with AI coding assistants (Anthropic Claude via Claude Code, Cognition
Devin, OpenAI Codex/GPT) under human direction: they wrote and reviewed code
and drafted docs. The idea, method and data choices come from the team's own
project document (`docs/PLAN.md`); every source, threshold and reported number
was reviewed by the team. AI-assisted commits carry a `Co-Authored-By` trailer.
The app shows no AI-generated images, video or audio.

## Seams

| Path | Role |
| --- | --- |
| `src/lib/data.ts` + `src/lib/types.ts` + `src/lib/contract.ts` | reader/normalizer for the data contract (`public/data`, see SCHEMA.md) |
| `src/lib/tpi.ts` | TPI classes/palette + `mockTpiGrid` synthetic raster stand-in |
| `src/app/page.tsx` + `src/components/command/` | `/` Command Center: opens on Now (Southern Brazil live, refreshed every 3 h); `?case=<id\|alias>&day=<offset>` deep-links a replay case and day. Right panel is response first ("Now on the ground"), then "Prediction"; evidence for replays ("How early? (in replay)", "Why radar") and the NISAR before/after compare |
| `src/components/Map.tsx` + `MapLayers.tsx` | MapLibre dark basemap + v3 layer stack (hillshade → TPI → water → flood → landslide candidates → labels) |
| `src/lib/layers.ts` | layer stack per tab and day, in doc order |
| `src/app/alerts` | public alerts: the same Command Center screen with the public alert view in the right panel — same message format as the Telegram bot |
| `src/app/api/events` | events index + per-event manifest |
| `src/app/api/ee/status` | live-GEE health check (service account; opt-in — needs `GEE_ENABLED` = `1`/`true`, else 503) |
| `src/app/api/telegram` + `src/lib/telegram/` | Telegram bot webhook + Neon (free) subscriber store via HTTPS SQL endpoint (plain fetch, no dep) — 503 until `TELEGRAM_TOKEN` + `TELEGRAM_SECRET` are set (cred-blocked) |
| `src/lib/ee.ts` | server-only Earth Engine client (`GEE_PROJECT` + `GCP_SA_KEY` in `.env`; `GEE_SERVICE_ACCOUNT_KEY` (fallback) also accepted) — opt-in via `GEE_ENABLED`; EE API routes return 503 while disabled |
| `public/data/<event>/`, `public/data/now/`, `public/data/alerts.json` | committed artifacts per SCHEMA.md — synced by `sync:data`; last-resort copy when every remote read misses |
| `docs/`, `submission/` | `docs/{PLAN,app-contract,DEPLOY}.md` project doc + contract/deploy notes; `submission/{summary,nasa-data,ai-declaration,demo-script,slides-outline}.md` (incl. ≤30s demo script) |

## Deploy

Vercel (repo is public — Hobby plan can deploy public org repos). `prebuild`
runs the data sync, so committed `public/data` is the last-resort deploy
fallback. Read order: the `fallback` branch of `r2l2pj/tipping-point-data`
(`raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data/`) is the
primary source, Neon Object Storage is the fallback, and an explicit
`DATA_BASE_URL` overrides both — runbook in `docs/DEPLOY.md`. Neon Postgres
serves only the Telegram subscriber store.
The `now.yml` live job refreshes data every 3 h: it computes TPI locally
from IMERG Early / SMAP / NOAA GFS forecast rain and publishes the result as one
force-pushed orphan commit per run (`manifest.json` last). The stale-data
warning threshold is 6 h. Everything runs on free tiers: GitHub Actions,
GitHub raw, Vercel Hobby, Earthdata, Telegram Bot API, Neon free.

## Credentials

Earthdata auth uses a bearer token: env var and GitHub secret
`EARTHDATA_TOKEN` (the name earthaccess reads natively). Tokens expire
~60 days — renew `EARTHDATA_TOKEN` before judging ends; the live cron
(`now.yml`) fails loudly when the token dies. `EDL_USER`/`EDL_PASS`
remain a local-only fallback, never in secrets.

The Telegram subscriber store uses `DATABASE_URL` (Neon connection string,
server-only) — set in Vercel env + GitHub secrets, never in repos.

Full env list (`GCP_SA_KEY` canonical; `GEE_SERVICE_ACCOUNT_KEY` fallback;
`DATABASE_URL` for the subscriber store): `docs/DEPLOY.md`.

## Forecast & model

Forecast rain = NOAA GFS 0.25°, our only non-NASA input; every observation
is NASA (IMERG, SMAP, NISAR, OPERA, NASADEM, GPW, Black Marble). The same
model feeds both modes, so the replay's "how early" check measures the
forecast the live view uses: replay D+1..D+3 frames use the GFS forecast
issued on each day, live mode (`now/`) uses the latest GFS run, labelled
`forecast · NOAA GFS (issued <date>)`. Perfect-forecast
frames (observed IMERG shown as D+1..D+3) are kept only as a labelled upper
bound, never the headline.

A local XGBoost model adds P(trigger 24/48/72 h) probability frames
alongside TPI, which stays the headline index; longer-range horizons carry
a visible lower-confidence label. The model is evaluated against a
RandomForest and a TPI-threshold baseline on held-out data.

## Validation

Every number below is read from the published `metrics.json`
(tipping-point-data). References are used only to score the outputs, never
as model inputs.

**Flood: NISAR vs OPERA DSWx-S1, like for like (Washington, Dec 2025).**
NISAR GCOV pass pair Dec 4 → Dec 16, 2025 (track 172D, frame 064, BETA
products) mapped 27.99 km² of new-flood candidates within the swath (the post
pass covers 74% of the area of interest). Scored against OPERA DSWx-S1
(Sentinel-1 radar water) on the same footing: new flood only (water on
Dec 15/17, minus water on Dec 1–7), permanent water removed.
Result: F1 0.15, precision 0.19, recall 0.13, IoU 0.08. Against optical
OPERA DSWx-HLS the overlap is F1 0.026 because clouds covered 92.9% of the
scene (Rio Grande do Sul, May 2024: 100% across 20 HLS scenes). The detector
reads co-polarized darkening only, so flooded towns and forests (double
bounce, brighter) are missed; that is the main reason recall is low.

**Landslides: inventories.**
- Rio Grande do Sul 2024: UFRGS/Cemaden inventory, 16,027 mapped landslide
  points. Using only the forecast available at the time, 36% of the 16,027 mapped landslides were already in High or Critical areas 27 hours before the first deaths (Critical: 2%). Earlier runs (issued 51 and 75 hours before) showed 0%.
  The run issued Apr 28, 2024 put 36.45% of points in High or Critical
  cells (Critical 1.87%); the runs issued Apr 27 and Apr 26 put 0%; observed
  rain on Apr 28 put 0.25%. Onset = the first deaths, Apr 29, 2024 00:00 BRT
  (MetSul report; Jornal do Comércio). The result is fragile: with the
  onset on Apr 30 (first landslide deaths) the 24 h run shows 0%, and the
  earlier May 1 anchor gave 88.13%; one forecast run carries it. Post-event OPERA DIST-ALERT-HLS scar
  candidates: 2,849 (20.0 km²); 46% of inventory points lie within 500 m of
  one.
- Washington 2025: Washington Geological Survey landslide inventory (licence to confirm), 15 points; 66.7%
  fall in Critical cells on the peak day (Dec 12, 2025). The points are
  undated, so this is agreement after the damage, not a forecast.

**Flood forecast (Washington).** None of the NISAR-mapped flood area was
High in the GFS forecasts issued 24 h or 48 h before the onset (Dec 8, 2025
00:00 PST, WA EMD situation report), and 0.14% (none Critical) in the run
issued 72 h before: the index uses local rain only, and these rivers flooded from rain
upstream. An upstream-rain term is being tested.

**Machine-learning trigger model.** XGBoost is trained and tested on
separate events: the TEST set holds out whole events the model never saw,
including Rio Grande do Sul 2024 and Washington 2025. The susceptibility
layer is being retrained without Rio Grande do Sul points to remove a
leak found on Nov 15; scores that used the leaked layer are withdrawn. Scores are compared with a RandomForest and the TPI > 0.6 rule at
the same base rate. An XGBoost trigger model ranks landslide-prone places well inside extreme storms (median per-event ROC 0.93 across 9 held-out disasters) but an independent audit found it performs about as well as a simple forecast-rain-vs-local-extreme rule, and in everyday use it would raise ~4–5 alarm-days per site per year. We present it as experimental.
Audit and numbers: [tipping-point-data `docs/science-review/`](https://github.com/r2l2pj/tipping-point-data/tree/main/docs/science-review).

**Anchor dates (L37).** "Before the damage" is measured from the documented
start of each event (the first dated reports of landslides or flooding), not
from a later peak day. Official warnings came before the index in both
replays; the index adds where and who, not an earlier warning.

## Limitations

- Thresholds are not yet calibrated for Brazil; validated on 2 replay events + 11 disaster events for the ML.
- IMERG and SMAP inputs are ~10 km; the detail comes from terrain. The HAND
  proxy is a simplified NASADEM product validated against MERIT Hydro
  (validation reference only).
- NISAR revisits every ~12 days, so radar confirmation can arrive days after
  the event. L-band coherence loss also occurs with vegetation and rain —
  landslide marks are always candidates, never field confirmation.
- The video demo is a replay of past events; the live view (`now/`) covers Southern Brazil only and refreshes every 3 h.
- The rs_2024 case has no radar confirmation — the event predates NISAR.
- The wa_2025 radar confirms flood only (NISAR GCOV). Landslide marks are
  candidates from post-event HLS optical, and no GUNW pair spans the event
  (declared limitation).
