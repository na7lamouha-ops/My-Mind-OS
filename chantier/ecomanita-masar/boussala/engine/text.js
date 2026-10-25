/*!
 * بوصلة التاجر — تقرير MOOD GUIDE بالدارجة (للتلقرام، الواتساب، وأي واجهة بلا ذكاء اصطناعي)
 * al-KHALiYA © 2026
 */
'use strict';
const E = (typeof require === 'function') ? require('./boussala-engine.js') : window.BoussalaEngine;
const f = n => E.fmt(n);
const m = x => isFinite(x) ? (E.mil(x) || f(x) + ' دج') : 'ما يوصلش في المدة';
const usd = (dzd, rate) => '$' + (dzd / rate).toFixed(2);

const CODE_TXT = {
  safe_margin: i => `✅ ${i.product}: هامش أمان ${i.safetyPct}% — الليد يقدر يغلى حتى $${i.ceilingUsd} (${f(i.ceilingDzd)} دج) قبل ما تخسر.`,
  thin_margin: i => `⚠️ ${i.product}: هامش الأمان ${i.safetyPct}% برك — تكلفة الليد قريبة من السقف ($${i.ceilingUsd}). خطّط للتاست بليد أرخص.`,
  heavy_batch: i => `📦 ${i.product}: لازم تبيع ~${i.sellPctToRecoverBatch}% من كل دفعة باش ترجّع ثمنها — دفعات صغيرة، وارفع السعر ولا نقّص تكلفة الإنتاج.`,
  optimistic: i => `🔍 ${i.product}: فرضياتك متفائلة (${i.assumptions.join('، ')}) — عاود جرّب بأسوأ سيناريو (تأكيد ~50%، توصيل ~45%). التاست هو اللي يحكم.`,
  weak_in_mix: i => `⚠️ ${i.product} ضعيف قدّام الباقي (العائد ${i.roi}% مقابل ${i.bestRoi}%) — خلّيه احتياطي صغير ولا حسّنو.`,
  mix_test_separately: () => '🧭 خطتك دمج: في التاست كل منتج بحملتو وأرقامو وحدو.',
  one_player: () => '⚽ لاعب واحد برك: لو الإعلان يتعب ولا المنافس ينسخ، الخطة تحبس. زيد منتج احتياطي تاستيتو.',
  slow_recovery: i => `⚠️ رأس مال البدء يرجع حوالي اليوم ${i.day} — بعد نهاية المدة.`,
  heavy_capital: i => `⚠️ رأس المال (${m(i.capital)}) أكبر بزاف من الربح المنتظر — الخطة ثقيلة.`,
  abandoned_leads: i => `💸 الليدات الضايعة = أرخص ربح عندك: ~${m(i.extraProfit)} زايدة لو ترجّع ${i.assumption}، بلا أدس.`,
  test_too_heavy: i => '💼 ' + i.msg,
  abandoned_missing: () => '💸 ما دخّلتش الليدات الضايعة — دخّل نسبتك وخطّط لمتابعتهم من اليوم 1.',
};

function guideText(o) {
  const s = o.settings, P = o.plan, rate = s.rate, L = [];
  L.push('🧭 البوصلة — المسار قبل التاست');
  L.push(`الهدف: ${m(s.target)} ${s.targetMode === 'cash' ? 'كاش (في الجيب)' : 'كاش + سلعة (على الورق)'} في ${s.period} يوم`);
  L.push('');
  L.push('▪️ المنتجات:');
  o.perProduct.forEach(p => L.push(`  ${!p.profitable ? '🔴' : p.roi < 15 ? '⚠️' : '✅'} ${p.name}: صافي الطلبية ${f(p.netPerOrder)} دج • سقف الليد ${usd(p.maxCplDzd, rate)} • رأس المال وحدو ${m(p.capital)} • العائد (ROI) ${f(p.roi)}%${p.profitable && p.roi < 15 ? ' — ضعيف: ما يستاهلش التاست دوكا' : ''}`));
  L.push('');
  L.push(`▪️ الخطة: ${P.label}`);
  P.products.forEach(p => L.push(`  • ${p.name}: ${p.sharePct}% من الهدف • ~${f(Math.ceil(p.leadsPerDay))} ليد/يوم • سقف الليد ${usd(p.maxCplDzd, rate)}`));
  L.push(`  💰 تبدا بـ: ${m(P.capital)}${P.capDays ? ` (المدة قصيرة — أقل مدة ممكنة ~${P.capDays} يوم)` : ''}`);
  L.push(`  📈 العائد (ROI): ~${f(P.roi)}% • رأس المال يرجع حوالي اليوم ${P.dayRecover}`);
  L.push(`  👥 الفريق: ~${o.team.confirmers} مؤكّد + ~${o.team.trackers} متتبّع`);
  L.push(`  📦 ستوك البدء: ~${f(P.starterStock)} قطعة`);
  L.push('');
  L.push((o.coach.level === 'go' ? '🟢 ' : o.coach.level === 'stop' ? '🔴 ' : '🟡 ') + o.coach.verdict);
  o.coach.items.forEach(i => { const t = CODE_TXT[i.code]; if (t) L.push('  ' + t(i)); });
  if (o.coach.test) { L.push(''); L.push('🧪 التاست = 100 ليد لكل منتج في 3 حتى 5 أيام (استثمار، ماشي خسارة):'); o.coach.test.forEach(t => L.push(`  • ${t.product}: ~$${t.budgetUsd} أدس (~$${t.perDayUsd}/يوم)`)); }
  if (o.stress) L.push(`\n📈 الرقم يقدر يطلع: لو الليد يغلى 20% ← ${m(o.stress.leadUp20)} • لو التوصيل يطيح 5 نقاط ← ${m(o.stress.deliveryDown5)} • الزوج ← ${m(o.stress.both)}`);
  if (o.myCapital) L.push(o.myCapital.ok ? `\n💼 برأس مالك توصل حوالي اليوم ~${o.myCapital.days} (نقطة الدوران ~اليوم ${o.myCapital.turnDay}).` : `\n💼 رأس مالك صغير حتى للبداية (~${f(o.myCapital.minStart)} دج = 10 ليدات أولى).`);
  if (o.levers && o.levers.levers.length) {
    const b = o.levers.levers[0];
    if (o.edition === 'public') L.push('🔑 كاين رافعات تنقّص رأس المال وتقصّر الطريق — البوصلة رتّبتهم، ومفصّلين في نسخة تسيير.');
    else if (b.capitalSaved > 0) { L.push('🔑 الروافع (بلا ما تزيد ولا دينار):'); o.levers.levers.filter(x => x.capitalSaved > 0).slice(0, 3).forEach(x => L.push(`  • ${x.lever} ← رأس المال −${m(x.capitalSaved)}`)); }
  }
  L.push('\nℹ️ الربح الصافي هنا ما فيهش عمولة المؤكّد ولا المصاريف الثابتة (كراء، أجور، اشتراكات): زيدهم للهدف.');
  L.push('\nالبوصلة ما تعدكش — ترسم المسار بأرقامك اليوم. كي تتبدّل الأرقام، يتبدّل المسار.');
  return L.join('\n');
}

const api = { guideText };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BoussalaText = api;
