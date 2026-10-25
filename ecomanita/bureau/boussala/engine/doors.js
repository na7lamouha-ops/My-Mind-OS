/*!
 * بوصلة التاجر — أبواب الدخول
 * al-KHALiYA © 2026
 *  1) الهدف        → guide()            (موجود)
 *  2) رأس المال    → reach()            «عندي X، وين نوصل في المدة؟»
 *  3) راني بديت    → fromActuals()      «نخدم من شهر» → المسار من الأرقام الحقيقية
 */
'use strict';
const E = (typeof require === 'function') ? require('./boussala-engine.js') : window.BoussalaEngine;

// 2) أقصى هدف يوصلو رأس المال في المدة (نفس المحاكي، نفس قواعد «عندي رأس مال»)
function reach(input) {
  const C = +input.capital; if (!(C > 0)) throw new Error('capital: لازم رأس مال');
  const base = { ...(input.settings || {}) };
  const ok = T => { const ctx = E.makeCtx({ ...base, target: T }); const prods = input.products.map(p => E.normProduct(p, ctx));
    const r = E.withMyCapital(prods, ctx, C, input.selection); return r.ok && r.days <= ctx.period ? r : null; };
  let lo = 0, hi = C * 2, best = null;
  if (ok(hi)) { while (ok(hi) && hi < 1e10) { lo = hi; hi *= 2; } }
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; const r = ok(mid); if (r) { lo = mid; best = r; } else hi = mid; }
  const target = Math.floor(lo / 10000) * 10000;
  if (!(target > 0)) return { ok: false, reason: 'capital_too_small', msg: 'برأس المال هذا ما توصل حتى لربح في المدة — طوّل المدة ولا بدّل المنتج.' };
  const g = E.guide({ ...input, settings: { ...base, target }, myCapital: C, levers: input.levers });
  return { ok: true, capital: C, period: E.makeCtx(base).period, target, targetMil: E.mil(target), guide: g,
    msg: `برأس مالك ${E.mil(C) || C + ' دج'} في ${E.makeCtx(base).period} يوم، الوجهة الواقعية: ~${E.mil(target)} ربح ${E.makeCtx(base).targetMode === 'cash' ? 'كاش' : 'كاش + سلعة'}.` };
}

// 3) المسار من الأرقام الحقيقية (آخر 14–30 يوم) — نفس شكل actuals تاع suivre
function fromActuals(input) {
  const ctx0 = E.makeCtx(input.settings || {});
  const rows = input.actuals || [], days = new Set(rows.map(r => r.date)).size || 1;
  const byP = {};
  rows.forEach(r => { const k = r.product; const b = (byP[k] = byP[k] || { L: 0, S: 0, C: 0, D: 0, R: 0 });
    b.L += +r.leads || 0; b.S += r.adSpendDzd != null ? +r.adSpendDzd : (+r.adSpendUsd || 0) * ctx0.rate; b.C += +r.confirmed || 0; b.D += +r.delivered || 0; b.R += +r.returned || 0; });
  const known = {}; (input.products || []).forEach(p => known[p.name] = p);
  const products = Object.entries(byP).map(([name, b]) => {
    const k = known[name] || {};
    const closed = b.D + b.R;
    return { ...k, name, leadUsd: b.L > 0 ? +(b.S / b.L / ctx0.rate).toFixed(2) : k.leadUsd,
      conf: b.L >= 30 ? Math.round(b.C / b.L * 1000) / 10 : (k.conf || 50), del: closed >= 20 ? Math.round(b.D / closed * 1000) / 10 : (k.del || 45),
      sell: k.sell, buy: k.buy, tested: k.tested || b.L >= 100, _leadsPerDay: b.L / days };
  }).filter(p => p.sell > 0 && p.buy > 0 && byP[p.name].L > 0); // منتج بلا حتى ليد حقيقي ماشي «راني بديت»
  if (!products.length) throw new Error('products: لازم سعر البيع وسعر الشراء لكل منتج، وليدات حقيقية');
  // الوتيرة الحالية → شحال تربح في المدة لو تكمل كيما راك
  const shared = E.sharedOf(ctx0);
  const pace = products.map(p => { const q = E.normProduct(p, ctx0); const R = E.calcOneProduct(q, shared, 1e6, ctx0); return { name: p.name, leadsPerDay: Math.round(p._leadsPerDay), netPerLead: Math.round(R.netPerLead), profitAtPace: Math.round(R.netPerLead * p._leadsPerDay * ctx0.period) }; });
  const atPace = pace.reduce((s, x) => s + Math.max(0, x.profitAtPace), 0);
  const want = +(input.settings || {}).target > 0 ? +input.settings.target : null;
  const target = want || Math.max(10000, Math.round(atPace / 10000) * 10000);
  const path = { startDate: input.startDate, settings: { ...(input.settings || {}), target }, products: products.map(({ _leadsPerDay, ...p }) => p) };
  return { path, pace, profitAtPace: atPace, profitAtPaceMil: E.mil(atPace), target, gap: want ? want - atPace : 0,
    msg: want ? `لو تكمل كيما راك: ~${E.mil(atPace) || atPace} في ${ctx0.period} يوم. هدفك ${E.mil(want)} — ${want > atPace ? 'الفرق ' + E.mil(want - atPace) + ': البوصلة تحسبلك واش يلزم.' : 'راك فوقو.'}`
      : `ما عندكش هدف؟ وجهتك الحالية (لو تكمل كيما راك): ~${E.mil(atPace) || atPace} في ${ctx0.period} يوم. هذي هي المسار اللي نتابعو بيه.` };
}

