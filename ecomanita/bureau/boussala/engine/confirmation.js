/*!
 * بوصلة التاجر — التأكيد السريع: الدوران بين المؤكّدين + التصعيد للمناجر
 * al-KHALiYA © 2026
 * القاعدة (قابلة للتعديل):
 *   طلبية جديدة → المؤكّد يوصلو إشعار، وإشعار ثاني في نص الدورة
 *   → إذا ما دار حتى حركة في 30 دقيقة (وقت الخدمة) → تروح للمؤكّد الثاني
 *   → تدور هكا 5 دورات → تروح للمناجر AI اللي ينبّه التاجر.
 * في تسيير: Team ← Order distribution ← «When is an order taken back?» (الدقائق + عدد المرات) — ومن بعد «flagged for a manager».
 * هذا الملف يقرا الطلبيات (list_orders) ويقيس: شكون فات الوقت، شكون لازم يتصعّد، وشحال يطوّل أول اتصال.
 */
'use strict';
const minMs = 6e4;
const fmt = n => Math.round(n).toLocaleString('en-US');

const RULE = { roundMinutes: 30, reminders: 2, rounds: 5, workStart: 9, workEnd: 21, tzOffsetH: 1 };

// دقائق الخدمة بين وقتين (ما نحسبوش الليل)
function workMinutes(a, b, R) {
  let t = new Date(a).getTime(); const end = new Date(b).getTime(); let m = 0;
  if (!(end > t)) return 0;
  while (t < end) {
    const h = new Date(t + R.tzOffsetH * 36e5).getUTCHours();
    const step = Math.min(end - t, 15 * minMs);
    if (h >= R.workStart && h < R.workEnd) m += step / minMs;
    t += step;
  }
  return m;
}

const isOpen = o => /pending|^APPEL|JOUR/i.test(o.status || '') || (o.status === 'pending');
const firstAction = o => { const H = (o.statusHistory || []).slice().sort((x, y) => new Date(x.date) - new Date(y.date)); const k = H.findIndex(h => h.status !== 'pending'); return k >= 0 ? H[k].date : null; };

/**
 * watch({ orders, now, rule })  orders = مخرجات list_orders (data) كما هي
 */
function watch(o) {
  const R = { ...RULE, ...(o.rule || {}) };
  const now = o.now || new Date().toISOString();
  const O = o.orders || [];
  const limit = R.roundMinutes * R.rounds;
  const open = O.filter(x => (x.status || '') === 'pending' && !(x.statusHistory || []).some(h => h.status !== 'pending'));
  const rows = open.map(x => { const m = workMinutes(x.createdAt, now, R); return { id: x.orderNumber || x.id, assignee: x.assignee && x.assignee.name, minutes: Math.round(m), round: Math.min(R.rounds + 1, Math.floor(m / R.roundMinutes) + 1) }; });
  const escalate = rows.filter(r => r.minutes >= limit).sort((a, b) => b.minutes - a.minutes);
  const rotating = rows.filter(r => r.minutes >= R.roundMinutes && r.minutes < limit);
  const unassigned = O.filter(x => (x.status || '') === 'pending' && !x.assignee).length;
  // ⏱️ أول حركة: شحال يطوّل المؤكّد قبل ما يدير حاجة (على الطلبيات اللي تحرّكت)
  const touched = O.map(x => { const f = firstAction(x); return f ? workMinutes(x.createdAt, f, R) : null; }).filter(x => x != null).sort((a, b) => a - b);
  const med = touched.length ? touched[Math.floor(touched.length / 2)] : null;
  const within = touched.length ? Math.round(touched.filter(m => m <= R.roundMinutes).length / touched.length * 100) : null;
  // 🔍 الإلغاء بلا سبب
  const canceled = O.filter(x => x.status === 'canceled'), noReason = canceled.filter(x => !x.cancelReason).length;

  const actions = [];
  if (escalate.length) actions.push({ lvl: 'stop', code: 'confirm_escalate', msg: `🚨 ${escalate.length} طلبية دارت ${R.rounds} دورات (${limit} دقيقة خدمة) وحتى مؤكّد ما عيّطلها — عيّط نتا دركا، وشوف شكون ما راهش يخدم.`, list: escalate.slice(0, 20).map(r => r.id) });
  if (rotating.length) actions.push({ lvl: 'warn', code: 'confirm_rotating', msg: `🔁 ${rotating.length} طلبية فاتت ${R.roundMinutes} دقيقة بلا اتصال وراهي تدور بين المؤكّدين.` });
  if (unassigned) actions.push({ lvl: 'warn', code: 'confirm_unassigned', msg: `👤 ${unassigned} طلبية جديدة ما عندها حتى مؤكّد — شوف التوزيع (Team ← Order distribution).` });
  if (med != null && med > R.roundMinutes) actions.push({ lvl: 'warn', code: 'confirm_slow', msg: `⏱️ أول اتصال يطوّل ~${Math.round(med)} دقيقة (${within}% برك في أقل من ${R.roundMinutes} دقيقة). الزبون يبرد: الهدف أقل من 15 دقيقة.` });
  if (canceled.length >= 10 && noReason / canceled.length > 0.3) actions.push({ lvl: 'ask', code: 'cancel_no_reason', msg: `❓ ${Math.round(noReason / canceled.length * 100)}% من الإلغاءات بلا سبب (${noReason}/${canceled.length}) — ما نقدروش نعرفو علاش التأكيد طايح. شعّل «سبب الإلغاء إجباري».` });
  return { rule: R, kpi: { open: rows.length, rotating: rotating.length, escalate: escalate.length, firstCallMedianMin: med != null ? Math.round(med) : null, firstCallWithinRoundPct: within, canceled: canceled.length, canceledNoReason: noReason },
    escalate, actions, text: toText(R, rows, escalate, med, within, actions),
    setup: [
      `Team ← Order distribution ← «How are new orders shared out?» = Evenly`,
      `Team ← Order distribution ← «When is an order taken back?»: ${R.roundMinutes} دقيقة، ${R.rounds - 1} مرات → من بعد «flagged for a manager»`,
      `الطلبيات اللي تتعلّم «flagged for a manager» ← المناجر AI يقراها كل 15 دقيقة وينبّه التاجر`,
      `الإشعارات للمؤكّد (${R.reminders} في الدورة): نطلبوها من فريق تسيير لو ماكانتش`,
    ] };
}

function toText(R, rows, esc, med, within, A) {
  const L = [`📞 التأكيد — دورة ${R.roundMinutes} دقيقة × ${R.rounds} ثم المناجر`];
  L.push(`  مفتوحة بلا اتصال: ${rows.length} • تدور: ${rows.filter(r => r.minutes >= R.roundMinutes && r.minutes < R.roundMinutes * R.rounds).length} • للمناجر: ${esc.length}`);
  if (med != null) L.push(`  أول اتصال: ~${Math.round(med)} دقيقة (الوسط) • ${within}% في أقل من ${R.roundMinutes} دقيقة`);
  A.forEach(a => L.push('  ' + a.msg));
  return L.join('\n');
}

const api = { watch, RULE, workMinutes };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.BoussalaConfirmation = api;
