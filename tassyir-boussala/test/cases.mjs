// اختبارات القبول الـ 12 — كل حالة ترجّع الأرقام اللي خرجت (للتقرير) و pass.
import crypto from 'node:crypto';
import {
  unitEconomics, leadDzd, planDaily, capitalNeeded, availableStock, splitProfit, mergeStageTag,
  stockPlan, rootCause, analyzeBusiness, productAlerts, marketCap, nextRunAt, DEFAULT_POLICY,
} from '../engine/engine.js';
import { buildDailyReport, REPORT_ORDER } from '../engine/report.js';
import { money } from '../engine/format.js';
import { makeDemo } from '../demo/data.js';
import { verifySignature, Deduper, applyOrderEvent } from '../server/webhooks.js';
import { MemoryStore } from '../server/store.js';
import { TassyirClient } from '../server/tassyir.js';

const r0 = (x) => Math.round(x);
const rp = (x) => Math.round(x * 100);
const common = { pack: 50, delCost: 200, retCost: 100 };

export const LINA = { sell: 6800, buy: 2300, ...common, surplus: 0.2, surplusMode: 'workshop', conf: 0.57, del: 0.5, lead: leadDzd(2, 245) };
export const LOSER = { sell: 3900, buy: 2600, ...common, surplus: 0.2, surplusMode: 'workshop', conf: 0.5, del: 0.55, lead: leadDzd(1.8, 245) };

