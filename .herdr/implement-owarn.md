# owarn — implement report

## What changed
- `submission/slides-outline.md` — deleted the slide-5 bullet `and **D h before the first official warning** (placeholder — sourced timestamp pending)`. Lead-time headline lines (X h earlier, footnote) untouched.
- `submission/REVIEW.md` — removed the sentence-table row `"D h before the first official warning"`; replaced the `**D**` open item with the `**Official-warning comparison** — REMOVED from public copy` note carrying the negative deltas (rs_2024 -31.2 h vs INMET aviso 2024-04-26T16:50Z; wa_2025 -71.8 h vs NWS watch 2025-12-06T00:10Z) and the never-claim-earlier-than-official rule.

## Commands run
- `grep -in "official" submission/*.md` → only the REVIEW.md removed-note (line 36). No "earlier than official" claim anywhere.
- `grep -c '^## ' submission/slides-outline.md` → 7 (slide count intact).
- `grep -n "DRAFT"` → DRAFT banners intact in both files.
- `git commit` on `unit/owarn`: `copy: drop earlier-than-official claim (negative delta)` → sha `2d13e32`.

## Notes
- Two stray paste artifacts introduced during edits were caught by `grep -in "antml"` and fixed before commit; final diff is clean (1 insertion, 3 deletions).
