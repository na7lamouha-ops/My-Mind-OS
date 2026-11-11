/*!
 * بوصلة التاجر — المرافق خطوة بخطوة (الكوتش)
 * al-KHALiYA © 2026
 * يحوّل خطة الإنقاذ (triage) لخطوات وحدة بوحدة: الشاشة في تسيير، واش تشوف، واش تضغط، واش ما تضغطش،
 * وكيفاش نتأكدو بلي تدارت (نعاودو نقراو الحساب ← ماشي «قالّي درتها»).
 * التاجر هو اللي يضغط. البوصلة تقرا برك.
 */
'use strict';
const m = n => { const x = Math.round(n || 0); return Math.abs(x) >= 10000 ? (x / 10000).toFixed(x % 10000 ? 1 : 0) + ' مليون' : x.toLocaleString('en-US') + ' دج'; };

// 📚 مكتبة الخطوات: كل خطوة مربوطة بشاشة حقيقية في تسيير
const STEPS = [
  { id: 'payout', match: /قبضة ما تسجّلت/, screen: 'Finance ← Report', path: '/finance',
    goal: 'نعرفو الحقيقة على الدراهم اللي عند شركات التوصيل: قبضتهم ولا لا؟',
    why: 'هذا أكبر رقم في الحساب. إذا ما قبضتهمش، راهي دراهمك عندهم. وإذا قبضتهم، تسيير يحسبهم غالط والربح تاعك كامل ماشي حقيقي.',
    look: H => [`مربع «Set up payout tracking»: ${(H.carriers || []).filter(c => c.before).map(c => `${c.name} ${m(c.before)}`).join(' • ') || 'كل شركة والمبلغ «from before»'}`, 'قدام كل شركة زوج أزرار: «I already collected it» و«Record it as collected now»'],
    do: H => ['حلّ الموقع تاع كل شركة توصيل (ولا الكشوفات اللي بعثولك) وشوف «الفيرسمو» اللي خلّصوك بيهم.',
      'إذا قبضت المبلغ «from before» كامل ← اضغط «I already collected it». هذا يقول لتسيير «راهم عندي من قبل» وما يزيد والو للمحفظة.',
      'إذا ما قبضتوش (ولا قبضت جزء برك) ← ما تضغط والو. اكتبلي شحال قبضت من كل شركة، ونطالبو الشركة بالباقي.',
      ...((H.carriers || []).some(c => c.held > (c.before || 0)) ? [`من بعد «from before»، كاين ${m((H.carriers || []).reduce((a, c) => a + Math.max(0, (c.held || 0) - (c.before || 0)), 0))} جديدة (${(H.carriers || []).filter(c => c.held > (c.before || 0)).map(c => c.name).join('، ')}): كل فيرسمو يدخلك ← «Record collection» بالمبلغ والتاريخ تاعو.`] : [])],
    dont: ['«Record it as collected now» غير للدراهم اللي في يدك اليوم وما سجّلتهاش في حتى بلاصة — يزيدها للكاش بتاريخ اليوم. إذا غلطت، الكاش يولّي منفوخ.'],
    send: 'كابتور لمربع «Set up payout tracking» من بعد ما تكمّل، وجدول صغير: الشركة ← شحال قبضت.',
    verify: (a, b) => { const was = (a.carriers || []).reduce((s, c) => s + (c.before || 0), 0), now = (b.carriers || []).reduce((s, c) => s + (c.before || 0), 0);
      return { ok: now < was || (b.collectionsRecorded || 0) > 0, msg: `«from before»: ${m(was)} ← ${m(now)} • قبضات مسجّلة: ${b.collectionsRecorded || 0}` }; } },
  { id: 'returns', match: /رواجع ما تعالجوش/, screen: 'Tracking ← Returns', path: '/tracking/returns',
    goal: 'نرجّعو الستوك حقيقي: كل راجعة يا ترجع للرف، يا Damaged.',
    why: 'الستوك المتاح سالب. بلا هذا ما تقدرش تعرف شحال عندك تبيع، وكل قرار شراء يكون بالعمى.',
    look: H => [`${H.returnsToProcess} راجعة «to process»`, 'زر «Scan returns» (بالسكانر ولا بالرقم)'],
    do: () => ['جمّع الطرود الراجعة في بلاصة وحدة. إذا كاين طرود ماشي عندك (مازالين عند الشركة)، حطّهم على جنب.',
      'افتح «Scan returns» وسكاني كل طرد: صالح ← يرجع للستوك • مخسّر ← Damaged.',
      'اللي ماكانوش عندك فيزيكياً: ما تعالجهمش دركا — هوما «راجعين ما وصلوش»، نطالبو بيهم الشركة.',
      'إذا بزاف: 100 في النهار. ماشي لازم الكل اليوم، بصح لازم تبدا.'],
    dont: ['ما تعالجش راجعة ما شفتهاش بعينك — تسيير يزيدها للستوك وهي ماكانش.'],
    send: 'كابتور لصفحة Returns (الرقم «to process» قبل وبعد).',
    verify: (a, b) => ({ ok: (b.returnsToProcess || 0) < (a.returnsToProcess || 0), msg: `الرواجع: ${a.returnsToProcess} ← ${b.returnsToProcess}` }) },
  { id: 'stale', match: /مفتوحة بلا/, screen: 'Orders ← Pending', path: '/orders?status=pending',
    goal: 'نسكّرو الطلبيات القديمة ونخلّيو التوزيع يخدم وحدو.',
    why: 'طلبيات مفتوحة بلا مؤكّد = زبائن ما تعيّطلهمش. وإذا قدام، يحبسو الأرقام (التأكيد، الستوك المحجوز).',
    look: H => [`${H.unassigned} مفتوحة بلا مؤكّد يخدم${H.openNewestDays ? ` — أحدثهم من ${H.openNewestDays} يوم` : ''}`, 'فوق: زر «Assign Orders»'],
    do: H => [`«Assign Orders» ← حطّهم عند المؤكّد اللي يخدم${H.receiver ? ` (${H.receiver})` : ''}.`,
      H.openNewestDays >= 7 ? 'دورة عيطة وحدة في نهار واحد: اللي جاوب وحب ← تأكيد • اللي ما جاوبش ولا ما حبش ← إلغاء بسبب.' : 'عيّطهم اليوم من الأقدم للأحدث.',
      'Team ← Order distribution ← شعّل «When is an order taken back?» (30 دقيقة) باش ما تتعاودش.'],
    dont: ['ما تلغيش بالجملة بلا عيطة — كاين منهم اللي مازال يحب.', 'الدوران بين المؤكّدين يخدم غير إذا كاين 2 «Receiving» على الأقل.'],
    send: 'كابتور لـ Team ← Order distribution (الرقم «Waiting for a member»).',
    verify: (a, b) => ({ ok: (b.unassigned || 0) < (a.unassigned || 0), msg: `بلا مؤكّد: ${a.unassigned} ← ${b.unassigned}` }) },
  { id: 'usd', match: /سعر الدولار/, screen: 'Finance ← Costs', path: '/finance?tab=costs',
    goal: 'الأدس تتحسب بالسعر اللي تشري بيه الدولار.', why: 'تسيير مفترض 135. إذا تشري بأكثر، كل ليد أغلى من اللي تشوف.',
    look: () => ['«Your exchange rates»'], do: () => ['حط السعر الحقيقي اللي تشري بيه (السكوار ولا البطاقة).'], dont: [], send: 'كابتور للسعر من بعد ما تحفظ.',
    verify: (a, b) => ({ ok: !b.usdRateAssumed, msg: b.usdRateAssumed ? 'مازال مفترض' : 'تحطّ' }) },
  { id: 'buy', match: /بلا ثمن شراء/, screen: 'Finance ← Products', path: '/finance?tab=products',
    goal: 'الربح يتحسب بثمن الشراء الحقيقي.', why: 'دركا تسيير يحسب السلعة بلاش — الربح منفوخ.',
    look: H => [`${H.productsNoBuy} منتجات بلا ثمن شراء`], do: () => ['لكل منتج: ثمن الشراء + التغليف.', 'ابدا بالمنتجات اللي باعو أكثر.'], dont: [], send: 'كابتور للجدول من بعد.',
    verify: (a, b) => ({ ok: (b.productsNoBuy || 0) < (a.productsNoBuy || 0), msg: `بلا ثمن: ${a.productsNoBuy} ← ${b.productsNoBuy}` }) },
];

