/*!
 * بوصلة التاجر — المانيت 🎮 (MANETTE): لعبة البروسيس في تسيير
 * al-KHALiYA © 2026
 * مبنية على الشاشات الحقيقية تاع تسيير (دراسة صفحة بصفحة، أكتوبر 2026).
 * المستوى 0 = تجهيز الحساب (نقاط + خطوات بالضغطة). المستويات 1→5 = من التاست حتى الوجهة: الهدف كاش (مثلاً 100 مليون) والستوك خالص.
 * كل خطوة فيها: وين تضغط في تسيير، علاش (بالدينار لو نقدرو)، وشكون يصلّح (merchant / tassyir / agent).
 * الوكيل يقرا ويقترح برك — التاجر هو اللي يضغط.
 */
'use strict';
const E = (typeof require === 'function') ? require('./boussala-engine.js') : window.BoussalaEngine;
const m = x => E.mil(x) || E.fmt(x) + ' دج';
const dayMs = 864e5;

// 🗺️ الطريق في تسيير (أسماء الأزرار كما تبان في الواجهة بالإنجليزية)
const P = {
  wallets: 'Finance ← Wallets',
  newWallet: 'Finance ← Wallets ← New wallet',
  adsDeduct: 'Finance ← Wallets ← «Ad spend deductions» (Meta / TikTok)',
  chooseAcc: 'Finance ← Report ← «Missing from this profit» ← Choose account',
  recordHave: 'Finance ← Wallets ← (المحفظة السالبة) ← «Record what you actually have»',
  fx: 'Finance ← Costs ← Your exchange rates ← Update',
  addExpense: 'Finance ← Costs ← Add expense',
  buyPrices: 'Finance ← Report ← «Add buy prices» (ولا Inventory ← Add Stock مع ثمن الشراء)',
  packaging: 'Inventory ← Packaging ← Add Packaging',
  deliveryPricing: 'Delivery & Shipping ← Delivery Pricing',
  payoutSetup: 'Finance ← Report ← «Set up payout tracking»',
  recordCollection: 'Home ← Needs you ← Record collection (غير كي يدخل الكاش فعلاً)',
  locations: 'Settings ← Stock locations',
  statuses: 'Settings ← Status customization',
  cancelReason: 'Settings ← Status customization ← Cancel reasons ← «Require a reason when cancelling»',
  distribution: 'Team ← Order distribution',
  teamPay: 'Team ← Team Members ← Pay',
  spam: 'Settings ← Spam protection',
  apps: 'Apps',
  returns: 'Tracking ← Returns ← To process',
  orders: 'Orders ← Status (فلتر)',
  tracking: 'Tracking ← Active',
  mkt: 'Analytics ← Marketing',
  study: 'Finance ← Product study',
  ab: 'Products ← A/B Testing',
  inventory: 'Inventory ← Products',
  sourcing: 'Sourcing',
};

/**
 * setup = لقطة الحساب (من شاشات تسيير، من أدوات MCP، ولا أجوبة التاجر). كل حقل اختياري: الناقص = «نسقسيو».
 * {
 *   wallets: [{ name, balance, currency }],               // Finance ← Wallets
 *   adAccounts: { linked: ['designo'], unlinked: [...] }, // Ad spend deductions
 *   fx: { usd: 255, since: 'YYYY-MM-DD' },
 *   productsNoBuy: 1, productsTotal: 2,
 *   packagingItems: 0, packagingIncluded: null|true|false,
 *   fixedCosts: 0, perOrderRules: 0, hasStaffOrRent: true,
 *   upcomingCosts: 0, workshopRemainders: null|number,   // «What's coming»
 *   returnFee: { configured: 200, offer: null|0|200 },    // offer = جواب التاجر على عرض شركة التوصيل
 *   payoutBacklog: 19220,                                 // «DZD X from before»
 *   carrierHeld: 108070, daysSincePayout: 10, payoutEvery: 7,
 *   locationsShipFrom: false,
 *   statuses: { callAttempts: 9, flipe: true }, cancelReasonRequired: null|bool,
 *   distribution: { receiving: 1, exceptionToUnavailable: ['Nahela'] },
 *   salaryOwed: 10650,
 *   spamLevel: 'standard'|'off'|'strict',
 *   tiktok: { uses: null|bool, connected: false },
 *   stuckOrders: [{ status, days }], returnsToProcess: 4,
 *   customers: { total, returnedOnce, repeat },
 *   monthlyOrders: 42, phase: 'test'|'batch'|'rhythm'|'scale',
 *   goal: { targetDzd: 1000000, cashProfitDzd, owedToWorkshopDzd }   // الوجهة = الهدف كاش + الورشة مخلّصة
 * }
 */
