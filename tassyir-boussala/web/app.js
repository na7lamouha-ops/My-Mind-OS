// الواجهة: تقرا snapshot واحد من المحرّك (/api/snapshot) — حتى رقم ما يتحسب هنا.
// الشكل: كيما Analytics تسيير — فترة، بطاقات بالمقارنة، قمع، رسم واحد، جداول قصيرة.
import { money, pct, num } from '/engine/format.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// كل رقم معزول في span LTR
const L = (t) => esc(t).replace(/(−|-)?[0-9](?:[0-9,.%$:]|-(?=[0-9]))*/g, (m) => `<span dir="ltr">${m}</span>`);
const M = (v) => L(money(v));
const S = (v) => L(money(v, { small: true }));
const P = (v) => L(pct(v));

const ZONE = { green: ['green', 'صحي'], yellow: ['yellow', 'تدهور'], red: ['red', 'خطر'] };
const LEVEL = { stop: ['red', '🛑 وقف'], danger: ['red', '🔴 خطر'], decline: ['yellow', '🟡 تدهور'], locked: ['ice', '🧊 محبوس'], data: ['gray', '⚙️ بيانات'] };
const VERDICT = { 'كمّل': 'green', 'كبّر': 'green', 'صلّح': 'yellow', 'نقّص': 'yellow', 'صفّي': 'ice', 'وقّف': 'red' };
const STAGES = ['TEST', 'FIX', 'VALIDE', 'SCALE', 'HARVEST', 'DESTOCK', 'ECHEC-ADS', 'ECHEC-CONF', 'ECHEC-RESERVE'];
const STOCK_BADGE = { 'اطلب اليوم': 'red', 'مرتاح': 'green', 'محبوس': 'ice', 'بلا بيع بعد': 'gray', 'خلاص — تصفية': 'gray' };
const PERIODS = [[1, 'اليوم'], [7, '7 أيام'], [30, '30 يوم']];

let SNAP = null;
let period = 7;
let stageFilter = null;
let leverFilter = 'all';
const mem = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* التخزين ممنوع ← عادي */
    }
  },
};
period = Number(mem.get('b.period')) || 7;
stageFilter = mem.get('b.stage') || null;

// App Bridge: داخل لوحة تسيير نخبرو اللوحة بالعنوان. برا اللوحة ما يصرا والو.
const bridge = window.TassyirAppBridge || null;

