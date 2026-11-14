# U11 fold — submission pack + README (t6c lead-submission)

## What changed

- `submission/summary.md` (new) — title, subtitle, challenge line, one-line pitch,
  theme sentence verbatim, ~180-word summary, target awards. Folded from
  `title-summary.md`.
- `submission/nasa-data.md` (new) — NASA data list grouped by role; added
  `VNP46A2` (Black Marble), `SWOT Hydrocron`, and `GLC` (landslide catalog,
  WA validation ref). MERIT Hydro kept as validation-reference-only line.
- `submission/ai-declaration.md` (new) — AI usage declaration, kept
  `[TO CONFIRM WITH LUCAS]` marker.
- `submission/demo-script.md` (new, from `video-script.md`) — beats remapped onto
  the doc 5-step flow: step 1 = open app on event + play (map reddens),
  step 2 = alert card at tipping point, step 3 = "Confirm with NISAR radar" →
  swipe, step 4 = "Acertamos?" metrics + SWOT river chart, step 5 = "Impacto"
  people + lights-out. Cold-open and close rows kept unnumbered. VO still
  66 words, total 30 s. Production notes kept; "scars" wording removed to keep
  the claim grep clean; "Confirm with NISAR radar →" click added to step 3;
  river (SWOT) chart added to step 4 per the doc flow.
- `submission/slides-outline.md` — DRAFT banner only, no other change.
- `README.md` — added `## Replay forecast` (declared perfect forecast,
  `forecast_source=perfect-forecast`; live mode = real GEOS-FP) and
  `## Limitations` (single-event calibration; ~10 km IMERG/SMAP inputs,
  HAND proxy validated vs MERIT Hydro; 12-day NISAR revisit; replay not live;
  RS-2024 no radar confirmation — predates NISAR; wa_2025 radar confirms
  flood only, landslide marks are HLS candidates, no GUNW pair = declared
  limitation). Seams row updated for new submission files + `docs/PLAN.md`;
  env line now `GCP_SA_KEY` canonical + `GEE_SERVICE_ACCOUNT_KEY` (fallback);
  layer stack "scars" → "landslide candidates".
- Deleted `submission/title-summary.md`, `submission/video-script.md`.
- Every `submission/*.md` has `> **DRAFT — pending approval.**` as the first
  line under the H1.

## Commands run and results

- `ls submission/` → `ai-declaration.md demo-script.md nasa-data.md
  slides-outline.md summary.md` (exactly the 5 target files) ✓
- `grep -c "^## " submission/slides-outline.md` → `7` (≤7) ✓
- frase-tema verbatim `grep -cF` in `submission/summary.md` → `1` ✓
- dataset ids in `submission/nasa-data.md` (each `grep -cF` = 1): IMERG V07,
  SPL4SMGP/008, NASADEM, MCD12Q1, HLS, GPW, VNP46A2, NISAR GCOV, OPERA DSWx,
  SWOT Hydrocron, GLC, GEOS-FP ✓
- `grep -rniE "confirmed.{0,20}(landslide|scar)|scar" submission/ README.md`
  → no matches (exit 1) ✓
- `grep -l "DRAFT — pending approval" submission/*.md | wc -l` → `5` ✓

## Notes

- `docs/PLAN.md` is referenced in the README Seams row per instruction, but
  the file itself is owned by U1 (lead-submission separate unit) — not
  touched here.
- DRAFT banner on all submission files since copy awaits Lucas approval (D9).
