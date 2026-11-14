# U11: lead-time headline copy

Scope: submission/summary.md, submission/demo-script.md, submission/slides-outline.md only. Spec: /home/lucascoelho/code/r2l2pj/.crew/plans/lead-time.md.

## Changes

### submission/summary.md
- Added the spec template sentence verbatim (placeholders X / A / B / N kept literally) as the closing sentence of the Summary paragraph: "In replay, using only data available at the time, the index crossed Critical a median of X h (IQR A-B h) before mapped landslides (n = N)."
- DRAFT banner kept. Word count +24 (within ±25).

### submission/demo-script.md
- Beat 2 VO: "the index turns critical — it would have warned X hours earlier." → "would have crossed Critical a median of X hours before the landslides." (median framing, replay "would have" kept, 12 words; "landslides" not "slides" — unambiguous over a slide-deck video, per lead review).
- Beat 4 on-screen card: "Median lead time X h" → "Median lead time X h (IQR A-B h, n = N)".
- Beat 4 VO: "IoU 0.71, X-hour lead time, 87% warned early." → "IoU 0.71, median X hours early, P% warned first." (P = warned_before_pct placeholder).
- Production notes:
  - Replaced '"Would have warned X hours earlier" is a public claim' bullet with a bullet stating the headline sentence uses the spec template (median X h, IQR A-B h, n = N), all placeholders (X, A, B, N, P) await the lead-time pipeline (lead-analysis / E7 metrics) + Lucas wording approval; bare "X hours" phrasing banned per spec honesty rules.
  - Metrics bullet: "X h median lead, 87% warned" → "median X h lead (IQR A-B h, n = N), P% warned"; retrospective framing added inside the bullet ("in replay — WA: ...") per lead review so it can't read as a live claim.
  - Pace/trim fallback updated to match new beat 4 VO.
  - Per conductor update (base now 8d65729): replaced "UI still Portuguese at 7ee116a" bullet with note that English labels ("Did we get it right?", "perfect forecast") HAVE landed at 8d65729; header line updated to 8d65729; forecast-label bullet updated; replaced OPEN DEFECT bullet with note that RS RADAR flooded-area is now gated on a NISAR pair (nisar_pre/post/passes, observed/optical-OPERA fallback via metricsView.flood_source) at 8d65729 — verify on recorded build.
- Voiceover total updated 68 → 70 words (lead estimated 71; verbatim recount gives 70 — beat 2 went 11 → 12 words).

### submission/slides-outline.md
- Slide 5 early-warning bullet replaced with the template sentence verbatim + "— P% of zones warned before the event", plus a second line: "and D h before the first official warning (placeholder — sourced timestamp pending)".
- RS line: "X h lead (placeholder), 81% warned" → "median X h (IQR A-B h, n = N), P% warned".
- Slide count unchanged (7 `## ` headings). DRAFT banner kept.

## Self-check outputs

```
$ grep -n "hours earlier" submission/*.md
(no hits)

$ grep -n "IQR A-B h" submission/*.md
submission/demo-script.md:13,25,26  submission/slides-outline.md:36,38  submission/summary.md:17  (all three files)

$ grep -c '^## ' submission/slides-outline.md
7

$ grep -rniE "confirmed.{0,20}(landslide|scar)" submission/
(no hits)
```

VO word recount (whitespace split, standalone "—" excluded — same convention as prior count line):

| Beat | VO | Words |
|---|---|---|
| Cold open | "May 2024, Rio Grande do Sul. The alert said where floods could happen — not where they did." | 17 |
| 1 | "Tipping Point replays it: extreme rain, saturated soil —" | 8 |
| 2 | "would have crossed Critical a median of X hours before the landslides." | 12 |
| 3 | "Then NISAR radar confirms through the clouds: 41.6 square kilometers flooded." | 11 |
| 4 | "IoU 0.71, median X hours early, P% warned first." | 9 |
| 5 | "8,400 people in critical areas, prioritized for Civil Defense." | 9 |
| Close | "Rain warns. Radar confirms." | 4 |
| **Total** | | **70** (<= 75) |

## Flags

- All lead-time numbers (X, A, B, N, P, D) are placeholders awaiting the E7/metrics pipeline (lead-analysis) and Lucas's wording approval. DRAFT banners kept on all three files.
- English labels landed at 8d65729 per lead-front; on-screen strings still need verification on the recorded build before shooting.
- [swipe pending U5] kept as ruled.
