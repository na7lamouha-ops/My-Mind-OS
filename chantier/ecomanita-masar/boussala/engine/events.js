/*!
 * بوصلة التاجر — الأحداث: واش تبدّل في البيزنس، وواش يبدّل في الخطة
 * al-KHALiYA © 2026
 * 💰 رأس مال جديد • 🧵 ورشة جديدة • ⏳ منتج كبر (الكرياتيف يتعب / السوق يتشبّع) • 💀 كرياتيف مات • ⚔️ منافس دخل • 🚀 منتج طالع
 * يقارن آخر 7 أيام بالـ 21 اللي قبل (get_marketing_analytics مرتين) + الطلبيات (أسباب الإلغاء) + المالية + المخازن/الورشات.
 * كل حدث: الدليل بالأرقام ← واش ندير ← واش يتبدّل في المسار.
 */
'use strict';
const E = (typeof require === 'function') ? require('./boussala-engine.js') : window.BoussalaEngine;
const m = x => E.mil(x) || Math.round(x).toLocaleString('en-US') + ' دج';
const dayMs = 864e5;
const r1 = x => Math.round(x * 10) / 10;

function adsOf(mk) {
  const out = {}; const w = (n, camp) => { if (n.level === 'campaign') camp = n.name;
    if (n.level === 'content') { const a = (out[n.id] = out[n.id] || { id: n.id, name: n.name, campaign: camp, L: 0, C: 0, D: 0, R: 0, spend: 0 }); const c = n.counts || {};
      a.L += c.orders || 0; a.C += c.confirmed || 0; a.D += c.delivered || 0; a.R += c.returned || 0; a.spend += (n.ads && n.ads.spend) || 0; }
    (n.children || []).forEach(x => w(x, camp)); };
  ((mk && mk.tree) || []).forEach(n => w(n, null)); return out;
}
const keyOf = camp => (camp || '').split(/[|\-_/]/)[0].trim().toUpperCase();

