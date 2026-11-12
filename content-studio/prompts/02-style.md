# PROMPT 02: تعلّم ذوقي (مرة وحدة لكل حساب)

> اختار 3 حتى 5 ريلات يعجبوك **بنفس الأسلوب**. حط الروابط في البلاصة تحت.

```
Download these reference reels into "References" with yt-dlp:
<LINK 1>
<LINK 2>
<LINK 3>

For each one, extract frames every 0.5s (ffmpeg) and transcribe it (Whisper, word timestamps). Then study, with numbers:
- pace: words per second, longest pause, number of cuts, where the pattern interrupt happens (in % of duration)
- structure: hook (first 3s), promise, steps/chapters, recap, CTA, open loop
- captions: words per chunk, position, font weight, highlight rule (which word gets highlighted and why)
- layout: where title / visual / captions / avatar sit; safe zones
- motion: how elements enter (spring, slide, scale), how often something new appears
- sound: music presence, loudness (ebur128), sound effects

Write STYLE.md with: the rules you extracted, the numbers, and a "do / don't" list.
IMPORTANT: be inspired, don't copy. Never reuse their avatar, colours, fonts, catchphrases or logo.
My brand is in reel-studio/src/theme.ts (Boussoula: black #0b0a10 + gold #F5C542, Aref Ruqaa for accent line, compass mascot).
Finally, update reel-studio's defaults (pace, caption chunking, timings) to match STYLE.md, and render a still to show me.
```
