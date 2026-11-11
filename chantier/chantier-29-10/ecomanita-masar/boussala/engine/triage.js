/*!
 * بوصلة التاجر — الإنقاذ (triage): حساب خدّام بلا متابعة، مشاكل في كل مرحلة
 * al-KHALiYA © 2026
 * الكوتش ما يبداش بالأسئلة كي الحساب ينزف: يرتّب المشاكل مرحلة بمرحلة، يقدّر النزيف بالدينار (تقدير معلن)،
 * يلقى السبب الجذري (bottleneck)، ويعطي خطة: اليوم (3 برك) ← هذا الأسبوع ← من بعد.
 */
'use strict';
const E = (typeof require === 'function') ? require('./boussala-engine.js') : window.BoussalaEngine;
const m = x => E.mil(x) || Math.round(x).toLocaleString('en-US') + ' دج';
const dayMs = 864e5;

/**
 * triage({ found, conf (watch), deliv (track), ads (testAds), stock:[{name,onHand}], returnsToProcess, variants, employees, customStatuses, financeSummary, rate, today })
 */
function triage(i) {
  const f = i.found || {}, rate = i.rate || 255, cplDzd = (f.cplUsd || 0) * rate;
  const S = { ads: [], confirm: [], stock: [], delivery: [], money: [], team: [] };
  let rootChain = null;
  const add = (st, lvl, title, bleedWeek, fix, when, where) => S[st].push({ lvl, title, bleedWeek: Math.round(bleedWeek || 0), fix, when, where });
  const ordersDay = (f.orders30 || 0) / 30;

  // 📞 التأكيد
  const C = i.conf;
  if (C) {
    const k = C.kpi;
    if (k.escalate > 0) { const oldest = C.escalate[0] ? Math.round(C.escalate[0].minutes / 60) : null;
      add('confirm', 'stop', `${k.escalate} طلبية ما تعيّطلهاش (أقدمها ~${oldest} ساعة خدمة)`, k.escalate * cplDzd, 'عيّطهم اليوم بالترتيب من الأقدم. كل ليد ما تعيّطلوش = أدس محروق.', 'today', 'Orders ← Pending'); }
    if (k.firstCallMedianMin != null && k.firstCallMedianMin > 60) {
      const lost = Math.max(0, (f.confPct || 50) * 0.15 / 100) * ordersDay * 7 * cplDzd;
      add('confirm', 'warn', `أول اتصال بعد ~${Math.round(k.firstCallMedianMin / 60 * 10) / 10} ساعة (${k.firstCallWithinRoundPct}% برك قبل 30 دقيقة)`, lost, 'عيّط في أول 15 دقيقة: ثبّت 3 أوقات في النهار للتأكيد على الأقل، وشعّل إشعارات تسيير.', 'week', 'Team ← Order distribution'); }
    if (k.canceled >= 10 && k.canceledNoReason / k.canceled > 0.3) add('confirm', 'warn', `${Math.round(k.canceledNoReason / k.canceled * 100)}% من الإلغاءات بلا سبب`, 0, 'زيد أسباب الإلغاء (ملابس) وخلّي السبب إجباري.', 'week', 'Settings ← Status customization');
  }
  if (!(i.customStatuses || []).length) add('confirm', 'info', 'ما كاين حتى سلّم مكالمات (APPEL 01 → 03)', 0, 'زيد 3 حالات مكالمات + قاعدة الغلق: بعد الثالثة ← إلغاء بسبب «ما جاوبش».', 'week', 'Settings ← Status customization');

  // 🎯 الإعلانات — مع السبب الجذري: واش الإعلان خاسر ولا التأكيد هو اللي خاسر؟
  const A = i.ads;
  if (A) {
    const losing = A.ads.filter(a => ['over_ceiling', 'early_kill', 'dead'].includes(a.status));
    const starved = A.ads.filter(a => a.status === 'starved');
    const weeks = Math.max(1, (i.adsDays || 30) / 7);
    if (losing.length) {
      const c0 = f.confPct || 50, c1 = Math.max(c0 + 10, 55);
      const slowConf = C && C.kpi.firstCallMedianMin > 60;
      const ceil1 = a => (a.ceilingDzd || A.rules.ceilingDzd || 0) * c1 / (a.confPct || c0);
      const saved = slowConf ? losing.filter(a => a.status === 'over_ceiling' && a.cplDzd && a.cplDzd <= ceil1(a)) : [];
      const kill = losing.filter(a => !saved.includes(a));
      if (kill.length) { const w = kill.reduce((x, a) => x + a.spendDzd, 0) / weeks;
        add('ads', 'stop', `${kill.length} إعلانات خاسرين (~${m(w)} في الأسبوع)`, w, `وقّف ${kill.map(a => '«' + a.name + '»' + (a.status === 'dead' ? ' (صرف بلا حتى ليد)' : '')).join('، ')}.`, 'today', 'Analytics ← Marketing'); }
      if (saved.length) { const w = saved.reduce((x, a) => x + a.spendDzd, 0) / weeks;
        rootChain = `التأكيد بطيء (أول اتصال ~${Math.round(C.kpi.firstCallMedianMin / 60 * 10) / 10} ساعة) ← التأكيد ${c0}% ← السقف يهبط ← ${saved.map(a => '«' + a.name + '»').join(' و')} يبان خاسر وهو ماشي`;
        add('ads', 'warn', `${saved.map(a => '«' + a.name + '»').join(' و')} فوق السقف — بصح المشكل في التأكيد، ماشي في الإعلان`, w * 0.5,
          `لو التأكيد يطلع لـ ${c1}% السقف يولّي ~${saved.map(a => m(ceil1(a))).join(' / ')} والإعلان (${saved.map(a => m(a.cplDzd)).join(' / ')}) يرجع رابح. ما توقّفوش: نقّص الميزانية 50% حتى يتصلّح التأكيد.`, 'today', 'Analytics ← Marketing'); }
    }
    if (starved.length) add('ads', 'info', `${starved.length} زوايا ما تعطاتلهمش فرصة (CBO)`, 0, 'التاست الجاي ABO: كل زاوية بميزانيتها.', 'later', 'Ads Manager');
    if (A.ads.length && A.ads.every(a => a.campaigns.some(c => /TEST/i.test(c))) && (i.adsDays || 30) > 14) add('ads', 'warn', 'حملة التاست مازالت شاعلة أكثر من 14 يوم — التكبير راهو يصرا داخل التاست', 0, 'خرّج الفائز لحملة تكبير، ووقّف التاست.', 'week', 'Ads Manager');
  }

  // 📦 الستوك: نفاد الرابح + الراقد
  const st = i.stock || [];
  if (st.length) {
    const sales = {}; (i.variants || []).forEach(v => { const n = (v.variant && v.variant.name) || ''; sales[n] = (sales[n] || 0) + (v.totalOrders || 0); });
    const totalSales = Object.values(sales).reduce((a, b) => a + b, 0) || 1;
    const buyOf = n => { const v = (i.variants || []).find(x => ((x.variant && x.variant.name) || '') === n) || (i.variants || [])[0] || {}; return v.buyPrice || 0; };
    const out = st.filter(x => (x.onHand || 0) <= 3 && (sales[x.name] || 0) / totalSales >= 0.2);
    const idle = st.filter(x => (x.onHand || 0) >= 30 && (sales[x.name] || 0) / totalSales < 0.05);
    out.forEach(x => { const share = (sales[x.name] || 0) / totalSales; const lostWeek = share * ordersDay * 7 * ((f.confPct || 50) / 100) * ((f.delPct || 50) / 100) * Math.max(0, (f.netPerDelivered || 1000));
      add('stock', 'stop', `«${x.name}» خلاص (${x.onHand || 0}) وهو ${Math.round(share * 100)}% من الطلب`, lostWeek, 'وقّف الأدس على هذا المقاس ولا حوّلو لطلب مسبق بتاريخ، واطلب دفعة صغيرة دركا.', 'today', 'Inventory'); });
    if (idle.length) { const val = idle.reduce((s, x) => s + (x.onHand || 0) * (buyOf(x.name) || buyOf('') || 0), 0);
      add('stock', 'warn', `ستوك راقد: ${idle.map(x => `${x.name} (${x.onHand})`).join('، ')}`, 0, `${val ? 'كاش راقد ~' + m(val) + '. ' : ''}عرض «قطعتين» ولا تخفيض على هاذو، وما تعاودش تشري السيري كاملة.`, 'week', 'Inventory'); }
  }

  // 🚚 التوصيل
  // 🏠 إشارات «Needs you» تاع الصفحة الرئيسية (لو ما عندناش القوائم كاملة)
  const H = i.home || {};
  const noCollections = H.collectionsRecorded === 0 && H.carrierHeld > 0;
  // ⏳ الطلبيات المفتوحة: إذا أحدثهم فاتت 7 أيام = تنظيف (الزبون برد)، ماشي استعجال
  const stale = H.openNewestDays >= 7;
  if (H.unassigned > 0 && stale) add('confirm', 'warn', `${H.unassigned} طلبية مفتوحة بلا مؤكّد يخدم — **قدام**: أحدثهم من ${H.openNewestDays} يوم${H.openAssignedTo ? ` (مازالين عند «${H.openAssignedTo}» اللي ما راهش يستقبل)` : ''}`, 0, 'ماشي استعجال: الزبون برد. دورة عيطة وحدة في نهار واحد؛ اللي ما جاوبش ← إلغاء بسبب «ما جاوبش / قديمة». ومن بعد شعّل «When is an order taken back?» باش ما تتعاودش.', 'week', 'Orders ← Pending ← Assign Orders');
  else if (H.unassigned > 0) add('confirm', 'stop', `${H.unassigned} طلبية مفتوحة بلا حتى مؤكّد${H.toCall ? ` (منهم ${H.toCall} جديدة تستنى العيطة)` : ''}`, (H.toCall || H.unassigned) * cplDzd * 0.3, 'وزّعهم اليوم (Assign Orders) وشعّل التوزيع Evenly — المؤكّد اللي ماشي «Receiving» ما يوصلوش.', 'today', 'Team ← Order distribution');
  if (noCollections) {
    const C = H.carriers || [], before = C.reduce((a, c) => a + (c.before || 0), 0), since = H.carrierHeld - before;
    add('money', 'stop', `تسيير يقول ${m(H.carrierHeld)} «محبوسين» عند شركات التوصيل (حتى ${H.maxDaysNoPayout || '؟'} يوم) — بصح **حتى قبضة ما تسجّلت**${before ? `: ${m(before)} «من قبل» + ${m(since)} من بعد ما بدا التتبّع` : ''}`, 0,
      'غالباً قبضتهم وما سجّلتهمش. لكل شركة، قارن مع الكشف تاعها (الفيرسمو). «من قبل» وقبضتو ← «I already collected it» (ما يزيد والو للمحفظة). ما قبضتوش ← ما تضغط والو وطالب الشركة بالكشف. «Record it as collected now» غير للدراهم اللي في يدك وما تسجّلت في حتى بلاصة.', 'today', 'Finance ← Report ← Set up payout tracking');
    S.money[S.money.length - 1].first = true;
  }
  if (H.returnsToProcess >= 100) add('stock', 'stop', `${H.returnsToProcess} رواجع ما تعالجوش${H.returnsProcessed === 0 ? ' (حتى وحدة ما تعالجت)' : ''} — الستوك في تسيير غالط${H.sellable < 0 ? ` (المتاح ${H.sellable})` : ''}`, 0, 'Scan returns: رجّع الصالح للستوك والباقي Damaged. حتى يتصلّح، ما تثيقش في أرقام الستوك.', 'today', 'Tracking ← Returns');
  if (H.lastOrderDaysAgo >= 7) add('ads', 'warn', `البيع واقف: آخر طلبية من ${H.lastOrderDaysAgo} يوم`, 0, 'قبل ما تعاود تطلق: صلّح المعطيات (القبضات، الرواجع، ثمن الشراء، الدولار) باش تعرف واش كان رابح بصح.', 'week', 'Analytics');
  if (H.usdRateAssumed) add('money', 'warn', `سعر الدولار في تسيير مفترض (${H.usdRateAssumed} دج) — الأدس محسوبة ناقصة`, 0, 'Finance ← Costs ← Your exchange rates: حط السعر اللي تشري بيه.', 'week', 'Finance ← Costs');
  if (H.productsNoBuy && H.productsTotal && H.productsNoBuy === H.productsTotal) add('money', 'warn', `${H.productsNoBuy} منتجات من ${H.productsTotal} بلا ثمن شراء — الربح في تسيير ماشي حقيقي`, 0, 'دخّل ثمن الشراء لكل منتج (ولا من Add Stock).', 'week', 'Finance ← Add buy prices');
  const D = i.deliv;
  if (D) {
    const u = D.kpi.unpaid; if (u.count && !noCollections) add('delivery', u.oldestDays > 7 ? 'stop' : 'warn', `${u.count} طرود موصلة وماشي مخلّصة (~${m(u.amount)}، أقدمها ${u.oldestDays} يوم)`, 0, 'اطلب السحب، وسجّلو نهار يدخل.', 'today', 'Home ← Needs you');
    const stuck = D.actions.find(a => a.code === 'stuck'), unr = D.actions.find(a => a.code === 'unreachable' || a.code === 'carrier_alerts');
    if (unr) add('delivery', 'warn', unr.msg.replace(/^(\p{Extended_Pictographic}️?\s*)+/u, ''), (unr.n || 1) * ((f.retCost || 200) + (f.delCost || 0)), 'عيّط للزبائن هاذو اليوم قبل ما يرجعو.', 'today', 'Tracking');
    if (stuck) add('delivery', 'warn', stuck.msg.replace(/^(\p{Extended_Pictographic}️?\s*)+/u, ''), 0, 'اتصل بشركة التوصيل على الطرود الحابسة.', 'week', 'Tracking');
  }
  if (i.returnsToProcess > 0) add('delivery', 'warn', `${i.returnsToProcess} رواجع ما تعالجوش — سلعة ما تتباعش`, 0, 'Scan returns: رجّعهم للستوك ولا Damaged.', 'week', 'Tracking ← Returns');

  // 💰 المالية
  if (f.payoutEvery && f.payoutEvery > 7) add('money', 'warn', `الكاش يرجع كل ~${f.payoutEvery} يوم`, 0, 'تفاوض على سحب كل 2–3 أيام: أكبر رافعة على رأس المال.', 'week', 'شركة التوصيل');
  const fs = i.financeSummary || {}; if ((fs.adsSpend && fs.adsSpend.value === 0) && A && A.ads.some(a => a.spendDzd > 0)) add('money', 'warn', 'الأدس برا المالية — الربح في تسيير كذاب', 0, 'اربط الحساب بمحفظة ADS.', 'week', 'Finance ← Wallets');

  // 👤 الفريق: تاجر وحدو
  const team = (i.employees || []).filter(e => !(e.roles || []).includes('Owner'));
  if (!team.length && ordersDay >= 8) add('team', 'warn', `راك وحدك على ~${Math.round(ordersDay)} طلبية في النهار — هذا هو عنق الزجاجة`, 0, 'مؤكّد بعمولة على الموصلة (ماشي خلصة ثابتة): يخلّص روحو من التأكيد اللي يزيد.', 'week', 'Team ← Invite');

  // 🧭 الترتيب: الأحمر، ومن بعد النزيف بالدينار
  const all = Object.entries(S).flatMap(([stage, L]) => L.map(x => ({ stage, ...x })));
  const rank = { stop: 0, warn: 1, info: 2 };
  all.sort((a, b) => (b.first ? 1 : 0) - (a.first ? 1 : 0) || (a.when === 'today' ? 0 : a.when === 'week' ? 1 : 2) - (b.when === 'today' ? 0 : b.when === 'week' ? 1 : 2) || rank[a.lvl] - rank[b.lvl] || b.bleedWeek - a.bleedWeek);
  const today = all.filter(x => x.when === 'today').slice(0, 3);
  const week = all.filter(x => x.when === 'week' || (x.when === 'today' && !today.includes(x)));
  const later = all.filter(x => x.when === 'later');
  const soloIdx = week.findIndex(x => x.stage === 'team'); if (soloIdx > 0) week.unshift(week.splice(soloIdx, 1)[0]);
  const bleed = all.reduce((s, x) => s + x.bleedWeek, 0);
  const stagesRed = Object.values(S).filter(L => L.some(x => x.lvl === 'stop' || x.lvl === 'warn')).length;
  const solo = all.find(x => /عنق الزجاجة/.test(x.title));
  if (!rootChain && noCollections && H.returnsToProcess >= 100) rootChain = 'المعطيات ماشي مسجّلة (حتى قبضة، الرواجع ما تعالجوش، ثمن الشراء، الدولار) ← الربح والكاش والستوك في تسيير ماشي حقيقيين ← ما تقدرش تقرر واش رابح ولا لا';
  const root = rootChain ? (solo ? 'راك وحدك ← ' + rootChain : rootChain) : solo ? solo.title : null;
  return { stages: S, stagesRed, bleedWeekDzd: Math.round(bleed), root, plan: { today, week, later }, messy: stagesRed >= 3 };
}

