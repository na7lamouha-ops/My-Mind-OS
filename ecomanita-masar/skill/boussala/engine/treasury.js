/*!
 * بوصلة التاجر — الخزينة (السيولة يوم بيوم + تقسيم المحفظة)
 * al-KHALiYA © 2026
 *  planCalendar(): قبل التاست — من المحاكي: وقتاش تخلّص العربون، الباقي، الأدس، ووقتاش يرجع الكاش (بالتواريخ)
 *  cashCalendar(): في الحملة — بالأرقام الحقيقية: الكاش في اليد، اللي راجع من شركة التوصيل، طلبيات الورشة، فواتير Meta
 *  split(): تقسيم الكاش اللي رجع على 4 جيوب
 */
'use strict';
const E = (typeof require === 'function') ? require('./boussala-engine.js') : window.BoussalaEngine;
const f = n => E.fmt(n), m = x => E.mil(x) || f(x) + ' دج';
const dayMs = 864e5;
const iso = d => new Date(d).toISOString().slice(0, 10);
const addDays = (d, n) => iso(new Date(new Date(d).getTime() + n * dayMs));

// ── قبل التاست: الرزنامة من المحاكي ──
function planCalendar(input) {
  const ctx = E.makeCtx(input.settings || {});
  const products = (input.products || []).map(p => E.normProduct(p, ctx));
  const plan = E.getChosenPlan(products, ctx, input.selection);
  const C = +input.capital > 0 ? +input.capital : plan.starterCapital;
  if (!isFinite(C)) return { ok: false, reason: 'no_capital' };
  const start = input.startDate || iso(Date.now());
  const sim = E.simPlan(plan, E.sharedOf(ctx), C, ctx.target, ctx.maxLeads, plan.cycleDays || 6, 730,
    { ...E.personaOpts(ctx), P: plan.capDays || ctx.period, noBrake: !(+input.capital > 0), ledger: true }, ctx);
  const days = new Map();
  (sim.ledgers || []).forEach((lg, pi) => lg.forEach(x => {
    const k = x.day; const d = days.get(k) || { day: k, cashIn: 0, ads: 0, deposit: 0, remainder: 0, leads: 0, orders: [] };
    d.cashIn += x.cashIn; d.ads += x.ads; d.deposit += x.stock; d.remainder += x.remainder; d.leads += x.leads || 0;
    if (x.pieces > 0.5) d.orders.push({ product: plan.products[pi].p.name, pieces: Math.round(x.pieces), deposit: Math.round(x.stock), full: Math.round(x.stockFull), forSellDay: x.forDay });
    days.set(k, d);
  }));
  let bal = C; const rows = [...days.values()].sort((a, b) => a.day - b.day).map(d => {
    bal += d.cashIn - d.ads - d.deposit - d.remainder;
    return { ...d, date: addDays(start, d.day - 1), balance: Math.round(bal) };
  });
  const minRow = rows.reduce((a, b) => (b.balance < a.balance ? b : a), rows[0] || { balance: C });
  const events = [];
  // الورشة تبيع بالدفعات (50 قطعة على الأقل): نجمّعو الشريات الصغيرة تاع المحاكي في دفعات حقيقية
  const MIN = input.minBatch || 50, prep = ctx.prepDays;
  const acc = {};
  rows.forEach(r => {
    r.orders.forEach(o => {
      const a = (acc[o.product] = acc[o.product] || { pieces: 0, deposit: 0, full: 0, first: r });
      if (!a.pieces) a.first = r;
      a.pieces += o.pieces; a.deposit += o.deposit; a.full += o.full;
      if (a.pieces >= MIN) {
        const due = addDays(a.first.date, prep);
        events.push({ date: a.first.date, day: a.first.day, type: 'order', text: `اطلب ~${Math.round(a.pieces)} قطعة ${o.product}${a.deposit < a.full - 1 ? ` — عربون ${m(a.deposit)}، والباقي ${m(a.full - a.deposit)} نهار الاستلام (${due})` : ` — ${m(a.full)}`}` });
        if (a.full - a.deposit > 1000) events.push({ date: due, day: a.first.day + prep, type: 'pay', text: `استلام ${o.product} (~${Math.round(a.pieces)} قطعة): خلّص الباقي ${m(a.full - a.deposit)}` });
        acc[o.product] = { pieces: 0, deposit: 0, full: 0 };
      }
    });
  });
  const firstIn = rows.find(r => r.cashIn > 0);
  if (firstIn) events.push({ date: firstIn.date, day: firstIn.day, type: 'cash', text: `أول كاش يرجع من شركة التوصيل: ~${m(firstIn.cashIn)}` });
  if (minRow) events.push({ date: minRow.date, day: minRow.day, type: 'low', text: `أصعب نهار: يبقالك ~${m(minRow.balance)} — ما تصرفش حاجة برا الخطة هذا الأسبوع` });
  events.sort((a, b) => a.day - b.day);
  return { ok: true, capital: C, start, rows, events, minBalance: minRow ? minRow.balance : null, payoutEvery: ctx.payoutEvery };
}

