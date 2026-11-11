/*!
 * بوصلة التاجر — أول ربط (الكوتش): يدخل يشوف وحدو، ومن بعد يسقسي غير الأساسيات
 * al-KHALiYA © 2026
 * التسلسل:
 *   1. يقرا تسيير (قراءة برك) ← الأرقام الحقيقية + المرحلة اللي فيها التاجر
 *   2. يلقى النقائص وحدو (بلا ما يسقسي)
 *   3. يسقسي غير واش ما يقدرش يشوفو — سؤال واحد في المرة، مع «علاش نسقسي»
 *   4. كي تكمل الأجوبة ← المانيت (المستوى 0) + الواجبات + الباب (هدف / رأس مال / راني بديت)
 */
'use strict';
const req = n => require('./' + n);
const E = req('boussala-engine.js');
const { manette } = req('manette.js');
const CF = req('confirmation.js');
const { track } = req('livraison.js');
const { testAds } = req('testads.js');
const D = req('doors.js');
const cplOr = f => (f.cplUsd || 2) * 255;
const TR = req('triage.js');
const PF = req('profile.js');
const EVT = req('events.js');
let TM; try { TM = require('../adapters/tassyir-map.js'); } catch (e) { TM = null; }
const m = x => E.mil(x) || E.fmt(x) + ' دج';
const fmt = n => Math.round(n).toLocaleString('en-US');
const dayMs = 864e5;

// ❓ الأساسيات: كل سؤال يتسقسى غير لو الجواب ماشي باين في تسيير
const QUESTIONS = {
  goal: { q: 'واش هو الهدف؟ شحال تحب تربح **كاش** (والستوك خالص)، وفي شحال من يوم؟ — ولا ما عندكش هدف وتحب تبدا من رأس المال؟',
    why: 'بلا وجهة، الأرقام ما عندهاش معنى: نفس 100 طلبية تقدر تكون ربح ولا خسارة.', example: '«100 مليون في 60 يوم» ولا «ما عنديش هدف»' },
  scope: { q: 'لقيت طلبيات على {n} منتجات: {list}. **أنهي منتجات ندخلوهم في المسار؟** الباقي نحّوهم من الحساب.',
    why: 'كل منتج ميّت ولا تاع مشروع آخر يخلط الأرقام (العمولة، التأكيد، الربح).', example: '«PROTREK برك» ولا «الكل»' },
  capital: { q: 'شحال عندك **كاش حر** دركا تقدر تحطو في البيزنس؟ (ماشي السلعة اللي عندك، ماشي اللي عند شركة التوصيل)',
    why: 'رأس المال يقرر شحال من منتج تتاستي، وشحال تطلب من الورشة، ووين يطيح أصعب نهار.', example: '«30 مليون» ولا «300000»' },
  supply: { q: 'السلعة: **ورشة** (عربون + الباقي كي تستلم) ولا **جملة جاهزة**؟',
    why: 'الورشة بالطلب المسبق تنقّص رأس المال بزاف. الجملة تبيعلك السيري كاملة وتزيد فائض المقاسات.', example: '«ورشة» ولا «جملة»' },
  supplyDetails: { q: '{type}: {detail}',
    why: 'العربون والأجل يقرّرو أصعب نهار في الكاش، والكمية الدنيا تقرّر أول دفعة.', example: '«30%، 5 أيام، 50 قطعة» ولا «نعم»' },
  carrierOffer: { q: 'عرضك مع شركة التوصيل: **الروتور** بلاش ولا تخلّصو (شحال)؟ و**السحب** كل شحال تقدر تطلبو؟',
    why: 'تسيير يحسب روتور {ret} دج بصح المعاملات تقول 0. والكاش عند شركة التوصيل ما رجعش من {days} يوم — السحب هو أكبر رافعة على رأس المال.', example: '«الروتور 0، السحب كل 3 أيام»' },
  packaging: { q: 'التغليف = 0 في حسابك: **نسيتو**، ولا السلعة تجيك **مغلّفة**؟ لو كاين، شحال على كل طلبية؟',
    why: 'كل دينار تغليف ما تحسبش يبان ربح وهو ماشي.', example: '«80 دج» ولا «0» (مغلّفة / بلاش)' },
  buyPrice: { q: 'شحال تكلّفك القطعة في: {list}؟ (ولا قول «نحّيه» لو ماعادش تخدم بيه)',
    why: 'تسيير يحسبهم بلاش — الربح المعروض منفوخ.', example: '«Robe Maxi 2200» ولا «نحّيهم»' },
  wallets: { q: 'المحافظ ما تبانش في الربط. ابعثلي **تصويرة** لصفحة Finance ← Wallets، ولا قولي أسماء المحافظ ورصيد كل وحدة.',
    why: 'المانيت تبدا بالمحافظ: سلعة / أدس / احتياط / هدف. بلاهم الكاش يتخلط.', example: '«PAIEMENTS 30 مليون، MARCHANDISE 7.7، ADS سالبة»' },
  adoptGoal: { q: 'بلا هدف، البوصلة تقترحلك **وجهة**: {suggest} في {days} يوم (هذا واش يوصلو رأس مالك بأرقامك). **نخدمو عليها؟** (نعم / رقم آخر / مدة أخرى)',
    why: 'بلا وجهة ما نقدروش نقولو «راك قريب ولا بعيد» ولا نحكمو على قرار. الوجهة المقترحة مبنية على الكاش والأرقام تاعك، ماشي على حلم.', example: '«نعم» ولا «30 مليون» ولا «60 يوم»' },
  agentsHow: { q: 'شفت «{agent}» يدير {share}% من الأفعال في حسابك ({roles}). **وين يخدم، وكيفاش يتعلّم** (يبدّل القواعد وحدو ولا نتا تبدّلها)؟ ووين يبلّغك (تلقرام، إيميل)؟',
    why: 'باش البوصلة **تغذّي** وكلاءك بالأحداث والقرارات (ماشي تعاود خدمتهم)، وتبلّغ على أخطائهم في نفس البلاصة.', example: '«سيرفر n8n + Claude، القواعد في Google Sheet، يبلّغ في تلقرام»' },
  costs: { q: 'لقيت {n} منتجات جاهزين في متجرك: {list}. **شحال تكلّفك القطعة في كل واحد؟** (بالترتيب، ولا «نحّيه» على اللي ما راكش داخل فيه)',
    why: 'نرتّبوهم بالربح وهامش الأمان، ونقولك بأنهي تبدا التاست بالكاش اللي عندك.', example: '«2200، 2800، 3500، 1400» ولا «روب 2200، عباية نحّيها»' },
  carrierOffer2: { q: 'عرضك مع **{carrier}**: الروتور بلاش ولا شحال؟ والسحب كل شحال؟',
    why: 'الروتور يدخل في سقف الليد، والسحب يقرر شحال يبقى كاشك محبوس.', example: '«الروتور 200، السحب كل جمعة»' },
  product: { q: 'المنتج اللي حاب تتاستيه: **الاسم، سعر البيع، وشحال يكلّفك**؟ (كل منتج في سطر)',
    why: 'المسار، سقف الليد، ورأس المال كامل يبداو من الفرق بين سعر البيع والتكلفة.', example: '«روب كاجوال 5900 2200»' },
  carrierNew: { q: 'أنهي **شركة توصيل** راح تخدم معاها؟ والعرض تاعها: **الروتور** بلاش ولا شحال، و**السحب** كل شحال؟',
    why: 'الروتور يدخل في سقف الليد، والسحب يقرر شحال يبقى كاشك محبوس.', example: '«Yalidine، الروتور 200، السحب كل جمعة»' },
  packagingNew: { q: 'شحال يكلّفك **التغليف** على كل طلبية؟ (0 لو السلعة تجي مغلّفة)',
    why: 'كل دينار تغليف ما تحسبش يبان ربح وهو ماشي.', example: '«60 دج» ولا «0»' },
  adsNew: { q: 'عندك **حساب إعلانات** (Meta ولا TikTok) جاهز؟ أنهي واحد راح تخدم بيه؟',
    why: 'التاست يتقاس من تسيير غير كي الحساب مربوط ومثبّت على محفظة الأدس.', example: '«Meta، حساب واحد» ولا «مازال»' },
  adAccounts: { q: 'تسيير يحسب غير حساب الأدس «{linked}». شوف Finance ← Report ← «Missing from this profit»: **أنهي حسابات تبيع هذا البيزنس صح دركا؟** (ابعثلي تصويرة لو تحب)',
    why: 'الحساب اللي ماشي محسوب، مصروفو يبقى برا الربح وبرا محفظة الأدس. والحسابات تاع مشاريع أخرى ما يدخلوش هنا.', example: '«designo برك» ولا «designo و DECO | 01»' },
};


