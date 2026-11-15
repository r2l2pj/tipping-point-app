# Tipping Point — video storyboard + recording plan (≤30 s)

> **DRAFT — pending approval.** Built from `demo-script.md` (VO 64 words, decided lines unchanged). The rough cut is recorded from current prod; the final cut is re-shot from the `freeze-1300` build (13:00 BRT, 2026-11-15).

**Rules (official 2026 Project Submission Guide):**
- Video 30 seconds or less; over the limit means ineligible for Global Judging. The target is **29.5 s**.
- English. Subtitles are burned in anyway, for silent autoplay.
- Hosted on a public link that needs no login.
- No NASA logos or branding in anything we make. Mission names are written as text only.
- No people under 18 on screen.
- If any AI-generated image or video appears, it carries a visible watermark. If the VO is synthetic (TTS), it is declared in the description text and in the file metadata.

## Shots

Frame: 1920×1080 at 30 fps, desktop layout, browser chrome hidden. Each shot is recorded on its own with about 1 s of handles and trimmed to the in/out times below. "Must read" is the on-screen text that must be visible in the shot; if it is missing, the shot fails.

| Shot | In–out | URL + actions | Must read | Overlay (burned, not the subtitle) |
|---|---|---|---|---|
| 0 Title + cold open | 0.0–4.0 | `/?case=rs_2024` at Apr 22 (D-10), map only, slow push-in; dark 40% scrim | — | Top-left "TIPPING POINT · Rain warns. Radar confirms."; bottom-left "Team [TEAM NAME] · NASA Space Apps 2026 · Challenge: Dancing with the SARs"; centre "May 2024 · Rio Grande do Sul, Brazil" |
| 1 RS replay | 4.0–8.0 | `/?case=rs_2024`. Press **Play**: the timeline runs to May 2 (EVENT) and the TPI turns red over the Taquari valley. If 4 s of play does not reach Apr 28+, start at `&day=-6` | "Tipping point reached" (Situation overview chip) by the end | — |
| 2 WA forecast | 8.0–11.0 | `/?case=wa_2025&day=-7`. **Layers → Hazards → Landslide risk**; **Forecast issued this day: +3 d** | "issued Dec 3, 2025", "Dec 6" in the map label | "Using the forecast available at the time, Tipping Point flagged the area [X] hours before the damage." (lower third; [X] ON HOLD, L35) |
| 3 NISAR radar | 11.0–16.0 | Same case. Right panel **NISAR radar** card → **Check with NISAR radar →**, then **Before / after**, then drag the divider left to right | "pre-event GCOV — Dec 4, 2025", "post-event GCOV — Dec 16, 2025", "within the NISAR swath" | "Flood candidates · 27.99 km² within the NISAR swath" |
| 4 Did it work? | 16.0–22.0 | **Close compare** → **Replay check** → **Show details: validation and impact**; scroll to Flood detection vs reference, then the SWOT river chart (live on prod) | "F1 0.15", "Lead time before the damage" row present (number ON HOLD, L35) | "Optical satellites were 92.9% blind under the clouds. On the 7% they could see, our radar flood map overlaps at F1 0.15." |
| 5 Who + public feed | 22.0–27.0 | Timeline **Dec 12 / D+2** → **Impact** block (2.5 s); then top bar **Public Alerts** (2.5 s) | "229,8" (People in critical areas), "Replay: what would have been sent" | "229,782 people in critical areas · night lights −44%" |
| 6 Close | 27.0–29.5 | Static card: dark map frame from shot 1, wordmark | — | "TIPPING POINT · Rain warns. Radar confirms."; "Data: NASA GPM IMERG · SMAP · NASADEM · NISAR · HLS · VIIRS Black Marble · GPW" (text, no logos); "tipping-point-app.vercel.app" |

Landslide scar candidates are live on RS and Now. If WA has no scar candidates at the freeze, shot 3 shows none. Never caption anything stronger than "candidates".

## Subtitles

`captions.srt` holds the decided VO verbatim, one cue per beat. It is burned in; the VO stays 64 words.

## Recording plan

1. **Rough cut v1 (now, from prod).** Playwright records each shot (`recordVideo`, 1920×1080). ffmpeg trims, concatenates, adds the overlays and burns `captions.srt`. The output is silent. Files go to `~/code/r2l2pj/.crew/video/` (outside the repos):
   - `shots/*.webm`
   - `rough-cut-v1.mp4`
   - `frames/shotN.png` (one mid-shot frame each)
   - `REPORT.md`, which lists the must-read checks with pass/fail per shot.
2. **VO (Lucas or Jhonata, on the morning list).** Read `captions.srt` at about 2.2 words/s. Phone audio is fine. Lay it under the cut and keep the duration ≤ 29.5 s.
3. **Final (after 13:00).** Confirm that the Vercel production deployment equals the `freeze-1300` tag, then re-run the same recorder. Re-check every must-read and refresh the stills in `demo-script.md`.
4. **Host.** YouTube (Unlisted or Public) or Google Drive set to "anyone with the link". Test the link in a private window. Paste it into "Link to Project Demo" in `FORM.md`.
