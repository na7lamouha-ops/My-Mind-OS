# تفكيك ecom manita v0.3.9 (Windows) — الهيكلة الصحيحة

> تحليل لملف `ecom-manita-v0.3.9-windows.zip` (89 ملف، ~51 000 سطر كود).
> هذا المستند خريطة فقط، الكود ما تنسخش للريبو.

## 1. الفكرة العامة

النظام فيه **3 طبقات** مستقلة، وكل وحدة تخدم بطريقة:

| الطبقة | المجلد | واش هي | شكون يشغّلها |
| --- | --- | --- | --- |
| **المكتب الأوتوماتيكي** | `bureau/` | سيرفر Node محلي (`localhost:4620`) + روبو Telegram، يشغّل Claude Code headless (`claude -p`) على اشتراك الكليان | السيرفر وحدو (أوتوماتيك) |
| **الأدوات (بلا توكن)** | `outils/` | سكريبتات Python تحسب، تمونتي، تتحقق: صفر AI | المكتب (`travaux.mjs`) ولا الأجون |
| **الأجون اليدويين** | `plugin/` | Plugin تاع Claude Code: كل أجون skill (`/ecom-manita:xxx`) في محادثة وحدو | الكليان بيدو |

```
                     ┌──────────── Telegram (الريسيبسيون) ────────────┐
   لينك Drive  ───▶  │ accueil.mjs  (الأسئلة بالبوتونات)              │
                     └───────────────┬────────────────────────────────┘
                                     ▼
 ┌──────────────────────── bureau/serveur.mjs (HTTP :4620) ─────────────────────────┐
 │  missions.mjs  (السلسلة: 19 مرحلة لكل موديل، الحالة في mission.json)            │
 │     ├── travaux.mjs ──▶ outils/*.py   (Python: مونتاج، حسابات، SKU …)           │
 │     ├── moteur.mjs  ──▶ claude -p     (تور Claude، أدوات مغلقة، JSON إجباري)    │
 │     │      ├── routeur.mjs   (يختار القسم/البوست + يركّب الـ system prompt)       │
 │     │      └── controles.mjs (3 كونترولات: outil / source / auditeur)            │
 │     ├── depot.mjs   (tunnel cloudflared ولا R2 باش ميتا تدّي الفيديو)            │
 │     ├── meta-mcp.mjs (سيرفر MCP محلي لميتا بالتوكن، بديل للكونيكتور)             │
 │     └── carnet.mjs  (الذاكرة: نوطات Markdown + قياسات JSON)                     │
 │  routines.mjs (مهام بالساعة) · spy.mjs (spy dz) · messages.mjs (كل نصوص الروبو) │
 └──────────────────────────────────────────────────────────────────────────────────┘
          │ Connecteurs MCP (claude.ai)
          ├── Tassyir  (api.tassyir.io/mcp)   → الصفحة، SKU، الطلبيات
          └── Meta Ads (mcp.facebook.com/ads) → الكامباني، الفيديوات، Ad Library
```

## 2. الهيكل التنظيمي (`bureau/bureau.json`)

هذا هو "الأورغانيغرام" تاع الوكلاء — الملف المرجعي لكلش:

| الدور | id | الـ Skill | أداة Python | Connecteurs | يكتب في |
| --- | --- | --- | --- | --- | --- |
| **المانجر** (المركز) | `manager` | `skills/manager` | — | قراءة | — |
| **الكارني** (الدماغ/الذاكرة) | `carnet` | — | `0-CARNET/manita-carnet.py` | — | — |
| 1. **المونتاج** | `editeur` | `skills/editeur` | `1-EDITEUR/manita.py` | — | — |
| 2. **الصفحة + SKU** | `page` | `skills/page` | `2-PAGE-PRODUIT-SKU/manita-produit.py` | tassyir | tassyir |
| 3. **التيست** | `testing` | `skills/testing` | `3-TESTING/manita-testing.py` | meta | meta |
| 4. **السكالينغ** | `scaling` | `skills/scaling` | `4-SCALING/manita-scaling.py` | meta, tassyir | meta |
| 5. **الكوتش** (الصوت الوحيد) | `coach` | `skills/coach` | `5-COACH-ERP/manita-coach.py` | tassyir | — |
| الريسيبسيون | `telegram` | — | — | — | — |

### البوسطات (sous-agents) داخل كل قسم

- **editeur**: `trieur` (يرتّب الرشز) · `monteur` (10 فيديوات/مانكان) · `photographe` (4-5 تصاور/لون) · `verif-editeur`
- **page**: `sku` · `redacteur` (5 أنغل، وصف متناوب) · `brouillon` (ينشئ وينشر في تسيير)
- **testing**: `porte` (break even قبل الصرف) · `campagne` (EN PAUSE) · `textes` · `surveillance` (72 ساعة)
- **scaling**: `classement` (ربح صافي/كوليس) · `audiences` · `budget` (= الستوك)
- **coach**: `rapport` (5 بلوكات) · `porte-scaling` (5 شروط) · `questions` · `decisions`

