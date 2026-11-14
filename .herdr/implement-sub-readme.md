# implement — sub-readme (U11 final pass on README.md)

Scope: `README.md` only. Verified against decisions.md (D8/D10), plan-delta.md,
plan-v4.txt lines 2650-2678 (Limitações + Roadmap), and plans/app.md U11 spec.

## What changed (all in README.md)

- Seams: data-reader row now includes `src/lib/contract.ts` (v4 contract
  normalization layer landed by U2) — "reader/normalizer for the data contract".
- Seams: added row for `src/app/api/telegram` + `src/lib/telegram/` (U8
  webhook, 503 until `TELEGRAM_TOKEN` + `TELEGRAM_SECRET` — cred-blocked).
- Seams: docs row now lists `docs/{PLAN,app-contract,DEPLOY}.md` instead of
  only `docs/PLAN.md` (the other two were missing from the table).
- Deploy: added pointer to `docs/DEPLOY.md` runbook (`DATA_BASE_URL` live-data
  bucket + env vars). Kept as a pointer only — see flags below.
- Limitations: `RS-2024` → `rs_2024` (consistent with `wa_2025`; canonical
  underscore case ids per `src/lib/contract.ts` aliases note).
- Limitations: added the plan-v4 declared item that was missing — L-band
  coherence loss also occurs with vegetation and rain; landslide marks are
  always candidates, never field confirmation (merged into the NISAR bullet).

## Verified already correct (no change needed)

- "Replay forecast" note: declared "perfect forecast", observed IMERG as
  D+1..D+3, `forecast_source=perfect-forecast`, labeled in app; live = GEOS-FP.
- Limitations: single-event calibration, ~10 km IMERG/SMAP (detail from
  terrain, HAND proxy vs MERIT Hydro = validation ref only), NISAR ~12-day
  revisit, replay-not-live, rs_2024 predates NISAR, wa_2025 radar = flood only
  (GCOV) + HLS candidates + no GUNW pair.
- Env naming (D10): `GCP_SA_KEY` canonical; `GEE_SERVICE_ACCOUNT_KEY` appears
  only marked "(fallback)".
- Run section (`predev`/`prebuild` sync, `DATA_REPO` override) matches
  package.json + `scripts/sync-data.mjs`. Layer stack wording uses
  "landslide candidates". Submission files all exist; demo script ≤30 s,
  slides outline = 7 `##` sections.

## Commands run

- `grep -niE "confirmed.{0,20}(landslide|scar)|\bscar" README.md` → empty
  (exit 1). Landslides are never "confirmed" in the README.
- `grep -n "GEE_SERVICE_ACCOUNT_KEY" README.md | grep -c "(fallback)"` → 1.
- `grep -rn "DATA_BASE_URL" src/` → empty (see flags).
- `git diff README.md` — reviewed; docs/greps only, no build needed.

## Flags for the lead (outside this unit's README scope)

- `src/lib/ee.ts` reads only `GEE_SERVICE_ACCOUNT_KEY` — the D10 chain
  (`GCP_SA_KEY` first, fallback second) is not implemented in code yet, here
  or in the `u9` worktree. README documents the D10 contract; a code unit
  still owes the fallback.
- `DATA_BASE_URL` is not read anywhere under `src/` — runtime bucket fetch is
  documented in committed `docs/DEPLOY.md` but not implemented. README now
  points at the runbook without asserting working behavior.
- `docs/PLAN.md` exists on main but is *untracked* (`??`) — README references
  it; whoever owns docs needs to commit it.
- `src/components/MapLayers.tsx` internal IDs/comments still say "scars"
  (`tp-scars`, "landslide scars > zone markers"). User-facing README text says
  "candidates" as required; internal rename is a code-side follow-up.
