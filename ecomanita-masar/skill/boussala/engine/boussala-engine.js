/*!
 * بوصلة التاجر — محرّك V29 (بلا واجهة)
 * al-KHALiYA © 2026 — نفس معادلات الأداة al-khaliya.space (نسخة 21 أكتوبر 2026)
 * يخدم في Node.js 18+ وفي المتصفح، بلا أي مكتبة.
 *
 * المبدأ: كل رقم يطلع من هنا = نفس الرقم اللي تعطيه الأداة بنفس المدخلات.
 * الاختبارات: tests/golden-v29.json (مأخوذة من الأداة الحية).
 */
'use strict';

const ENGINE_VERSION = '29.18.0'; // معادلات الأداة V29 + الوكيل (الخزينة، التوصيل، النقائص، الأبواب)

// ══ المدخلات الافتراضية (نفس قيم الأداة) ══
const DEFAULTS = Object.freeze({
  target: 1000000,      // الهدف: ربح صافي (دج)
  rate: 245,            // سعر الدولار (دج)
  pack: 50,             // تغليف / موصلة (دج)
  delCost: 200,         // فرق التوصيل / موصلة (دج)
  retCost: 100,         // روتور / راجعة (دج)
  surplus: 20,          // فائض المقاسات العام (%)
  period: 40,           // أيام البيع
  targetMode: 'cash',   // 'cash' = كاش فقط (كاش مربوح) | 'mixed' = كاش + سلعة (على الورق)
  persona: 'beginner',  // 'beginner' | 'pro'
  deliveryDays: 3,      // أيام التوصيل
  confirmDays: 1,       // تأكيد وإرسال (0–5)
  retBackDays: 5,       // رجوع الروتور للمخزن
  payoutDays: 2,        // سحب الكاش من شركة التوصيل
  prepDays: 5,          // تحضير الدفعة (خياطة / تعمير)
  maxLeads: null,       // سقف الليدات/يوم لكل منتج (null = بلا سقف)
  abandon: 15,          // الليدات الضايعة (% من الليدات)
  abRec: 25,            // شحال ترجّع منهم (%) — فرضية
  abOn: false,          // نحسبو المسترجعة داخل الخطة؟ (الأداة: لا، تعرضها كربح زايد)
  returned: 0,          // عدد الطلبيات المتروكة اللي عندك (رقم)
  recRate: 0,           // نسبة استرجاعها (%)
  confCap: 80,          // طاقة مؤكّد (ليد/يوم)
  payoutEvery: 1,       // شركة التوصيل تخلّص كل كم يوم (1 = كل نهار)
  trackCap: 60,         // طاقة متتبّع (مؤكدة/يوم)
});

const PRODUCT_DEFAULTS = Object.freeze({
  name: 'منتج', sell: 0, buy: 0, leadUsd: null, lead: null,
  conf: 50, del: 50, preorder: false, dep: 50, ready: false, surp: null, prep: 0,
});

// ══ السياق: نحوّل المدخلات لسياق ثابت (بدل DOM) ══
function makeCtx(input) {
  const c = { ...DEFAULTS, ...(input || {}) };
  const n = (x, d) => (x === null || x === undefined || x === '' || isNaN(+x)) ? d : +x;
  const ctx = {
    target: n(c.target, 0),
    rate: n(c.rate, 0) > 0 ? +c.rate : 245,
    pack: n(c.pack, 0), delCost: n(c.delCost, 0), retCost: n(c.retCost, 0),
    surplus: Math.min(0.5, Math.max(0, n(c.surplus, 0) / 100)),
    period: Math.min(365, Math.max(1, parseInt(n(c.period, 30), 10) || 30)),
    targetMode: c.targetMode === 'mixed' ? 'mixed' : 'cash',
    persona: c.persona === 'pro' ? 'pro' : 'beginner',
    deliveryDays: Math.max(0, Math.round(n(c.deliveryDays, 3))),
    confirmDays: Math.min(5, Math.max(0, Math.round(n(c.confirmDays, 0)))),
    retBackDays: Math.min(60, Math.max(0, Math.round(n(c.retBackDays, 0)))),
    payoutDays: Math.min(60, Math.max(0, Math.round(n(c.payoutDays, 0)))),
    prepDays: Math.min(120, Math.max(1, Math.round(n(c.prepDays, 0) || 5))),
    maxLeads: n(c.maxLeads, 0) > 0 ? +c.maxLeads : 1e9,
    abandon: n(c.abandon, 0), abRec: n(c.abRec, 0), abOn: !!c.abOn,
    returned: n(c.returned, 0), recRate: n(c.recRate, 0),
    confCap: n(c.confCap, 0) || 1, trackCap: n(c.trackCap, 0) || 1,
    payoutEvery: Math.min(30, Math.max(1, Math.round(n(c.payoutEvery, 1)))),
    _memo: new Map(),
  };
  ctx.cycleDays = ctx.confirmDays + ctx.deliveryDays + ctx.payoutDays; // دورة الكاش
  return ctx;
}

function normProduct(p, ctx) {
  const q = { ...PRODUCT_DEFAULTS, ...(p || {}) };
  q.sell = +q.sell || 0; q.buy = +q.buy || 0;
  q.conf = +q.conf || 0; q.del = +q.del || 0;
  if (q.leadUsd !== null && q.leadUsd !== undefined && q.leadUsd !== '') {
    q.leadUsd = +q.leadUsd;
    q.lead = Math.round(q.leadUsd * ctx.rate); // نفس الأداة: الدولار → دينار
  } else { q.lead = Math.round(+q.lead || 0); q.leadUsd = ctx.rate > 0 ? +(q.lead / ctx.rate).toFixed(1) : 0; }
  q.dep = q.preorder ? Math.min(100, Math.max(5, +q.dep || 50)) : (+q.dep || 50);
  if (q.ready) { q.preorder = false; q.surp = (q.surp !== null && q.surp !== undefined && q.surp !== '') ? Math.min(90, Math.max(0, +q.surp)) : 35; }
  q.prep = +q.prep > 0 ? Math.min(120, +q.prep) : 0;
  return q;
}

// ══ مساعدات ══
const capL = ctx => ctx.maxLeads;
function abRaw(ctx) { return Math.max(0, (ctx.abandon / 100) * (ctx.abRec / 100)); }
function abRate(ctx) { return ctx.abOn ? abRaw(ctx) : 0; }
function personaOpts(ctx) { return ctx.persona === 'pro' ? { reserve: 0.10, grow: 0.50 } : { reserve: 0.20, grow: 0.25 }; }
function prodSurplus(p, base) { return p && p.ready ? Math.min(0.9, Math.max(0, (p.surp != null ? p.surp : 35) / 100)) : base; }
function prodPrepOf(p) { return p && p.prep > 0 ? p.prep : (p && p.ready ? 1 : 0); }
function ecoOf(p, v, surplus, ctx) {
  return { L: p.lead, c: Math.min(1, p.conf / 100 + abRate(ctx)), d: p.del / 100, sell: p.sell, buy: p.buy,
    pack: v.pack, delCost: v.delCost, retCost: v.retCost, s: surplus };
}
function sharedOf(ctx) {
  return { rate: ctx.rate, pack: ctx.pack, delCost: ctx.delCost, retCost: ctx.retCost, surplus: ctx.surplus,
    periodDays: ctx.period, cycleDays: ctx.cycleDays || 6, prodDays: ctx.prepDays };
}
// 10,000 دج = 1 مليون (بلا سنتيم)
function mil(x) {
  if (!(x >= 10000)) return '';
  const m = x / 10000, f = n => (Math.round(n * 10) / 10).toLocaleString('en-US');
  return m >= 1000 ? f(m / 1000) + ' مليار' : f(m) + ' مليون';
}
function fmt(n) { if (isNaN(n) || !isFinite(n)) return '—'; const x = Math.round(n); return (x < 0 ? '-' : '') + Math.abs(x).toLocaleString('en-US'); }

