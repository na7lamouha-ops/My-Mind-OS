# Content Studio: مصنع الريلات

تطبيق طريقة rakan.builds («مجلد واحد، 5 أدوات، 3 برومبتات، Claude يمونتي») على حساباتنا، بهوية بوصلة.

| الملف | واش فيه |
|---|---|
| [`01-analyse-reel-rakan.md`](01-analyse-reel-rakan.md) | تحليل خبير للريل: السكريبت كامل، الإلقاء، الميكانيزمات، الهوية البصرية، الأرقام |
| [`02-strategie-2-versions.md`](02-strategie-2-versions.md) | النسخة A (حسابك) + النسخة B (حسابات faceless) + الدورة إلى 8 حلقات + خطة أسبوع 1 |
| [`prompts/`](prompts) | البرومبتات الثلاثة تاعنا: 01 تجهيز، 02 الذوق، 03 المونتاج |
| [`reel-studio/`](reel-studio) | قالب Remotion: JSON يخرج ريل 1080×1920. فيه EP01 جاهز |

## المجلد على جهازك (نصيحة rakan، مطبّقة)
```
AI Video Editor/
├── Raw Footage/   ← الفيديوهات الخام (وجهك)
├── Voice/         ← تسجيلات الصوت (حسابات faceless)
├── References/    ← 3–5 ريلات مرجعية (yt-dlp)
├── Scripts/       ← سكريبتات JSON (حلقة = ملف)
├── Music/         ← موسيقى خلفية
├── Exports/       ← النهائي
└── reel-studio/   ← هذا القالب
```
ثم: Claude Desktop، ثم Code، ثم **Local**، ثم اختار المجلد، ثم الصق `prompts/01-setup.md`.

## تشغيل القالب
```bash
cd reel-studio
npm install
npm run studio                 # معاينة حيّة في المتصفح، تبدّل الـ JSON وتشوف
node render.mjs ep01-marge     # يخرج out/ep01-marge.mp4
node render.mjs ep01-marge --still 300   # صورة (للكاروسيل)
```
حلقة جديدة: انسخ `scripts/ep01-marge.json`، بدّل `id` والمشاهد، وزيدها في `src/Root.tsx`.

**صيغة المشهد:** `chapter`, `progress`, `title1` (عريض)، `title2` (خط الرقعة الذهبي)، `visual` (`equation | checklist | funnel | countUp | versus | keyword | card`)، `say` (الكلام، والكلمة بين `*نجوم*` تتلوّن)، `interrupt` (شاشة ذهبية)، `mascot` (`talk | think | wink`)، `duration` (اختياري، وإلا يتحسب من عدد الكلمات بسرعة 2.6 كلمة/ثانية).

صوت: حط `voice.mp3` في `reel-studio/public/` وزيد `"voiceover": "voice.mp3"` في الـ JSON (و `"music"` للموسيقى).
