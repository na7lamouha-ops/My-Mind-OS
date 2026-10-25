/*!
 * بوصلة التاجر — أسبوع التاست بالمنطق (ماشي أرقام محفوظة)
 * al-KHALiYA © 2026
 *
 * كل حد يتحسب من أرقام المنتج والتاجر، وما كاين حتى عتبة مكتوبة باليد:
 *  - السقف (أقصى كوسط كونفيرمي) = الربح على كل طلبية مؤكّدة قبل الأدس، من نفس محرّك البوصلة.
 *  - السقف «في أسوأ حالة» = نفس الحساب بالتوصيل الأسوأ (SPREAD تاع المجال) — التوصيل ما يبانش في التاست.
 *  - الحكم بالإحصاء: مجال الثقة (90%، نفس اختبار الإعلانات) على التأكيد (Wilson) وعلى عدد الليدات (Poisson).
 *      • نقتلو كي حتى الحالة المتفائلة فوق السقف • نقبلو كي حتى الحالة المتشائمة تحت السقف الأسوأ • بيناتهم: نكملو.
 *  - أقل ليدات قبل القبول = حدث التعلّم تاع ميتا (معطى المنصة، ماشي قاعدتنا) — القتل يقدر يجي قبل.
 *  - أقصى صرف على موديل = ليدات التعلّم × الليد الأقصى: لو صرفها وما وصلش، الليد تاعو فوق الحد أصلاً.
 *  - الميزانية في النهار = ليدات التعلّم × الليد المتوقّع ÷ الأيام اللي يعطيها التاجر للتاست (وماشي تحت أرضية ميتا).
 *  - التأكيد الأدنى = تأكيد الخطة + أسوأ فرق في المجال: تحتو، الخطة اللي بنينا عليها رأس المال تطيح.
 *  - المحفظة = كل موديل بالليد الأسوأ (SPREAD) • الحد الأقصى = مجموع السقوف.
 *  - الخانات: قاعدة إحصائية معروفة (~5 مشاهدات متوقّعة في الخانة) باش نقارنو الحصص.
 */
'use strict';
const E = require('./boussala-engine.js');
const { SPREAD } = require('./scenarios.js');

// معطيات خارجية ولا اتفاقيات البوصلة — ماشي عتبات قرار. كلها تتبدّل من المدخلات.
const FACTS = Object.freeze({
  learningEvents: 50,   // ميتا: ~50 تحويل في 7 أيام لكل مجموعة إعلانية باش تخرج من مرحلة التعلّم
  learningDays: 7,
  confidence: 0.9,      // نفس اختبار الإعلانات (testads)
  cellMin: 5,           // قاعدة الإحصاء: ≥5 مشاهدات متوقّعة في الخانة
});
const zOf = c => ({ 0.8: 0.8416, 0.85: 1.0364, 0.9: 1.2816, 0.95: 1.6449, 0.975: 1.96, 0.99: 2.3263 }[c] || 1.2816); // من جهة وحدة

