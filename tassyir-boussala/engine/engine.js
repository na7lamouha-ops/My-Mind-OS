// البوصلة — المحرّك (عقل واحد).
// كل رقم وكل حد يتحسب هنا من أرقام التاجر والمنتج. الشاشات والتقرير يقراو غير من analyzeBusiness().
// ما كاين حتى رقم تجاري ثابت هنا: العتبات (30 دقيقة، 75 يوم، SPREAD…) هي «السياسة» تاع التاجر،
// قيمها الأولى من البرومبت، وتتبدّل بموافقتو (DEFAULT_POLICY ← business.policy).

import { money } from './format.js';

// ─────────────────────────────── السياسة (قابلة للتعديل) ───────────────────────────────
export const DEFAULT_POLICY = Object.freeze({
  spread: { leadWorse: 0.25, leadBetter: 0.15, confWorse: 0.06, confBetter: 0.04, delWorse: 0.08, delBetter: 0.05 },
  scenarios: 300,
  commitmentQuantile: 0.1, // 9 مرات من 10
  minSampleLeads: 100, // قبلها: نسب التاجر
  minSampleParcels: 30,
  learningEvents: 50, // ميتا خرجت من التعلّم
  stopNoLeadMultiple: 3, // ستوب بلا ليد = 3 × أغلى ليد
  trailingDays: 3,
  creativeRecentDays: 7,
  creativeBaseDays: 21,
  creativeDeadMargin: 0.1, // الضجيج: 0 = حرفياً «فوق» — التاجر يقدر يبدّلها
  oldProductDays: 75,
  driftPoints: 0.05,
  driftDays: 7,
  coverLimitDays: 60, // ربح محبوس
  safetyDays: 3,
  firstContactTargetMin: 30,
  firstContactLeverMin: 15,
  noContactAlertHours: 4,
  carrierStaleDays: 7,
  trustMin: 70,
  velocityDropRatio: 0.5, // السرعة طاحت للنص
  harvestMaxCv: 0.15, // الربح على الطرد مستقر
  successPrior: 4, // (VALIDE + 4×p0) ÷ (تجرّبو + 4)
  fasterPayoutDays: 3,
  surplusWorkshopFactor: 0.5,
  reportHour: 8,
  pullHour: 4,
  timezoneOffsetHours: 1, // الجزائر UTC+1 بلا توقيت صيفي
});

export function policyOf(business) {
  const p = business?.policy || {};
  return { ...DEFAULT_POLICY, ...p, spread: { ...DEFAULT_POLICY.spread, ...(p.spread || {}) } };
}

// ─────────────────────────────── أدوات ───────────────────────────────
const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

export class Unresolved extends Error {
  constructor(missing) {
    super(`غير محسوم: ناقص ${missing.join('، ')}`);
    this.missing = missing;
  }
}

// ─────────────────────────────── 3) الصيغ ───────────────────────────────
// ثمن الليد بالدينار = الدولار × سعر التاجر (ماشي 245 ولا 250 ولا 255 ثابت).
export function leadDzd(leadUsd, usdRate) {
  if (!isNum(leadUsd) || !isNum(usdRate) || usdRate <= 0) return null;
  return leadUsd * usdRate;
}

// تكلفة الفائض على الطلبية: ورشة = buy × فائض × 0.5، جملة = buy × فائض السيري.
export function surplusCost({ buy, surplus = 0, surplusMode = 'workshop' }, policy = DEFAULT_POLICY) {
  if (!surplus) return 0;
  return surplusMode === 'wholesale' ? buy * surplus : buy * surplus * policy.surplusWorkshopFactor;
}

const ECON_FIELDS = ['sell', 'buy', 'pack', 'delCost', 'retCost', 'conf', 'del', 'lead'];
export function missingInputs(p) {
  return ECON_FIELDS.filter((k) => !isNum(p[k]));
}

/**
 * p: { sell, buy, pack, delCost, retCost, conf, del, lead (دج), surplus, surplusMode }
 * يرجّع كل حدود المنتج. لو ناقص رقم ← Unresolved (التطبيق يسقسي).
 */
export function unitEconomics(p, policy = DEFAULT_POLICY) {
  const missing = missingInputs(p);
  if (missing.length) throw new Unresolved(missing);
  const { sell, buy, pack, delCost, retCost, lead } = p;
  const conf = clamp01(p.conf);
  const del = clamp01(p.del);
  const sc = surplusCost(p, policy);
  const ppo = sell - buy - pack - delCost;
  const netPerLead = conf * del * (ppo - sc) - conf * (1 - del) * retCost - lead;
  const netPerDelivered = conf * del > 0 ? netPerLead / (conf * del) : -Infinity;
  const ceiling = del * (ppo - sc) - (1 - del) * retCost; // على المؤكّدة
  const maxLead = ceiling * conf; // خط توقف الليد
  const minConf = ceiling > 0 ? lead / ceiling : Infinity;
  const minDel = conf > 0 ? (lead / conf + retCost) / (ppo - sc + retCost) : Infinity;
  const minPrice =
    conf * del > 0 ? (lead + conf * (1 - del) * retCost) / (conf * del) + buy + pack + delCost + sc : Infinity;
  return { sell, buy, pack, delCost, retCost, ppo, sc, conf, del, lead, netPerLead, netPerDelivered, ceiling, maxLead, minConf, minDel, minPrice };
}

// الحالات الثلاث: الوسط ± SPREAD.
export function scenarioInputs(p, spread = DEFAULT_POLICY.spread) {
  return {
    mid: { ...p },
    worst: {
      ...p,
      lead: p.lead * (1 + spread.leadWorse),
      conf: clamp01(p.conf - spread.confWorse),
      del: clamp01(p.del - spread.delWorse),
    },
    best: {
      ...p,
      lead: p.lead * (1 - spread.leadBetter),
      conf: clamp01(p.conf + spread.confBetter),
      del: clamp01(p.del + spread.delBetter),
    },
  };
}

export function threeCases(p, policy = DEFAULT_POLICY) {
  const s = scenarioInputs(p, policy.spread);
  const mid = unitEconomics(s.mid, policy);
  const worst = unitEconomics(s.worst, policy);
  const best = unitEconomics(s.best, policy);
  // السقف الأسوأ = نفس السقف بالتوصيل الأسوأ (نفس التأكيد والليد).
  const worstDel = unitEconomics({ ...p, del: s.worst.del }, policy);
  return { mid, worst, best, worstCeiling: worstDel.ceiling, worstDelMaxLead: worstDel.maxLead };
}

// ─────────────────────────────── الحجم وسقف السوق ───────────────────────────────
// history: [{ leads, cpl }] بالنهار. خط: cpl = a + b·n.
export function fitVolume(history) {
  const pts = (history || []).filter((h) => h.leads > 0 && isNum(h.cpl));
  if (pts.length < 2) return pts.length ? { a: pts[0].cpl, b: 0, maxSeen: pts[0].leads, n: 1 } : null;
  const xs = pts.map((h) => h.leads);
  const ys = pts.map((h) => h.cpl);
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < pts.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const b = sxx > 0 ? Math.max(0, sxy / sxx) : 0; // عقوبة الحجم: الليد ما يرخصش كي نكبرو
  return { a: my - b * mx, b, maxSeen: Math.max(...xs), n: pts.length };
}

export function leadAt(fit, n) {
  return fit.a + fit.b * n;
}

