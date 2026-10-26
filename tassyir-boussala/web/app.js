// الواجهة: تقرا snapshot واحد من المحرّك (/api/snapshot) — حتى رقم ما يتحسب هنا.
import { money, pct, num } from '/engine/format.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// كل رقم معزول في span LTR
const L = (t) => esc(t).replace(/(−|-)?[0-9](?:[0-9,.%$:]|-(?=[0-9]))*/g, (m) => `<span dir="ltr">${m}</span>`);
const M = (v) => L(money(v));
const S = (v) => L(money(v, { small: true }));
const P = (v) => L(pct(v));
const src = (t) => `<span class="src">${esc(t)}</span>`;

const ZONE = { green: ['green', '🟢 صحي'], yellow: ['yellow', '🟡 تدهور'], red: ['red', '🔴 خطر'] };
const LEVEL = { stop: ['red', '🛑 وقف'], danger: ['red', '🔴 خطر'], decline: ['yellow', '🟡 تدهور'], locked: ['ice', '🧊 محبوس'], data: ['gray', '⚙️ بيانات'] };
const STAGES = ['TEST', 'FIX', 'VALIDE', 'SCALE', 'HARVEST', 'DESTOCK', 'ECHEC-ADS', 'ECHEC-CONF', 'ECHEC-RESERVE'];
const STOCK_BADGE = { 'اطلب اليوم': 'red', 'مرتاح': 'green', 'محبوس': 'ice', 'بلا بيع بعد': 'gray', 'خلاص — تصفية': 'gray' };

let SNAP = null;
let stageFilter = null;
let leverFilter = 'all';
try {
  stageFilter = localStorage.getItem('b.stage');
} catch {
  /* التخزين ممنوع ← عادي */
}

// App Bridge: كي تكون الصفحة داخل لوحة تسيير، نخبرو اللوحة بالعنوان. برا اللوحة ما يصرا والو.
const bridge = window.TassyirAppBridge || null;

async function api(path, opt) {
  const r = await fetch(path, opt);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 2600);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('تنسخت — حطّها لـ Tassya');
  } catch {
    toast(text);
  }
}

// ───────────── الرسوم (SVG) ─────────────
function chart({ series = [], band, hlines = [], markers = [], w = 640, h = 230, pad = 34 }) {
  const all = [...series.flatMap((s) => s.pts.map((p) => p[1])), ...hlines.map((l) => l.y), ...(band ? [...band.lo.map((p) => p[1]), ...band.hi.map((p) => p[1])] : [])].filter(Number.isFinite);
  const xs = series.flatMap((s) => s.pts.map((p) => p[0]));
  if (!all.length || !xs.length) return '<p class="muted small">ما كاينش أرقام بعد.</p>';
  let lo = Math.min(...all, 0);
  let hi = Math.max(...all, 0);
  if (hi === lo) hi = lo + 1;
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs, x0 + 1);
  const X = (x) => pad + ((x - x0) / (x1 - x0)) * (w - pad - 8);
  const Y = (y) => 8 + (1 - (y - lo) / (hi - lo)) * (h - 30);
  const path = (pts) => pts.filter((p) => Number.isFinite(p[1])).map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  let svg = `<svg class="chart" viewBox="0 0 ${w} ${h}" dir="ltr" role="img" aria-label="منحنى">`;
  svg += `<line x1="${pad}" x2="${w - 8}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)"/>`;
  svg += `<text x="2" y="${Y(hi) + 8}">${money(hi)}</text><text x="2" y="${Y(lo)}">${money(lo)}</text>`;
  if (band) {
    const poly = [...band.hi, ...band.lo.slice().reverse()].map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
    svg += `<polygon points="${poly}" fill="var(--cone)"/>`;
  }
  for (const l of hlines) {
    svg += `<line x1="${pad}" x2="${w - 8}" y1="${Y(l.y)}" y2="${Y(l.y)}" stroke="${l.color}" stroke-dasharray="${l.dash || '5 4'}" stroke-width="1.5"/>`;
    svg += `<text x="${w - 10}" y="${Y(l.y) - 4}" text-anchor="end" style="fill:${l.color}">${esc(l.label)}</text>`;
  }
  for (const s of series) {
    svg += `<path d="${path(s.pts)}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  for (const m of markers) {
    svg += `<line x1="${X(m.x)}" x2="${X(m.x)}" y1="8" y2="${h - 22}" stroke="var(--gold)" stroke-dasharray="2 3"/>`;
    svg += `<text x="${X(m.x) + 3}" y="18" style="fill:var(--gold)">${esc(m.label)}</text>`;
  }
  svg += `<text x="${pad}" y="${h - 6}">${x0}</text><text x="${w - 8}" y="${h - 6}" text-anchor="end">${x1}</text>`;
  return svg + '</svg>';
}

function spark(points) {
  if (!points?.length) return '';
  const ys = points.flatMap((p) => [p.real, p.worst, p.mid]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys, lo + 1);
  const W = 84;
  const H = 34;
  const pth = (k) => points.map((p, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, points.length - 1)) * W).toFixed(1)},${(H - 2 - ((p[k] - lo) / (hi - lo)) * (H - 4)).toFixed(1)}`).join('');
  const z = points.at(-1).zone;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" dir="ltr" aria-hidden="true"><path d="${pth('worst')}" stroke="var(--red)" stroke-width="1" fill="none" stroke-dasharray="2 2"/><path d="${pth('mid')}" stroke="var(--gold)" stroke-width="1" fill="none" stroke-dasharray="3 2"/><path d="${pth('real')}" stroke="var(--${z === 'red' ? 'red' : z === 'yellow' ? 'yellow' : 'green'})" stroke-width="2" fill="none"/></svg>`;
}

