/*!
 * بوصلة التاجر — فحص النقائص (التاجر + المنصة)
 * al-KHALiYA © 2026
 * يقرا لقطة من تسيير (ولا مدخلات يدوية) ويطلّع: واش ناقص، علاش يهم (بالدينار)، السؤال اللي يتسقسى، وكيفاش يتصلح.
 * owner: 'merchant' = التاجر يصلّح • 'tassyir' = نطلبو من فريق المنصة • 'agent' = الوكيل يعوّض
 */
'use strict';
const E = (typeof require === 'function') ? require('./boussala-engine.js') : window.BoussalaEngine;
const f = n => E.fmt(n), m = x => E.mil(x) || f(x) + ' دج';
const dayMs = 864e5;
const pl = (n, one, many) => (n >= 3 && n <= 10) ? `${n} ${many}` : `${n} ${one}`;

/**
 * snapshot = {
 *   variants: [{ product, name, buyPrice, packagePrice, avgDeliveryFeeDiff, avgRefundFee, avgCommission, orders, delivered, returned }],
 *   expenses: [{ name, amount, expenseType }],
 *   finance: { adsSpendDzd, refundAvg, refundCount, deliveryFeeDiffAvg },
 *   financeTx: [{ type, amount, description, category, createdAt }],
 *   marketing: { spendUsd, facebook: bool, tiktok: bool },
 *   tracking: [{ deliveryStatus, payoutState, total, lastStatusAt }],
 *   abandoned: number, orders: number,
 *   merchant: { usesTikTok?, packagingIncluded?, workshopDeposit? }   // أجوبة التاجر لو جاوب
 *   today: 'YYYY-MM-DD'
 * }
 */