// سقف السوق: أكبر عدد ليدات في النهار قبل ما الليد يفوت أغلى ليد.
// بلا ميل مقاس ← ما نخطّطوش فوق أكبر نهار شفناه (ما نعرفوش واش كاين فوقو).
export function marketCap(history, maxLead) {
  const fit = fitVolume(history);
  if (!fit) return null;
  if (fit.b <= 0) return fit.maxSeen;
  const n = (maxLead - fit.a) / fit.b;
  return Math.max(0, Math.floor(n));
}

// خطة النهار: شحال ليد في النهار يلزم باش نوصلو الهدف، بلا ما نفوتو سقف السوق.
export function planDaily(p, { target, days, history }, policy = DEFAULT_POLICY) {
  const eco = unitEconomics(p, policy);
  if (eco.netPerLead <= 0) {
    return { plannable: false, reason: 'صافي الليد تحت الصفر — ما يتخطّطلوش', eco };
  }
  const fit = fitVolume(history) || { a: p.lead, b: 0, maxSeen: Infinity };
  const cap = marketCap(history, eco.maxLead) ?? Infinity;
  // الليد عند n = ثمن الليد الحالي + عقوبة الحجم فوق المستوى الحالي (متوسط التاريخ).
  const seen = (history || []).filter((h) => h.leads > 0).map((h) => h.leads);
  const n0 = seen.length ? mean(seen) : 0;
  const leadAtN = (n) => p.lead + Math.max(0, fit.b * (n - n0));
  const dailyProfit = (n) => n * (eco.netPerLead + p.lead - leadAtN(n));
  let n = 0;
  const step = 0.5;
  for (let i = 0; i < 1e6 && n < cap && dailyProfit(n) * days < target; i++) n += step;
  n = Math.min(n, cap);
  const achievable = dailyProfit(n) * days;
  return {
    plannable: true,
    leadsPerDay: n,
    marketCap: cap,
    capped: achievable < target,
    achievable,
    leadAtPlan: leadAtN(n),
    eco,
  };
}

// ─────────────────────────────── 300 سيناريو والالتزام ───────────────────────────────
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function triangular(u, lo, mode, hi) {
  if (hi <= lo) return mode;
  const f = (mode - lo) / (hi - lo);
  return u < f ? lo + Math.sqrt(u * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode));
}

export function monteCarlo(p, { leadsPerDay, days, target, seed = 7 }, policy = DEFAULT_POLICY) {
  const s = scenarioInputs(p, policy.spread);
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < policy.scenarios; i++) {
    const lead = triangular(r(), s.best.lead, s.mid.lead, s.worst.lead);
    const conf = triangular(r(), s.worst.conf, s.mid.conf, s.best.conf);
    const del = triangular(r(), s.worst.del, s.mid.del, s.best.del);
    const e = unitEconomics({ ...p, lead, conf, del }, policy);
    const daily = e.netPerLead * leadsPerDay;
    out.push({ profit: daily * days, daily, dayToTarget: daily > 0 && target ? Math.ceil(target / daily) : Infinity });
  }
  const profits = out.map((o) => o.profit).sort((a, b) => a - b);
  const reachDays = out.map((o) => o.dayToTarget).sort((a, b) => a - b);
  const q = policy.commitmentQuantile;
  const idx = Math.floor(q * profits.length);
  return {
    n: out.length,
    commitment: profits[idx], // نوصلولو 9 مرات من 10
    commitmentDaily: profits[idx] / days,
    median: profits[Math.floor(profits.length / 2)],
    best10: profits[profits.length - 1 - idx],
    dayToTarget90: reachDays[Math.min(reachDays.length - 1, Math.ceil((1 - q) * reachDays.length) - 1)],
  };
}

// ─────────────────────────────── رأس المال (يوم بيوم) ───────────────────────────────
// الأدس يتخلّص نهار الإعلان • السلعة تتشرى قبل بـ prepDays • الكاش يرجع بعد (توصيل + سحب).
export function capitalNeeded(p, { leadsPerDay, days, deliveryDays, payoutDays, prepDays = 0 }, policy = DEFAULT_POLICY) {
  const e = unitEconomics(p, policy);
  const Tc = deliveryDays + payoutDays;
  const N = days + Tc + prepDays + 2;
  const flow = new Float64Array(N + prepDays + 1);
  const off = prepDays; // نحاسبو نهارات التحضير قبل اليوم 1
  const unitCost = p.buy * (1 + (p.surplus || 0));
  const confirmed = leadsPerDay * e.conf;
  const backPieces = confirmed * (1 - e.del);
  for (let d = 1; d <= days; d++) {
    flow[off + d] -= leadsPerDay * e.lead + confirmed * e.del * p.pack; // أدس + تغليف/عمولة
    // السلعة: نشريو غير الناقص؛ الروتور يرجع للمخزن بعد Tc
    const reused = d > Tc ? backPieces : 0;
    flow[off + d - prepDays] -= Math.max(0, confirmed - reused) * unitCost;
    if (d + Tc < N) {
      flow[off + d + Tc] += confirmed * e.del * (p.sell - p.delCost) - backPieces * p.retCost;
    }
  }
  let cash = 0;
  let min = 0;
  let minDay = 0;
  for (let i = 0; i < flow.length; i++) {
    cash += flow[i];
    if (cash < min) {
      min = cash;
      minDay = i - off;
    }
  }
  return { capital: Math.ceil(-min), worstDay: minDay, cycleDays: Tc };
}

// ─────────────────────────────── الستوك ───────────────────────────────
// المتاح = Sellable، ولا totalItems − موصّل − في الطريق − خاسر. totalItems وحدها ماشي ستوك.
export function availableStock(inv) {
  if (!inv) return null;
  if (isNum(inv.sellable)) return inv.sellable;
  if (!isNum(inv.totalItems)) return null;
  const lost = (inv.damaged || 0) + (inv.lost || 0);
  return Math.max(0, inv.totalItems - (inv.delivered || 0) - (inv.inTransit || 0) - lost);
}

/**
 * v: { inventory, out:[قطع خرجت/نهار], backIn:[رواجع رجعو للمخزن/نهار], delivered:[موصّلة/نهار] }
 * cfg: { prepDays, transitDays, supplyDays, minOrder, stage }
 */
export function stockPlan(v, cfg, policy = DEFAULT_POLICY) {
  const available = availableStock(v.inventory);
  const last = (a, n) => (a || []).slice(-n);
  const velocity = Math.max(0, mean(last(v.out, 7)) - mean(last(v.backIn, 7)));
  const deliveredPerDay = mean(last(v.delivered, 7));
  const coverDays = deliveredPerDay > 0 ? available / deliveredPerDay : available > 0 ? Infinity : 0;
  const reorderPoint = velocity * ((cfg.prepDays || 0) + (cfg.transitDays || 0) + policy.safetyDays);
  const suggested = Math.max(Math.ceil(velocity * ((cfg.supplyDays || 0) + policy.safetyDays)), cfg.minOrder || 0);
  let status = 'مرتاح';
  const noSalesYet = deliveredPerDay === 0 && (cfg.ageDays ?? Infinity) < policy.coverLimitDays;
  if (noSalesYet) status = 'بلا بيع بعد';
  else if (coverDays > policy.coverLimitDays) status = 'محبوس';
  else if (available <= reorderPoint) status = cfg.stage === 'DESTOCK' ? 'خلاص — تصفية' : 'اطلب اليوم';
  const canOrder = status === 'اطلب اليوم'; // تنبيه «اطلب» ممنوع على DESTOCK وعلى المحبوس
  return { available, velocity, deliveredPerDay, coverDays, reorderPoint, suggested: canOrder ? suggested : 0, status, canOrder };
}