const zoneBadge = (z) => (ZONE[z] ? `<span class="badge ${ZONE[z][0]}">${ZONE[z][1]}</span>` : '<span class="badge gray">⚪</span>');
const tagBadge = (t) => `<span class="badge gold">${esc(t || 'بلا تاغ')}</span>`;
const levelBadge = (l) => `<span class="badge ${LEVEL[l][0]}">${LEVEL[l][1]}</span>`;
const say = (text) => `<div class="say"><span>${L(text)}</span><button class="btn" data-copy="${esc(text)}">جملة لـ Tassya</button></div>`;

// ───────────── الشاشات ─────────────
function trustCard() {
  const t = SNAP.trust;
  const c = t.canJudge ? 'green' : 'red';
  return `<div class="card"><div class="trust"><div class="ring badge ${c}" style="width:54px;height:54px;font-size:16px"><span dir="ltr">${t.score}</span></div>
  <div><h3>ثقة البيانات</h3><div class="small muted">${t.items.map((i) => `${i.ok ? '✅' : '❌'} ${esc(i.label)}`).join(' • ')}</div>
  ${t.canJudge ? '' : `<p class="small" style="color:var(--red)">تحت ${L(String(SNAP.policy.trustMin))}: ما كاينش حكم. الواجب: ${esc(t.missing.join('، '))}</p>`}</div></div></div>`;
}

function splitCard(sp, title = 'الربح المقسوم') {
  const tot = sp.paper || 1;
  const w = (x) => `${Math.max(0, (x / tot) * 100).toFixed(1)}%`;
  return `<div class="card"><h3>${title}</h3>
  <div class="kpi"><span class="muted small">ربحك على الورق</span><span class="v">${M(sp.paper)}</span></div>
  <div class="bar" style="margin:8px 0"><span style="width:${w(sp.cash)};background:var(--green)"></span><span style="width:${w(sp.atCarrier)};background:var(--blue)"></span><span style="width:${w(sp.locked)};background:var(--ice);opacity:.6"></span></div>
  <ul class="list small">
    <li>💵 كاش في اليد: <b>${M(sp.cash)}</b> ${src('⟵ المحافظ (كتبتو أنت)')}</li>
    <li>🚚 عند شركة التوصيل (موصّل وماشي مقبوض): <b>${M(sp.atCarrier)}</b> — أقدم قبض ${L(String(sp.oldestCarrierDays))} يوم ${src('⟵ الطلبيات')}</li>
    <li>📦 محبوس في السلعة: <b>${M(sp.locked)}</b> ← منها ${M(sp.slowLocked)} في متغيّرات فوق ${L(String(SNAP.policy.coverLimitDays))} يوم تغطية ${src('⟵ المخزون × سعر الشراء')}</li>
  </ul>
  <p style="margin-top:8px"><b>الحكم:</b> «الربح الحقيقي اللي تقدر تصرفو اليوم = ${M(sp.spendable)}.${sp.slowLocked > 0 ? ' ما تطلبش دفعة جديدة على منتج فيه ستوك محبوس.' : ''}»</p></div>`;
}

