/*!
 * بوصلة التاجر — MOOD SUIVRE (المتابعة)
 * al-KHALiYA © 2026
 * يقارن الأرقام الحقيقية بالمسار اللي رسمتو البوصلة: القرب، الوتيرة، STOP LOSS، الرافعات، الستوك، الفريق، المسار الجديد.
 * القواعد مأخوذة من «نصائح المسيّر» و«التاست» في الأداة V29.
 */
'use strict';
const E = (typeof require === 'function') ? require('./boussala-engine.js') : window.BoussalaEngine;

const RULES = Object.freeze({
  TEST_LEADS: 100,          // التاست = 100 ليد لكل منتج
  CPL_WARN: 0.70,           // الليد فات 70% من السقف…
  CPL_WARN_DAYS: 3,         // …3 أيام متتالية → بدّل الفيديو
  CPL_STOP_DAYS: 2,         // الليد فوق السقف يومين → STOP LOSS
  WEEK_GAP: 0.15,           // الأسبوع ناقص بأكثر من 15% → وقف وعاود حسب
  MIN_CLOSED_FOR_DEL: 20,   // ما نحكموش على التوصيل قبل 20 طلبية مسكّرة
  CONF_OK: 3, CONF_BAD: 8,  // فرق نقاط التأكيد
  DEL_OK: 3, DEL_BAD: 8,    // فرق نقاط التوصيل
  CPL_OK: 0.10, CPL_BAD: 0.30, // الليد أغلى من الفرضية بـ 10% / 30%
  HIRE_AT: 0.80,            // 80% من طاقة المؤكّد → وظّف
  FAST: 0.30,               // فوق المسار بأكثر من 30% → تأكد الكاش والستوك يلحقو
  OFF_DAYS: 0.10,           // برأس مالك توصل بعد المدة بأكثر من 10% → خارج المسار
  EARLY_KILL_LEADS: 50,     // بعد 50 ليد…
  EARLY_KILL_X: 1.2,        // …الليد فوق السقف بـ 20% → وقّف التاست بكري
  SAFETY_DAYS: 2,           // أيام أمان فوق وقت التحضير
  PRO_AFTER_DAYS: 30,       // بعد 30 يوم أرقام ثابتة → مستوى محترف
  IDLE_X: 2,                // الستوك > ضعف أيام (التحضير + الدورة) → ستوك راقد
  MIN_BATCH: 50,            // أصغر دفعة عند الورشة
  REPEAT_QUIET: 3,
  WINDOW: 14,               // الأرقام الحقيقية = آخر 14 يوم          // نفس التنبيه بعد 3 أيام يولّي «مازال» (إلا STOP)
});


// حجم الدفعة حسب الكاش: كامل ← اللي يقدر ← 50 على دفعتين ← ما تطلبش
function sizeBatch(want, p, cashFree, cashNow) {
  if (cashFree == null) return { qty: want, note: '' };
  const full = want * p.buy;
  if (full <= cashFree) return { qty: want, note: '' };
  const can = Math.floor(Math.max(0, cashFree) / p.buy);
  if (can >= RULES.MIN_BATCH) return { qty: can, note: ` الكاش في التوقّع يغطي ${can} قطعة برك (العربون + الباقي) — اطلبهم.`, reduced: true };
  const dep = p.preorder ? p.dep / 100 : 1, depMin = RULES.MIN_BATCH * p.buy * dep;
  if (cashNow != null && depMin <= cashNow) return { qty: RULES.MIN_BATCH, split: true,
    note: ` الكاش ما يغطيش الباقي كامل: اطلب ${RULES.MIN_BATCH} واتفق مع الورشة على التسليم والخلاص على دفعتين (${RULES.MIN_BATCH / 2} + ${RULES.MIN_BATCH / 2} كل 2 أيام)، ووقّف الأدس على اللي ماشي في الخطة.` };
  return { qty: 0, note: ` ⚠️ حتى عربون ${RULES.MIN_BATCH} قطعة ما يتغطاش — استنى السحب الجاي.` };
}
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
const r1 = x => Math.round(x * 10) / 10;
const lvlOf = (gap, ok, bad) => gap >= -ok ? 'ok' : (gap >= -bad ? 'warn' : 'bad');

