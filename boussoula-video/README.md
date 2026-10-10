# فيديو بوصلة التاجر — لينا ضد إلياس

مصدر الفيديو (1080×1920، 36 ثانية، 30 صورة/ثانية). الفيديو نفسو (MP4) ماشي هنا — يتعاود يتولّد من هاذ الملفات.

- `anim.html`: الأنيميشن كامل، `render(t)` يرسم أي لحظة (t بالثواني).
- `render.js`: يصوّر كل الصور بـ Playwright: `node render.js anim.html frames 30`
- الصوت: `ffmpeg -f lavfi -i "aevalsrc='$(cat audio-expr.txt)':s=44100:d=36" -c:a aac audio.m4a`
- التجميع: `ffmpeg -framerate 30 -i frames/f%05d.jpg -i audio.m4a -c:v libx264 -crf 19 -pix_fmt yuv420p -movflags +faststart -shortest out.mp4`

بدّل النصوص والأرقام في مصفوفة `D` داخل `anim.html`.
