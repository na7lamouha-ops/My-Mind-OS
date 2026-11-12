# PROMPT 03: المونتاج (كل فيديو)

> حالتين: **(A)** وجهك في `Raw Footage`، أو **(B)** صوت برك في `Voice` على سكريبت JSON.

```
New reel. Read STUDIO.md and STYLE.md first.

Input: <file name> in "Raw Footage" (face cam)  —OR—  <file name> in "Voice" + script <Scripts/epXX.json>

1. Clean audio: remove silences > 0.25s and breaths (ffmpeg silenceremove or cut list), normalize to -14 LUFS, light compression. Keep it natural, no robotic cuts mid-word.
2. Transcribe the cleaned audio with Whisper (word timestamps, language ar). Fix Algerian darija spelling using the script if I gave one.
3. Build/update the JSON script for reel-studio: one scene per idea, each scene's duration taken from the real timestamps, chapters + progress bar, one highlighted *word* per sentence (the word that carries the meaning), one pattern interrupt around 60% of the duration.
   - Face-cam mode: put my video as the background layer of the scene (top 55% of the screen), title above it, captions + visual under it.
   - Voice mode: use the mascot layout as-is.
4. Add a quiet music bed (volume 0.1–0.15) from "Music" if present.
5. Render to "Exports/<id>.mp4" (1080x1920, h264, crf 18) + a 15s cut (hook + key number + CTA) + 3 stills for a carousel.
6. Show me a contact sheet (1 frame / 2s) and list anything you weren't sure about.

Then wait for my notes ("كبّر العنوان", "بدّل الكلمة الملونة"…) and re-render only what changed.
```