// ══ الحساب الأساسي ══
function calcCore(v, tgt, ctx) {
  const cE = Math.min(1, v.conf + (v.ab || 0));
  const delRate = cE * v.del;
  const retRate = cE * (1 - v.del);
  const ppo = v.sell - v.buy - v.pack - v.delCost;
  const sc = v.surplusCost || 0;
  const netPerLead = delRate * (ppo - sc) - retRate * v.retCost - v.lead;
  let leads = 0, confirmed = 0, delivered = 0, returned = 0, adsReq = 0;
  if (netPerLead > 0) {
    leads = Math.ceil(tgt / netPerLead - 1e-7);
    confirmed = Math.ceil(leads * cE);
    delivered = Math.ceil(leads * delRate);
    returned = Math.ceil(leads * retRate);
    adsReq = leads * v.lead;
  }
  let finalProfit;
  if (v.adSpend > 0) {
    const totAds = v.adSpend * ctx.period;
    const totLeads = v.lead > 0 ? totAds / v.lead : 0;
    finalProfit = totLeads * delRate * (ppo - sc) - totLeads * retRate * v.retCost - totAds;
  } else {
    finalProfit = delivered * (ppo - sc) - returned * v.retCost - adsReq;
  }
  return { leads, confirmed, delivered, returned, adsReq, finalProfit, ppo, netPerLead, delRate, retRate };
}

// ══ المحاكي الواقعي — يوم بيوم ══
function simOne(e, C, target, capLeads, T, maxDays, opt, ctx) {
  opt = opt || personaOpts(ctx);
  if (ctx.targetMode === 'cash' && !opt._mix) {
    let tgt = target, r = null;
    for (let it = 0; it < 16; it++) {
      r = simOne(e, C, tgt, capLeads, T, maxDays, { ...opt, _mix: true }, ctx);
      if (r.stopDay === null) break;
      const cashGot = r.cash - C;
      if (cashGot >= target) break;
      let nx = Math.max(tgt + (target - cashGot) * 1.15 + target * 0.005, target + (r.stockLoop != null ? r.stockLoop : r.stock));
      if (it >= 7 && cashGot > 0) nx = Math.max(nx, tgt * Math.min(3, target / cashGot) * 1.01);
      tgt = nx;
    }
    if (r && r.stopDay !== null && (r.cash - C) < target * 0.995) r = { ...r, reached: null };
    return r;
  }
  maxDays = maxDays || 365; opt = opt || personaOpts(ctx);
  const deliv = opt.deliv != null ? opt.deliv : (ctx.confirmDays + ctx.deliveryDays),
    pay = opt.pay != null ? opt.pay : ctx.payoutDays,
    prod = opt.prod != null ? opt.prod : ctx.prepDays;
  const pre = !!opt.pre, dep = pre ? Math.min(1, Math.max(0.05, (opt.dep != null ? opt.dep : 50) / 100)) : 1, off = prod, dly = 0, cdP = ctx.confirmDays;
  let remOwed = 0, insolvent = false;
  const Tc0 = deliv + pay, Tr0 = opt.deliv != null ? Tc0 : Math.max(deliv, ctx.confirmDays + ctx.retBackDays);
  const PE = ctx.payoutEvery || 1, payAt = d => PE > 1 ? Math.ceil(d / PE) * PE : d;
  const Tc = Tc0 + dly, Tr = Tr0 + dly, N = maxDays + Math.max(Tc, Tr) + 2 * prod + 8 + PE;
  const remD = new Float64Array(N + cdP + 2);
  const cin = new Float64Array(N), rin = new Float64Array(N), arr = new Float64Array(N), planN = new Float64Array(N);
  const dlv = new Float64Array(N);
  let cumIn = 0, cumDlv = 0, payDay = null, payDel = null, rotStock = 0, rotAds = 0, minCash = Infinity, snapS = 0, snapA = 0, snapI = 0;
  let handDay = null; const hc = [];
  let cash = C, inv = 0, dead = 0, stopDay = null, reached = null, totLeads = 0, peakLeads = 0, capHitDay = null, firstN = 0, firstDay = null;
  const reserve = C * opt.reserve;
  const netIn = e.c * e.d * (e.sell - e.delCost) - e.c * (1 - e.d) * e.retCost;
  const perAds = e.L + e.c * e.d * e.pack;
  const buyU = e.buy * (1 + e.s);
  const log = []; let allow = Infinity; const g = Math.pow(1 + opt.grow, 1 / Tc);
  const Ps = opt.P || null;
  const plMix = netIn - perAds - e.c * e.d * e.buy;
  let lastD = 0; const ledger = opt.ledger ? [] : null;
  for (let day = 1; day <= maxDays + off; day++) {
    lastD = day; const L0 = ledger ? { day: day - off, cashIn: cin[day], remainder: remD[day] > 0 ? remD[day] : 0, ads: 0, stock: 0 } : null;
    cash += cin[day]; inv += rin[day] + arr[day];
    if (remD[day] > 0) { cash -= remD[day]; remOwed -= remD[day]; if (cash < -1) insolvent = true; }
    cumIn += cin[day]; cumDlv += dlv[day];
    if (payDay === null && C > 0 && cumIn >= C) { payDay = day; payDel = cumDlv; }
    let n = planN[day];
    if (n > 0) {
      n = Math.min(n, cash / perAds, e.c > 0 ? inv / e.c : n);
      cash -= n * perAds; inv -= n * e.c; rotAds += n * perAds; if (L0) { L0.ads = n * perAds; L0.leads = n; }
      const pd = payAt(day + Tc); cin[pd] += n * netIn; rin[day + Tr] += n * e.c * (1 - e.d); dlv[pd] += n * e.c * e.d;
      totLeads += n; peakLeads = Math.max(peakLeads, n);
      if (firstDay === null) { firstDay = day; firstN = n; }
      if (capHitDay === null && n >= capLeads * 0.98) capHitDay = day;
    }
    let pc = 0, pr = 0, pa = 0; for (let k = day + 1; k < N; k++) { pc += cin[k]; pr += rin[k]; pa += arr[k]; }
    const eqM = cash + pc + (inv + pr + pa + dead) * e.buy - C - remOwed;
    const equity = eqM;
    if (stopDay === null && equity >= target) stopDay = day;
    if (stopDay === null) {
      const t = day + off;
      let adsF = 0, used = 0, incoming = 0;
      for (let k = day + 1; k < t; k++) { adsF += planN[k] * perAds; used += planN[k] * e.c; }
      for (let k = day + 1; k <= t; k++) incoming += rin[k] + arr[k];
      const invProj = Math.max(0, inv + incoming - used);
      let avail = Math.max(0, cash - reserve - adsF - remOwed);
      let availNow = avail;
      if (pre) { let ci = 0; for (let k = day + 1; k <= t + cdP; k++) ci += cin[k]; avail += ci; }
      if (day <= Tc) { avail = avail / (Tc - day + 1); availNow = availNow / (Tc - day + 1); }
      let nt = (e.c > 0 && (invProj / e.c) * perAds >= avail) ? avail / perAds : (avail + invProj * buyU) / (perAds + e.c * buyU);
      if (pre && e.c > 0) nt = Math.min(nt, (availNow / (dep * buyU) + invProj) / e.c);
      if (day > Tc && !opt.noBrake) allow *= g;
      let futN = 0; for (let k = day + 1; k < N; k++) futN += planN[k];
      const gap = target * 1.03 - eqM - futN * plMix;
      const remaining = plMix > 0 ? Math.max(0, gap) / plMix : Infinity;
      const sd = t - off, daysLeft = Ps ? Math.max(1, Ps - sd + 1) : 1;
      const pace = isFinite(remaining) ? remaining / daysLeft : Infinity;
      nt = Math.max(0, Math.min(nt, capLeads, allow, pace));
      if (day === Tc && !opt.noBrake) allow = Math.max(nt, 1);
      const bought = Math.max(0, nt * e.c - invProj);
      const sEff = (day <= Tc || opt.ready) ? e.s : e.s * 0.25;
      const bc = bought * e.buy * (1 + sEff);
      if (pre && bc > 0) { remD[t + cdP] += bc * (1 - dep); remOwed += bc * (1 - dep); }
      cash -= bc * dep; if (L0) { L0.stock = bc * dep; L0.stockFull = bc; L0.pieces = bought * (1 + sEff); L0.forDay = t - off; } rotStock += bought * e.buy * (1 + sEff); arr[t] += bought; dead += bought * sEff; planN[t] = nt;
    }
    if (L0) { L0.balance = cash; L0.owed = remOwed; ledger.push(L0); }
    if (cash < minCash) { minCash = cash; snapS = rotStock; snapA = rotAds; snapI = cumIn; }
    if (handDay === null && C > 0 && day > off + 1 && cash >= C) handDay = day;
    if (day > off) hc[day - off] = cash;
    if (day > off) log.push({ day: day - off, n, equity, ads: n * e.L });
    if (stopDay !== null) { let rest = 0; for (let k = day + 1; k < N; k++) rest += cin[k] + planN[k]; if (rest < 1) { reached = day; break; } }
  }
  if (insolvent) reached = null;
  const stockLoop = (inv + dead) * e.buy;
  for (let k = lastD + 1; k < N; k++) inv += rin[k] + arr[k];
  const outSteady = perAds + e.c * e.d * buyU;
  const sh = x => x !== null ? Math.max(1, x - off) : x;
  reached = sh(reached); stopDay = sh(stopDay); firstDay = sh(firstDay); capHitDay = sh(capHitDay); payDay = sh(payDay); handDay = sh(handDay);
  return { ledger, reached, stopDay, payDay, handDay, hc, payDel, rotStock, rotAds, snapS, snapA, snapI, log, totLeads, peakLeads, firstN, firstDay, capHitDay, cash,
    stock: (inv + dead) * e.buy, stockLoop, usablePcs: inv, deadPcs: dead,
    netIn, growth: (netIn - outSteady) / outSteady, Tc, prod, pre };
}