/**
 * walk({ scan, triage, done:[ids], after })  ← الخطوة الجاية + (إذا after) التحقّق من اللي فاتت
 */
function walk(o) {
  const H = (o.scan && o.scan.home) || {}, T = o.triage, done = o.done || [];
  const items = T ? [...T.plan.today, ...T.plan.week] : [];
  const seq = [];
  items.forEach(x => { const s = STEPS.find(st => st.match.test(x.title)); if (s && !seq.includes(s)) seq.push(s); });
  const out = { total: seq.length, steps: seq.map(s => s.id) };
  const last = done[done.length - 1];
  if (last && o.after) { const s = STEPS.find(x => x.id === last); if (s) out.verified = { id: last, ...s.verify(H, o.after.home || {}) }; }
  const next = seq.find(s => !done.includes(s.id) && !(out.verified && !out.verified.ok && s.id !== last)) || null;
  const step = out.verified && !out.verified.ok ? STEPS.find(x => x.id === last) : next;
  if (!step) { out.text = '✅ كملنا الإنقاذ. دركا نبنيو المسار: السؤال الأول على الهدف.'; return out; }
  const k = seq.indexOf(step) + 1, h = o.after ? o.after.home || H : H;
  out.step = { id: step.id, k, screen: step.screen, path: step.path };
  const L = [];
  if (out.verified) L.push(out.verified.ok ? `✅ تحقّقت من الحساب: ${out.verified.msg}` : `⚠️ مازال ما تبدّل والو في الحساب (${out.verified.msg}). نعاودو نفس الخطوة:`);
  L.push(`🧭 الخطوة ${k} من ${seq.length} — ${step.goal}`);
  L.push(`📍 الشاشة: ${step.screen}`);
  L.push(`💡 علاش: ${step.why}`);
  L.push('👀 واش تشوف:'); step.look(h).forEach(x => L.push('  • ' + x));
  L.push('👆 واش تدير:'); step.do(h).forEach((x, i) => L.push(`  ${i + 1}. ${x}`));
  if (step.dont.length) { L.push('⛔ ما تديرش:'); step.dont.forEach(x => L.push('  • ' + x)); }
  L.push(`📸 كي تكمّل ابعثلي: ${step.send}`);
  out.text = L.join('\n');
  return out;
}

