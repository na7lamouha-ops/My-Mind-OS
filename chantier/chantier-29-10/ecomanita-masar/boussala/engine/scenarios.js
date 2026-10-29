/*!
 * بوصلة التاجر — المجال والاحتمال (بدل رقم واحد)
 * al-KHALiYA © 2026
 * الأرقام اللي كتبها التاجر = «الوسط». نحسبو أحسن حالة، أسوأ حالة، و«شحال من حظ نوصل للهدف في المدة».
 * السحب عشوائي ثابت (seed) باش نفس المدخلات = نفس النتيجة.
 * ملاحظة: الربح الصافي ما فيهش عمولة المؤكّد ولا المصاريف الثابتة (كراء، أجور، اشتراكات) — زيدهم للهدف.
 */
'use strict';
const E = require('./boussala-engine.js');

// الفرق على «الوسط»: أسوأ / أحسن (الليد بالنسبة، التأكيد والتوصيل بالنقاط)
const SPREAD = { lead: [0.25, -0.15], conf: [-6, 4], del: [-8, 5] };
const NOTE = 'ℹ️ الربح الصافي هنا ما فيهش عمولة المؤكّد ولا المصاريف الثابتة (كراء، أجور، اشتراكات): زيدهم للهدف.';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// مثلّثي: min، الوسط (القمة)، max
function tri(u, a, m, b) { const lo = Math.min(a, b), hi = Math.max(a, b); if (hi === lo) return m; const f = (m - lo) / (hi - lo); return u < f ? lo + Math.sqrt(u * (hi - lo) * (m - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - m)); }
const pctl = (arr, q) => { const s = arr.filter(x => x != null && isFinite(x)).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };

function shift(products, k) { // k = { lead: نسبة، conf: نقاط، del: نقاط }
  return products.map(p => ({ ...p, leadUsd: p.leadUsd != null ? +(p.leadUsd * (1 + k.lead)).toFixed(3) : p.leadUsd, lead: p.leadUsd == null && p.lead != null ? Math.round(p.lead * (1 + k.lead)) : p.lead,
    conf: Math.max(5, Math.min(95, p.conf + k.conf)), del: Math.max(5, Math.min(95, p.del + k.del)) }));
}

function runOne(settings, products, C, selection) {
  const ctx = E.makeCtx(settings), P = products.map(p => E.normProduct(p, ctx));
  const plan = E.getChosenPlan(P, ctx, selection);
  const mine = C > 0 ? E.withMyCapital(P, ctx, C, selection) : null;
  return { capital: isFinite(plan.starterCapital) ? Math.round(plan.starterCapital) : null, leadsPerDay: plan.leadsPerDay, delivered: plan.delivered,
    cashDay: mine && mine.ok ? mine.cashDay : null, ok: !!(mine && mine.ok) };
}

/**
 * range({ settings, products, myCapital, deadline, runs?, seed?, spread?, selection? })
 *   deadline = النهار اللي لازم الكاش يكون فيه (من أول نهار بيع)
 */
function range(o) {
  const S = { ...SPREAD, ...(o.spread || {}) }, C = +o.myCapital || 0, D = +o.deadline || null, N = Math.min(1000, o.runs || 300);
  const at = w => ({ lead: w === 'mid' ? 0 : S.lead[w === 'worst' ? 0 : 1], conf: w === 'mid' ? 0 : S.conf[w === 'worst' ? 0 : 1], del: w === 'mid' ? 0 : S.del[w === 'worst' ? 0 : 1] });
  const cases = {}; ['best', 'mid', 'worst'].forEach(w => { cases[w] = { shift: at(w), ...runOne(o.settings, shift(o.products, at(w)), C, o.selection) }; });
  const R = rng(o.seed || 7), runs = [];
  for (let i = 0; i < N; i++) {
    const k = { lead: tri(R(), S.lead[1], 0, S.lead[0]), conf: tri(R(), S.conf[0], 0, S.conf[1]), del: tri(R(), S.del[0], 0, S.del[1]) };
    const r = runOne(o.settings, shift(o.products, k), C, o.selection);
    runs.push({ ...k, ...r, hit: r.ok && (D == null || (r.cashDay != null && r.cashDay <= D)) });
  }
  const hit = runs.filter(r => r.hit).length;
  // شكون يحرّك النتيجة أكثر: نبدّل متغيّر واحد لأسوأ حالة والباقي في الوسط
  const drivers = ['lead', 'conf', 'del'].map(v => { const k = { lead: 0, conf: 0, del: 0 }; k[v] = at('worst')[v]; const r = runOne(o.settings, shift(o.products, k), C, o.selection);
    return { v, label: { lead: 'الليد يغلى ' + Math.round(S.lead[0] * 100) + '%', conf: 'التأكيد ينقص ' + -S.conf[0] + ' نقاط', del: 'التوصيل ينقص ' + -S.del[0] + ' نقاط' }[v], capital: r.capital, cashDay: r.cashDay, capitalUp: r.capital != null && cases.mid.capital != null ? r.capital - cases.mid.capital : null }; })
    .sort((a, b) => (b.capitalUp || 0) - (a.capitalUp || 0));
  const out = { runs: N, deadline: D, myCapital: C, spread: S, cases,
    probability: Math.round(hit / N * 100),
    cashDay: { p10: pctl(runs.map(r => r.cashDay), 0.1), p50: pctl(runs.map(r => r.cashDay), 0.5), p90: pctl(runs.map(r => r.cashDay), 0.9), neverPct: Math.round(runs.filter(r => !r.ok).length / N * 100) },
    capital: { p50: pctl(runs.map(r => r.capital), 0.5), p90: pctl(runs.map(r => r.capital), 0.9) },
    drivers, note: NOTE };
  out.text = rangeText(out);
  return out;
}

