# Number-sync checklist (for the ~17:00 replay regeneration)

Every replay-derived number in the public copy, its `metrics.json` key (tipping-point-data `origin/main`, `cases.<case>.…`), and where it appears. After lead-analysis republishes, re-read each key, update every location, then re-run the grep at the bottom.

Legend for "where": P = `project-page.md` (summary / validation table / text), R = app `README.md` #validation, S = `slides-outline.md`, B = `.crew/gallery/blurb.md`, D = deck (`.crew/deck/deck.html` → `slides.pdf`), V = video overlays (`.crew/video/build-v5.sh`).

## Likely to change with the regeneration (rain/soil bilinear + permanent-water mask)

| Number now | Key | Where |
|---|---|---|
| RS 36% (36.45) of 16,027 High+, 27 h before onset; Critical 2% (1.87) | `rs_2024.slide_warned_gfs_24h_pct`, `…_critical_pct` | P table + Forecast line, R, S5, D |
| RS area flagged 4% (4.16) → lift 8.8× (8.76); Critical 0.29% → 6.4× (6.45) | `rs_2024.slide_warned_gfs_24h_area_share_pct`, `…_lift`, `…_critical_area_share_pct`, `…_critical_lift` | P, R, S5, D |
| RS earlier runs 0% (51 / 75 h) | `rs_2024.slide_warned_gfs_48h_pct`, `…_72h_pct` | P, R, S5, D |
| RS onset sensitivity (Apr 30 → 0%; May 1 anchor 88.13%) | `rs_2024.slide_warned.sensitivity[]` | P, R |
| EMS slides 57% centre (56.94) in 27% (26.72) → 2.1× (2.13); any-cell 81% (81.09) → 3.0× (3.03); Critical 20.7% | `rs_2024.landslide_ems_warned_gfs_24h_centroid_pct`, `…_centroid_area_share_pct`, `…_centroid_lift`, `landslide_ems_warned_gfs_24h_pct`, `…_lift`, `…_critical_pct` | P, R |
| EMS flood IoU 0.18 (0.185) · F1 0.31 · P 0.46 · R 0.24 (May 6, observed) | `rs_2024.flood_ems_iou`, `_f1`, `_precision`, `_recall` | P, R, S5, D |
| EMS flood pre-onset 0.21% observed / 6.6% GFS (6.56) in 2.9% area (2.94) → 2.2× (2.23) | `rs_2024.flood_ems_flagged_before_onset_pct`, `…_area_share_pct`, `…_lift` (observed: see `flood_ems` object) | P, R, S5 |
| WA flood 0 / 0 / 0.14% (24 / 48 / 72 h) | `wa_2025.flood_warned_gfs_{24,48,72}h_pct` | P table + Limitations, R, S5 |
| WA people in index-critical areas 254,263 (Dec 12; native grid, data 3f7a5ab) | `wa_2025.people_critical` | P summary + table, S6, D |
| RS people in index-critical areas 1,681,783 (May 3; native grid, data 3f7a5ab) | `rs_2024.people_critical` | P table, S6, D |
| WA people inside NISAR flood candidates about 950 (949; native grid, exact cell fractions) | `wa_2025.people_flooded` | P summary + table, S5/S6, B, D |
| WA landslide inventory 66.7% of 15 (WGS, peak day) | `wa_2025.landslide_hit_pct` | P table, R |
| Alarm precision RS 33.7% (327/971) vs 24.9% (1.35×) · WA 19.7% (13/66) vs 10.0% (1.97×) | `<case>.alarm_precision_critical_pct`, `_n_hits`, `_n_alarms`, `alarm_baseline_pct`, `alarm_lift` | P table |
| Night-light drop WA 44% · RS 33% | `night_lights` keys | P table, S6, D |
| ML: ROC 0.93 median / 9 events / ~4–5 alarm-days | `docs/science-review/07-overfit-audit.md` | P, R, S3 |
| WA forecast proof: GFS issued Dec 3 → Critical landslide risk Dec 6 | replay frame `tpi_slide_gfs_d3_20251206` (check it is still Critical) | P Forecast line, S5, V beat D, D |