// Wilson: حدود التأكيد الحقيقي
function wilson(x, n, z) {
  if (!n) return [0, 1];
  const p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
// Poisson: أكبر عدد ليدات معقول (Wilson–Hilferty) ← أرخص ليد معقول
function poissonUp(k, z) { const a = k + 1; return a * Math.pow(1 - 1 / (9 * a) + z / (3 * Math.sqrt(a)), 3); }

// الربح على كل طلبية مؤكّدة قبل الأدس (دولار) = أقصى كوسط كونفيرمي، بالتوصيل اللي نعطيوه
function ceilingAt(p, settings, delPts) {
  const ctx = E.makeCtx(settings || {}), conf = p.conf || 55, q = E.normProduct({ ...p, conf, del: delPts }, ctx);
  const R = E.calcOneProduct(q, E.sharedOf(ctx), (ctx.target || 1000000) / 2, ctx);
  if (!R || !isFinite(R.breakevenCPA) || R.breakevenCPA <= 0) return null;
  return R.breakevenCPA / ctx.rate / (conf / 100);
}

/** limits(product, settings, o) — كل الحدود محسوبة من المنتج */
function limits(p, settings, o = {}) {
  const F = { ...FACTS, ...o }, S = { ...SPREAD, ...(o.spread || {}) }, rate = (settings && settings.rate) || 250;
  const del = p.del || 50, conf = (p.conf || 55) / 100, delWorst = Math.max(5, del + S.del[0]);
  const ceiling = ceilingAt(p, settings, del), ceilingWorst = ceilingAt(p, settings, delWorst);
  if (!ceiling) return { name: p.name, ok: false };
  const maxLead = ceiling * conf, lead = p.leadUsd || (p.lead ? p.lead / rate : maxLead / 2);
  const days = o.testDays || p.testDays || F.learningDays;
  const budget = Math.max(F.learningEvents * lead / days, F.learningEvents * lead / F.learningDays);
  const cap = F.learningEvents * maxLead, plannedSpend = F.learningEvents * lead, worstSpend = Math.min(cap, plannedSpend * (1 + S.lead[0]));
  const confFloor = Math.max(0.05, conf + S.conf[0] / 100);
  return { name: p.name, ok: true, conf, del, delWorst, ceiling: r2(ceiling), ceilingWorst: r2(ceilingWorst), maxLead: r2(maxLead), lead: r2(lead), confFloor: Math.round(confFloor * 100),
    budget: r2(budget), days: Math.ceil(F.learningEvents * lead / budget - 1e-9), cap: Math.round(cap), plannedSpend: Math.round(plannedSpend), worstSpend: Math.round(worstSpend),
    zeroLeadStop: r2(poissonUp(0, zOf(F.confidence)) * maxLead), minLeads: F.learningEvents };
}
const r2 = x => Math.round(x * 100) / 100;

/** judge(result, settings, o) — الحكم بالإحصاء على الحدود المحسوبة */
function judge(x, settings, o = {}) {
  const F = { ...FACTS, ...o }, z = zOf(F.confidence), L = limits(x, settings, o);
  const spend = +x.spend || 0, k = +x.leads || 0, cf = +x.confirmed || 0, proc = x.processed != null ? +x.processed : k;
  const base = { name: x.name, spend, leads: k, confirmed: cf, limits: L };
  if (!L.ok) return { ...base, tag: '?', why: 'ناقص سعر البيع ولا الإنتاج باش نحسبو السقف', next: 'كمّل المنتج' };
  const cpl = k ? spend / k : Infinity, cplBest = spend / poissonUp(k, z);           // أرخص ليد معقول
  const [cLo, cHi] = wilson(cf, proc, z), conf = proc ? cf / proc : 0;
  const cpc = cf ? spend / cf : Infinity, cpcBest = cHi ? cpl / cHi : Infinity, cpcWorst = cLo ? cpl / cLo : Infinity; // الليد يتقاس، التأكيد هو اللي فيه الضجيج
  const f = v => isFinite(v) ? v.toFixed(2) + '$' : '∞';
  const out = (tag, why, next) => ({ ...base, tag, why, next, cpl: isFinite(cpl) ? r2(cpl) : null, conf: Math.round(conf * 100), confRange: [Math.round(cLo * 100), Math.round(cHi * 100)], cpc: isFinite(cpc) ? r2(cpc) : null, cpcRange: [isFinite(cpcBest) ? r2(cpcBest) : null, isFinite(cpcWorst) ? r2(cpcWorst) : null] });

  // 1) الليد: حتى أرخص ليد معقول فوق الليد الأقصى ← الإعلان هو المشكل
  if (cplBest > L.maxLead) return out('ECHEC-ADS', `حتى في أحسن حالة الليد ${f(cplBest)} فوق الليد الأقصى ${f(L.maxLead)}`, 'الميدياباير يبدّل الزاوية ولا نوقفو، والدراهم تروح للموديلات الأخرى');
  // 2) الربح: حتى في أحسن حالة كوسط كونفيرمي فوق السقف ← التأكيد (ولا السعر) هو المشكل
  if (proc >= 10 && cpcBest > L.ceiling) { const ads = cpl > L.maxLead; return out(ads ? 'ECHEC-ADS' : 'ECHEC-CONF', `حتى في أحسن حالة كوسط كونفيرمي ${f(cpcBest)} فوق السقف ${f(L.ceiling)} (التأكيد بين ${Math.round(cLo * 100)}% و${Math.round(cHi * 100)}%)${ads ? `، والسبب الأول الليد ${f(cpl)} فوق ${f(L.maxLead)}` : ''}`, ads ? 'الميدياباير يبدّل الزاوية ولا نوقفو' : 'المؤكّد يعيّط للطلبيات ويقول الحقيقة، ونقراو أسباب الإلغاء'); }
  const enough = k >= L.minLeads;
  // 3) التأكيد أكيد تحت اللي بنينا عليه الخطة (حتى الحد العالي تحت الأدنى) ← الخطة تطيح: نصلّحو لو نربحو بالأرقام الحالية، وإلا نوقفو
  if (enough && cHi * 100 < L.confFloor && cpcWorst > L.ceilingWorst) {
    if (isFinite(cpc) && cpc <= L.ceiling) return out('FIX', `التأكيد ${Math.round(conf * 100)}% (حتى ${Math.round(cHi * 100)}% في أحسن حالة) تحت اللي بنينا عليه الخطة (${L.confFloor}%)، بصح كوسط كونفيرمي ${f(cpc)} مازال تحت السقف ${f(L.ceiling)}`, 'نصلّحو حاجة وحدة (السعر في الفيديو، الصفحة، السكريبت) ونعاودو نقيسو');
    return out('ECHEC-CONF', `التأكيد ${Math.round(conf * 100)}% (حتى ${Math.round(cHi * 100)}% في أحسن حالة) تحت ${L.confFloor}%، وكوسط كونفيرمي ${f(cpc)} فوق السقف ${f(L.ceiling)}`, 'المؤكّد يعيّط للطلبيات ويقول الحقيقة، ونقراو أسباب الإلغاء');
  }
  // 4) القبول: ميتا خرجت من التعلّم، وحتى في أسوأ حالة نربحو بالتوصيل الأسوأ
  if (enough && cpcWorst <= L.ceilingWorst) {
    if (cHi * 100 < L.confFloor) return out('FIX', `نربحو، بصح التأكيد (حتى ${Math.round(cHi * 100)}%) تحت اللي بنينا عليه الخطة (${L.confFloor}%)`, 'نصلّحو حاجة وحدة (السعر في الفيديو، الصفحة، السكريبت) ونعاودو نقيسو، على خاطر الفريق ورأس المال محسوبين على تأكيد أعلى');
    return out('VALIDE', `حتى في أسوأ حالة كوسط كونفيرمي ${f(cpcWorst)} تحت السقف بالتوصيل الأسوأ ${f(L.ceilingWorst)} (توصيل ${L.delWorst}%)`, 'الورشة اليوم، وحجم صغير حتى نقيسو التوصيل الحقيقي');
  }
  // 5) الحد: صرف ليدات التعلّم بالليد الأقصى وما تحسمش
  if (spend >= L.cap) {
    if (isFinite(cpc) && cpc <= L.ceiling) return out('ECHEC-RESERVE', `وصل للحد ${L.cap}$ بلا ما يتحسم: كوسط كونفيرمي ${f(cpc)} تحت السقف بصح ماشي مضمون`, 'نخدمو طلبياتو، ما نكبّروش، احتياطي');
    return out(cpl > L.maxLead ? 'ECHEC-ADS' : 'ECHEC-CONF', `وصل للحد ${L.cap}$ وكوسط كونفيرمي ${f(cpc)} فوق السقف ${f(L.ceiling)}`, 'نوقفو');
  }
  // 6) مازال: شحال باقي باش يتحسم
  const need = !enough ? `${L.minLeads - k} ليد باش ميتا تخرج من التعلّم` : `الحالة الأسوأ ${f(cpcWorst)} مازالت فوق ${f(L.ceilingWorst)}: الداتا ما تكفيش`;
  const signal = isFinite(cpc) && cpc <= L.ceilingWorst ? '🟢 الإشارة مليحة' : isFinite(cpc) && cpc > L.ceiling ? '🔴 الإشارة سيّئة بصح ماشي مؤكّدة' : '🟡 الإشارة بين الزوج';
  return out('TEST', `${signal}: ${need}`, `يكمل حتى ${L.cap}$ على الأكثر (باقي ${Math.max(0, L.cap - spend)}$)`);
}

/** schedule({ models, perDay, testDays, confCap, settings }) — الجدول من الحدود */
function schedule(o) {
  const M = (o.models || []).map((m, i) => ({ ...m, i })).sort((a, b) => (b.p || 0) - (a.p || 0) || a.i - b.i);
  const per = o.perDay || Math.max(1, Math.ceil(M.length / (o.launchDays || Math.max(1, Math.ceil(M.length / 2)))));
  const runs = M.map((m, k) => { const L = limits(m, o.settings, o), start = 1 + Math.floor(k / per), d = L.days || 1;
    return { name: m.name, start, end: start + d - 1, decideDay: start + d, budget: L.budget, leadsPerDay: L.budget / (L.lead || 1), spend: L.plannedSpend }; });
  const last = Math.max(0, ...runs.map(x => x.end)), days = [];
  for (let d = 1; d <= last; d++) { const on = runs.filter(x => x.start <= d && x.end >= d); days.push({ day: d, models: on.map(x => x.name), spend: Math.round(on.reduce((s, x) => s + x.budget, 0)), leads: Math.round(on.reduce((s, x) => s + x.leadsPerDay, 0)) }); }
  const peak = days.reduce((a, b) => (!a || b.leads > a.leads ? b : a), null), cap = (o.settings && o.settings.confCap) || o.confCap || 60;
  return { perDay: per, runs, days, peak, confirmers: peak ? Math.max(1, Math.ceil(peak.leads / cap)) : 1, confCap: cap, lastDecision: Math.max(0, ...runs.map(x => x.decideDay)) };
}

/** testCash — ننتجو غير اللي ربحو (VALIDE + RESERVE). الباقي: المؤكّد يقول الحقيقة ويقترح الرابح */
function testCash(o) {
  const s = o.settings || {}, rate = o.rate || s.rate || 250, pack = s.pack != null ? s.pack : 0, dc = s.delCost != null ? s.delCost : 0, rc = s.retCost != null ? s.retCost : 0;
  const make = (o.decisions || []).filter(d => d.tag === 'VALIDE' || d.tag === 'ECHEC-RESERVE');
  const del = d => (d.del != null ? d.del : 50) / 100;
  const ads = Math.round((o.adsUsd || 0) * rate), samples = (o.samples || []).reduce((a, b) => a + b, 0);
  const prod = make.reduce((a, d) => a + d.confirmed * d.buy, 0), n = make.reduce((a, d) => a + d.confirmed, 0);
  const delivered = make.reduce((a, d) => a + d.confirmed * del(d), 0), cash = make.reduce((a, d) => a + d.confirmed * del(d) * d.sell, 0);
  const costs = n * pack + delivered * dc + (n - delivered) * rc, back = make.reduce((a, d) => a + d.confirmed * (1 - del(d)) * d.buy, 0), peak = ads + samples + prod + costs;
  return { ads, samples, production: Math.round(prod), costs: Math.round(costs), peak: Math.round(peak), collected: Math.round(cash), net: Math.round(peak - cash), returnedStock: Math.round(back),
    produced: make.map(d => d.name), waiting: (o.decisions || []).filter(d => d.tag === 'TEST' || d.tag === 'FIX').map(d => d.name), cancelled: (o.decisions || []).filter(d => /^ECHEC-(ADS|CONF)$/.test(d.tag)).map(d => d.name) };
}

/** cells — هل التاست يكفي باش نقررو الفائض بالخانة؟ */
function cells({ sizes = 1, colors = 1, confirmed = 0 }, o = {}) {
  const F = { ...FACTS, ...o }, n = Math.max(1, sizes * colors), per = confirmed / n;
  return { cells: n, perCell: r2(per), enough: per >= F.cellMin, maxCells: Math.max(1, Math.floor(confirmed / F.cellMin)),
    text: per >= F.cellMin ? `${n} خانات ونستناو ~${Math.round(per)} طلبية في الخانة ← نقررو الفائض من التاست` : `${n} خانات ونستناو ~${per.toFixed(1)} طلبية في الخانة (يلزم ${F.cellMin}) ← في التاست ما تفوتش ${Math.max(1, Math.floor(confirmed / F.cellMin))} خانات، والفائض يتقرر في VALIDE` };
}

/** plan({ models, settings, testDays?, perDay? }) — قبل اليوم 1 */
function plan(o) {
  const M = o.models || [], lim = M.map(m => limits(m, o.settings, o)), sch = schedule(o), rate = (o.settings && o.settings.rate) || 250;
  const wallet = lim.reduce((a, l) => a + (l.worstSpend || 0), 0), max = lim.reduce((a, l) => a + (l.cap || 0), 0);
  const cl = M.map((m, i) => ({ name: m.name, ...cells({ sizes: m.sizes, colors: m.colors, confirmed: (lim[i].minLeads || FACTS.learningEvents) * (lim[i].conf || 0.5) }, o) }));
  const r = { limits: lim, schedule: sch, wallet: { usd: Math.round(wallet), dzd: Math.round(wallet * rate), maxUsd: Math.round(max) }, cells: cl, facts: { ...FACTS, ...o.facts } };
  r.text = planText(r); return r;
}

function planText(r) {
  const L = ['🧪 أسبوع التاست (كل رقم محسوب من المنتج، ماشي محفوظ)'];
  const s = r.schedule;
  L.push(`  📅 ${s.runs.length} موديلات، ${s.perDay} جداد في النهار (الأقوى أولاً) • آخر قرار: اليوم ${s.lastDecision}`);
  if (s.peak) L.push(`  📈 الذروة: اليوم ${s.peak.day}، ~${s.peak.leads} ليد ← ${s.confirmers} مؤكّد (طاقة ${s.confCap} ليد للمؤكّد)`);
  L.push(`  💼 المحفظة: ~${r.wallet.usd}$ (${E.mil(r.wallet.dzd)}) = كل موديل بالليد الأسوأ • الحد الأقصى ${r.wallet.maxUsd}$ لو كل موديل يوصل للسقف تاعو`);
  r.limits.forEach(x => { if (!x.ok) { L.push(`  • ${x.name}: ناقص السعر`); return; }
    L.push(`  • ${x.name}: ${x.budget}$ في النهار × ${x.days} أيام • الليد الأقصى ${x.maxLead}$ • السقف ${x.ceiling}$ للمؤكّدة (${x.ceilingWorst}$ بتوصيل ${x.delWorst}%) • التأكيد الأدنى ${x.confFloor}% • الحد ${x.cap}$`); });
  r.cells.forEach(c => { if (!c.enough) L.push(`  🧵 ${c.name}: ${c.text}`); });
  L.push('  ⚖️ الحكم: نقتلو كي حتى أحسن حالة فوق السقف، ونقبلو كي حتى أسوأ حالة تحت السقف بالتوصيل الأسوأ (ثقة 90%). بيناتهم نكملو حتى الحد.');
  return L.join('\n');
}

function decide(o) {
  const ds = (o.results || []).map(x => ({ ...judge(x, o.settings, o), sell: x.sell, buy: x.buy, del: x.del }));
  const cash = testCash({ decisions: ds, adsUsd: ds.reduce((a, d) => a + d.spend, 0), settings: o.settings, samples: (o.results || []).map(x => x.buy || 0) });
  const icon = { VALIDE: '🟢', 'ECHEC-RESERVE': '🟡', FIX: '🟡', TEST: '⏳', 'ECHEC-ADS': '🔴', 'ECHEC-CONF': '🔴' };
  const L = ['🧪 قرار التاست (بالإحصاء على الحدود المحسوبة)'];
  ds.forEach(d => L.push(`  ${icon[d.tag] || '•'} ${d.name}: ${d.tag} — ${d.why} ← ${d.next}`));
  L.push(`  💰 كاش التاست: الذروة ~${E.mil(cash.peak)} • يرجع ~${E.mil(cash.collected)} • الصافي ~${E.mil(cash.net)} (+ ستوك راجع ~${E.mil(cash.returnedStock)})`);
  return { decisions: ds, cash, text: L.join('\n') };
}

module.exports = { FACTS, wilson, poissonUp, ceilingAt, limits, judge, schedule, testCash, cells, plan, decide };