function audit(snap, settings) {
  snap = snap || {};
  const ctx = E.makeCtx(settings || {});
  const out = [];
  const add = x => out.push(x);
  const V = (snap.variants || []).filter(v => (v.orders || 0) > 0);
  const M = snap.merchant || {};
  const today = snap.today ? new Date(snap.today) : new Date();

  // 1) التغليف = 0
  const noPack = V.filter(v => !(v.packagePrice > 0));
  const packExp = (snap.expenses || []).some(x => /تغليف|emballage|pack|كرطون|sachet/i.test(x.name || ''));
  if (noPack.length && !packExp && M.packagingIncluded !== true) {
    const per100 = 100 * 50;
    add({ id: 'packaging_missing', lvl: 'ask', owner: 'merchant', title: 'التغليف = 0 دج',
      why: `كل منتج بلا تغليف يبان رابح أكثر من الحقيقة. مثلاً 50 دج تغليف = ${m(per100)} على كل 100 موصلة تخرج من صافيك، وسقف الليد ينقص.`,
      ask: 'نسيت تدخّل التغليف، ولا السلعة تجيك مغلّفة من الورشة / الجملة؟ لو كاين: شحال تخلّص على كل طلبية (كيس، كرطون، لاصق، كارت)؟',
      fix: 'في تسيير: زيد مصروف «تغليف» من نوع «على كل طلبية موصلة» (ولا على المنتج نفسو في خانة ثمن التغليف).',
      products: noPack.map(v => v.name) });
  }
  // 2) سعر الشراء = 0
  const noBuy = V.filter(v => !(v.buyPrice > 0));
  if (noBuy.length) add({ id: 'buy_missing', lvl: 'fix', owner: 'merchant', title: `سعر الشراء/الإنتاج = 0 في ${pl(noBuy.length, 'متغير', 'متغيرات')}`,
    why: 'تسيير يحسب الربح كأن السلعة بلاش — الربح المعروض غالط، والبوصلة ما تقدرش تحسب رأس المال.',
    ask: 'شحال تكلّفك القطعة (الخياطة + القماش، ولا ثمن الجملة)؟',
    fix: 'دخّل ثمن الشراء كي تسجّل دخول الستوك (شراء المخزون) لكل متغير.', products: noBuy.map(v => v.name) });

  // 3) الأدس: تسيير ينقّصها من محفظة (ADS) أوتوماتيكياً — بشرط كل حساب أدس يكون مربوط بمحفظة
  const adsFin = (snap.finance && snap.finance.adsSpendDzd) || 0, adsMkt = (snap.marketing && snap.marketing.spendUsd) || 0;
  if (adsMkt > 0 && adsFin <= 0) add({ id: 'ads_not_linked', lvl: 'ask', owner: 'merchant', title: 'الأدس ما يبانش في الملخّص المالي',
    why: `التسويق يشوف $${Math.round(adsMkt)}، بصح الملخّص المالي يقول 0. في تسيير الأدس يتنقّص من محفظة (ADS) غير للحسابات المربوطة — حساب ماشي مربوط = أدس برا الربح.`,
    ask: 'كل حسابات الأدس تاعك مربوطين بمحفظة الأدس في تسيير (المالية ← المحافظ ← خصم الأدس)؟ وسجّلت الكاش اللي بديت بيه في المحفظة؟',
    fix: 'المالية ← المحافظ ← «خصم مصاريف الأدس»: اربط كل حساب Meta/TikTok بمحفظة ADS. ومحفظة سالبة = سجّل الرصيد الحقيقي («Record what you actually have»).' });
  (snap.unlinkedAdAccounts || []).length && add({ id: 'ad_accounts_unlinked', lvl: 'fix', owner: 'merchant', title: `${snap.unlinkedAdAccounts.length} حسابات أدس ماشي محسوبين`,
    why: 'المصروف تاعهم ما يدخلش لا في الربح لا في المحافظ.', fix: 'اربطهم بمحفظة ADS، ولا نحّيهم لو ماعادش تخدم بيهم.', accounts: snap.unlinkedAdAccounts });

  // 4) TikTok
  if (snap.marketing && snap.marketing.tiktok === false && M.usesTikTok) add({ id: 'tiktok_not_connected', lvl: 'fix', owner: 'merchant', title: 'TikTok ماهوش مربوط',
    why: 'الأدس تاع TikTok ما يبانش — تكلفة الليد والربح ناقصين.', ask: null, fix: 'اربط حساب TikTok Ads في تسيير (التسويق).' });

  // 5) العمولات
  const comm = V.length ? V.reduce((s, v) => s + (v.avgCommission || 0) * (v.delivered || 0), 0) / Math.max(1, V.reduce((s, v) => s + (v.delivered || 0), 0)) : 0;
  if (comm > 0) add({ id: 'commission', lvl: 'info', owner: 'agent', title: `عمولة المؤكّد ~${f(comm)} دج / موصلة`,
    why: 'تكلفة حقيقية على كل طلبية موصلة — الوكيل يزيدها مع التغليف في الحساب.', value: Math.round(comm) });

  // 6) الروتور: رافعة تتفاوض مع شركة التوصيل — نسقسيو، ما نفرضوش
  const tx = snap.financeTx || [];
  const refundTx = tx.filter(t => /return refund fee/i.test(t.description || ''));
  const refundAvg = snap.finance && snap.finance.refundAvg;
  if (refundTx.length && refundTx.every(t => !(t.amount > 0)) && refundAvg > 0)
    add({ id: 'return_fee_conflict', lvl: 'ask', owner: 'merchant', title: `الروتور: الإعداد يقول ~${f(refundAvg)} دج، والمعاملات 0 دج (${pl(refundTx.length, 'معاملة', 'معاملات')})`,
      why: 'الروتور يتبدّل حسب العرض اللي فاوضتو مع شركة التوصيل. 0 ولا 200 دج يبدّل سقف الليد ورأس المال — لازم الرقم الصحيح.',
      ask: 'عرضك مع شركة التوصيل: الروتور بلاش، ولا تخلّصو؟ شحال؟',
      fix: 'صلّح ثمن الروتور في إعدادات التوصيل في تسيير حسب العرض. البوصلة تحسب بجوابك.' });
  else if (!refundTx.length && !(refundAvg > 0)) add({ id: 'return_fee_unknown', lvl: 'ask', owner: 'merchant', title: 'ثمن الروتور ماهوش معروف', why: 'الروتور يدخل في سقف الليد ورأس المال.', ask: 'عرضك مع شركة التوصيل: شحال الروتور؟ (بلاش، 100، 200…)' });

  // 7) سحب الكاش من شركة التوصيل
  const cash = tx.filter(t => t.type === 'IN' && /cashout/i.test(t.description || '')).map(t => new Date(t.createdAt)).sort((a, b) => a - b);
  if (cash.length >= 2) {
    const gaps = cash.slice(1).map((d, i) => Math.round((d - cash[i]) / dayMs));
    const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    if (avg > 3) {
      const base = settings && settings.__guideForPayout;
      add({ id: 'payout_slow', lvl: 'fix', owner: 'merchant', title: `الكاش يرجع كل ~${avg} يوم (آخر الفترات: ${gaps.join('، ')} يوم)`,
        why: 'كل يوم الكاش يبقى عند شركة التوصيل = رأس مال زايد لازم تحطو من جيبك. مثال لينا: سحب كل نهار 64 مليون، كل 7 أيام 99 مليون.',
        ask: 'واش تقدر تطلب السحب كل نهار (ولا كل 2–3 أيام) من شركة التوصيل؟', fix: 'اطلب السحب اليومي من شركة التوصيل؛ في البوصلة حط «الكاش يرجع كل» = الرقم الحقيقي.', gaps, avg, _base: base });
    }
  }
  // 8) موصلة وماهيش مخلّصة
  const unpaid = (snap.tracking || []).filter(t => /non_encaiss|livré_non/i.test(t.deliveryStatus || '') || (t.delivered && t.payoutState === 'awaiting'));
  if (unpaid.length) {
    const amt = unpaid.reduce((s, t) => s + (+t.total || 0), 0);
    const oldest = unpaid.reduce((mx, t) => Math.max(mx, Math.round((today - new Date(t.lastStatusAt || t.deliveredAt)) / dayMs)), 0);
    add({ id: 'delivered_unpaid', lvl: oldest > 7 ? 'fix' : 'info', owner: 'merchant', title: `${pl(unpaid.length, 'طلبية موصلة', 'طلبيات موصلة')} ومازال ما تخلّصتش (~${m(amt)})`,
      why: `أقدم وحدة عندها ${oldest} يوم. هذا كاش تاعك راقد عند شركة التوصيل.`, fix: 'اطلب السحب من شركة التوصيل، وتابع في تسيير حالة «موصلة غير مخلّصة».', amount: amt, oldestDays: oldest });
  }
  // 9) الليدات الضايعة
  if (snap.abandoned > 0 && snap.orders > 0) {
    const pct = snap.abandoned / (snap.abandoned + snap.orders) * 100;
    add({ id: 'abandoned', lvl: 'info', owner: 'merchant', title: `${snap.abandoned} ليد ضايع (~${Math.round(pct)}% من الليدات)`,
      why: 'أرخص ربح عندك: جاو بالأدس وما كمّلوش.', fix: 'وكّل مؤكّد على حالة «متروكة» في تسيير: اتصال في الساعة، ورسالة واتساب، وعرض صغير.', pct: Math.round(pct) });
  }
  // 10) عربون الورشة (المنصة ما تعرفش)
  if (M.workshopDeposit || (settings && (settings.__hasPreorder))) add({ id: 'purchase_orders_missing', lvl: 'fix', owner: 'tassyir', title: 'العربون والباقي وتاريخ الاستلام ما يتسجّلوش',
    why: 'تسيير يسجّل شراء الستوك مرة وحدة بالمبلغ الكامل. ما يعرفش بلّي خلّصت 30%، وبلّي الباقي يتخلّص نهار كذا — ما يقدرش ينبهك على السيولة.',
    fix: 'نطلبو من تسيير «طلبيات شراء»: المورّد، الكمية، العربون، الباقي، تاريخ الاستلام، تسليم على دفعات. في الانتظار: الوكيل يحفظ رزنامة الدفعات ويحسب السيولة.', agentCovers: true });

  const order = { fix: 0, ask: 1, info: 2 };
  out.sort((a, b) => order[a.lvl] - order[b.lvl]);
  return { findings: out, questions: out.filter(x => x.ask).map(x => x.ask), forTassyirTeam: out.filter(x => x.owner === 'tassyir') };
}

function auditText(A) {
  const L = ['🔎 البوصلة — النقائص قبل ما نحسب'];
  const ic = { fix: '🔴', ask: '🟡', info: 'ℹ️' };
  A.findings.forEach(x => {
    L.push(`${ic[x.lvl]} ${x.title}`);
    L.push(`   علاش يهم: ${x.why}`);
    if (x.ask) L.push(`   ❓ ${x.ask}`);
    if (x.fix) L.push(`   🛠️ ${x.fix}`);
  });
  return L.join('\n');
}

const api = { audit, auditText };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BoussalaAudit = api;
