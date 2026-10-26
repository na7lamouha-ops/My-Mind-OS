// بيانات تجريبية (مكتوب عليها «تجريبية» في الواجهة) — باش تشوف الشاشات قبل ربط حساب تسيير.
// ماشي أرقام زبون حقيقي، وما فيهاش حتى رأي ولا وعد.
import { rng } from '../engine/engine.js';

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

function series(r, { days, todayMs, leads, cplUsd, conf, del, sell, buy, pack, delCost, retCost, deliveryDays, payoutDays, firstContactMin, trend = 0, cplTrend = 0, cancelMix }) {
  const rows = [];
  const pendingConf = [];
  for (let i = 0; i < days; i++) {
    const f = 1 + trend * (i / days);
    const l = Math.max(0, Math.round(leads * f * (0.8 + 0.4 * r())));
    const cpl = cplUsd * (1 + cplTrend * (i / days)) * (0.9 + 0.2 * r());
    const c = Math.round(l * conf * (0.9 + 0.2 * r()));
    pendingConf.push(c);
    rows.push({ date: iso(todayMs - (days - 1 - i) * DAY), leads: l, spendUsd: +(l * cpl).toFixed(2), confirmed: c, delivered: 0, returned: 0, collected: 0, cogsDelivered: 0, returns: 0, packing: 0, commission: 0, abandoned: Math.round(l * 0.12), firstContactMin: firstContactMin * (0.8 + 0.4 * r()), cancelReasons: {} });
    const cancelled = l - c;
    for (const [k, w] of Object.entries(cancelMix)) rows[i].cancelReasons[k] = Math.round(cancelled * w);
  }
  for (let i = 0; i < days; i++) {
    const j = i + deliveryDays;
    if (j >= days) continue;
    const d = Math.round(pendingConf[i] * del);
    const ret = pendingConf[i] - d;
    rows[j].delivered += d;
    rows[j].returned += ret;
    rows[j].cogsDelivered += d * buy;
    rows[j].deliveredValue = (rows[j].deliveredValue || 0) + d * (sell - delCost);
    rows[j].packing += d * pack;
    rows[j].returns += ret * retCost;
    const k = j + payoutDays;
    if (k < days) rows[k].collected += d * (sell - delCost);
  }
  return rows;
}

function variant(label, { sellable, outPerDay, backPerDay, deliveredPerDay }) {
  return {
    sku: label, label,
    inventory: { sellable },
    out: Array(7).fill(outPerDay), backIn: Array(7).fill(backPerDay), delivered: Array(7).fill(deliveredPerDay),
  };
}