function simPlan(plan, v, C, target, capLeads, T, maxDays, opt, ctx) {
  const surplus = (opt && opt.surplus != null) ? opt.surplus : ctx.surplus;
  let stop = 0, cashDay = 0, ok = true, tot = 0, peak = 0, firstN = 0, capHit = null, cash = 0, stock = 0, growth = 0, logs = [], usable = 0, deadP = 0, pay = 0, payOk = true, hcS = [], payDel = 0, rotS = 0, rotA = 0, sS = 0, sA = 0, sI = 0;
  const needs = plan.products.map(x => (x.R && isFinite(x.R.starterCapital) && x.R.starterCapital > 0) ? x.R.starterCapital : null);
  const useNeed = needs.every(n => n !== null) && plan.products.length > 1;
  const sumNeed = useNeed ? needs.reduce((a, b) => a + b, 0) : 1; let ledgers = null;
  plan.products.forEach(({ p, share }, ix) => {
    const cw = useNeed ? needs[ix] / sumNeed : share;
    const R0 = plan.products[ix].R;
    const bi = (opt && opt.recN != null && R0) ? opt.recN * R0.marge * share : ((opt && opt.bonus) ? opt.bonus * share : 0);
    const r = simOne(ecoOf(p, v, prodSurplus(p, surplus), ctx), C * cw, target * share, capLeads, T, maxDays,
      { ...opt, bonus: bi, prod: (prodPrepOf(p) || undefined), pre: !!p.preorder && !p.ready, dep: (p.dep || 50), ready: !!p.ready }, ctx);
    if (r.reached === null) ok = false; else { stop = Math.max(stop, r.stopDay); cashDay = Math.max(cashDay, r.reached); }
    tot += r.totLeads; peak += r.peakLeads; firstN += r.firstN; cash += r.cash; stock += r.stock; growth += r.growth * share; logs.push(r.log); usable += r.usablePcs; deadP += r.deadPcs;
    if (r.capHitDay !== null) capHit = Math.max(capHit || 0, r.capHitDay);
    if (r.payDay == null) payOk = false; else { pay = Math.max(pay, r.payDay); payDel += r.payDel || 0; }
    hcS.push(r.hc || []); if (r.ledger) (ledgers = ledgers || []).push(r.ledger);
    rotS += r.rotStock || 0; rotA += r.rotAds || 0; sS += r.snapS || 0; sA += r.snapA || 0; sI += r.snapI || 0;
  });
  const L = Math.max(0, ...hcS.map(a => a.length));
  const handDay = (() => { const last = hcS.map(() => null); for (let d = 1; d < L; d++) { let sum = 0, any = false; hcS.forEach((a, i) => { if (a[d] != null) last[i] = a[d]; if (last[i] != null) { sum += last[i]; any = true; } }); if (d >= 2 && any && last.every(x => x != null) && sum >= C) return d; } return null; })();
  const turnDay = (() => { const last = hcS.map(() => null); let mn = Infinity, md = null; for (let d = 1; d < L; d++) { let sum = 0; hcS.forEach((a, i) => { if (a[d] != null) last[i] = a[d]; if (last[i] != null) sum += last[i]; }); if (last.every(x => x != null) && sum < mn - 1) { mn = sum; md = d; } } return md; })();
  return { reached: ok ? stop : null, cashDay: ok ? cashDay : null, payDay: payOk ? pay : null, handDay, turnDay, payDel: Math.round(payDel),
    rotStock: rotS, rotAds: rotA, snapS: sS, snapA: sA, snapI: sI, stopDay: stop, totLeads: tot, peakLeads: peak, firstN, capHitDay: capHit,
    cash, stock, growth, logs, ledgers, usablePcs: usable, deadPcs: deadP };
}

function capFloor(plan, v, T, ctx) {
  let f = 0;
  (plan.products || []).forEach(x => { const p = x.p; const c = (p.conf || 50) / 100, d = (p.del || 50) / 100; f += p.buy * (1 + ctx.surplus) * 20 + (p.lead + c * d * (v.pack || 0)) * 10 * Math.max(1, T); });
  return f;
}

function capitalNeeded(plan, v, target, capLeads, T, days, opt, ctx) {
  const floor = capFloor(plan, v, T, ctx);
  let lo = 1000, hi = Math.max(target * 20, 1e6);
  opt = { ...opt, P: days, noBrake: true };
  const MD = days + T + ctx.prepDays + 8;
  const r0 = simPlan(plan, v, hi, target, capLeads, T, MD, opt, ctx).reached;
  if (r0 === null || r0 > days) return null;
  for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; const r = simPlan(plan, v, mid, target, capLeads, T, MD, opt, ctx).reached; if (r !== null && r <= days) hi = mid; else lo = mid; }
  let out = Math.ceil(Math.max(hi, floor) / 1000) * 1000;
  for (let k = 0; k < 10; k++) { const r = simPlan(plan, v, out, target, capLeads, T, MD, opt, ctx).reached; if (r !== null && r <= days) break; out = Math.ceil(out * 1.01 / 1000) * 1000; }
  return out;
}

