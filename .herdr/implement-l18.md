# L18 — submission wording + REVIEW.md

Commit: 3266380 on `unit/l18` ("L18: doc headline + REVIEW.md + PLAN.md row")

## Changes

- `submission/demo-script.md`
  - Beat 2 VO → "Tipping Point would have warned X hours earlier."; beat-2 on-screen gained the supporting card "Median lead time X h (IQR A-B h, n = N)".
  - Rewrote the template production-note bullet into an L18 bullet: headline is the doc form (X = median); full in-replay/median/IQR/n sentence is required supporting detail wherever the headline appears; added a second bullet stating the VO-may-compress clause is superseded — VO uses the headline form.
  - VO total updated 70 → 66 words (verified with `wc -w` over the VO column).
- `submission/slides-outline.md` — slide 5: lead-time line now leads with the headline "Tipping Point would have warned X hours earlier" (X = median); template sentence moved to an indented footnote "(in replay; median, IQR A-B h, n = N)". Official-warning line kept.
- `submission/summary.md` — theme sentence untouched (byte-identical to docs/PLAN.md:50); prepended "Tipping Point would have warned X hours earlier." before the template sentence, which stays as supporting detail at the end of the paragraph.
- `submission/REVIEW.md` — NEW one-page review sheet with DRAFT banner: table of every public-facing sentence (theme, tagline, one-liner, summary sentences, each VO line, each slide headline) with Where / Open placeholders / Status columns, plus an "Open items" list (X/A/B/N/P/D, swipe U5, Lucas copy approval 2026-11-15).
- `docs/PLAN.md` — one added row in the decisions table after L9b ("Texto da submissão", L18). Zero body changes.

## Self-checks

- `diff` PLAN.md:50 vs summary.md:13 (prefixes stripped): IDENTICAL.
- "would have warned X hours earlier" present in demo-script VO (beat 2), slides (slide 5), summary (final ¶): `grep` confirms.
- Template sentence still present: 1 line each in demo-script, slides-outline, summary.
- `git diff docs/PLAN.md` = 1 insertion only.
- `grep -c '^## ' slides-outline.md` = 7.
- VO word count = 66 ≤ 75.
- DRAFT banner in all 4 submission files (incl. REVIEW.md).

## Fix (commit 1c36801)

- Beat-4 VO → "IoU X, P% warned first." (second "X hours" claim removed; lead time stays in beat-2 headline + on-screen card).
- Pace note trim line → "IoU X, P% warned."
- VO total 66 → 62 words (wc -w verified).
- REVIEW.md beat-4 row updated (sentence + placeholders X, P).
