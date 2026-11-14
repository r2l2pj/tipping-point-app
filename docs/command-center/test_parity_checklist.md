# Test parity checklist

Date: 2026-11-14. App at `4a7549b`. Companion to `concepts_brief.md`, blocker B5.

The file `src/components/tabs/tabs.test.tsx` holds every UI rule test and renders through
`SidePanel` and `Timeline`. Each row below must still be asserted after the switch to the new
screen, whichever build approach is chosen. "New target" names the element of the new screen
that must carry the rule; ids refer to `interaction_inventory.md`.

| Line | Test in `tabs.test.tsx` | Rule it pins | New target |
| --- | --- | --- | --- |
| 70 | reached follows the selected day, including equality and rewinding | status follows the step; a value equal to the threshold counts as reached | status chip (S1) |
| 78 | class cuts supply the threshold when the series has none | no hard-coded 0.6 | status chip (S1) |
| 85 | cuts are validated and resolve bundle before manifest before defaults | `cutsFor` order | legend (L9), chip (S1) |
| 102 | canonical dates preserve calendar dates and render timestamps in BRT | dates in BRT | every date on screen |
| 111 | cloud_pct 0.95 renders "the optical saw only 5%" | "Why radar" sentence | replay check details (S19) |
| 116 | learned vs manual slope rule and integer lead hours | AUC pair is labelled; hours are whole | replay check (S17, S18) |
| 135 | median is contextualized with IQR, sample size and English replay copy | lead time never shown alone | replay check (S17) |
| 152 | hours render whole | 47.5 shows as "48 h" | replay check (S17) |
| 160 | absent metrics or median hide the card | no empty or zero card | replay check (S17) |
| 171 | both histogram shapes render | lead-time histogram | replay check details (S19) |
| 182 | timeline places both marker tooltips on the matching tick | "first Critical", "first damage" marks | timeline (T5) |
| 207 | scar count labeled as candidates, never confirmed | landslide wording | radar card (S13), legend (L11) |
| 213 | renders nisar_passes from data_dates | pass list | radar card or details (S19) |
| 221 | date-only value renders the same day | no day shift in BRT | every date on screen |
| 228 | swath scope renders whole coverage | "within the NISAR swath - N% covered" | radar card (S13), replay check (S18) |
| 239 | swath coverage stays hidden without scope | no coverage claim without data | same |
| 251 | replay without a pair: observed reference card, no NISAR label | "NISAR" only with a real pair | radar card (S13), layer row (L6) |
| 266 | the GUNW-limitation paragraph only renders when a NISAR pair exists | declared limit | radar card (S13) |
| 287 | flood_source "opera" labels the card optical/OPERA | flood label follows `flood_source` | radar card (S13) |
| 302 | a data_dates pair shows the NISAR card and the date line | pass dates shown | radar card (S13), layer state line (L7) |
| 315 | live case without a pair keeps the awaiting copy | "Awaiting a NISAR pair over the AOI." | radar card (S13) |
| 323 | no "confirmed scar/landslide" and no "WorldPop" in any tab | banned strings | whole page, both views |
| 337, 342 | "Illustrative demo data" hidden on real bundles | sample label never on real data | data status chip (M2) |
| 350 | shown only when the bundle is mock-derived | sample label always on sample data | data status chip (M2) |
| 357 | forecast_source badge renders the contract label | "perfect forecast" in replay | timeline tag (T4), chip (S1) |

Tests in `src/lib/layers.test.ts` that pin the tab-driven map model (blocker B2). They stay
green only if `overlayPlan(tab)` keeps its signature:

| Line | Test | Effect of removing tabs |
| --- | --- | --- |
| 51 | alert shows TPI only | still true for the default state |
| 55 | radar adds flood polygons and landslide candidates | needs a new trigger |
| 65 | validation adds catalog points and the OPERA raster | needs a new trigger |
| 75 | impact adds the night-lights raster | needs a new trigger |
| 84 | no tab / unknown tab behaves like alert | this is the state a tab-free screen would always be in |
| 90 | counts drive the toggle budget | budget needs a new input |

New assertions the reviewers asked for, not covered today:

- A Now bundle with no series never renders "Below the tipping point".
- Missing zones or `people: null` render "not published yet", never 0.
- A value of exactly 0.60 gets one class on the chip, the list, the pin and the legend.
- Public Alerts shows "data unavailable" on a load failure, never "No active alerts".
- At most two data layers after any sequence of toggles; the evicted layer is named.

Interactions are not covered by CI (no DOM test library is installed). They need a scripted
browser pass before the recording.