async function api(path, opt) {
  const r = await fetch(path, opt);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

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

// ───────────── قطع صغيرة ─────────────
const badge = (cls, txt) => `<span class="badge ${cls}">${txt}</span>`;
const tagBadge = (t) => badge('tag', esc(t || 'بلا تاغ'));
const zoneDot = (z) => (ZONE[z] ? `<span class="dot ${ZONE[z][0]}" title="${ZONE[z][1]}"></span>${ZONE[z][1]}` : '—');
const verdictBadge = (v) => badge(VERDICT[v] || 'gray', esc(v));
const levelBadge = (l) => badge(LEVEL[l][0], LEVEL[l][1]);
const say = (text) => `<button class="link" data-copy="${esc(text)}">📋 جملة لـ Tassya</button>`;
// في التيليفون الخانة تولّي flex: نلفّو المحتوى في span باش الرقم والوحدة يبقاو مع بعض
const wrapTd = (html) => html.replace(/(<td data-l="[^"]*"[^>]*>)([\s\S]*?)(<\/td>)/g, '$1<span class="v">$2</span>$3');
const cover = (d) => (Number.isFinite(d) ? `${L(num(d))} يوم` : '∞');

// تغيير قدّام الفترة السابقة. kind: 'rel' (نسبة) ولا 'pts' (نقاط). bad=true كي الطلوع ماشي مليح (الإعلانات).
function delta(v, kind = 'rel', bad = false) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '<span class="delta">—</span>';
  const up = v > 0;
  const good = bad ? !up : up;
  const txt = kind === 'pts' ? `${up ? '+' : '−'}${Math.abs(v * 100).toFixed(1)} نقطة` : `${up ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`;
  return `<span class="delta ${v === 0 ? '' : good ? 'up' : 'down'}">${up ? '▲' : v < 0 ? '▼' : ''} ${L(txt)}</span>`;
}

function kpi(label, value, d, src) {
  return `<div class="kpi"><span class="kl">${label}</span><span class="kv">${value}</span><span class="kd">${d}</span>${src ? `<span class="ks">${esc(src)}</span>` : ''}</div>`;
}

// ───────────── الرسوم ─────────────
function bars(series) {
  const w = 640;
  const h = 170;
  const vals = series.map((s) => s.profit);
  const hi = Math.max(...vals, 0);
  const lo = Math.min(...vals, 0);
  const span = hi - lo || 1;
  const bw = (w - 16) / series.length;
  const Y = (v) => 10 + ((hi - v) / span) * (h - 36);
  let svg = `<svg class="chart" viewBox="0 0 ${w} ${h}" dir="ltr" role="img" aria-label="الربح الكاش في النهار">`;
  svg += `<line x1="8" x2="${w - 8}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line-strong)"/>`;
  series.forEach((s, i) => {
    const y = Y(Math.max(s.profit, 0));
    const hh = Math.max(1, Math.abs(Y(s.profit) - Y(0)));
    svg += `<rect x="${8 + i * bw + bw * 0.15}" y="${y}" width="${bw * 0.7}" height="${hh}" rx="2" fill="var(--${s.profit >= 0 ? 'green' : 'red'})"><title>${s.date}: ${money(s.profit)}</title></rect>`;
  });
  const dm = (d) => (d ? `${d.slice(8)}/${d.slice(5, 7)}` : '');
  const first = dm(series[0]?.date);
  const last = dm(series.at(-1)?.date);
  svg += `<text x="8" y="${h - 6}">${first}</text><text x="${w - 8}" y="${h - 6}" text-anchor="end">${last}</text>`;
  return svg + '</svg>';
}

function line({ series = [], band, hlines = [], w = 640, h = 220, pad = 8 }) {
  const all = [...series.flatMap((s) => s.pts.map((p) => p[1])), ...hlines.map((l) => l.y), ...(band ? [...band.lo, ...band.hi].map((p) => p[1]) : [])].filter(Number.isFinite);
  const xs = series.flatMap((s) => s.pts.map((p) => p[0]));
  if (!all.length) return '<p class="muted small">ما كاينش أرقام بعد.</p>';
  const lo = Math.min(...all, 0);
  const hi = Math.max(...all, 0) === lo ? lo + 1 : Math.max(...all, 0);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs, x0 + 1);
  const X = (x) => pad + ((x - x0) / (x1 - x0)) * (w - 2 * pad);
  const Y = (y) => 8 + (1 - (y - lo) / (hi - lo)) * (h - 28);
  const path = (pts) => pts.filter((p) => Number.isFinite(p[1])).map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  let svg = `<svg class="chart" viewBox="0 0 ${w} ${h}" dir="ltr" role="img" aria-label="منحنى">`;
  svg += `<line x1="${pad}" x2="${w - pad}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line-strong)"/>`;
  if (band) svg += `<polygon points="${[...band.hi, ...band.lo.slice().reverse()].map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="var(--band)"/>`;
  for (const l of hlines) svg += `<line x1="${pad}" x2="${w - pad}" y1="${Y(l.y)}" y2="${Y(l.y)}" stroke="${l.color}" stroke-dasharray="6 4" stroke-width="1.4"/><text x="${w - pad}" y="${Y(l.y) - 4}" text-anchor="end" style="fill:${l.color}">${esc(l.label)}</text>`;
  for (const s of series) svg += `<path d="${path(s.pts)}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
  svg += `<text x="${pad}" y="${h - 6}">يوم ${x0}</text><text x="${w - pad}" y="${h - 6}" text-anchor="end">يوم ${x1}</text>`;
  return svg + '</svg>';
}

function spark(points) {
  if (!points?.length) return '';
  const ys = points.map((p) => p.real);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys, lo + 1);
  const W = 72;
  const H = 26;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, points.length - 1)) * W).toFixed(1)},${(H - 2 - ((p.real - lo) / (hi - lo)) * (H - 4)).toFixed(1)}`).join('');
  const z = points.at(-1).zone;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" dir="ltr" aria-hidden="true"><path d="${d}" stroke="var(--${z === 'red' ? 'red' : z === 'yellow' ? 'yellow' : 'green'})" stroke-width="2" fill="none"/></svg>`;
}