function rangeText(r) {
  const m = x => x == null ? '—' : E.mil(x) || E.fmt(x) + ' دج';
  const d = x => x == null ? 'ما يوصلش' : 'النهار ' + x;
  const L = [`🎲 المجال والاحتمال (${r.runs} سيناريو)`];
  L.push(`  🟢 أحسن حالة: رأس المال ${m(r.cases.best.capital)} • الكاش ${d(r.cases.best.cashDay)}`);
  L.push(`  🟡 الوسط (أرقامك): رأس المال ${m(r.cases.mid.capital)} • الكاش ${d(r.cases.mid.cashDay)}`);
  L.push(`  🔴 أسوأ حالة: رأس المال ${m(r.cases.worst.capital)} • الكاش ${d(r.cases.worst.cashDay)}`);
  if (r.myCapital) L.push(`  🎯 احتمال توصل للهدف${r.deadline ? ` قبل النهار ${r.deadline}` : ''} بـ ${m(r.myCapital)}: **${r.probability}%**`);
  if (r.cashDay.p50 != null) L.push(`  📅 نهار الكاش: في الوسط ${r.cashDay.p50} • 9 مرات من 10 قبل ${r.cashDay.p90}${r.cashDay.neverPct ? ` • ${r.cashDay.neverPct}% ما يوصلش برأس مالك` : ''}`);
  L.push(`  ⚖️ أكثر حاجة تحرّك النتيجة: ${r.drivers[0].label} (+${m(r.drivers[0].capitalUp)} رأس مال)`);
  L.push('  ' + r.note);
  return L.join('\n');
}

/**
 * commit({ settings, products, myCapital, deadline, prob?, runs? }) — الالتزام الواقعي
 *  الهدف يبقى بوصلة، والالتزام = أكبر هدف نوصلو قبل deadline بحظ ≥ prob (افتراضي 90% = «9 مرات من 10»، نفس مبدأ أسوأ حالة؛ التاجر يقدر يختار حظ آخر).
 *  ويعطي النهار اللي فيه الهدف الأصلي يوصل لنفس الحظ.
 */
function commit(o) {
  const P = o.prob || 0.9, N = o.runs || 100, T = +(o.settings && o.settings.target) || 1000000, D = +o.deadline || 45;
  const prob = (t, d) => range({ ...o, settings: { ...o.settings, target: t }, deadline: d, runs: N }).probability;
  const target = prob(T, D);
  let lo = 0, hi = T;
  if (target < P * 100) { for (let i = 0; i < 6; i++) { const mid = Math.round((lo + hi) / 2 / 25000) * 25000 || 25000; if (prob(mid, D) >= P * 100) lo = mid; else hi = mid; } } else lo = T;
  let day = null; for (let d = D; d <= D + 60; d += 5) { if (prob(T, d) >= P * 100) { day = d; break; } }
  const out = { prob: Math.round(P * 100), deadline: D, target: T, targetProbability: target, commitment: lo, commitmentProbability: lo ? prob(lo, D) : 0, targetDay: day };
  const m = x => E.mil(x) || E.fmt(x) + ' دج';
  out.text = [`🎯 الالتزام والبوصلة (${N} سيناريو لكل نقطة)`,
    `  • الهدف ${m(T)} قبل النهار ${D}: حظ ${target}%`,
    lo ? `  • الالتزام: ${m(lo)} قبل النهار ${D} (حظ ${out.commitmentProbability}%)` : '  • حتى هدف ما يوصل لـ ' + out.prob + '% في هذي المدة برأس المال هذا',
    day ? `  • البوصلة: ${m(T)} حوالي النهار ${day} بحظ ${out.prob}% ولا أكثر` : `  • ${m(T)} ما يوصلش لـ ${out.prob}% حتى النهار ${D + 60}`,
    '  • الهدف ثابت، والتاريخ يتعاود كل أسبوع بالأرقام الحقيقية.'].join('\n');
  return out;
}