export const CASES = [
  {
    n: 1, name: 'المحرّك: روب لينا',
    run() {
      const e = unitEconomics(LINA);
      const got = { 'صافي الموصلة': r0(e.netPerDelivered), 'أغلى ليد': r0(e.maxLead), 'أقل تأكيد': `${rp(e.minConf)}%`, 'أقل توصيل': `${rp(e.minDel)}%`, 'أقل سعر': r0(e.minPrice) };
      const expected = { 'صافي الموصلة': 2201, 'أغلى ليد': 1117, 'أقل تأكيد': '25%', 'أقل توصيل': '23%', 'أقل سعر': 4599 };
      return { expected, got, pass: JSON.stringify(got) === JSON.stringify(expected) };
    },
  },
  {
    n: 2, name: 'المنتج الخاسر',
    run() {
      const e = unitEconomics(LOSER);
      const plan = planDaily(LOSER, { target: 300000, days: 30, history: [] });
      const got = { 'صافي الموصلة': r0(e.netPerDelivered), 'يتخطّطلو': plan.plannable, 'أقل سعر': r0(e.minPrice) };
      const expected = { 'صافي الموصلة': -895, 'يتخطّطلو': false, 'أقل سعر': 4795 };
      return { expected, got, pass: JSON.stringify(got) === JSON.stringify(expected) };
    },
  },
  {
    n: 3, name: 'السحب 3 ← 14 يوم (ساعة NEXOR)',
    note: 'أرقام NEXOR الأصلية ماشي في البرومبت ← استعملنا أرقام الساعة في البيانات التجريبية: بيع 4,900، شراء 1,500، الليد $1.6 × 245، تأكيد 60%، توصيل 60%، 25 ليد/نهار، توصيل 4 أيام، تحضير 3 أيام.',
    run() {
      const p = { sell: 4900, buy: 1500, ...common, surplus: 0, conf: 0.6, del: 0.6, lead: leadDzd(1.6, 245) };
      const base = { leadsPerDay: 25, days: 30, deliveryDays: 4, prepDays: 3 };
      const c3 = capitalNeeded(p, { ...base, payoutDays: 3 }).capital;
      const c14 = capitalNeeded(p, { ...base, payoutDays: 14 }).capital;
      const ratio = c14 / c3;
      return { expected: { 'رأس المال يطلع': 'أكثر من ×2' }, got: { 'سحب 3 أيام': c3, 'سحب 14 يوم': c14, 'النسبة': `×${ratio.toFixed(2)}` }, pass: c14 > c3 && ratio > 2 };
    },
  },
  {
    n: 4, name: 'الحجم: ما نخطّطوش فوق سقف السوق',
    run() {
      // تاريخ: الليد يغلى مع الحجم
      const history = [10, 15, 20, 25, 30, 35, 40].map((n) => ({ leads: n, cpl: 400 + 6 * n }));
      const e = unitEconomics(LINA);
      const cap = marketCap(history, e.maxLead);
      const plan = planDaily({ ...LINA, lead: 400 + 6 * 25 }, { target: 50_000_000, days: 30, history });
      return { expected: { 'الخطة ≤ سقف السوق': true, 'الهدف الكبير يتعلّم «ما يتوصلش»': true }, got: { 'سقف السوق': cap, 'ليد/نهار في الخطة': plan.leadsPerDay, 'ما يتوصلش': plan.capped }, pass: plan.leadsPerDay <= plan.marketCap && plan.capped === true && cap === plan.marketCap };
    },
  },
  {
    n: 5, name: 'الربح المقسوم: كاش + عند شركة التوصيل + محبوس = على الورق',
    run() {
      const snap = analyzeBusiness(makeDemo('2026-10-26'), '2026-10-26');
      const s = snap.split;
      const per = snap.products.filter((p) => !p.unresolved).map((p) => Math.abs(p.profit.cash + p.profit.pending + p.profit.stockAtCost - p.profit.paper));
      return { expected: { 'الفرق': 0 }, got: { 'كاش': r0(s.cash), 'عند شركة التوصيل': r0(s.atCarrier), 'محبوس': r0(s.locked), 'على الورق': r0(s.paper), 'الفرق': r0(s.cash + s.atCarrier + s.locked - s.paper) }, pass: s.cash + s.atCarrier + s.locked === s.paper && per.every((d) => d < 1e-6) };
    },
  },
  {
    n: 6, name: 'الستوك: Sellable صحيح و totalItems ماشي ستوك',
    note: 'نفس شكل get_inventory في حساب تسيير: totalItems 90، موصّل 71، في الطريق 6، خاسر 1.',
    run() {
      const inv = { totalItems: 90, delivered: 71, inTransit: 6, damaged: 1 };
      const fromParts = availableStock(inv);
      const fromSellable = availableStock({ ...inv, sellable: 11 });
      return { expected: { 'بلا Sellable': 12, 'مع Sellable': 11 }, got: { 'بلا Sellable': fromParts, 'مع Sellable': fromSellable, totalItems: 90 }, pass: fromParts === 12 && fromSellable === 11 && fromParts !== 90 };
    },
  },
  {
    n: 7, name: 'التاغات: الكتابة ما تمسحش القدام',
    async run() {
      let saved = ['TEST', 'SRC-TR', 'PRF-hijab', 'ramadan'];
      const fetchImpl = async (url, opt) => {
        if (opt.method === 'PATCH') saved = JSON.parse(opt.body).tags;
        return { ok: true, status: 200, json: async () => ({ id: 'x', tags: saved }) };
      };
      const c = new TassyirClient({ baseUrl: 'https://api.test', token: 't', fetchImpl });
      const tags = await c.writeStageTag('x', 'VALIDE');
      const pure = mergeStageTag(['SCALE', 'SRC-MA'], 'HARVEST');
      return { expected: ['SRC-TR', 'PRF-hijab', 'ramadan', 'VALIDE'], got: tags, extra: pure, pass: JSON.stringify(tags) === JSON.stringify(['SRC-TR', 'PRF-hijab', 'ramadan', 'VALIDE']) && JSON.stringify(pure) === JSON.stringify(['SRC-MA', 'HARVEST']) };
    },
  },
  {
    n: 8, name: 'التحذير: تحت نقطة الطلب مع التكبير ← 🔴، تغطية فوق الحد ← 🧊 ومنع الطلب',
    run() {
      const v = (sellable, out, del) => ({ label: 'M', inventory: { sellable }, out: Array(7).fill(out), backIn: Array(7).fill(0), delivered: Array(7).fill(del) });
      const low = stockPlan(v(5, 6, 5), { prepDays: 7, transitDays: 2, supplyDays: 14, minOrder: 50, stage: 'SCALE', ageDays: 40 });
      const high = stockPlan(v(300, 1, 1), { prepDays: 7, transitDays: 2, supplyDays: 14, minOrder: 50, stage: 'SCALE', ageDays: 90 });
      const fake = { id: 'p', name: 'منتج', stage: 'SCALE', curve: { stopTouched: false, zone: 'green', points: [] }, stopNoLead: false, trailingStop: false, rootCause: { cause: 'لا شيء', why: [] }, signals: [], noContactOver: [], variants: [{ ...low, label: 'M' }, { ...high, label: 'XL' }] };
      const alerts = productAlerts(fake, { buy: 2000, adTrend: 'up' }, { depositRate: 0.3 }, DEFAULT_POLICY);
      const red = alerts.find((a) => a.level === 'danger');
      const ice = alerts.find((a) => a.level === 'locked');
      return { expected: { 'تحت نقطة الطلب': '🔴', 'فوق الحد': '🧊 + بلا طلب' }, got: { 'تحت نقطة الطلب': red?.text, 'فوق الحد': ice?.text, 'كمية مقترحة للمحبوس': high.suggested }, pass: !!red && !!ice && high.suggested === 0 && !high.canOrder && low.canOrder };
    },
  },
  {
    n: 9, name: 'السبب الجذري: تأكيد طايح + أول اتصال 4 ساعات ← الفريق',
    run() {
      const r = rootCause({ firstContactMin: 240, confNow: 0.41, confPlan: 0.57, p: LINA, ecoNow: unitEconomics({ ...LINA, conf: 0.41 }) });
      return { expected: { 'الحكم': 'الفريق' }, got: { 'الحكم': r.cause, 'الجملة': r.verdict, 'أغلى ليد بتأكيد الهدف': r0(r.maxLeadAtTarget) }, pass: r.cause === 'الفريق' && r.verdict !== 'وقّف الإعلان' };
    },
  },
  {
    n: 10, name: 'التقرير: 08:00، بالترتيب، نفس أرقام الشاشات',
    run() {
      const snap = analyzeBusiness(makeDemo('2026-10-26'), '2026-10-26');
      const rep = buildDailyReport(snap);
      const order = rep.sections.map((s) => s.key);
      // 03:30 UTC = 04:30 في الجزائر ← التقرير الجاي 08:00 الجزائر = 07:00 UTC
      const now = Date.parse('2026-10-26T03:30:00Z');
      const at = new Date(nextRunAt(now, DEFAULT_POLICY.reportHour, DEFAULT_POLICY.timezoneOffsetHours)).toISOString();
      const cashLine = rep.sections.find((s) => s.key === 'split').lines[1];
      // الشاشة تكتب money(snap.split.cash) — التقرير لازم يكتب نفس الشي بالضبط
      const sameNumbers = cashLine.includes(money(snap.split.cash)) && rep.sections[0].lines[2].includes(money(snap.split.spendable));
      return { expected: { 'الترتيب': REPORT_ORDER.join(' › '), 'الوقت': '2026-10-26T07:00:00.000Z (08:00 الجزائر)' }, got: { 'الترتيب': order.join(' › '), 'الوقت': at, 'سطر الكاش': cashLine }, pass: JSON.stringify(order) === JSON.stringify(REPORT_ORDER) && at === '2026-10-26T07:00:00.000Z' && sameNumbers };
    },
  },
  {
    n: 11, name: 'Webhooks: نفس الحدث مرتين ما يتحسبش مرتين',
    async run() {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      const body = JSON.stringify({ topic: 'orders/created', data: { id: 'o1', productId: 'p1' } });
      const id = 'msg_1';
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = `v1a,${crypto.sign(null, Buffer.from(`${id}.${ts}.${body}`), privateKey).toString('base64')}`;
      const ok = verifySignature({ id, timestamp: ts, signature: sig, body }, publicKey).ok;
      const forged = verifySignature({ id, timestamp: ts, signature: sig, body: body.replace('o1', 'o2') }, publicKey).ok;
      const d = new Deduper(new MemoryStore());
      let leads = 0;
      let state = null;
      for (const _ of [1, 2]) {
        if (await d.seen(id)) continue;
        const r = applyOrderEvent(state, 'orders/created', { id: 'o1', productId: 'p1' }, new Date().toISOString());
        state = r.state;
        leads += r.counters.length;
      }
      // حتى بـ webhook-id جديد، نفس الانتقال ما يتعدّش مرتين
      leads += applyOrderEvent(state, 'orders/created', { id: 'o1', productId: 'p1' }, new Date().toISOString()).counters.length;
      return { expected: { 'ليدات': 1, 'توقيع صحيح': true, 'توقيع مزوّر': false }, got: { 'ليدات': leads, 'توقيع صحيح': ok, 'توقيع مزوّر': forged }, pass: leads === 1 && ok && !forged };
    },
  },
];