function funnel(k) {
  const max = k.orders || 1;
  const row = (label, n, rate, note) => `<div class="fr"><div class="fl"><span>${label}</span><b>${L(num(n))}</b>${rate !== undefined ? `<span class="muted">${P(rate)}</span>` : ''}</div><div class="fb"><span style="width:${Math.max(2, (n / max) * 100).toFixed(1)}%"></span></div>${note ? `<div class="small muted">${note}</div>` : ''}</div>`;
  return row('الطلبيات', k.orders) + row('المؤكّدة', k.confirmed, k.confRate) + row('الموصّلة', k.delivered, k.delRate, `${L(num(k.returned))} روتور • ${L(num(k.abandoned))} متروكة`);
}

// ───────────── نظرة عامة ─────────────
function home() {
  const s = SNAP;
  const K = s.kpis[period];
  const k = K.cur;
  const t = s.trust;
  let html = '';
  if (!t.canJudge) {
    html += `<div class="banner red"><b>ثقة البيانات ${L(String(t.score))}/100</b> — ما كاينش حكم حتى تكمّل: ${esc(t.missing.join('، '))}</div>`;
  } else if (s.firstProblem) {
    const fp = s.firstProblem;
    html += `<div class="banner ${LEVEL[fp.level]?.[0] || 'gray'}"><div><span class="small">المشكل الأول اليوم</span><p><b>${fp.product ? esc(fp.product) + ': ' : ''}</b>${L(fp.text)}</p></div><div class="todo">← ${esc(fp.todo)}</div></div>`;
  }
  html += `<section class="kpis">
    ${kpi('الطلبيات', L(num(k.orders)), delta(K.delta.orders), '⟵ الطلبيات')}
    ${kpi('التأكيد', P(k.confRate), delta(K.delta.confRate, 'pts'), '⟵ الطلبيات')}
    ${kpi('التوصيل', P(k.delRate), delta(K.delta.delRate, 'pts'), '⟵ شركة التوصيل')}
    ${kpi('القبض (كاش دخل)', M(k.cash), delta(K.delta.cash), '⟵ السحوبات')}
    ${kpi('الإعلانات', M(k.ads), delta(K.delta.ads, 'rel', true), '⟵ ميتا × سعر الدولار تاعك')}
    ${kpi('الربح الكاش', M(k.profit), delta(K.delta.profit), '⟵ المحرّك')}
  </section>`;
  html += `<section class="grid two">
    <div class="card"><div class="ch"><h3>الربح الكاش في النهار</h3><span class="muted small">آخر ${L(String(Math.max(period, 7)))} يوم</span></div>${bars(s.kpis[Math.max(period, 7)].cur.series)}</div>
    <div class="card"><div class="ch"><h3>من الطلبية للكاش</h3></div>${funnel(k)}</div>
  </section>`;
  html += `<section class="grid two">${splitCard(s.split)}
    <div class="card"><div class="ch"><h3>3 حوايج اليوم</h3><span class="muted small">مرتّبين بالدينار</span></div><ol class="todo-list">${s.today3.map((x) => `<li><div><b>${esc(x.text)}</b><span class="muted small">${esc(x.who)}</span></div><div class="end"><span class="pill">${M(x.dzdPerDay)}/نهار</span>${say(x.say)}</div></li>`).join('')}</ol>
    <a class="more" href="#levers">كل الروافع ←</a></div></section>`;
  html += `<section class="card"><div class="ch"><h3>المنتجات</h3><a class="more" href="#products">الكل ←</a></div>${productTable(s.products)}</section>`;
  const urgent = s.alerts.filter((a) => a.level === 'stop' || a.level === 'danger');
  html += `<section class="card"><div class="ch"><h3>التحذيرات المهمّة</h3><span class="muted small">${L(String(urgent.length))} من ${L(String(s.alerts.length))}</span></div><ul class="alerts">${urgent.map(alertLi).join('') || '<li class="muted">ما كاينش 🛑 ولا 🔴.</li>'}</ul>${s.alerts.length > urgent.length ? '<a class="more" href="#levers">كل التحذيرات ←</a>' : ''}</section>`;
  html += `<div id="approvals"></div>`;
  html += `<p class="foot small muted">ثقة البيانات ${L(String(t.score))}/100 • الدولار = ${L(String(s.business.usdRate))} (سعرك في تسيير)</p>`;
  return html;
}

