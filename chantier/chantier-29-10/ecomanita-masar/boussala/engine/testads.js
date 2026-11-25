/*!
 * بوصلة التاجر — تاست الإعلانات (المتغيّرات): 50 ليد لكل إعلان
 * al-KHALiYA © 2026
 * يقرا تقرير التسويق تاع تسيير (get_marketing_analytics: source → campaign → content) ويقول لكل إعلان/زاوية:
 *   مازال يتعلّم (ناقص X ليد) • وقّف بكري • فوق السقف • جاهز للحكم — ومن بعد: كاين فائز ولا لا، وإذا الأرقام كافية باش نقرّرو.
 * القاعدة الإحصائية (بسيطة): الضجيج تاع «تكلفة المؤكّدة» ≈ 1/√(عدد المؤكدات). نقولو «فائز» غير كي الفرق أكبر من الضجيج (ثقة 90%).
 */
'use strict';
const E = (typeof require === 'function') ? require('./boussala-engine.js') : window.BoussalaEngine;
const fmt = n => Math.round(n).toLocaleString('en-US');
const r1 = x => x == null ? null : Math.round(x * 10) / 10;

const RULES = {
  MIN_LEADS: 50,          // 50 ليد لكل إعلان قبل أي حكم
  EARLY_LEADS: 25,        // من 25 ليد…
  EARLY_X: 1.3,           // …الليد فوق السقف بـ 30% → وقّف بكري
  DEAD_X: 3,              // صرف 3 مرات السقف بلا حتى ليد → ميّت
  STARVED_SHARE: 0.10,    // في CBO: أقل من 10% من ميزانية الحملة = ميتا ما عطاتوش فرصة
  Z: 1.645,               // ثقة 90%
  MIN_CLOSED: 20,         // التوصيل: 20 طرد مسكّر (موصل + راجع) لكل إعلان قبل ما نقارنو
  TIE_X: 3,               // لو باش نفرّقو نحتاجو أكثر من 3 مرات الليدات الحالية → تعادل
};

const clean = s => (s || '').replace(/[‎‏]/g, '').replace(/\s*-\s*Copy(\s*\d+)?\s*$/i, '').replace(/\s+/g, ' ').trim();

// يجمع الإعلانات من كل المصادر (facebook / instagram / threads…) — نفس الإعلان يتجمّع
function collect(mk, byName) {
  const ads = {}, camps = {};
  const walk = (n, camp) => {
    if (n.level === 'campaign') camp = n;
    if (n.level === 'content' && n.id !== '(not set)') {
      const key = byName ? clean(n.name) : n.id;
      const a = (ads[key] = ads[key] || { key, name: clean(n.name), ids: new Set(), campaigns: new Set(), spendUsd: 0, leads: 0, confirmed: 0, delivered: 0, returned: 0, canceled: 0, visits: 0, quality: null, byCampaign: {} });
      const c = n.counts || {}, sp = (n.ads && n.ads.spend) || 0;
      a.ids.add(n.id); if (camp) a.campaigns.add(camp.name);
      a.spendUsd += sp; a.leads += c.orders || 0; a.confirmed += c.confirmed || 0; a.delivered += c.delivered || 0; a.returned += c.returned || 0; a.canceled += c.canceled || 0; a.visits += c.visits || 0;
      if (n.quality && typeof n.quality === 'object') a.quality = n.quality;
      if (camp) { a.byCampaign[camp.id] = (a.byCampaign[camp.id] || 0) + sp; const C = (camps[camp.id] = camps[camp.id] || { id: camp.id, name: camp.name, spendUsd: 0, ads: new Set() }); C.spendUsd += sp; C.ads.add(key); }
    }
    (n.children || []).forEach(x => walk(x, camp));
  };
  ((mk && mk.tree) || []).forEach(n => walk(n, null));
  return { ads: Object.values(ads), camps: Object.values(camps) };
}

/**
 * testAds({ marketing, rate, ceilingDzd? , product?, settings?, byName=true, minLeads=50 })
 *   ceilingDzd = سقف الليد (من المسار). ولا product + settings → البوصلة تحسبو.
 */