// 5) ⚖️ الهدف أكبر من رأس المال: شحال الفرق، و4 طرق باش يتسكّر (وقت / رأس مال / هدف أصغر / روافع مجموعين)
const GAP_LEVERS = [
  { id: 'payout1', effort: 'سهل — تفاوض مع شركة التوصيل', t: 'السحب من شركة التوصيل كل نهار', ok: (s) => (s.payoutEvery || 1) > 1, s: s => ({ ...s, payoutEvery: 1 }) },
  { id: 'del+5', effort: 'متوسط — اتصال قبل الإرسال + رسالة «وصلت لولايتك» + إرسال نفس النهار', t: 'التوصيل +5 نقاط', p: p => ({ ...p, del: Math.min(95, (+p.del || 0) + 5) }) },
  { id: 'price+5', effort: 'متوسط — تاست سعر على نص الترافيك', t: 'السعر +5%', p: p => ({ ...p, sell: Math.round(p.sell * 1.05) }) },
  { id: 'lead-10', effort: 'صعيب — كرياتيف جديد يربح', t: 'الليد −10%', p: p => ({ ...p, ...(p.leadUsd != null ? { leadUsd: +(p.leadUsd * 0.9).toFixed(2) } : { lead: Math.round((p.lead || 0) * 0.9) }) }) },
  { id: 'conf+5', effort: 'متوسط — أول اتصال قبل 15 دقيقة', t: 'التأكيد +5 نقاط', p: p => ({ ...p, conf: Math.min(95, (+p.conf || 0) + 5) }) },
  { id: 'ret0', effort: 'سهل — تفاوض', t: 'الروتور بلاش', ok: (s) => (s.retCost || 0) > 0, s: s => ({ ...s, retCost: 0 }) },
];
function needOf(products, settings) { const ctx = E.makeCtx(settings); const P = products.map(p => E.normProduct(p, ctx)); const pl = E.getChosenPlan(P, ctx, null); return { capital: pl.starterCapital, ctx, P }; }
function gap(input) {
  const C = +input.capital, S0 = { ...(input.settings || {}) }, P0 = input.products || [];
  const base = needOf(P0, S0);
  const mine = E.withMyCapital(base.P, base.ctx, C, null);
  const out = { target: S0.target, period: base.ctx.period, myCapital: C, needDzd: Math.round(base.capital), daysWithMyCapital: mine && mine.ok ? mine.days : null };
  out.covered = isFinite(base.capital) && base.capital <= C;
  if (out.covered) return { ...out, msg: `رأس مالك (${E.mil(C)}) يكفي: الهدف يلزمو ${E.mil(base.capital)}.` };
  // روافع مجموعين (greedy): كل خطوة نختارو الرافعة اللي تنقّص أكثر
  let S = S0, P = P0, cap = base.capital; const used = [], steps = [];
  for (let k = 0; k < GAP_LEVERS.length && cap > C; k++) {
    let best = null;
    for (const L of GAP_LEVERS) { if (used.includes(L.id) || (L.ok && !L.ok(S))) continue;
      const S2 = L.s ? L.s(S) : S, P2 = L.p ? P.map(L.p) : P; const c2 = needOf(P2, S2).capital;
      if (isFinite(c2) && (!best || c2 < best.c2)) best = { L, S2, P2, c2 }; }
    if (!best || !(best.c2 < cap)) break;
    used.push(best.L.id); S = best.S2; P = best.P2; cap = best.c2; steps.push({ id: best.L.id, lever: best.L.t, effort: best.L.effort, needAfterDzd: Math.round(cap) });
  }
  let daysWithLevers = null; if (steps.length) { const n2 = needOf(P, S); const m2 = E.withMyCapital(n2.P, n2.ctx, C, null); daysWithLevers = m2 && m2.ok ? m2.days : null; }
  // 🎯 الواقعي: غير الروافع اللي في يد التاجر (بلا السعر وبلا كرياتيف جديد)
  let realistic = null; { let S3 = S0, P3 = P0; const ids = []; for (const L of GAP_LEVERS) { if (!['payout1', 'del+5', 'conf+5', 'ret0'].includes(L.id) || (L.ok && !L.ok(S3))) continue; ids.push(L.t); if (L.s) S3 = L.s(S3); if (L.p) P3 = P3.map(L.p); }
    const n3 = needOf(P3, S3), m3 = E.withMyCapital(n3.P, n3.ctx, C, null); realistic = { levers: ids, needDzd: Math.round(n3.capital), days: m3 && m3.ok ? m3.days : null }; }
  let reachT = null; try { const r = reach({ products: P0, settings: S0, capital: C, levers: false }); reachT = r.ok ? r.target : null; } catch (e) {}
  const options = [
    out.daysWithMyCapital ? { id: 'time', t: `وقت أكثر: نفس الهدف يوصل حوالي اليوم ${out.daysWithMyCapital} (بلاصة ${out.period})` } : null,
    { id: 'capital', t: `رأس مال أكثر: يلزم ${E.mil(base.capital - C)} زيادة (المجموع ${E.mil(base.capital)})` },
    reachT ? { id: 'smaller', t: `هدف أصغر: برأس مالك في ${out.period} يوم توصل ~${E.mil(reachT)}` } : null,
    steps.length ? { id: 'levers', t: `الروافع مجموعين (${steps.map(x => x.lever).join(' + ')}): رأس المال يهبط لـ ${E.mil(cap)}${cap <= C ? ' ← يكفي ✅' : ` — مازال ناقص ${E.mil(cap - C)}`}${daysWithLevers ? ` • برأس مالك توصل حوالي اليوم ${daysWithLevers}` : ''}` } : null,
  ].filter(Boolean);
  return { ...out, reachInPeriodDzd: reachT, levers: steps, leversEnough: cap <= C, daysWithLevers, realistic, options,
    msg: `⚖️ الهدف (${E.mil(S0.target)} في ${out.period} يوم) يلزمو ${E.mil(base.capital)} — عندك ${E.mil(C)}. الفرق ${E.mil(base.capital - C)}.` };
}