function splitCard(sp, title = 'الربح المقسوم') {
  const tot = sp.paper || 1;
  const w = (x) => `${Math.max(0, (x / tot) * 100).toFixed(1)}%`;
  return `<div class="card"><div class="ch"><h3>${title}</h3></div>
  <div class="big">${M(sp.spendable)}<span class="muted small"> تقدر تصرفو اليوم</span></div>
  <div class="splitbar"><span style="width:${w(sp.cash)};background:var(--green)"></span><span style="width:${w(sp.atCarrier)};background:var(--blue)"></span><span style="width:${w(sp.locked)};background:var(--ice)"></span></div>
  <div class="legend3">
    <div><i style="background:var(--green)"></i>في اليد<b>${M(sp.cash)}</b></div>
    <div><i style="background:var(--blue)"></i>عند شركة التوصيل<b>${M(sp.atCarrier)}</b></div>
    <div><i style="background:var(--ice)"></i>محبوس في السلعة<b>${M(sp.locked)}</b></div>
  </div>
  <p class="small muted">على الورق ${M(sp.paper)}${sp.slowLocked > 0 ? ` • منها ${M(sp.slowLocked)} في سلعة راقدة — ما تطلبش دفعة جديدة عليها` : ''}</p></div>`;
}

const alertLi = (a) => `<li class="al ${a.level}">${levelBadge(a.level)}<div>${a.product ? `<b>${esc(a.product)}</b> — ` : ''}${L(a.text)}${a.action ? `<div class="small muted">← ${esc(a.action)}${a.needsApproval ? ' (بموافقتك)' : ''}</div>` : ''}</div></li>`;

function productTable(list) {
  const rows = list.map((p) => {
    if (p.unresolved) return `<tr><td data-l="المنتج"><a href="#product/${p.id}"><b>${esc(p.name)}</b></a></td><td data-l="المرحلة">${tagBadge(p.stage)}</td><td colspan="4" data-l="">غير محسوم — ناقص ${esc(p.missing.join('، '))}</td></tr>`;
    return `<tr><td data-l="المنتج"><a href="#product/${p.id}" class="pn">${spark(p.curve.points)}<b>${esc(p.name)}</b></a></td><td data-l="المرحلة">${tagBadge(p.stage)}</td><td data-l="الحالة">${zoneDot(p.curve.zone)}</td><td data-l="صافي الطرد">${S(p.cases.mid.netPerDelivered)}</td><td data-l="التغطية">${cover(p.coverDays)}</td><td data-l="الحكم">${verdictBadge(p.verdict)}</td></tr>`;
  });
  return wrapTd(`<table class="tbl stack"><thead><tr><th>المنتج</th><th>المرحلة</th><th>الحالة</th><th>صافي الطرد</th><th>التغطية</th><th>الحكم</th></tr></thead><tbody>${rows.join('')}</tbody></table>`);
}