function home() {
  const s = SNAP;
  const eq = s.equity;
  let html = trustCard();
  if (!s.trust.canJudge) return html + splitCard(s.split);
  html += `<div class="card"><h3>منحنى البيزنس كامل</h3>
  ${chart({
    series: [
      { pts: eq.points.map((p, i) => [i + 1, p.equity]), color: 'var(--green)', width: 2.4 },
      { pts: eq.points.map((p, i) => [i + 1, p.reference]), color: 'var(--gold)', dash: '5 4', width: 1.4 },
      { pts: eq.points.map((p, i) => [i + 1, p.cash]), color: 'var(--blue)', width: 1.2 },
    ],
    hlines: [{ y: eq.reserve, label: 'خط الاحتياط', color: 'var(--red)' }],
  })}
  <div class="legend"><span><i style="background:var(--green)"></i>رأس المال الكلّي</span><span><i style="background:var(--gold)"></i>الالتزام 9 من 10</span><span><i style="background:var(--blue)"></i>الكاش في المحافظ</span><span><i style="background:var(--red)"></i>الاحتياط</span></div>
  <p class="small muted">التراجع: ${M(eq.drawdown)} (${P(eq.drawdownPct)}) • ${eq.aboveReference >= 0 ? 'فوق' : 'تحت'} الالتزام بـ ${M(Math.abs(eq.aboveReference))} ${src('⟵ المحافظ + شركة التوصيل + المخزون')}</p></div>`;
  const fp = s.firstProblem;
  html += `<div class="grid two"><div class="card hl"><h3>المشكل الأول اليوم</h3>${fp ? `${levelBadge(fp.level)} <p>${L(fp.text)}</p><p><b>دير:</b> ${esc(fp.todo)}</p>` : '<p>ما كاينش.</p>'}</div>
  <div class="card"><h3>3 حوايج اليوم</h3><ol class="list">${s.today3.map((t) => `<li><b>${esc(t.text)}</b> — ${M(t.dzdPerDay)}/نهار <span class="muted small">(${esc(t.who)})</span>${say(t.say)}</li>`).join('')}</ol></div></div>`;
  html += `<div class="grid two" style="margin-top:12px">${splitCard(s.split)}<div class="card"><h3>التحذيرات</h3><ul class="list">${s.alerts.slice(0, 6).map(alertLi).join('')}</ul>${s.alerts.length > 6 ? `<p class="small muted">+${L(String(s.alerts.length - 6))} ← شوف الروافع والتحذيرات</p>` : ''}</div></div>`;
  html += `<div id="approvals"></div>`;
  return html;
}

const alertLi = (a) => `<li class="alert ${a.level}">${levelBadge(a.level)} ${a.product ? `<b>${esc(a.product)}</b>: ` : ''}${L(a.text)}${a.action ? `<div class="small muted">← ${esc(a.action)}${a.needsApproval ? ' (بموافقتك)' : ''}</div>` : ''}</li>`;

function products() {
  const s = SNAP;
  const counts = {};
  s.products.forEach((p) => (counts[p.stage || '—'] = (counts[p.stage || '—'] || 0) + 1));
  let html = `<div class="chips"><button class="chip ${!stageFilter ? 'on' : ''}" data-stage="">الكل<b dir="ltr">${s.products.length}</b></button>${STAGES.filter((st) => counts[st]).map((st) => `<button class="chip ${stageFilter === st ? 'on' : ''}" data-stage="${st}">${st}<b dir="ltr">${counts[st]}</b></button>`).join('')}</div>`;
  const groups = Object.entries(s.byStage).filter(([st]) => !stageFilter || st === stageFilter);
  for (const [st, list] of groups) {
    html += `<h2>${esc(st)} <span class="muted small">${esc(list[0]?.stageLabel || '')} — الأقرب للخطر أولاً</span></h2>`;
    for (const p of list) html += productRow(p);
  }
  return html;
}

