# ecom manita 0.4.4 (client MAC) — واش تبدّل على 0.3.9

> تكملة لـ `ECOM_MANITA_STRUCTURE.md`. الزيب فيه 138 فيشي (19 Mo)، والدوسي الرئيسي ولّا اسمو `ecomanita/` (كان `ecom-manita/`).
> الهيكلة الكبيرة هي هي: `bureau/` (المكتب الأوتوماتيكي) + `outils/` (Python) + `plugin/` (الأجون اليدويين).
> الجديد: طبقة **قواعد مركزية** و**عقل حسابات** واحد، ووكيل جديد **المفتّش**، و**ممر « تيست »** بأربع créas.

## 1. الهيكلة الجديدة

```
ecomanita/
├── bureau/                      المكتب (Node, :4620)
│   ├── regles.json        🆕   ملف القواعد الوحيد: كل الوكلاء يقراوه، حتى واحد ما ينسخو
│   ├── regles-masar.mjs   🆕   القواعد الصغار تاع "المسار" (13 دالة، 26 كونترول)
│   ├── boussala/          🆕   العقل الوحيد تاع الأرقام (البوصلة 29.18)
│   │   ├── engine/              boussala-engine, testweek, testads, treasury, doors, triage, coach, manager…
│   │   ├── adapters/            tassyir-map.js, tools.js
│   │   ├── agent/               SYSTEM_PROMPT.md, LEVERS.md
│   │   ├── tests/golden-v29.json   6 حالات مرجعية: إذا ما نجحوش 6/6 العقل "absent" وكل حساب يتحبس
│   │   ├── pont.mjs             الجسر ESM ← CommonJS
│   │   └── verdict.mjs          حكم التيست بالـ CLI (للوضع اليدوي)
│   ├── inspecteur.mjs     🆕   المفتّش: فحص حساب تسيير قبل أي تيست
│   ├── controles-suivi.mjs 🆕  4 كونترولات قبل الحكم (ميتا ↔ تسيير)
│   ├── portes.mjs         🆕   باب السكايل + الستوك الباقي
│   ├── bibliotheque.mjs   🆕   مكتبة الكرياتيف: فيش لكل فيديو + نتائجو
│   ├── verifier-1.0.mjs   🆕   épreuve تاع "الطالب 1.0" (10 تصليحات)
│   ├── verifier-tester.mjs 🆕  épreuve تاع ممر "تيست" (4 créas، ABO/CBO)
│   ├── skills/inspecteur/ 🆕
│   ├── web/  stade.html, stade-onglet.js, manette.css/js 🆕  (ثيم "manette" داكن + ستاد في الخلفية)
│   └── (حذف) boussole/calcul.js, web/guide-ecran.js, installer/dns-cloudflare.ps1
├── outils/1-EDITEUR/QUATRE-CREAS.py  🆕  4 créas من فيديوات واجدة (تتبدّل غير الموسيقى)
├── plugin/ecom-manita/skills/
│   ├── inspecteur/    🆕  /ecom-manita:inspecteur
│   ├── confirmation/  🆕  /ecom-manita:confirmation  (تقرير التأكيد)
│   └── dourahem/      🆕  /ecom-manita:dourahem      (الربح الحقيقي + الستوك الباقي)
└── catalogue-trello-drive/  🆕
    ├── extension-catalogue-trello.zip   إكستونسيون Chrome: Instagram/TikTok/Facebook ← Trello ← Drive
    └── apps-script-ecomanita-drive.gs   Google Apps Script يرتّب الفيديوات في Drive/ecomanita catalogue/MOD-xxx
```

(حذف من الجذر: `METTRE-DNS-CLOUDFLARE.cmd` و `ANNULER-DNS-CLOUDFLARE.cmd`.)

## 2. الأورغانيغرام (`bureau.json` v0.4.4)

القسم السادس الجديد:

| القسم | البوسطات | الدور |
| --- | --- | --- |
| editeur | trieur · monteur · photographe · verif-editeur | ما تبدّلش |
| page | sku · redacteur · brouillon | ما تبدّلش |
| testing | porte · campagne · textes · surveillance | + ممر « تيست » (ABO/CBO) |
| scaling | classement · audiences · budget | الباب ولّا في `portes.mjs` |
| coach | rapport · porte-scaling · questions · decisions | الحكم من البوصلة |
| **inspecteur** 🆕 | **lecture · devoirs · porte** | فحص الحساب، نقطة على 100، باب « جاهز للتاست » |

## 3. السلسلة: واش تبدّل

المراحل الـ 19 هوما هوما (`ETAPES`). التبديلات:

1. **مرحلة 0 جديدة قبل كلش: المفتّش.** الكليان يكتب « افحص حسابي ». يسقسي: « عندك طلبيات في تسيير ؟ » (مازال ما بديت · بديت جديد · عندي طلبيات من قبل).
   - Claude يقرا تسيير بالقراءة برك (قرابة 20 أداة).
   - الكود هو لي يحسب النقطة: أخضر = 1، برتقالي = 0.5، أحمر = 0.
   - يعطي واجب واحد في المرة، وإذا الحساب "ينزف" يبدا بالإنقاذ.
   - **الباب « جاهز للتاست »** لازم يتفتح قبل أي بوب.