// ───────────── المنتجات ─────────────
function products() {
  const s = SNAP;
  const counts = {};
  s.products.forEach((p) => (counts[p.stage || '—'] = (counts[p.stage || '—'] || 0) + 1));
  const list = s.products.filter((p) => !stageFilter || p.stage === stageFilter);
  return `<div class="seg wrap"><button class="${!stageFilter ? 'on' : ''}" data-stage="">الكل <b dir="ltr">${s.products.length}</b></button>${STAGES.filter((st) => counts[st]).map((st) => `<button class="${stageFilter === st ? 'on' : ''}" data-stage="${st}">${st} <b dir="ltr">${counts[st]}</b></button>`).join('')}</div>
  <section class="card">${productTable(list)}</section>
  <section class="grid two"><a class="card navcard" href="#stock"><h3>📦 الستوك والتعمير</h3><p class="muted small">${L(String(stockRows().filter((v) => v.status === 'اطلب اليوم').length))} متغيّر لازم يتطلب اليوم</p></a>
  <a class="card navcard" href="#levers"><h3>🎚️ الروافع والتحذيرات</h3><p class="muted small">${M(s.leversTotal)}/نهار ضايعين</p></a></section>`;
}

function productPage(id) {
  const p = SNAP.products.find((x) => x.id === id);
  if (!p) return '<p>ماكاش هذا المنتج.</p>';
  if (p.unresolved) return `<a class="back" href="#products">→ المنتجات</a><h2>${esc(p.name)}</h2><div class="card"><p>غير محسوم. يلزمنا: ${esc(p.missing.join('، '))}</p></div>`;
  const c = p.cases;
  const pts = p.curve.points;
  const cls = p.classification;
  return `<a class="back" href="#products">→ المنتجات</a>
  <div class="ph"><div><h2>${esc(p.name)}</h2><div class="badges">${tagBadge(p.stage)} ${zoneDot(p.curve.zone)}</div></div>${verdictBadge(p.verdict)}</div>
  <div class="banner ${VERDICT[p.verdict] || 'gray'}"><div><span class="small">الحكم: ${esc(p.verdict)}</span><p>${L(p.rootCause.cause === 'الفريق' ? `السبب الفريق: ${p.rootCause.why.join('، ')}` : cls.why)}</p></div>
  ${cls.changed ? `<button class="btn" data-tag="${p.id}" data-stage="${cls.stage}">اكتب التاغ ${esc(cls.stage)}</button>` : ''}</div>
  <section class="kpis four">
    ${kpi('صافي الطرد الموصّل', S(c.mid.netPerDelivered), `<span class="delta">الأسوأ ${S(c.worst.netPerDelivered)}</span>`, '⟵ المحرّك')}
    ${kpi('ثمن الليد', S(c.mid.lead), `<span class="delta ${c.mid.lead <= c.mid.maxLead ? 'up' : 'down'}">الحد ${S(c.mid.maxLead)}</span>`, p.sources.lead)}
    ${kpi('التأكيد', P(c.mid.conf), `<span class="delta ${c.mid.conf >= c.mid.minConf ? 'up' : 'down'}">الأرضية ${P(c.mid.minConf)}</span>`, p.sources.conf)}
    ${kpi('التوصيل', P(c.mid.del), `<span class="delta ${c.mid.del >= c.mid.minDel ? 'up' : 'down'}">الأرضية ${P(c.mid.minDel)}</span>`, p.sources.del)}
  </section>
  <section class="card"><div class="ch"><h3>المنحنى</h3><span class="muted small">الكاش الصافي من نهار «لانسي»</span></div>
  ${line({
    band: { lo: pts.map((x) => [x.day, x.worst]), hi: pts.map((x) => [x.day, x.best]) },
    series: [{ pts: pts.map((x) => [x.day, x.mid]), color: 'var(--muted)', dash: '5 4', width: 1.2 }, { pts: pts.map((x) => [x.day, x.real]), color: 'var(--accent)', width: 2.4 }],
    hlines: p.curve.stopLine !== null ? [{ y: p.curve.stopLine, label: 'خط الستوب', color: 'var(--red)' }] : [],
  })}
  <div class="legend"><span><i style="background:var(--accent)"></i>الحقيقي</span><span><i style="background:var(--muted)"></i>المتوقّع</span><span><i style="background:var(--band);height:8px"></i>بين الأسوأ والأحسن</span><span><i style="background:var(--red)"></i>الستوب</span></div>
  ${p.signals.length ? `<div class="signals">${p.signals.map((sg) => `<span class="badge yellow" title="${esc(sg.detail)}">${sg.icon} ${esc(sg.label)}</span>`).join('')}</div>` : ''}</section>
  <details class="card"><summary><h3>الحدود والخطة</h3></summary><table class="tbl">
    <tr><th></th><th>الوسط</th><th>الأسوأ</th></tr>
    <tr><td>أغلى ليد</td><td>${S(c.mid.maxLead)}</td><td>${S(c.worst.maxLead)}</td></tr>
    <tr><td>السقف (على المؤكّدة)</td><td>${S(c.mid.ceiling)}</td><td>${S(c.worstCeiling)}</td></tr>
    <tr><td>أقل سعر</td><td>${S(c.mid.minPrice)}</td><td>${S(c.worst.minPrice)}</td></tr>
    <tr><td>الحد (cap)</td><td colspan="2">${M(p.cap)}</td></tr>
    ${p.plan?.plannable ? `<tr><td>الخطة</td><td colspan="2">${L(num(p.plan.leadsPerDay, 1))} ليد/نهار (سقف السوق ${L(num(p.plan.marketCap))})</td></tr>
    <tr><td>نوصلولو 9 من 10</td><td colspan="2">${M(p.monteCarlo.commitment)}</td></tr>
    <tr><td>رأس المال اللازم</td><td colspan="2">${M(p.capital.capital)}</td></tr>` : `<tr><td>الخطة</td><td colspan="2">${esc(p.plan?.reason || 'ما كاينش هدف مكتوب')}</td></tr>`}
  </table><p class="small muted">البوابة: ${p.gate.open ? 'مفتوحة' : L(p.gate.blockers.join('، '))}</p></details>
  <details class="card" open><summary><h3>الستوك</h3></summary>${stockTable(p.variants.map((v) => ({ ...v, product: '' })))}</details>
  <details class="card"><summary><h3>الربح المقسوم</h3></summary>${splitCard({ paper: p.profit.paper, cash: p.profit.cash, atCarrier: p.profit.pending, locked: p.profit.stockAtCost, slowLocked: p.profit.slowStock, spendable: Math.max(0, p.profit.cash) }, 'تاع المنتج')}</details>
  <details class="card" ${p.levers.length ? 'open' : ''}><summary><h3>الروافع <span class="muted small">${L(String(p.levers.length))}</span></h3></summary>${p.levers.map(leverRow).join('') || '<p class="muted">ما كاينش.</p>'}</details>
  <details class="card"><summary><h3>التحذيرات <span class="muted small">${L(String(p.alerts.length))}</span></h3></summary><ul class="alerts">${p.alerts.map(alertLi).join('') || '<li class="muted">ما كاينش.</li>'}</ul></details>
  <details class="card"><summary><h3>تاريخ القرارات</h3></summary><ul class="timeline">${p.tagHistory.map((h) => `<li><b>${L(h.date)}</b> ${esc(h.from || '—')} ← ${esc(h.to)} <span class="muted small">${L(h.why)}</span></li>`).join('')}</ul></details>
  <section class="actions"><button class="btn red" data-act="pause_offer" data-p="${p.id}">توقيف العرض</button><button class="btn" data-act="scale_up" data-p="${p.id}">تكبير</button><button class="btn" data-act="destock" data-p="${p.id}">تصفية</button>
  <p class="small muted">التوقيف ديما مسموح. الأفعال الكبار تولّي بطاقة موافقة، والتنفيذ بيدك ولا بـ Tassya.</p></section>`;
}