function productRow(p) {
  if (p.unresolved) return `<a class="row" href="#product/${p.id}"><span class="badge gray">؟</span><div><b>${esc(p.name)}</b> ${tagBadge(p.stage)}<div class="meta">غير محسوم — ناقص: ${esc(p.missing.join('، '))}</div></div></a>`;
  const top = p.levers[0];
  return `<a class="row" href="#product/${p.id}">${spark(p.curve.points)}<div><b>${esc(p.name)}</b> ${tagBadge(p.stage)} ${zoneBadge(p.curve.zone)} <span class="badge gray">${esc(p.verdict)}</span>
  <div class="meta"><span>صافي الموصلة <b>${S(p.cases.mid.netPerDelivered)}</b></span><span>التغطية <b>${Number.isFinite(p.coverDays) ? L(num(p.coverDays)) + ' يوم' : '∞'}</b></span>${top ? `<span>أكبر رافعة <b>${M(top.dzdPerDay)}</b>/نهار</span>` : ''}</div></div></a>`;
}

function productPage(id) {
  const p = SNAP.products.find((x) => x.id === id);
  if (!p) return '<p>ماكاش هذا المنتج.</p>';
  if (p.unresolved) return `<h2>${esc(p.name)}</h2><div class="card"><p>غير محسوم. يلزمنا: ${esc(p.missing.join('، '))}</p></div>`;
  const c = p.cases;
  const pts = p.curve.points;
  const markers = [];
  const launch = Date.parse(pts[0]?.date);
  for (const h of p.tagHistory) {
    if (h.to === 'VALIDE' || h.to === 'DESTOCK' || h.to === 'SCALE') markers.push({ x: Math.round((Date.parse(h.date) - launch) / 86400000) + 1, label: h.to === 'VALIDE' ? '✅ VALIDE' : h.to === 'DESTOCK' ? '📦 DESTOCK' : '⤴ SCALE' });
  }
  for (const sg of p.signals) markers.push({ x: pts.length, label: sg.icon });
  const cls = p.classification;
  let html = `<h2>${esc(p.name)} ${tagBadge(p.stage)} ${zoneBadge(p.curve.zone)}</h2>
  <div class="card"><h3>منحنى الترايدينغ</h3>
  ${chart({
    band: { lo: pts.map((x) => [x.day, x.worst]), hi: pts.map((x) => [x.day, x.best]) },
    series: [
      { pts: pts.map((x) => [x.day, x.mid]), color: 'var(--gold)', dash: '6 4', width: 1.4 },
      { pts: pts.map((x) => [x.day, x.worst]), color: 'var(--red)', dash: '2 3', width: 1 },
      { pts: pts.map((x) => [x.day, x.withCarrier]), color: 'var(--blue)', dash: '1 3', width: 1.2 },
      { pts: pts.map((x) => [x.day, x.real]), color: 'var(--text)', width: 2.4 },
    ],
    hlines: p.curve.stopLine !== null ? [{ y: p.curve.stopLine, label: '🛑 خط الستوب', color: 'var(--red)', dash: '8 3' }] : [],
    markers,
  })}
  <div class="legend"><span><i style="background:var(--text)"></i>الخط الحقيقي (كاش)</span><span><i style="background:var(--gold)"></i>الوسط</span><span><i style="background:var(--red)"></i>الأسوأ / الستوب</span><span><i style="background:var(--cone)"></i>مخروط البوصلة</span><span><i style="background:var(--blue)"></i>كاش + عند شركة التوصيل</span></div>
  <p class="small muted">الأفقي: الأيام من «لانسي» • العمودي: الكاش الصافي التراكمي ${src('⟵ تسيير + ميتا')}</p>
  ${p.signals.length ? `<ul class="list small" style="margin-top:8px">${p.signals.map((s) => `<li>${s.icon} <b>${esc(s.label)}</b> (${L(s.date || '')}): ${L(s.detail)}</li>`).join('')}</ul>` : ''}
  ${p.stopNoLead ? '<p style="color:var(--red)">🛑 ستوب بلا ليد</p>' : ''}${p.trailingStop ? '<p style="color:var(--red)">🛑 الستوب المتحرّك ← نقّص</p>' : ''}
  </div>
  <div class="grid two" style="margin-top:12px"><div class="card"><h3>الحدود</h3><table class="tbl">
  <tr><th>الرقم</th><th>الوسط</th><th>الأسوأ</th><th>المصدر</th></tr>
  <tr><td>صافي الموصلة</td><td>${S(c.mid.netPerDelivered)}</td><td>${S(c.worst.netPerDelivered)}</td><td>${src('⟵ المحرّك')}</td></tr>
  <tr><td>ثمن الليد</td><td>${S(c.mid.lead)}</td><td>${S(c.worst.lead)}</td><td>${src(p.sources.lead)}</td></tr>
  <tr><td>أغلى ليد</td><td>${S(c.mid.maxLead)}</td><td>${S(c.worst.maxLead)}</td><td>${src('⟵ المحرّك')}</td></tr>
  <tr><td>السقف (على المؤكّدة)</td><td>${S(c.mid.ceiling)}</td><td>${S(c.worstCeiling)}</td><td>${src('السقف الأسوأ = التوصيل الأسوأ')}</td></tr>
  <tr><td>التأكيد / أرضيتو</td><td>${P(c.mid.conf)} / ${P(c.mid.minConf)}</td><td>${P(c.worst.conf)}</td><td>${src(p.sources.conf)}</td></tr>
  <tr><td>التوصيل / أرضيتو</td><td>${P(c.mid.del)} / ${P(c.mid.minDel)}</td><td>${P(c.worst.del)}</td><td>${src(p.sources.del)}</td></tr>
  <tr><td>أقل سعر</td><td>${S(c.mid.minPrice)}</td><td>${S(c.worst.minPrice)}</td><td>${src('⟵ المحرّك')}</td></tr>
  <tr><td>الحد (cap)</td><td colspan="2">${M(p.cap)}</td><td>${src('⟵ كتبتو أنت')}</td></tr>
  ${p.plan?.plannable ? `<tr><td>الخطة</td><td colspan="2">${L(num(p.plan.leadsPerDay, 1))} ليد/نهار — سقف السوق ${L(num(p.plan.marketCap))}${p.plan.capped ? ' — الهدف ما يتوصلش بهذا المنتج وحدو' : ''}</td><td>${src('⟵ تاريخ المنتج')}</td></tr>
  <tr><td>الالتزام 9 من 10</td><td colspan="2">${M(p.monteCarlo.commitment)} (الوسط ${M(p.monteCarlo.median)})</td><td>${src(`⟵ ${SNAP.policy.scenarios} سيناريو`)}</td></tr>
  <tr><td>رأس المال اللازم</td><td colspan="2">${M(p.capital.capital)} (دورة ${L(String(p.capital.cycleDays))} يوم)</td><td>${src('⟵ المحاكي يوم بيوم')}</td></tr>` : `<tr><td>الخطة</td><td colspan="3">${esc(p.plan?.reason || 'ما كاينش هدف مكتوب')}</td></tr>`}
  </table></div>
  <div class="card"><h3>الحكم: ${esc(p.verdict)}</h3>
  <p>المرحلة المقترحة: ${tagBadge(cls.stage)} — ${L(cls.why)}</p>
  ${cls.changed ? `<button class="btn gold" data-tag="${p.id}" data-stage="${cls.stage}">اكتب التاغ ${esc(cls.stage)}</button> <span class="small muted">(خطر قليل — يحافظ على التاغات القدام)</span>` : ''}
  <p style="margin-top:8px"><b>السبب الجذري:</b> ${esc(p.rootCause.cause)} — ${esc(p.rootCause.verdict)} ${p.rootCause.why.length ? `<span class="small muted">(${L(p.rootCause.why.join('، '))})</span>` : ''}</p>
  ${p.rootCause.maxLeadAtTarget ? `<p class="small">بتأكيد الهدف: أغلى ليد ${S(p.rootCause.maxLeadAtTarget)}</p>` : ''}
  <p class="small muted">البوابة: ${p.gate.open ? 'مفتوحة' : L(p.gate.blockers.join('، '))}</p>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn red" data-act="pause_offer" data-p="${p.id}">توقيف العرض</button><button class="btn" data-act="scale_up" data-p="${p.id}">تكبير</button><button class="btn" data-act="destock" data-p="${p.id}">تصفية</button></div>
  <p class="small muted">التوقيف ديما مسموح. الأفعال الكبار تولّي بطاقة موافقة، والتنفيذ بيدك ولا بـ Tassya.</p></div></div>
  <div class="grid two" style="margin-top:12px">${splitCard({ paper: p.profit.paper, cash: p.profit.cash, atCarrier: p.profit.pending, locked: p.profit.stockAtCost, slowLocked: p.profit.slowStock, spendable: Math.max(0, p.profit.cash), oldestCarrierDays: 0 }, 'الربح المقسوم تاع المنتج')}
  <div class="card"><h3>الستوك والتعمير</h3>${stockTable(p.variants.map((v) => ({ ...v, product: p.name })))}</div></div>
  <h2>الروافع والتحذيرات</h2><div class="grid two"><div>${p.levers.map(leverCard).join('') || '<p class="muted">ما كاينش.</p>'}</div><div class="card"><ul class="list">${p.alerts.map(alertLi).join('') || '<li>ما كاينش.</li>'}</ul></div></div>
  <h2>تاريخ القرارات</h2><div class="card"><table class="tbl stack"><thead><tr><th>وقتاش</th><th>من</th><th>لـ</th><th>علاش</th></tr></thead><tbody>${p.tagHistory.map((h) => `<tr><td data-l="وقتاش">${L(h.date)}</td><td data-l="من">${esc(h.from || '—')}</td><td data-l="لـ">${esc(h.to)}</td><td data-l="علاش">${L(h.why)}</td></tr>`).join('')}</tbody></table></div>`;
  return html;
}