// رأس المال اللازم لمنتج + أقل مدة + ليدات المحاكي (نسخة capNeedCached)
function capNeed(p, v, tgt, share, marge, P, T, ctx) {
  const cap = capL(ctx), s = ctx.surplus;
  const recN = Math.floor(ctx.returned * (ctx.recRate / 100));
  const opt = { ...personaOpts(ctx), bonus: recN * marge * share };
  const key = JSON.stringify([p.prep || 0, (p.preorder && !p.ready ? (p.dep || 50) : 0), (p.ready ? 'r' + (p.surp != null ? p.surp : 35) : 0),
    ctx.deliveryDays, ctx.confirmDays, ctx.retBackDays, ctx.payoutDays, ctx.prepDays, abRate(ctx), p.sell, p.buy, Math.round(p.lead), p.conf, p.del,
    Math.round(tgt), Math.round(cap), T, P, s, ctx.persona, Math.round(opt.bonus), v.pack, v.delCost, v.retCost, ctx.targetMode, ctx.payoutEvery]);
  if (ctx._memo.has(key)) return ctx._memo.get(key);
  const plan = { products: [{ p, share: 1 }] };
  const vv = { pack: v.pack, delCost: v.delCost, retCost: v.retCost };
  let r = capitalNeeded(plan, vv, tgt, cap, T, P, { ...opt, surplus: s }, ctx), dd = null;
  if (r === null) { for (let d2 = P + 3; d2 <= 365; d2 += (d2 < P + 30 ? 3 : 10)) { const r2 = capitalNeeded(plan, vv, tgt, cap, T, d2, { ...opt, surplus: s }, ctx); if (r2 !== null) { r = r2; dd = d2; break; } } }
  const out = r === null ? Infinity : r;
  let sl = null;
  if (isFinite(out)) { const D = dd || P; const sr = simPlan(plan, vv, out, tgt, cap, T, D + T + ctx.prepDays + 8, { ...opt, surplus: s, P: D, noBrake: true }, ctx); sl = { leads: sr.totLeads, stock: sr.stock }; }
  const res = { cap: out, days: dd, sl };
  ctx._memo.set(key, res);
  return res;
}

// ══ حساب منتج واحد بالكامل ══
function calcOneProduct(p, shared, tgtShare, ctx) {
  const v = {
    rate: shared.rate, target: tgtShare, sell: p.sell, buy: p.buy, pack: shared.pack, delCost: shared.delCost,
    retCost: shared.retCost, lead: p.lead, adSpend: 0, conf: p.conf / 100, del: p.del / 100, ab: abRate(ctx),
    surplusCost: ctx.targetMode === 'cash' ? p.buy * prodSurplus(p, shared.surplus) * (p.ready ? 1 : 0.5) : 0,
  };
  const r = calcCore(v, tgtShare, ctx);
  const surplus = prodSurplus(p, shared.surplus);
  const conf = Math.min(1, v.conf + (v.ab || 0)), del = v.del;
  const retPerDel = (conf * del) > 0 ? (conf * (1 - del)) / (conf * del) : 0;
  const marge = r.ppo - retPerDel * shared.retCost;
  const adPerDel = (conf * del) > 0 ? p.lead / (conf * del) : 0;
  const periodDays = shared.periodDays || 30;
  const cycleDays = shared.cycleDays || 6;
  const gT = ctx.target || tgtShare;
  const shareG = gT > 0 ? Math.min(1, tgtShare / gT) : 1;
  const cn = capNeed(p, v, tgtShare, shareG, marge, periodDays, cycleDays, ctx);
  const starterCapital = cn.cap, capDays = cn.days;
  const paperDelivered = r.delivered, paperLeads = r.leads, paperConfirmed = r.confirmed, paperAds = r.adsReq;
  const ppoNet = r.delivered > 0 ? r.finalProfit / r.delivered : 0;
  let cashK = 1, leftValue = 0;
  if (ctx.targetMode === 'cash' && r.leads > 0 && isFinite(starterCapital)) {
    const cs = cn.sl;
    if (cs && cs.leads > r.leads * 1.04) {
      cashK = cs.leads / r.leads; leftValue = cs.stock || 0;
      r.leads = Math.ceil(cs.leads); r.confirmed = Math.ceil(cs.leads * conf); r.delivered = Math.ceil(cs.leads * r.delRate); r.returned = Math.ceil(cs.leads * r.retRate); r.adsReq = r.leads * v.lead;
    }
  }
  const stockNeeded = Math.ceil(r.delivered * (1 + surplus));
  const capStock = stockNeeded * p.buy;
  const capAdsThird = Math.round(r.adsReq / 3);
  const prodDays = prodPrepOf(p) || shared.prodDays || 5;
  const sellDays = capDays || periodDays;
  const leadsPerDay = r.leads / sellDays, sendPerDay = r.confirmed / sellDays, delPerDay = r.delivered / sellDays,
    retPerDay = r.returned / sellDays, adsPerDay = r.adsReq / sellDays;
  const cycleStock = Math.ceil(sendPerDay * cycleDays);
  const safetyStock = Math.ceil(delPerDay * prodDays);
  const starterStock = Math.min(stockNeeded, cycleStock + safetyStock);
  const starterStockCost = starterStock * p.buy;
  const adsCycle = Math.round(adsPerDay * cycleDays);
  const staticStarter = Math.min(Math.ceil(paperDelivered * (1 + surplus)), Math.ceil(paperConfirmed / periodDays * cycleDays) + Math.ceil(paperDelivered / periodDays * prodDays)) * p.buy + Math.round(paperAds / periodDays * cycleDays);
  const reorderPoint = safetyStock;
  const restockLater = Math.max(0, stockNeeded - starterStock);
  const surplusLeft = Math.max(0, stockNeeded - r.delivered);
  const invested = capStock + r.adsReq;
  const roiU = invested > 0 ? (r.finalProfit / invested) * 100 : 0;
  const recNetPerDel = p.sell - shared.delCost - retPerDel * shared.retCost;
  const ordersToRecover = (recNetPerDel > 0 && isFinite(starterCapital)) ? Math.ceil(starterCapital / recNetPerDel) : 0;
  const dayRecover = delPerDay > 0 ? Math.ceil(cycleDays + ordersToRecover / delPerDay) : 0;
  const cyclesToTarget = Math.max(1, Math.ceil(periodDays / cycleDays));
  const scBE = v.surplusCost || 0;
  const contribPerDel = p.sell - shared.pack - shared.delCost - ((1 - del) / Math.max(del, 0.0001)) * shared.retCost - adPerDel;
  const beStock = contribPerDel > 0 ? p.buy / contribPerDel : Infinity;
  const breakevenPrice = p.buy + shared.pack + shared.delCost + retPerDel * shared.retCost + adPerDel + scBE;
  const breakevenCPA = (marge - scBE) * conf * del;
  const netAfterAdsPerDel = marge - adPerDel - (v.surplusCost || 0);
  return { ...r, v, stockNeeded, capStock, capAdsThird,
    capital: starterCapital, roi: (isFinite(starterCapital) && starterCapital > 0) ? r.finalProfit / starterCapital * 100 : 0, roiTurn: roiU, invested,
    marge, netPerDel: marge, adPerDel, netAfterAdsPerDel, netPerLeadReal: r.netPerLead, paperDelivered, paperLeads, ppoNet, cashK, leftValue,
    breakevenPrice, breakevenCPA, starterCapital, capDays, staticStarter, scBE, beStock, contribPerDel, starterStock, starterStockCost, adsCycle,
    firstBatch: starterStock, cyclesToTarget, cycleDays, prodDays, periodDays, leadsPerDay, sendPerDay, delPerDay, retPerDay, adsPerDay,
    safetyStock, reorderPoint, restockLater, surplusLeft, recNetPerDel, ordersToRecover, dayRecover };
}