function checks(s) {
  const C = [];
  const add = (id, w, crit, ok, title, why, fix, path, owner = 'merchant', ask) => C.push({ id, weight: w, critical: !!crit, ok, title, why, fix, path, owner, ask });
  const W = (s.wallets || []).map(x => ({ ...x, n: (x.name || '').toUpperCase() }));
  const has = re => W.some(x => re.test(x.n));

  // 🧱 الأساس (حساب جديد): شركة التوصيل، Meta، البيكسل، المنتج
  if (s.carrierConnected != null) add('carrier', 8, true, !!s.carrierConnected, s.carrierConnected ? 'شركة التوصيل مربوطة' : 'حتى شركة توصيل مربوطة',
    'بلا شركة توصيل ما تخرج حتى طرد، وما يتحسبش فرق التوصيل ولا الروتور.', 'Add Delivery Agent ← اختار الشركة ← حط المفاتيح تاعها ← حطها افتراضية للمتجر.', 'Delivery & Shipping ← Add Delivery Agent');
  if (s.metaConnected != null) add('meta', 8, true, !!s.metaConnected, s.metaConnected ? 'Meta مربوط' : 'Meta ماشي مربوط',
    'بلا الربط، تسيير ما يشوفش المصروف ولا الحملات — تاست الإعلانات ما يتقاسش.', 'Apps ← Meta ← Connect، ومن بعد اربط الحساب بمحفظة ADS.', 'Apps ← Meta');
  if (s.pixelMissing != null) add('pixel', 6, !!s.pixelAllMissing, !(s.pixelMissing > 0), s.pixelMissing > 0 ? `${s.pixelMissing === 1 ? 'متجر' : s.pixelMissing + ' متاجر'} بلا بيكسل` : 'البيكسل محطوط',
    'حملة بلا بيكسل: ميتا ما تتعلّمش شكون يشري، والليد يغلى.', 'حط رقم البيكسل + CAPI لكل متجر تبيع منو.', 'Settings ← Pixels & Tracking');
  if (s.productsCount != null) add('products', 6, true, s.productsCount > 0, s.productsCount > 0 ? `${s.productsCount} منتج جاهز` : 'حتى منتج',
    'المسار والتاست يبداو من منتج بسعر بيع وثمن شراء.', 'Products ← Create Product: السعر + المتغيرات (المقاسات/الألوان) + ثمن الشراء.', 'Products ← Create Product');
  if (s.confirmers != null) add('confirmer', 3, false, s.confirmers > 0, s.confirmers > 0 ? `${s.confirmers} مؤكّد` : 'حتى مؤكّد (تأكّد وحدك)',
    'كي يكثرو الطلبيات، التأكيد يتأخر والزبون يبرد.', 'وظّف مؤكّد بعمولة كي توصل ~30 طلبية في النهار، وحطّو في Order distribution.', 'Team ← Invite Team Member');

  // 💰 المحافظ — قلب المانيت
  if (s.wallets) {
    const need = [['PAIEMENTS', /PAIEM|PAY|ENCAISS|CASH/], ['MARCHANDISE', /MARCH|STOCK|SL3A|سلعة/], ['ADS', /ADS|PUB|META/], ['RÉSERVE', /RESERV|RÉSERV|احتياط/]];
    const miss = need.filter(([, re]) => !has(re)).map(([n]) => n);
    add('wallets_4', 10, true, !miss.length, miss.length ? `ناقصة ${miss.length === 1 ? 'محفظة' : 'محافظ'}: ${miss.join('، ')}` : '4 محافظ واجدين',
      'بلا محفظة احتياط، كاش شركة التوصيل يتخلط مع فلوس الورشة والأدس — وكي يطيح نهار الباقي للورشة ما تلقاش.',
      `أنشئ: ${miss.join('، ')}. (OBJECTIF اختيارية: الربح اللي ما يتمسّش)`, P.newWallet);
    const neg = W.filter(x => x.balance < 0);
    add('opening_balance', 6, true, !neg.length, neg.length ? `محفظة سالبة: ${neg.map(x => x.name).join('، ')}` : 'ما كاين حتى محفظة سالبة',
      'السالب معناه الرصيد اللي بديت بيه ما تسجّلش — كل الأرقام اللي بعدو تخرج غالطة.', 'سجّل الرصيد الحقيقي اللي عندك اليوم.', P.recordHave);
    const pay = W.find(x => /PAIEM|PAY/.test(x.n)), tot = W.reduce((a, x) => a + (x.currency === 'USD' ? 0 : Math.max(0, x.balance || 0)), 0);
    if (pay && tot > 0) add('cash_not_split', 5, false, pay.balance / tot < 0.5, pay.balance / tot >= 0.5 ? `${Math.round(pay.balance / tot * 100)}% من الكاش مازال في PAIEMENTS (${m(pay.balance)})` : 'الكاش مقسوم على الجيوب',
      'PAIEMENTS محطة عبور: كل سحب من شركة التوصيل يتقسم نفس النهار (سلعة / أدس / احتياط / هدف)، ولا تصرفو بلا ما تحس.',
      'خلي البوصلة تحسب التقسيم (boussala_treasury مع cashInToday) ومن بعد حوّل.', P.wallets);
  }
  if (s.adAccounts) {
    const u = s.adAccounts.unlinked || [];
    add('ads_linked', 8, true, !u.length, u.length ? `${u.length} حسابات أدس ماشي محسوبين` : 'كل حسابات الأدس مربوطة بـ ADS',
      'الحساب الماشي مربوط: مصروفو ما يدخلش لا في الربح لا في المحفظة → الربح يبان أكبر من الحقيقة.',
      'اربط كل حساب تخدم بيه بمحفظة ADS. اللي ماعادش تخدم بيه: خليه برا، بصح تأكّد بلي ما فيه حتى مصروف.', P.adsDeduct, 'merchant', u.length ? 'أنهي حسابات راك تخدم بيهم صح دركا؟' : undefined);
  }
  if (s.fx) {
    const age = s.fx.since && s.today ? (new Date(s.today) - new Date(s.fx.since)) / dayMs : 0;
    add('fx_rate', 3, false, s.fx.usd > 0 && age <= 30, s.fx.usd > 0 ? `سعر الدولار ${s.fx.usd} (من ${Math.round(age)} يوم)` : 'سعر الدولار ماشي محطوط',
      'الأدس بالدولار: سعر قديم = الربح والليد بالدينار غالطين.', 'حدّث السعر كي تشري دولار (نفس سعر الشراء الحقيقي).', P.fx);
  }
  if (s.productsTotal != null) add('buy_prices', 8, true, !(s.productsNoBuy > 0), s.productsNoBuy > 0 ? `${s.productsNoBuy} من ${s.productsTotal} منتجات بلا ثمن شراء` : 'كل المنتجات عندها ثمن شراء',
    'تسيير يحسب السلعة بلاش → الربح «at most» ماشي الربح الحقيقي.', 'دخّل ثمن الشراء/الخياطة لكل متغير.', P.buyPrices);
  if (s.packagingItems != null || s.packagingIncluded != null) {
    const ok = s.packagingItems > 0 || s.packagingIncluded === true;
    add('packaging', 4, false, ok, ok ? 'التغليف محسوب' : 'التغليف = 0 (ما كاين حتى عنصر)', 'كل طرد فيه كيس/كرطون/لاصق: 50 دج × 1000 طلبية = 5 مليون في الشهر.',
      'زيد عنصر تغليف مع ثمنو، ولا قول للوكيل بلي السلعة تجي مغلّفة.', P.packaging, 'merchant', s.packagingIncluded == null && !ok ? 'نسيت التغليف ولا السلعة تجيك مغلّفة؟' : undefined);
  }
  if (s.fixedCosts != null) add('fixed_costs', 5, false, s.fixedCosts > 0 || s.hasStaffOrRent === false, s.fixedCosts > 0 ? 'المصاريف الثابتة مسجّلة' : 'المصاريف الثابتة = 0',
    'الكرا، الإنترنت، الاشتراكات، الخلصة القاعدية… بلاهم «What\'s coming» فارغ والربح منفوخ.', 'زيد كل مصروف شهري (Recurring) مع تاريخ الخلاص.', P.addExpense);
  if (s.upcomingCosts != null) add('remainders_in_costs', 7, true, s.upcomingCosts > 0 || s.workshopRemainders === 0, s.upcomingCosts > 0 ? '«What\'s coming» فيه المواعيد' : '«What\'s coming» فارغ',
    'الباقي للورشة نهار الاستلام هو أخطر نهار في الخزينة. لو ماشي مسجّل، تسيير ما يقدرش ينبّهك.', 'كل طلبية ورشة: العربون من MARCHANDISE (Spend) + الباقي كمصروف بتاريخ الاستلام.', P.addExpense);
  if (s.returnFee) {
    const known = s.returnFee.offer != null, ok = known && s.returnFee.offer === s.returnFee.configured;
    add('return_fee', 5, false, ok, !known ? `الروتور مسجّل ${s.returnFee.configured} دج — والعرض الحقيقي؟` : ok ? 'الروتور مطابق للعرض' : `الروتور مسجّل ${s.returnFee.configured} بصح العرض ${s.returnFee.offer}`,
      'الروتور يبدّل سقف الليد ورأس المال. عرض «روتور بلاش» رافعة كبيرة (حتى 38 مليون على 1000/شهر).', 'صلّح سعر الروتور في التسعيرة حسب عرض شركة التوصيل.', P.deliveryPricing, 'merchant', !known ? 'عرضك مع شركة التوصيل: الروتور بلاش ولا تخلّصو؟ شحال؟' : undefined);
  }
  if (s.payoutBacklog != null) add('payout_backlog', 5, true, !(s.payoutBacklog > 0), s.payoutBacklog > 0 ? `${m(s.payoutBacklog)} «from before» ما تأكدتش` : 'تتبّع السحب مضبوط',
    'تسيير ما يعرفش إذا قبضتهم ولا لا → «At carriers» و«Working money» غالطين.', 'قول لتسيير: قبضتهم ولا لا (حسب كشف شركة التوصيل، ماشي من الذاكرة).', P.payoutSetup, 'merchant', 'هذوك الفلوس القدام، قبضتهم من شركة التوصيل؟');
  if (s.carrierHeld != null) {
    const late = (s.daysSincePayout || 0) > (s.payoutEvery || 7) + 2;
    add('payout_on_time', 6, false, !late, late ? `${m(s.carrierHeld)} عند شركة التوصيل من ${s.daysSincePayout} يوم` : 'شركة التوصيل تخلّص في الوقت',
      'كل يوم الكاش محبوس عند شركة التوصيل = سلعة ما تتشراش ولا أدس ما يتزادش. السحب اليومي ينقّص رأس المال العامل (~44 مليون على 1000/شهر).',
      'اطلب السحب من شركة التوصيل، وكي يدخل: Record collection في نفس النهار. تفاوض على سحب يومي/مرتين في الأسبوع.', P.recordCollection);
  }
  if (s.locationsShipFrom != null) add('ship_from', 2, false, !!s.locationsShipFrom, s.locationsShipFrom ? 'مكان الشحن محدد' : 'المخازن: «Ships from here» = None',
    'لازم تسيير يعرف منين تخرج السلعة باش الستوك والإرسال يتحسبو صح.', 'حدّد المخزن اللي يشحن (مخزنك ولا مخزن شركة التوصيل).', P.locations);
  if (s.cancelReasonRequired != null) add('cancel_reason', 3, false, !!s.cancelReasonRequired, s.cancelReasonRequired ? 'سبب الإلغاء إجباري' : 'سبب الإلغاء اختياري',
    'بلا سبب ما نعرفوش علاش التأكيد طايح: السعر؟ التوصيل؟ طلبات وهمية؟', 'شعّل «Require a reason when cancelling».', P.cancelReason);
  if (s.statuses) add('call_ladder_closes', 4, false, !!s.statuses.closes, s.statuses.closes ? 'سلّم المكالمات يتسكّر' : `${s.statuses.callAttempts || 0} حالات «APPEL/JOUR» بلا قاعدة غلق`,
    'طلبيات تبقى في «APPEL 01 / JOUR 03» ولا «FLIPE» أسابيع: ليد مخلّص وما تحسبش لا مؤكد لا ملغي → التأكيد الحقيقي ما يبانش.',
    'القاعدة: بعد APPEL 03 / JOUR 03 → إلغاء بسبب «لم يرد على الهاتف». FLIPE: كل نهار يتراجع.', P.statuses);
  if (s.distribution) {
    const bad = (s.distribution.exceptionToUnavailable || []);
    add('distribution', 6, true, s.distribution.receiving > 0 && !bad.length, bad.length ? `استثناء يبعث الطلبيات لـ ${bad.join('، ')} (ماهيش تستقبل)` : s.distribution.receiving > 0 ? 'التوزيع يخدم' : 'حتى واحد ما يستقبل الطلبيات',
      'في تسيير: لو عضو الاستثناء ماشي متاح، الطلبية «تستنى» وما تروحش للباقي → ليد يبرد بلا مكالمة.', 'شعّل الاستقبال للعضو، ولا بدّل/نحّي الاستثناء.', P.distribution);
  }
  if (s.takeBack) { const tb = s.takeBack, ok = tb.minutes > 0 && tb.minutes <= 30 && tb.times >= 1;
    add('take_back', 5, false, ok, ok ? `الدوران مشعول: ${tb.minutes} دقيقة × ${tb.times}` : 'الدوران بين المؤكّدين ماشي مضبوط',
      'الطلبية اللي ما تتعيّطش في 30 دقيقة تبرد. الدوران يبعثها للمؤكّد الثاني، ومن بعد 5 دورات للمناجر.', 'ضبط «When is an order taken back?»: 30 دقيقة، 4 مرات (= 5 دورات) ← flagged for a manager.', P.distribution); }
  if (s.salaryOwed != null) add('salary_owed', 3, false, !(s.salaryOwed > 0), s.salaryOwed > 0 ? `خلصة مستحقة: ${m(s.salaryOwed)}` : 'الخلصات مسدّدة',
    'عمولة المؤكّد هي جزء من تكلفة كل موصلة — وتأخيرها يطيّح التأكيد.', 'خلّص من المحفظة المناسبة وسجّلها (Pay).', P.teamPay);
  if (s.spamLevel != null) add('spam', 2, false, s.spamLevel !== 'off', `الحماية: ${s.spamLevel}`, 'الطلبات الوهمية تاكل وقت المؤكّد وتخدع البيكسل.', 'خليها Standard، وStrict وقت الهجوم.', P.spam);
  if (s.tiktok && s.tiktok.uses) add('tiktok', 4, false, !!s.tiktok.connected, s.tiktok.connected ? 'TikTok مربوط' : 'TikTok ماشي مربوط', 'مصروف TikTok برا الربح والمحافظ.', 'اربط TikTok Ads ومن بعد اربطو بمحفظة ADS.', P.apps);
  if (s.stuckOrders) { const st = s.stuckOrders.filter(o => o.days > 3);
    add('stuck_orders', 5, false, !st.length, st.length ? `${st.length} طلبيات واقفة في نفس الحالة أكثر من 3 أيام (أقدم: ${Math.max(...st.map(o => o.days))} يوم)` : 'ما كاين حتى طلبية واقفة',
      'الطلبية الواقفة = ليد مخلّص بلا نتيجة، ونسب التأكيد تتلخبط.', 'فلتر بالحالة وسكّرها: تأكيد، إلغاء بسبب، ولا جدولة.', P.orders); }
  if (s.returnsToProcess != null) add('returns_processed', 4, false, !(s.returnsToProcess > 0), s.returnsToProcess > 0 ? `${s.returnsToProcess} رواجع ما تعالجوش` : 'الرواجع معالجة',
    'الراجعة ما تتعالجش = الستوك ما يرجعش للبيع، والسلعة التالفة ما تبانش.', 'Scan returns ولا Process لكل وحدة (رجوع للستوك ولا Damaged).', P.returns);
  return C;
}