// ─────────────────────────────── الربح المقسوم ───────────────────────────────
export function productCashProfit(t) {
  return t.collected - t.ads - t.cogsDelivered - t.returns - t.commission - t.packing;
}

export function splitProfit({ wallets = [], carrier = [], stock = [] }, today, policy = DEFAULT_POLICY) {
  const cash = sum(wallets.map((w) => w.balance));
  const atCarrier = sum(carrier.map((c) => c.amount));
  const locked = sum(stock.map((s) => s.available * s.buy)); // بسعر الشراء، ماشي سعر البيع
  const slowLocked = sum(stock.filter((s) => s.coverDays > policy.coverLimitDays).map((s) => s.available * s.buy));
  const ages = carrier.map((c) => daysBetween(c.deliveredAt, today));
  const oldestCarrierDays = ages.length ? Math.max(...ages) : 0;
  const staleCarrier = sum(carrier.filter((c, i) => ages[i] > policy.carrierStaleDays).map((c) => c.amount));
  return { paper: cash + atCarrier + locked, cash, atCarrier, locked, slowLocked, oldestCarrierDays, staleCarrier, spendable: cash };
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

// ─────────────────────────────── 4) المراحل والتاغات ───────────────────────────────
export const STAGE_TAGS = ['TEST', 'FIX', 'VALIDE', 'SCALE', 'HARVEST', 'DESTOCK', 'ECHEC-ADS', 'ECHEC-CONF', 'ECHEC-RESERVE'];
export const STAGE_LABEL = {
  TEST: 'تاست',
  FIX: 'صلّح حاجة وحدة',
  VALIDE: 'دخول مؤكّد',
  SCALE: 'تكبير',
  HARVEST: 'حصاد',
  DESTOCK: 'تصفية',
  'ECHEC-ADS': 'فشل: الإعلان',
  'ECHEC-CONF': 'فشل: التأكيد',
  'ECHEC-RESERVE': 'احتياط',
};

export function stageOf(tags) {
  return (tags || []).find((t) => STAGE_TAGS.includes(t)) || null;
}

// update_product يبدّل التاغات كاملين ← نقراو القدام، نحيّو المرحلة القديمة برك، ونزيدو الجديدة.
export function mergeStageTag(oldTags, newStage) {
  if (!STAGE_TAGS.includes(newStage)) throw new Error(`تاغ مرحلة مجهول: ${newStage}`);
  const kept = (oldTags || []).filter((t) => !STAGE_TAGS.includes(t));
  return [...kept, newStage];
}

// احتمال النجاح حسب المصدر: (VALIDE + 4×p0) ÷ (تجرّبو + 4)
export function sourceSuccess(products, policy = DEFAULT_POLICY) {
  const isSrc = (t) => /^(SRC|PRF)-/.test(t);
  const succeeded = (p) => ['VALIDE', 'SCALE', 'HARVEST', 'DESTOCK'].includes(stageOf(p.tags)) || p.everValidated;
  const decided = products.filter((p) => stageOf(p.tags) && stageOf(p.tags) !== 'TEST');
  const p0 = decided.length ? decided.filter(succeeded).length / decided.length : null;
  if (p0 === null) return { p0: null, bySource: [] };
  const groups = new Map();
  for (const p of decided) {
    for (const t of (p.tags || []).filter(isSrc)) {
      const g = groups.get(t) || { source: t, tried: 0, valide: 0 };
      g.tried++;
      if (succeeded(p)) g.valide++;
      groups.set(t, g);
    }
  }
  const k = policy.successPrior;
  const bySource = [...groups.values()]
    .map((g) => ({ ...g, probability: (g.valide + k * p0) / (g.tried + k) }))
    .sort((a, b) => b.probability - a.probability);
  return { p0, bySource };
}

/** الحكم على المرحلة. m = مقاييس المنتج المحسوبة في analyzeProduct. */
export function classifyStage(m, policy = DEFAULT_POLICY) {
  const cur = m.stage;
  const r = (stage, why) => ({ stage, why, changed: stage !== cur });
  if (cur && cur.startsWith('ECHEC-') && !m.newAngle) return r(cur, 'فشل مسجّل — ما يرجعش بلا زاوية جديدة ولا تصليح');
  const { cases } = m;
  if (cur === 'DESTOCK' || m.destockSignal) {
    if (m.destockSignal) return r('DESTOCK', m.destockSignal);
  }
  if (cases.best.netPerLead < 0) {
    // حتى أحسن حالة تخسّر: علاش؟
    if (m.confAtPlanProfitable) return r('ECHEC-CONF', `التأكيد ${pctTxt(cases.mid.conf)} هو السبب — بتأكيد الخطة يربح`);
    return r('ECHEC-ADS', `حتى أحسن حالة تخسّر بسبب ثمن الليد (${money(cases.best.lead)} > ${money(cases.best.maxLead)})`);
  }
  if (m.capReached && !['VALIDE', 'SCALE', 'HARVEST'].includes(cur)) {
    if (cases.mid.netPerLead > 0) return r('ECHEC-RESERVE', 'وصل للحد (cap) وهو رابح بالأرقام الحالية — يرجع كي تتحل بلاصة');
    return r(m.confAtPlanProfitable ? 'ECHEC-CONF' : 'ECHEC-ADS', 'وصل للحد (cap) وهو خاسر');
  }
  if (cases.mid.netPerLead > 0 && m.confUpper < m.planConf) {
    return r('FIX', `رابح بصح التأكيد أكيد تحت الأرضية (${pctTxt(m.confUpper)} < ${pctTxt(m.planConf)})`);
  }
  const validated = cases.worst.netPerLead > 0 && m.learningEvents >= policy.learningEvents;
  if (!validated) {
    if (cur === 'SCALE' || cur === 'HARVEST') return r(cur, 'مازال — بصح الحالة الأسوأ ما تربحش، راقب الستوب المتحرّك');
    return r('TEST', cases.worst.netPerLead <= 0 ? 'الحالة الأسوأ مازال ما تربحش' : `ميتا مازالت تتعلّم (${m.learningEvents}/${policy.learningEvents} حدث)`);
  }
  if (cur === 'HARVEST' || (cur === 'SCALE' && m.stable)) return r('HARVEST', 'الربح على الطرد مستقر');
  if (cur === 'SCALE') return r('SCALE', m.gate.open ? 'البوابة مفتوحة — كمّل الخطوة' : `مازال تكبير، بصح الخطوة الجاية مسدودة: ${m.gate.blockers.join('، ')}`);
  if (m.gate.open) return r('SCALE', 'البوابة مفتوحة: فريق + كاش رجع + ستوك');
  return r('VALIDE', `حتى أسوأ حالة تربح — البوابة مسدودة: ${m.gate.blockers.join('، ')}`);
}
const pctTxt = (x) => `${Math.round(x * 100)}%`;

// ─────────────────────────────── السبب الجذري ───────────────────────────────
// قبل «وقّف الإعلان»: إذا أول اتصال فوق 30 دقيقة ولا التأكيد طاح ← المشكل في الفريق.
export function rootCause({ firstContactMin, confNow, confPlan, p, ecoNow }, policy = DEFAULT_POLICY) {
  const slow = isNum(firstContactMin) && firstContactMin > policy.firstContactTargetMin;
  const confDropped = isNum(confNow) && isNum(confPlan) && confPlan - confNow >= policy.driftPoints;
  if (slow || confDropped) {
    const atTarget = p ? unitEconomics({ ...p, conf: confPlan }, policy) : null;
    const why = [
      slow ? `أول اتصال ${Math.round(firstContactMin)} دقيقة (الحد ${policy.firstContactTargetMin})` : null,
      confDropped ? `التأكيد ${pctTxt(confNow)} قدّام الخطة ${pctTxt(confPlan)}` : null,
    ].filter(Boolean);
    return {
      cause: 'الفريق',
      verdict: 'صلّح الفريق قبل ما توقّف الإعلان',
      why,
      maxLeadAtTarget: atTarget?.maxLead ?? null,
      profitableAtTarget: atTarget ? atTarget.netPerLead > 0 : null,
    };
  }
  return { cause: ecoNow && ecoNow.netPerLead < 0 ? 'الإعلان' : 'لا شيء', verdict: ecoNow && ecoNow.netPerLead < 0 ? 'وقّف الإعلان' : 'كمّل', why: [] };
}

// ─────────────────────────────── ثقة البيانات ───────────────────────────────
export function dataTrust(checks, policy = DEFAULT_POLICY) {
  const items = [
    { key: 'buyPrices', label: 'ثمن الشراء معمّر', ok: !!checks.buyPrices },
    { key: 'returnsProcessed', label: 'الرواجع معالجة', ok: !!checks.returnsProcessed },
    { key: 'withdrawalsLogged', label: 'السحوبات مسجّلة', ok: !!checks.withdrawalsLogged },
    { key: 'adsLinked', label: 'الإعلانات مربوطة', ok: !!checks.adsLinked },
    { key: 'usdFresh', label: 'الدولار محدّث', ok: !!checks.usdFresh },
  ];
  const score = Math.round((items.filter((i) => i.ok).length / items.length) * 100);
  return { score, canJudge: score >= policy.trustMin, items, missing: items.filter((i) => !i.ok).map((i) => i.label) };
}

// ─────────────────────────────── منحنى الترايدينغ ───────────────────────────────
/**
 * daily: [{date, spend(دج), leads, collected, cogsDelivered, returns, commission, packing, deliveredValue}]
 * الخط الحقيقي = الكاش الصافي التراكمي = القبض الحقيقي − الأدس − السلعة الموصّلة − الروتور − العمولة − التغليف.
 * المخروط: نفس الليدات الحقيقية × الحالات الثلاث، بنفس التوقيت: التكاليف نهار التوصيل، الكاش نهار السحب.
 * الستوب يتقاس على «الكاش + عند شركة التوصيل» (الموصّل وماشي مقبوض) — باش تأخير السحب وحدو ما يوقّفش منتج رابح.
 */
export function tradingCurve(daily, cases, { deliveryDays = 0, payoutDays = 0, cap }) {
  const Tc = deliveryDays + payoutDays;
  let real = 0;
  let owed = 0;
  const leadsByDay = daily.map((d) => d.leads || 0);
  const cone = { mid: 0, worst: 0, best: 0 };
  const points = daily.map((d, i) => {
    real += (d.collected || 0) - (d.spend || 0) - (d.cogsDelivered || 0) - (d.returns || 0) - (d.commission || 0) - (d.packing || 0);
    owed += (d.deliveredValue || 0) - (d.collected || 0);
    for (const k of ['mid', 'worst', 'best']) {
      const c = cases[k];
      const cd = c.conf * c.del;
      cone[k] -= leadsByDay[i] * c.lead;
      const j = i - deliveryDays;
      if (j >= 0) cone[k] -= leadsByDay[j] * (cd * (c.sell - c.delCost - c.ppo) + c.conf * (1 - c.del) * c.retCost); // سلعة + تغليف + فائض + روتور
      const q = i - Tc;
      if (q >= 0) cone[k] += leadsByDay[q] * cd * (c.sell - c.delCost);
    }
    const zone = real >= cone.mid ? 'green' : real >= cone.worst ? 'yellow' : 'red';
    return { day: i + 1, date: d.date, real, withCarrier: real + owed, mid: cone.mid, worst: cone.worst, best: cone.best, zone };
  });
  const stopLine = isNum(cap) ? -cap : null;
  const last = points[points.length - 1];
  return { points, stopLine, zone: last?.zone || null, stopTouched: stopLine !== null && !!last && last.withCarrier <= stopLine };
}

// علامات التدهور (بتاريخها).
export function degradationSignals(m, policy = DEFAULT_POLICY) {
  const out = [];
  const d = m.daily;
  const cpl = (rows) => {
    const l = sum(rows.map((r) => r.leads));
    return l > 0 ? sum(rows.map((r) => r.spend)) / l : null;
  };
  const R = policy.creativeRecentDays;
  const B = policy.creativeBaseDays;
  if (d.length >= R + B) {
    const recent = cpl(d.slice(-R));
    const base = cpl(d.slice(-(R + B), -R));
    if (recent !== null && base !== null && recent > base * (1 + policy.creativeDeadMargin)) {
      out.push({ code: 'creative', icon: '💀', label: 'كرياتيف مات', date: d[d.length - 1].date, detail: `الليد ${money(recent)} آخر ${R} أيام قدّام ${money(base)} في ${B} يوم اللي قبلهم` });
    }
    const leadsRecent = mean(d.slice(-R).map((r) => r.leads));
    const leadsBase = mean(d.slice(-(R + B), -R).map((r) => r.leads));
    const confDrop = isNum(m.confPrev) && m.confPrev - m.confRecent >= policy.driftPoints;
    if (recent !== null && base !== null && recent > base && leadsRecent < leadsBase && confDrop && m.priceCancelShare >= 0.5) {
      out.push({ code: 'competitor', icon: '⚔️', label: 'منافس دخل', date: d[d.length - 1].date, detail: `الإعلانات طاحو، التأكيد طاح، و${Math.round(m.priceCancelShare * 100)}% من الإلغاء «شرا من بلاصة أخرى / السعر»` });
    }
    if (m.ageDays > policy.oldProductDays && leadsRecent < leadsBase) {
      out.push({ code: 'old', icon: '⏳', label: 'منتج قديم', date: d[d.length - 1].date, detail: `عمرو ${m.ageDays} يوم والليدات تطيح ← حضّر الخليفة` });
    }
  }
  if (m.driftDays >= policy.driftDays) {
    out.push({ code: 'drift', icon: '📉', label: 'التأكيد ولا التوصيل بعاد على الخطة', date: d[d.length - 1]?.date, detail: `${m.driftDays} أيام بفرق ${Math.round(policy.driftPoints * 100)} نقاط ولا أكثر` });
  }
  if (m.coverDays > policy.coverLimitDays) {
    out.push({ code: 'locked', icon: '🧊', label: 'ربح محبوس', date: d[d.length - 1]?.date, detail: `التغطية ${Math.round(m.coverDays)} يوم > ${policy.coverLimitDays}` });
  }
  return out;
}

// ─────────────────────────────── منحنى البيزنس ───────────────────────────────
export function equityCurve(history, { reserve, commitmentDaily = 0 }) {
  let peak = -Infinity;
  let maxDD = 0;
  let maxDDPct = 0;
  const start = history[0] ? history[0].wallets + history[0].carrier + history[0].stock : 0;
  const points = history.map((h, i) => {
    const equity = h.wallets + h.carrier + h.stock;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPct = peak > 0 ? dd / peak : 0;
    }
    return { date: h.date, equity, cash: h.wallets, reference: start + commitmentDaily * i, belowReserve: h.wallets < reserve };
  });
  const last = points[points.length - 1];
  return { points, reserve, drawdown: maxDD, drawdownPct: maxDDPct, aboveReference: last ? last.equity - last.reference : 0 };
}

