/*!
 * بوصلة التاجر — اختيار موديلات التاست: احتمال النجاح + شحال من موديل يلزم
 * al-KHALiYA © 2026
 * كل موديل ياخذ نقاط على 6 معايير (0–2)، «إثبات السوق» يتحسب مرتين (أقوى دليل).
 * النقاط ← احتمال أولي (تقدير خبير، يتصحّح بالتاست). من بعد: شحال من موديل ندخلو باش نخرجو بـ N فائزين باحتمال ≥ الهدف.
 */
'use strict';

const CRITERIA = [
  { id: 'proof', w: 2, t: 'إثبات السوق', how: '2 = إعلانات منافسين شغالة أكثر من 14 يوم + بزاف إعلانات • 1 = إعلانات جديدة برك • 0 = حتى إعلان' },
  { id: 'margin', w: 1, t: 'الهامش', how: '2 = السعر ÷ تكلفة الورشة ≥ 2.2 • 1 = 1.9–2.2 • 0 = أقل' },
  { id: 'season', w: 1, t: 'الموسم', how: '2 = يتلبس في نوفمبر–ديسمبر • 1 = نص نص • 0 = لا' },
  { id: 'size', w: 1, t: 'خطر المقاس', how: '2 = واسع (جبة، قشابية) • 1 = نص مفصّل • 0 = مفصّل (روتور المقاس)' },
  { id: 'hook', w: 1, t: 'الطرز يبان في 3 ثواني', how: '2 = الطرز هو اللي يشد العين في الفيديو • 1 = يبان من قريب برك • 0 = ما يبانش' },
  { id: 'edge', w: 1, t: 'التمايز', how: '2 = عندك حاجة ما عندهاش المنافسين والطلب كاين • 1 = سوق عامر بصح تقدر تتميّز • 0 = حرب أسعار' },
];
const MAX = CRITERIA.reduce((s, c) => s + 2 * c.w, 0); // 14
const pOf = score => Math.round((0.08 + 0.035 * score) * 1000) / 1000; // 0 ← 8% • 14 ← 57%

// احتمال «على الأقل k فائزين» من احتمالات مختلفة (Poisson-binomial)
function atLeast(ps, k) {
  let dist = [1];
  ps.forEach(p => { const nd = new Array(dist.length + 1).fill(0); dist.forEach((v, i) => { nd[i] += v * (1 - p); nd[i + 1] += v * p; }); dist = nd; });
  return dist.slice(k).reduce((s, v) => s + v, 0);
}

/**
 * pick({ candidates:[{name, scores:{proof,margin,season,size,hook,edge}, sell, buy, leadUsd}], need:2, target:0.8, leadsPerAd:50, adsPerModel:2, rate:250 })
 */
function pick(o) {
  const need = o.need || 2, target = o.target || 0.8, lpa = o.leadsPerAd || 50, apm = o.adsPerModel || 2, rate = o.rate || 250;
  const C = (o.candidates || []).map(c => { const score = CRITERIA.reduce((s, k) => s + (c.scores[k.id] || 0) * k.w, 0); return { ...c, score, p: pOf(score) }; })
    .sort((a, b) => b.p - a.p || (b.sell - b.buy) - (a.sell - a.buy));
  const ladder = [];
  for (let k = need; k <= C.length; k++) {
    const set = C.slice(0, k), prob = atLeast(set.map(x => x.p), need);
    const leads = k * apm * lpa, usd = set.reduce((s, x) => s + apm * lpa * (x.leadUsd || 1.5), 0);
    ladder.push({ k, models: set.map(x => x.name), probability: Math.round(prob * 100), expectedWinners: Math.round(set.reduce((s, x) => s + x.p, 0) * 10) / 10, leads, budgetUsd: Math.round(usd), budgetDzd: Math.round(usd * rate) });
  }
  const best = ladder.find(l => l.probability >= target * 100) || ladder[ladder.length - 1];
  return { criteria: CRITERIA, max: MAX, ranked: C.map(x => ({ name: x.name, score: x.score, p: Math.round(x.p * 100), scores: x.scores, sell: x.sell, buy: x.buy, leadUsd: x.leadUsd, note: x.note })), ladder, choose: best, need, target: Math.round(target * 100),
    text: pickText(C, ladder, best, need) };
}

function pickText(C, ladder, best, need) {
  const L = ['🎯 احتمال نجاح الموديلات (تقدير قبل التاست، يتصحّح بالأرقام):'];
  C.forEach(x => L.push(`  • ${x.name}: ${x.score}/${MAX} نقطة ← ${Math.round(x.p * 100)}%`));
  L.push(`🔢 باش نخرجو بـ ${need} فائزين:`);
  ladder.forEach(l => L.push(`  ${l === best ? '✅' : '▫️'} ${l.k} موديلات ← ${l.probability}% • ${l.leads} ليد • ~$${l.budgetUsd}`));
  return L.join('\n');
}

module.exports = { pick, atLeast, CRITERIA, pOf, MAX };