function stockTable(rows) {
  return `<div class="tblwrap"><table class="tbl stack"><thead><tr><th>المتغيّر</th><th>المتاح</th><th>السرعة</th><th>التغطية</th><th>نقطة الطلب</th><th>المقترح</th><th>الحالة</th></tr></thead><tbody>
  ${rows.map((v) => `<tr><td data-l="المتغيّر"><b>${esc(v.product)}</b> ${esc(v.label)} <span class="small muted">(${P(v.demandShare)} من الطلب)</span></td><td data-l="المتاح">${L(num(v.available))}</td><td data-l="السرعة">${L(num(v.velocity, 1))}/نهار</td><td data-l="التغطية">${Number.isFinite(v.coverDays) ? L(num(v.coverDays)) + ' يوم' : '∞'}</td><td data-l="نقطة الطلب">${L(num(v.reorderPoint))}</td><td data-l="المقترح">${v.suggested ? L(num(v.suggested)) : '—'}</td><td data-l="الحالة"><span class="badge ${STOCK_BADGE[v.status] || 'gray'}">${esc(v.status)}</span></td></tr>`).join('')}
  </tbody></table></div><p class="small muted">${src('⟵ المخزون: Sellable (ماشي totalItems)')}</p>`;
}

function stock() {
  const rows = SNAP.products.filter((p) => !p.unresolved).flatMap((p) => p.variants.map((v) => ({ ...v, product: p.name })));
  const order = { 'اطلب اليوم': 0, 'محبوس': 1, 'مرتاح': 2 };
  rows.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  return `<h2>الستوك والتعمير</h2><div class="card">${stockTable(rows)}</div>`;
}