// ══ اختيار البوصلة: الأقوى بالعائد + احتياطي ══
function coachPick(products, ctx) {
  const shared = sharedOf(ctx), c = [];
  const anyTested = products.some(p => p.tested);
  products.forEach((p, i) => {
    if (anyTested && !p.tested) return; // المنتج اللي نجح في التاست الحقيقي قبل المنتج اللي «على الورق»
    const R =calcOneProduct(p, shared, ctx.target, ctx); if (R.netPerLead > 0) c.push({ i, roi: R.roi }); });
  c.sort((a, b) => b.roi - a.roi);
  if (!c.length) return [0];
  const best = c[0].roi, pick = [c[0].i];
  if (c[1] && c[1].roi >= best * 0.6) pick.push(c[1].i);
  if (c[2] && c[2].roi >= best * 0.8) pick.push(c[2].i);
  return pick;
}

// التوزيع: الأكفأ في رأس المال حتى سقفو (بلا سقف: الأقوى ≤ 70%، كل منتج ≥ 10%)
function portfolioShares(products, ctx, sel) {
  const shared = sharedOf(ctx), P = ctx.period, cap = capL(ctx), cand = [];
  products.forEach((p, i) => {
    if (sel && !sel.includes(i)) return;
    const R = calcOneProduct(p, shared, ctx.target, ctx);
    if (!(R.netPerLead > 0) || R.delivered <= 0) return;
    cand.push({ i, capPerDA: R.staticStarter / ctx.target, maxPart: 0.9 * cap * P * (p.conf / 100) * (p.del / 100) * R.ppoNet });
  });
  cand.sort((a, b) => a.capPerDA - b.capPerDA);
  const sh = new Array(products.length).fill(0); let rem = ctx.target, over = false;
  if (cap >= 1e9 && cand.length > 1) {
    let w = cand.map(c => 1 / Math.max(1e-9, c.capPerDA)); const tw = w.reduce((a, b) => a + b, 0); w = w.map(x => x / tw);
    for (let it = 0; it < 6; it++) { w = w.map(x => Math.min(0.70, Math.max(0.10, x))); const s = w.reduce((a, b) => a + b, 0); w = w.map(x => x / s); }
    cand.forEach((c, k) => { sh[c.i] = w[k]; });
    return { sh, over: false, order: cand.map(c => c.i) };
  }
  cand.forEach(c => { const t = Math.min(rem, c.maxPart); sh[c.i] = t / ctx.target; rem -= t; });
  if (rem > 1 && cand.length) { over = true; const tot = cand.reduce((s, c) => s + c.maxPart, 0) || 1; cand.forEach(c => { sh[c.i] += (rem * c.maxPart / tot) / ctx.target; }); }
  return { sh, over, order: cand.map(c => c.i) };
}

/**
 * الخطة المختارة. selection:
 *   null/undefined → البوصلة تختار (coachPick)
 *   [i, j, …]      → المنتجات اللي اختارها التاجر (دمج)
 *   {single: i}    → منتج واحد وحدو
 */
function getChosenPlan(products, ctx, selection) {
  const shared = sharedOf(ctx), fullTarget = ctx.target;
  let parts = [], label;
  let single = null, selNow = null;
  if (products.length < 2) single = 0;
  else if (selection && typeof selection === 'object' && !Array.isArray(selection) && selection.single != null) single = selection.single;
  else { selNow = (Array.isArray(selection) && selection.length ? selection : coachPick(products, ctx)).filter(i => i < products.length); if (!selNow.length) selNow = [0]; if (selNow.length === 1) single = selNow[0]; }
  if (single !== null) {
    const idx = single < products.length ? single : 0, p = products[idx];
    parts = [{ p, R: calcOneProduct(p, shared, fullTarget, ctx), share: 1, index: idx }];
    label = products.length < 2 ? 'منتجك' : p.name + ' وحده';
  } else {
    const ps = portfolioShares(products, ctx, selNow);
    ps.order.forEach(i => { const sh = ps.sh[i]; if (sh > 0.0005) parts.push({ p: products[i], R: calcOneProduct(products[i], shared, fullTarget * sh, ctx), share: sh, index: i }); });
    label = parts.length > 1 ? 'دمج ' + (parts.length === 2 ? 'منتجين' : parts.length + ' منتجات') : (parts[0] ? parts[0].p.name + ' برك (الدمج ما يلزمش)' : '—');
  }
  const keys = ['leads', 'confirmed', 'delivered', 'returned', 'adsReq', 'stockNeeded', 'finalProfit', 'capStock', 'invested',
    'starterCapital', 'starterStock', 'starterStockCost', 'adsCycle', 'restockLater', 'surplusLeft',
    'leadsPerDay', 'sendPerDay', 'delPerDay', 'retPerDay', 'adsPerDay', 'safetyStock', 'reorderPoint', 'ordersToRecover'];
  const tot = {}; keys.forEach(k => tot[k] = 0);
  parts.forEach(({ R }) => keys.forEach(k => tot[k] += (R[k] || 0)));
  tot.capital = tot.starterCapital;
  tot.capDays = parts.reduce((m, { R }) => Math.max(m, R.capDays || 0), 0) || null;
  tot.roi = (isFinite(tot.starterCapital) && tot.starterCapital > 0) ? tot.finalProfit / tot.starterCapital * 100 : 0;
  tot.surplusValue = parts.reduce((s, { p, R }) => s + R.surplusLeft * p.buy, 0);
  tot.restockValue = parts.reduce((s, { p, R }) => s + R.restockLater * p.buy, 0);
  const recNetAvg = tot.delivered > 0 ? parts.reduce((s, { R }) => s + R.recNetPerDel * R.delivered, 0) / tot.delivered : 0;
  const cyc = shared.cycleDays;
  tot.recNetAvg = recNetAvg;
  tot.ordersToRecover = recNetAvg > 0 ? Math.ceil(tot.starterCapital / recNetAvg) : 0;
  tot.dayRecover = tot.delPerDay > 0 ? Math.ceil(cyc + tot.ordersToRecover / tot.delPerDay) : 0;
  tot.cycleDays = cyc; tot.prodDays = shared.prodDays; tot.periodDays = shared.periodDays;
  return { ...tot, products: parts, label };
}

// ══ الليدات الضايعة (المتروكة): ربح زايد بنفس الليدات، بلا أدس ══
function abExtra(p, R, ctx) {
  const a = ctx.abandon / 100, r = ctx.abRec / 100;
  const d = p.del / 100, sc = ctx.targetMode === 'cash' ? p.buy * ctx.surplus * 0.5 : 0;
  const ab = R.leads * a, rc = ab * r;
  return { ab, rc, rd: rc * d, profit: rc * (d * (p.sell - p.buy - ctx.pack - ctx.delCost - sc) - (1 - d) * ctx.retCost) };
}

