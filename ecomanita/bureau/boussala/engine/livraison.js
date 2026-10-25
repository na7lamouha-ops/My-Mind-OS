/*!
 * بوصلة التاجر — وكيل متابعة التوصيل
 * al-KHALiYA © 2026
 * يقرا الطرود (من تسيير: list_order_tracking + list_returns) ويطلّع: وقتاش خرجت، وقتاش تليفرات، الروتور،
 * الطرود الحابسة، «ما يجاوبش» قبل ما ترجع، الكاش الموصل وماشي مخلّص، والولايات اللي تخسّر.
 */
'use strict';
const dayMs = 864e5;
const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const p90 = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))]; };
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
const pl = (n, one, many) => (n >= 3 && n <= 10) ? `${n} ${many}` : `${n} ${one}`;
const fm = n => Math.round(n).toLocaleString('en-US');

// 📍 المرحلة من كود شركة التوصيل (Ecotrack وأمثالو)
function stageOf(ds, ts, fin) {
  const t = `${ds || ''} ${ts || ''}`;
  if (fin && fin !== 'transit') return fin;
  if (/en_livraison|out for delivery|sortie/i.test(t)) return 'out';
  if (/vers_wilaya|en_hub|hub|centre|wilaya|arriv|stop.?desk|bureau|en_attente_du_client|to desk/i.test(t)) return 'wilaya';
  return 'road';
}

// 📟 تنبيه شركة التوصيل (ملاحظة الليفرور/المحطة) → واش يدير المتتبّع
const ALERTS = [
  { type: 'no_answer', re: /ne r[ée]pond|لا يردّ|ما جاوب|sans r[ée]ponse/i, todo: 'عيّط للزبون دركا + واتساب: «الليفرور حاول يعيّطلك، وقتاش يناسبك؟» ومن بعد بلّغ شركة التوصيل بالوقت.' },
  { type: 'unreachable', re: /injoignable|خارج مجال|hors/i, todo: 'جرّب الرقم الثاني لو كاين، واتساب، وعاود العيطة بعد ساعتين. ما تخلّيهش يولّي روتور بلا ما تحاول 3 مرات.' },
  { type: 'busy', re: /occup|مشغول/i, todo: 'عاود بعد 30 دقيقة.' },
  { type: 'postponed', re: /report|أجّل|أجل/i, todo: 'ثبّت النهار الجديد مع الزبون وسجّلو، واتصل نهار قبل.' },
  { type: 'wrong_number', re: /رقم غالط|faux num|num[ée]ro erron/i, todo: 'شوف الطلبية: رقم ثاني؟ رسالة في ميسنجر/إنستغرام للحساب اللي طلب.' },
  { type: 'refused', re: /refus|رفض/i, todo: 'عيّط واعرف السبب (مقاس؟ سعر؟) — اقترح تبديل المقاس بلاصة الروتور، وسجّل الكود #R-… في التعليق.' },
];
const alertOf = txt => ALERTS.find(a => a.re.test(txt || '')) || null;

// تحويل سطر تسيير (list_order_tracking) لشكل موحّد
function fromTassyir(row) {
  const notes = (row.notesHistory || []).map(n => (n.note && n.note.message) || '').filter(Boolean);
  const st = row.trackingStatus || row.status || '';
  const fin = /delivered|livr/i.test(st) || row.delivered ? 'delivered' : (/returned|retourn[ée]|retour_recu|retour reçu/i.test(st) ? 'returned' : (/retour|return/i.test(st) ? 'returning' : 'transit'));
  return {
    id: row.orderNumber || row.id, total: +row.total || 0, wilaya: row.orderClient && row.orderClient.provinceName,
    product: row.orderItems && row.orderItems[0] && row.orderItems[0].name, createdAt: row.createdAt, dispatchedAt: row.dispatchedAt,
    finalAt: fin !== 'transit' ? row.lastStatusAt : null, status: fin, deliveryStatus: row.deliveryStatus,
    paid: row.carrierPayout ? row.carrierPayout.state !== 'awaiting' : null,
    unreachable: notes.filter(t => /injoignable|ما يجاوب|sans réponse|خارج مجال/i.test(t)).length, phone: row.orderClient && row.orderClient.phone,
    client: row.orderClient && row.orderClient.name, stage: stageOf(row.deliveryStatus, row.trackingStatus, fin),
    lastNote: (() => { const N = (row.notesHistory || []).map(n => n.note || {}).filter(n => n.message).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0]; return N ? { text: N.message, at: N.timestamp, by: N.noteSource } : null; })(),
  };
}

/**
 * track({ parcels:[{id,total,wilaya,product,createdAt,dispatchedAt,finalAt,status:'delivered'|'returned'|'transit',paid,unreachable}], today, stuckDays (5), sell?, retCost? })
 */