function leverCard(l) {
  return `<div class="card" style="margin-bottom:8px"><h3>${esc(l.title)}${l.product ? ` — ${esc(l.product)}` : ''} <span class="badge gold">${M(l.dzdPerDay)}/نهار</span></h3>
  <p class="small">${L(l.why)}</p>${l.capitalFreed ? `<p class="small">رأس مال يتحرّر: <b>${M(l.capitalFreed)}</b></p>` : ''}<p class="small muted">${esc(l.source)}</p>
  <ol class="stepper">${l.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>${say(l.say)}</div>`;
}

function levers() {
  const s = SNAP;
  const sections = [...new Set(s.levers.map((l) => l.section))];
  const f = (l) => leverFilter === 'all' || (leverFilter === 'biz' && l.scope === 'بيزنس') || l.productId === leverFilter || l.section === leverFilter;
  const list = s.levers.filter(f);
  return `<h2>الروافع <span class="muted small">مرتّبين بالأثر في النهار</span></h2>
  <div class="chips"><button class="chip ${leverFilter === 'all' ? 'on' : ''}" data-lf="all">الكل</button><button class="chip ${leverFilter === 'biz' ? 'on' : ''}" data-lf="biz">البيزنس</button>
  ${s.products.filter((p) => !p.unresolved).map((p) => `<button class="chip ${leverFilter === p.id ? 'on' : ''}" data-lf="${p.id}">${esc(p.name)}</button>`).join('')}
  ${sections.map((x) => `<button class="chip ${leverFilter === x ? 'on' : ''}" data-lf="${esc(x)}">${esc(x)}</button>`).join('')}</div>
  <div class="card hl"><p>الربح اللي خلّصت عليه ديجا ويفيض في الفراغ: <b>${M(s.leversTotal)}</b>/نهار</p></div>
  <div class="grid two" style="margin-top:12px">${list.map(leverCard).join('')}</div>
  <h2>التحذيرات</h2><div class="card"><ul class="list">${s.alerts.map(alertLi).join('')}</ul></div>`;
}