// البوابات: المال يتطلق على مراحل — كل رقم محسوب من المدخلات
//  البوابة 1 (VALIDE) = نقيسو التوصيل الحقيقي بدقة تفرّق بين الوسط والأسوأ (فرق SPREAD.del)، بثقة 90% من الجهتين.
function gates(o) {
  const C = +o.capital || 0, s = o.settings || {}, P = (o.products || []).filter(Boolean), S = { ...SPREAD, ...(o.spread || {}) };
  const ctx = E.makeCtx(s), z = 1.6449, h = Math.abs(S.del[0]) / 100;
  const pDel = P.length ? P.reduce((a, p) => a + (p.del || 50), 0) / P.length / 100 : 0.5, pConf = P.length ? P.reduce((a, p) => a + (p.conf || 55), 0) / P.length / 100 : 0.55;
  const parcels = Math.ceil(z * z * pDel * (1 - pDel) / (h * h)), leads = Math.ceil(parcels / pConf);
  const lead = P.length ? P.reduce((a, p) => a + (p.leadUsd ? p.leadUsd * ctx.rate : (p.lead || 0)), 0) / P.length : 0, buy = P.length ? P.reduce((a, p) => a + (p.buy || 0), 0) / P.length : 0;
  const wait = (ctx.confirmDays || 0) + (ctx.prepDays || 0) + (ctx.deliveryDays || 0), spreadDays = o.measureDays || Math.max(5, wait);
  const g1 = Math.round(leads * lead + parcels * (buy + (ctx.pack || 0))), team = Math.max(1, Math.ceil(leads / spreadDays / (ctx.confCap || 60)));
  const G = [
    { id: 0, tag: 'TEST', do: 'boussala_testweek: الموديلات حسب boussala_pick، والحدود محسوبة لكل موديل', pass: 'عدد الرابحين اللي تحتاجهم الخطة', money: 'محفظة التاست برك' },
    { id: 1, tag: 'VALIDE', do: `~${parcels} كولي متبعوث (باش نعرفو التوصيل بدقة ±${Math.round(h * 100)} نقاط) ← ~${leads} ليد على ${spreadDays} أيام (~${Math.ceil(leads / spreadDays)} في النهار، ${team} مؤكّد)`, pass: 'التوصيل الحقيقي ماشي تحت الأسوأ، كوسط ديليفري تحت الخطة، والورشة تسلّم في الوقت', money: g1, share: C ? g1 / C : null },
    { id: 2, tag: 'SCALE', do: 'نزيدو غير قدّ ما يحمل الفريق (المؤكّدين × الطاقة، والجديد بالنص في أسبوعو الأول) والكاش اللي رجع', pass: 'كوسط ديليفري تحت الخطة على طلبيات كمّلت دورتها', money: 'دفعة على كل دورة، من الكاش اللي رجع' },
  ];
  const L = ['🚪 البوابات (محسوبة من المنتجات ورأس المال)'];
  G.forEach(g => L.push(`  ${g.id} · ${g.tag}: ${g.do} ← باش نعدّيو: ${g.pass} ← المال: ${typeof g.money === 'number' ? '~' + (E.mil(g.money) || E.fmt(g.money) + ' دج') + (g.share ? ` (${Math.round(g.share * 100)}% من رأس المال)` : '') : g.money}`));
  L.push(o.maxLoss ? `  🛑 أقصى خسارة: ${E.mil(o.maxLoss)}. كي نوصلوها نوقفو: التاريخ يتحرّك، الخسارة لا.` : '  🛑 أقصى خسارة: سقسي التاجر وكتبها قبل اليوم 1.');
  L.push(`  📆 آخر طلبية للورشة: ${(ctx.prepDays || 0) + (ctx.deliveryDays || 0)} أيام قبل نهاية الموسم (التحضير + التوصيل)، وما نكبّروش في آخر دورة.`);
  return { gates: G, parcels, leads, team, text: L.join('\n') };
}

module.exports = { range, rangeText, commit, gates, SPREAD, NOTE };
