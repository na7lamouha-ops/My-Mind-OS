/*!
 * بوصلة التاجر — تعريف الأدوات (مشترك بين MCP و HTTP و Netlify)
 * al-KHALiYA © 2026
 */
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine', 'boussala-engine.js'));
const { suivre } = require(path.join(__dirname, '..', 'engine', 'suivre.js'));
const { guideText } = require(path.join(__dirname, '..', 'engine', 'text.js'));
const D = require(path.join(__dirname, '..', 'engine', 'doors.js'));
const T = require(path.join(__dirname, '..', 'engine', 'treasury.js'));
const { track } = require(path.join(__dirname, '..', 'engine', 'livraison.js'));
const { audit, auditText } = require(path.join(__dirname, '..', 'engine', 'audit.js'));
const { brief } = require(path.join(__dirname, '..', 'engine', 'manager.js'));
const TM = require(path.join(__dirname, 'tassyir-map.js'));
const { manette, manetteText } = require(path.join(__dirname, '..', 'engine', 'manette.js'));
const { testAds } = require(path.join(__dirname, '..', 'engine', 'testads.js'));
const CF = require(path.join(__dirname, '..', 'engine', 'confirmation.js'));
const RS = require(path.join(__dirname, '..', 'engine', 'reasons.js'));
const { onboard } = require(path.join(__dirname, '..', 'engine', 'onboard.js'));
const PF = require(path.join(__dirname, '..', 'engine', 'profile.js'));
const SL = require(path.join(__dirname, '..', 'engine', 'selection.js'));
const RG = require(path.join(__dirname, '..', 'engine', 'scenarios.js'));
const CO = require(path.join(__dirname, '..', 'engine', 'coach.js'));
const { onboard: onboardFn } = require(path.join(__dirname, '..', 'engine', 'onboard.js'));
const EVT = require(path.join(__dirname, '..', 'engine', 'events.js'));
const TW = require(path.join(__dirname, '..', 'engine', 'testweek.js'));

const settingsSchema = {
  type: 'object', description: 'إعدادات المسار. كل حقل اختياري — الافتراضي = قيم الأداة.',
  properties: {
    target: { type: 'number', description: 'الهدف: ربح صافي بالدينار (100 مليون = 1000000)' },
    period: { type: 'number', description: 'أيام البيع' },
    targetMode: { type: 'string', enum: ['cash', 'mixed'], description: 'cash = كاش في الجيب | mixed = كاش + سلعة' },
    rate: { type: 'number', description: 'سعر الدولار بالدينار' },
    pack: { type: 'number', description: 'تغليف لكل موصلة (دج)' },
    delCost: { type: 'number', description: 'فرق التوصيل لكل موصلة (دج)' },
    retCost: { type: 'number', description: 'روتور لكل راجعة (دج)' },
    surplus: { type: 'number', description: 'فائض المقاسات العام (%)' },
    persona: { type: 'string', enum: ['beginner', 'pro'] },
    deliveryDays: { type: 'number' }, confirmDays: { type: 'number' }, retBackDays: { type: 'number' }, payoutDays: { type: 'number' }, prepDays: { type: 'number' },
    maxLeads: { type: 'number', description: 'سقف الليدات/يوم لكل منتج (فارغ = بلا سقف)' },
    abandon: { type: 'number', description: 'الليدات الضايعة (% من الليدات)' }, abRec: { type: 'number', description: 'شحال ترجّع منهم (%)' },
    confCap: { type: 'number', description: 'طاقة مؤكّد (ليد/يوم)' }, trackCap: { type: 'number', description: 'طاقة متتبّع (مؤكدة/يوم)' },
  },
};
const productSchema = {
  type: 'object', required: ['name', 'sell', 'buy', 'conf', 'del'],
  properties: {
    name: { type: 'string' }, sell: { type: 'number', description: 'سعر البيع (دج)' }, buy: { type: 'number', description: 'سعر الإنتاج/الشراء (دج)' },
    leadUsd: { type: 'number', description: 'تكلفة الليد بالدولار' }, lead: { type: 'number', description: 'تكلفة الليد بالدينار (لو ما كانش leadUsd)' },
    conf: { type: 'number', description: 'نسبة التأكيد %' }, del: { type: 'number', description: 'نسبة التوصيل %' },
    preorder: { type: 'boolean', description: 'ورشة + طلب مسبق (عربون)' }, dep: { type: 'number', description: 'العربون %' },
    ready: { type: 'boolean', description: 'جملة: سلعة جاهزة' }, surp: { type: 'number', description: 'فائض السيري % (للجملة)' }, prep: { type: 'number', description: 'أيام التحضير لهذا المنتج' },
  },
};
const pathSchema = {
  type: 'object', required: ['products'],
  properties: { settings: settingsSchema, products: { type: 'array', items: productSchema, minItems: 1, maxItems: 10 },
    selection: { description: 'null = البوصلة تختار • [0,1] = دمج • {"single":0} = منتج واحد' },
    startDate: { type: 'string', description: 'أول يوم بيع YYYY-MM-DD' }, capital: { type: 'number', description: 'رأس المال المخصص (اختياري)' } },
};
const clean = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'logs' || k === 'hc' || k === 'v' || k.startsWith('_')) ? undefined : (typeof v === 'number' && !isFinite(v) ? null : v)));

