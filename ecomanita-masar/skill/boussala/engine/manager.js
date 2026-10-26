/*!
 * بوصلة التاجر — المسيّر (التقرير اليومي الموحّد)
 * al-KHALiYA © 2026
 * يجمع: النقائص + المسار (SUIVRE) + التوصيل + الخزينة → قائمة وحدة مرتّبة: واش تدير اليوم.
 */
'use strict';
const req = n => require('./' + n);
const { manette } = req('manette.js'); const CF = req('confirmation.js'); const { testAds } = req('testads.js');
const E = req('boussala-engine.js'), { suivre } = req('suivre.js'), { track } = req('livraison.js'), T = req('treasury.js'), { audit } = req('audit.js');
const m = x => E.mil(x) || E.fmt(x) + ' دج';

/**
 * brief({ path, actuals, team, parcels, cash: {cashOnHand, purchaseOrders, ads, payoutEvery, nextPayoutDate, deliveredUnpaid, inTransit, reserve}, snapshot, today })
 */
function brief(i) {
  const today = i.today;
  const out = { today, sections: {}, todo: [] };
  const push = (lvl, src, msg, code) => out.todo.push({ lvl, src, msg, code });

  if (i.snapshot) { const A = audit(i.snapshot, i.path && i.path.settings); out.sections.audit = A; A.findings.filter(x => x.lvl !== 'info').forEach(x => push(x.lvl === 'fix' ? 'warn' : 'ask', 'audit', x.title + (x.ask ? ' — ' + x.ask : ''))); }
  // 🎮 المانيت: الخطوات الحمراء تاع تجهيز الحساب (3 برك فالتقرير اليومي)
  if (i.setup) { const MN = manette(i.setup); out.sections.manette = { score: MN.score, level: MN.level, levelName: MN.levelName, critical: MN.critical };
    MN.todo.filter(c => c.critical).slice(0, 3).forEach(c => push('warn', 'manette', `${c.title} — 👆 ${c.path}`, c.id)); }
  // 📞 التأكيد: الطلبيات اللي دارت 5 دورات بلا اتصال → المناجر ينبّه
  if (i.orders && i.orders.length) { const W = CF.watch({ orders: i.orders, now: i.now || (today ? today + 'T12:00:00Z' : undefined), rule: i.confirmRule }); out.sections.confirmation = W.kpi; W.actions.forEach(a => push(a.lvl, 'confirmation', a.msg, a.code)); }
  // 🧪 تاست الإعلانات
  if (i.marketing) { const TA = testAds({ marketing: i.marketing, ...(i.adsTest || {}), rate: (i.adsTest && i.adsTest.rate) || (i.path && i.path.settings && i.path.settings.rate) }); out.sections.testAds = { verdict: TA.verdict, ads: TA.ads.map(a => ({ name: a.name, status: a.status, leads: a.leads })) };
    TA.actions.filter(a => a.code !== 'ad_learning').forEach(a => push(a.lvl, 'ads', a.msg, a.code)); }
  let C0 = null, cashFreeF;
  if (i.cash) {
    const recent = (i.actuals || []).filter(r => r.date <= today).slice(-21);
    const dd = new Set(recent.map(r => r.date)).size || 1;
    const sellAvg = i.path && i.path.products && i.path.products.length ? i.path.products.reduce((s2, p) => s2 + (+p.sell || 0), 0) / i.path.products.length : 0;
    const dailySales = i.cash.dailySales || (sellAvg ? { orders: recent.reduce((s2, r) => s2 + (+r.delivered || 0), 0) / dd, netPerOrder: sellAvg - ((i.path.settings && i.path.settings.delCost) || 0) } : null);
    C0 = T.cashCalendar({ today, rate: i.path && i.path.settings && i.path.settings.rate, dailySales, ...i.cash });
    const H = ((i.path && i.path.settings && i.path.settings.prepDays) || 5) + 3;
    const minBal = Math.min(...C0.rows.slice(0, H).map(r => r.balance));
    // الاحتياط يكبر مع البيزنس: 5 أيام أدس + 10% من الباقي للورشة (ماشي رقم ثابت تاع البداية)
    const rate0 = (i.path && i.path.settings && i.path.settings.rate) || 245;
    const adsD = ((i.cash.ads && i.cash.ads.dailyUsd) || 0) * rate0;
    const owed = (i.cash.purchaseOrders || []).reduce((s2, po) => s2 + po.qty * po.unitCost * (1 - (po.depositPct || 0) / 100), 0);
    out.reserve = Math.round(Math.max(i.cash.reserve || 0, adsD * 5 + owed * 0.1));
    cashFreeF = Math.max(0, minBal - out.reserve);
  }
  if (i.path && i.actuals && i.actuals.length) {
    const S = suivre({ path: i.path, actuals: i.actuals, team: i.team, previous: Object.fromEntries(Object.entries(i.memory || {}).filter(([k]) => !/^(livraison|cash):/.test(k))), today: i.today, cashFree: cashFreeF, cashNow: i.cash ? Math.max(0, (i.cash.cashOnHand || 0) - (out.reserve || i.cash.reserve || 0)) : undefined, incoming: i.incoming });
    out.sections.suivre = S; out.status = S.status; out.memory = { ...Object.fromEntries(Object.entries(i.memory || {}).filter(([k]) => /^(livraison|cash):/.test(k))), ...S.memory };
    S.alerts.forEach(a => { const quiet = a.repeat && a.lvl !== 'stop' && (a.daysOpen == null || a.daysOpen >= 3); push(quiet ? 'info' : a.lvl, 'suivre', (a.repeat ? `(مازال${a.daysOpen ? ' من ' + a.daysOpen + ' أيام' : ''}) ` : '') + (a.product && !a.msg.includes(a.product) ? a.product + ': ' : '') + a.msg, a.code); });
    S.products.forEach(p => { if (p.testVerdict && p.day && !p._seen) push(p.testVerdict.verdict === 'kill' ? 'stop' : 'info', 'test', `${p.name}: ${p.testVerdict.msg}`); });
    S.levers.slice(0, 3).forEach(l => push('lever', 'levers', `${l.product ? l.product + ': ' : ''}${l.lever}${l.capitalSavedDzd > 0 ? ' ← رأس المال −' + m(l.capitalSavedDzd) : ''}${l.gainDzd ? ' ← +' + m(l.gainDzd) : ''}`));
  }
  // ذاكرة مشتركة: نفس التنبيه (مصدر + كود) يتعاود → «مازال» ويهبط لـ info بعد 3 أيام (إلا STOP)
  const mem = out.memory = out.memory || { ...(i.memory || {}) };
  const seenNow = {};
  const pushMem = (lvl, src, code, msg) => {
    const k = src + ':' + code; seenNow[k] = mem[k] || today;
    const since = mem[k], days = since && today ? Math.round((new Date(today) - new Date(since)) / 864e5) : 0;
    const quiet = since && lvl !== 'stop' && days >= 3;
    push(quiet ? 'info' : lvl, src, (since && days > 0 ? `(مازال من ${days} أيام) ` : '') + msg, code);
  };
  if (i.parcels && i.parcels.length) { const L = track({ ...(i.delivery || {}), parcels: i.parcels, today, preorder: i.path && (i.path.products || []).some(p => p.preorder), prepDays: i.path && i.path.settings && i.path.settings.prepDays }); out.sections.livraison = L; L.actions.forEach(a => pushMem(a.lvl, 'livraison', a.code, a.msg)); }
  if (i.cash) {
    const C = C0; out.sections.cash = C; out.cashFree = cashFreeF;
    C.alerts.forEach(a => pushMem(a.lvl, 'cash', a.lvl, a.msg.replace(/^[🔴🟡]\s*/u, '')));
    if (i.cash.cashInToday > 0) { const Sp = T.split({ cash: i.cash.cashInToday, calendar: C, daysToNextPayout: i.cash.payoutEvery || 7, reserveTarget: C.reserve, reserveNow: i.cash.reserveNow || 0 }); out.sections.split = Sp; }
  }
  Object.keys(mem).filter(k => /^(livraison|cash):/.test(k) && !seenNow[k]).forEach(k => delete mem[k]); Object.assign(mem, seenNow);
  const rank = { stop: 0, warn: 1, ask: 2, lever: 3, info: 4 };
  out.todo.sort((a, b) => rank[a.lvl] - rank[b.lvl]);
  // نفس الرسالة مرتين؟ نخلّيو وحدة
  const seen = new Set(); out.todo = out.todo.filter(t => { const k = t.msg.slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
  out.text = toText(out);
  return out;
}

function toText(o) {
  const ic = { stop: '🔴', warn: '🟡', ask: '❓', lever: '🔑', info: 'ℹ️' };
  const L = [`🧭 البوصلة — تقرير ${o.today || 'اليوم'}`];
  if (o.sections.suivre) L.push(o.sections.suivre.headline);
  if (o.sections.manette) L.push(`🎮 المانيت: المستوى ${o.sections.manette.level} (${o.sections.manette.levelName}) — ${o.sections.manette.score}/100`);
  L.push('');
  L.push('📋 واش تدير اليوم (بالترتيب):');
  o.todo.slice(0, 12).forEach((t, k) => L.push(`${k + 1}. ${ic[t.lvl]} ${t.msg.replace(/^(\p{Extended_Pictographic}\uFE0F?\s*)+/u, '')}`));
  if (o.sections.split) { L.push(''); o.sections.split.pockets.forEach(p => L.push(`  ${p.name}: ${m(p.amount)}`)); }
  if (o.sections.suivre && o.sections.suivre.newPath) { const np = o.sections.suivre.newPath; L.push(''); L.push(`🗺️ المسار بأرقامك اليوم: رأس المال ${np.capitalNeededMil || '—'}${np.daysWithPlannedCapital ? ` • توصل ~اليوم ${np.daysWithPlannedCapital}` : ''}`); }
  return L.join('\n');
}

module.exports = { brief };