// 🗣️ يفهم الجواب كيما يكتبو التاجر (دارجة / فرنسية / أرقام) ← answers
const WORDS = { 'واحد': 1, 'وحدة': 1, 'زوج': 2, 'جوج': 2, 'يومين': 2, 'ثلاث': 3, 'ثلاثة': 3, 'تلت': 3, 'اربع': 4, 'أربع': 4, 'خمس': 5, 'خمسة': 5, 'ست': 6, 'سبع': 7, 'جمعة': 7, 'سمانة': 7, 'semaine': 7, 'عشر': 10, 'نهار': 1, 'كل يوم': 1 };
const norm = t => String(t || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[‎‏]/g, '').trim();
const yes = t => /^(نعم|اي|إي|ايه|إيه|اوك|أوك|ok|oui|yes|صح|مليح|هكا)(?=$|[\s.!،,])/i.test(norm(t));
function money(t) {
  const x = norm(t).replace(/,/g, '').replace(/\s+/g, ' ');
  const mm = x.match(/(\d+(?:\.\d+)?)\s*(m|M|مليون|ملاين|million)/); if (mm) return Math.round(+mm[1] * 10000);
  const md = x.match(/(\d+(?:\.\d+)?)\s*(دج|da|dzd|dinars?)/i); if (md) return Math.round(+md[1]);
  const n = x.match(/\d+(?:\.\d+)?/); if (!n) return null;
  const v = +n[0]; return v >= 10000 ? Math.round(v) : v >= 1 && v < 10000 && /مليون|M\b/.test(x) ? v * 10000 : v >= 1000 ? v : Math.round(v * 10000);
}
function days(t) { const x = norm(t); const d = x.match(/(\d+)\s*(j|jr|jrs|jours?|يوم|ايام|أيام|ايم|نهار)/i); if (d) return +d[1]; const w = Object.keys(WORDS).find(k => x.includes(k)); return w ? WORDS[w] : null; }
function pct(t) { const m = norm(t).match(/(\d+)\s*%/); return m ? +m[1] : null; }