// 6) 🚀 «نزيد قدر المستطاع»: السقف بالكاش (30 يوم) قبل/بعد الحدث (رأس مال جديد، ورشة جديدة)
function growth(input) {
  const S = { ...(input.settings || {}), period: (input.settings && input.settings.period) || 30 };
  // السوق ماشي بلا حد: التكبير +20% كل 3 أيام ≈ ×2.5 في 30 يوم على الوتيرة الحالية (ليد/يوم لكل منتج)
  if (!S.maxLeads && input.currentLeadsPerDay) S.maxLeads = Math.max(10, Math.round(input.currentLeadsPerDay * Math.pow(1.2, S.period / 3 / 2)));
  const rv = (products, settings, cap) => { try { const r = reach({ products, settings, capital: cap, levers: false }); return r.ok ? r : null; } catch (e) { return null; } };
  const base = input.capitalBefore > 0 ? rv(input.products, S, input.capitalBefore) : null;
  let now = rv(input.products, S, input.capitalAfter || input.capitalBefore);
  if (base && (!now || now.target < base.target)) now = { ...base, _sameAsBefore: true }; // كاش زايد ما ينقّصش (ما تستعملوش وخلاص)
  let ws = null;
  if (input.workshop && input.workshop.unitCost) { const P2 = input.products.map(p => (input.workshop.products ? input.workshop.products.includes(p.name) : !p.ready) ? { ...p, buy: Math.min(p.buy, input.workshop.unitCost) } : p);
    ws = rv(P2, { ...S, prepDays: input.workshop.leadDays || S.prepDays }, input.capitalAfter || input.capitalBefore); }
  if (ws && now && ws.target < now.target) ws = { ...now, _noGain: true };
  const best = ws || now;
  const capNotBottleneck = !!(base && now && now.target <= base.target * 1.1);
  const shares = best && best.guide && best.guide.plan ? (best.guide.plan.products || []).map(x => ({ name: x.name, share: x.share, leadsPerDay: x.leadsPerDay })) : [];
  return { period: S.period, capNotBottleneck, maxLeadsPerProduct: S.maxLeads || null, before: base && { capital: input.capitalBefore, targetDzd: base.target }, now: now && { capital: input.capitalAfter, targetDzd: now.target }, withWorkshop: ws && { targetDzd: ws.target, workshop: input.workshop.name }, shares,
    msg: `🚀 السقف بالكاش في ${S.period} يوم${S.maxLeads ? ` (بحد السوق ~${S.maxLeads} ليد/يوم لكل منتج)` : ''}: ${base ? `${E.mil(base.target)} (قبل)` : ''}${now ? ` ← ${E.mil(now.target)} برأس المال الجديد` : ''}${ws ? ` ← ${E.mil(ws.target)} بالورشة الجديدة` : ''}.${capNotBottleneck ? ' ⚠️ الكاش ماشي هو الحد — السوق هو الحد: نفس المنتجات ما يكبروش أكثر بالدراهم. الكاش الجديد يروح لـ: منتجات جديدة (تاست 2–3 بالطلب المسبق)، ستوك الورشة الجديدة، والاحتياط.' : ''}` };
}