// ══ رأس مالك أنا: وقتاش نوصل؟ (وضع «عندي رأس مال») ══
function withMyCapital(products, ctx, C, selection) {
  const plan = getChosenPlan(products, ctx, selection);
  const opt = personaOpts(ctx), T = plan.cycleDays || 6;
  const minStart = plan.products.reduce((s, { p }) => s + 10 * (p.lead + (p.conf / 100) * p.buy * 1.2), 0);
  if (C < minStart) return { ok: false, reason: 'capital_too_small', minStart: Math.round(minStart) };
  const sim = simPlan(plan, sharedOf(ctx), C, ctx.target, capL(ctx), T, 730, { ...opt, P: ctx.period }, ctx);
  return { ok: sim.reached !== null, days: sim.reached, cashDay: sim.cashDay, turnDay: sim.turnDay, handDay: sim.handDay,
    firstLeadsPerDay: sim.firstN, peakLeadsPerDay: sim.peakLeads, cashEnd: sim.cash, stockEnd: sim.stock,
    profitCash: sim.cash - C, growthPerCycle: Math.round(sim.growth * 1000) / 10, capHitDay: sim.capHitDay };
}

// ══ الرافعات: شحال كل رافعة تقصّر الطريق / تنقّص رأس المال ══
const LEVERS = [
  { id: 'del+5', t: 'ترفع نسبة التوصيل 5 نقاط', f: p => ({ ...p, del: Math.min(100, p.del + 5) }) },
  { id: 'lead-10', t: 'تنقّص تكلفة الليد 10%', f: p => ({ ...p, lead: p.lead * 0.9 }) },
  { id: 'price+5', t: 'ترفع السعر 5%', f: p => ({ ...p, sell: Math.round(p.sell * 1.05) }) },
  { id: 'conf+5', t: 'ترفع التأكيد 5 نقاط', f: p => ({ ...p, conf: Math.min(100, p.conf + 5) }) },
];
function levers(products, ctx, selection, C) {
  const plan = getChosenPlan(products, ctx, selection);
  const opt = personaOpts(ctx), T = plan.cycleDays || 6, v = sharedOf(ctx);
  const base = { capital: plan.starterCapital, profitPerLead: avgNetPerLead(plan) };
  const list = LEVERS.slice();
  if (ctx.surplus > 0.10) list.push({ id: 'surplus10', t: 'تنقّص الفائض لـ 10% (إنتاج المقاسات حسب الطلب)', f: p => p, s: 10 });
  if (ctx.retCost > 0) list.push({ id: 'ret0', t: `تفاوض الروتور مع شركة التوصيل (بلاش بدل ${ctx.retCost} دج)`, f: p => p, c: { retCost: 0 } });
  if (ctx.payoutEvery > 1) list.push({ id: 'payout1', t: `تسحب الكاش من شركة التوصيل كل نهار (بدل كل ${ctx.payoutEvery} أيام)`, f: p => p, c: { payoutEvery: 1 } });
  if (products.some(p => !p.ready && !p.preorder)) list.push({ id: 'preorder30', t: 'طلب مسبق من الورشة بعربون 30% (الباقي نهار الاستلام)', f: p => (!p.ready && !p.preorder) ? { ...p, preorder: true, dep: 30 } : p });
  const daysBase = C > 0 ? simPlan(plan, v, C, ctx.target, capL(ctx), T, 730, { ...opt, P: ctx.period }, ctx).reached : null;
  const out = list.map(L => {
    const prods2 = products.map((p, i) => plan.products.some(x => x.index === i) ? L.f(p) : p);
    const ctx2 = makeCtx({ ...ctxToInput(ctx), ...(L.s != null ? { surplus: L.s } : {}), ...(L.c || {}) });
    const pl2 = getChosenPlan(prods2, ctx2, plan.products.length === 1 ? { single: plan.products[0].index } : plan.products.map(x => x.index));
    let days = null;
    if (C > 0) days = simPlan(pl2, sharedOf(ctx2), C, ctx2.target, capL(ctx2), T, 730, { ...opt, P: ctx2.period }, ctx2).reached;
    return { id: L.id, lever: L.t, capital: pl2.starterCapital, capitalSaved: isFinite(base.capital) && isFinite(pl2.starterCapital) ? base.capital - pl2.starterCapital : null,
      profitPerLead: avgNetPerLead(pl2), daysWithMyCapital: days, daysSaved: (days != null && daysBase != null) ? daysBase - days : null };
  });
  out.sort((a, b) => (b.capitalSaved || 0) - (a.capitalSaved || 0));
  return { base: { ...base, daysWithMyCapital: daysBase }, levers: out };
}
function avgNetPerLead(plan) { const L = plan.products.reduce((s, { R }) => s + R.leads, 0); return L > 0 ? plan.products.reduce((s, { R }) => s + R.netPerLead * R.leads, 0) / L : 0; }
function ctxToInput(ctx) {
  return { target: ctx.target, rate: ctx.rate, pack: ctx.pack, delCost: ctx.delCost, retCost: ctx.retCost, surplus: ctx.surplus * 100, period: ctx.period,
    targetMode: ctx.targetMode, persona: ctx.persona, deliveryDays: ctx.deliveryDays, confirmDays: ctx.confirmDays, retBackDays: ctx.retBackDays,
    payoutDays: ctx.payoutDays, prepDays: ctx.prepDays, maxLeads: ctx.maxLeads >= 1e9 ? null : ctx.maxLeads, abandon: ctx.abandon, abRec: ctx.abRec,
    abOn: ctx.abOn, returned: ctx.returned, recRate: ctx.recRate, confCap: ctx.confCap, trackCap: ctx.trackCap, payoutEvery: ctx.payoutEvery };
}

// 📈 الرقم يقدر يطلع: نفس الخطة بأرقام أصعب
function stress(products, ctx, selection) {
  const plan = getChosenPlan(products, ctx, selection);
  const sel = plan.products.length === 1 ? { single: plan.products[0].index } : plan.products.map(x => x.index);
  const idx = new Set(plan.products.map(x => x.index));
  const run = fn => getChosenPlan(products.map((p, i) => idx.has(i) ? fn({ ...p }) : p), makeCtx(ctxToInput(ctx)), sel).starterCapital;
  const L = p => { p.lead = Math.round(p.lead * 1.2); return p; }, D = p => { p.del = Math.max(10, p.del - 5); return p; };
  return { base: plan.starterCapital, leadUp20: run(L), deliveryDown5: run(D), both: run(p => D(L(p))) };
}