/**
 * suivre({ path, actuals, today?, team?, cashOnHand? })
 *  path    = نفس مدخلات guide: { settings, products, selection } + startDate (أول يوم بيع) + capital (اختياري)
 *  actuals = [{ product, date, adSpendUsd | adSpendDzd, leads, confirmed, delivered, returned, abandoned?, recovered?, stockOnHand? }]
 *            confirmed/delivered/returned = اللي صرا في ذاك النهار (ماشي تراكمي)
 */
function suivre(input) {
  const path = input.path || {};
  const ctx = E.makeCtx(path.settings || {});
  const products = (path.products || []).map(p => E.normProduct(p, ctx));
  const plan = E.getChosenPlan(products, ctx, path.selection);
  const shared = E.sharedOf(ctx);
  const T = plan.cycleDays || 6;
  const capital = +path.capital > 0 ? +path.capital : plan.starterCapital;

  // المسار المحدد يوم بيوم (نفس المحاكي، نفس رأس المال)
  const sim = isFinite(capital)
    ? E.simPlan(plan, shared, capital, ctx.target, ctx.maxLeads, T, 730, { ...E.personaOpts(ctx), P: plan.capDays || ctx.period, noBrake: !(+path.capital > 0) }, ctx)
    : null;

  const acts = (input.actuals || []).filter(a => a && a.product != null);
  const byName = {};
  acts.forEach(a => { const k = String(a.product).trim(); (byName[k] = byName[k] || []).push(a); });

  const team = input.team || {};
  const report = { engine: E.ENGINE_VERSION, mode: 'SUIVRE', planLabel: plan.label, target: ctx.target, targetMode: ctx.targetMode, period: ctx.period,
    capital, products: [], alerts: [], levers: [], status: 'ok' };

  // مسار التاست: منتج «testing» يبقى متابَع حتى الحكم، حتى لو ماهوش في الخطة
  const trackList = plan.products.slice();
  products.forEach((p, i) => { if (p.testing && !p.tested && !trackList.some(x => x.index === i)) trackList.push({ p, R: E.calcOneProduct(p, shared, ctx.target * 0.1, ctx), share: 0.1, index: i, testingOnly: true }); });
  trackList.forEach(({ p, R, share, index, testingOnly }, pi) => {
    const rowsAll = (byName[p.name] || byName[String(index)] || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const startD = path.startDate || '';
    const rowsPath = rowsAll.filter(r => !startD || String(r.date) >= startD);   // للوتيرة: من بداية المسار
    const rows = rowsAll.slice(-RULES.WINDOW);                                       // للأرقام: آخر 14 يوم (الحديث يحكم)
    const day = rowsPath.length, daysLive = rowsAll.length;
    const Lall = sum(rowsAll, x => +x.leads || 0), Lpath = sum(rowsPath, x => +x.leads || 0);
    const out = { name: p.name, index, sharePct: testingOnly ? 0 : Math.round(share * 1000) / 10, day, daysLive, testingOnly: !!testingOnly };
    if (!daysLive) { out.phase = 'not_started'; out.status = 'info'; out.note = 'ما كاين حتى رقم لهذا المنتج — دخّل أول نهار.'; report.products.push(out); return; }

    const spendDzd = x => x.adSpendDzd != null ? +x.adSpendDzd : (+x.adSpendUsd || 0) * ctx.rate;
    const L = sum(rows, x => +x.leads || 0), S = sum(rows, spendDzd), Cf = sum(rows, x => +x.confirmed || 0),
      Dv = sum(rows, x => +x.delivered || 0), Rt = sum(rows, x => +x.returned || 0), Ab = sum(rowsPath, x => +x.abandoned || 0), Rc = sum(rowsPath, x => +x.recovered || 0);
    const closed = Dv + Rt;
    const cpl = L > 0 ? S / L : null;
    const conf = L > 0 ? Cf / L * 100 : null;
    const delMeasured = closed >= RULES.MIN_CLOSED_FOR_DEL;
    const del = closed > 0 ? Dv / closed * 100 : null;

    // الأرقام الحقيقية → نفس المحرّك (السقف الحقيقي، ربح الليد الحقيقي)
    const real = E.normProduct({ ...p, leadUsd: null, lead: cpl != null ? cpl : p.lead,
      conf: conf != null && L >= 30 ? conf : p.conf, del: delMeasured ? del : p.del }, ctx);
    const RR = E.calcOneProduct(real, shared, ctx.target * share, ctx);
    const ceiling = RR.breakevenCPA;

    out.real = { leads: L, spendDzd: Math.round(S), spendUsd: r1(S / ctx.rate), cplDzd: cpl != null ? Math.round(cpl) : null, cplUsd: cpl != null ? +(cpl / ctx.rate).toFixed(2) : null,
      confPct: conf != null ? r1(conf) : null, delPct: del != null ? r1(del) : null, delMeasured, closedOrders: closed,
      costPerConfirmed: Cf > 0 ? Math.round(S / Cf) : null, costPerDelivered: Dv > 0 ? Math.round(S / Dv) : null,
      abandoned: Ab, recovered: Rc };
    out.assumed = { cplDzd: p.lead, cplUsd: p.leadUsd, confPct: p.conf, delPct: p.del };
    out.ceiling = { maxCplDzd: Math.round(ceiling), maxCplUsd: +(ceiling / ctx.rate).toFixed(2), plannedMaxCplDzd: Math.round(R.breakevenCPA) };
    out.netPerLeadReal = Math.round(RR.netPerLead);
    out.netPerOrderReal = Math.round(RR.netAfterAdsPerDel);

    // القرب من الفرضيات
    const prox = [];
    if (conf != null && L >= 30) prox.push({ k: 'conf', label: 'التأكيد', real: r1(conf), plan: p.conf, gapPts: r1(conf - p.conf), lvl: lvlOf(conf - p.conf, RULES.CONF_OK, RULES.CONF_BAD) });
    if (delMeasured) prox.push({ k: 'del', label: 'التوصيل', real: r1(del), plan: p.del, gapPts: r1(del - p.del), lvl: lvlOf(del - p.del, RULES.DEL_OK, RULES.DEL_BAD) });
    if (cpl != null) { const g = cpl / p.lead - 1; prox.push({ k: 'cpl', label: 'تكلفة الليد', real: Math.round(cpl), plan: p.lead, gapPct: Math.round(g * 100), lvl: g <= RULES.CPL_OK ? 'ok' : (g <= RULES.CPL_BAD ? 'warn' : 'bad') }); }
    out.proximity = prox;

    // آخر الأيام: قاعدة 70% / فوق السقف
    const daily = rows.map(x => ({ date: x.date, cpl: (+x.leads > 0) ? spendDzd(x) / +x.leads : null, leads: +x.leads || 0 }));
    const lastN = n => daily.slice(-n).filter(d => d.cpl != null);
    const over70 = lastN(RULES.CPL_WARN_DAYS).length === RULES.CPL_WARN_DAYS && lastN(RULES.CPL_WARN_DAYS).every(d => d.cpl > RULES.CPL_WARN * ceiling);
    const overCeil = lastN(RULES.CPL_STOP_DAYS).length === RULES.CPL_STOP_DAYS && lastN(RULES.CPL_STOP_DAYS).every(d => d.cpl > ceiling);

    const alerts = [];
    const phase = (p.tested || Lall >= RULES.TEST_LEADS) ? 'campaign' : 'test';
    out.phase = phase;
    if (phase === 'test') {
      out.test = { leadsDone: Lall, leadsLeft: RULES.TEST_LEADS - Lall, budgetLeftDzd: Math.round((RULES.TEST_LEADS - Lall) * (cpl || p.lead)) };
      if (L >= RULES.EARLY_KILL_LEADS && cpl != null && (cpl > RULES.EARLY_KILL_X * ceiling || !(RR.netPerLead > 0))) {
        out.testVerdict = { verdict: 'kill', early: true, cplDzd: Math.round(cpl), confPct: conf != null ? r1(conf) : null, ceilingDzd: Math.round(ceiling),
          msg: `وقّف التاست بكري: بعد ${L} ليد، الليد (${fmtU(cpl, ctx)}) فوق السقف بـ ${Math.round((cpl / ceiling - 1) * 100)}% — ما يستاهلش تكمّل الـ100. وفّر الباقي (~${fmt(out.test.budgetLeftDzd)} دج) لمنتج آخر.` };
        alerts.push({ lvl: 'stop', code: 'test_kill_early', product: p.name, msg: out.testVerdict.msg });
      } else if (overCeil && L >= 40) alerts.push({ lvl: 'stop', code: 'test_over_ceiling', product: p.name, msg: `الليد فوق السقف (${fmtU(ceiling, ctx)}) يومين — وقّف هذا الكرياتيف قبل ما تكمل الـ100.` });
      else if (over70) alerts.push({ lvl: 'warn', code: 'creative_tired', product: p.name, msg: `الليد فات 70% من السقف ${RULES.CPL_WARN_DAYS} أيام — بدّل الفيديو.` });
    } else if (!p.tested) {
      // حكم التاست (أول مرة نفوتو 100)
      const testRows = []; let c = 0; for (const x of rowsAll) { if (c >= RULES.TEST_LEADS) break; testRows.push(x); c += +x.leads || 0; }
      const tL = sum(testRows, x => +x.leads || 0), tS = sum(testRows, spendDzd), tC = sum(testRows, x => +x.confirmed || 0);
      const tCpl = tL > 0 ? tS / tL : 0, tConf = tL > 0 ? tC / tL * 100 : 0;
      const tReal = E.normProduct({ ...p, leadUsd: null, lead: tCpl, conf: tConf }, ctx);
      const tR = E.calcOneProduct(tReal, shared, ctx.target * share, ctx);
      let verdict;
      if (!(tR.netPerLead > 0) || tCpl >= tR.breakevenCPA) verdict = 'kill';
      else if (tCpl < RULES.CPL_WARN * tR.breakevenCPA && tConf >= p.conf - RULES.CONF_BAD) verdict = 'scale';
      else verdict = 'fix';
      const prepT = (p.prep > 0 ? p.prep : (p.ready ? 1 : ctx.prepDays));
      let firstBatch = verdict === 'kill' ? 0 : Math.max(RULES.MIN_BATCH, Math.ceil(Cf + R.sendPerDay * (prepT + T)));
      let fbNote = '';
      if (firstBatch) { const sb = sizeBatch(firstBatch, p, input.cashFree, input.cashNow); firstBatch = sb.qty; fbNote = sb.note; }
      out.testVerdict = { verdict, firstBatch, cplDzd: Math.round(tCpl), confPct: r1(tConf), ceilingDzd: Math.round(tR.breakevenCPA),
        msg: verdict === 'scale' ? `التاست نجح: الليد تحت 70% من السقف والتأكيد قريب من فرضيتك → كبّر. أول دفعة ~${firstBatch} قطعة (${Cf} مؤكدة تستنى + ${prepT + T} أيام بيع).${fbNote}`
          : verdict === 'fix' ? 'التاست نص نص: رابح بصح الهامش رقيق → صلّح (فيديو، عرض، سكريبت المؤكّد) قبل ما تكبّر.'
          : 'التاست فشل: الليد فوق السقف ولا كل ليد يخسر → بدّل المنتج ولا العرض، ما تطلبش دفعة.' };

    }
    if (phase === 'campaign') {
      if (!(RR.netPerLead > 0)) alerts.push({ lvl: 'stop', code: 'losing_per_lead', product: p.name, msg: `بالأرقام الحقيقية كل ليد يخسر (${fmt(RR.netPerLead)} دج) — STOP LOSS: وقّف الأدس وصلّح قبل ما تزيد.` });
      else if (overCeil) alerts.push({ lvl: 'stop', code: 'over_ceiling', product: p.name, msg: `الليد فوق السقف (${fmtU(ceiling, ctx)}) ${RULES.CPL_STOP_DAYS} أيام — STOP LOSS على هذي الحملة: وقّفها، وحوّل الميزانية للكرياتيف ولا المنتج اللي يخدم.` });
      else if (over70) alerts.push({ lvl: 'warn', code: 'creative_tired', product: p.name, msg: `الليد فات 70% من السقف ${RULES.CPL_WARN_DAYS} أيام متتالية — بدّل الفيديو قبل ما تنقّص الميزانية.` });
    }
    prox.forEach(x => { if (x.lvl === 'bad') alerts.push({ lvl: 'warn', code: 'far_' + x.k, product: p.name, msg: `${x.label} ${x.k === 'cpl' ? 'بعيدة' : 'بعيد'} على المسار (حقيقي ${x.real}${x.k === 'cpl' ? ' دج' : '%'} مقابل ${x.plan}${x.k === 'cpl' ? ' دج' : '%'}).` }); });

    // الوتيرة: المسار المحدد يوم بيوم (من المحاكي)
    if (sim && sim.logs[pi]) {
      const lg = sim.logs[pi];
      const expUpTo = d => sum(lg.filter(x => x.day <= d), x => x.n);
      const exp = expUpTo(day);
      out.pace = { day, leadsReal: Lpath, leadsPlanned: Math.round(exp), pct: exp > 0 ? Math.round(Lpath / exp * 100) : null };
      if (day >= 7) {
        const w = rowsPath.slice(-7), wL = sum(w, x => +x.leads || 0), wE = expUpTo(day) - expUpTo(day - 7);
        out.pace.week = { real: wL, planned: Math.round(wE), gapPct: wE > 0 ? Math.round((wL / wE - 1) * 100) : null };
        if (phase === 'campaign' && wE > 0 && wL < wE * (1 - RULES.WEEK_GAP)) alerts.push({ lvl: 'warn', code: 'week_behind', product: p.name, msg: `الأسبوع ناقص ${Math.round((1 - wL / wE) * 100)}% على المسار (${wL} ليد مقابل ~${Math.round(wE)}) — وقّف وعاود حسب المسار.` });
      }
      if (phase === 'campaign' && day >= 3 && exp > 0 && Lpath > exp * (1 + RULES.FAST)) alerts.push({ lvl: 'warn', code: 'too_fast', product: p.name, msg: `راك تزدم أسرع من المسار (${Lpath} ليد مقابل ~${Math.round(exp)}). مليح لو الكاش والستوك يلحقو — تأكد من الاتنين قبل ما تزيد الميزانية: الليد يغلى كي تكبر بسرعة.` });
      out.pace.note = 'نهار يطيح ونهار يطلع، عادي — الحكم بالأسبوع.';
    }

    // الستوك
    const lastStock = [...rows].reverse().find(x => x.stockOnHand != null);
    // الستوك يخرج نهار الإرسال (المؤكدة)، ماشي نهار التوصيل — والروتور يرجع من بعد
    const n3 = Math.min(3, day), last3 = rows.slice(-3);
    const shipPerDay = day >= 3 ? sum(last3, x => +x.confirmed || 0) / n3 : R.sendPerDay;
    const backPerDay = day >= 3 ? sum(last3, x => +x.returned || 0) / n3 : 0;
    const usePerDay = Math.max(0, shipPerDay - backPerDay * 0.8);
    const prepD = (p.prep > 0 ? p.prep : (p.ready ? 1 : ctx.prepDays));
    const reorder = Math.ceil(usePerDay * (prepD + 2 + RULES.SAFETY_DAYS)); // التحضير + الإرسال + أيام أمان
    const incoming = (input.incoming && input.incoming[p.name]) || 0;
    out.stock = { onHand: lastStock ? +lastStock.stockOnHand : null, incoming, reorderPoint: reorder, usePerDay: r1(usePerDay), plannedReorderPoint: R.reorderPoint };
    const skipStock = (phase === 'test' && (p.preorder || !lastStock || +lastStock.stockOnHand === 0))
      || (out.testVerdict && !out.testVerdict.early && lastStock && +lastStock.stockOnHand === 0 && !incoming && L - (+rows[rows.length - 1].leads || 0) < RULES.TEST_LEADS);
    // ستوك راقد: عندك أكثر من اللي تبيعو → زيد الأدس (تحت السقف) باش يولّي كاش
    const have = (lastStock ? +lastStock.stockOnHand : 0) + incoming;
    if (phase === 'campaign' && have > 0 && have > Math.max(RULES.MIN_BATCH, usePerDay * (prepD + T) * RULES.IDLE_X) && RR.netPerLead > 0 && (cpl || p.lead) < 0.85 * ceiling) {
      const capLeads = (input.team && input.team.confirmers ? input.team.confirmers : 1) * ctx.confCap * RULES.HIRE_AT;
      const wantShip = have / (prepD + T), wantLeads = Math.min(capLeads, Math.ceil(wantShip / Math.max(0.05, real.conf / 100)));
      out.stock.idle = { pieces: have, daysOfStock: usePerDay > 0 ? Math.round(have / usePerDay) : null, recommendLeadsPerDay: wantLeads };
      if (wantLeads > (L / Math.max(1, rows.length)) * 1.2) alerts.push({ lvl: 'warn', code: 'stock_idle', product: p.name, msg: `📦 عندك ${have} قطعة = ${usePerDay > 0 ? Math.round(have / usePerDay) + ' يوم' : 'بزاف'} بالوتيرة الحالية — ستوك راقد = كاش محبوس. زيد الأدس حتى ~${wantLeads} ليد/يوم (الليد تحت السقف) وما تطلبش دفعة جديدة حتى ينزل.` });
    }
    if (!skipStock && lastStock && +lastStock.stockOnHand + incoming <= reorder) {
      let batch = Math.max(RULES.MIN_BATCH, Math.ceil(usePerDay * (prepD + T) * (1 + (p.ready ? (p.surp != null ? p.surp : 35) / 100 : ctx.surplus * 0.25))));
      const depPct = p.preorder ? p.dep / 100 : 1;
      const sb = sizeBatch(batch, p, input.cashFree, input.cashNow); batch = sb.qty; let cashNote = sb.note;
      if (batch && p.preorder && !sb.split) cashNote += ` الباقي (${fmt(batch * p.buy * (1 - depPct))} دج) يتخلّص بعد ${prepD} أيام — حضّرو من السحب.`;
      out.stock.orderNow = batch;
      alerts.push({ lvl: 'warn', code: batch ? 'reorder' : 'reorder_wait', product: p.name, msg: (p.preorder
        ? `الستوك (${lastStock.stockOnHand}${incoming ? ` + ${incoming} جايين` : ''}) وصل نقطة الطلب (${reorder}) — ${batch ? `خلّص العربون (${p.dep}%) لدفعة ~${batch} قطعة، المقاسات اللي مشات برك.` : 'ما تطلبش اليوم.'}`
        : `الستوك (${lastStock.stockOnHand}${incoming ? ` + ${incoming} جايين` : ''}) وصل نقطة الطلب (${reorder}) — ${batch ? `اطلب دفعة ~${batch} قطعة اليوم.` : 'ما تطلبش اليوم.'}`) + cashNote });
    }

    // الليدات الضايعة
    if (Ab > 0) {
      const left = Math.max(0, Ab - Rc), d0 = real.del / 100, sc = ctx.targetMode === 'cash' ? p.buy * ctx.surplus * 0.5 : 0;
      const val = left * (ctx.abRec / 100) * (d0 * (p.sell - p.buy - ctx.pack - ctx.delCost - sc) - (1 - d0) * ctx.retCost);
      out.abandonedValue = Math.round(val);
      if (val > 0) report.levers.push({ product: p.name, id: 'abandoned', lever: `ترجّع الليدات الضايعة (${left} مازالو)`, gainDzd: Math.round(val), cost: 'بلا أدس', how: 'رد في دقايق، السخون أولاً، ورد آلي في الصفحة وإنستغرام — وعرض صغير (قد ثمن ليد).' });
    }

    const last5 = rowsAll.slice(-5);
    if (phase === 'campaign' && last5.length === 5 && sum(last5, x => +x.confirmed || 0) === 0 && (!lastStock || +lastStock.stockOnHand === 0) && !incoming)
      alerts.push({ lvl: 'stop', code: 'stalled', product: p.name, msg: `⛔ ${p.name} واقف: 5 أيام بلا بيع، بلا ستوك، بلا دفعة جاية. يا تطلب دفعة (حتى 50 على دفعتين)، يا تقرر توقفو — ما تخليهش معلّق.` });
    out.alerts = alerts;
    out.status = alerts.some(a => a.lvl === 'stop') ? 'stop' : (alerts.length || prox.some(x => x.lvl !== 'ok') ? 'warn' : 'ok');
    report.alerts.push(...alerts);
    report.products.push(out);
  });

  // الفريق
  const active = report.products.filter(x => x.real);
  if (active.length) {
    const lpd = sum(active, x => { const rows = (byName[x.name] || []).slice(-3); return sum(rows, r => +r.leads || 0) / Math.max(1, rows.length); });
    const confirmers = +team.confirmers || 0;
    report.team = { leadsPerDayNow: Math.round(lpd), confirmers: confirmers || null, needConfirmers: Math.ceil(lpd / ctx.confCap) };
    if (confirmers && lpd > confirmers * ctx.confCap * RULES.HIRE_AT) report.alerts.push({ lvl: 'warn', code: 'hire', msg: `~${Math.round(lpd)} ليد/يوم = أكثر من 80% من طاقة ${confirmers} مؤكّد — زيد مؤكّد: الليد اللي يستنّى يبرد والتأكيد يطيح.` });
  }

  // المسار الجديد بالأرقام الحقيقية
  const realProducts = products.map((p, i) => {
    const pr = report.products.find(x => x.index === i);
    if (!pr || !pr.real) return p;
    return E.normProduct({ ...p, leadUsd: null, lead: pr.real.cplDzd != null ? pr.real.cplDzd : p.lead,
      conf: pr.real.confPct != null && pr.real.leads >= 30 ? pr.real.confPct : p.conf, del: pr.real.delMeasured ? pr.real.delPct : p.del }, ctx);
  });
  const sel = plan.products.length === 1 ? { single: plan.products[0].index } : plan.products.map(x => x.index);
  const ctx2 = E.makeCtx(E.ctxToInput(ctx));
  const plan2 = E.getChosenPlan(realProducts, ctx2, sel);
  const mine = isFinite(capital) ? E.withMyCapital(realProducts, ctx2, capital, sel) : null;
  report.newPath = { capitalNeeded: plan2.starterCapital, capitalNeededMil: E.mil(plan2.starterCapital), capitalPlanned: capital,
    capitalDelta: isFinite(plan2.starterCapital) && isFinite(capital) ? plan2.starterCapital - capital : null,
    daysWithPlannedCapital: mine && mine.ok ? mine.days : null, periodPlanned: ctx.period, capDays: plan2.capDays, profitable: plan2.finalProfit > 0 };

  const np = report.newPath;
  if (!np.profitable) report.alerts.push({ lvl: 'stop', code: 'plan_losing', msg: 'بالأرقام الحقيقية الخطة كاملة خاسرة — وقّف التكبير، صلّح المنتج ولا العرض.' });
  else {
    if (np.daysWithPlannedCapital != null && np.daysWithPlannedCapital > ctx.period * (1 + RULES.OFF_DAYS))
      report.alerts.push({ lvl: 'warn', code: 'off_path', msg: `بأرقامك الحقيقية ورأس المال المخطط توصل حوالي اليوم ~${np.daysWithPlannedCapital} بدل ${ctx.period} — خارج الوجهة. الحل: الرافعات تحت، ولا تقبل مدة أطول.` });
    else if (np.daysWithPlannedCapital == null && isFinite(capital)) report.alerts.push({ lvl: 'warn', code: 'off_path', msg: 'برأس المال المخطط ما توصلش الهدف بالأرقام الحقيقية — لازم رافعة ولا رأس مال أكثر.' });
    if (np.capitalDelta > capital * 0.15) report.alerts.push({ lvl: 'warn', code: 'capital_up', msg: `الأرقام الحقيقية طلّعت رأس المال اللازم لـ ${np.capitalNeededMil} (+${E.mil(np.capitalDelta) || fmt(np.capitalDelta) + ' دج'}). عادي: الرقم يقدر يطلع — المهم تعرفو دوكا، ماشي في الآخر.` });
  }

  // ترقية المستوى: أرقام ثابتة 30 يوم بلا STOP → تكبير أسرع
  const maxDays = Math.max(0, ...report.products.map(x => x.daysLive || 0));
  const delivTot = report.products.reduce((s2, x) => s2 + (x.real ? sum((byName[x.name] || []), r => +r.delivered || 0) : 0), 0);
  if (ctx.persona === 'beginner' && maxDays >= RULES.PRO_AFTER_DAYS && delivTot >= 100 && np.profitable && !report.alerts.some(a => a.lvl === 'stop'))
    report.levers.push({ id: 'persona_pro', lever: `أرقامك ثابتة ${maxDays} يوم: حوّل لمستوى «محترف» — احتياط 10% وتكبير حتى 50% كل دورة (بدل 25%)` });

  // الرافعات بالأرقام الحقيقية
  if (plan2.finalProfit > 0) {
    const lv = E.levers(realProducts, ctx2, sel, isFinite(capital) ? capital : 0);
    lv.levers.slice(0, 3).forEach(l => report.levers.push({ id: l.id, lever: l.lever, capitalSavedDzd: l.capitalSaved, daysSaved: l.daysSaved }));
  }

  // تنبيهات تتعاود: نعلّمو «مازال من يوم X» باش التقرير ما يولّيش ضجيج
  const prev = input.previous || {};
  const memory = {};
  report.alerts.forEach(a => {
    const k = (a.code || '') + '|' + (a.product || '');
    const since = prev[k] != null ? prev[k] : (input.today || 'today');
    memory[k] = since; a.since = since;
    if (prev[k] != null) { a.repeat = true; a.daysOpen = input.today && prev[k] !== 'today' ? Math.round((new Date(input.today) - new Date(prev[k])) / 864e5) : null; }
  });
  report.memory = memory;
  report.newAlerts = report.alerts.filter(a => !a.repeat).length;

  // الحالة العامة
  const anyStop = report.alerts.some(a => a.lvl === 'stop');
  const off = report.newPath.daysWithPlannedCapital != null && report.newPath.daysWithPlannedCapital > ctx.period * 1.1;
  report.status = !acts.length ? 'info' : (anyStop || !report.newPath.profitable ? 'stop' : (report.alerts.length || off ? 'warn' : 'ok'));
  report.headline = report.status === 'info' ? 'ℹ️ مازال ما كاين حتى رقم حقيقي — دخّل أول نهار تاست باش نبداو المتابعة.'
    : report.status === 'ok' ? '🟢 راك في الوجهة — كمّل كيما راك.'
    : report.status === 'warn' ? '🟡 راك في الطريق، بصح يلزم تدخّل — شوف التنبيهات.'
    : '🔴 STOP LOSS — وقّف المصروف على اللي يخسر قبل ما تزيد دينار.';
  report.cashRule = 'قسّم الكاش اللي يرجع لـ 3 جيوب: ستوك الدورة الجاية • أدس الأسبوع • احتياط. وما تسحبش ربح حتى توصل الهدف.';
  report.text = toText(report, ctx);
  return report;
}

function fmt(n) { return E.fmt(n); }
function fmtU(dzd, ctx) { return '$' + (dzd / ctx.rate).toFixed(2) + ' (' + fmt(dzd) + ' دج)'; }

function toText(R, ctx) {
  const L = [];
  L.push('🧭 البوصلة — متابعة المسار');
  L.push(R.headline);
  L.push(`الخطة: ${R.planLabel} • الهدف ${E.mil(R.target) || fmt(R.target) + ' دج'} ${R.targetMode === 'cash' ? 'كاش' : 'كاش + سلعة'} في ${R.period} يوم`);
  R.products.forEach(p => {
    L.push('');
    L.push(`▪️ ${p.name} — اليوم ${p.day} • ${p.phase === 'test' ? 'تاست' : p.phase === 'campaign' ? 'حملة' : 'ما بداش'}`);
    if (!p.real) return;
    L.push(`  الليد ${p.real.cplUsd != null ? '$' + p.real.cplUsd : '—'} (السقف $${p.ceiling.maxCplUsd}) • التأكيد ${p.real.confPct ?? '—'}% (الفرضية ${p.assumed.confPct}%) • التوصيل ${p.real.delMeasured ? p.real.delPct + '%' : 'مازال بكري'} (الفرضية ${p.assumed.delPct}%)`);
    if (p.pace) L.push(`  الوتيرة: ${p.pace.leadsReal} ليد مقابل ~${p.pace.leadsPlanned} في المسار${p.pace.week ? ` • الأسبوع ${p.pace.week.gapPct > 0 ? '+' : ''}${p.pace.week.gapPct}%` : ''}`);
    if (p.test) L.push(`  التاست: باقي ${p.test.leadsLeft} ليد (~${fmt(p.test.budgetLeftDzd)} دج أدس) — استثمار، ماشي خسارة.`);
    if (p.testVerdict) L.push(`  حكم التاست: ${p.testVerdict.msg}`);
  });
  if (R.alerts.length) { L.push(''); L.push('⚠️ التدخلات:'); R.alerts.forEach(a => L.push(`  ${a.lvl === 'stop' ? '🔴' : '🟡'} ${a.msg}`)); }
  if (R.levers.length) { L.push(''); L.push('🔑 الروافع:'); R.levers.forEach(l => L.push(`  • ${l.product ? l.product + ': ' : ''}${l.lever}${l.gainDzd ? ` ← ~${E.mil(l.gainDzd) || fmt(l.gainDzd) + ' دج'} ${l.cost || ''}` : ''}${l.capitalSavedDzd > 0 ? ` ← رأس المال −${E.mil(l.capitalSavedDzd) || fmt(l.capitalSavedDzd) + ' دج'}` : ''}${l.daysSaved > 0 ? `، ${l.daysSaved} يوم أقل` : ''}`)); }
  const np = R.newPath;
  L.push('');
  L.push(`🗺️ المسار الجديد بأرقامك الحقيقية: رأس المال اللازم ${np.capitalNeededMil || fmt(np.capitalNeeded)}${np.daysWithPlannedCapital ? ` • برأس مالك توصل حوالي اليوم ~${np.daysWithPlannedCapital}` : ''}.`);
  L.push('البوصلة ما تعدكش — ترسم المسار. كي تتبدّل الأرقام، يتبدّل المسار.');
  L.push(R.cashRule);
  return L.join('\n');
}

const api = { suivre, RULES };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BoussalaSuivre = api;