## 3. السلسلة (Pipeline) — `bureau/missions.mjs`

مهمة (mission) لكل موديل، 19 مرحلة، 3 أنواع خطوات:
🐍 = أداة Python (0 توكن) · 🤖 = تور Claude (أدوات مغلقة + JSON) · 👤 = قرار الكليان (بوتون Telegram)

| # | المرحلة | النوع | القسم |
| --- | --- | --- | --- |
| 1 | `descente` تحميل Drive | 🐍 | editeur |
| 2 | `separation` فرز الموديلات (lot) | 🐍+🤖 (`separer.py` + Claude يقرا الـ planches) | editeur |
| 3 | `captures` | 🐍 `captures.py` | editeur |
| 4 | `couleurs` أسماء اللونات | 👤 | editeur |
| 5 | `montage` | 🐍 `MONTER-10.py` | editeur |
| 6 | `controle` | 🐍 | editeur |
| 7 | `photos` → تسيير | 🤖 tassyir | page |
| 8 | `textes` (script d'angles) | 🐍/🤖 | page |
| 9 | `paquet` SKU | 🐍 `manita-produit.py` | page |
| 10 | `page` (مخفية) | 🤖 tassyir | page |
| 11 | `page-ok` | 👤 (يشوف التصاور) | page |
| 12 | `publication` | 🤖 | page |
| 13 | `porte` break even | 🐍 `manita-testing.py` | testing |
| 14 | `budget` | 🐍 | testing |
| 15 | `videos` → ميتا | 🤖 meta + `depot.mjs` | testing |
| 16 | `noms` (clé + UTM) | 🐍 | testing |
| 17 | `campagne` EN PAUSE | 🤖 meta | testing |
| 18 | `lance` « لانسي » | 👤 **إجباري** | — |
| 19 | `activation` | 🤖 (porte à usage unique) | testing |
| ∞ | **SUIVI** كل عشية | routines → coach → scaling | coach/scaling |

الحالة تتسجل في `<maison>/missions/<id>/mission.json` (ولا `lots/<id>/lot.json` كي يكون بزاف موديلات) → إذا الـ PC طفا، يكمّل من وين حبس.

## 4. المحرك (Engine) — كيفاش يخدم كل تور Claude

1. **`routeur.mjs`** — تور رخيص يرجّع JSON `{departement, poste, titre, besoin_ok}`.
2. **تركيب الـ system prompt** بترتيب ثابت:
   هوية البوست → SKILL القسم (≤60k حرف) → `REGLES_MAISON` → fiche الكليان → الدروس → نوطات الكارني → شكل الليفرابل.
3. **`moteur.mjs`** — `claude -p` في دوسي فارغ، **بلا أي أداة مدمجة** (لا Bash لا Read لا Write)، غير الكونيكتورات المسموحة. قائمة `JAMAIS` (dispatch، cancel، delete…) ممنوعة ديما.
4. **`controles.mjs`** — 3 كونترولات لكل ليفرابل:
   - **outil**: الشكل (`Sources lues:` + `Contrôle intégré:`، ما كاينش رقم في سطر عربي)
   - **source**: المصادر المذكورة = أدوات MCP تعيّطت فعلا
   - **auditeur**: تور Claude ثاني مستقل يقلّب على الغلطة
   → `PASSE / ECHEC / NON_VERIFIABLE`
5. **قراءة/كتابة**: الكونيكتورات بالقراءة برك أثناء الخدمة؛ الكتابة تتفتح غير بعد « lance » وللأقسام المسموحة (`bureau.json → regle`).

## 5. ملفات `bureau/` واحد بواحد

| الملف | الدور |
| --- | --- |
| `serveur.mjs` | سيرفر HTTP + API (`/api/missions`, `/api/lots`, `/api/reglages`, `/api/carnet`, `/api/routines`, `/api/telegram/*`, `/api/depot/*`, `/api/installation/*`, `/api/guide`…) |
| `missions.mjs` | السلسلة كاملة (5240 سطر — القلب) |
| `moteur.mjs` | تشغيل `claude -p` headless + اكتشاف الكونيكتورات |
| `routeur.mjs` | الراوتينغ + تركيب البرومبت + `REGLES_MAISON` |
| `controles.mjs` | الكونترولات الثلاثة |
| `travaux.mjs` | تشغيل أدوات Python في الخلفية (واحد بواحد، مراقبة بالفيشيات) |
| `accueil.mjs` | الحوار تاع Telegram (الأسئلة بالترتيب) |
| `telegram.mjs` | API تاع الروبو (رسائل، بوتونات، تصاور، ألبومات) |
| `messages.mjs` | كل النصوص لي يقولها الروبو (loi de forme) |
| `carnet.mjs` | الذاكرة (notes + graph `[[liens]]`) |
| `routines.mjs` | مهام مجدولة بالساعة (rapport du soir…) |
| `depot.mjs` | رفع مؤقت: tunnel `cloudflared` ولا R2 |
| `meta-mcp.mjs` | سيرفر MCP محلي لـ Graph API بالتوكن (بلا delete) |
| `spy.mjs` | « spy dz » عبر Telegram |
| `verifier.mjs` | الاختبارات (shim Claude + faux Telegram + mode réel) |
| `web/` | الواجهة (`bureau.js`, `chaine.js`, `guide-ecran.js`) |
| `web-station/` | شاشة "station" |
| `boussole/` | بوصلة التاجر (`calcul.js`) — الحاسبة الوحيدة للدراهم |
| `skills/*/SKILL.md` + `page/SCRIPT-ANGLES-MARKETING.json` | skills الوضع الأوتوماتيكي |
| `installer/` | `installer-windows.ps1`, `installer-mac.sh`, `dns-cloudflare.ps1` |
| `bureau.json` / `config.local.exemple.json` | الأورغانيغرام / الإعدادات المحلية (توكنات) |

## 6. الأجون اليدويين — `plugin/`

```
plugin/
├── .claude-plugin/marketplace.json      ← marketplace "ecom-manita"
└── ecom-manita/
    ├── .claude-plugin/plugin.json       ← plugin v0.3.8
    └── skills/
        ├── manager/     يربط كلش، يقول وين راه كل موديل
        ├── editeur/     المونتاج
        ├── page/        صفحة تسيير
        ├── testing/     تيست ميتا
        ├── scaling/     السكايل
        ├── coach/       التحليل والأسئلة
        ├── spy/         Meta Ad Library (spy_calc.py, modeles.py, capture_modeles.mjs, worker.js + tests/)
        └── engagement/  فيديوات Instagram > 200k vue (spy_engagement.py, signes_vente.py + tests/)
```

> ملاحظة: `spy` و `engagement` كاينين **غير** في الوضع اليدوي (plugin). الوضع الأوتوماتيكي عندو `spy.mjs` لي يعيّط سكريبتات الـ plugin.
> كاين **نسختين** من كل skill: `bureau/skills/*` (للأجون الأوتوماتيكي، "Tu es un Claude NEUF") و `plugin/.../skills/*` (للمحادثة مع الكليان).

## 7. الأدوات — `outils/`

| المجلد | الأداة | الخدمة |
| --- | --- | --- |
| `0-CARNET` | `manita-carnet.py` | ذاكرة البيزنس (المقاس يغلب المصرّح) |
| `1-EDITEUR` | `manita.py`, `separer.py`, `captures.py`, `MONTER-10.py`, `les-70-accroches.md` | فرز، كابتشر، مونتاج 10 فيديوات، 70 accroche |
| `2-PAGE-PRODUIT-SKU` | `manita-produit.py` | باكيج الصفحة + SKU |
| `3-TESTING` | `manita-testing.py` | break even، بودجي، تسمية |
| `4-SCALING` | `manita-scaling.py` | ترتيب الأنغلات، budget = stock |
| `5-COACH-ERP` | `manita-coach.py` | التقرير اليومي، porte du scaling |
| `6-GUIDE` | `manita-guide.py` | يجاوب بالماستركلاس (ما يصنع والو) |

## 8. ملفات الجذر (التنصيب)

`LIS-MOI-DABORD.txt` (اقرا قبل) · `MESSAGE-A-COLLER-DANS-CLAUDE.txt` (برومبت تنصيب من 10 مراحل) · `INSTALLER-WINDOWS.bat` / `INSTALLER-MAC.command` · `METTRE-/ANNULER-DNS-CLOUDFLARE.cmd` · `4-GUIDE-CLOUDFLARE-R2-GRATUIT.pdf`

## 9. القواعد الذهبية لي تحكم كلش

1. كل حاجة في ميتا **تتخلق EN PAUSE**؛ ما يتشعل والو بلا « لانسي ».
2. الأجون الأوتوماتيكي **ما عندوش** Bash/Files/Web — غير الكونيكتورات.
3. حتى رقم دراهم ما يخرج من راس Claude — يخرج من أداة (البوصلة / Python).
4. الـ ROAS يتحسب **غير على الكوليات المليفريين**.
5. حتى ليفرابل ما يوصل للكليان بلا **3 كونترولات**.
6. التوكنات والسيكريات في `config.local.json` برك، عمرهم في الشات ولا في الكارني.
7. الكوتش هو **الصوت الوحيد** لي يهدر مع الكليان؛ المانجر يكوموندي وما يهدرش.
