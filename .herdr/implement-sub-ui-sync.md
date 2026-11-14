# sub-ui-sync: U11 submission copy synced to landed UI (7ee116a)

Unit: U11 sub-ui-sync (depth 2, no helpers spawned).
Scope touched: `submission/demo-script.md`, `submission/slides-outline.md`, `README.md` (Seams table only). No code changes, no package changes.
Conductor ruling applied (received mid-task): English UI labels per doc rule 8 — "Acertamos?" → "Did we get it right?" everywhere in copy; chip "previsão perfeita" → "perfect forecast"; Portuguese-strings discrepancy stated in production notes and routed to lead-front / lead-integration; [swipe pending U5] kept; "Landslide scar candidates (HLS optical)" kept; X placeholders kept; "would have warned X hours earlier" flagged as awaiting Lucas.

All verified UI strings were grepped against source before writing (SidePanel.tsx, Header.tsx, AlertTab.tsx, RadarTab.tsx, ValidationTab.tsx, ImpactTab.tsx, alerts.ts, contract.ts, MapLayers.tsx, Dashboard.tsx, tpi.ts). The "⚠" on the /alerts card is added in `src/app/alerts/page.tsx:83` around the generated title `Tipping Point: CRITICAL landslide risk` (`src/lib/alerts.ts:133`). SWOT chart confirmed rendered below the stat cards in ValidationTab (`ValidationTab.tsx:98`). RS RADAR defect confirmed in code: `RadarTab` renders `Flooded area (NISAR)` from `metricsView.flooded_km2` ungated on a NISAR pair (`RadarTab.tsx:20-24`).

## submission/demo-script.md — changes

1. Intro: added "Verified against the UI at 7ee116a."; intro sentence now says on-screen text uses the ruled English labels with the Portuguese discrepancy noted in production notes. VO total restated as 68 words (see count below).
2. Step 1 on-screen: "Replay cases → RS · May 2024" → "case selector → Rio Grande do Sul flood, May 2024" (matches events.json case title shown in Header).
3. Step 2 on-screen: card quote "CRITICAL landslide risk — 3-day rain above the 99th percentile. Soil saturated." → "TIPPING POINT REACHED banner with the perfect forecast chip; public feed card titled "⚠ Tipping Point: CRITICAL landslide risk"". VO kept: "…it would have warned X hours earlier."
4. Step 3 on-screen: "Click Confirm…: case selector to WA · Dec 2025, RADAR tab." → "Select Washington atmospheric rivers, Dec 2025 (opens on ALERT), then click Confirm with NISAR radar → (opens RADAR)." "NISAR GCOV — before / after swipe (Dec 4 / Dec 16)" → "NISAR GCOV — before / after, Dec 4, 2025 → Dec 16, 2025 [swipe pending U5]" (dates via fmtDate in tpi.ts). "Flooded area (NISAR GCOV): 41.6 km²" → "Flooded area (NISAR): 41.6 km²". "purple landslide marks labeled candidates" → "purple landslide candidates; card Landslide scar candidates (HLS optical), note: candidates, never confirmed".
5. Step 4 on-screen: ""Acertamos?" (VALIDATION tab)" → "Did we get it right? tab" (ruled English label). "Median lead time 52 h" was already "X h"; kept "Median lead time X h". "Why radar — Cloud cover during the event: 94%." → "Why radar: During the event the optical saw only 6% of the scene" (matches ValidationTab `opticalPct` rendering: optical saw = 1 − cloud_pct). "SWOT river-level chart beside the cards" → "below the cards". Kept "Zones warned before event 87%", IoU 0.71, F1 0.83. VO trimmed to the spec wording: "IoU 0.71, X-hour lead time, 87% warned early." (spec prescribed this VO; "Did we get it right?" opener dropped).
6. Step 5 on-screen: ""Impacto" (IMPACT tab): People exposed 8,400, Lights-out area (Black Marble) 18%, priority zones list" → "IMPACT tab: People in critical areas 8,400, Night-light drop 18%, exposure basis GPW v4 / VIIRS Black Marble". Priority-zones list removed (it lives on the ALERT tab). VO → "8,400 people in critical areas, prioritized for Civil Defense."
7. Production notes:
   - Added "UI still Portuguese at 7ee116a" note per conductor ruling (names tab "Acertamos?", chip "previsão perfeita", fallback "previsão"; change routed to lead-front/lead-integration).
   - Forecast-label bullet replaced: now "Forecast frames carry a source label: on replay it reads "perfect forecast" (UI string "previsão perfeita" at 7ee116a), on live "GEOS-FP". Replay uses a declared perfect forecast (observed IMERG as D+1..D+3, forecast_source=perfect-forecast), stated in the README." Removed the unverified "hollow dashed dots on the timeline" claim.
   - RS bullet: "Awaiting NISAR pair" → "Awaiting a NISAR pair over the AOI." (exact UI string).
   - Added OPEN DEFECT bullet: RS RADAR tab shows "Flooded area (NISAR) 118.3 km2", not gated on a NISAR pair; do not record the RS RADAR tab until fixed.
   - Landslide bullet: now names the real card label "Landslide scar candidates (HLS optical)"; kept "candidates, never confirmed".
   - Numbers list → "(WA: IoU 0.71, F1 0.83, 41.6 km2, X h median lead, 87% warned, optical saw 6% (94% cloud), 8,400 people in critical areas, night-light drop 18%)".
   - Added: ""Would have warned X hours earlier" is a public claim: awaiting Lucas's approval of the wording before recording (E7 ruling)."
   - Added: "Selecting a case resets the tab to ALERT." (Dashboard.tsx setTab("alert")).
   - Illustrative bullet kept + "Shown on mock-derived bundles only." added.
   - Pace note kept verbatim.
   - DRAFT banner kept.

