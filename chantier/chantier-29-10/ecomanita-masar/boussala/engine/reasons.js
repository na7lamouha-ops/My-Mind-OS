/*!
 * بوصلة التاجر — أسباب الإلغاء والروتور (خاصة بالملابس) → الرافعة اللي تصلّحها
 * al-KHALiYA © 2026
 * مرحلتين: التأكيد (علاش ما تأكّدتش) • التوصيل (علاش رجعت).
 * في تسيير: أسباب الإلغاء = Settings ← Status customization ← Cancel reasons ← Add reason (+ «Require a reason» شاعلة).
 * أسباب الروتور: تسيير ما فيهش خانة سبب للراجعة → مؤقتاً المتتبّع يكتب الكود في تعليق الطلبية (مثلاً «#R-مقاس») — ونطلبو من فريق تسيير «Return reasons» كيما الإلغاء.
 */
'use strict';
const fmt = n => Math.round(n).toLocaleString('en-US');

// 📋 الكتالوغ: الكود، النص اللي يتحط في تسيير، الكلمات اللي نتعرّفو بيها، والرافعة
const CANCEL = [
  { code: 'C-NOREP', label: 'ما جاوبش (بعد سلّم المكالمات)', re: /لم يرد|ما جاوب|ne r[ée]pond|injoignable|sans r[ée]ponse/i, lever: 'السرعة: أول اتصال قبل 15 دقيقة + رسالة واتساب قبل الاتصال. شوف تقرير التأكيد.' },
  { code: 'C-SIZE', label: 'المقاس: ما عرفش مقاسو / المقاس ماكانش', re: /مقاس|taille|size/i, lever: 'جدول المقاسات في الصفحة (بالطول والوزن) + المؤكّد يسقسي على الطول والوزن ويقترح المقاس.' },
  { code: 'C-LOOK', label: 'الموديل/اللون: حب يتأكد قبل', re: /لون|couleur|موديل|صورة/i, lever: 'صور وفيديو حقيقيين للقطعة (ماشي صور الجملة) + المؤكّد يبعث فيديو في واتساب.' },
  { code: 'C-PRICE', label: 'السعر غالي', re: /سعر(?! التوصيل)|غالي|prix|cher/i, lever: 'عرض: قطعتين بسعر خاص، ولا هدية صغيرة — بلا ما تنقّص السعر الأساسي.' },
  { code: 'C-SHIP', label: 'التوصيل غالي', re: /توصيل|livraison/i, lever: 'ستوب ديسك أرخص + توصيل مجاني فوق مبلغ معيّن.' },
  { code: 'C-WAIT', label: 'الأجل طويل (طلب مسبق)', re: /أجل|وقت|délai|مسبق|retard/i, lever: 'قول التاريخ بالضبط في الصفحة وفي المكالمة، وما تفوتش 7 أيام في الطلب المسبق.' },
  { code: 'C-MIND', label: 'غيّر رأيه / شرا من بلاصة أخرى', re: /غيّر رأيه|غير رأيه|شرا|changé|change d'avis/i, lever: 'السرعة (اتصال وإرسال نفس النهار) + سبب للشراء دركا (كمية محدودة، هدية اليوم).' },
  { code: 'C-TRY', label: 'يحب يقيس قبل ما يخلّص', re: /يقيس|essayer|يشوف/i, lever: 'ضمان «تبدّل المقاس بلاش» ولا «تقيس قدّام الليفرور» — يحيّد الخوف.' },
  { code: 'C-DUP', label: 'طلب مكرر', re: /مكرر|double|doublon/i, lever: 'ماشي مشكل تأكيد — نحّيه من الحساب (حالة DOUBLE).' },
  { code: 'C-FAKE', label: 'طلب وهمي / رقم غالط', re: /وهمي|غير جاد|غالط|faux|fake/i, lever: 'قواعد السبام في تسيير (Settings ← Spam protection) + تحقّق من الرقم في الفورم.' },
  { code: 'C-STOCK', label: 'المنتج/المقاس ماكانش في الستوك', re: /غير متوفر|rupture|stock/i, lever: 'وقّف الأدس على المقاس الناقص ولا حوّلو لطلب مسبق بتاريخ.' },
  { code: 'C-OTHER', label: 'أخرى (مع ملاحظة)', re: /أخرى|autre/i, lever: 'اقرا الملاحظات كل أسبوع — إذا تتعاود، تولّي سبب جديد.' },
];
const RETURN = [
  { code: 'R-NOREP', label: 'ما جاوبش الليفرور / خارج التغطية', re: /injoignable|ne r[ée]pond|ما جاوب|خارج مجال|occup/i, lever: 'المتتبّع يعيّط نفس النهار اللي يبان «ما يجاوبش» + رسالة «طلبيتك وصلت لولايتك».' },
  { code: 'R-SIZE', label: 'قاسها: المقاس ما جاش', re: /مقاس|taille|size/i, lever: 'جدول المقاسات + تبديل المقاس بلاصة الروتور (تسيير يدعم التبديل).' },
  { code: 'R-QUAL', label: 'الجودة / القماش ماشي كيما تخيّل', re: /جودة|قماش|qualit|tissu/i, lever: 'صور قريبة للقماش + وصف صريح. لو تتعاود: المشكل في المنتج، ماشي في الإعلان.' },
  { code: 'R-LOOK', label: 'اللون/الموديل ماشي كيما الصورة', re: /لون|couleur|صورة|موديل/i, lever: 'الكرياتيف يوعد بحاجة ما كاينش — بدّل الصور للقطعة الحقيقية.' },
  { code: 'R-CASH', label: 'ما عندوش الدراهم / ماكانش في الدار', re: /دراهم|argent|absent|الدار|مكانش/i, lever: 'المؤكّد يثبّت النهار مع الزبون + اتصال نهار قبل التوصيل.' },
  { code: 'R-PRICE', label: 'رفض: السعر/التوصيل ماشي كيما قالولو', re: /سعر|prix|frais/i, lever: 'المؤكّد يقول المبلغ الكامل (السلعة + التوصيل) بالحرف في المكالمة.' },
  { code: 'R-MIND', label: 'غيّر رأيه / شرا من عند واحد آخر', re: /غيّر|غير رأيه|annul|changé/i, lever: 'السرعة: الإرسال نفس النهار — كل يوم زايد يطيّح التوصيل.' },
  { code: 'R-LATE', label: 'الطرد تأخر', re: /تأخر|retard|reporter|أجّل/i, lever: 'شركة التوصيل: الطرود الحابسة أكثر من 5 أيام + بدّل شركة التوصيل في الولايات الضعيفة.' },
  { code: 'R-ADDR', label: 'عنوان / رقم غالط', re: /عنوان|adresse|رقم غالط|faux num/i, lever: 'المؤكّد يعاود يقرا العنوان والبلدية للزبون + ستوب ديسك كي يكون العنوان غامض.' },
  { code: 'R-EXCH', label: 'تبديل (ماشي روتور)', re: /تبديل|échange|exchange/i, lever: 'حسبو وحدو — التبديل زبون محتفظ بيه.' },
];

// تصنيف نص (سبب تسيير، ملاحظة شركة التوصيل، ولا تعليق المتتبّع «#R-SIZE»)
function classify(text, list) {
  const t = text || '';
  const tag = t.match(/#([CR]-[A-Z]+)/); if (tag) { const h = list.find(x => x.code === tag[1]); if (h) return h; }
  return list.find(x => x.re.test(t)) || null;
}

/**
 * analyze({ canceled:[{reason|cancelReason{label}|note}], returns:[{reason|note|notes[]}], cplDzd, confPct, retCost, delCost, buyDzd })
 */
function analyze(o) {
  const cpl = o.cplDzd || 0, conf = (o.confPct || 50) / 100;
  const C = (o.canceled || []).map(x => { const t = x.reason || (x.cancelReason && x.cancelReason.label) || x.cancelNote || x.note || ''; return { t, h: t ? classify(t, CANCEL) : null }; });
  const R = (o.returns || []).map(x => { const t = [x.reason, x.note, ...(x.notes || [])].filter(Boolean).join(' | '); return { t, h: t ? classify(t, RETURN) : null }; });
  const tally = (arr, list) => { const m = {}; arr.forEach(a => { const k = a.h ? a.h.code : (a.t ? 'UNMAPPED' : 'NONE'); m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([code, n]) => { const h = list.find(x => x.code === code); return { code, label: h ? h.label : code === 'NONE' ? 'بلا سبب' : 'سبب ما نعرفوش', n, pct: Math.round(n / arr.length * 100), lever: h && h.lever }; }).sort((a, b) => b.n - a.n); };
  const cancel = tally(C, CANCEL), ret = tally(R, RETURN);
  // 💸 شحال يخسّر كل سبب: الإلغاء = ليد محروق • الروتور = ليد/تأكيد + روتور + التوصيل
  const costCancel = cpl, costReturn = (conf > 0 ? cpl / conf : cpl) + (o.retCost || 0) + (o.delCost || 0);
  cancel.forEach(x => x.lostDzd = Math.round(x.n * costCancel)); ret.forEach(x => x.lostDzd = Math.round(x.n * costReturn));
  const blindC = C.length ? Math.round(C.filter(a => !a.h).length / C.length * 100) : 0, blindR = R.length ? Math.round(R.filter(a => !a.h).length / R.length * 100) : 0;
  const actions = [];
  if (C.length >= 10 && blindC > 30) actions.push({ lvl: 'ask', code: 'reasons_cancel_blind', msg: `❓ ${blindC}% من الإلغاءات بلا سبب معروف — زيدي أسباب الملابس في تسيير وخلّي السبب إجباري.` });
  if (R.length >= 10 && blindR > 30) actions.push({ lvl: 'ask', code: 'reasons_return_blind', msg: `❓ ${blindR}% من الروتور بلا سبب — المتتبّع يكتب الكود (#R-SIZE، #R-QUAL…) في تعليق كل راجعة، حتى تزيد تسيير خانة السبب.` });
  [...cancel.filter(x => x.lever && x.pct >= 15).slice(0, 2).map(x => ({ ...x, st: 'التأكيد' })), ...ret.filter(x => x.lever && x.pct >= 15).slice(0, 2).map(x => ({ ...x, st: 'التوصيل' }))]
    .forEach(x => actions.push({ lvl: 'lever', code: 'reason_' + x.code, msg: `🔑 ${x.st}: «${x.label}» = ${x.pct}% (${x.n}، ~${fmt(x.lostDzd)} دج ضايعين) → ${x.lever}` }));
  return { cancel, returns: ret, blind: { cancelPct: blindC, returnPct: blindR }, actions, text: toText(cancel, ret, actions) };
}

function toText(c, r, A) {
  const L = ['🏷️ أسباب الإلغاء والروتور'];
  if (c.length) L.push('  الإلغاء: ' + c.slice(0, 5).map(x => `${x.label} ${x.pct}%`).join(' • '));
  if (r.length) L.push('  الروتور: ' + r.slice(0, 5).map(x => `${x.label} ${x.pct}%`).join(' • '));
  A.forEach(a => L.push('  ' + a.msg));
  return L.join('\n');
}

// ⚙️ واش يتزاد في تسيير (الإعداد)
function setupSteps() {
  return {
    cancelReasons: { path: 'Settings ← Status customization ← Cancel reasons ← Add reason', items: CANCEL.map(x => x.label), plus: 'شعّل «Require a reason when cancelling»' },
    returnReasons: { now: 'المتتبّع يكتب الكود في تعليق الطلبية الراجعة: ' + RETURN.map(x => '#' + x.code).join(' '), ask: 'نطلبو من فريق تسيير: خانة «Return reasons» كيما Cancel reasons (إجبارية في Process).' },
    callStatuses: 'سلّم المكالمات (APPEL 01→03 / JOUR 01→03) يبقى — بصح آخر درجة تتسكّر بإلغاء + سبب «C-NOREP».',
  };
}

const api = { analyze, classify, setupSteps, CANCEL, RETURN };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.BoussalaReasons = api;