// ───────────── الستوك والروافع ─────────────
const stockRows = () => SNAP.products.filter((p) => !p.unresolved).flatMap((p) => p.variants.map((v) => ({ ...v, product: p.name })));

function stockTable(rows) {
  return wrapTd(`<table class="tbl stack"><thead><tr><th>المتغيّر</th><th>المتاح</th><th>يخرج/نهار</th><th>يكفي</th><th>اطلب</th><th>الحالة</th></tr></thead><tbody>
  ${rows.map((v) => `<tr><td data-l="المتغيّر"><b>${esc(v.product)} ${esc(v.label)}</b> <span class="small muted">${P(v.demandShare)} من الطلب</span></td><td data-l="المتاح">${L(num(v.available))}</td><td data-l="يخرج/نهار">${L(num(v.velocity, 1))}</td><td data-l="يكفي">${cover(v.coverDays)}</td><td data-l="اطلب">${v.suggested ? L(num(v.suggested)) : '—'}</td><td data-l="الحالة">${badge(STOCK_BADGE[v.status] || 'gray', esc(v.status))}</td></tr>`).join('')}
  </tbody></table>`);
}

function stock() {
  const order = { 'اطلب اليوم': 0, 'محبوس': 1, 'مرتاح': 2 };
  const rows = stockRows().sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  const n = (st) => rows.filter((v) => v.status === st).length;
  return `<a class="back" href="#products">→ المنتجات</a><h2>الستوك والتعمير</h2>
  <section class="kpis three">${kpi('اطلب اليوم', L(String(n('اطلب اليوم'))), '', '')}${kpi('محبوس', L(String(n('محبوس'))), `<span class="delta">${M(SNAP.split.slowLocked)}</span>`, '')}${kpi('مرتاح', L(String(n('مرتاح'))), '', '')}</section>
  <section class="card">${stockTable(rows)}<p class="small muted">⟵ المخزون: Sellable (ماشي totalItems)</p></section>`;
}

