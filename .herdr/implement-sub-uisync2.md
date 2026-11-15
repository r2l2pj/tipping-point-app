# sub-uisync2 — submission copy resynced to the Command Center UI

Base: origin/main **6053f4c** (branch `unit/sub-uisync2`, worktree
`~/code/r2l2pj/tipping-point-app-wt/sub-uisync2`). Not pushed.

## How it was verified

- `bunx next build` (prebuild sync skipped: no sibling data repo next to the
  worktree, so the committed `public/data` was used) → exit 0;
  `bunx next start -p 3417`.
- Headless Chromium via playwright-core 1.66 (from the npx cache; no new deps)
  walked `/` (Now → Replay → both cases, every timeline step, radar card,
  Before / after swipe, Show details, Public Alerts) and `/alerts`. Labels were
  taken from the rendered `innerText` and cross-checked against
  `src/components/command/*.tsx`. Scripts live in the session scratchpad and are not committed.
- `bun run test` → no `test` script in package.json; `bun test` →
  **612 pass, 7 skip, 0 fail** (619 tests, 36 files).
- `git diff --stat` → only `submission/demo-script.md` and
  `submission/slides-outline.md` (REVIEW.md untouched).
- Voiceover column: last cell of each beat row extracted before and after with
  `grep -E '^\| (Cold open|Close|[0-9]+) \|' | awk -F' \\| ' '{print $NF}'` → `cmp` identical.
- Number check (multiset of numeric tokens, old minus new): demo-script loses
  only the old sha `8d65729`; slides lose only the "5" of the dead label
  "D-5 → EVENT" (now the real "D-10 → EVENT → D+n"). No metric changed.

## Labels found (exact, at 6053f4c)

| Old (dead) | Now | Where / click path |
|---|---|---|
| EVENT REPLAY · DEMO | **Replay** (top bar, Now / Replay) | Replay opens on WA at Dec 10 (EVENT) |
| case selector | **Past event** `<select>` | options "Washington atmospheric rivers, Dec 2025", "Rio Grande do Sul flood, May 2024" (both case names still exist) |
| D-5 → EVENT | timeline D-10 … EVENT … D+5 (RS) / D+10 (WA); **Play**, Previous step, Next step | bottom bar |
| TIPPING POINT REACHED | **Tipping point reached** (Situation overview chip, under Prediction) | RS from Apr 28 (D-4); WA Dec 9 (D-1) and Dec 10 |
| RADAR tab | **Now on the ground** → **NISAR radar** card ("Post-event confirmation", "NISAR pair available") | right panel, top |
| Confirm with NISAR radar → | **Confirm with NISAR radar** + arrow icon | switches on the "Flood confirmed by radar (NISAR)" layer |
| NISAR GCOV — before / after | **Before / after** button → overlay "pre-event GCOV — Dec 4, 2025" / "post-event GCOV — Dec 16, 2025", divider slider, **Close compare** | WA only |
| Did we get it right? tab | **Replay check** ("Did the index get it right? Measured after the event.") + **Show details: validation and impact** | right panel, below chart |
| IMPACT tab | **Impact** block inside Show details: "People in critical areas", "People flooded", "Flooded area", "Night-light drop", "Exposure basis" | also **Who is affected** → "People potentially exposed" |
| — | **How early? (in replay)**, **Why radar**, **Landslide scar candidates (HLS optical)**, **Flooded area (NISAR)**, chip **forecast · NOAA GFS (issued Dec 10, 2025)** | verified present |
| /alerts | **Public Alerts** view; live: "Alerts paused while we verify today's data" + "Observed by radar (candidates)"; replay: "There is no public alert feed in replay." | card title template "Tipping Point: <level> <hazard> risk" |
| "Awaiting a NISAR pair over the AOI." (RS) | "No radar for this event (before NISAR launch)." | RS radar card |
| "Illustrative demo data." | "Illustrative numbers" (not shown on either replay case) | |

## Beats changed (On-screen column only)

- 1: real click path (Now → Replay → Past event → RS → Play), timeline range,
  "Flood TPI · <date>" map label, "Tipping point reached".
- 2: WA via Past event; TPI index (Flood) switch must be turned on (off by
  default on WA); Dec 9 "Tipping point reached"; lead time read from the
  Replay check row and How early?; two gaps marked (below). Captions kept verbatim.
- 3: NISAR radar card → Confirm with NISAR radar → Before / after overlay
  labels; 27.99 km² kept (UI renders 28.0 km²); scar layer "pending" flagged.
- 4: Replay check / Flood detection tiles / How early? (now wired: "median 85 h …");
  Why radar exact text (92.9% kept); SWOT gap marked.
- 5: Impact block path via Show details at Dec 12 (D+2); 229,782 kept (UI renders 229,800).
- Cold open, Close: unchanged.
- Production notes: tabs note, perfect-forecast label, swipe, RS radar
  string, RS flooded-area gate, landslide card, Illustrative label, Impact path,
  "resets the tab to ALERT" replaced.
- Slides: slide 4 bullets 1–4 + Visual; slide 5 and 6 Visual lines.

## Gaps for lead-front

1. **Beat 2: no WA GFS forecast frame before Dec 9.** WA's only GFS frames are
   D+1..D+3 issued Dec 10, 2025 (after the damage); D+4+ is "perfect forecast".
   The 85 h exists only as text (Replay check row + How early?, "Earliest
   forecast run that flagged it: Dec 3, 2025 (00Z)"). Showing Critical on a
   pre-damage forecast frame needs per-issue-day forecast frames in the timeline.
2. **Beat 2: no public alert card in replay.** Public Alerts reads "There is no
   public alert feed in replay."; live is paused. The old "⚠ Tipping Point:
   CRITICAL landslide risk" card cannot be shot.
3. **Before / after renders blank** in headless Chromium: both NISAR PNGs
   (raw.githubusercontent …/wa_2025/png/nisar_pre_20251204.png, nisar_post_20251216.png)
   return 200 and the labels and divider work, but neither image (nor a basemap) is visible.
   This may only happen headless; check it in a real browser before recording.
4. **WA TPI layer is off by default** ("TPI index off · …"); the demo has to
   switch it on (written into beat 2). RS has it on.
5. **Landslide scar candidates "pending"** on both cases, so there are no purple marks on the map for beat 3.
6. **No SWOT chart for WA** ("No SWOT river data") — beat 4 mentions it.
7. Display rounding: the UI shows 28.0 km² (doc 27.99) and 229,800 (doc 229,782);
   numbers in the docs were left unchanged as the brief requires.
8. Priority areas list includes High (TPI 0.47–0.58) rows, so slide 4's
   "(TPI ≥ 0.60)" does not describe the list; I left the number as it is (not mine to change).
9. REVIEW.md line 46 "App gap" (How early? shows "pending: forecast rebuild")
   is stale: the row is wired at 6053f4c. It's an internal note, not a public sentence, so I didn't touch it.

## Screenshots (`.herdr/sub-uisync2/`)

00-open.png (Now/live) · 01-replay-default.png (WA, Dec 10) ·
02-rs-apr30-tipping-point-reached.png · 03-rs-playing.png ·
04-rs-may3-gfs-forecast.png · 05-wa-dec9-observed.png · 06-wa-dec9-tpi-on.png ·
07-wa-confirm-nisar.png · 08-wa-before-after.png · 08b-wa-before-after-dragged.png ·
09-wa-dec12-details.png (full page) · 10-alerts.png ·
11-wa-public-alerts-dec9.png · 11-wa-public-alerts-dec12.png
