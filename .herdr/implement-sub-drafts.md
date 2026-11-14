# implement-sub-drafts — submission copy drafts (2026-11-14)

## Files written (all new, nothing else touched)
- `submission/title-summary.md` — title/subtitle/challenge, one-line pitch, verbatim theme sentence, ~180-word summary, NASA data used list (+ MERIT Hydro validation-reference-only line), AI usage declaration marked [TO CONFIRM WITH LUCAS], target awards line.
- `submission/video-script.md` — 30 s beat-by-beat table (time | on screen | voiceover) + production-notes block.
- `submission/slides-outline.md` — 7 slides, each with title, 3–5 bullets, suggested visual.

## Voiceover word count
66 words total (limit 75). Per beat: 17 / 14 / 11 / 13 / 7 / 4.

## Commands run
- `mkdir -p submission .herdr && ls` — submission/ was empty; .herdr/ already existed.
- `ls -la submission .herdr` — confirmed only new draft files added.

## Constraint checks
- Floods "confirmed" only via NISAR GCOV; landslides written as "candidates" everywhere — the word "scars" appears only inside the UI's own quoted disclaimer ("never 'confirmed scars'").
- Replay forecast called "perfect forecast" and marked declared (title-summary summary, script production notes, slides 4 and 6).
- RS-2024 explicitly has no radar confirmation; radar beat pinned to WA Dec 2025.
- All numbers sourced from `public/data/*/metrics.json` (WA: IoU 0.71, F1 0.83, 41.6 km², 52 h, 87%, 94%, 8,400, 18%; RS: IoU 0.64, F1 0.78, 46 h, 81%, 97%, 41,200, 31%) and plan docs (RS-2024 real-world figures: 446/497 municipalities, 185 dead, 581,000+ displaced, R$88.9 bi).
- On-screen text matches real UI labels verified in `src/components/SidePanel.tsx`, `src/components/Header.tsx` ("EVENT REPLAY · DEMO", "Replay cases"), `src/components/Timeline.tsx` (D-5/EVENT, "Forecast +72h"), `src/app/alerts/page.tsx` (alert card text, "Follow Civil Defense guidance. SMS 40199."), `MapLayers.tsx` ("FORECAST").
- English throughout; no git, no package changes, nothing outside `submission/` and `.herdr/`.

## Deviations / notes
- Beat 4's "Acertamos?" kept as a small overlay caption (per instructions); all other captions are English to satisfy the English constraint — flag if the team wants a Portuguese on-screen word in an otherwise English video.
- Script's landslide line: VO doesn't name landslides in the radar beat (word budget); candidates appear in the on-screen column instead, still labeled "candidates".
- AI declaration is draft text pending Lucas's confirmation, as instructed.