// ── في الحملة: السيولة الحقيقية ──
/**
 * cashCalendar({
 *   today, cashOnHand, rate, horizon (14),
 *   payoutEvery (أيام بين كل سحب), nextPayoutDate?,
 *   deliveredUnpaid (دج — موصلة ماشي مخلّصة),
 *   inTransit: { orders, avgTotal, delRate, delCost }   // راح يوصلو ويتخلّصو
 *   dailySales: { orders/day موصلة متوقعة, netPerOrder (بيع − فرق التوصيل) } // من المسار
 *   purchaseOrders: [{ name, product, qty, unitCost, depositPct, depositPaid, orderDate, dueDate, tranches:[{date, qty}] }],
 *   ads: { dailyUsd, accounts:[{ name, thresholdUsd, spentSinceBillUsd }] },
 *   fixed: [{ date, amount, name }],
 *   reserve (دج)  ولا reservePct من الكاش
 * })
 */
function cashCalendar(o) {
  const H = Math.min(60, Math.max(3, o.horizon || 14)), rate = o.rate || 245, today = o.today || iso(Date.now());
  const PE = Math.max(1, o.payoutEvery || 1);
  let nextPay = o.nextPayoutDate || today;
  const rows = [];
  let bal = +o.cashOnHand || 0;
  const accts = ((o.ads && o.ads.accounts) || []).map(a => ({ ...a, acc: +a.spentSinceBillUsd || 0 }));
  const adsDailyUsd = (o.ads && +o.ads.dailyUsd) || 0;
  let pendingIn = +o.deliveredUnpaid || 0;
  const it = o.inTransit || null;
  // الطلبيات في الطريق: يوصلو على 3 أيام
  const transitIn = it ? (it.orders * (it.delRate || 0.45) * ((it.avgTotal || 0) - (it.delCost || 0))) : 0;
  const ds = o.dailySales || null;
  for (let i = 0; i < H; i++) {
    const date = addDays(today, i); const r = { date, in: 0, ads: 0, stock: 0, fixed: 0, notes: [] };
    if (it && i >= 1 && i <= 3) pendingIn += transitIn / 3;
    if (ds && i >= 4) pendingIn += (ds.orders || 0) * (ds.netPerOrder || 0);
    if (date >= nextPay && pendingIn > 0) { r.in += pendingIn; r.notes.push(`سحب شركة التوصيل ~${m(pendingIn)}`); pendingIn = 0; nextPay = addDays(date, PE); }
    else if (date >= nextPay) nextPay = addDays(date, PE);
    // الأدس: بالعتبة لو كاين حسابات
    if (adsDailyUsd > 0) {
      if (accts.length) {
        const share = adsDailyUsd / accts.length;
        accts.forEach(a => { a.acc += share; if (a.thresholdUsd > 0 && a.acc >= a.thresholdUsd) { r.ads += a.thresholdUsd * rate; r.notes.push(`فاتورة ${a.name || 'Meta'} $${a.thresholdUsd}`); a.acc -= a.thresholdUsd; } });
      } else r.ads += adsDailyUsd * rate;
    }
    (o.purchaseOrders || []).forEach(po => {
      const full = po.qty * po.unitCost, dep = full * (po.depositPct || 0) / 100;
      if (!po.depositPaid && po.orderDate === date && dep > 0) { r.stock += dep; r.notes.push(`عربون ${po.name || po.product} ${m(dep)}`); }
      const rest = full - dep;
      if (po.tranches && po.tranches.length) {
        const tq = po.tranches.reduce((s, t) => s + t.qty, 0) || 1;
        po.tranches.forEach(t => { if (t.date === date) { const a = rest * t.qty / tq; r.stock += a; r.notes.push(`دفعة ${po.name || po.product}: ${t.qty} قطعة — ${m(a)}`); } });
      } else if (po.dueDate === date && rest > 0) { r.stock += rest; r.notes.push(`الباقي ${po.name || po.product} (${po.qty} قطعة) — ${m(rest)}`); }
    });
    (o.fixed || []).forEach(x => { if (x.date === date) { r.fixed += x.amount; r.notes.push(x.name + ' ' + m(x.amount)); } });
    bal += r.in - r.ads - r.stock - r.fixed; r.balance = Math.round(bal);
    rows.push(r);
  }
  const reserve = o.reserve != null ? o.reserve : Math.round((o.reservePct != null ? o.reservePct : 0.2) * (+o.cashOnHand || 0));
  const short = rows.filter(r => r.balance < 0);
  const tight = rows.filter(r => r.balance >= 0 && r.balance < reserve);
  const alerts = [];
  if (short.length) {
    const worst = short.reduce((a, b) => (b.balance < a.balance ? b : a));
    alerts.push({ lvl: 'stop', date: short[0].date, gap: -worst.balance,
      msg: `🔴 نهار ${short[0].date} الكاش يولّي سالب (أسوأ نهار ${worst.date}: ناقص ${m(-worst.balance)}). الحلول بالترتيب: (1) اطلب من شركة التوصيل سحب قبل هذاك النهار، (2) اطلب من الورشة التسليم والخلاص على دفعات كل 2 أيام، (3) نقّص الأدس على المنتج الأضعف، (4) الاحتياط.` });
  } else if (tight.length) alerts.push({ lvl: 'warn', date: tight[0].date, msg: `🟡 نهار ${tight[0].date} تهبط تحت الاحتياط (${m(reserve)}). ما تزيدش الميزانية قبل السحب الجاي.` });
  return { rows, reserve, alerts, endBalance: rows.length ? rows[rows.length - 1].balance : bal };
}