## submission/slides-outline.md — changes

- Slide 4: "Side tabs ALERT / RADAR / VALIDATION / IMPACT" → "Side tabs ALERT / RADAR / Did we get it right? / IMPACT". "labeled FORECAST on every frame" → "forecast frames carry a source label". Visual: "RADAR before/after swipe" → "RADAR before/after swipe (needs U5)".
- Slide 5: "94–97% cloud cover during both events — that's why radar" → "Optical saw only 3–6% of the scene in both events (94–97% cloud) — that is why radar". Visual label "VALIDATION tab screenshot" → "Did we get it right? tab screenshot".
- Slide 6: "8,400 people exposed + 18% lights-out (WA); 41,200 exposed + 31% lights-out (RS)" → "8,400 people in critical areas + night-light drop 18% (WA); 41,200 + 31% (RS)".
- Slide count unchanged at 7 ("## " headings). DRAFT banner kept.

## README.md — Seams table only

Two rows added after the Map/MapLayers row (paths verified with `ls`):
- `src/components/tabs/` = side-panel tabs ALERT · RADAR · Did we get it right? · IMPACT (metrics read via `metricsView`)
- `src/lib/layers.ts` = layer stack per tab and day, in doc order (file defines `TabKey = "alert" | "radar" | "validation" | "impact"`)
No swipe row added (U5 pending).

## Self-check outputs

```
$ grep -nE "Impacto|VALIDATION|Lights-out|FORECAST|RS · May|WA · Dec|Awaiting NISAR pair|94%" submission/*.md README.md
submission/demo-script.md:25:- Numbers on screen are the real demo metrics (WA: IoU 0.71, F1 0.83, 41.6 km2, X h median lead, 87% warned, optical saw 6% (94% cloud), 8,400 people in critical areas, night-light drop 18%) — do not substitute other figures.
```
Only hit: the spec-mandated numbers list containing "(94% cloud)". Intentional.

```
$ grep -rniE "confirmed.{0,20}(landslide|scar)" submission/ README.md
(no matches, exit 1)
```

```
$ grep -c "^## " submission/slides-outline.md
7
```

Portuguese strings remaining (intentional, inside the conductor-mandated production notes only):
demo-script.md:19 (tab "Acertamos?", chip "previsão perfeita", fallback "previsão"), :20 (UI string "previsão perfeita" at 7ee116a).

## VO word count (Voiceover column, demo-script.md)

| Beat | Words (excl. standalone "—") |
|---|---|
| Cold open | 17 |
| 1 | 8 |
| 2 | 11 |
| 3 | 11 |
| 4 | 8 |
| 5 | 9 |
| Close | 4 |
| **Total** | **68** (71 raw whitespace tokens incl. dashes; 68 ≤ 75) |

Counting convention: whitespace split, standalone "—" tokens excluded — same convention as the original file's "71 words" figure (original total also counted 71 raw tokens).

## Open defects / flags

- OPEN DEFECT (stated in production notes, not fixed — out of scope): RS RADAR tab shows "Flooded area (NISAR) 118.3 km2" although RS has no NISAR pair (`RadarTab.tsx` renders `metricsView.flooded_km2` ungated).
- "Would have warned X hours earlier" — public claim, awaiting Lucas's wording approval before recording (E7 ruling).
- Lead time stays placeholder X until the validation pipeline produces the figure.
- UI label language: copy uses ruled English labels; UI at 7ee116a still shows "Acertamos?" / "previsão perfeita" / "previsão". Routed to lead-front + lead-integration.
- Before/after swipe on the map is not in the UI yet (depends on U5 SwipeCompare); copy says "[swipe pending U5]" / "(needs U5)".
- todo item #34 added to project list (request logging on).