const NAMES = { ads: '🎯 الإعلانات', confirm: '📞 التأكيد', stock: '📦 الستوك', delivery: '🚚 التوصيل', money: '💰 المالية', team: '👤 الفريق' };
function triageText(T) {
  const ic = { stop: '🔴', warn: '🟡', info: 'ℹ️' };
  const L = [`🚑 الحساب ينزف في ${T.stagesRed} مراحل${T.bleedWeekDzd ? ` (~${m(T.bleedWeekDzd)} في الأسبوع، تقدير)` : ''}. قبل الأسئلة، نوقفو النزيف:`];
  if (T.root) L.push(`🎯 السبب الجذري: ${T.root}`);
  L.push('', `⏰ اليوم (${T.plan.today.length} برك):`);
  T.plan.today.forEach((x, k) => L.push(`  ${k + 1}. ${ic[x.lvl]} ${NAMES[x.stage]} — ${x.title} ← ${x.fix}${x.where ? ` (👆 ${x.where})` : ''}`));
  if (T.plan.week.length) { L.push('', '📅 هذا الأسبوع:'); T.plan.week.slice(0, 11).forEach(x => L.push(`  • ${ic[x.lvl]} ${NAMES[x.stage]} — ${x.title} ← ${x.fix}`)); }
  if (T.plan.later.length) { L.push('', '⏭️ من بعد:'); T.plan.later.forEach(x => L.push(`  • ${NAMES[x.stage]} — ${x.title} ← ${x.fix}`)); }
  return L.join('\n');
}

const api = { triage, triageText, NAMES };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
