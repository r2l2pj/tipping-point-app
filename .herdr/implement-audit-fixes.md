# U11 audit fixes — B2 + S10/A3

Commit: `3b856dd` on `unit/audit-fixes` — "U11 audit B2+S10: metric placeholders + drop MODIS MCD12Q1"

## Sources read
- `.crew/audit/plan-conformance.md` B2 (~L50) and S10 (~L69)
- `.crew/plans/decisions.md` A3 (~L111): T stays slope/HAND; MODIS land cover is not an index input; T_ML to roadmap

## Changes

### submission/slides-outline.md (B2)
- L16 `~97% cloud cover` → `~X% cloud cover` (cloud-cover is in the mock-derived figure list; swept as sibling)
- L35 `IoU 0.71, F1 0.83` / `41.6 km²` → `IoU X, F1 X` / `X km²` (NISAR GCOV reference wording kept)
- L38 `IoU 0.64, F1 0.78` → `IoU X, F1 X`
- L39 `3–6% ... (94–97% cloud)` → `optical saw only X% of the scene in both events (X% cloud)`
- L43 `8,400 / 18% / 41,200 / 31%` → `X people ... + night-light drop P% (WA); X + P% (RS)`
- Added closing footnote: all metric numbers shown as X/A/B/N/P/D placeholders are mock-derived figures pending the real pipeline, not validated results

### submission/demo-script.md (B2)
- Beat 3: `Flooded area (NISAR): 41.6 km²` → `X km²`; VO `41.6 square kilometers` → `X square kilometers`
- Beat 4: cards `IoU 0.71/F1 0.83/87%` → `IoU X/F1 X/P%`; `optical saw only 6%` → `X%`; VO → `IoU X, median X hours early, P% warned first.`
- Beat 5: `8,400`/`18%` → `X`/`P%`; VO → `X people in critical areas, prioritized for Civil Defense.`
- Production-notes numbers bullet rewritten: ALL metric numbers are placeholders pending the real pipeline (mock-derived, not validated)
- Pace bullet trim line updated to `IoU X, median X h early, P% warned first.`

### submission/nasa-data.md (S10/A3)
- Removed `**MODIS MCD12Q1** — land cover` from Index inputs. File has no roadmap/future section, so bullet was deleted outright; no other bullets touched.

## Review follow-up (commit `a65c4eb`)
- Lead-time bullet: added "VO may compress to median-only (a median of X hours); the on-screen card and any written claim always carry median + IQR + n together."
- Numbers bullet: added that documented event facts (446/497 municipalities, 185 dead, 581,000+ displaced, ~R$88.9B) are kept as citable disaster facts — only demo-metric numbers are placeholders.

## Self-checks
- `grep -nE "0\.[0-9]|,[0-9]{3}|94|97|41\.6|0\.71|0\.83|0\.64|0\.78|8,400|41,200|87%|81%|18%|31%|6%"` slides+demo → only allowed survivors: L13 `497`/`446 of 497 municipalities` (kept fact), L14 `581,000`/`88.9` (documented RS-2024 damage facts), L22 `0.2`/`0.6` class thresholds, L28 `0.60` TPI cut. demo-script: zero matches.
- `grep -n "MCD12Q1\|MODIS" submission/nasa-data.md` → no matches (rc 1)
- `grep -c '^## ' submission/slides-outline.md` → 7 (≤7)
- VO recount: cold open 17 + b1 8 + b2 12 + b3 11 + b4 9 + b5 9 + close 4 = **70 words ≤75** — "Voiceover total: 70 words" header remains accurate
- DRAFT banners intact in all three files (line 3 each)
- Kept: NISAR dates Dec 4→16 2025, TPI ≥0.60, 0.2/0.4/0.6, ~10 km, 12 days, D-5, 3-day rain, 99th percentile, 446/497, [swipe pending U5], Landslide scar candidates (HLS optical), English labels