function parseAnswer(id, text, ctx = {}) {
  const t = norm(text), out = {};
  if (id === 'goal') { if (/قدر المستطاع|أقصى|اقصى|اكثر ما يمكن|أكثر ما يمكن|نزيد|max|maxim/i.test(t)) out.goalMax = true; else if (/ما عنديش|ماعنديش|بلا هدف|no goal|pas d/i.test(t)) out.noGoal = true; else { const v = money(t.split(/\s(?:en|في|ف)\s/i)[0] || t), d = days(t); if (v) out.goal = { targetDzd: v, days: d || null }; } }
  if (id === 'scope') { if (/الكل|كامل|tout|all/i.test(t)) out.scope = ctx.products || []; else out.scope = t.split(/[،,+و]| et /).map(x => x.replace(/برك|فقط|seulement/g, '').trim()).filter(Boolean); }
  if (id === 'product') { out.products = t.split(/\n/).map(l => { const nums = (l.match(/\d[\d.,]*/g) || []).map(x => +x.replace(/,/g, '')); const name = l.replace(/\d[\d.,]*\s*(دج|da)?/gi, '').replace(/[:،,]/g, ' ').trim(); return nums.length >= 2 ? { name: name || 'منتج', sell: Math.max(nums[0], nums[1]), buy: Math.min(nums[0], nums[1]) } : null; }).filter(Boolean); }
  if (id === 'adoptGoal') { const d = days(t); const v = /مليون|M\b|\d{5,}/.test(t) ? money(t) : null;
    if (yes(t) || (!v && !d)) out.goal = { targetDzd: ctx.suggestDzd, days: ctx.days }; else if (d && !v) out.noGoalDays = d; else out.goal = { targetDzd: v, days: d || ctx.days }; }
  if (id === 'agentsHow') { out.agentsInfo = { text: t, telegram: /تلقرام|telegram/i.test(t), claude: /claude|كلود/i.test(t), n8n: /n8n|make|zapier/i.test(t), sheet: /sheet|شيت/i.test(t), selfLearning: /وحدو|auto|تلقائي/i.test(t) }; }
  if (id === 'costs') { const names = ctx.candidates || []; out.costs = {}; out.exclude = [];
    const lines = t.split(/\n|،|,|؛/).map(x => x.trim()).filter(Boolean);
    const named = names.filter(n => t.includes(n) || t.includes(n.split(' ')[0]));
    if (named.length) lines.forEach(l => { const n = names.find(n => l.includes(n) || l.includes(n.split(' ')[0])); if (!n) return; if (/نح(ّ)?ي|ماعادش|بلاش منو/.test(l)) out.exclude.push(n); else { const v = l.match(/\d[\d.,]*/); if (v) out.costs[n] = +v[0].replace(/,/g, ''); } });
    else { const nums = (t.match(/\d[\d.,]*/g) || []).map(x => +x.replace(/,/g, '')); names.forEach((n, i) => { if (nums[i] > 0) out.costs[n] = nums[i]; }); }
    if (!out.exclude.length) delete out.exclude; }
  if (id === 'carrierOffer2') { const r = t.match(/روتور\s*(\d+)|retour\s*(\d+)/i) || t.match(/^(\d+)/); out.returnFee = /بلاش|مجان|gratuit|^0\b/.test(t) ? 0 : r ? +(r[1] || r[2]) : null; const sl = t.split(/،|,|\n/).find(l => /سحب|retrait|versement|كل/i.test(l)); if (sl) { const d = days(sl); if (d) out.payoutEvery = d; } if (out.returnFee == null) delete out.returnFee; }
  if (id === 'carrierNew') { const nm = t.match(/(yalidine|ياليدين|zr ?express|maystro|مايسترو|navex|ecotrack|noest|guepex|dhd|world ?express|[A-Za-z][\w ]{2,20})/i); if (nm) out.carrier = nm[1].trim(); const r = t.match(/روتور\s*(\d+)|retour\s*(\d+)/i); out.returnFee = /روتور\s*(بلاش|مجان)|retour gratuit/i.test(t) ? 0 : r ? +(r[1] || r[2]) : null; const sl = t.split(/،|,|\n/).find(l => /سحب|retrait|versement/i.test(l)); if (sl) { const d = days(sl); if (d) out.payoutEvery = d; } if (out.returnFee == null) delete out.returnFee; }
  if (id === 'packagingNew') { const v = t.match(/\d+/); out.packaging = v && +v[0] > 0 ? { perOrder: +v[0] } : { included: true, perOrder: 0 }; }
  if (id === 'adsNew') { out.ads = /مازال|لا\b|ما عنديش|non/i.test(t) ? { ready: false } : { ready: true, platform: /tiktok|تيك/i.test(t) ? 'tiktok' : 'meta' }; }
  if (id === 'capital') { const v = money(t); if (v != null) out.capitalDzd = v; }
  if (id === 'supply') { out.supply = { type: /جملة|gros|جاهز/i.test(t) ? 'wholesale' : 'workshop' }; const p = pct(t), d = days(t); if (p != null) out.supply.depositPct = p; if (d) out.supply.prepDays = d; }
  if (id === 'supplyDetails') { const prev = ctx.supply || { type: 'workshop' }; const p = pct(t), d = days(t), q = norm(t).match(/(\d+)\s*(قطعة|pi[eè]ces?|pcs)/i);
    if (prev.type === 'wholesale') { out.supply = { ...prev, depositPct: 100, prepDays: d != null ? d : prev.prepDays ?? 2, minBatch: q ? +q[1] : prev.minBatch || null }; return out; }
    out.supply = { ...prev, depositPct: p != null ? p : yes(t) || /عربون/.test(t) ? (prev.depositPct ?? 30) : prev.depositPct ?? null, prepDays: d != null ? d : yes(t) ? 5 : prev.prepDays ?? null, minBatch: q ? +q[1] : prev.minBatch || 50 };
    if (out.supply.depositPct == null) out.supply.depositPct = 30; if (out.supply.prepDays == null) out.supply.prepDays = 5; out._assumed = p == null ? ['depositPct=30'] : []; }
  if (id === 'carrierOffer') { const lines = t.split(/\n|،|,|و(?=\s*(?:سحب|السحب))/); const r = lines.find(l => /روتور|retour/i.test(l)) || lines[0];
    const rv = /بلاش|مجان|gratuit|free/.test(r) ? 0 : (r.match(/\d+/) ? +r.match(/\d+/)[0] : null); if (rv != null) out.returnFee = rv;
    const sl = lines.find(l => /سحب|retrait|versement|كل/i.test(l)); if (sl) { const d = days(sl); if (d) out.payoutEvery = d; } }
  if (id === 'packaging') { if (/مغلّف|مغلف|incl|بلاش|^0$/.test(t)) out.packaging = { included: true, perOrder: 0 }; else { const v = t.match(/\d+/); out.packaging = { perOrder: v ? +v[0] : 0 }; } }
  if (id === 'buyPrice') { if (/نح(ّ)?ي|نحيهم|ماعادش|supprim|retir/i.test(t)) out.exclude = ctx.missingBuy || []; else { out.buyPrices = {}; (ctx.missingBuy || []).forEach(n => { const m = t.match(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[:=]?\\s*(\\d+)')); if (m) out.buyPrices[n] = +m[1]; }); } }
  if (id === 'wallets') { if (yes(t) && ctx.knownWallets) out.wallets = ctx.knownWallets;
    else if (/ما عنديش|ماكاش|حتى وحدة|aucun|no/i.test(t)) out.wallets = [];
    else { const W = []; t.split(/\n|،|,|؛/).forEach(l => { const m = l.trim().match(/^([A-Za-zÀ-ÿ\u0600-\u06FF][\wÀ-ÿ\u0600-\u06FF '\-]*?)\s*[:=]?\s*(-?\d[\d.,]*\s*(?:مليون|M\b|دج|\$)?|سالب[ةه]?)\s*$/i); if (!m) return;
      const v = /سالب/.test(m[2]) ? -1 : /\$/.test(m[2]) ? +m[2].replace(/[^\d.-]/g, '') : money(m[2]) ?? 0; W.push({ name: m[1].trim(), balance: /^0\s*$/.test(m[2]) ? 0 : v, currency: /\$/.test(m[2]) ? 'USD' : 'DZD' }); }); if (W.length) out.wallets = W; } }
  if (id === 'adAccounts') { const all = [...(ctx.linked || []), ...(ctx.unlinked || [])]; if (/الكل|كامل|tout|all/i.test(t)) out.adAccounts = { active: all, unlinked: ctx.unlinked || [] };
    else { const act = all.filter(a => t.toLowerCase().includes(a.toLowerCase())); out.adAccounts = { active: act.length ? act : t.split(/[،,]| و /).map(x => x.replace(/برك/g, '').trim()).filter(Boolean), unlinked: (ctx.unlinked || []).filter(a => act.includes(a)) }; } }
  return out;
}

const P = (o, k) => k.split('.').reduce((a, x) => (a == null ? a : a[x]), o);

/**
 * onboard({ scan: { whoami, stores, deliveryAgents, financeSummary, financeTx, expenses, employees, customStatuses, overview, inventory, variantAnalytics, marketing, orders, tracking }, answers: {...}, today })
 *   answers: exclude[productName] (منتجات ماعادش يخدم بيها), goal{targetDzd,days}|noGoal, capitalDzd, supply{type:'workshop'|'wholesale',depositPct,prepDays}, returnFee, payoutEvery, packaging{included|perOrder}, buyPrices{name:dzd}, wallets[{name,balance,currency}], adAccounts{active[],unlinked[]}
 */
function onboard(o) {
  if (o.reply && o.reply.id && !o._parsed) { const r0 = onboard({ ...o, reply: null, _parsed: true }); const patch = parseAnswer(o.reply.id, o.reply.text, r0.ctx); delete patch._assumed; return onboard({ ...o, reply: null, _parsed: true, answers: { ...(o.answers || {}), ...patch } }); }
  const S = o.scan || {}, A = { ...(o.answers || {}) }, today = o.today || S.today || new Date().toISOString().slice(0, 10);
  const V = ((S.variantAnalytics && S.variantAnalytics.data) || []);
  const A0 = o.answers || {};
  const ex = new Set(A0.exclude || []);
  if (A0.scope && A0.scope.length) V.filter(v => v.totalOrders > 0).forEach(v => { const n = (v.product && v.product.name) || ''; if (!A0.scope.some(k => n.toLowerCase().includes(String(k).toLowerCase()))) ex.add(n); });
  const sold = V.filter(v => v.totalOrders > 0 && !ex.has((v.product && v.product.name) || ''));
  const settings = TM ? TM.settingsFromTassyir({ variantAnalytics: S.variantAnalytics, financeTx: S.financeTx, marketing: S.marketing, overview: S.overview && { confirmation: S.overview.confirmation, delivery: S.overview.delivery, abandonedCheckouts: S.overview.abandonedCheckouts, orders: S.overview.orders } }) : {};
  const rate = A.rate || 255;

  // 📊 الأرقام الحقيقية
  const top = sold.slice().sort((a, b) => b.totalOrders - a.totalOrders)[0];
  const newProducts = (A.products || []);
  const found = {
    business: P(S, 'whoami.business'), stores: (S.stores || []).length, carriers: (S.deliveryAgents || []).filter(d => d.status === 'active').map(d => d.name),
    team: (S.employees || []).filter(e => !(e.roles || []).includes('Owner')).map(e => e.name),
    orders30: P(S, 'overview.orders.count'), confPct: settings.conf ?? P(S, 'overview.confirmation.confirmationRatePct'), delPct: settings.del ?? P(S, 'overview.delivery.deliveryRatePct'),
    cplUsd: settings.leadUsd, delCost: settings.delCost, retCostConfigured: settings.retCost, commission: sold.length ? Math.round(sold.reduce((s, v) => s + (v.averageCommissionPerOrder || 0), 0) / sold.length) : null,
    payoutEvery: settings.payoutEvery, topProduct: top && { name: (top.product && top.product.name) || '', price: top.variant_price || P(top, 'variant.price') || null, buy: top.buyPrice },
    abandonPct: settings.abandon,
  };

  // 📍 المرحلة: جديد / التاست / خدّام / الأدس واقفة
  const now = new Date(today);
  const recent7 = (S.orders || []).filter(x => (now - new Date(x.createdAt)) / dayMs <= 7).length;
  const phase = !sold.length ? 'new' : (found.orders30 > 20 && recent7 <= 2) ? 'paused' : (found.orders30 || 0) < 100 ? 'test' : 'running';
  const phaseTxt = { new: 'ما بديتش (حتى طلبية) ← نبداو بالمسار قبل التاست', test: 'في التاست (أقل من 100 طلبية في 30 يوم)', running: 'خدّام (حملات شاعلة)', paused: `الأدس قريب واقفة: ${recent7} طلبية في آخر 7 أيام مقابل ${found.orders30} في 30 يوم` }[phase];

  // 🔎 النقائص اللي نشوفها وحدي (بلا سؤال)
  const F = [], add = (lvl, title, fix, where) => F.push({ lvl, title, fix, where });
  (S.stores || []).forEach(st => {
    const px = st.facebookPixelId;
    if (px && !/^\d{10,20}$/.test(String(px))) add('stop', `${st.name}: خانة بيكسل ميتا فيها حاجة ماشي رقم بيكسل`, 'حط رقم البيكسل (أرقام برك) — حتى حدث ما يوصل لميتا وهي هكا.', 'Settings ← Pixels & Tracking ← Meta');
  });
  const carriersOn = (S.deliveryAgents || []).filter(d => d.status === 'active');
  const listed = (S.products || []);
  const candidates = listed.filter(x => x.isActive !== false && +x.price > 0 && !ex.has(x.name));
  listed.filter(x => x.isActive !== false && !(+x.price > 0)).forEach(x => add('warn', `«${x.name}»: السعر 0 في المتجر`, 'حط سعر البيع قبل ما تطلق عليه — ولا نحّيه من القائمة.', 'Products'));
  const inactive = listed.filter(x => x.isActive === false); if (inactive.length) add('info', `${inactive.map(x => x.name).join('، ')}: ماشي مفعّل — ما يدخلش في المسار`, 'لو حاب تتاستيه فعّلو.', 'Products');
  if (!carriersOn.length) add('stop', 'حتى شركة توصيل مربوطة — ما تقدرش تبعث حتى طرد', 'اربط شركة التوصيل (المفاتيح تاعها) وحطها افتراضية للمتجر.', 'Delivery & Shipping ← Add Delivery Agent');
  const metaOn = P(S, 'marketing.providers.facebook.connected') ?? P(S, 'marketing.facebookAdsConnected');
  if (metaOn === false) add('stop', 'Meta ماشي مربوط بتسيير — الإعلانات ما يتقاسوش', 'Apps ← Meta ← Connect.', 'Apps ← Meta');
  const nProducts = new Set(V.map(v => (v.product && v.product.name) || '')).size || candidates.length;
  if (!nProducts) add('warn', 'حتى منتج في المتجر', 'نبنيو المسار على المنتج اللي حاب تتاستيه، ومن بعد تخلقو في تسيير بالسعر وثمن الشراء.', 'Products ← Create Product');
  if (!(S.employees || []).some(e => !(e.roles || []).includes('Owner'))) add('info', 'ما كاين حتى مؤكّد — راك تأكّد وحدك', 'مليح في التاست. كي توصل ~30 طلبية في النهار وظّف مؤكّد بعمولة.', 'Team');
  if (!(S.customStatuses || []).length && sold.length === 0) add('info', 'حتى حالة مكالمات (APPEL 01→03)', 'زيد سلّم المكالمات + أسباب الإلغاء قبل أول طلبية — باش نقيسو علاش ما يتأكّدوش من النهار الأول.', 'Settings ← Status customization');
  const noPx = (S.stores || []).filter(st => !st.facebookPixelId && !st.tiktokPixelId);
  if (noPx.length) add('warn', `${noPx.length === 1 ? 'متجر' : noPx.length + ' متاجر'} بلا بيكسل: ${noPx.map(s => s.name).join('، ')}`, 'قبل أي حملة على هذا المتجر: البيكسل + CAPI. حملة بلا بيكسل = ميتا تخدم بالعمى.', 'Settings ← Pixels & Tracking');
  const noCarrier = (S.stores || []).filter(st => !st.deliveryAgentId);
  if (noCarrier.length && (S.deliveryAgents || []).length) add('info', `${noCarrier.length} متاجر بلا شركة توصيل افتراضية`, 'حدّد شركة التوصيل لكل متجر يبيع.', 'Delivery & Shipping');
  const treeSpend = (n => { let t = 0; const w = x => { if (x.level === 'content' && x.ads) t += x.ads.spend || 0; (x.children || []).forEach(w); }; (n || []).forEach(w); return t; })(P(S, 'marketing.tree'));
  const adsMkt = P(S, 'marketing.totals.ads.spend') || treeSpend, adsFin = P(S, 'financeSummary.adsSpend.value') || 0;
  if (adsMkt > 0 && adsFin === 0) add('stop', 'الأدس ما تدخلش في المالية (الربح يبان أكبر)', 'اربط حسابات الأدس بمحفظة ADS — «Ad spend deductions».', 'Finance ← Wallets');
  if (!(S.expenses || []).length) add('warn', 'حتى مصروف ما تسجّل (كرا، خلصات، اشتراكات، الباقي للورشة)', 'سجّلهم في Costs باش «What\'s coming» ينبّهك.', 'Finance ← Costs ← Add expense');
  const clothing = sold.some(v => /robe|طقم|بنطلون|عباي|drap|jupe|ملاب|قميص/i.test((v.product && v.product.name) || ''));
  (S.deliveryAgents || []).filter(d => d.allowParcelOpening === false).forEach(d => clothing && add('lever', `${d.name}: الزبون ما يقدرش يحلّ الطرد`, 'في الملابس، «يحب يشوف/يقيس» سبب رفض كبير. جرّب تسمح بفتح الطرد على منتج واحد وقارن الروتور — ماشي مضمون، قيسو.', 'Delivery & Shipping ← شركة التوصيل'));
  const busy = (S.employees || []).filter(e => e.openOrders >= 10);
  if (busy.length) add('warn', `${busy.map(e => `${e.name}: ${e.openOrders} طلبية مفتوحة`).join('، ')}`, 'طلبيات مفتوحة بزاف عند واحد = تبرد. وزّع (Evenly) وشعّل الدوران 30 دقيقة.', 'Team ← Order distribution');

  // 📞 التأكيد + 🚚 التوصيل + 🧪 الأدس (لو المعطيات كاينة)
  const conf = (S.orders || []).length ? CF.watch({ orders: S.orders, now: today + 'T20:00:00Z' }) : null;
  if (conf) conf.actions.filter(a => a.lvl !== 'info').forEach(a => add(a.lvl === 'ask' ? 'warn' : a.lvl, a.msg.replace(/^(\p{Extended_Pictographic}️?\s*)+/u, ''), '', 'Orders'));
  const deliv = (S.tracking || []).length ? track({ parcels: S.tracking, today }) : null;
  if (deliv) deliv.actions.filter(a => ['unpaid', 'stuck'].includes(a.code)).forEach(a => add(a.lvl, a.msg.replace(/^(\p{Extended_Pictographic}️?\s*)+/u, ''), '', 'Tracking'));
  let ads = null;
  if (S.marketing && S.marketing.tree && found.topProduct && found.topProduct.price && found.topProduct.buy) {
    ads = testAds({ marketing: S.marketing, rate, product: { name: found.topProduct.name, sell: found.topProduct.price, buy: found.topProduct.buy, conf: found.confPct || 50, del: found.delPct || 50 },
      settings: { rate, delCost: found.delCost || 0, retCost: A.returnFee != null ? A.returnFee : (found.retCostConfigured || 0), pack: (found.commission || 0) + ((A.packaging && A.packaging.perOrder) || 0) } });
    ads.actions.filter(a => ['stop', 'warn', 'lever'].includes(a.lvl) || a.code === 'ad_tie').slice(0, 2).forEach(a => add(a.lvl === 'stop' ? 'stop' : a.lvl === 'warn' ? 'warn' : 'lever', a.msg.replace(/^(\p{Extended_Pictographic}️?\s*)+/u, ''), '', 'Analytics ← Marketing'));
  }

  // 🚑 حساب خدّام وينزف: الإنقاذ قبل الأسئلة
  let tri = null;
  if ((sold.length || S.home) && (phase === 'running' || phase === 'paused' || phase === 'test' || S.home)) {
    const tp = found.topProduct || {};
    found.netPerDelivered = tp.price ? tp.price - (tp.buy || 0) - (found.delCost || 0) - (found.commission || 0) : null;
    try { tri = TR.triage({ found: { ...found, cplUsd: found.cplUsd || (ads && ads.ads.length ? ads.ads.reduce((x, a) => x + a.spendUsd, 0) / Math.max(1, ads.ads.reduce((x, a) => x + a.leads, 0)) : 0), retCost: found.retCostConfigured },
      conf, deliv, ads, home: S.home, stock: S.stock, returnsToProcess: S.returnsToProcess, variants: sold, employees: S.employees, customStatuses: S.customStatuses, financeSummary: S.financeSummary, rate, adsDays: 30 }); } catch (e) { tri = null; }
  }
  if (found.cplUsd == null && ads) { const sp = ads.ads.reduce((x, a) => x + a.spendUsd, 0), ld = ads.ads.reduce((x, a) => x + a.leads, 0); if (ld) found.cplUsd = +(sp / ld).toFixed(2); }
  if (A.adAccounts && (A.adAccounts.active || []).length > 1) add('warn', `${A.adAccounts.active.length} حسابات أدس شاعلين — تسيير يحسب حساب واحد مثبّت لكل منصة`, 'خلّي الحساب الرئيسي مربوط، والمصروف تاع الباقي سجّلو بيدك في Costs ← Ad spend (ولا جمّع الحملات في حسابات أقل). ونطلبو من فريق تسيير الربط المتعدد.', 'Finance ← Costs ← Ad spend');
  if (A.payoutEvery && found.payoutEvery && found.payoutEvery >= A.payoutEvery * 2) add('warn', `العرض: السحب كل ${A.payoutEvery} أيام — الواقع في تسيير: كل ~${found.payoutEvery} يوم`, 'اطلب السحب في وقتو وسجّلو نهار يدخل. هذا الفرق كاش محبوس عند شركة التوصيل.', 'Home ← Needs you ← Record collection');
  // ❓ الأسئلة: غير اللي ما نشوفوش
  const Q = [];
  const ask = (id, vars = {}) => { const t = QUESTIONS[id]; Q.push({ id, q: t.q.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''), why: t.why.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''), example: t.example }); };
  // 🧩 سينيور: نكتشفو النظام تاعو، ونستنتجو الأجوبة اللي باينة في نظامو
  const prof = PF.profile(S);
  const senior = prof.score >= 80;
  if (senior) {
    const ws = prof.workshops.filter(w => w.unitCost).sort((a, b) => a.unitCost - b.unitCost);
    if (!A.supply && ws.length) A.supply = { type: 'workshop', depositPct: 30, prepDays: Math.min(...ws.map(w => w.leadDays || 5)), _from: 'المخازن/الورشات' };
    if (!A.wallets && (S.wallets || []).length) A.wallets = S.wallets;
    const po = (S.expenses || []).find(e => /PER_ORDER/i.test(e.expenseType || '') && /emball|تغليف|pack/i.test(e.name || '')); if (!A.packaging && po) A.packaging = { perOrder: po.amount };
    if (A.returnFee == null && !(settings._flags || []).includes('return_fee_conflict') && found.retCostConfigured != null) A.returnFee = found.retCostConfigured;
    if (A.payoutEvery == null && found.payoutEvery && found.payoutEvery <= 3) A.payoutEvery = found.payoutEvery;
    if (!A.adAccounts && P(S, 'financeSummary.adsSpend.value') > 0) A.adAccounts = { active: (P(S, 'marketing.providers.facebook.accounts') || []).map(x => x.name), unlinked: [] };
    if (!A.scope && !A.exclude) A.scope = [...new Set(sold.map(v => v.product && v.product.name))];
    if (A.capitalDzd == null && (S.wallets || []).length) A.capitalDzd = (S.wallets || []).filter(w => !/OBJECTIF|RÉSERVE|RESERVE/i.test(w.name)).reduce((x, w) => x + (w.currency === 'USD' ? w.balance * rate : w.balance), 0);
  }
  if (!A.goal && !A.noGoal && !A.goalMax) ask('goal');
  if (senior && prof.agents.length && !A.agentsInfo) { const ag = prof.agents[0]; ask('agentsHow', { agent: ag.name, share: ag.share, roles: (ag.roles || []).join('، ') || '—' }); }
  const prods = [...new Set(V.filter(v => v.totalOrders > 0).map(v => (v.product && v.product.name) || ''))];
  if (prods.length > 1 && !A.scope && !A.exclude) ask('scope', { n: prods.length, list: prods.slice(0, 8).join('، ') });
  const isNew = !sold.length;
  if (isNew && candidates.length) { if (!A.costs && !A.products) ask('costs', { n: candidates.length, list: candidates.map(x => `${x.name} (${fmt(x.price)} دج)`).join('، ') }); }
  else if (isNew && !A.products) ask('product');
  if (A.capitalDzd == null) ask('capital');
  if (!A.supply) ask('supply');
  else if (A.supply.depositPct == null || A.supply.prepDays == null) ask('supplyDetails', A.supply.type === 'wholesale' ? { type: 'الجملة', detail: 'تخلّص كامل كي تشري؟ في شحال من يوم تجيك السلعة، وتشري السيري كاملة (كل المقاسات/الألوان)؟ (لو ما تعرفش: نبداو بيومين والسيري كاملة)' } : { type: 'الورشة', detail: 'شحال **العربون** (%)، في شحال من يوم **توصل الدفعة**، وأقل كمية تقبلها؟ (لو ما تعرفش: نبداو بـ 30%، 5 أيام، 50 قطعة)' });
  const lastCash = (S.financeTx || []).filter(t => t.type === 'IN' && /cashout/i.test(t.description || '')).map(t => new Date(t.createdAt)).sort((a, b) => b - a)[0];
  const daysSince = lastCash ? Math.round((now - lastCash) / dayMs) : null;
  const retConflict = (settings._flags || []).includes('return_fee_conflict');
  if (isNew) { if (A.returnFee == null && !A.carrier) { if (carriersOn.length) ask('carrierOffer2', { carrier: carriersOn[0].name }); else ask('carrierNew'); } } else if (A.returnFee == null || A.payoutEvery == null) if (retConflict || (daysSince != null && daysSince > 7) || A.returnFee == null) ask('carrierOffer', { ret: found.retCostConfigured ?? '—', days: daysSince ?? '—' });
  const noPack = sold.every(v => !(v.packagePrice > 0));
  if (noPack && !A.packaging) ask(isNew ? 'packagingNew' : 'packaging');
  const noBuy = sold.filter(v => !(v.buyPrice > 0) && !(A.buyPrices && A.buyPrices[(v.product && v.product.name) || '']));
  if (noBuy.length) ask('buyPrice', { list: [...new Set(noBuy.map(v => (v.product && v.product.name) || (v.variant && v.variant.name)))].slice(0, 6).join('، ') });
  if (!A.wallets && (!isNew || metaOn)) ask('wallets');
  if (isNew) { if (!A.adAccounts && !A.ads && !metaOn) ask('adsNew'); } else if (!A.adAccounts) ask('adAccounts', { linked: (P(S, 'marketing.providers.facebook.accounts') || []).map(a => a.name).join('، ') || '—' });

  // 🎮 المانيت من القراءة + الأجوبة
  const setup = {
    today,
    wallets: A.wallets || (isNew && !metaOn ? [] : undefined), adAccounts: A.adAccounts ? { linked: A.adAccounts.active || [], unlinked: A.adAccounts.unlinked || [] } : undefined,
    fx: A.fxSince ? { usd: rate, since: A.fxSince } : undefined,
    productsNoBuy: noBuy.length ? new Set(noBuy.map(v => v.product && v.product.name)).size : 0, productsTotal: new Set(sold.map(v => v.product && v.product.name)).size,
    packagingItems: noPack ? 0 : 1, packagingIncluded: A.packaging ? !!A.packaging.included || A.packaging.perOrder > 0 : null,
    fixedCosts: (S.expenses || []).length, hasStaffOrRent: (S.employees || []).length > 1,
    upcomingCosts: (S.expenses || []).filter(x => x.nextDueDate || x.dueDate).length, workshopRemainders: isNew ? 0 : undefined,
    returnFee: { configured: found.retCostConfigured ?? 0, offer: A.returnFee ?? null },
    carrierHeld: deliv ? deliv.kpi.unpaid.amount : undefined, daysSincePayout: daysSince ?? undefined, payoutEvery: A.payoutEvery || 7,
    carrierConnected: carriersOn.length > 0, metaConnected: metaOn !== false, pixelMissing: (S.stores || []).filter(st => !/^\d{10,20}$/.test(String(st.facebookPixelId || ''))).length, pixelAllMissing: (S.stores || []).length > 0 && (S.stores || []).every(st => !/^\d{10,20}$/.test(String(st.facebookPixelId || ''))),
    productsCount: isNew ? candidates.length : nProducts, confirmers: (S.employees || []).filter(e => !(e.roles || []).includes('Owner')).length,
    statuses: { callAttempts: (S.customStatuses || []).filter(s => /APPEL|JOUR/i.test(s.name)).length, closes: !!A.ladderCloses },
    distribution: { receiving: (S.employees || []).filter(e => e.canReceiveOrders && (!(e.roles || []).includes('Owner') || (S.employees || []).length === 1)).length },
    monthlyOrders: found.orders30, phase: phase === 'new' ? undefined : phase === 'test' ? 'test' : undefined,
    goal: A.goal ? { targetDzd: A.goal.targetDzd, cashProfitDzd: A.goal.cashProfitDzd || 0, owedToWorkshopDzd: A.goal.owedToWorkshopDzd || 0 } : undefined,
  };
  Object.keys(setup).forEach(k => setup[k] === undefined && delete setup[k]);
  const MN = manette(setup);

  // 🚪 الباب
  const door = A.goal ? 'goal' : A.noGoal && A.capitalDzd != null ? 'capital' : phase === 'running' || phase === 'paused' ? 'started' : 'goal';
  // 🧭 مدخلات المسار (GUIDE) من القراءة + الأجوبة — الفرضيات تتقال
  const assumed = [];
  const conf0 = found.confPct > 0 ? found.confPct : (assumed.push('تأكيد 50% (السوق، حتى يتقاس)'), 50);
  const del0 = found.delPct > 0 ? found.delPct : (assumed.push('توصيل 55% (السوق، حتى يتقاس)'), 55);
  const lead0 = found.cplUsd || (assumed.push('الليد 2$ (حتى يتقاس في التاست)'), 2);
  const wk = !A.supply || A.supply.type !== 'wholesale';
  const prodIn = isNew ? (A.costs ? candidates.filter(x => A.costs[x.name] > 0).map(x => ({ name: x.name, sell: +x.price, buy: A.costs[x.name] })) : (A.products || []).map(p => ({ name: p.name, sell: p.sell, buy: p.buy })))
    : [...new Map(sold.map(v => [(v.product && v.product.name) || '', { name: (v.product && v.product.name) || '', sell: v.variant_price || P(v, 'variant.price'), buy: v.buyPrice || (A.buyPrices || {})[(v.product && v.product.name) || ''] }])).values()].filter(p => p.sell && p.buy);
  // 🧭 بلا هدف: نقترحو وجهة من رأس المال + الوتيرة الحالية، ونعرّفو «النجاح» بمؤشرات
  let compass = null;
  const baseSettings = { period: (A.noGoalDays || 30), targetMode: 'cash', rate, pack: (found.commission || 0) + ((A.packaging && A.packaging.perOrder) || 0), delCost: found.delCost || 0,
    retCost: A.returnFee != null ? A.returnFee : (found.retCostConfigured || 0), payoutEvery: A.payoutEvery || found.payoutEvery || 7, prepDays: (A.supply && A.supply.prepDays) || 5 };
  const doorProducts = prodIn.map(p => ({ ...p, leadUsd: lead0, conf: conf0, del: del0, ...(wk ? { preorder: true, dep: (A.supply && A.supply.depositPct) || 30 } : { ready: true }) }));
  if (A.noGoal && Q.filter(q => q.id !== 'adoptGoal').length === 0 && doorProducts.length && A.capitalDzd > 0) {
    let reach = null, reach2 = null; try { reach = D.reach({ products: doorProducts, settings: baseSettings, capital: A.capitalDzd }); } catch (e) { reach = null; }
    try { reach2 = D.reach({ products: doorProducts, settings: { ...baseSettings, period: baseSettings.period * 2 }, capital: A.capitalDzd, levers: false }); } catch (e) { reach2 = null; }
    // الوتيرة الحالية (لو خدّام): الطلبيات/يوم × صافي الليد
    let pace = null;
    if (!isNew && found.orders30 > 0) { const ctx = E.makeCtx({ ...baseSettings, target: 1e6 }); const q = E.normProduct(doorProducts[0], ctx); const R = E.calcOneProduct(q, E.sharedOf(ctx), 1e6, ctx);
      const perDay = found.orders30 / 30; pace = { paused: phase === 'paused', perDay: Math.round(perDay * 10) / 10, netPerLead: Math.round(R.netPerLead), profit: Math.round(R.netPerLead * perDay * baseSettings.period), ceilingUsd: +(R.breakevenCPA / rate).toFixed(2) }; }
    const sug = reach && reach.ok ? reach.target : null;
    const lv = reach && reach.ok && reach.guide && reach.guide.levers && (reach.guide.levers.levers || []).slice(0, 2).map(l => ({ lever: l.lever, capitalSavedDzd: l.capitalSaved, daysSaved: l.daysSaved }));
    compass = { days: baseSettings.period, suggestDzd: sug, longer: reach2 && reach2.ok ? { days: baseSettings.period * 2, targetDzd: reach2.target } : null, reachMsg: reach && reach.msg, pace, levers: lv,
      kpis: [
        { k: 'الليد تحت السقف', v: pace ? `أقل من $${pace.ceilingUsd}` : 'من المسار' },
        { k: 'الصافي على كل موصلة', v: 'فوق 0 كل جمعة، بالتغليف والروتور والعمولة' },
        { k: 'التوصيل', v: `${del0}% ولا أكثر` },
        { k: 'الكاش يرجع', v: `كل ${A.payoutEvery || 3} أيام كيما العرض` },
        { k: 'الستوك', v: 'ما يرقدش أكثر من دورتين' } ] };
    if (sug && !A.goal) ask('adoptGoal', { suggest: E.mil(sug) || fmt(sug) + ' دج', days: baseSettings.period });
  }
  const ready = Q.length === 0;
  const guideInput = ready && A.goal && prodIn.length ? {
    settings: { target: A.goal.targetDzd, period: A.goal.days || 30, targetMode: 'cash', rate, pack: (found.commission || 0) + ((A.packaging && A.packaging.perOrder) || 0),
      delCost: found.delCost != null ? found.delCost : (assumed.push('فرق التوصيل 0 (حتى يتقاس)'), 0), retCost: A.returnFee != null ? A.returnFee : (found.retCostConfigured || 0),
      payoutEvery: A.payoutEvery || found.payoutEvery || 7, prepDays: (A.supply && A.supply.prepDays) || 5 },
    products: prodIn.map(p => ({ ...p, leadUsd: lead0, conf: conf0, del: del0, ...(wk ? { preorder: true, dep: (A.supply && A.supply.depositPct) || 30 } : { ready: true }) })),
    myCapital: A.capitalDzd, _assumed: assumed } : null;
  // 📡 الأحداث + 🚀 النمو (سينيور ولا «نزيد قدر المستطاع»)
  let ev = null, grow = null, wsGain = null;
  if (senior || A.goalMax) {
    ev = EVT.events({ scan: S, rate, today });
    const inj = ev.events.filter(e => e.type === 'capital_in').reduce((x, e) => x + e.amount, 0);
    const recent = ev.byProduct; const lpd = recent.length ? recent.reduce((x, b) => x + (b.leadsPerDayRecent || 0), 0) / recent.length : null;
    const gp = [...new Map(sold.map(v => [v.product.name, v])).values()].map(v => { const b = recent.find(x => x.product === v.product.name) || {}; const vs = sold.filter(x => x.product.name === v.product.name); const D0 = vs.reduce((x, y) => x + y.deliveredOrders, 0), R0 = vs.reduce((x, y) => x + y.returnedOrders, 0);
      return { name: v.product.name, sell: v.variant_price, buy: v.buyPrice, leadUsd: (b.cplRecentDzd || cplOr(found)) / rate, conf: b.confRecent || conf0, del: D0 + R0 >= 20 ? Math.round(D0 / (D0 + R0) * 100) : del0, preorder: true, dep: (A.supply && A.supply.depositPct) || 30 }; }).filter(p => p.sell && p.buy);
    const nw = ev.events.find(e => e.type === 'new_workshop');
    if (gp.length && A.capitalDzd > 0) grow = D.growth({ products: gp, currentLeadsPerDay: lpd, settings: { rate, pack: (found.commission || 0) + ((A.packaging && A.packaging.perOrder) || 0), delCost: found.delCost || 0, retCost: A.returnFee || 0, payoutEvery: A.payoutEvery || found.payoutEvery || 7, prepDays: (A.supply && A.supply.prepDays) || 5, targetMode: 'cash' },
      capitalBefore: Math.max(0, A.capitalDzd - inj), capitalAfter: A.capitalDzd });
    if (nw && nw.vs && nw.unitCost < nw.vs.unitCost) { const shippedDay = recent.reduce((x, b) => x + (b.leadsPerDayRecent || 0) * ((b.confRecent || conf0) / 100), 0); wsGain = { perPiece: nw.vs.unitCost - nw.unitCost, monthDzd: Math.round(shippedDay * 30 * (nw.vs.unitCost - nw.unitCost)), workshop: nw.workshop }; }
  }
  let gap = null; if (guideInput && A.capitalDzd > 0) { try { gap = D.gap({ capital: A.capitalDzd, settings: guideInput.settings, products: guideInput.products }); } catch (e) { gap = null; } }
  const next = ready ? (isNew && guideInput ? 'guide_then_setup' : MN.critical ? 'homework' : door === 'goal' ? 'guide' : door === 'capital' ? 'door_capital' : 'door_started') : 'ask';
  const out = { found, phase, phaseTxt, findings: F.sort((a, b) => ({ stop: 0, warn: 1, lever: 2, info: 3 })[a.lvl] - ({ stop: 0, warn: 1, lever: 2, info: 3 })[b.lvl]),
    questions: Q, nextQuestion: Q[0] || null, manette: { score: MN.score, level: MN.level, critical: MN.critical, todo: MN.todo.map(t => ({ id: t.id, critical: t.critical, title: t.title, path: t.path, fix: t.fix })) },
    setup, door, next, settings, answers: A, guideInput, compass, gap, triage: tri, senior, profile: prof, events: ev, growth: grow, workshopGain: wsGain,
    ctx: { suggestDzd: compass && compass.suggestDzd, days: compass && compass.days, candidates: candidates.map(x => x.name), products: [...new Set(V.filter(v => v.totalOrders > 0).map(v => (v.product && v.product.name) || ''))], missingBuy: [...new Set(noBuy.map(v => (v.product && v.product.name) || ''))], supply: A.supply,
      linked: (P(S, 'marketing.providers.facebook.accounts') || []).map(x => x.name), unlinked: S.unlinkedAdAccounts || [], knownWallets: S.wallets || A.walletsSeen || null }, testAds: ads && { verdict: ads.verdict, ads: ads.ads.map(a => ({ name: a.name, status: a.status, leads: a.leads })) } };
  out.text = toText(out);
  return out;
}

function toText(R) {
  const f = R.found, ic = { stop: '🔴', warn: '🟡', lever: '🔑', info: 'ℹ️' };
  const L = ['👋 قبل ما نحسب حتى رقم، دخلت لحسابك وشفت (قراءة برك):', ''];
  if (R.phase === 'new') {
    L.push(`📊 حساب جديد: ما كاين حتى طلبية ولا رقم بعد — نبنيو من الصفر.`);
    L.push(`  • ${f.stores} متجر • شركة التوصيل: ${f.carriers.join('، ') || 'ماشي مربوطة'} • الفريق: ${f.team.join('، ') || 'نتا وحدك'}`);
  } else {
  L.push('📊 أرقامك الحقيقية');
  if (f.orders30 != null) L.push(`  • ${f.orders30} طلبية في 30 يوم • تأكيد ${f.confPct ?? '—'}% • توصيل ${f.delPct ?? '—'}%`);
  L.push(`  • الليد ~$${f.cplUsd ?? '—'} • فرق التوصيل ~${f.delCost ?? '—'} دج • عمولة المؤكّد ${f.commission ?? '—'} دج • الكاش يرجع كل ~${f.payoutEvery ?? '—'} يوم`);
  L.push(`  • ${f.stores === 1 ? 'متجر واحد' : f.stores + ' متاجر'} • شركة التوصيل: ${f.carriers.join('، ') || '—'} • الفريق: ${f.team.join('، ') || '—'}`);
  }
  L.push(`📍 وين راك: ${R.phaseTxt}`);
  L.push('');
  if (R.senior) {
    L.push(PF.profileText(R.profile)); L.push('');
    if (R.events) { L.push(EVT.eventsText(R.events)); L.push(''); }
    if (R.growth) { L.push(R.growth.msg); }
    if (R.workshopGain) L.push(`🧵 ${R.workshopGain.workshop}: −${R.workshopGain.perPiece} دج/قطعة × وتيرتك = ~${E.mil(R.workshopGain.monthDzd)} ربح زايد في الشهر (لو الجودة تعدّي في الدفعة التجريبية).`);
    if (R.events && R.events.events.length) { L.push(''); L.push('🎯 قرار الأسبوع (3):'); R.events.events.slice(0, 3).forEach((e, k) => L.push(`  ${k + 1}. ${e.icon} ${e.title} ← ${e.actions[0]}`)); }
    L.push('');
  }
  else if (R.triage && R.triage.messy) { L.push(TR.triageText(R.triage)); L.push(''); }
  else if (R.findings.length) { L.push('🔎 واش لقيت وحدي:'); R.findings.slice(0, 9).forEach(x => L.push(`  ${ic[x.lvl]} ${x.title}${x.fix ? ' — ' + x.fix : ''}${x.where ? ` (👆 ${x.where})` : ''}`)); L.push(''); }
  L.push(`🎮 المانيت: المستوى ${R.manette.level} — ${R.manette.score}/100 (${R.manette.critical} خطوات حمراء)`);
  L.push('');
  if (R.compass && R.compass.suggestDzd) {
    const c = R.compass;
    L.push('🧭 بلا هدف — هذي الطريق للنجاح بأرقامك:');
    if (c.pace) L.push(`  • ${c.pace.paused ? 'كي كانت الأدس شاعلة' : 'لو تكمل كيما راك'} (~${c.pace.perDay} طلبية/يوم): ~${E.mil(c.pace.profit) || fmt(c.pace.profit) + ' دج'} في ${c.days} يوم${c.pace.paused ? ' — دركا راهي واقفة: 0' : ''}`);
    L.push(`  • برأس مالك، الوجهة الواقعية: ~${E.mil(c.suggestDzd)} كاش في ${c.days} يوم${c.longer ? ` (ولا ~${E.mil(c.longer.targetDzd)} في ${c.longer.days} يوم)` : ''}`);
    (c.levers || []).forEach(l => L.push(`  • 🔑 ${l.lever}${l.capitalSavedDzd > 0 ? ' ← رأس المال −' + (E.mil(l.capitalSavedDzd) || fmt(l.capitalSavedDzd)) : ''}`));
    L.push('  📏 النجاح يتقاس كل جمعة بـ 5:'); c.kpis.forEach(x => L.push(`     ${x.k} ← ${x.v}`));
    L.push('');
  }
  if (R.gap && !R.gap.covered) {
    L.push(R.gap.msg);
    L.push('  4 طرق باش يتسكّر الفرق:');
    R.gap.options.forEach((o, k) => L.push(`  ${k + 1}. ${o.t}`));
    if (R.gap.levers.length) { L.push('  الروافع بالترتيب (الأثر ← الجهد):'); R.gap.levers.forEach(l => L.push(`     • ${l.lever} ← ${E.mil(l.needAfterDzd)} — ${l.effort}`)); }
    const rz = R.gap.realistic; if (rz && rz.days) L.push(`  🎯 الواقعي (الروافع اللي في يدك: ${rz.levers.join(' + ')}): رأس المال يلزمو ${E.mil(rz.needDzd)}، وبرأس مالك توصل للهدف حوالي **اليوم ${rz.days}**.`);
    L.push('');
  } else if (R.gap && R.gap.covered) { L.push('✅ ' + R.gap.msg); L.push(''); }
  if (R.nextQuestion) {
    L.push(R.triage && R.triage.messy ? `❓ كي تكمّل الثلاثة تاع اليوم، نبنيو المسار: ${R.questions.length} أسئلة برك (حوايج ما نشوفهاش). الأول:` : `❓ باقيلي ${R.questions.length} أسئلة برك (حوايج ما نشوفهاش). نبداو بالأول:`);
    L.push(`  ${R.nextQuestion.q}`);
    L.push(`  💡 علاش: ${R.nextQuestion.why}`);
    L.push(`  مثال: ${R.nextQuestion.example}`);
  } else {
    if (R.senior && !R.manette.critical) { L.push('✅ الحساب مجهّز — ما كاين حتى واجب أساسي. البوصلة تخدم معاك على الأحداث والنمو.'); return L.join('\n'); }
    L.push('📋 الواجب (بالترتيب، وحدة بوحدة):');
    R.manette.todo.slice(0, 5).forEach((t, k) => L.push(`  ${k + 1}. ${t.critical ? '🔴' : '🟡'} ${t.title} — 👆 ${t.path}`));
    L.push('');
    L.push({ guide_then_setup: '➡️ حساب جديد: نشوفو المسار أولاً (واش الهدف ممكن، وشحال يلزم) — والواجب تكمّلو قبل أول إعلان.', homework: '➡️ كي تكمّل الحمراء قولي «عاود الفحص». من بعد نبنيو المسار.', guide: '➡️ الحساب مجهّز: نبنيو المسار (GUIDE) للهدف.', door_capital: '➡️ نحسبو وين توصلي برأس مالك.', door_started: '➡️ نبنيو المسار من أرقامك الحقيقية.' }[R.next]);
  }
  return L.join('\n');
}

const api = { onboard, QUESTIONS, parseAnswer, money, days };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