function track(o) {
  const today = new Date(o.today || Date.now());
  const P = (o.parcels || []).map(x => x.notesHistory ? fromTassyir(x) : x);
  const d = (a, b) => (a && b) ? (new Date(b) - new Date(a)) / dayMs : null;
  const recent = P.filter(x => x.dispatchedAt && d(x.dispatchedAt, today) <= (o.windowDays || 7));
  const toDispatch = recent.map(x => d(x.createdAt, x.dispatchedAt)).filter(x => x != null && x >= 0);
  const toDeliver = P.filter(x => x.status === 'delivered').map(x => d(x.dispatchedAt, x.finalAt)).filter(x => x != null && x >= 0);
  const toReturn = P.filter(x => x.status === 'returned').map(x => d(x.dispatchedAt, x.finalAt)).filter(x => x != null && x >= 0);
  const del = P.filter(x => x.status === 'delivered').length, ret = P.filter(x => x.status === 'returned').length;
  const transit = P.filter(x => x.status === 'transit');
  const returning = P.filter(x => x.status === 'returning');
  const stuckDays = o.stuckDays || 5;
  const stuck = transit.filter(x => d(x.dispatchedAt, today) > stuckDays).sort((a, b) => new Date(a.dispatchedAt) - new Date(b.dispatchedAt));
  const callNow = transit.filter(x => (x.unreachable || 0) >= 1);
  const unpaid = P.filter(x => x.status === 'delivered' && x.paid === false);
  const unpaidAmt = unpaid.reduce((s, x) => s + x.total, 0);
  const unpaidOld = unpaid.reduce((mx, x) => Math.max(mx, d(x.finalAt, today) || 0), 0);
  const byW = {};
  P.filter(x => x.status !== 'transit').forEach(x => { const w = x.wilaya || '؟'; (byW[w] = byW[w] || { wilaya: w, del: 0, ret: 0 }); byW[w][x.status === 'delivered' ? 'del' : 'ret']++; });
  const W = Object.values(byW).map(w => ({ ...w, n: w.del + w.ret, rate: Math.round(w.del / (w.del + w.ret) * 100) })).sort((a, b) => b.n - a.n);
  const avgRate = del + ret > 0 ? del / (del + ret) * 100 : null;
  const badW = W.filter(w => w.n >= 5 && avgRate != null && w.rate <= avgRate - 15);

  const kpi = { parcels: P.length, delivered: del, returned: ret, inTransit: transit.length, returning: returning.length, deliveryRate: r1(avgRate),
    daysToDispatch: { median: r1(med(toDispatch)), p90: r1(p90(toDispatch)) }, daysToDeliver: { median: r1(med(toDeliver)), p90: r1(p90(toDeliver)) },
    daysToReturn: { median: r1(med(toReturn)) }, unpaid: { count: unpaid.length, amount: unpaidAmt, oldestDays: Math.round(unpaidOld) } };

  const actions = [];
  if (callNow.length) actions.push({ lvl: 'warn', code: 'unreachable', n: callNow.length, msg: `📞 ${pl(callNow.length, 'طرد', 'طرود')} فيه «ما يجاوبش» من شركة التوصيل — المؤكّد يعيّط للزبون اليوم قبل ما يرجع (واتساب + اتصال)، ويعطي لشركة التوصيل وقت جديد.`, list: callNow.slice(0, 20).map(x => x.id) });
  if (stuck.length) actions.push({ lvl: 'warn', code: 'stuck', n: stuck.length, msg: `⏳ ${pl(stuck.length, 'طرد', 'طرود')} في الطريق أكثر من ${stuckDays} أيام — اتصل بشركة التوصيل ولا بالزبون، هاذو يتحولو روتور.`, list: stuck.slice(0, 20).map(x => x.id) });
  if (kpi.daysToDispatch.median != null && kpi.daysToDispatch.median > (o.preorder ? (o.prepDays || 4) + 1 : 1.5)) actions.push({ lvl: 'warn', code: 'slow_dispatch', msg: o.preorder
    ? `🚚 الطلبية تستنى ~${kpi.daysToDispatch.median} يوم (أكثر من وقت الخياطة) — الستوك ما لحقش. قول للزبون التاريخ بالضبط، وطلّب الدفعة الجاية بكري.`
    : `🚚 الطلبية تقعد ~${kpi.daysToDispatch.median} يوم قبل ما تخرج. الهدف: أقل من 24 ساعة بعد التأكيد — الزبون يبرد والتوصيل يطيح.` });
  if (unpaid.length && unpaidOld > 3) actions.push({ lvl: unpaidOld > 7 ? 'stop' : 'warn', code: 'unpaid', msg: `💵 ${pl(unpaid.length, 'طرد موصل', 'طرود موصلة')} وماشي مخلّصة (~${fm(unpaidAmt)} دج)، أقدمهم ${Math.round(unpaidOld)} يوم — اطلب السحب من شركة التوصيل.` });
  if (badW.length) actions.push({ lvl: 'info', code: 'bad_wilayas', msg: `🗺️ ولايات تحت المتوسط بـ 15 نقطة: ${badW.map(w => `${w.wilaya} ${w.rate}%`).join('، ')} — جرّب «ستوب ديسك» فيها، اتصال تأكيد ثاني نهار الإرسال، ولا نقّص الأدس عليها.` });
  if (avgRate != null && avgRate < 45) actions.push({ lvl: 'info', code: 'low_delivery', msg: `📦 التوصيل ${r1(avgRate)}%: كل 5 نقاط زايدين = نقص كبير في رأس المال. الرافعات: اتصال قبل الإرسال، رسالة واتساب فيها رقم التتبّع، إرسال في نفس النهار، متابعة «ما يجاوبش» نفس النهار.` });

  // 🔔 إشعار الزبون ولا تدخّل المتتبّع (حسب اختيار التاجر)
  //   notify = 'wilaya'     → رسالة للزبون كي توصل الطلبية لولايتو (ولا تخرج للتوصيل) فيها رقم المتتبّع
  //   notify = 'alert_only' → ما نبعثو والو للزبون؛ المتتبّع يتدخّل غير كي يجي تنبيه من شركة التوصيل
  const mode = o.notify || 'wilaya', done = new Set(o.notified || []);
  const tpl = o.template || 'السلام عليكم {name}، طلبيتك ({product}) وصلت لولاية {wilaya} وراهي في الطريق ليك. الليفرور يعيّطلك قريب — جاوب من فضلك 🙏 لأي سؤال: {phone}';
  const msgs = mode === 'wilaya' ? transit.filter(x => (x.stage === 'wilaya' || x.stage === 'out') && !done.has(x.id)).map(x => ({ id: x.id, to: x.phone, stage: x.stage,
    text: tpl.replace('{name}', (x.client || '').trim().split(/\s+/)[0] || '').replace('{product}', (x.product || '').split(/\s[–-]\s/)[0].replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()).replace('{wilaya}', x.wilaya || '').replace('{phone}', o.trackerPhone || '{رقم المتتبّع}') })) : [];
  const recentAlert = x => x.lastNote && x.lastNote.at && (today - new Date(x.lastNote.at)) / dayMs <= 2;
  const tasks = transit.filter(x => recentAlert(x)).map(x => ({ x, a: alertOf(x.lastNote.text) })).filter(y => y.a).map(({ x, a }) => ({ id: x.id, type: a.type, note: x.lastNote.text, todo: a.todo }));
  if (msgs.length) actions.push({ lvl: 'info', code: 'notify_customers', msg: `🔔 ${pl(msgs.length, 'زبون', 'زبائن')} طلبيتهم في الولاية — ابعث رسالة «وصلت لولايتك» (فيها رقم المتتبّع). كل زبون يستنى العيطة = توصيل أعلى.` });
  if (tasks.length) actions.push({ lvl: 'warn', code: 'carrier_alerts', msg: `📟 ${pl(tasks.length, 'تنبيه', 'تنبيهات')} من شركة التوصيل في آخر 48 ساعة — المتتبّع يتدخّل اليوم: ` + Object.entries(tasks.reduce((m, t) => (m[t.type] = (m[t.type] || 0) + 1, m), {})).map(([k, n]) => `${{ no_answer: 'ما يجاوبش', unreachable: 'خارج التغطية', busy: 'مشغول', postponed: 'أجّل', wrong_number: 'رقم غالط', refused: 'رفض' }[k]} ${n}`).join('، ') });

  return { kpi, wilayas: W.slice(0, 10), mode, messages: msgs, trackerTasks: tasks, actions, text: toText(kpi, actions) };
}

function toText(k, A) {
  const L = ['🚚 متابعة التوصيل'];
  L.push(`  ${k.parcels} طرد • موصلة ${k.delivered} • راجعة ${k.returned} • في الطريق ${k.inTransit} • التوصيل ${k.deliveryRate ?? '—'}%`);
  L.push(`  تخرج بعد ~${k.daysToDispatch.median ?? '—'} يوم • توصل بعد ~${k.daysToDeliver.median ?? '—'} يوم (90% في ${k.daysToDeliver.p90 ?? '—'}) • الروتور يرجع بعد ~${k.daysToReturn.median ?? '—'} يوم`);
  if (k.unpaid.count) L.push(`  موصلة وماشي مخلّصة: ${k.unpaid.count} (~${fm(k.unpaid.amount)} دج)`);
  A.forEach(a => L.push('  ' + a.msg));
  return L.join('\n');
}

const api = { track, fromTassyir, stageOf, alertOf, ALERTS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BoussalaLivraison = api;