// ══ 🧭 الوجهة: «نحب نربح X في الطلبية» → واش يلزم ══
function destination(profitPerOrder, ctx, o) {
  o = o || {};
  const P = ctx.period, rate = ctx.rate || 245;
  const cPct = Math.min(100, Math.max(1, +o.conf || 50)), dPct = Math.min(100, Math.max(1, +o.del || 60));
  const c = cPct / 100, d = dPct / 100;
  const lu = o.leadUsd != null ? +o.leadUsd : 1, lead = Math.round(lu * rate);
  const buy = Math.max(0, +o.buy || 0);
  const adPerDel = lead / (c * d), retPer = ((1 - d) / d) * ctx.retCost, sc = ctx.targetMode === 'cash' ? buy * ctx.surplus * 0.5 : 0;
  const costPer = ctx.pack + ctx.delCost + retPer;
  const margeNeed = profitPerOrder + adPerDel + sc, grossNeed = margeNeed + costPer, sellNeed = buy + grossNeed;
  const R = calcOneProduct(normProduct({ name: '', sell: sellNeed, buy, leadUsd: lu, conf: cPct, del: dPct }, ctx), sharedOf(ctx), ctx.target, ctx);
  let orders = Math.ceil(ctx.target / profitPerOrder), confirmed = Math.ceil(orders / d), leads = Math.ceil(confirmed / c);
  const cash = R.cashK > 1.04;
  if (cash) { leads = R.leads; confirmed = R.confirmed; orders = R.delivered; }
  const days = R.capDays || P;
  const leadsDay = leads / days, confDay = confirmed / days, delDay = orders / days, adsDay = leadsDay * lead;
  const confs = Math.ceil(leadsDay / ctx.confCap), tracks = Math.ceil(confDay / ctx.trackCap);
  return { profitPerOrder, leadUsd: lu, orders, confirmed, leads, returned: confirmed - orders, leadsDay, confDay, delDay, adsDay, adsWeek: adsDay * 7,
    adsTotal: leads * lead, adPerDel, confirmers: confs, trackers: tracks, team: confs + tracks, retPer, sc, buy, costPer, margeNeed, grossNeed,
    sellNeed, capital: R.starterCapital, capDays: R.capDays, leftValue: R.leftValue || 0 };
}

// ══ ⚖️ مقارنة العروض (سعر / كمية / مكمّل) ══
function compareOffers(product, offers, ctx) {
  const shared = sharedOf(ctx), rate = ctx.rate || 245;
  const K = (o, e) => { const d = o.del / 100; return d * (e.sell - e.buy * (1 + ctx.surplus) - ctx.pack - ctx.delCost) - (1 - d) * ctx.retCost; };
  const effOf = o => { const t = o.type || 'price', b = o.buy != null ? o.buy : product.buy;
    if (t === 'qty') return { sell: o.sell, buy: b * Math.max(1, o.qty || 1) };
    if (t === 'bundle') { const k = Math.min(100, Math.max(0, o.take || 0)) / 100; return { sell: o.sell + k * (o.addPrice || 0), buy: b + k * (o.addCost || 0) }; }
    return { sell: o.sell, buy: b }; };
  const res = offers.map((o, i) => {
    const e = effOf(o);
    const q = normProduct({ ...product, sell: e.sell, buy: e.buy, conf: o.conf != null ? o.conf : product.conf, del: o.del != null ? o.del : product.del, leadUsd: o.leadUsd != null ? o.leadUsd : product.leadUsd }, ctx);
    const R = calcOneProduct(q, shared, ctx.target, ctx);
    return { name: o.name || ('عرض ' + (i + 1)), type: o.type || 'price', current: !!o.cur, netPerLead: R.netPerLead, netPerOrder: R.netAfterAdsPerDel,
      capital: R.starterCapital, leadsPerDay: R.leadsPerDay, roi: R.roi, k: K({ del: q.del }, e), losing: !(R.netPerLead > 0) };
  });
  res.sort((a, b) => (b.netPerLead > 0) - (a.netPerLead > 0) || (a.capital - b.capital));
  return res;
}

// ══ حكم البوصلة قبل التاست (نسخة renderCoach) ══
function coachVerdict(products, ctx, selection, capital, testSet) {
  const plan = getChosenPlan(products, ctx, selection), rate = ctx.rate, items = [];
  if (!plan.products.length || plan.finalProfit <= 0) return { level: 'stop', verdict: 'ما تطلقش. الخطة المختارة خاسرة بعد الأدس. صلّح السعر، تكلفة الليد، ولا اختار منتج آخر.', items, plan };
  plan.products.forEach(({ p, R }) => {
    const safety = R.breakevenCPA > 0 ? (1 - p.lead / R.breakevenCPA) * 100 : -100;
    if (safety < 30) items.push({ lvl: 'warn', code: 'thin_margin', product: p.name, safetyPct: Math.max(0, Math.round(safety)), ceilingUsd: +(R.breakevenCPA / rate).toFixed(2), ceilingDzd: Math.round(R.breakevenCPA) });
    else items.push({ lvl: 'ok', code: 'safe_margin', product: p.name, safetyPct: Math.round(safety), ceilingUsd: +(R.breakevenCPA / rate).toFixed(2), ceilingDzd: Math.round(R.breakevenCPA) });
    if (isFinite(R.beStock) && R.beStock > 0.7) items.push({ lvl: 'warn', code: 'heavy_batch', product: p.name, sellPctToRecoverBatch: Math.ceil(R.beStock * 100) });
    const f = []; if (p.del > 60) f.push('توصيل ' + p.del + '%'); if (p.conf > 65) f.push('تأكيد ' + p.conf + '%'); if (p.lead / (rate || 245) < 0.5) f.push('ليد $' + (p.lead / (rate || 245)).toFixed(1));
    if (f.length) items.push({ lvl: 'warn', code: 'optimistic', product: p.name, assumptions: f });
  });
  if (plan.products.length > 1) {
    const best = Math.max(...plan.products.map(x => x.R.roi));
    plan.products.forEach(({ p, R, share }) => { if (R.roi < best * 0.6) items.push({ lvl: 'warn', code: 'weak_in_mix', product: p.name, roi: Math.round(R.roi), bestRoi: Math.round(best), sharePct: Math.round(share * 100) }); });
    items.push({ lvl: 'ok', code: 'mix_test_separately' });
  } else items.push({ lvl: 'ok', code: 'one_player' });
  if (plan.dayRecover > plan.periodDays) items.push({ lvl: 'warn', code: 'slow_recovery', day: plan.dayRecover });
  if (plan.starterCapital > plan.finalProfit * 1.5) items.push({ lvl: 'warn', code: 'heavy_capital', capital: plan.starterCapital, profit: Math.round(plan.finalProfit) });
  if (ctx.abandon > 0) {
    const p0 = plan.products[0];
    const ex = plan.products.reduce((s, { p, R }) => s + abExtra(p, R, ctx).profit, 0);
    items.push({ lvl: 'ok', code: 'abandoned_leads', extraProfit: Math.round(ex), assumption: ctx.abRec === 25 ? 'ربعهم (فرضية)' : ctx.abRec + '%', _p: p0 && p0.p.name });
  } else items.push({ lvl: 'warn', code: 'abandoned_missing' });
  const test = plan.products.map(({ p }) => ({ product: p.name, leads: 100, budgetDzd: 100 * p.lead, budgetUsd: +(100 * p.lead / rate).toFixed(0), days: '3-5', perDayUsd: +((100 * p.lead / 4) / rate).toFixed(1) }));
  // 💼 واش رأس مالك يشد التاست + أول دفعة؟ (كل منتج تتاستيه ممكن ينجح → 50 قطعة دنيا)
  if (capital > 0) {
    const testing = (testSet && testSet.length ? testSet.map(i => products[i]).filter(Boolean) : plan.products.map(x => x.p));
    const testAds = testing.reduce((s2, p) => s2 + 100 * p.lead, 0);
    // أول دفعة: طلب مسبق = العربون + نص الباقي قبل ما يبدا البيع (النص الثاني على دفعة ثانية بعد يومين)
    const batchCost = p => 50 * p.buy * (p.preorder ? (p.dep / 100 + (1 - p.dep / 100) / 2) : 1);
    const firstBatches = testing.reduce((s2, p) => s2 + batchCost(p), 0);
    const reserve = capital * personaOpts(ctx).reserve;
    const need = testAds + firstBatches + reserve;
    if (need > capital) {
      const ranked = testing.slice().sort((a, b) => (calcOneProduct(b, sharedOf(ctx), ctx.target, ctx).roi) - (calcOneProduct(a, sharedOf(ctx), ctx.target, ctx).roi));
      let keep = [], acc = reserve; for (const p of ranked) { const c = 100 * p.lead + batchCost(p); if (acc + c <= capital) { keep.push(p.name); acc += c; } }
      items.push({ lvl: 'warn', code: 'test_too_heavy', need: Math.round(need), capital: Math.round(capital), testAds: Math.round(testAds), firstBatches: Math.round(firstBatches), keep,
        msg: keep.length ? `تاست ${testing.length} منتجات + أول دفعة لكل واحد (50 قطعة، ${testing.every(p => p.preorder) ? 'على دفعتين' : testing.some(p => p.preorder) ? 'الورشة على دفعتين والجملة كاملة' : 'مخلّصة كاملة'}) + الاحتياط = ${mil(need)}، ورأس مالك ${mil(capital)}. ابدا بـ ${keep.join(' و ')} دوكا، والباقي بعد أول كاش. وانتبه: فواتير Meta تجي بالعتبة ($300 لكل حساب) — زوج ولا ثلاث حسابات تقدر تطيح فاتورتهم في نفس النهار.`
          : (() => { const b = ranked[0], ads = 100 * b.lead, bc = batchCost(b), q = Math.max(0, Math.floor((capital - reserve - ads) / Math.max(1, bc / 50)));
            return `رأس مالك (${mil(capital)}) ما يكفيش حتى لمنتج واحد كامل: تاست + أول دفعة 50 قطعة + الاحتياط = ${mil(100 * b.lead + bc + reserve)}. الحل: ابدا بـ ${b.name} برك${b.preorder ? ' بالطلب المسبق' : ''} — التاست ~${mil(ads)} أدس، و${q >= 20 ? `أول دفعة صغيرة (~${q} قطعة) ولا تفاوض الورشة على عربون أقل` : 'أول دفعة تستنى أول كاش يرجع، ولا تزيد رأس المال'}. ما تتاستيش أكثر من منتج قبل أول كاش.`; })() });
    }
  }
  const level = items.some(x => x.lvl === 'warn') ? 'caution' : 'go';
  return { level, verdict: level === 'go' ? 'طلق التاست. الخطة رابحة وعندها هامش أمان مريح.' : 'تقدر تطلق التاست — بحذر. الخطة رابحة على الورق، بصح فيها نقاط ضعف لازم تراقبها.', items, test, plan };
}