function testAds(o) {
  const rate = o.rate || (o.settings && o.settings.rate) || 250;
  const minLeads = o.minLeads || RULES.MIN_LEADS;
  let ceiling = o.ceilingDzd, assumed = null;
  if (!ceiling && o.product) {
    const ctx = E.makeCtx({ ...(o.settings || {}), rate });
    const p = E.normProduct(o.product, ctx); const R = E.calcOneProduct(p, E.sharedOf(ctx), ctx.target, ctx);
    ceiling = R.breakevenCPA; assumed = { conf: p.conf, del: p.del };
  }
  const { ads, camps } = collect(o.marketing, o.byName !== false);
  const rows = ads.map(a => {
    const spend = a.spendUsd * rate, L = a.leads, C = a.confirmed, closed = a.delivered + a.returned;
    const cpl = L ? spend / L : null, conf = L ? C / L * 100 : null;
    const delPct = closed >= RULES.MIN_CLOSED ? a.delivered / closed * 100 : null;
    // السقف تاع هذا الإعلان: يتبدّل مع التأكيد (والتوصيل كي يتقاس) تاعو
    let ceil = ceiling;
    if (ceil && assumed && conf != null && L >= 10) ceil = ceiling * (conf / assumed.conf) * (delPct != null ? delPct / assumed.del : 1);
    const r = { name: a.name, campaigns: [...a.campaigns], spendDzd: Math.round(spend), spendUsd: +a.spendUsd.toFixed(2), leads: L, confirmed: C, delivered: a.delivered, returned: a.returned,
      cplDzd: cpl ? Math.round(cpl) : null, cplUsd: cpl ? +(cpl / rate).toFixed(2) : null, confPct: r1(conf), delPct: r1(delPct),
      costPerConfirmedDzd: C ? Math.round(spend / C) : null, costPerDeliveredDzd: a.delivered ? Math.round(spend / a.delivered) : null,
      ceilingDzd: ceil ? Math.round(ceil) : null, quality: a.quality && a.quality.conversionRateRanking };
    // 🔎 الحالة
    const starvedIn = camps.filter(c => /CBO/i.test(c.name) && c.ads.size > 1 && c.ads.has(a.key) && c.spendUsd > 0 && (a.byCampaign[c.id] || 0) / c.spendUsd < RULES.STARVED_SHARE && L < minLeads);
    if (L === 0 && ceil && spend >= RULES.DEAD_X * ceil) r.status = 'dead';
    else if (starvedIn.length) { r.status = 'starved'; r.starvedShare = Math.round((a.byCampaign[starvedIn[0].id] || 0) / starvedIn[0].spendUsd * 100); }
    else if (L < minLeads) {
      if (L >= RULES.EARLY_LEADS && ceil && cpl > RULES.EARLY_X * ceil) r.status = 'early_kill';
      else { r.status = 'learning'; r.leadsLeft = minLeads - L; r.budgetLeftDzd = Math.round((minLeads - L) * (cpl || ceil || 0)); }
    } else r.status = ceil && cpl > ceil ? 'over_ceiling' : 'ready';
    return r;
  });

  // 🏆 الحكم بين الجاهزين: تكلفة المؤكّدة (ومن بعد تكلفة الموصلة كي يتسكّرو 20 طرد)
  const ready = rows.filter(r => r.status === 'ready' && r.confirmed > 0).sort((x, y) => x.costPerConfirmedDzd - y.costPerConfirmedDzd);
  let verdict = null;
  if (ready.length >= 2) {
    const [b, s] = ready;
    const cmp = (x1, n1, x2, n2) => { const lr = Math.log(x2 / x1), se = Math.sqrt(1 / n1 + 1 / n2), z = lr / se; const need = lr > 0 ? Math.ceil(2 * Math.pow(RULES.Z / lr, 2)) : Infinity; return { gapPct: Math.round((x2 / x1 - 1) * 100), z: r1(z), sure: z >= RULES.Z, needPerAd: need }; };
    const c = cmp(b.costPerConfirmedDzd, b.confirmed, s.costPerConfirmedDzd, s.confirmed);
    const bothClosed = b.delivered + b.returned >= RULES.MIN_CLOSED && s.delivered + s.returned >= RULES.MIN_CLOSED && b.delivered && s.delivered;
    const d = bothClosed ? cmp(b.costPerDeliveredDzd, b.delivered, s.costPerDeliveredDzd, s.delivered) : null;
    const leadsNeed = c.needPerAd === Infinity ? Infinity : Math.ceil(c.needPerAd / Math.max(0.05, (b.confPct || 50) / 100));
    const tie = !c.sure && (leadsNeed > RULES.TIE_X * Math.max(b.leads, s.leads));
    const flip = d && d.z < 0; // التوصيل يقلب الترتيب؟
    verdict = { best: b.name, second: s.name, confirmStage: c, deliveryStage: d,
      decision: flip ? 'wait_delivery' : c.sure && (!d || d.sure || d.z > 0) ? 'winner' : tie ? 'tie' : 'need_more',
      moreLeadsPerAd: !c.sure && !tie ? Math.max(0, leadsNeed - Math.min(b.leads, s.leads)) : 0 };
  } else if (ready.length === 1 && rows.filter(r => r.status === 'learning').length === 0) verdict = { best: ready[0].name, decision: 'only_one' };

  const out = { rules: { minLeads, ceilingDzd: ceiling ? Math.round(ceiling) : null, rate }, ads: rows.sort((a, b) => b.leads - a.leads), verdict, actions: [] };
  out.actions = actionsOf(out);
  out.text = toText(out);
  return out;
}