// 🎮 المستويات: من التاست حتى 1000 طلبية/شهر — كل مستوى: الشرط، الشاشات اليومية، باب الخروج
const LEVELS = [
  { lvl: 0, name: 'تجهيز الحساب', gate: 'كل الخطوات الحمراء (critical) ✅', daily: [], exit: 'نقاط المستوى 0 ≥ 80 وما كاين حتى حمراء' },
  { lvl: 1, name: 'التاست', gate: 'مسار البوصلة (GUIDE) + سقف الليد + طلبية مسبقة/عربون',
    daily: [[P.mkt, 'CPL لكل حملة مقابل السقف (stop loss)'], [P.orders, 'تأكيد نفس النهار — سلّم APPEL يتسكّر'], [P.ab, 'اختياري: صفحة ضد صفحة']],
    exit: '100 ليد → حكم البوصلة (kill / fix / go). 50 ليد و CPL > 1.2× السقف = وقف بكري' },
  { lvl: 2, name: 'أول دفعة', gate: 'حكم GO + الكاش يكفي (العربون + الأدس + الاحتياط)',
    daily: [[P.wallets, 'العربون: MARCHANDISE ← Spend'], [P.addExpense, 'الباقي للورشة كمصروف بتاريخ الاستلام'], [P.inventory, 'Add Stock مع ثمن الشراء نهار الاستلام']],
    exit: 'أول 50 موصلة + أول سحب دخل وتقسّم' },
  { lvl: 3, name: 'الريتم (أول 25% من الهدف)', gate: 'سحب منتظم + التقسيم على 4 جيوب',
    daily: [[P.tracking, 'الطرود الحابسة و«ما يجاوبش» قبل الروتور'], [P.recordCollection, 'كل سحب: سجّل + قسّم'], [P.returns, 'عالج الرواجع + سجّل السبب']],
    exit: 'الربح الكاش (في OBJECTIF) ≥ 25% من الهدف + 3 أسابيع على المسار' },
  { lvl: 4, name: 'التكبير (25% → 100% من الهدف)', gate: 'المؤكّد ماهوش معبّي (< 80%) ولا وظّف + نقطة إعادة الطلب',
    daily: [[P.distribution, 'Evenly + الدوران كل 30 دقيقة باش حتى ليد ما يبرد'], [P.inventory, 'نقطة إعادة الطلب (استهلاك × (تحضير+4))'], [P.study, 'دراسة كل منتج جديد قبل ما يدخل']],
    exit: 'الربح الكاش = الهدف، والورشة مخلّصة (حتى باقي ما بقى)' },
  { lvl: 5, name: '🏁 الوجهة: الهدف كاش والستوك خالص', gate: 'الربح الصافي كاش ≥ الهدف + الباقي للورشة = 0',
    daily: [['Home ← Needs you', 'الصباح: كل بطاقة حمراء تتسكّر'], [P.wallets, 'OBJECTIF ما يتمسّش'], ['Analytics ← Employees', 'كل مؤكّد: تأكيد + توصيل']],
    exit: 'هدف جديد ← مسار GUIDE جديد' },
];