export function makeDemo(today = new Date().toISOString().slice(0, 10)) {
  const todayMs = Date.parse(today);
  const r = rng(2026);
  const biz = { deliveryDays: 4, payoutDays: 14 };
  const usd = 262; // سعر التاجر في المثال — في الحقيقة يتقرا من تسيير ← المالية ← أسعار الصرف
  const common = { pack: 50, delCost: 200, retCost: 100 };
  const cancelBase = { 'ما جاوبش': 0.4, 'غالية': 0.2, 'بدّل رأيو': 0.25, 'السعر': 0.15 };

  const lina = { id: 'p-lina', name: 'روب لينا', sell: 6800, buy: 2300, ...common, surplus: 0.2, surplusMode: 'workshop', planConf: 0.57, planDel: 0.5, planLeadUsd: 2, tags: ['SCALE', 'SRC-TR', 'PRF-hijab'], launchDate: iso(todayMs - 44 * DAY), cap: 60000, target: 2000000, periodDays: 30, prepDays: 7, transitDays: 2, supplyDays: 14, minOrder: 60, learningEvents: 140, adTrend: 'up', everValidated: true };
  lina.daily = series(r, { days: 45, todayMs, leads: 40, cplUsd: 1.9, conf: 0.58, del: 0.55, ...lina, ...biz, firstContactMin: 22, trend: 0.5, cancelMix: cancelBase });
  lina.variants = [
    variant('M', { sellable: 6, outPerDay: 7, backPerDay: 1, deliveredPerDay: 5 }),
    variant('L', { sellable: 40, outPerDay: 4, backPerDay: 0.5, deliveredPerDay: 3 }),
    variant('XL', { sellable: 58, outPerDay: 0.6, backPerDay: 0.2, deliveredPerDay: 0.4 }),
  ];
  lina.offerHigherPrice = { sell: 7200, conf: 0.55 };
  lina.tagHistory = [
    { date: iso(todayMs - 44 * DAY), from: null, to: 'TEST', why: 'لانسي' },
    { date: iso(todayMs - 30 * DAY), from: 'TEST', to: 'VALIDE', why: 'حتى الحالة الأسوأ تربح، 50 حدث' },
    { date: iso(todayMs - 20 * DAY), from: 'VALIDE', to: 'SCALE', why: 'البوابة مفتوحة' },
  ];

  const nexor = { id: 'p-nexor', name: 'ساعة NEXOR', sell: 4900, buy: 1500, ...common, surplus: 0, surplusMode: 'wholesale', planConf: 0.6, planDel: 0.6, planLeadUsd: 1.6, tags: ['VALIDE', 'SRC-DZ'], launchDate: iso(todayMs - 25 * DAY), cap: 40000, target: 1000000, periodDays: 30, prepDays: 3, transitDays: 1, supplyDays: 10, minOrder: 30, learningEvents: 62, everValidated: true };
  nexor.daily = series(r, { days: 25, todayMs, leads: 25, cplUsd: 1.5, conf: 0.62, del: 0.6, ...nexor, ...biz, firstContactMin: 18, cancelMix: cancelBase });
  nexor.variants = [variant('أسود', { sellable: 35, outPerDay: 6, backPerDay: 1.5, deliveredPerDay: 5 }), variant('فضي', { sellable: 20, outPerDay: 3, backPerDay: 1, deliveredPerDay: 2.5 })];

  const set = { id: 'p-set', name: 'طقم سارة', sell: 3900, buy: 2600, ...common, surplus: 0.2, surplusMode: 'workshop', planConf: 0.5, planDel: 0.55, planLeadUsd: 1.8, tags: ['TEST', 'SRC-MA'], launchDate: iso(todayMs - 6 * DAY), cap: 20000, target: 300000, periodDays: 30, prepDays: 5, transitDays: 2, supplyDays: 10, minOrder: 40, learningEvents: 18 };
  set.daily = series(r, { days: 6, todayMs, leads: 14, cplUsd: 1.8, conf: 0.5, del: 0.55, ...set, ...biz, firstContactMin: 25, cancelMix: cancelBase });
  set.variants = [variant('Standard', { sellable: 30, outPerDay: 2, backPerDay: 0, deliveredPerDay: 0 })];

  const hijab = { id: 'p-hijab', name: 'حجاب نور', sell: 2900, buy: 800, ...common, surplus: 0, surplusMode: 'wholesale', planConf: 0.6, planDel: 0.65, planLeadUsd: 0.9, tags: ['HARVEST', 'SRC-TR'], launchDate: iso(todayMs - 90 * DAY), cap: 30000, target: 400000, periodDays: 30, prepDays: 10, transitDays: 3, supplyDays: 20, minOrder: 100, learningEvents: 300, everValidated: true };
  hijab.daily = series(r, { days: 60, todayMs, leads: 30, cplUsd: 0.8, conf: 0.6, del: 0.66, ...hijab, ...biz, firstContactMin: 20, trend: -0.7, cplTrend: 0.9, cancelMix: { 'شرا من بلاصة أخرى': 0.35, 'السعر': 0.25, 'ما جاوبش': 0.4 } });
  hijab.variants = [variant('بيج', { sellable: 180, outPerDay: 2, backPerDay: 0.3, deliveredPerDay: 1.5 }), variant('أسود', { sellable: 90, outPerDay: 2, backPerDay: 0.3, deliveredPerDay: 1.6 })];

  const abaya = { id: 'p-abaya', name: 'عباية ريم', sell: 5200, buy: 1900, ...common, surplus: 0.15, surplusMode: 'workshop', planConf: 0.58, planDel: 0.55, planLeadUsd: 1.7, tags: ['FIX', 'SRC-DZ', 'PRF-abaya'], launchDate: iso(todayMs - 18 * DAY), cap: 35000, target: 600000, periodDays: 30, prepDays: 6, transitDays: 2, supplyDays: 12, minOrder: 50, learningEvents: 55, ordersNoContactHours: [5, 6] };
  abaya.daily = series(r, { days: 18, todayMs, leads: 22, cplUsd: 1.7, conf: 0.41, del: 0.55, ...abaya, ...biz, firstContactMin: 240, cancelMix: { 'ما جاوبش': 0.6, 'بدّل رأيو': 0.4 } });
  abaya.variants = [variant('S/M', { sellable: 45, outPerDay: 3, backPerDay: 0.5, deliveredPerDay: 2 }), variant('L/XL', { sellable: 30, outPerDay: 2, backPerDay: 0.3, deliveredPerDay: 1.4 })];

  // تاريخ رأس المال (يتسجّل كل نهار على 04:00) — آخر نقطة = الحالة اليوم
  const equityHistory = [];
  for (let i = 30; i >= 0; i--) {
    const t = 30 - i;
    const dip = t > 18 && t < 24 ? 220000 : 0;
    equityHistory.push({ date: iso(todayMs - i * DAY), wallets: 1000000 + t * 17700 - dip, carrier: 1150000 + t * 6700, stock: 900000 - t * 4700 });
  }

  return {
    demo: true,
    business: {
      name: 'متجر تجريبي', usdRate: usd, usdRateUpdatedAt: iso(todayMs - 3 * DAY), reserve: 500000,
      ...biz, teamReady: true, adsLinked: true, unprocessedReturns: 0, lastWithdrawalLogged: iso(todayMs - 2 * DAY),
      abandonRecoveryRate: 0.25, resellRate: 0.6, depositRate: 0.3,
      wallets: [{ name: 'الصندوق', balance: 1250000 }, { name: 'ADS', balance: 280000 }],
      carrierReceivable: [
        { amount: 900000, deliveredAt: iso(todayMs - 3 * DAY) },
        { amount: 450000, deliveredAt: iso(todayMs - 9 * DAY) },
      ],
      splitYesterday: { paper: 3640000, cash: 1500000, atCarrier: 1330000, locked: 790000 },
      equityHistory,
    },
    products: [lina, nexor, set, hijab, abaya],
  };
}
