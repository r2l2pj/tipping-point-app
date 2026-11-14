# U11 — submission/demo-script.md: lead-time placeholder + RS-opens ordering

## Mandate
Replace every concrete lead-time figure with the `X` placeholder (real number
waits on the E7/U6 validation pipeline), land the "would have warned X hours
earlier" line in the VO, keep ≤30 s / ≤75 VO words / 1–5 step mapping /
RS-opens-then-WA ordering and all production notes. Keep the DRAFT banner.

## What changed (submission/demo-script.md only)
- Step 2 VO (alert beat, RS case on screen): "the index turns critical days
  before." → "the index turns critical — it would have warned X hours earlier."
  RS already opens the demo (cold open + step 1 are RS · May 2024; step 3
  switches to WA for the radar proof), so no reordering was needed — D9/L3
  satisfied as written.
- Step 4 on-screen card: "Median lead time 52 h" → "Median lead time X h".
- Step 4 VO: "52-hour lead time" → "X-hour lead time".
- Production-notes stat line: "52 h" → "X h lead time (placeholder until
  validation pipeline lands)".
- Production-notes pace note (trim fallback): "52-hour lead" → "X-hour lead".
- Header VO count: 66 → 71 words.

## VO word count
Before: 66 words. After: 71 words (limit 75). Counted as whitespace-separated
tokens per VO cell, standalone em-dashes excluded — same convention as the
previously stated 66.

## Commands run
- `grep -n "52" submission/demo-script.md` → no matches (exit 1): every concrete
  lead-time figure removed.
- `grep -oE '\| "[^"]+" \|' ... | sed 's/—//g' | wc -w` → 71 VO words.
- `grep -n "DRAFT" submission/demo-script.md` → banner intact at line 3.

## Preserved
DRAFT banner; ≤30 s total; steps 1–5 mapping; RS opens then WA for radar proof;
all production notes (FORECAST label, declared "perfect forecast", RS-2024 has
no radar confirmation — radar beat is WA only, landslides are "candidates",
illustrative-data note).

No build needed (docs-only change).
