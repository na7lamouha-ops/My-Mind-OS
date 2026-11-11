# سجل الفريق

> ملف مولَّد من `registry.yaml` — ما تعدّلوش باليد. `python3 .claude/team/team.py table`

كل مهمة عندها **مولى واحد**. قبل ما نزيدو وكيل: `team.py who "..."`.

## فريق الفيديو — إنتاج فيديوهات الدورة والإعلانات (المخرج: سكيل edprod)

| الوكيل | الدور | المهام اللي يملكها | ما يديرهاش (يعطيها لـ) | تزاد | علاش |
|---|---|---|---|---|---|
| `edprod-writer` | كاتب السكريبت بالدارجة | `video.script`, `video.hook-copy` | video.facts→edprod-researcher, video.render-motion→edprod-motion, product.cod-strategy→cod-strategist | 2026-11-01 | سكريبت لقطة بلقطة قبل أي رندر |
| `edprod-researcher` | مدقّق الحقائق والأرقام | `video.facts` | video.script→edprod-writer | 2026-11-01 | كل معلومة تاريخية أو رقم يتأكد قبل ما يطلع في الشاشة |
| `edprod-designer` | المدير الفني: البريف والإحداثيات | `video.visual-brief` | video.render-motion→edprod-motion | 2026-11-01 | تخطيط كل مشهد بالبيكسل وفحص المنطقة الآمنة |
| `edprod-motion` | مهندس الحركة والرندر | `video.render-motion`, `video.opener` | video.sound→edprod-sound, course.lesson-edit→course-editor, video.qc-export→edprod-reviewer | 2026-11-01 | تحريك البوسترات واللوقوات والافتتاحيات بالكود |
| `edprod-sound` | مصمم الصوت | `video.sound` | course.audio-clean→course-editor | 2026-11-01 | موسيقى ومؤثرات وميكساج -14 LUFS |
| `edprod-reviewer` | المراقب والتصدير | `video.qc-export` | video.render-motion→edprod-motion | 2026-11-01 | ما يخرج حتى فيديو بلا فحص |

## فريق الدورة — تركيب الدروس من التسجيلات الحقيقية

| الوكيل | الدور | المهام اللي يملكها | ما يديرهاش (يعطيها لـ) | تزاد | علاش |
|---|---|---|---|---|---|
| `course-editor` | مونتير الدروس: كاميرا + شاشة على ديزاين الدورة | `course.lesson-edit`, `course.sync`, `course.audio-clean`, `course.captions` | video.opener→edprod-motion, video.qc-export→edprod-reviewer, video.script→edprod-writer | 2026-11-11 | الدروس تتسجل بالكاميرا والشاشة وتتركب بـ course_layout.py — تسجيلات حقيقية برك، بلا أفتار |

## فريق البيزنس — تسيير، الإعلانات، اختيار المنتجات

| الوكيل | الدور | المهام اللي يملكها | ما يديرهاش (يعطيها لـ) | تزاد | علاش |
|---|---|---|---|---|---|
| `tassyir-ops` | مسيّر تسيير: كومندات، ستوك، منتجات، أرقام | `store.orders`, `store.products-stock`, `store.finance-report` | ads.analysis→ads-analyst, product.cod-strategy→cod-strategist | 2026-11-11 | خدمة يومية على تسيير، يقرا بحرية وما يبدّل والو بلا موافقة صاحب البيزنس |
| `ads-analyst` | محلل إعلانات Meta | `ads.analysis`, `ads.changes` | product.cod-strategy→cod-strategist, video.script→edprod-writer, store.finance-report→tassyir-ops | 2026-11-11 | قراءة الحملات، CPL، وين يروح الدراهم — وأي تبديل في الإعلانات بموافقة برك |
| `cod-strategist` | إستراتيجي المنتج COD | `product.cod-strategy`, `product.confirm-script` | ads.analysis→ads-analyst, video.script→edprod-writer | 2026-11-11 | منتج -> زاوية، عرض، Max CPL، خطة تاست، سكريبت التأكيد |

## إدارة الفريق نفسه — السجل والتوظيف

| الوكيل | الدور | المهام اللي يملكها | ما يديرهاش (يعطيها لـ) | تزاد | علاش |
|---|---|---|---|---|---|
| `team-manager` | مسؤول الفريق: السجل والتوظيف | `team.registry`, `team.hire` | — | 2026-11-11 | باش ما يكونوش جوج وكلاء يديرو نفس المهمة |

## فهرس المهام

| المهمة | المولى |
|---|---|
| `ads.analysis` | `ads-analyst` |
| `ads.changes` | `ads-analyst` |
| `course.audio-clean` | `course-editor` |
| `course.captions` | `course-editor` |
| `course.lesson-edit` | `course-editor` |
| `course.sync` | `course-editor` |
| `product.cod-strategy` | `cod-strategist` |
| `product.confirm-script` | `cod-strategist` |
| `store.finance-report` | `tassyir-ops` |
| `store.orders` | `tassyir-ops` |
| `store.products-stock` | `tassyir-ops` |
| `team.hire` | `team-manager` |
| `team.registry` | `team-manager` |
| `video.facts` | `edprod-researcher` |
| `video.hook-copy` | `edprod-writer` |
| `video.opener` | `edprod-motion` |
| `video.qc-export` | `edprod-reviewer` |
| `video.render-motion` | `edprod-motion` |
| `video.script` | `edprod-writer` |
| `video.sound` | `edprod-sound` |
| `video.visual-brief` | `edprod-designer` |