const api = { walk, STEPS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;

// 🆕 مسار التاجر الجديد (24 خطوة، 7 مراحل) — نفس الدليل المنشور بالصور
const NEW = (typeof require === 'function') ? require('./new-path.json') : { phases: [], steps: [] };
// التحقّق من القراءة (scan) كي نقدرو؛ وإلا نستنّاو الكابتور
const NEW_CHECK = {
  carrier: s => (s.deliveryAgents || []).length > 0,
  product: s => (s.products || []).length > 0,
  stock: s => { const v = (s.variantAnalytics && s.variantAnalytics.data) || []; return v.length > 0 && v.every(x => x.buyPrice > 0); },
  pixel: s => (s.stores || []).some(x => /^\d{10,20}$/.test(String(x.facebookPixelId || ''))),
  apps: s => !!(s.marketing && s.marketing.providers && s.marketing.providers.facebook && s.marketing.providers.facebook.connected),
  wallets: s => (s.wallets || []).length >= 4 && (s.wallets || []).every(w => w.balance >= 0),
  statuses: s => (s.customStatuses || []).length >= 3,
  cancel: s => (s.cancelReasons || []).length >= 4,
  team: s => (s.employees || []).some(e => e.canReceiveOrders && !(e.roles || []).includes('Owner')),
};
function walkNew(o) {
  o = o || {}; const done = o.done || [], P = NEW.steps;
  const out = { total: P.length };
  const last = done[done.length - 1];
  if (last && o.after && NEW_CHECK[last]) out.verified = { id: last, ok: !!NEW_CHECK[last](o.after) };
  const step = out.verified && !out.verified.ok ? P.find(x => x.id === last) : P.find(x => !done.includes(x.id));
  if (!step) { out.text = '✅ كمّلت المسار. دركا نقراو التاست (50 ليد لكل إعلان) ونقررو.'; return out; }
  const ph = NEW.phases.find(p => p.id === step.ph), pi = NEW.phases.indexOf(ph);
  out.step = { id: step.id, k: step.k, path: step.path, img: step.img };
  const L = [];
  if (out.verified) L.push(out.verified.ok ? '✅ تحقّقت من الحساب: الخطوة اللي فاتت راهي.' : '⚠️ مازال ما بانتش في الحساب. نعاودو نفس الخطوة:');
  L.push(`🧭 المرحلة ${pi} (${ph.t}) — الخطوة ${step.k} من ${P.length - 1}: ${step.t}`);
  L.push(`📍 ${step.path}`, `🎯 ${step.goal}`, `💡 ${step.why}`, '👆 واش تدير:');
  step.do.forEach(([c, b, t]) => L.push(`  ${b ? '(' + b + ')' : '•'} ${t}`));
  if (step.dont.length) { L.push('⛔ ما تديرش:'); step.dont.forEach(t => L.push('  • ' + t)); }
  L.push(`✅ تعرف بلي كمّلت كي: ${step.ok}`, `🤖 تسيا: ${step.tassya}`, `📸 ابعثلي: ${step.send}`);
  out.text = L.join('\n');
  return out;
}
api.walkNew = walkNew; api.NEW = NEW;