const api = { reach, fromActuals, gap, growth };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BoussalaDoors = api;

// 4) هدف بالطلبيات: «نحب نرسل 1000 طلبية في الشهر» → الليدات، الربح، رأس المال
//    التاجر يفكر بالطلبيات، البوصلة تحسب بالربح: نحوّلو ونبيّنو الاتنين.
function fromOrders(input) {
  const ship = +input.shippedPerMonth; if (!(ship > 0)) throw new Error('shippedPerMonth: لازم عدد الطلبيات المرسلة في الشهر');
  const ctx0 = E.makeCtx({ ...(input.settings || {}), period: 30 });
  const prods = input.products.map(p => E.normProduct(p, ctx0));
  const plan0 = E.getChosenPlan(prods, E.makeCtx({ ...(input.settings || {}), period: 30, target: 1e6 }), input.selection);
  const share = plan0.products.map(x => ({ p: x.p, share: x.share }));
  // ربح الشهر لو نرسلو ship طلبية: ship × (توصيل × صافي − (1−توصيل) × روتور) − الأدس
  let profit = 0, leadsDay = 0;
  share.forEach(({ p, share: s }) => {
    const n = ship * s, c = p.conf / 100, d = p.del / 100, L = n / c;
    const sc = ctx0.targetMode === 'cash' ? p.buy * ctx0.surplus * 0.5 : 0;
    profit += n * (d * (p.sell - p.buy - ctx0.pack - ctx0.delCost - sc) - (1 - d) * ctx0.retCost) - L * p.lead;
    leadsDay += L / 30;
  });
  const target = Math.max(10000, Math.floor(profit / 10000) * 10000);
  const g = E.guide({ ...input, settings: { ...(input.settings || {}), period: 30, target }, levers: input.levers });
  return { ok: profit > 0, shippedPerMonth: ship, leadsPerDay: Math.round(leadsDay), deliveredPerMonth: Math.round(share.reduce((s, x) => s + ship * x.share * x.p.del / 100, 0)),
    profitMonth: Math.round(profit), profitMil: E.mil(profit), capital: g.plan.capital, capitalMil: g.plan.capitalMil, guide: g,
    msg: profit > 0 ? `${ship} طلبية مرسلة في الشهر = ~${Math.round(leadsDay)} ليد/يوم • ~${Math.round(share.reduce((s, x) => s + ship * x.share * x.p.del / 100, 0))} موصلة • ربح ~${E.mil(profit)} • تبدا بـ ${g.plan.capitalMil}.`
      : `${ship} طلبية بهذي الأرقام = خسارة — صلّح الأرقام قبل ما تكبّر.` };
}
module.exports.fromOrders = fromOrders;

