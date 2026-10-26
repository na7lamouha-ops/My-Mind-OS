// التقرير اليومي — يتبنى من نفس snapshot تاع الشاشات (analyzeBusiness) ← نفس الأرقام.
import { money, num } from './format.js';
import { LEVEL_LABEL, STAGE_LABEL } from './engine.js';

export const REPORT_ORDER = ['summary', 'split', 'today3', 'stages', 'tests', 'stock', 'levers', 'alerts', 'data'];

export function buildDailyReport(snap) {
  const S = [];
  const sec = (key, title, lines) => S.push({ key, title, lines });

  if (!snap.trust.canJudge) {
    sec('summary', 'الحاصل', [
      `ثقة البيانات ${snap.trust.score}/100 — تحت ${snap.policy.trustMin}: ما كاينش حكم اليوم.`,
      `الواجب: ${snap.trust.missing.join('، ')}.`,
      `الربح الحقيقي اللي تقدر تصرفو اليوم = ${money(snap.split.spendable)}.`,
    ]);
  } else {
    const pos = snap.curvePos;
    sec('summary', 'الحاصل', [
      `البيزنس ${pos >= 0 ? 'فوق' : 'تحت'} المسار بـ ${money(Math.abs(pos))}.`,
      `المشكل الأول: ${snap.firstProblem ? `${snap.firstProblem.text} ← ${snap.firstProblem.todo}` : 'ما كاينش'}.`,
      `الربح الحقيقي اللي تقدر تصرفو اليوم = ${money(snap.split.spendable)}.`,
    ]);
  }

  const y = snap.splitYesterday;
  const diff = (k) => (y && Number.isFinite(y[k]) ? ` (${snap.split[k] - y[k] >= 0 ? '+' : '−'}${money(Math.abs(snap.split[k] - y[k]))} على البارح)` : '');
  sec('split', 'الربح المقسوم', [
    `على الورق: ${money(snap.split.paper)}${diff('paper')}`,
    `💵 كاش في اليد: ${money(snap.split.cash)}${diff('cash')}`,
    `🚚 عند شركة التوصيل: ${money(snap.split.atCarrier)}${diff('atCarrier')} — أقدم قبض ${snap.split.oldestCarrierDays} يوم`,
    `📦 محبوس في السلعة: ${money(snap.split.locked)}${diff('locked')} — منها ${money(snap.split.slowLocked)} فوق ${snap.policy.coverLimitDays} يوم تغطية`,
  ]);

  sec('today3', '3 حوايج اليوم', snap.today3.map((t, i) => `${i + 1}. ${t.text} — ${money(t.dzdPerDay)}/نهار — ${t.who} — «${t.say}»`));

  const stageLines = [];
  for (const [stage, list] of Object.entries(snap.byStage)) {
    stageLines.push(`▸ ${STAGE_LABEL[stage] || stage}`);
    for (const p of list) {
      if (p.unresolved) {
        stageLines.push(`  ${p.name}: غير محسوم — ناقص ${p.missing.join('، ')}`);
        continue;
      }
      stageLines.push(
        `  ${p.name} [${p.stage}] ${zoneIcon(p.curve.zone)} صافي الموصلة ${money(p.cases.mid.netPerDelivered, { small: true })} • التغطية ${Number.isFinite(p.coverDays) ? num(p.coverDays) + ' يوم' : '∞'} • الحكم: ${p.verdict}`,
      );
    }
  }
  sec('stages', 'المنتجات حسب المرحلة', stageLines);

  const tests = snap.products.filter((p) => !p.unresolved && p.stage === 'TEST');
  sec('tests', 'التاست', tests.length
    ? tests.map((p) => `${p.name}: ${p.classification.stage} — صافي الليد بين ${money(p.interval90.low, { small: true })} و${money(p.interval90.high, { small: true })} (مجال 90%) — ${p.classification.why}`)
    : ['ما كاين حتى موديل في التاست.']);

  const stock = snap.products.filter((p) => !p.unresolved).flatMap((p) => p.variants.map((v) => ({ ...v, product: p.name })));
  const order = stock.filter((v) => v.status === 'اطلب اليوم');
  const near = stock.filter((v) => v.status === 'مرتاح' && v.available <= v.reorderPoint * 1.5);
  const locked = stock.filter((v) => v.status === 'محبوس');
  sec('stock', 'الستوك', [
    `اطلب اليوم: ${order.length ? order.map((v) => `${v.product} ${v.label} (${v.suggested} قطعة)`).join('، ') : 'والو'}`,
    `قريب: ${near.length ? near.map((v) => `${v.product} ${v.label}`).join('، ') : 'والو'}`,
    `محبوس: ${locked.length ? locked.map((v) => `${v.product} ${v.label} (${v.available} قطعة)`).join('، ') : 'والو'}`,
  ]);

  sec('levers', 'الروافع', snap.levers.slice(0, 3).map((l) => `${l.title}${l.product ? ' — ' + l.product : ''}: ${money(l.dzdPerDay)}/نهار — ${l.why}`));
  sec('alerts', 'التحذيرات', snap.alerts.length ? snap.alerts.map((a) => `${LEVEL_LABEL[a.level]} ${a.product ? a.product + ': ' : ''}${a.text}`) : ['ما كاينش.']);
  sec('data', 'البيانات', [`ثقة البيانات: ${snap.trust.score}/100`, snap.trust.missing.length ? `ناقص: ${snap.trust.missing.join('، ')}` : 'كامل.']);

  const text = S.map((s) => `■ ${s.title}\n${s.lines.join('\n')}`).join('\n\n');
  return { date: snap.today, sections: S, text };
}

const zoneIcon = (z) => ({ green: '🟢', yellow: '🟡', red: '🔴' })[z] || '⚪';

// تنبيه صامت كل ساعة: ما يتبعثش غير كي كاين 🛑 ولا 🔴.
export function hourlyAlert(snap) {
  const urgent = snap.alerts.filter((a) => a.level === 'stop' || a.level === 'danger');
  return urgent.length ? { send: true, lines: urgent.map((a) => `${LEVEL_LABEL[a.level]} ${a.product ? a.product + ': ' : ''}${a.text}`) } : { send: false, lines: [] };
}
