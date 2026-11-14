# sub-slides — U11: slides lead-time placeholder

## What changed

`submission/slides-outline.md` only. Replaced the two concrete lead-time
figures on Slide 5 with the mandated `X h` placeholder (per E7 — the real
number waits on lead-gathering's lead-time anchor + Lucas's wording):

- L36: `52 h median lead time` → `X h median lead time (placeholder — real figure lands with validation)`
- L37: `46 h lead` → `X h lead (placeholder)`

DRAFT banner kept (line 3). No other lines touched; still 7 `## ` slide sections.

## Verification

Commands run from the worktree root:

- `grep -c "^## " submission/slides-outline.md` → `7` (≤7 OK)
- `grep -n "52 h\|52-hour\|46 h" submission/slides-outline.md` → no matches
- `grep -n "DRAFT\|Rio Grande do Sul\|NISAR GCOV\|confirmed flooded\|candidates\|perfect forecast\|no radar\|GUNW\|X h" submission/slides-outline.md` → all beats present:
  - DRAFT banner (L3)
  - RS 2024 opens the story: Slide 2 = May 2024 Rio Grande do Sul problem (L13); demo beats on Slide 4
  - WA 2025 radar proof on Slide 5 vs NISAR GCOV, `confirmed flooded` (L35)
  - landslides `candidates only, never confirmed` (L45); other landslide mentions are LHASA model name and roadmap catalog — no confirmation claim
  - replay `perfect forecast` declared (L31, L44)
  - honest-limitations slide keeps RS-no-radar (L37, `no radar — event predates NISAR`) and missing-GUNW (L45, `no GUNW pair spans the WA event`)

## Commit

`git add submission/slides-outline.md .herdr/implement-sub-slides.md &&
git commit -m "U11: slides — lead-time placeholder"` (Devin trailer).