const TOOLS = [
  {
    name: 'boussala_guide',
    description: 'MOOD GUIDE — قبل التاست: يحسب لكل منتج الصافي، سقف الليد، رأس المال يوم بيوم، الخطة (منتج ولا دمج)، الفريق، الستوك، حكم البوصلة، خطة التاست، الرافعات، و«الرقم يقدر يطلع». نفس محرّك الأداة V29.',
    inputSchema: { type: 'object', required: ['products'], properties: { ...pathSchema.properties, myCapital: { type: 'number', description: 'رأس مال التاجر (اختياري) → وقتاش يوصل' },
      edition: { type: 'string', enum: ['tassyir', 'public'], description: 'public = الرافعات مخفية (تلميح)' },
      destination: { type: 'object', description: '🧭 الوجهة: profitPerOrder, leadUsd, conf, del, buy' } } },
    run: a => { const o = E.guide(a); return { text: guideText(o), data: clean(o) }; },
  },
  {
    name: 'boussala_suivre',
    description: 'MOOD SUIVRE — بعد ما تبدا الحملات: يقارن الأرقام الحقيقية (نهار بنهار) بالمسار: واش راك في الوجهة، القرب (تأكيد/توصيل/ليد)، الوتيرة بالأسبوع، حكم التاست بعد 100 ليد، STOP LOSS، نقطة طلب الستوك، الفريق، الروافع، والمسار الجديد بالأرقام الحقيقية.',
    inputSchema: { type: 'object', required: ['path', 'actuals'], properties: {
      path: pathSchema,
      actuals: { type: 'array', description: 'كل سطر = منتج × نهار (ماشي تراكمي)', items: { type: 'object', required: ['product', 'date', 'leads'], properties: {
        product: { type: 'string' }, date: { type: 'string' }, adSpendUsd: { type: 'number' }, adSpendDzd: { type: 'number' }, leads: { type: 'number' },
        confirmed: { type: 'number' }, delivered: { type: 'number' }, returned: { type: 'number' }, abandoned: { type: 'number' }, recovered: { type: 'number' }, stockOnHand: { type: 'number' } } } },
      team: { type: 'object', properties: { confirmers: { type: 'number' }, trackers: { type: 'number' } } } } },
    run: a => { const r = suivre(a); return { text: r.text, data: clean(r) }; },
  },
  {
    name: 'boussala_destination',
    description: '🧭 الوجهة: «نحب نربح X دج في الطلبية» → شحال يلزم سعر البيع، الليدات، الأدس، الفريق، ورأس المال.',
    inputSchema: { type: 'object', required: ['profitPerOrder'], properties: { profitPerOrder: { type: 'number' }, leadUsd: { type: 'number' }, conf: { type: 'number' }, del: { type: 'number' }, buy: { type: 'number' }, settings: settingsSchema } },
    run: a => { const ctx = E.makeCtx(a.settings || {}); const d = E.destination(+a.profitPerOrder, ctx, a);
      return { text: `🧭 باش تربح ${E.fmt(d.profitPerOrder)} دج في الطلبية: سعر البيع ~${E.fmt(d.sellNeed)} دج • ${E.fmt(d.leads)} ليد (~${E.fmt(Math.ceil(d.leadsDay))}/يوم) • أدس ~${E.mil(d.adsTotal) || E.fmt(d.adsTotal) + ' دج'} • فريق ~${d.team} • رأس المال ${isFinite(d.capital) ? (E.mil(d.capital) || E.fmt(d.capital) + ' دج') : 'ما يوصلش في المدة'}`, data: clean(d) }; },
  },
  {
    name: 'boussala_offers',
    description: '⚖️ مقارنة العروض لنفس المنتج: سعر آخر (price)، كمية (qty)، ولا مكمّل (bundle) — مرتّبة بأقل رأس مال.',
    inputSchema: { type: 'object', required: ['product', 'offers'], properties: { product: productSchema, offers: { type: 'array', items: { type: 'object' } }, settings: settingsSchema } },
    run: a => { const ctx = E.makeCtx(a.settings || {}); const r = E.compareOffers(E.normProduct(a.product, ctx), a.offers || [], ctx);
      return { text: r.map((x, i) => `${i + 1}. ${x.name}${x.current ? ' 📍' : ''}: ${x.losing ? '🔴 خاسر' : `صافي ${E.fmt(x.netPerOrder)} دج • رأس المال ${E.mil(x.capital) || E.fmt(x.capital)} • ${E.fmt(Math.ceil(x.leadsPerDay))} ليد/يوم`}`).join('\n'), data: clean(r) }; },
  },
  {
    name: 'boussala_brief',
    description: '🧭 المسيّر — التقرير اليومي الموحّد: النقائص + المسار (SUIVRE) + التوصيل + الخزينة → قائمة وحدة مرتّبة «واش تدير اليوم». مرّر memory من التقرير اللي فات باش التنبيهات المعاودة ما تولّيش ضجيج.',
    inputSchema: { type: 'object', required: ['path'], properties: { path: pathSchema, actuals: { type: 'array', items: { type: 'object' } }, team: { type: 'object' }, parcels: { type: 'array', items: { type: 'object' } },
      cash: { type: 'object', description: 'cashOnHand, purchaseOrders[], ads{dailyUsd,accounts[]}, payoutEvery, nextPayoutDate, deliveredUnpaid, inTransit, reserve, cashInToday' },
      snapshot: { type: 'object', description: 'لقطة النقائص (من boussala_tassyir_read)' }, setup: { type: 'object', description: 'لقطة المانيت (اختياري) — الخطوات الحمراء تدخل للتقرير' }, orders: { type: 'array', description: 'list_orders (اختياري) — الدوران والتصعيد للمناجر' }, marketing: { type: 'object', description: 'get_marketing_analytics (اختياري) — تاست الإعلانات' }, adsTest: { type: 'object', description: 'product + settings لتاست الإعلانات' }, delivery: { type: 'object', description: 'notify, trackerPhone, notified' }, memory: { type: 'object' }, incoming: { type: 'object' }, today: { type: 'string' } } },
    run: a => { const b = brief(a); return { text: b.text, data: clean(b) }; },
  },
  {
    name: 'boussala_audit',
    description: '🔎 النقائص: واش ناقص عند التاجر (تغليف 0، سعر شراء 0، مصاريف…) وعند المنصة (الأدس برا الربح، العربون ما يتسجّلش…) — مع السؤال اللي يتسقسى وكيفاش يتصلح.',
    inputSchema: { type: 'object', required: ['snapshot'], properties: { snapshot: { type: 'object' }, settings: settingsSchema } },
    run: a => { const r = audit(a.snapshot, a.settings); return { text: auditText(r), data: clean(r) }; },
  },
  {
    name: 'boussala_tassyir_read',
    description: 'يحوّل مخرجات أدوات تسيير (get_variant_analytics، get_finance_summary، list_finance_transactions، get_marketing_analytics، get_analytics_overview، list_order_tracking، list_expenses) لإعدادات البوصلة الحقيقية + لقطة النقائص. مرّر المخرجات كما جات.',
    inputSchema: { type: 'object', properties: { variantAnalytics: { type: 'object' }, financeSummary: { type: 'object' }, financeTx: { type: 'array' }, marketing: { type: 'object' }, overview: { type: 'object' }, tracking: { type: 'object' }, expenses: { type: 'array' }, merchant: { type: 'object' }, rate: { type: 'number' }, today: { type: 'string' } } },
    run: a => { const settings = TM.settingsFromTassyir(a), snapshot = TM.snapshotFromTassyir(a), A = audit(snapshot, settings);
      return { text: `⚙️ من تسيير: روتور ${settings.retCost ?? '—'} • فرق التوصيل ${settings.delCost ?? '—'} • تغليف+عمولة ${settings.pack ?? '—'} • تأكيد ${settings.conf ?? '—'}% • توصيل ${settings.del ?? '—'}% • ليد $${settings.leadUsd ?? '—'} • الكاش يرجع كل ${settings.payoutEvery ?? '—'} يوم\n\n` + auditText(A), data: clean({ settings, snapshot, audit: A }) }; },
  },
  {
    name: 'boussala_treasury',
    description: '💰 الخزينة: رزنامة السيولة يوم بيوم (العربون، الباقي للورشة نهار الاستلام، فواتير Meta بالعتبة، سحب شركة التوصيل) + تنبيه قبل ما يطيح الكاش + تقسيم الكاش اللي رجع على 4 جيوب. mode: plan (من المسار قبل التاست) ولا live (بالأرقام الحقيقية).',
    inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['plan', 'live'] }, path: pathSchema, capital: { type: 'number' },
      live: { type: 'object', description: 'today, cashOnHand, purchaseOrders[{product,qty,unitCost,depositPct,depositPaid,orderDate,dueDate,tranches[]}], ads{dailyUsd,accounts[{thresholdUsd,spentSinceBillUsd}]}, payoutEvery, nextPayoutDate, deliveredUnpaid, reserve, horizon' },
      cashInToday: { type: 'number', description: 'لو دخل كاش اليوم → تقسيم الجيوب' } } },
    run: a => {
      if (a.mode === 'plan' || (!a.live && a.path)) { const c = T.planCalendar({ ...(a.path || {}), capital: a.capital });
        return { text: '💰 رزنامة المسار:\n' + (c.events || []).map(e => `  ${e.date}: ${e.text}`).join('\n'), data: clean({ ...c, rows: undefined, weekly: c.rows && c.rows.filter((r, i) => i % 7 === 0) }) }; }
      const c = T.cashCalendar(a.live || {}); let txt = T.calendarText(c);
      if (a.cashInToday > 0) { const sp = T.split({ cash: a.cashInToday, calendar: c, daysToNextPayout: (a.live && a.live.payoutEvery) || 7, reserveTarget: c.reserve }); txt += '\n\n' + T.splitText(sp); return { text: txt, data: clean({ calendar: c, split: sp }) }; }
      return { text: txt, data: clean(c) };
    },
  },
  {
    name: 'boussala_livraison',
    description: '🚚 وكيل متابعة التوصيل: وقتاش خرجت الطرود، وقتاش تليفرات، الروتور، الطرود الحابسة، «ما يجاوبش» قبل ما ترجع، الموصلة وماشي مخلّصة، والولايات الضعيفة — مع واش يدير المؤكّد اليوم. يقبل مخرجات list_order_tracking كما هي.',
    inputSchema: { type: 'object', required: ['parcels'], properties: { parcels: { type: 'array', items: { type: 'object' } }, today: { type: 'string' }, stuckDays: { type: 'number' }, preorder: { type: 'boolean' },
      notify: { type: 'string', enum: ['wilaya', 'alert_only'], description: 'wilaya = رسالة للزبون كي توصل لولايتو (فيها رقم المتتبّع) • alert_only = المتتبّع يتدخّل غير كي يجي تنبيه من شركة التوصيل' }, trackerPhone: { type: 'string' }, notified: { type: 'array', items: { type: 'string' } }, template: { type: 'string' } } },
    run: a => { const r = track(a); return { text: r.text, data: clean(r) }; },
  },
  {
    name: 'boussala_door',
    description: '🚪 أبواب الدخول بلا هدف ربح: door=capital («عندي X، وين نوصل؟»)، door=started («راني بديت» → المسار من الأرقام الحقيقية)، door=orders («نحب نرسل 1000 طلبية في الشهر»)، door=working_capital (رأس المال العامل الدائم لتاجر خدّام).',
    inputSchema: { type: 'object', required: ['door', 'products'], properties: { door: { type: 'string', enum: ['capital', 'started', 'orders', 'working_capital', 'gap'] }, products: { type: 'array', items: productSchema },
      settings: settingsSchema, capital: { type: 'number' }, actuals: { type: 'array' }, shippedPerMonth: { type: 'number' }, startDate: { type: 'string' } } },
    run: a => {
      if (a.door === 'capital') { const r = D.reach(a); return { text: r.msg + (r.guide ? '\n\n' + guideText(r.guide) : ''), data: clean({ ...r, guide: r.guide && r.guide.plan }) }; }
      if (a.door === 'gap') { const r = D.gap(a); return { text: r.msg + '\n' + (r.options || []).map((o, k) => `${k + 1}. ${o.t}`).join('\n') + (r.realistic && r.realistic.days ? `\n🎯 الواقعي (${r.realistic.levers.join(' + ')}): توصل حوالي اليوم ${r.realistic.days}` : ''), data: clean(r) }; }
      if (a.door === 'started') { const r = D.fromActuals(a); return { text: r.msg, data: clean(r) }; }
      if (a.door === 'orders') { const r = D.fromOrders({ ...a, levers: false }); const wc = D.workingCapital(a); return { text: r.msg + `\n💼 رأس المال العامل الدائم (كي توصل): ~${wc.totalMil}${wc.saving ? ` — بالسحب اليومي ينقص ${E.mil(wc.saving)}` : ''}`, data: clean({ ...r, guide: r.guide && r.guide.plan, workingCapital: wc }) }; }
      const wc = D.workingCapital(a); return { text: `💼 رأس المال العامل الدائم: ~${wc.totalMil}\n` + Object.entries(wc.parts).map(([k, v]) => `  • ${wc.labels[k]}: ${E.mil(v) || E.fmt(v)}`).join('\n') + (wc.saving ? `\n🔑 لو تسحب كل نهار: ينقص ${E.mil(wc.saving)}` : ''), data: clean(wc) };
    },
  },
  {
    name: 'boussala_manette',
    description: '🎮 المانيت: لعبة البروسيس في تسيير. المستوى 0 = تجهيز الحساب (المحافظ الأربعة، ربط حسابات الأدس، الرصيد الافتتاحي، ثمن الشراء، التغليف، المصاريف والباقي للورشة في Costs، الروتور حسب العرض، تتبّع السحب، التوزيع، سلّم المكالمات، الرواجع…) بنقاط + وين تضغط بالضبط. المستويات 1→5: التاست ← أول دفعة ← الريتم ← التكبير ← 1000/شهر، مع الشاشات اليومية وباب الخروج. setup = لقطة من شاشات تسيير ولا أجوبة التاجر (الناقص = سؤال).',
    inputSchema: { type: 'object', required: ['setup'], properties: { setup: { type: 'object', description: 'wallets[{name,balance,currency}], adAccounts{linked[],unlinked[]}, fx{usd,since}, productsNoBuy, productsTotal, packagingItems, packagingIncluded, fixedCosts, hasStaffOrRent, upcomingCosts, workshopRemainders, returnFee{configured,offer}, payoutBacklog, carrierHeld, daysSincePayout, payoutEvery, locationsShipFrom, statuses{callAttempts,closes}, cancelReasonRequired, distribution{receiving,exceptionToUnavailable[]}, salaryOwed, spamLevel, tiktok{uses,connected}, stuckOrders[{status,days}], returnsToProcess, monthlyOrders, phase, today, goal{targetDzd,cashProfitDzd,owedToWorkshopDzd}, takeBack{minutes,times}' } } },
    run: a => { const r = manette(a.setup); return { text: manetteText(r), data: clean({ ...r, levels: undefined }) }; },
  },
  {
    name: 'boussala_onboard',
    description: '👋 أول ربط (الكوتش): مرّر قراءة تسيير كما هي (scan: whoami، stores، deliveryAgents، financeSummary، financeTx، expenses، employees، customStatuses، overview، inventory، variantAnalytics، marketing، orders، tracking) والأجوبة اللي عندك (answers). يرجّع: الأرقام الحقيقية، المرحلة، النقائص اللي باينة، السؤال الجاي (واحد) مع «علاش»، ولا الواجب (المانيت) والباب.',
    inputSchema: { type: 'object', required: ['scan'], properties: { scan: { type: 'object' }, reply: { type: 'object', description: 'جواب التاجر كما كتبو: { id: "goal" (id السؤال اللي تسقسى), text: "100 M EN 40 JRS" } — المحرّك يفهمو ويزيدو للأجوبة (ارجع answers من النتيجة واحفظها)' }, answers: { type: 'object', description: 'exclude[productName], goal{targetDzd,days}|noGoal, capitalDzd, supply{type,depositPct,prepDays}, returnFee, payoutEvery, packaging{included|perOrder}, buyPrices{name:dzd}, wallets[{name,balance,currency}], adAccounts{active[],unlinked[]}, ladderCloses, rate' }, today: { type: 'string' } } },
    run: a => { const r = onboard(a); return { text: r.text, data: clean({ ...r, settings: undefined }) }; },
  },
  {
    name: 'boussala_coach',
    description: '🧭 المرافق خطوة بخطوة: يحوّل خطة الإنقاذ لخطوات وحدة بوحدة على شاشات تسيير (الشاشة، واش تشوف، واش تضغط، واش ما تضغطش، الكابتور اللي يبعثو). مرّر done (الخطوات اللي قال كمّلها) وafter (قراءة جديدة للحساب) باش يتحقّق من الحساب قبل ما يدوز للخطوة الجاية. التاجر هو اللي يضغط.',
    inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['rescue', 'new'], description: 'new = مسار التاجر الجديد (24 خطوة بالشاشات) • rescue = خطة إنقاذ حساب قديم (يحتاج scan)' }, scan: { type: 'object' }, done: { type: 'array', items: { type: 'string' } }, after: { type: 'object', description: 'قراءة جديدة (نفس شكل scan) من بعد ما التاجر دار الخطوة' } } },
    run: a => { const r = a.mode === 'new' || !a.scan ? CO.walkNew(a) : CO.walk({ ...a, triage: onboardFn({ scan: a.scan }).triage }); return { text: r.text, data: clean(r) }; },
  },
  {
    name: 'boussala_pick',
    description: '🧪 اختيار موديلات التاست: كل مرشّح بنقاط 0–2 على proof (إثبات السوق، ×2: إعلانات منافسين > 14 يوم)، margin، season، size، hook، edge ← احتمال نجاح أولي، وشحال من موديل يلزم باش نخرجو بـ need فائزين (افتراضي 2) باحتمال ≥ target (0.8)، مع الليدات والميزانية. خذ الدليل من مكتبة إعلانات Meta قبل ما تعطي النقاط.',
    inputSchema: { type: 'object', required: ['candidates'], properties: { candidates: { type: 'array', items: { type: 'object' } }, need: { type: 'number' }, target: { type: 'number' }, leadsPerAd: { type: 'number' }, adsPerModel: { type: 'number' }, rate: { type: 'number' } } },
    run: a => { const r = SL.pick(a); return { text: r.text, data: r }; },
  },
  {
    name: 'boussala_range',
    description: '🎲 المجال والاحتمال: نفس مدخلات GUIDE (settings + products) + رأس المال + النهار اللي لازم الكاش يكون فيه (deadline). يرجّع أحسن حالة / الوسط / أسوأ حالة، احتمال الوصول للهدف في المدة (300 سيناريو)، نهار الكاش (الوسط و9 من 10)، والمتغيّر اللي يحرّك النتيجة أكثر.',
    inputSchema: { type: 'object', required: ['settings', 'products'], properties: { settings: settingsSchema, products: { type: 'array', items: productSchema }, myCapital: { type: 'number' }, deadline: { type: 'number' }, runs: { type: 'number' }, spread: { type: 'object', description: '{ lead:[أسوأ، أحسن] بالنسبة، conf:[..] نقاط، del:[..] نقاط } — افتراضي: الليد +25%/−15%، التأكيد −6/+4، التوصيل −8/+5' } } },
    run: a => { const r = RG.range(a); return { text: r.text, data: clean(r) }; },
  },
  {
    name: 'boussala_testweek',
    description: '🧪 أسبوع التاست بالمنطق: كل حد يتحسب من المنتج (sell, buy, leadUsd, conf, del) وsettings، ماشي أرقام محفوظة. mode "plan": الجدول (الأقوى أولاً، p من boussala_pick)، الميزانية في النهار = ليدات تعلّم ميتا × الليد ÷ testDays (الأيام اللي يعطيها التاجر)، السقف = الربح على الطلبية المؤكّدة قبل الأدس (وبالتوصيل الأسوأ)، الحد = ليدات التعلّم × الليد الأقصى، التأكيد الأدنى، المحفظة، والخانات. mode "decide": results = [{name, spend, leads, confirmed, processed?, sell, buy, conf, del}] ← الحكم بمجال الثقة 90%: نقتلو كي حتى أحسن حالة فوق السقف، نقبلو كي حتى أسوأ حالة تحت السقف الأسوأ وميتا خرجت من التعلّم، بيناتهم نكملو حتى الحد.',
    inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['plan', 'decide'] }, models: { type: 'array', items: { type: 'object' } }, results: { type: 'array', items: { type: 'object' } }, settings: settingsSchema, testDays: { type: 'number', description: 'شحال من نهار يعطي التاجر لكل موديل (سقسيه)' }, perDay: { type: 'number', description: 'شحال من موديل جديد في النهار' }, confidence: { type: 'number' }, learningEvents: { type: 'number' } } },
    run: a => { const r = a.mode === 'decide' || a.results ? TW.decide(a) : TW.plan(a); return { text: r.text, data: clean(r) }; },
  },
  {
    name: 'boussala_commit',
    description: '🎯 الالتزام والبوصلة + البوابات: نفس مدخلات boussala_range + deadline ← أكبر هدف نوصلو قبل deadline بحظ ≥ prob (افتراضي 90% = 9 مرات من 10، مبدأ أسوأ حالة) = الالتزام، حظ الهدف الأصلي، والنهار اللي فيه الهدف يوصل لنفس الحظ (البوصلة). ومعاه البوابات محسوبة: شحال من كولي يلزم باش نقيسو التوصيل، الليدات، الفريق، والمال تاع VALIDE. يدّي ~30 ثانية.',
    inputSchema: { type: 'object', required: ['settings', 'products'], properties: { settings: settingsSchema, products: { type: 'array', items: productSchema }, myCapital: { type: 'number' }, deadline: { type: 'number' }, prob: { type: 'number' }, runs: { type: 'number' }, maxLoss: { type: 'number', description: 'أقصى خسارة نقبلوها (دج)' } } },
    run: a => { const c = RG.commit(a), g = RG.gates({ capital: a.myCapital, maxLoss: a.maxLoss, settings: a.settings, products: a.products }); return { text: c.text + '\n' + g.text, data: clean({ ...c, gates: g.gates }) }; },
  },
  {
    name: 'boussala_events',
    description: '📡 الأحداث: يقارن آخر 7 أيام بالـ 21 اللي قبل (marketingRecent / marketingPrev من get_marketing_analytics) + الطلبيات + المالية + المخازن/الورشات، ويطلّع: 💀 كرياتيف مات، ⚔️ منافس دخل، ⏳ منتج كبر، 💰 رأس مال جديد، 🧵 ورشة جديدة، 🚀 منتج طالع — كل واحد بالدليل وواش ندير.',
    inputSchema: { type: 'object', required: ['scan'], properties: { scan: { type: 'object' }, rate: { type: 'number' }, today: { type: 'string' } } },
    run: a => { const r = EVT.events(a); return { text: EVT.eventsText(r), data: clean(r) }; },
  },
  {
    name: 'boussala_profile',
    description: '🧩 كيفاش منظّم هذا التاجر: تسمية الحملات، الأدوار، السلّم، المحافظ، الورشات، التطبيقات، والوكلاء تاعو من سجل النشاط (list_activity_logs) — درجة النضج، وكيفاش البوصلة تتركّب فوق نظامو بلا ما تكسّر.',
    inputSchema: { type: 'object', required: ['scan'], properties: { scan: { type: 'object' } } },
    run: a => { const r = PF.profile(a.scan); return { text: PF.profileText(r), data: clean(r) }; },
  },
  {
    name: 'boussala_test_ads',
    description: '🧪 تاست الإعلانات (المتغيّرات/الزوايا): يقرا تقرير التسويق تاع تسيير (get_marketing_analytics كما هو) ويقول لكل إعلان: يتعلّم (ناقص X ليد من 50)، وقّف بكري، فوق السقف، ميتا ما عطاتوش فرصة (CBO)، ولا جاهز — ومن بعد: كاين فائز؟ الأرقام كافية؟ ولا تعادل؟ مرّر product + settings باش يحسب السقف، ولا ceilingDzd.',
    inputSchema: { type: 'object', required: ['marketing'], properties: { marketing: { type: 'object' }, product: productSchema, settings: settingsSchema, ceilingDzd: { type: 'number' }, rate: { type: 'number' }, minLeads: { type: 'number' }, byName: { type: 'boolean' } } },
    run: a => { const r = testAds(a); return { text: r.text, data: clean(r) }; },
  },
  {
    name: 'boussala_confirmation',
    description: '📞 التأكيد السريع: يقرا الطلبيات (list_orders كما هي) ويطبّق قاعدة الدوران (إشعارين، 30 دقيقة، ثم المؤكّد الثاني، 5 دورات ← المناجر AI ينبّه التاجر). يقيس وقت أول اتصال والإلغاءات بلا سبب، ويعطي إعداد تسيير.',
    inputSchema: { type: 'object', required: ['orders'], properties: { orders: { type: 'array', items: { type: 'object' } }, now: { type: 'string' }, rule: { type: 'object', description: 'roundMinutes (30), reminders (2), rounds (5), workStart (9), workEnd (21)' } } },
    run: a => { const r = CF.watch(a); return { text: r.text + '\n\n⚙️ في تسيير:\n' + r.setup.map(x => '  • ' + x).join('\n'), data: clean(r) }; },
  },
  {
    name: 'boussala_reasons',
    description: '🏷️ أسباب الإلغاء والروتور (خاصة بالملابس): يصنّف الإلغاءات (cancelReason) والروتور (الملاحظات ولا الكود #R-… في التعليق) ويحسب شحال يخسّر كل سبب والرافعة اللي تصلّحو. setup=true يرجّع القائمة اللي تتزاد في تسيير.',
    inputSchema: { type: 'object', properties: { canceled: { type: 'array' }, returns: { type: 'array' }, cplDzd: { type: 'number' }, confPct: { type: 'number' }, retCost: { type: 'number' }, delCost: { type: 'number' }, setup: { type: 'boolean' } } },
    run: a => { if (a.setup) { const st = RS.setupSteps(); return { text: `⚙️ أسباب الإلغاء (${st.cancelReasons.path}):\n` + st.cancelReasons.items.map(x => '  • ' + x).join('\n') + `\n  ${st.cancelReasons.plus}\n\n↩️ الروتور: ${st.returnReasons.now}\n  ${st.returnReasons.ask}\n\n📞 ${st.callStatuses}`, data: st }; }
      const r = RS.analyze(a); return { text: r.text, data: clean(r) }; },
  },
  {
    name: 'boussala_defaults',
    description: 'يرجّع القيم الافتراضية تاع البوصلة ونسخة المحرّك.',
    inputSchema: { type: 'object', properties: {} },
    run: () => ({ text: 'Boussala engine ' + E.ENGINE_VERSION, data: { engine: E.ENGINE_VERSION, defaults: E.DEFAULTS } }),
  },
];

function callTool(name, args) {
  const t = TOOLS.find(x => x.name === name);
  if (!t) throw new Error('أداة غير معروفة: ' + name);
  return t.run(args || {});
}

module.exports = { TOOLS, callTool, ENGINE_VERSION: E.ENGINE_VERSION };