// ─────────────────────────────── تحليل منتج ───────────────────────────────
function rates(daily, n) {
  const rows = daily.slice(-n);
  const leads = sum(rows.map((r) => r.leads));
  const confirmed = sum(rows.map((r) => r.confirmed));
  const delivered = sum(rows.map((r) => r.delivered));
  const returned = sum(rows.map((r) => r.returned));
  return { leads, confirmed, delivered, returned, conf: leads ? confirmed / leads : null, del: delivered + returned ? delivered / (delivered + returned) : null };
}

export function analyzeProduct(prod, business, today, policy = policyOf(business)) {
  const missing = [];
  const usd = business.usdRate;
  if (!isNum(usd)) missing.push('سعر الدولار (المالية ← أسعار الصرف)');
  if (!isNum(prod.buy) || prod.buy <= 0) missing.push('ثمن الشراء');
  const daily = (prod.daily || []).map((d) => ({ ...d, spend: isNum(usd) ? (d.spendUsd || 0) * usd : null }));
  const stage = stageOf(prod.tags);
  const base = { id: prod.id, name: prod.name, tags: prod.tags, stage, stageLabel: STAGE_LABEL[stage] || '—', image: prod.image };
  if (missing.length) return { ...base, unresolved: true, missing };

  // الوسط = النسب الحقيقية المقاسة، وقبل العيّنة الكافية: نسب التاجر.
  const r30 = rates(daily, 30);
  const measuredConf = r30.leads >= policy.minSampleLeads ? r30.conf : null;
  const measuredDel = r30.delivered + r30.returned >= policy.minSampleParcels ? r30.del : null;
  const spend30 = sum(daily.slice(-30).map((d) => d.spend));
  const cplMeasured = r30.leads > 0 ? spend30 / r30.leads : null;
  const leadNow = cplMeasured ?? leadDzd(prod.planLeadUsd, usd);
  const econInput = {
    sell: prod.sell, buy: prod.buy, pack: prod.pack, delCost: prod.delCost, retCost: prod.retCost,
    surplus: prod.surplus || 0, surplusMode: prod.surplusMode || 'workshop',
    conf: measuredConf ?? prod.planConf, del: measuredDel ?? prod.planDel, lead: leadNow,
  };
  const miss2 = missingInputs(econInput);
  if (miss2.length) return { ...base, unresolved: true, missing: miss2 };
  const sources = {
    conf: measuredConf !== null ? '⟵ الطلبيات' : '⟵ كتبتو أنت',
    del: measuredDel !== null ? '⟵ الطلبيات' : '⟵ كتبتو أنت',
    lead: cplMeasured !== null ? '⟵ ميتا' : '⟵ كتبتو أنت',
    costs: '⟵ تسيير (التكاليف)',
  };
  const cases = threeCases(econInput, policy);
  const cycleDays = (business.deliveryDays || 0) + (business.payoutDays || 0);
  const ageDaysEarly = prod.launchDate ? daysBetween(prod.launchDate, today) : 0;

  // الستوك لكل متغيّر
  const variants = (prod.variants || []).map((v) => ({
    sku: v.sku, label: v.label, ...stockPlan(v, { prepDays: prod.prepDays, transitDays: prod.transitDays, supplyDays: prod.supplyDays, minOrder: prod.minOrder, stage, ageDays: ageDaysEarly }, policy),
  }));
  const totalDemand = sum(variants.map((v) => v.velocity));
  variants.forEach((v) => (v.demandShare = totalDemand > 0 ? v.velocity / totalDemand : 0));
  const available = sum(variants.map((v) => v.available));
  const deliveredPerDay = sum(variants.map((v) => v.deliveredPerDay));
  const coverDays = deliveredPerDay > 0 ? available / deliveredPerDay : available > 0 ? Infinity : 0;
  const velocity = totalDemand;
  const reorderPoint = sum(variants.map((v) => v.reorderPoint));

  // المنحنى
  const curve = tradingCurve(daily, cases, { deliveryDays: business.deliveryDays || 0, payoutDays: business.payoutDays || 0, cap: prod.cap });
  const spendTotal = sum(daily.map((d) => d.spend));
  const leadsTotal = sum(daily.map((d) => d.leads));
  const stopNoLead = leadsTotal === 0 && spendTotal >= policy.stopNoLeadMultiple * cases.mid.maxLead;
  const t = policy.trailingDays;
  const recentT = daily.slice(-t);
  const cplT = sum(recentT.map((d) => d.leads)) ? sum(recentT.map((d) => d.spend)) / sum(recentT.map((d) => d.leads)) : null;
  const trailingStop = ['SCALE', 'HARVEST'].includes(stage) && cplT !== null && cplT > cases.worstDelMaxLead;

  // انحراف التأكيد/التوصيل على الخطة (أيام متتالية)
  let driftDays = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    const w = rates(daily.slice(0, i + 1), 7);
    const off = (w.conf !== null && prod.planConf - w.conf >= policy.driftPoints) || (w.del !== null && prod.planDel - w.del >= policy.driftPoints);
    if (!off) break;
    driftDays++;
  }
  const r7 = rates(daily, 7);
  const rPrev = rates(daily.slice(0, -7), 21);
  const cancels = {};
  daily.slice(-14).forEach((d) => Object.entries(d.cancelReasons || {}).forEach(([k, n]) => (cancels[k] = (cancels[k] || 0) + n)));
  const cancelTotal = sum(Object.values(cancels));
  const priceCancelShare = cancelTotal ? ((cancels['شرا من بلاصة أخرى'] || 0) + (cancels['السعر'] || 0)) / cancelTotal : 0;
  const ageDays = prod.launchDate ? daysBetween(prod.launchDate, today) : 0;

  const signals = degradationSignals({ daily, confPrev: rPrev.conf, confRecent: r7.conf, priceCancelShare, ageDays, driftDays, coverDays: deliveredPerDay > 0 ? coverDays : 0 }, policy);
  const velPrev = mean(daily.slice(-28, -7).map((d) => d.delivered || 0));
  const velNow = mean(daily.slice(-7).map((d) => d.delivered || 0));
  let destockSignal = null;
  const sold = ['VALIDE', 'SCALE', 'HARVEST', 'DESTOCK'].includes(stage);
  if (!sold) destockSignal = null;
  else if (coverDays > policy.coverLimitDays) destockSignal = `الستوك يعمّر ${Math.round(coverDays)} يوم (> ${policy.coverLimitDays})`;
  else if (velPrev > 0 && velNow < velPrev * policy.velocityDropRatio && available > 0) destockSignal = `السرعة طاحت (${velNow.toFixed(1)} قدّام ${velPrev.toFixed(1)} في النهار)`;
  else if (signals.some((s) => s.code === 'creative') && ['HARVEST', 'DESTOCK'].includes(stage) && coverDays > policy.coverLimitDays / 2) destockSignal = 'الكرياتيف مات والستوك مازال';

  // البوابة
  const cashBack = sum(daily.map((d) => d.collected || 0));
  const plan = isNum(prod.target) && isNum(prod.periodDays)
    ? planDaily(econInput, { target: prod.target, days: prod.periodDays, history: daily.map((d) => ({ leads: d.leads, cpl: d.leads ? d.spend / d.leads : null })) }, policy)
    : null;
  const cap = plan?.plannable
    ? capitalNeeded(econInput, { leadsPerDay: plan.leadsPerDay, days: prod.periodDays, deliveryDays: business.deliveryDays, payoutDays: business.payoutDays, prepDays: prod.prepDays || 0 }, policy)
    : null;
  const blockers = [];
  if (!business.teamReady) blockers.push('الفريق');
  // الكاش اللي رجع يغطي الأدس + الإنتاج لدورة كاملة (بوتيرة الخطة)
  const nCycle = plan?.plannable ? plan.leadsPerDay : mean(daily.slice(-7).map((d) => d.leads));
  const cycleCost = nCycle * (cases.mid.lead + cases.mid.conf * prod.buy * (1 + (prod.surplus || 0))) * cycleDays;
  if (cashBack < cycleCost) blockers.push(`الكاش اللي رجع (${money(cashBack)}) ما يغطّيش دورة (${money(cycleCost)})`);
  if (variants.some((v) => v.status === 'اطلب اليوم')) blockers.push('ستوك');
  const gate = { open: blockers.length === 0, blockers };
  const npd = daily.slice(-14).filter((d) => d.delivered > 0).map((d) => ((d.collected || 0) - d.spend - (d.cogsDelivered || 0) - (d.returns || 0)) / d.delivered);
  const cv = npd.length > 3 && mean(npd) > 0 ? Math.sqrt(mean(npd.map((x) => (x - mean(npd)) ** 2))) / mean(npd) : Infinity;

  const mc = plan?.plannable ? monteCarlo(econInput, { leadsPerDay: plan.leadsPerDay, days: prod.periodDays, target: prod.target, seed: hashSeed(prod.id) }, policy) : null;
  // مجال ثقة 90% على صافي الليد (من نفس الـ 300 سيناريو)
  const ci = monteCarlo(econInput, { leadsPerDay: 1, days: 1, seed: hashSeed(prod.id) + 1 }, policy);
  const interval90 = { low: ci.commitment, high: ci.best10 };
  const confUpper = cases.best.conf;
  const confAtPlanProfitable = unitEconomics({ ...econInput, conf: prod.planConf }, policy).netPerLead > 0;
  const capReached = isNum(prod.cap) && !!curve.points.length && -curve.points.at(-1).withCarrier >= prod.cap;

  const classification = classifyStage({
    stage, cases, newAngle: prod.newAngle, destockSignal, confAtPlanProfitable, capReached, confUpper,
    planConf: prod.planConf, learningEvents: prod.learningEvents || 0, gate, stable: cv <= policy.harvestMaxCv,
  }, policy);

  const firstContactMin = mean(daily.slice(-7).map((d) => d.firstContactMin).filter(isNum));
  const root = rootCause({ firstContactMin: daily.length ? firstContactMin : null, confNow: r7.conf, confPlan: prod.planConf, p: econInput, ecoNow: cases.mid }, policy);

  const totals = {
    collected: cashBack,
    ads: spendTotal,
    cogsDelivered: sum(daily.map((d) => d.cogsDelivered || 0)),
    returns: sum(daily.map((d) => d.returns || 0)),
    commission: sum(daily.map((d) => d.commission || 0)),
    packing: sum(daily.map((d) => d.packing || 0)),
  };
  const cashProfit = productCashProfit(totals);
  const pending = sum((prod.pendingCollection || []).map((c) => c.amount));
  const stockAtCost = available * prod.buy;

  const out = {
    ...base, unresolved: false, input: econInput, sources, cases, plan, capital: cap, monteCarlo: mc,
    interval90, curve, stopNoLead, trailingStop, signals, variants, available, coverDays, velocity, reorderPoint,
    gate, classification, rootCause: root, driftDays, ageDays, firstContactMin: daily.length ? firstContactMin : null,
    r7, r30, cancels, priceCancelShare,
    profit: { cash: cashProfit, pending, stockAtCost, paper: cashProfit + pending + stockAtCost, slowStock: sum(variants.filter((v) => v.coverDays > policy.coverLimitDays).map((v) => v.available)) * prod.buy },
    perDay: { leads: mean(daily.slice(-7).map((d) => d.leads)), abandoned: mean(daily.slice(-7).map((d) => d.abandoned || 0)), returned: mean(daily.slice(-7).map((d) => d.returned || 0)), cancelled: mean(daily.slice(-7).map((d) => sum(Object.values(d.cancelReasons || {})))) },
    tagHistory: prod.tagHistory || [],
    learningEvents: prod.learningEvents || 0,
    cap: prod.cap,
    noContactOver: prod.ordersNoContactHours || [],
  };
  out.levers = productLevers(out, prod, business, policy);
  out.alerts = productAlerts(out, prod, business, policy);
  out.verdict = verdictOf(out);
  return out;
}