2. **ممر « تيست » في المونتاج (05):**
   - إذا عند الكليان فيديوات واجدين، `QUATRE-CREAS.py` يعطي 4 créas: الأصلية، وكوبيات تتبدّل فيهم الموسيقى برك (`-c:v copy`).
   - ولا المونتاج العادي بـ `MONTER-10.py`.
3. **البودجي (14):** زوج بوتونات **ABO / CBO**.
   - ABO: ad set لكل فيديو، 7 $ ولا 5 $.
   - CBO: ad set واحد، والبودجي على الكامباني.
   - إذا البودجي ما يكفيش، والو ما يتخلق.
4. **الحكم:** ما بقاش « النهار الثالث ». الحكم يجي من **البوصلة** (`boussala_testweek` + التوقف المبكر تاع `test_ads`) عبر `pont.mjs › verdictProduit`.
5. **قبل الحكم: 4 كونترولات** (`controles-suivi.mjs`). كل واحد يرجّع لون:

   | الكونترول | الحالة | اللون |
   | --- | --- | --- |
   | إعلان يصرف وما يجيبش حتى زيارة في تسيير | الرابط المخبّي ناقص | 🔴 |
   | طلبيات بلا تيكي (`(not set)`) | فوق 10 % | 🟡 |
   | دبونس ميتا ≠ دبونس تسيير | فرق فوق 5 % | 🔴 |
   | أشاتات ميتا ≠ طلبيات تسيير | عدد مختلف | 🟡 |
   | `{{campaign.id}}` مكتوب كيما هو | الرابط ما تبدّلش | 🔴 |

   **عمرك ما تحكم بالبيكسل**: الحكم يكون على الـ confirmées تاع تسيير.
6. **مكتبة الكرياتيف** (`bibliotheque.mjs`): كل فيديو عندو فيش (المانكان، اللون، الأنغل، الأكروش، الموسيقى)، ونتائجو تتقرا بعد 72 ساعة ومن بعد كل سمانة.
   - فيديو تحت 15 lead ما تقاسش.
   - علامة ما تولّيش قاعدة حتى تكون فيها 5 فيديوات مقاسين.
   - الحكم بالتكلفة على كل confirmée (TEST) ولا على كل livrée (VALIDE).
7. **باب السكايل** (`portes.mjs`): 4 شروط، وكارطة تتبعث للكليان، ومن بعد يستنى « نعم ».
   - الستوك الباقي ديما يتبيّن مع الربح: بسعر الشراء، بأيام التغطية، وبالكاش الصافي.
   - تحت 30 يوم تغطية: STOP commande. فوق 45 يوم: destock. خطوة السكايل 25 %.

## 4. `regles.json`: القواعد ولّاو في بلاصة وحدة

- **argent**: الدولار هو تاع الكليان برك، ما كاينش taux مكتوب في الكود. المبالغ تتكتب بالدينار والدولار، والكبار بالـ « مليون ».
- **definitions**:
  - taux confirmation و taux livraison بنفس التعريف تاع تسيير.
  - الربح يتحسب على المليفريين برك.
  - الكرياتيف الرابح هو لي عندو أرخص تكلفة على كل confirmée (`utm_content`)، ماشي على الأشاتات تاع البيكسل.
- **pertes**: جدول واحد برك، تاع البوصلة.
- **motMontee**: « طلّع ».
- **interdits**: COD، الشهادات المزيّفة، السعر المشطوب، رقم داخل سطر عربي، الوعود، الكلمات المغربية.

## 5. ملاحظات

- **الأرقام تاع الفيرسيونات ما تتطابقش:** `bureau.json` و `plugin.json` فيهم 0.4.4، `regles.json` فيه 0.4.2، و `regles-masar.mjs` و `pont.mjs` فيهم « 0.5.0 ». الزيب نتاع Mac بصح فيه حتى `INSTALLER-WINDOWS.bat`.
- **الإكستونسيون `Catalogue → Trello`** تطلب صلاحيات واسعة: `<all_urls>`، `cookies`، `declarativeNetRequestWithHostAccess`، `downloads`.
  - تخدم بالسيسيونات المفتوحة تاع Trello و Instagram و Google في Chrome.
  - فيها `tiktok-hook.js` لي يتحقن في الصفحة (`world: MAIN`) و ffmpeg.wasm (32 Mo) باش تحمّل الفيديوات HD.
  - ركّبها غير إذا تثيق في المصدر، وفي بروفيل Chrome خاص بيها.
  - `QUATRE-CREAS.py` يقول بلي الفيديوات لازم تكون تاع التاجر روحو، ولا تاع بروفيل عطاه الموافقة.
- `verifier.mjs` ولّا يعيّط زوج épreuves جداد (`verifier-1.0`, `verifier-tester`) بمعطيات مخترعة. ما يمسّش ميتا ولا تسيير.
