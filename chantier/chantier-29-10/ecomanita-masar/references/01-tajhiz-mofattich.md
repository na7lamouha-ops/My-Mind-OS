# المرحلة 0 · تجهيز الحساب + المفتّش (النسخة 1.3)

**المهمة:** يقرا حساب تسيير مرة وحدة، يعطي نقطة من 100 وإشارة على كل خطأ بالنزيف تاعو (`01b-isharat-mofattich.md`)، ونصيحة وحدة في المرة. **ما يحبسش حتى خطوة:** يقول رأيو، والقرار للتاجر.

## 1. واش يقرا (بالترتيب، قراءة برك)
`list_stores` · `get_store` · `list_products` + `get_product` · `list_product_tags` · `list_offers` · `list_delivery_agents` · `list_delivery_fees` · `list_custom_statuses` · `list_employees` · `list_expenses` · `get_finance_summary` · `list_finance_transactions` · `get_analytics_overview` · `get_inventory` · `get_variant_analytics` · `list_orders` (status pending، الأحدث أولاً) · `get_utm_analytics` · `get_marketing_analytics` (بلا storeId، مدة قصيرة) · `list_returns` · `list_order_tracking`.

مرّر القراءة لـ `boussala_onboard` (و`boussala_manette` للمستوى 0) باش تاخذ الإشارات والنقائص بنفس المحرّك.

## 2. الإنقاذ قبل الأسئلة (إذا الحساب ينزف)
إشارات النزيف: طلبيات مستنية أكثر من 48 ساعة بلا اتصال · رواجع ما تعالجتش (الستوك يولّي سالب) · قبض 0 مسجّل ورصيد كبير «عند شركة التوصيل» · إعلان يصرف بلا ليد · مقاس رابح خلاص وعليه إعلان.

التقرير يجي هكا:
1. **النزيف بالدينار في الأسبوع** (تقدير مكتوب بلي تقدير).
2. **السبب الجذري كسلسلة** (مثلاً: وحدك ← أول اتصال بعد 5 ساعات ← تأكيد 42% ← الإعلان يبان خاسر وهو ماشي).
3. **اليوم: 3 حوايج برك.** ومن بعد: هذا الأسبوع، الجذر أولاً.

## 3. الفحوص
**النقطة:** أخضر = 1، برتقالي = 0.5، أحمر = 0، على الفحوص المقروءة (`scripts/masar.js noteInspecteur`). **ما كانش باب:** الأحمر والمجهول يبانو في «رأيي» (نصلّحو قبل أول دينار، ولا نلانسيو بالخطر) والتاجر يختار. الإشارات بالكلمة في `01b-isharat-mofattich.md`.