function levelOf(s, score, crit) {
  if (crit > 0 || score < 80) return 0;
  const ph = s.phase, G = s.goal;
  if (ph === 'test') return 1; if (ph === 'batch') return 2;
  if (G && G.targetDzd > 0) { const pct = (G.cashProfitDzd || 0) / G.targetDzd; if (pct >= 1 && !(G.owedToWorkshopDzd > 0)) return 5; return pct >= 0.25 ? 4 : 3; }
  return ph === 'scale' ? 4 : ph === 'rhythm' ? 3 : 1;
}

// 🎯 وين راك من الهدف (كاش + الستوك خالص)
function goalOf(G) {
  if (!G || !(G.targetDzd > 0)) return null;
  const pct = Math.round((G.cashProfitDzd || 0) / G.targetDzd * 100), owed = G.owedToWorkshopDzd || 0;
  return { targetDzd: G.targetDzd, cashProfitDzd: G.cashProfitDzd || 0, pct, owedToWorkshopDzd: owed, reached: pct >= 100 && !(owed > 0),
    msg: pct >= 100 ? (owed > 0 ? `🎯 الربح وصل ${m(G.cashProfitDzd)} بصح مازال ${m(owed)} للورشة — الهدف يتحسب كي الستوك يتخلّص.` : `🏁 وصلت: ${m(G.cashProfitDzd)} كاش والستوك خالص.`) : `🎯 ${pct}% من الهدف (${m(G.cashProfitDzd || 0)} / ${m(G.targetDzd)} كاش)${owed > 0 ? ` • باقي للورشة ${m(owed)}` : ''}` };
}

