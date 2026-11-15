# AI usage declaration (form field "Use of Super Intelligence (SI)")

> **DRAFT — pending approval.** Rules: 2026 Project Submission Guide. SI is allowed, but it must not be used to come up with the idea. Code and data need an acknowledgement in descriptive text and in metadata. Images and video need a visible watermark. Audio needs an acknowledgement in text and in metadata. Generated content must not use NASA branding. The form answer is not shown to judges, but the acknowledgements inside the project are.

[TO CONFIRM WITH LUCAS: (1) the tool list; (2) that the idea and method doc (v3/v4) was written by the team; (3) whether the demo VO is a human voice or TTS]

> Yes. We used AI coding assistants (Anthropic Claude via Claude Code, Cognition Devin, OpenAI Codex/GPT) under human direction. They helped write and review code for the data pipeline and the web app, and drafted documentation and submission text. The team wrote the idea and the method — the Tipping Point Index, the choice of NASA datasets, and the replay and radar flood-candidate design — in our own project document before any AI-assisted build, and every data source, threshold and reported number was reviewed by the team. The AI use is acknowledged in descriptive text in both repository READMEs ("Use of AI") and in commit metadata (Co-Authored-By trailers). No AI-generated images, video or audio appear in the project or the demo; the demo is a screen recording of the real app with a human voiceover.

If the VO is TTS, replace the last sentence with: "The demo voiceover is AI-generated text-to-speech; this is stated in the video description and in the file's metadata (title/comment tag)." Then add the same line to the video description and run `ffmpeg -metadata comment="Voiceover: AI-generated text-to-speech"`.

Where the acknowledgements live:
- This repo: README → "Use of AI". Commit trailers (`Co-Authored-By: Claude …`) are the metadata.
- Data repo: `tipping-point-data` README needs the same line (asked of lead-analysis).
- Demo video: no SI images or video, so no watermark is needed. App screens only.