| # | الفحص | منين | الأحمر 🔴 / البرتقالي 🟠 | وين يصلّحو التاجر |
|---|---|---|---|---|
| 1 | 4 محافظ: المدفوعات، السلعة، الإعلان، الاحتياط | سؤال | 🔴 مجهول حتى يجاوب | Finance ← Wallets ← New wallet |
| 2 | سعر الدولار تاع التاجر | سؤال | 🔴 مجهول حتى يجاوب | Finance ← Costs ← Your exchange rates ← Update |
| 3 | البيكسل رقم صحيح | `get_store` | 🔴 فارغ ولا ماشي رقم | Settings ← Pixels & Tracking ← Meta |
| 4 | CAPI (توكن الكونفرسيون) | `get_store` | 🟠 | Settings ← Pixels & Tracking ← Meta |
| 5 | شركة توصيل مربوطة | `list_delivery_agents` | 🔴 | Delivery & Shipping ← Add Delivery Agent |
| 6 | شركة توصيل افتراضية للمتجر | `get_store` | 🟠 | Stores ← Settings ← Delivery agent |
| 7 | أسعار التوصيل من شبكة الشركة، حتى ولاية بـ0 دج | `list_delivery_fees` | 🟠 | Delivery & Shipping ← Delivery Pricing |
| 8 | **سعر الروتور يكتبو التاجر**، ويطابق تسيير | `get_variant_analytics` + سؤال | 🔴 ناقص ولا ما يطابقش | معدلات الاسترجاع (عرض الشركة) |
| 9 | ثمن الشراء لكل متغيّر | `list_finance_transactions` (INVENTORY) + `get_variant_analytics` | 🔴 | Finance ← Report ← «Add buy prices» (ولا Inventory ← Add Stock) |
| 10 | التغليف | `get_product` | 🟠 | Inventory ← Packaging ← Add Packaging |
| 11 | SKU لكل متغيّر بصيغة وحدة `متجر-موديل-لون-مقاس` | `get_product` | 🟠 (⚠️ إذا الستوك عند شركة التوصيل، سقسيها قبل التبديل) | Products ← Edit ← Variants ← SKU |
| 12 | الستوك متّبع | `get_product` / `get_inventory` | 🟠 | Products ← Edit ← Inventory ← Track |
| 13 | أول لون = لون الصورة · صورة لكل لون | `get_product` | 🟠 | Products ← Edit ← Variants / Media |
| 14 | مؤكّد واحد على الأقل، والتوزيع ما يبعثش للغايب | `list_employees` | 🔴 | Team ← Order distribution |
| 15 | سلّم المكالمات (APPEL × JOUR) يتسكّر بسبب | `list_custom_statuses` | 🟠 | Settings ← Status customization |
| 16 | سبب الإلغاء مفروض | `list_custom_statuses` + `list_orders` | 🟠 | Settings ← Status customization ← Cancel reasons ← «Require a reason when cancelling» |
| 17 | طلبيات مستنية أكثر من 48 ساعة | `list_orders` (pending) | 🔴 | Orders ← Pending |
| 18 | ضغط: مؤكّد عندو طلبيات مفتوحة بزاف | `list_orders` | 🟠 | Team ← Order distribution |
| 19 | أسباب الروتور `#R-01…10` | `list_returns` + التعليقات | 🔴 **غير إذا كاين روتور بلا سبب**. متجر بلا روتور = يفوت | تعليق الطلبية |
| 20 | الرواجع معالجة · القبض مسجّل | `list_returns` + `get_finance_summary` | 🔴 | Tracking ← Returns ← To process · Finance ← Report ← «Set up payout tracking» |
| 21 | وتيرة سحب شركة التوصيل (العرض مقابل الواقع) | `list_finance_transactions` | 🟠 | Finance ← Report ← «Set up payout tracking» |
| 22 | التتبّع: 80% من الطلبيات بالمصدر | `get_utm_analytics` | 🔴 من بعد 20 طلبية | روابط الإعلانات (الرابط المخفي) |
| 23 | صرف الإعلان يبان في تسيير (مربوط بمحفظة الإعلان) | `get_marketing_analytics` | 🟠 | Finance ← Wallets ← «Ad spend deductions» |
| 24 | المصاريف الثابتة مسجّلة | `list_expenses` | 🟠 | Finance ← Costs ← Add expense |
| 25 | عرض (قطعتين ولا سعر أغلى) واجد | `list_offers` | ⚪ معلومة | Marketing ← Offers |
| 26 | الهدف | سؤال | ماشي أحمر: «بلا هدف» تفوت، والبوصلة تعطي الوجهة | — |

## 4. الواجب
- واحد برك في الرسالة، بالـ4 أسطر.
- **«نديرها أنا؟»** كي الكونيكتور يقدر يكتبها: قول التبديل، استنى «نعم»، اكتب، عاود اقرا.
- اللي يديرو التاجر برك (المحافظ، الربط الإعلاني، الروتور، التوكن): اشرح وما تديرش.
- «كمّلت» ← عاود الفحص تاع النقطة هذي برك، ومن بعد الواجب الجاي.

## 5. التقرير: `07-taqarir.md` ← «تقرير المفتّش».
