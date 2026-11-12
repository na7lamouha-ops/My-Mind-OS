# PROMPT 01: تجهيز الأدوات (مرة وحدة)

> افتح Claude Code (Desktop ← Code ← Local ← اختار مجلد `AI Video Editor`) والصق:

```
You are my video-editing engineer. This folder is my editing studio.
Set it up so you can edit my reels end to end. Do every step yourself, verify each one, and report at the end in Algerian Arabic (darija) what's installed and what failed.

1. Make sure these folders exist: "Raw Footage", "References", "Exports", "Voice", "Scripts".
2. Check/install these tools (use the right package manager for my OS: brew on macOS, winget/choco on Windows):
   - Node.js 20+ and npm
   - FFmpeg (cutting, silence removal, export)
   - yt-dlp (downloading my reference videos)
   - Whisper for word-level timestamps: install `openai-whisper` (pip) or `whisper.cpp`; download the "small" model and test it on a 5-second Arabic audio.
   - Remotion: copy the `reel-studio` project from my repo My-Mind-OS/content-studio/reel-studio into this folder and run `npm install`, then render the still: `node render.mjs ep01-marge --still 300`.
   - HyperFrames (optional, for motion-graphics templates) if it installs cleanly; skip it if not.
3. Create a file STUDIO.md describing the pipeline, the tools, and the exact commands, so future sessions read it first.
Don't ask me questions unless something needs a password or a paid account.
```