// ══ الواجهة الرئيسية: MOOD GUIDE ══
/**
 * guide({ settings, products, selection?, myCapital?, destination? })
 * يرجّع: المسار الكامل قبل التاست — كل منتج، الخطة، رأس المال، الفريق، الستوك، الحكم، التاست، الرافعات، الضغط.
 */
function guide(input) {
  const ctx = makeCtx(input.settings || {});
  const products = (input.products || []).slice(0, 10).map(p => normProduct(p, ctx));
  if (!products.length) throw new Error('products: لازم منتج واحد على الأقل');
  const shared = sharedOf(ctx);
  const perProduct = products.map((p, i) => {
    const R = calcOneProduct(p, shared, ctx.target, ctx);
    const ab = abExtra(p, R, ctx);
    return { index: i, name: p.name, input: p, profitable: R.netPerLead > 0, netPerOrder: R.netAfterAdsPerDel, marge: R.marge, adPerOrder: R.adPerDel,
      maxCplDzd: R.breakevenCPA, maxCplUsd: R.breakevenCPA / ctx.rate, breakevenPrice: R.breakevenPrice, netPerLead: R.netPerLead,
      leads: R.leads, confirmed: R.confirmed, delivered: R.delivered, returned: R.returned, adsTotalDzd: R.adsReq,
      capital: R.starterCapital, capDays: R.capDays, roi: R.roi, roiTurn: R.roiTurn, leadsPerDay: R.leadsPerDay, delPerDay: R.delPerDay,
      starterStock: R.starterStock, safetyStock: R.safetyStock, reorderPoint: R.reorderPoint, stockNeeded: R.stockNeeded,
      beStockPct: isFinite(R.beStock) ? Math.ceil(R.beStock * 100) : null, dayRecover: R.dayRecover, cashK: R.cashK, leftValue: R.leftValue,
      abandonedExtraProfit: ab.profit };
  });
  const coach = coachVerdict(products, ctx, input.selection, +input.myCapital || 0, input.testSet);
  const plan = coach.plan;
  const team = { confirmers: Math.ceil((plan.leads / ctx.period) / ctx.confCap), trackers: Math.ceil((plan.confirmed / ctx.period) / ctx.trackCap) };
  const out = {
    engine: ENGINE_VERSION, mode: 'GUIDE', edition: input.edition === 'public' ? 'public' : 'tassyir', settings: ctxToInput(ctx), cycleDays: ctx.cycleDays,
    perProduct,
    plan: summarizePlan(plan, ctx),
    team, coach: { level: coach.level, verdict: coach.verdict, items: coach.items, test: coach.test },
    stress: stress(products, ctx, input.selection),
  };
  if (input.myCapital > 0) out.myCapital = withMyCapital(products, ctx, +input.myCapital, input.selection);
  if (input.levers !== false) out.levers = levers(products, ctx, input.selection, +input.myCapital || 0);
  if (input.destination) out.destination = destination(+input.destination.profitPerOrder, ctx, input.destination);
  return out;
}

function summarizePlan(plan, ctx) {
  return {
    label: plan.label, target: ctx.target, targetMode: ctx.targetMode, period: ctx.period, capDays: plan.capDays,
    products: plan.products.map(({ p, R, share, index }) => ({ index, name: p.name, sharePct: Math.round(share * 1000) / 10,
      targetShare: Math.round(ctx.target * share), leads: R.leads, confirmed: R.confirmed, delivered: R.delivered,
      leadsPerDay: R.leadsPerDay, delPerDay: R.delPerDay, capital: R.starterCapital, maxCplDzd: R.breakevenCPA, maxCplUsd: R.breakevenCPA / ctx.rate,
      assumptions: { leadUsd: p.leadUsd, leadDzd: p.lead, conf: p.conf, del: p.del, sell: p.sell, buy: p.buy, preorder: p.preorder, dep: p.dep, ready: p.ready },
      netPerOrder: R.netAfterAdsPerDel, reorderPoint: R.reorderPoint, starterStock: R.starterStock })),
    leads: plan.leads, confirmed: plan.confirmed, delivered: plan.delivered, returned: plan.returned, adsTotalDzd: plan.adsReq,
    leadsPerDay: plan.leadsPerDay, delPerDay: plan.delPerDay, adsPerDayDzd: plan.adsPerDay,
    capital: plan.starterCapital, capitalMil: mil(plan.starterCapital), roi: plan.roi, finalProfit: plan.finalProfit,
    dayRecover: plan.dayRecover, stockNeeded: plan.stockNeeded, starterStock: plan.starterStock, cycleDays: plan.cycleDays,
  };
}

const api = { ENGINE_VERSION, DEFAULTS, makeCtx, normProduct, sharedOf, calcCore, calcOneProduct, simOne, simPlan, capitalNeeded, capNeed,
  coachPick, portfolioShares, getChosenPlan, abExtra, withMyCapital, levers, stress, destination, compareOffers, coachVerdict, guide,
  summarizePlan, ctxToInput, personaOpts, mil, fmt };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BoussalaEngine = api;