// ── تقسيم الكاش اللي رجع: 4 جيوب ──
function split(o) {
  const cash = +o.cash || 0;
  const cal = o.calendar || null;
  const daysToNext = Math.max(1, o.daysToNextPayout || 7);
  const stockDue = o.stockDue != null ? o.stockDue : (cal ? cal.rows.slice(0, daysToNext + 1).reduce((s, r) => s + r.stock, 0) : 0);
  const adsDue = o.adsDue != null ? o.adsDue : (cal ? cal.rows.slice(0, daysToNext + 1).reduce((s, r) => s + r.ads, 0) : 0);
  const reserveTarget = o.reserveTarget || 0, reserveNow = o.reserveNow || 0;
  let left = cash; const take = x => { const t = Math.max(0, Math.min(left, x)); left -= t; return t; };
  const pockets = [
    { k: 'stock', name: '🧵 جيب الستوك', amount: take(stockDue), why: 'العربون والباقي للورشة قبل السحب الجاي' },
    { k: 'ads', name: '📣 جيب الأدس', amount: take(adsDue), why: `أدس ${daysToNext} أيام (حتى السحب الجاي)` },
    { k: 'reserve', name: '🛡️ الاحتياط', amount: take(Math.max(0, reserveTarget - reserveNow)), why: 'للمفاجآت: روتور كثير، فيديو يطيح، تأخير شركة التوصيل' },
  ];
  pockets.push({ k: 'goal', name: '🎯 جيب الهدف', amount: left, why: 'ربح مقفول — ما يتسحبش حتى توصل الهدف. يتعاود يستثمر غير بقرار تكبير.' });
  const short = (stockDue + adsDue) - cash;
  return { cash, pockets, short: short > 0 ? short : 0,
    steps: [
      'في تسيير ← المالية ← المحافظ: خلّي 4 محافظ — 🧵 الستوك (MARCHANDISE)، 📣 الأدس (ADS، مربوطة بكل حسابات Meta/TikTok باش الأدس يتنقّص وحدو)، 🛡️ الاحتياط، 🎯 الهدف.',
      'كي يدخل سحب شركة التوصيل (PAIEMENTS): حوّل المبالغ تحت للمحافظ نهارها — ما تخلّيش الكاش كامل في محفظة وحدة.',
      'سجّل كل خلاص للورشة من محفظة الستوك نهارو (العربون وحدو، الباقي وحدو)، وزيد الباقي وتاريخو في «المصاريف» (Costs) باش يبان في «واش جاي».',
      'محفظة سالبة = الرصيد الحقيقي ما تسجّلش: سجّل واش عندك فعلاً («Record what you actually have»).',
      'ما تسحبش من محفظة الهدف حتى توصل الهدف. التكبير يتموّل منها غير كي البوصلة تقول «كبّر».',
    ] };
}

function calendarText(c, title) {
  const L = [title || '💰 الخزينة — السيولة'];
  (c.alerts || []).forEach(a => L.push(a.msg));
  c.rows.filter(r => r.notes.length).forEach(r => L.push(`  ${r.date}: ${r.notes.join(' • ')} → يبقى ${m(r.balance)}`));
  return L.join('\n');
}
function splitText(s) {
  const L = [`💼 تقسيم ${m(s.cash)}:`];
  s.pockets.forEach(p => L.push(`  ${p.name}: ${m(p.amount)} — ${p.why}`));
  if (s.short > 0) L.push(`  ⚠️ ناقص ${m(s.short)} باش تغطي الستوك والأدس قبل السحب الجاي.`);
  L.push('الخطوات:'); s.steps.forEach((x, i) => L.push(`  ${i + 1}. ${x}`));
  return L.join('\n');
}

const api = { planCalendar, cashCalendar, split, calendarText, splitText };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BoussalaTreasury = api;
