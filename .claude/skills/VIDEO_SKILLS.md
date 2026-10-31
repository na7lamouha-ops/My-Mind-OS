# مهارات الفيديو والمونتاج (Video Skills)

مهارات منسوخة (vendored) داخل المشروع. Claude Code يكتشفها أوتوماتيكياً من `.claude/skills/`.

| المهارة | المصدر | الرخصة | الإصدار |
|---|---|---|---|
| `video-use` | [browser-use/video-use](https://github.com/browser-use/video-use) | MIT | `43cfc56` |
| `video-editing`, `auto-cut`, `hook-overlay`, `captions`, `audio-polish`, `loops-gifs-stickers`, `render-qc`, `youtube-publish` | [zaddy99999/video-editing-skills](https://github.com/zaddy99999/video-editing-skills) | MIT | `e638f9f` |
| `remotion-best-practices`, `remotion-captions`, `remotion-create`, `remotion-render`, `remotion-multimedia`, `remotion-studio`, `remotion-docs` | [remotion-dev/skills](https://github.com/remotion-dev/skills) | Remotion License (مجاني لـ ≤3 أشخاص) | `30d4553` |

## التنصيب على جهازك (مرة وحدة)

1. ثبّت FFmpeg و Node.js 22+ و Python 3.10+.
2. من جذر المشروع:

```bash
cd .claude/skills && npm install
```

```bash
pip install requests librosa matplotlib pillow numpy faster-whisper
```

3. **video-use** يحتاج مفتاح ElevenLabs (للتفريغ الصوتي Scribe). انسخ `.claude/skills/video-use/.env.example` إلى `.env` في نفس المجلد وحط فيه `ELEVENLABS_API_KEY=...`. الملف `.env` مستثنى من git.
   - بلا مفتاح؟ استعمل مهارة `captions` (faster-whisper محلي ومجاني).
4. (اختياري) خادم FFmpeg MCP:

```bash
claude mcp add ffmpeg -- uvx ffmpeg-mcp-lite
```

## الاستعمال

حط الفيديوهات في أي مجلد، افتح Claude Code وقول مثلاً:

- "قص هاد الفيديو لريلز 9:16، حط hook فالبداية وكابشن بالدارجة" ← `video-editing` / `video-use`
- "دير كابشن متحرك بـ Remotion" ← `remotion-captions`
- "افحص الجودة قبل النشر" ← `render-qc`

المخرجات تروح لـ `<مجلد الفيديوهات>/edit/`، وما تتكتبش داخل مجلد المهارة.