function hashSeed(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function verdictOf(p) {
  if (p.alerts.some((a) => a.level === 'stop')) return 'وقّف';
  if (p.rootCause.cause === 'الفريق') return 'صلّح';
  const s = p.classification.stage;
  if (s === 'DESTOCK') return 'صفّي';
  if (p.trailingStop || p.curve.zone === 'red') return 'نقّص';
  if (s === 'FIX') return 'صلّح';
  if (s === 'SCALE' && p.gate.open) return 'كبّر';
  if (s.startsWith('ECHEC')) return 'وقّف';
  return 'كمّل';
}

// ─────────────────────────────── 9) الروافع ───────────────────────────────
const tassya = (txt) => `يا Tassya، ${txt}`;

export function productLevers(p, prod, business, policy = DEFAULT_POLICY) {
  const L = [];
  const mid = p.cases.mid;
  const best = p.cases.best;
  const perConfirmedNoAds = mid.ceiling; // ربح المؤكّدة بلا أدس
  const leads = p.perDay.leads;
  const add = (o) => L.push({ product: p.name, productId: p.id, scope: 'منتج', ...o });

  if (isNum(business.abandonRecoveryRate) && p.perDay.abandoned > 0) {
    add({
      code: 'abandoned', title: 'المتروكة', dzdPerDay: p.perDay.abandoned * business.abandonRecoveryRate * perConfirmedNoAds,
      why: `${p.perDay.abandoned.toFixed(1)} متروكة/نهار × ${pctTxt(business.abandonRecoveryRate)} رجوع × ${money(perConfirmedNoAds)}`,
      source: '⟵ الطلبيات (حالة متروكة)', section: 'التأكيد',
      steps: ['افتح المتروكة تاع اليوم', 'عيّط في أول ساعة', 'سجّل النتيجة في تعليق'],
      say: tassya(`عطيني قائمة المتروكة تاع اليوم في ${p.name} باش نعيّطولهم.`),
    });
  }
  if (isNum(p.firstContactMin) && p.firstContactMin > policy.firstContactLeverMin) {
    const pts = best.conf - mid.conf;
    add({
      code: 'speed', title: 'سرعة التأكيد', dzdPerDay: pts * leads * perConfirmedNoAds,
      why: `أول اتصال ${Math.round(p.firstContactMin)} دقيقة — +${Math.round(pts * 100)} نقاط × ${leads.toFixed(1)} ليد × ${money(perConfirmedNoAds)}`,
      source: '⟵ webhooks (وقت أول تغيير في الحالة)', section: 'التأكيد',
      steps: [`أول اتصال تحت ${policy.firstContactLeverMin} دقيقة`, 'تنبيه للمؤكّد مع كل طلبية جديدة', 'راجع الوقت كل نهار'],
      say: tassya(`ذكّر المؤكّدين يعيّطو لكل طلبية جديدة في ${p.name} قبل ${policy.firstContactLeverMin} دقيقة.`),
    });
  }
  const topCancel = Object.entries(p.cancels).sort((a, b) => b[1] - a[1])[0];
  if (topCancel) {
    const perDay = topCancel[1] / 14;
    add({
      code: 'cancel', title: `سبب الإلغاء: ${topCancel[0]}`, dzdPerDay: perDay * perConfirmedNoAds,
      why: `${perDay.toFixed(1)} إلغاء/نهار بهذا السبب × ${money(perConfirmedNoAds)}`,
      source: '⟵ cancellation.reasonLabel', section: 'التأكيد',
      steps: ['اقرا 5 طلبيات بهذا السبب', 'حضّر جواب للمؤكّد', 'قيس الفرق في 7 أيام'],
      say: tassya(`ورّيني الطلبيات الملغية في ${p.name} بسبب «${topCancel[0]}» هذي الجمعة.`),
    });
  }
  const dPts = best.del - mid.del;
  add({
    code: 'delivery', title: 'التوصيل', dzdPerDay: dPts * leads * mid.conf * (mid.ppo + prod.retCost),
    why: `+${Math.round(dPts * 100)} نقاط × ${leads.toFixed(1)} ليد × ${pctTxt(mid.conf)} × (${Math.round(mid.ppo)} + ${prod.retCost}) دج`,
    source: '⟵ delivery.carrierStatus', section: 'التوصيل',
    steps: ['تابع الطرود اللي ما تستلمتش في 48 ساعة', 'عيّط للزبون قبل الخرجة', 'قارن الولايات'],
    say: tassya(`عطيني الطرود تاع ${p.name} اللي فاتو 48 ساعة بلا تسليم.`),
  });
  if (isNum(business.resellRate) && p.perDay.returned > 0) {
    add({
      code: 'returns', title: 'الروتور', dzdPerDay: p.perDay.returned * business.resellRate * (mid.ppo - prod.delCost),
      why: `${p.perDay.returned.toFixed(1)} راجع/نهار × ${pctTxt(business.resellRate)} بيع من جديد × ${money(mid.ppo - prod.delCost)}`,
      source: '⟵ تعليق التطبيق على الطلبية (#R-01…10)', section: 'الروتور',
      steps: ['سجّل سبب كل راجع (#R)', 'رجّع القطعة للمخزن نفس النهار', 'عاود اعرضها للمتروكة'],
      say: tassya(`سجّل سبب الرجوع لكل طلبية راجعة في ${p.name}.`),
    });
  }
  if (prod.offerHigherPrice) {
    const e2 = unitEconomics({ ...p.input, sell: prod.offerHigherPrice.sell, conf: prod.offerHigherPrice.conf ?? p.input.conf }, policy);
    add({
      code: 'offer-price', title: `العرض: سعر ${prod.offerHigherPrice.sell} دج`, dzdPerDay: (e2.netPerLead - mid.netPerLead) * leads,
      why: `أغلى ليد ${Math.round(mid.maxLead)} ← ${money(e2.maxLead)}`, source: '⟵ المحرّك (العروض)', section: 'العرض',
      steps: ['جرّب السعر على مجموعة إعلانات وحدة', 'راقب التأكيد 7 أيام', 'قرّر بالأرقام'],
      say: tassya(`حضّرلي عرض ${p.name} بسعر ${prod.offerHigherPrice.sell} دج للتجربة.`), needsApproval: true,
    });
  }
  return L.filter((l) => isNum(l.dzdPerDay) && l.dzdPerDay > 0).sort((a, b) => b.dzdPerDay - a.dzdPerDay);
}

// ─────────────────────────────── 10) التحذيرات ───────────────────────────────
export const LEVELS = ['stop', 'danger', 'decline', 'locked', 'data'];
export const LEVEL_LABEL = { stop: '🛑 وقف', danger: '🔴 خطر', decline: '🟡 تدهور', locked: '🧊 محبوس', data: '⚙️ بيانات' };

export function productAlerts(p, prod, business, policy = DEFAULT_POLICY) {
  const A = [];
  const add = (level, text, extra = {}) => A.push({ level, text, product: p.name, productId: p.id, ...extra });
  if (p.curve.stopTouched) add('stop', `لمس خط الستوب (${money(p.cap)} خسارة)`, { action: 'توقيف العرض', needsApproval: true });
  if (p.stopNoLead) add('stop', 'ستوب بلا ليد: الصرف وصل 3 مرات أغلى ليد بلا حتى ليد', { action: 'توقيف العرض', needsApproval: true });
  if (p.curve.zone === 'red') {
    if (p.rootCause.cause === 'الفريق') add('danger', `المنحنى تحت الأسوأ — السبب الفريق: ${p.rootCause.why.join('، ')}`, { action: 'صلّح الفريق قبل التوقيف' });
    else add('danger', 'المنحنى تحت الأسوأ', { action: 'نقّص الميزانية', needsApproval: true });
  }
  const scaling = prod.adTrend === 'up' || p.stage === 'SCALE';
  p.variants.forEach((v) => {
    if (v.status === 'اطلب اليوم' && scaling) add('danger', `${v.label}: تحت نقطة الطلب (${v.available} ≤ ${Math.round(v.reorderPoint)}) ومازال الإعلان يكبر`, { action: 'وقّف التكبير ولا حوّلو طلب مسبق', needsApproval: true });
    else if (v.status === 'اطلب اليوم') add('decline', `${v.label}: اطلب اليوم ${v.suggested} قطعة، عربون ${money(v.suggested * prod.buy * (business.depositRate ?? 0))}`, { action: 'أمر إنتاج', needsApproval: true });
    if (v.status === 'محبوس') add('locked', `${v.label}: ربح محبوس ${money(v.available * prod.buy)} (${Math.round(v.coverDays)} يوم تغطية) — عرض تصفية`, { action: 'تصفية', needsApproval: true, noReorder: true });
  });
  if ((p.noContactOver || []).some((h) => h > policy.noContactAlertHours)) add('danger', `طلبيات بلا اتصال فوق ${policy.noContactAlertHours} ساعات`);
  p.signals.filter((s) => s.code !== 'locked').forEach((s) => add('decline', `${s.icon} ${s.label}: ${s.detail}`));
  if (p.curve.zone === 'yellow') {
    const y = p.curve.points.slice(-3).every((x) => x.zone !== 'green');
    if (y) add('decline', 'بين الوسط والأسوأ 3 أيام');
  }
  if (p.trailingStop) add('danger', 'الستوب المتحرّك: الليد على 3 أيام فات أغلى ليد بالتوصيل الأسوأ ← نقّص', { action: 'نقّص الميزانية', needsApproval: true });
  return A;
}

// ─────────────────────────────── التحليل الكامل (عقل واحد) ───────────────────────────────
export function analyzeBusiness(data, today) {
  const business = data.business;
  const policy = policyOf(business);
  const products = data.products.map((p) => analyzeProduct(p, business, today, policy));
  const ok = products.filter((p) => !p.unresolved);

  const trust = dataTrust({
    buyPrices: data.products.every((p) => isNum(p.buy) && p.buy > 0),
    returnsProcessed: !(business.unprocessedReturns > 0),
    withdrawalsLogged: business.lastWithdrawalLogged ? daysBetween(business.lastWithdrawalLogged, today) <= policy.carrierStaleDays : false,
    adsLinked: !!business.adsLinked,
    usdFresh: isNum(business.usdRate) && business.usdRateUpdatedAt ? daysBetween(business.usdRateUpdatedAt, today) <= 30 : false,
  }, policy);

  const stockRows = ok.flatMap((p) => p.variants.map((v) => ({ ...v, product: p.name, productId: p.id, buy: p.input.buy })));
  const split = splitProfit({ wallets: business.wallets, carrier: business.carrierReceivable, stock: stockRows }, today, policy);
  const splitYesterday = business.splitYesterday || null;

  const commitmentDaily = sum(ok.map((p) => p.monteCarlo?.commitmentDaily || 0));
  const equity = equityCurve(business.equityHistory || [], { reserve: business.reserve, commitmentDaily });

  // التحذيرات على مستوى البيزنس
  const alerts = ok.flatMap((p) => p.alerts);
  if (split.cash < business.reserve) alerts.push({ level: 'stop', text: `الكاش (${money(split.cash)}) تحت الاحتياط (${money(business.reserve)})`, product: null });
  if (split.staleCarrier > 0) alerts.push({ level: 'locked', text: `قبض عند شركة التوصيل فايت ${policy.carrierStaleDays} أيام: ${money(split.staleCarrier)}`, product: null, action: 'سجّل السحب' });
  data.products.filter((p) => !(p.buy > 0)).forEach((p) => alerts.push({ level: 'data', text: `ثمن شراء 0: ${p.name}`, product: p.name }));
  if (business.unprocessedReturns > 0) alerts.push({ level: 'data', text: `${business.unprocessedReturns} رواجع ما تعالجتش`, product: null });
  if (!trust.items.find((i) => i.key === 'withdrawalsLogged').ok) alerts.push({ level: 'data', text: 'سحب ما تسجّلش', product: null });
  if (!business.adsLinked) alerts.push({ level: 'data', text: 'الإعلانات برا محفظة ADS', product: null });
  alerts.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));

  // الروافع على مستوى البيزنس
  const levers = ok.flatMap((p) => p.levers);
  if (isNum(business.payoutDays) && business.payoutDays > policy.fasterPayoutDays) {
    const planned = ok.filter((p) => p.plan?.plannable && p.capital);
    const raw = (id) => data.products.find((x) => x.id === id);
    const capNow = sum(planned.map((p) => p.capital.capital));
    const capFast = sum(planned.map((p) => capitalNeeded(p.input, { leadsPerDay: p.plan.leadsPerDay, days: raw(p.id).periodDays, deliveryDays: business.deliveryDays, payoutDays: policy.fasterPayoutDays, prepDays: raw(p.id).prepDays || 0 }, policy).capital));
    // الأثر في النهار = رأس المال اللي يتحرّر × مردود الدينار في النهار (من نفس الخطط)
    const dailyProfit = sum(planned.map((p) => p.plan.achievable / raw(p.id).periodDays));
    const dailyReturn = capNow > 0 ? dailyProfit / capNow : 0;
    if (capNow > capFast) {
      levers.push({
        scope: 'بيزنس', code: 'payout', title: 'السحب أسرع', dzdPerDay: (capNow - capFast) * dailyReturn,
        capitalFreed: capNow - capFast,
        why: `رأس المال اللازم ${money(capNow)} بسحب ${business.payoutDays} يوم قدّام ${money(capFast)} بسحب ${policy.fasterPayoutDays} أيام`,
        source: '⟵ كتبتو أنت + تسيير', section: 'المالية',
        steps: [`اطلب من شركة التوصيل سحب كل ${policy.fasterPayoutDays} أيام`, 'سجّل كل سحب في تسيير', 'راقب القبض المعطّل'],
        say: tassya(`حضّرلي رسالة لشركة التوصيل نطلبو فيها السحب كل ${policy.fasterPayoutDays} أيام.`),
      });
    }
  }
  levers.sort((a, b) => b.dzdPerDay - a.dzdPerDay);
  const leversTotal = sum(levers.map((l) => l.dzdPerDay));

  // المشكل الأول: أخطر تحذير، وبعدو الأقرب لخط التوقف.
  const closest = ok
    .filter((p) => isNum(p.cap) && p.cap > 0)
    .map((p) => ({ p, dist: (p.curve.points.at(-1)?.real ?? 0) + p.cap }))
    .sort((a, b) => a.dist - b.dist)[0];
  const firstProblem = alerts[0]
    ? { text: alerts[0].text, product: alerts[0].product, todo: alerts[0].action || 'شوف التفاصيل', level: alerts[0].level }
    : closest
      ? { text: `${closest.p.name} الأقرب لخط الستوب (باقي ${money(closest.dist)})`, product: closest.p.name, todo: 'راقب الليد اليوم', level: 'decline' }
      : null;

  // 3 حوايج اليوم مرتّبين بالدينار
  const today3 = levers.slice(0, 3).map((l) => ({ text: `${l.title}${l.product ? ' — ' + l.product : ''}`, dzdPerDay: l.dzdPerDay, who: l.needsApproval ? 'أنت (بموافقة)' : l.section === 'التأكيد' ? 'المؤكّد' : 'أنت', say: l.say }));

  const byStage = {};
  for (const p of products) {
    const s = p.stage || 'بلا تاغ';
    (byStage[s] ||= []).push(p);
  }
  for (const s of Object.keys(byStage)) {
    byStage[s].sort((a, b) => riskRank(b) - riskRank(a)); // الأقرب للخطر أولاً
  }

  const curvePos = ok.reduce((s, p) => s + ((p.curve.points.at(-1)?.real ?? 0) - (p.curve.points.at(-1)?.mid ?? 0)), 0);

  return {
    today, business: { name: business.name, usdRate: business.usdRate, reserve: business.reserve, payoutDays: business.payoutDays },
    policy, trust, split, splitYesterday, equity, alerts, levers, leversTotal, firstProblem, today3, products, byStage,
    source: sourceSuccess(data.products, policy), curvePos,
  };
}

function riskRank(p) {
  if (p.unresolved) return 100;
  const lv = { stop: 50, danger: 40, decline: 20, locked: 10, data: 5 };
  const a = Math.max(0, ...p.alerts.map((x) => lv[x.level] || 0));
  const z = { red: 3, yellow: 2, green: 0 }[p.curve.zone] || 0;
  return a + z;
}

// ─────────────────────────────── 11) التقرير ───────────────────────────────
export function nextRunAt(nowMs, hourLocal, offsetHours) {
  const local = new Date(nowMs + offsetHours * 3600000);
  const target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hourLocal) - offsetHours * 3600000;
  return target > nowMs ? target : target + 86400000;
}
