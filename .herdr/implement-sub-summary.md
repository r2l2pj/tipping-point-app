# sub-summary — final pass on submission/summary.md

## What changed

One edit to `submission/summary.md` (plus the word-count annotation):

- **Added the WA radar-confirmation arc.** The draft covered only RS-2024 and then
  described NISAR confirmation generically. Rewrote the radar sentence so the
  story arc matches the plan and demo-script:
  - RS-2024 explicitly has no radar confirmation: "The 2024 flood predates
    NISAR, so radar confirmation is demonstrated on a second case".
  - WA case: "in Washington State, December 2025, NISAR GCOV passes before and
    after the storm confirm flooded area through clouds and darkness, while
    landslide sites appear only as \"candidates\" from post-event HLS optical
    imagery". Matches plan-delta decision row (GCOV 172D/064 before/after the
    Dec 10 event; scar candidates from post-event HLS, never confirmed) and
    demo-script step 3 (Dec 4 / Dec 16 swipe).
  - Closing line: "the demo replays both events end-to-end" (was "real events").
- **Heading annotation** `## Summary (~180 words)` → `(~165 words)` to match the
  actual count.

Kept: H1, DRAFT banner, subtitle, challenge line, pitch line, theme-sentence
quote block, target awards. RS-2024 still opens the story (Lucas's choice).
No forecast wording added — "perfect forecast" rule is vacuously satisfied.

## Sources

- Theme sentence + WA decision: `~/code/r2l2pj/.crew/plan-delta.md` (Resumo
  executivo line + "Decisões adotadas" rows 18-19).
- Hard rules + case facts: `~/code/r2l2pj/.crew/briefs/project-context.md`.
- Cross-checked demo-script.md production notes (RS has no radar tab data;
  candidates only; NISAR GCOV Dec 4/16).

## Check outputs

Theme sentence byte-identical (`grep -F` of the plan-delta line, prefix
`Frase-tema (submissão): ` stripped):

```
> Tipping Point turns NASA rainfall and soil moisture data into a near
real-time landslide and flood warning, then uses NISAR radar to confirm
where the ground actually moved or flooded, so civil defense teams know
where to act first.
THEME: byte-identical OK
```

Word count of the Summary section: **165** (target 150-200).

Hard-rule grep (must be empty — it is):

```
$ grep -niE 'confirmed.{0,20}(landslide|scar)|\bscar' submission/summary.md
exit: 1   # no matches
```

Forecast grep (must not appear unless called "perfect forecast"):

```
$ grep -niE 'forecast' submission/summary.md
exit: 1   # no matches
```

DRAFT banner: `3:> **DRAFT — pending approval.**` — kept.

Numbers in the summary are all sourced: 446/497 municipalities (plan-delta
table), TPI classes <0.2 / >0.6 (plan), Dec 2025 (wa_2025 event_date). No
invented numbers. All named missions (GPM, SMAP, NASADEM, NISAR, HLS) are
inputs only.