async function report() {
  const [rep, archive] = await Promise.all([api('/api/report/today'), api('/api/report/archive')]);
  return `<h2>تقرير اليوم <span class="muted small">${L(rep.date)} — يتبعث على ${L(String(SNAP.policy.reportHour).padStart(2, '0') + ':00')}</span></h2>
  ${rep.sections.map((s) => `<div class="card" style="margin-bottom:8px"><h3>${esc(s.title)}</h3><ul class="list small">${s.lines.map((l) => {
    const m = l.match(/«(يا Tassya[^»]+)»/);
    return `<li>${L(l.replace(/ — «يا Tassya[^»]+»/, ''))}${m ? say(m[1]) : ''}</li>`;
  }).join('')}</ul></div>`).join('')}
  <h2>الأرشيف</h2><div class="card"><ul class="list small">${archive.map((a) => `<li>${L(a.date)}</li>`).join('') || '<li>فارغ</li>'}</ul></div>`;
}

async function approvals() {
  const box = $('#approvals');
  if (!box) return;
  const list = await api('/api/approvals');
  if (!list.length) return;
  box.innerHTML = `<h2>بطاقات الموافقة</h2>${list.map((c) => `<div class="card" style="margin-bottom:8px"><b>${esc(c.type)}</b> — ${esc(c.payload?.productName || '')} <span class="small muted">${L(c.why || '')}</span>
  <div style="display:flex;gap:6px;margin-top:6px"><button class="btn gold" data-approve="${c.id}">وافق</button><button class="btn" data-reject="${c.id}">رفض</button></div></div>`).join('')}`;
}

// ───────────── التوجيه ─────────────
async function render() {
  const hash = location.hash.slice(1) || 'home';
  const [route, id] = hash.split('/');
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${route === 'product' ? 'products' : route}`));
  const app = $('#app');
  try {
    if (route === 'products') app.innerHTML = products();
    else if (route === 'product') app.innerHTML = productPage(id);
    else if (route === 'stock') app.innerHTML = stock();
    else if (route === 'levers') app.innerHTML = levers();
    else if (route === 'report') app.innerHTML = await report();
    else {
      app.innerHTML = home();
      await approvals();
    }
  } catch (e) {
    app.innerHTML = `<div class="card"><p>ما قدرناش نحسبو: ${esc(e.message)}</p></div>`;
  }
  bridge?.setTitle?.('البوصلة');
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.copy) return copy(t.dataset.copy);
  if (t.dataset.stage !== undefined) {
    stageFilter = t.dataset.stage || null;
    try {
      localStorage.setItem('b.stage', stageFilter || '');
    } catch {
      /* عادي */
    }
    return render();
  }
  if (t.dataset.lf) {
    leverFilter = t.dataset.lf;
    return render();
  }
  if (t.dataset.tag) {
    await api('/api/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'write_tag', payload: { productId: t.dataset.tag, stage: t.dataset.stage } }) });
    toast('التاغ تكتب، والتاغات القدام باقيين');
    return load();
  }
  if (t.dataset.act) {
    const p = SNAP.products.find((x) => x.id === t.dataset.p);
    const r = await api('/api/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: t.dataset.act, payload: { productId: p.id, productName: p.name }, why: p.classification.why }) });
    toast(r.status === 'pending' ? 'تحطّت بطاقة موافقة في الرئيسية' : 'تدار');
    return;
  }
  if (t.dataset.approve || t.dataset.reject) {
    await api(`/api/approvals/${t.dataset.approve || t.dataset.reject}/${t.dataset.approve ? 'approve' : 'reject'}`, { method: 'POST' });
    toast(t.dataset.approve ? 'موافقة — التنفيذ بيدك ولا بـ Tassya' : 'ترفضت');
    return render();
  }
});

async function load() {
  SNAP = await api('/api/snapshot');
  $('#demoBadge').hidden = !SNAP.demo;
  await render();
}
window.addEventListener('hashchange', render);
load().catch((e) => ($('#app').innerHTML = `<div class="card"><p>ما قدرناش نوصلو للخادم: ${esc(e.message)}</p></div>`));