function leverRow(l) {
  return `<details class="lever"><summary><div><b>${esc(l.title)}</b>${l.product ? `<span class="muted small"> — ${esc(l.product)}</span>` : ''}</div><span class="pill">${M(l.dzdPerDay)}/نهار</span></summary>
  <p class="small">${L(l.why)}</p>${l.capitalFreed ? `<p class="small">رأس مال يتحرّر: <b>${M(l.capitalFreed)}</b></p>` : ''}<ol class="steps">${l.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol><div class="row-end"><span class="small muted">${esc(l.source)}</span>${say(l.say)}</div></details>`;
}

function levers() {
  const s = SNAP;
  const sections = [...new Set(s.levers.map((l) => l.section))];
  const f = (l) => leverFilter === 'all' || (leverFilter === 'biz' && l.scope === 'بيزنس') || l.productId === leverFilter || l.section === leverFilter;
  const opts = [['all', 'الكل'], ['biz', 'البيزنس'], ...s.products.filter((p) => !p.unresolved).map((p) => [p.id, p.name]), ...sections.map((x) => [x, x])];
  return `<a class="back" href="#products">→ المنتجات</a><h2>الروافع والتحذيرات</h2>
  <div class="banner gold"><div><span class="small">الربح اللي خلّصت عليه ديجا ويفيض في الفراغ</span><p class="big">${M(s.leversTotal)}<span class="small">/نهار</span></p></div></div>
  <label class="select"><span class="small muted">فلتر</span><select id="lf">${opts.map(([v, t]) => `<option value="${esc(v)}" ${leverFilter === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
  <section class="card">${s.levers.filter(f).map(leverRow).join('') || '<p class="muted">ما كاينش.</p>'}</section>
  <section class="card"><div class="ch"><h3>التحذيرات</h3><span class="muted small">مرتّبة بالخطورة</span></div><ul class="alerts">${s.alerts.map(alertLi).join('')}</ul></section>`;
}

// ───────────── التقرير ─────────────
async function report() {
  const [rep, archive] = await Promise.all([api('/api/report/today'), api('/api/report/archive')]);
  return `<div class="ch"><h2>تقرير اليوم</h2><span class="muted small">${L(rep.date)} • يتبعث على ${L(String(SNAP.policy.reportHour).padStart(2, '0') + ':00')}</span></div>
  ${rep.sections.map((s, i) => `<details class="card" ${i < 3 ? 'open' : ''}><summary><h3>${esc(s.title)}</h3></summary><ul class="rl">${s.lines.map((l) => {
    const m = l.match(/«(يا Tassya[^»]+)»/);
    return `<li>${L(l.replace(/ — «يا Tassya[^»]+»/, ''))}${m ? `<div>${say(m[1])}</div>` : ''}</li>`;
  }).join('')}</ul></details>`).join('')}
  <details class="card"><summary><h3>الأرشيف</h3></summary><ul class="rl">${archive.map((a) => `<li>${L(a.date)}</li>`).join('') || '<li>فارغ</li>'}</ul></details>`;
}

async function approvals() {
  const box = $('#approvals');
  if (!box) return;
  const list = await api('/api/approvals');
  if (!list.length) return;
  box.innerHTML = `<section class="card"><div class="ch"><h3>تستنّى موافقتك</h3></div>${list.map((c) => `<div class="appr"><div><b>${esc(c.type)}</b> — ${esc(c.payload?.productName || '')}<div class="small muted">${L(c.why || '')}</div></div><div class="end"><button class="btn primary" data-approve="${c.id}">وافق</button><button class="btn" data-reject="${c.id}">رفض</button></div></div>`).join('')}</section>`;
}

// ───────────── التوجيه ─────────────
async function render() {
  const hash = location.hash.slice(1) || 'home';
  const [route, id] = hash.split('/');
  const tab = ['product', 'stock', 'levers'].includes(route) ? 'products' : route;
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${tab}`));
  document.querySelectorAll('#period button').forEach((b) => b.classList.toggle('on', Number(b.dataset.period) === period));
  $('#period').hidden = route !== 'home';
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