function events(i) {
  const S = i.scan || {}, rate = i.rate || 255, today = new Date(i.today || S.today || Date.now());
  const prodNames = [...new Set(((S.variantAnalytics && S.variantAnalytics.data) || []).map(v => v.product && v.product.name).filter(Boolean))];
  const prodOf = camp => { const k = keyOf(camp); return prodNames.find(p => p.toUpperCase().includes(k)) || k; };
  const EV = [], add = e => EV.push(e);

  // 💰 رأس مال جديد
  (S.financeTx || []).filter(t => t.type === 'IN' && (/CAPITAL/i.test(t.category || '') || /apport|capital|injection|ضخ|رأس المال|associ/i.test(t.description || '')) && (today - new Date(t.createdAt)) / dayMs <= 14)
    .forEach(t => add({ type: 'capital_in', icon: '💰', sev: 'opportunity', title: `رأس مال جديد: ${m(t.amount)} (${t.description})`, amount: t.amount, at: t.createdAt,
      actions: ['ما تحطّوش كامل في الأدس نهار واحد: زيد الميزانية 20% كل 3 أيام على المنتجات الصحاح.', 'حط حصة في RÉSERVE (5 أيام أدس + 10% من الباقي للورشة) قبل أي تكبير.', 'البوصلة تعاود تحسب السقف بالكاش الجديد (تحت).'], replan: true }));

  // 🧵 ورشة جديدة
  const W = (S.locations || []).filter(l => /workshop|atelier/i.test(l.type || l.name || ''));
  W.filter(l => l.createdAt && (today - new Date(l.createdAt)) / dayMs <= 14).forEach(nw => {
    const old = W.filter(x => x !== nw && x.unitCost).sort((a, b) => a.unitCost - b.unitCost)[0];
    const dCost = old && nw.unitCost ? old.unitCost - nw.unitCost : null, dLead = old && nw.leadDays ? (old.leadDays || 0) - nw.leadDays : null;
    add({ type: 'new_workshop', icon: '🧵', sev: 'opportunity', title: `ورشة جديدة: ${nw.name}${nw.unitCost ? ` (${nw.unitCost} دج، ${nw.leadDays || '؟'} أيام${nw.capacityPerDay ? `، ${nw.capacityPerDay} قطعة/يوم` : ''})` : ''}`,
      workshop: nw.name, unitCost: nw.unitCost, leadDays: nw.leadDays, vs: old ? { name: old.name, unitCost: old.unitCost, leadDays: old.leadDays } : null,
      evidence: old ? `مقابل ${old.name}: ${dCost > 0 ? `أرخص بـ ${dCost} دج/قطعة` : dCost < 0 ? `أغلى بـ ${-dCost} دج/قطعة` : 'نفس الثمن'}${dLead ? `، ${dLead > 0 ? 'أسرع' : 'أبطأ'} بـ ${Math.abs(dLead)} أيام` : ''}` : '',
      actions: ['دفعة تجريبية 50 قطعة عند الورشة الجديدة قبل ما تحوّل الكل: الجودة (الروتور «الجودة») والآجال.', 'لو الدفعة تعدّي: قسّم الإنتاج بين الزوج — ورشتين = أقل خطر نفاد.', 'البوصلة تعاود تحسب رأس المال بالثمن والأجل الجداد (تحت).'], replan: true });
  });

  // الإعلانات: آخر 7 أيام مقابل الـ 21 اللي قبل
  const P = adsOf(S.marketingPrev), R = adsOf(S.marketingRecent), dPrev = i.prevDays || 21, dRec = i.recentDays || 7;
  const byProd = {};
  Object.values(R).forEach(a => { const p = P[a.id]; const prod = prodOf(a.campaign);
    const b = (byProd[prod] = byProd[prod] || { prod, ads: [], Lr: 0, Cr: 0, Sr: 0, Lp: 0, Cp: 0, Sp: 0 }); b.ads.push({ a, p });
    b.Lr += a.L; b.Cr += a.C; b.Sr += a.spend; if (p) { b.Lp += p.L; b.Cp += p.C; b.Sp += p.spend; } });

  // 💀 كرياتيف مات (إعلان وحدو يطيح، والباقي لا)
  Object.values(byProd).forEach(b => b.ads.forEach(({ a, p }) => {
    if (!p || p.L < 30 || a.L < 15) return;
    const cplP = p.spend / p.L, cplR = a.spend / a.L, perDayP = p.L / dPrev, perDayR = a.L / dRec, spendDayP = p.spend / dPrev, spendDayR = a.spend / dRec;
    const died = cplR >= 1.5 * cplP || (perDayR <= 0.4 * perDayP && spendDayR >= 0.6 * spendDayP);
    if (died) { a._died = true; add({ type: 'creative_died', icon: '💀', sev: 'stop', product: b.prod, title: `كرياتيف مات: «${a.name}» (${b.prod})`,
      evidence: `الليد ${m(cplP * rate)} ← ${m(cplR * rate)} (+${Math.round((cplR / cplP - 1) * 100)}%) • ${r1(perDayP)} ← ${r1(perDayR)} ليد/يوم`,
      actions: ['وقّفو، وحوّل ميزانيتو للإعلان اللي مازال يخدم في نفس المنتج.', 'اطلب من المونتور نسخة جديدة من **نفس الزاوية** (هوك جديد، نفس الفكرة) — الزاوية ماشي ميتة، الفيديو هو اللي تعب.'] }); }
  }));

  // ⚔️ منافس دخل (كل إعلانات المنتج يطيحو مع بعض + التأكيد يطيح + «شرا من بلاصة أخرى/السعر» يطلعو)
  const orders = S.orders || [];
  Object.values(byProd).forEach(b => {
    if (b.Lp < 50 || b.Lr < 20) return;
    const cplP = b.Sp / b.Lp, cplR = b.Sr / b.Lr, confP = b.Cp / b.Lp * 100, confR = b.Cr / b.Lr * 100;
    const allDown = b.ads.filter(x => x.p && x.p.L >= 30).every(({ a, p }) => a.L && (a.spend / a.L) >= 1.25 * (p.spend / p.L));
    const rec = orders.filter(o => (o.items || []).some(n => b.prod.toUpperCase().includes(String(n).toUpperCase()) || String(n).toUpperCase().includes(b.prod.toUpperCase())) && o.status === 'canceled');
    const compet = rec.filter(o => /بلاصة أخرى|منافس|ailleurs|السعر|cher/i.test((o.cancelReason && o.cancelReason.label) || '')).length;
    const compShare = rec.length ? Math.round(compet / rec.length * 100) : 0;
    if (allDown && cplR >= 1.3 * cplP && confR <= confP - 8) add({ type: 'competitor', icon: '⚔️', sev: 'warn', product: b.prod, title: `منافس دخل على «${b.prod}» (السوق، ماشي الكرياتيف)`,
      evidence: `كل الإعلانات طاحو مع بعض: الليد ${m(cplP * rate)} ← ${m(cplR * rate)} • التأكيد ${Math.round(confP)}% ← ${Math.round(confR)}%${rec.length ? ` • ${compShare}% من الإلغاءات «شرا من بلاصة أخرى / السعر»` : ''}`,
      actions: ['ما تنقّصش السعر أول حاجة: زيد قيمة (قطعتين بعرض، هدية، توصيل مجاني فوق مبلغ).', 'شوف إعلانات المنافس (Ad Library): السعر، الزاوية، العرض — وفرّق روحك بزاوية ما عندوش.', 'المؤكّد يقول العرض في أول 20 ثانية من المكالمة.', 'لو بعد 7 أيام مازال: نقّص الميزانية وحوّلها لمنتج طالع.'] });
  });

  // ⏳ منتج كبر
  ((S.variantAnalytics && S.variantAnalytics.data) || []).filter(v => v.firstOrderAt).reduce((acc, v) => { const n = v.product.name; if (!acc.find(x => x.n === n)) acc.push({ n, first: v.firstOrderAt }); return acc; }, [])
    .forEach(({ n, first }) => { const age = Math.round((today - new Date(first)) / dayMs); const b = byProd[n];
      const alive = b ? b.ads.filter(x => !x.a._died && x.p) : [];
      const Lr = alive.reduce((s2, x) => s2 + x.a.L, 0), Sr = alive.reduce((s2, x) => s2 + x.a.spend, 0), Lp = alive.reduce((s2, x) => s2 + x.p.L, 0), Sp = alive.reduce((s2, x) => s2 + x.p.spend, 0);
      const trend = Lp && Lr ? (Sr / Lr) / (Sp / Lp) - 1 : null;
      if (age >= 60 && (trend == null || trend < 0.2)) add({ type: 'aging_watch', icon: '⏳', sev: 'opportunity', product: n, title: `«${n}» عندو ${age} يوم — مازال صحيح (بلا الكرياتيف الميّت)`, evidence: trend != null ? `الإعلانات الحية: الليد ${trend >= 0 ? '+' : ''}${Math.round(trend * 100)}%` : '', actions: ['حضّر الخليفة: تاست منتج جديد دركا والكاش يدخل — ماشي كي يموت.'] });
      if (age >= 45 && trend != null && trend >= 0.2 && !EV.some(e => e.type === 'competitor' && e.product === n)) add({ type: 'aging', icon: '⏳', sev: 'warn', product: n, title: `«${n}» عندو ${age} يوم — الليد طالع +${Math.round(trend * 100)}%`,
        evidence: 'المنتج يكبر: الجمهور يتشبّع والكرياتيفات يتعبو.', actions: ['جدّد بزاوية جديدة (ماشي فيديو جديد برك) ولا عرض جديد (لون/موديل جديد).', 'ابدا التاست تاع المنتج اللي يخلفو **دركا** والكاش مازال يدخل.', 'ما تعاودش تطلب دفعة كبيرة منو: دفعات صغار حسب الطلب.'] }); });

  // 🚀 منتج طالع
  Object.values(byProd).forEach(b => { if (b.Lr < 50) return; const perDayP = b.Lp / dPrev, perDayR = b.Lr / dRec, confR = b.Cr / b.Lr * 100, cplR = b.Sr / b.Lr, cplP = b.Lp ? b.Sp / b.Lp : null;
    if (perDayR >= 1.5 * Math.max(0.1, perDayP) && (!cplP || cplR <= 1.1 * cplP) && confR >= 55) add({ type: 'rising', icon: '🚀', sev: 'opportunity', product: b.prod, title: `«${b.prod}» طالع: ${r1(perDayP)} ← ${r1(perDayR)} ليد/يوم`,
      evidence: `الليد ${m(cplR * rate)}${cplP ? ` (كان ${m(cplP * rate)})` : ''} • التأكيد ${Math.round(confR)}%`, actions: ['كبّر: +20% كل 3 أيام ما دام الليد تحت 85% من السقف.', 'تأكّد من الستوك: نقطة إعادة الطلب = الاستهلاك × (أجل الورشة + 4).'] }); });

  const order = { stop: 0, warn: 1, opportunity: 2 };
  EV.sort((a, b) => order[a.sev] - order[b.sev]);
  return { events: EV, byProduct: Object.values(byProd).map(b => ({ product: b.prod, leadsPerDayPrev: r1(b.Lp / dPrev), leadsPerDayRecent: r1(b.Lr / dRec), cplPrevDzd: b.Lp ? Math.round(b.Sp / b.Lp * rate) : null, cplRecentDzd: b.Lr ? Math.round(b.Sr / b.Lr * rate) : null, confPrev: b.Lp ? Math.round(b.Cp / b.Lp * 100) : null, confRecent: b.Lr ? Math.round(b.Cr / b.Lr * 100) : null })) };
}

function eventsText(R) {
  if (!R.events.length) return '📡 الأحداث: والو جديد هذي الجمعة.';
  const L = [`📡 الأحداث (${R.events.length}):`];
  R.events.forEach(e => { L.push(`  ${e.icon} ${e.title}`); if (e.evidence) L.push(`     📊 ${e.evidence}`); e.actions.forEach(a => L.push(`     → ${a}`)); });
  return L.join('\n');
}

const api = { events, eventsText };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
