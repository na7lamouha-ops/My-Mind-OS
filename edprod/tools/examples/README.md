# EDPROD · أمثلة حقيقية (السكريبتات اللي خرّجنا بيها الفيديوهات)
كل سكريبت يقبل المسارات كـ arguments (شوف الـ docstring في أولو).

| الملف | الفيديو | الأصول |
|---|---|---|
| `match_static_poster.py` | «الماتش»: البوستر ثابت، الكرة تتلعب، الشارة C، X أحمر | `assets/posters/match-poster.png`، الخطوط |
| `match_real_crowd_sound.py` | صوت «الماتش» بالجمهور الحقيقي CC0 | `assets/audio/crowd` (حوّلهم لـ raw 48k stereo f32 أولاً، ولا استعمل `edprod_kit.crowd()`) |
| `tactics_board_animatic.py` + `tactics_board_sound.py` | «اندلاع الدورة» الحلقة 01: لوحة تكتيكية beIN | فيديو التيزر v4 (للدخلة والخرجة) |
| `mirror_1954_2026.py` | المراية 1954 ↔ 2026 على صوت hook5 | الطبقات، الرصاصة، الخطوط، `env30.npy` من صوت hook5 |
| `teaser_v4_hook_bullets.py` + `teaser_v4_war_sound.py` | التيزر v4: رصاص، تعمير، طلقة، زووم، انفجار، بطاقات | فيديو التيزر الأصلي `teaser10-916.mp4` (عند صاحب الدورة) |
| `historical_audio_montage.py` | تقطيع صوت hook5 على سيناريو آخر بانتقالات ناعمة | صوت hook5 + stem مؤثرات |
| `../bullet_sprite.py` | رصاصة واقعية محفورة بأي اسم: `python3 bullet_sprite.py out.png "ECOMMANITA"` | — |