function manette(setup) {
  const s = setup || {};
  const C = checks(s);
  const tot = C.reduce((a, c) => a + c.weight, 0) || 1, got = C.filter(c => c.ok).reduce((a, c) => a + c.weight, 0);
  const score = Math.round(got / tot * 100);
  const red = C.filter(c => !c.ok && c.critical), todo = C.filter(c => !c.ok).sort((a, b) => (b.critical - a.critical) || (b.weight - a.weight));
  const level = levelOf(s, score, red.length);
  const L = LEVELS[level], next = LEVELS[Math.min(5, level + 1)];
  const asks = todo.filter(c => c.ask).map(c => ({ id: c.id, ask: c.ask }));
  return { goal: goalOf(s.goal), score, level, levelName: L.name, critical: red.length, done: C.filter(c => c.ok).length, total: C.length, todo, passed: C.filter(c => c.ok).map(c => c.id), asks, current: L, next, levels: LEVELS };
}

function manetteText(R) {
  const bar = '🟩'.repeat(Math.round(R.score / 10)) + '⬜'.repeat(10 - Math.round(R.score / 10));
  const L = [`🎮 المانيت — المستوى ${R.level}: ${R.levelName}`, `${bar} ${R.score}/100 • ${R.done}/${R.total} خطوات • ${R.critical} حمراء`];
  if (R.goal) L.push(R.goal.msg);
  L.push('');
  if (R.todo.length) {
    L.push('📋 الخطوات (بالترتيب):');
    R.todo.slice(0, 12).forEach((c, k) => { L.push(`${k + 1}. ${c.critical ? '🔴' : '🟡'} ${c.title}`); L.push(`   👆 ${c.path}`); L.push(`   ✔️ ${c.fix}`); if (c.ask) L.push(`   ❓ ${c.ask}`); });
  }
  if (R.level > 0 && R.current.daily.length) { L.push(''); L.push('📅 كل نهار في هذا المستوى:'); R.current.daily.forEach(([p, w]) => L.push(`  • ${p} — ${w}`)); }
  L.push(''); L.push(`🚪 باش تطلع للمستوى ${R.next.lvl} (${R.next.name}): ${R.current.exit}`);
  return L.join('\n');
}

const api = { manette, manetteText, checks, LEVELS, PATHS: P };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.BoussalaManette = api;