function actionsOf(T) {
  const A = [], push = (lvl, code, msg, ad) => A.push({ lvl, code, msg, ad });
  T.ads.forEach(a => {
    if (a.status === 'dead') push('stop', 'ad_dead', `⛔ «${a.name}»: صرف ${fmt(a.spendDzd)} دج بلا حتى ليد — وقّفو.`, a.name);
    if (a.status === 'early_kill') push('stop', 'ad_early_kill', `⛔ «${a.name}»: بعد ${a.leads} ليد، الليد ${fmt(a.cplDzd)} دج فوق السقف (${fmt(a.ceilingDzd)}) بـ ${Math.round((a.cplDzd / a.ceilingDzd - 1) * 100)}% — وقّفو بكري.`, a.name);
    if (a.status === 'over_ceiling') push('stop', 'ad_over_ceiling', `⛔ «${a.name}»: ${a.leads} ليد والليد ${fmt(a.cplDzd)} دج فوق السقف (${fmt(a.ceilingDzd)}) — خاسر، وقّفو.`, a.name);
    if (a.status === 'starved') push('warn', 'ad_starved', `⚠️ «${a.name}»: في حملة CBO أخذ ${a.starvedShare}% برك من الميزانية (${a.leads} ليد) — ميتا ما عطاتوش فرصة، ما نحكموش عليه. التاست يكون ABO: كل زاوية في مجموعة إعلانية وحدها بنفس الميزانية.`, a.name);
    if (a.status === 'learning') push('info', 'ad_learning', `⏳ «${a.name}»: ${a.leads}/${T.rules.minLeads} ليد — ناقص ${a.leadsLeft} (~${fmt(a.budgetLeftDzd)} دج). ما تبدّل والو حتى يكمّل.`, a.name);
  });
  const v = T.verdict;
  if (v) {
    if (v.decision === 'winner') push('lever', 'ad_winner', `🏆 الفائز: «${v.best}» — المؤكّدة أرخص بـ ${v.confirmStage.gapPct}% من «${v.second}» والأرقام كافية (ثقة 90%)${v.deliveryStage ? (v.deliveryStage.sure ? '، والتوصيل يأكّد' : '، والتوصيل ما يقلبش الترتيب') : ' — التوصيل مازال ما تقاسش، تابعو'}. حوّل الميزانية ليه.`);
    if (v.decision === 'need_more') push('info', 'ad_need_more', `⚖️ «${v.best}» قدّام بـ ${v.confirmStage.gapPct}% بصح ما زالش كافي باش نقرّرو — زيد ~${v.moreLeadsPerAd} ليد لكل واحد.`);
    if (v.decision === 'tie') push('info', 'ad_tie', `🤝 «${v.best}» و«${v.second}» كيف كيف (فرق ${v.confirmStage.gapPct}% = ضجيج). ما تحرقش الأدس باش تفرّقهم: خلّي الزوج، والتاست الجاي زاوية جديدة.`);
    if (v.decision === 'wait_delivery') push('warn', 'ad_wait_delivery', `🔄 «${v.best}» أرخص في التأكيد بصح «${v.second}» أحسن في التوصيل — استنى التوصيل قبل ما تقرّر.`);
  }
  return A;
}

function toText(T) {
  const st = { ready: '✅ جاهز', learning: '⏳ يتعلّم', starved: '⚠️ ما تعطاش فرصة', dead: '⛔ ميّت', early_kill: '⛔ وقف بكري', over_ceiling: '⛔ فوق السقف' };
  const L = [`🧪 تاست الإعلانات (${T.rules.minLeads} ليد لكل إعلان${T.rules.ceilingDzd ? ` • السقف ${fmt(T.rules.ceilingDzd)} دج` : ''})`];
  T.ads.forEach(a => L.push(`  ${st[a.status]} «${a.name}»: ${a.leads} ليد • الليد ${a.cplDzd ? fmt(a.cplDzd) + ' دج' : '—'} • تأكيد ${a.confPct ?? '—'}% • المؤكّدة ${a.costPerConfirmedDzd ? fmt(a.costPerConfirmedDzd) + ' دج' : '—'}${a.delPct != null ? ` • توصيل ${a.delPct}% • الموصلة ${fmt(a.costPerDeliveredDzd)} دج` : ''}`));
  L.push('');
  T.actions.filter(x => x.code !== 'ad_learning').forEach(x => L.push('  ' + x.msg));
  return L.join('\n');
}

const api = { testAds, RULES, collect };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.BoussalaTestAds = api;
