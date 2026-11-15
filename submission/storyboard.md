# Tipping Point — video storyboard + recording plan (≤30 s)

> **DRAFT — decided by conductor (delegated), L38 (2026-11-15).** Built from `demo-script.md` (response-first VO, 54 words with the team placeholder). The final cut is recorded from a **local build of `freeze-1300`** (no prod dependency; Vercel is capped).

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
| A Title | 0.0–3.0 | `/?case=wa_2025`, map only, dark 40% scrim, slow push-in | — | top-left "TIPPING POINT · Rain warns. Radar sees through."; bottom-left "Team [TEAM NAME] · NASA Space Apps 2026 · Challenge: Dancing with the SARs" |
| B NISAR radar (WA) | 3.0–12.0 | Right panel **NISAR radar** card → **Check with NISAR radar →**, then **Before / after**, drag the divider left to right | "NISAR radar before — Dec 4, 2025", "NISAR radar after — Dec 16, 2025", "within the NISAR swath" | corner "Washington · Dec 2025"; "Flood candidates · 27.99 km² within the NISAR swath"; lower third "Clouds hid 93% of the area from optical satellites; NISAR radar mapped 28 km² of flood candidates through them." |
| C Live view + who | 12.0–19.0 | `/` (Now). **NISAR radar** card with its pass status (3 s; no click, no zoom) → **Who is affected** / **Priority areas** (2 s) → top bar **Public Alerts** (2 s) | "NISAR radar" card; "Updated" in the header; must NOT read "2.3 km²" or "82" people | "NISAR passes over Brazil every 12 days · each new pair is checked automatically" (0–5 s); "Experimental — not an official warning" (5–7 s, only if the card lacks it) |
| D Prediction (RS replay) | 19.0–25.5 | `/?case=rs_2024&day=-10` (Apr 22). Press **Play**; the TPI heats up over the Taquari valley. If 6 s of play does not reach Apr 28+, start at `&day=-6` | "Tipping point reached" (Situation overview chip) by the end | corner "Rio Grande do Sul · May 2024 · replay" (no forecast number) |
| E Close | 25.5–28.5 | Static wordmark card over the darkened shot-D frame | — | "TIPPING POINT · Rain warns. Radar sees through."; "Data: NASA GPM IMERG · SMAP · NASADEM · NISAR · HLS · VIIRS Black Marble · GPW · forecast: NOAA GFS" (text, no logos); "[APP URL]" |

Landslide scar candidates are live on RS and Now. If WA has no scar candidates at the freeze, shot 3 shows none. Never caption anything stronger than "candidates".

## Subtitles

`captions.srt` holds the L38 VO verbatim, one cue per beat. It is burned in. `captions.pt-BR.srt` is a separate (not burned) PT-BR track.

## Recording plan

1. **Rough cut v1 (now, from prod).** Playwright records each shot (`recordVideo`, 1920×1080). ffmpeg trims, concatenates, adds the overlays and burns `captions.srt`. The output is silent. Files go to `~/code/r2l2pj/.crew/video/` (outside the repos):
   - `shots/*.webm`
   - `rough-cut-v1.mp4`
   - `frames/shotN.png` (one mid-shot frame each)
   - `REPORT.md`, which lists the must-read checks with pass/fail per shot.
2. **VO (Lucas or Jhonata, on the morning list).** Read `captions.srt` at about 2.2 words/s. Phone audio is fine. Lay it under the cut and keep the duration ≤ 29.5 s.
3. **Final (after 13:00).** Build `freeze-1300` locally (heavy slot from the conductor, MemoryMax cap, temp under `~/.cache/lead-submission/`), serve it on a local port, then re-run the same recorder against it. Re-check every must-read and refresh the stills in `demo-script.md`.
4. **Host.** YouTube (Unlisted or Public) or Google Drive set to "anyone with the link". Test the link in a private window. Paste it into "Link to Project Demo" in `FORM.md`.