// 💼 رأس المال العامل الدائم (تاجر خدّام): شحال يبقى مربوط في كل لحظة
//    = أدس تخلّص قبل ما يرجع الكاش + ستوك في المخزن + ستوك في الطريق + كاش عند شركة التوصيل + روتور راجع + عربون الدفعة الجاية
function workingCapital(input) {
  const ctx = E.makeCtx(input.settings || {});
  const ship = +input.shippedPerMonth / 30; // مرسلة/يوم
  const prods = input.products.map(p => E.normProduct(p, ctx));
  const W = input.weights || prods.map(() => 1 / prods.length);
  const dDel = input.deliverDays || 3, dRet = input.returnDays || 7, dDisp = input.dispatchDays || 1;
  const lag = (ctx.payoutEvery > 1 ? ctx.payoutEvery / 2 : 0) + ctx.payoutDays; // متوسط الكاش عند شركة التوصيل
  let parts = { ads: 0, stockHome: 0, stockRoad: 0, atCarrier: 0, returning: 0, nextDeposit: 0 };
  prods.forEach((p, i) => {
    const s = ship * W[i], c = p.conf / 100, d = p.del / 100, L = s / c, buy = p.buy;
    parts.ads += L * p.lead * (ctx.confirmDays + dDisp + dDel + lag);
    parts.stockHome += s * (p.prep || ctx.prepDays) * buy * (1 + ctx.surplus * 0.25);
    parts.stockRoad += s * (dDisp + dDel) * buy;
    parts.atCarrier += s * d * (p.sell - ctx.delCost) * lag;
    parts.returning += s * (1 - d) * dRet * buy;
    parts.nextDeposit += p.preorder ? s * (p.prep || ctx.prepDays) * buy * (p.dep / 100) : 0;
  });
  Object.keys(parts).forEach(k => parts[k] = Math.round(parts[k]));
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  const daily1 = input.payoutLever !== false && ctx.payoutEvery > 1 ? workingCapital({ ...input, settings: { ...(input.settings || {}), payoutEvery: 1 }, payoutLever: false }).total : null;
  return { shippedPerDay: Math.round(ship), parts, total, totalMil: E.mil(total), withDailyPayout: daily1, saving: daily1 != null ? total - daily1 : null,
    labels: { ads: 'أدس تخلّص قبل ما يرجع الكاش', stockHome: 'ستوك في المخزن (أيام التحضير)', stockRoad: 'ستوك في الطريق', atCarrier: 'كاش عند شركة التوصيل', returning: 'روتور راجع', nextDeposit: 'عربون الدفعة الجاية' } };
}
module.exports.workingCapital = workingCapital;
