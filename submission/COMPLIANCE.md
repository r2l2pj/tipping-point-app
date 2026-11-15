# Compliance sweep: 2026 Space Apps rules (win-odds #1)

Checked 2026-11-15 ~09:30 BRT by lead-submission. Rules come from the official 2026 Project Submission Guide and the Judging & Awards Guide (https://www.spaceappschallenge.org/resources/project-submission-guide/). Any ✗ makes the project ineligible for Global Judging or breaks a stated rule.

| # | Rule | Status | Proof / what is left |
|---|---|---|---|
| a | Demo video ≤ 30 s, English (subtitles if not) | ✓ rough cut / ☐ final | `ffprobe` on `.crew/video/rough-cut-v1.mp4` = 29.500 s. Subtitles are burned in from `captions.srt`. The final is re-shot from a **local** production build of `freeze-1300` and must be re-measured before upload. |
| b | Slide deck (if linked) ≤ 7 slides, with team name, member names and challenge | ✓ / ☐ names | `pdfinfo .crew/deck/slides.pdf` = 7 pages. Slide 1 shows the challenge, Local Event Florianópolis, and the `[TEAM NAME]` and `[names]` placeholders, which Lucas fills (MORNING.md compliance gate, L42). |
| c | No copyrighted material without permission | ✓ | The news-style stills are gone from the cold open (b9e8325). Video and deck use only our own app screens. The basemap is credited (CARTO, © OpenStreetMap contributors) in FORM §8 and on the map. |
| d | No images, video, audio or likeness of anyone under 18 | ✓ / ☐ VO | No people appear in any shot or slide. The voiceover must be read by an adult team member (Lucas). |
| e | No NASA branding (logos, flags, mission identifiers) in team-made content | ✓ | The deck and video carry mission names as plain text only; there is no logo strip (slide 7 fixed). A grep of the app `src/`, `public/` and the deck HTML for meatball/logo/insignia found nothing. The app's mark is our own mountain glyph. |
| f | SI disclosure: code and data acknowledged in text + metadata; SI images/video watermarked; SI audio declared | ✓ / ☐ Lucas | "Use of AI" is in the app README (b860570) and the data README (fd95af8). It is also in the judge-visible description (`project-page.md`) and the SI field (`ai-declaration.md`). Commit trailers carry the metadata. No SI images or video are used. **Lucas confirms** the tool list, that the idea document was written by the team, and human VO vs TTS. If TTS is used, declare it in the description and in the video file's metadata. |
| g | SI not used to come up with the idea | ☐ Lucas | `ai-declaration.md` says the idea and method come from the team's own document. Only Lucas can confirm this is true. |
| h | At least one NASA data resource | ✓ | 13 NASA datasets (FORM §7). |
| i | References list every external resource (code, text, images, data) | ✓ | FORM §8 lists data, open-source code, services and basemap. Event facts (L36d) cite one official source: Gov RS "SOS Rio Grande do Sul", updated Aug 19, 2025 (478 municipalities, 185 deaths, 581,638 displaced at the peak); the unsourced figures are cut. |
| j | Links public, no login | ✓ | 200 with no auth: `/`, `/alerts`, `/?case=rs_2024`, `/?case=wa_2025&day=-7`, `github.com/r2l2pj/tipping-point-app`. Both repos are PUBLIC. Still open: the video link, once uploaded. Test it in a private window. |
| k | Open source (the challenge asks for it) | ✓ | Both repos carry an Apache-2.0 LICENSE (tipping-point-data; tipping-point-app since lead-app 5daac30, in the freeze-1300 merge). |
| l | All members confirmed at the same Local Event (≤ 6) | ☐ Lucas | Only the team owner can check this. |
| m | All form fields complete, English, both boxes ticked, Submit clicked before **Sun Nov 15 23:59 local** | ☐ Lucas | `FORM.md` + `project-page.md`. Judges see only the last save. |
| n | Public alerts not presented as official warnings | ✓ copy / ☐ app | The copy now says "experimental research product, not official warnings (official: Defesa Civil, SMS 40199)". The app card label belongs to lead-app (Telegram removed, L55). |
| o | Optional: FortiGuard web-filter classification of vercel.app | ☐ Lucas | This is a form on the FortiGuard site. |