## Should NOT change (radar / NISAR / optical)

27.99 km² NISAR flood candidates, 74.1% swath coverage, F1 0.15 / P 0.19 / R 0.13 / IoU 0.08 vs OPERA, 92.9% / 100% cloud, NISAR 3-pass series (−9.7 / −9.7 / −16.2 dB), double-bounce result (45% vs 5%, −2.72 / −0.66 / −0.18 dB, recall 24.7 / 3.4 / 1.3%), scar candidates 2,849 / 20.0 km² / 17.5% within 100 m / EMS lift 3.3× at 100 m, 1.1× at 500 m. Re-check anyway if lead-analysis says the WA replay grid changed.

## Grep after the pass

```sh
cd ~/code/r2l2pj/tipping-point-app-wt/submission
grep -rn -E "36%|36\.45|8\.8×|4%|4\.16|57%|2\.1×|81%|3\.0×|0\.18|0\.31|6\.6%|2\.2×|229,|1\.49|1,488|1,150|66\.7|44%|33%" \
  README.md submission/{project-page,slides-outline}.md ../../.crew/gallery/blurb.md
```

## Uruguaiana (main case) — pick A or B at the 14:45 sync from lead-analysis's numbers

Current text in the files = version A with [TBD]. Keys (fallback ~14:00): `cases.rs_uruguai_2026.radar_darkening_corridor_km2`, `radar_darkening_fields_km2`, `radar_darkening_pair`; A only if `nisar_flooded_km2` + `nisar_people_flooded` are non-null (else `_null_reasons.nisar_flooded_km2` → B). Teammate v0 keys `flooded_km2` 1.817 / `people_flooded` 28 are NOT NISAR. NISAR pair Oct 24 → Nov 5, 2026 (HH + HV); Itaqui outside the swath. Never call the Sep 30 → Oct 12 pair NISAR.

**A — the guard fix yields gated flood candidates** (fill km² and people from the published keys):
- Page lead: "A NISAR pass pair (Oct 24 → Nov 5, 2026) mapped [km²] km² of flood candidates at Uruguaiana through cloud, home to about [people] people (Itaqui is outside that swath)."
- Slide 4: "NISAR pass pair Oct 24 → Nov 5, 2026 (HH + HV) over the Uruguay River — flood candidates [km²] km², about [people] people inside; Itaqui is outside the swath"
- Video C overlay: "Uruguay River · Uruguaiana · NISAR Oct 24 → Nov 5, 2026 · flood candidates"

**B — no gated candidates** (only ungated darkening: 5.6 km² river corridor; 11.9 km² fields, possibly irrigation):
- Page lead: "A NISAR pass pair (Oct 24 → Nov 5, 2026) shows radar darkening along the Uruguay River corridor at Uruguaiana through cloud (5.6 km², not yet a flood map); Itaqui is outside that swath."
- Slide 4: "NISAR pass pair Oct 24 → Nov 5, 2026 (HH + HV): radar darkening along the Uruguay River corridor at Uruguaiana (5.6 km², not yet a flood map; another 11.9 km² of darkening over fields is possibly irrigation)"
- Video C overlay: "Uruguay River · Uruguaiana · NISAR Oct 24 → Nov 5, 2026 · radar darkening, not yet a flood map"
- Validation table: add a row "Uruguaiana NISAR pair (Oct 24 → Nov 5, 2026) | 5.6 km² darkening along the river corridor; 11.9 km² over fields | no gated flood candidates (the per-scene threshold did not fire); not yet a flood map"

Both: VO beat C = "At Uruguaiana, NISAR saw the Uruguay River through cloud in late October." ("every 12 days" only with ≥ 3 NISAR dates). Re-check the summary stays ≤ 200 words.

Teammate pair (Sep 30 → Oct 12, 2026, "track 010 frame 103"): NOT NISAR (no NISAR GCOV in CMR for those dates; likely Sentinel-1, unconfirmed). If it is mentioned at all: "a teammate's radar pair (sensor unconfirmed, likely Sentinel-1): 1.82 km² of candidates, about 28 people, possibly rice irrigation" — never in the headline or VO. lead-analysis fallback 8315d80 carries this label.