document.addEventListener('change', (e) => {
  if (e.target.id === 'lf') {
    leverFilter = e.target.value;
    render();
  }
});

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.copy) return copy(t.dataset.copy);
  if (t.dataset.period) {
    period = Number(t.dataset.period);
    mem.set('b.period', String(period));
    return render();
  }
  if (t.dataset.stage !== undefined) {
    stageFilter = t.dataset.stage || null;
    mem.set('b.stage', stageFilter || '');
    return render();
  }
  if (t.dataset.tag) {
    await post('/api/actions', { type: 'write_tag', payload: { productId: t.dataset.tag, stage: t.dataset.stage } });
    toast('التاغ تكتب، والتاغات القدام باقيين');
    return load();
  }
  if (t.dataset.act) {
    const p = SNAP.products.find((x) => x.id === t.dataset.p);
    const r = await post('/api/actions', { type: t.dataset.act, payload: { productId: p.id, productName: p.name }, why: p.classification.why });
    toast(r.status === 'pending' ? 'تحطّت بطاقة موافقة في نظرة عامة' : 'تدار');
    return;
  }
  if (t.dataset.approve || t.dataset.reject) {
    await post(`/api/approvals/${t.dataset.approve || t.dataset.reject}/${t.dataset.approve ? 'approve' : 'reject'}`);
    toast(t.dataset.approve ? 'موافقة — التنفيذ بيدك ولا بـ Tassya' : 'ترفضت');
    return render();
  }
});

async function load() {
  SNAP = await api('/api/snapshot');
  $('#demoBadge').hidden = !SNAP.demo;
  $('#period').innerHTML = PERIODS.map(([d, t]) => `<button data-period="${d}">${t}</button>`).join('');
  await render();
}
window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});
load().catch((e) => ($('#app').innerHTML = `<div class="card"><p>ما قدرناش نوصلو للخادم: ${esc(e.message)}</p></div>`));
