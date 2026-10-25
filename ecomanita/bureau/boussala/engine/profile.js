/*!
 * بوصلة التاجر — كيفاش منظّم هذا التاجر؟ (يكتشف النظام قبل ما يقترح حتى حاجة)
 * al-KHALiYA © 2026
 * يقرا: تسمية الحملات، المتاجر، الفريق وأدوارهم، الحالات وأسباب الإلغاء، المصاريف (المتكرّرة، على الطلبية، الورشات)،
 * المحافظ، المخازن والورشات، التطبيقات (Claude، Sheets، تطبيقات المطوّر)، وسجل النشاط (شكون يدير واش: البشر ولا الوكلاء).
 * يطلّع: درجة النضج، «النظام تاعو» بالكلمات، الوكلاء تاعو وواش يديرو، وكيفاش البوصلة تتركّب فوقو بلا ما تكسّر.
 */
'use strict';
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

// «NOUR | SCALE | ABO | 01/09» ← منتج | مرحلة | هيكل | تاريخ
function namingOf(names) {
  const N = names.filter(Boolean); if (!N.length) return null;
  const sep = ['|', '-', '_', '/'].map(s => ({ s, n: N.filter(x => x.split(s).length >= 3).length })).sort((a, b) => b.n - a.n)[0];
  if (!sep || sep.n / N.length < 0.6) return { consistent: false, share: pct(sep ? sep.n : 0, N.length), parts: [] };
  const rows = N.map(x => x.split(sep.s).map(t => t.trim()));
  const width = Math.max(...rows.map(r => r.length));
  const parts = [];
  for (let k = 0; k < width; k++) {
    const col = rows.map(r => r[k] || '');
    const role = col.every(t => /^\d{1,2}[\/.]\d{1,2}([\/.]\d{2,4})?$/.test(t) || !t) ? 'التاريخ'
      : col.every(t => /^(TEST|TESTING|SCALE|OPTI\w*|RETARGET\w*|RT|BROAD|WINNERS?|DESTOCK)$/i.test(t) || !t) ? 'المرحلة'
      : col.every(t => /^(CBO|ABO|ASC|ADV\+?)$/i.test(t) || !t) ? 'الهيكل' : k === 0 ? 'المنتج' : 'تفصيل';
    parts.push({ k, role, values: [...new Set(col.filter(Boolean))].slice(0, 6) });
  }
  return { consistent: true, sep: sep.s, share: pct(sep.n, N.length), parts, pattern: parts.map(p => p.role).join(` ${sep.s} `) };
}

function campaignsOf(mk) { const out = []; const w = n => { if (n.level === 'campaign') out.push(n.name); (n.children || []).forEach(w); }; ((mk && mk.tree) || []).forEach(w); return [...new Set(out)]; }

function profile(S) {
  S = S || {};
  const emp = S.employees || [], roles = r => emp.filter(e => (e.roles || []).some(x => r.test(x))).map(e => e.name);
  const team = { confirmers: roles(/Order Manager|CONFIRM/i), trackers: roles(/Tracker/i), stock: roles(/Inventory|Stock/i), finance: roles(/Accountant|Compta/i), ownerTakesOrders: emp.some(e => (e.roles || []).includes('Owner') && e.canReceiveOrders) };
  const naming = namingOf(campaignsOf(S.marketingRecent || S.marketing));
  const ladder = (S.customStatuses || []).map(s => s.name);
  const exp = S.expenses || [];
  const finance = { wallets: (S.wallets || []).map(w => w.name), recurring: exp.filter(e => /RECURR/i.test(e.expenseType || '')).length, perOrder: exp.filter(e => /PER_ORDER/i.test(e.expenseType || '')).map(e => e.name),
    workshopScheduled: exp.filter(e => /atelier|ورشة|reste|acompte|عربون|الباقي/i.test(e.name || '')).map(e => ({ name: e.name, amount: e.amount, due: e.nextDueDate })) };
  const workshops = (S.locations || []).filter(l => /workshop|atelier/i.test(l.type || l.name || ''));
  // 🤖 الوكلاء: كل فاعل في سجل النشاط ماشي من الفريق (ولا byRole App/API)
  const logs = S.activityLogs || [], humans = new Set(emp.map(e => e.name));
  const agents = {};
  logs.forEach(l => { const isAgent = /app|api|bot|agent/i.test(l.byRole || '') || (l.by && !humans.has(l.by)); if (!isAgent) return;
    const a = (agents[l.by] = agents[l.by] || { name: l.by, actions: {}, tags: {}, errors: 0, total: 0 }); a.total++;
    const verb = (l.action || '').split(' #')[0]; a.actions[verb] = (a.actions[verb] || 0) + 1;
    const c = l.details && l.details.comment; if (c) { const t = (c.match(/#AGENT-[A-Z]+/) || [])[0]; if (t) a.tags[t] = (a.tags[t] || 0) + 1; if (/ERR|فشل|error/i.test(c)) { a.errors++; (a.errorSamples = a.errorSamples || []).length < 3 && !a.errorSamples.includes(c) && a.errorSamples.push(c); } } });
  const ROLE = { CONF: 'التأكيد (رابيل، مواعيد)', STOCK: 'الستوك (نقطة الطلب)', ADS: 'الإعلانات (CPL)', ERR: 'التبليغ على الأخطاء', DEL: 'التوصيل', FIN: 'المالية' };
  const agentList = Object.values(agents).map(a => ({ ...a, roles: Object.keys(a.tags).map(t => ROLE[t.replace('#AGENT-', '')] || t) }));
  const humanActs = logs.filter(l => humans.has(l.by)).length;
  const apps = S.apps || {};
  // 🎚️ النضج
  const checks = [
    ['تسمية حملات ثابتة', !!(naming && naming.consistent)], ['فريق بأدوار منفصلة', team.confirmers.length >= 1 && (team.trackers.length + team.stock.length) >= 1],
    ['سلّم مكالمات + أسباب إلغاء', ladder.length >= 3 && (S.cancelReasons || []).length >= 4], ['محافظ مقسومة (4+)', finance.wallets.length >= 4],
    ['مصاريف متكرّرة + على الطلبية', finance.recurring >= 1 && finance.perOrder.length >= 1], ['الورشة مجدولة في Costs', finance.workshopScheduled.length >= 1],
    ['بيكسل + CAPI في كل متجر', (S.stores || []).length > 0 && (S.stores || []).every(s => /^\d{10,20}$/.test(String(s.facebookPixelId || '')) && s.metaCapiTokenSet)],
    ['وكلاء أوتوماتيك', agentList.length > 0], ['مربوط بـ Claude', !!apps.claude],
  ];
  const score = pct(checks.filter(c => c[1]).length, checks.length);
  const level = score >= 80 ? 'سينيور' : score >= 50 ? 'منظّم' : 'في البداية';
  const plugIn = [
    naming && naming.consistent ? `نقرا حملاتك بتسميتك (${naming.pattern}) — المرحلة تجي من الاسم، ما نبدّلوهاش.` : null,
    ladder.length ? `نستعمل حالاتك كيما هوما (${ladder.slice(0, 4).join('، ')}…) في قياس التأكيد.` : null,
    agentList.length ? `الوكلاء تاعك (${agentList.map(a => a.name).join('، ')}) يكمّلو يخدمو. البوصلة ما تعاودش خدمتهم: تزيد الأحداث، توزيع الكاش، والقرار.` : null,
    finance.workshopScheduled.length ? 'الورشة مجدولة في Costs ← رزنامة الخزينة تقراها مباشرة.' : null,
  ].filter(Boolean);
  return { score, level, checks: checks.map(([k, ok]) => ({ k, ok })), naming, team, ladder, cancelReasons: S.cancelReasons || [], finance, workshops: workshops.map(w => ({ name: w.name, leadDays: w.leadDays, unitCost: w.unitCost, capacityPerDay: w.capacityPerDay, createdAt: w.createdAt })),
    agents: agentList.map(a => ({ ...a, share: pct(a.total, a.total + humanActs), errorRate: pct(a.errors, a.total) })), apps, plugIn };
}

function profileText(P) {
  const L = [`🧩 كيفاش منظّم: ${P.level} (${P.score}/100)`];
  P.checks.forEach(c => L.push(`  ${c.ok ? '✅' : '▫️'} ${c.k}`));
  if (P.naming && P.naming.consistent) L.push(`  📛 الحملات: «${P.naming.pattern}» (${P.naming.share}% من الحملات)`);
  L.push(`  👥 الفريق: مؤكّدين ${P.team.confirmers.length} • متتبّع ${P.team.trackers.length} • ستوك ${P.team.stock.length}${P.team.ownerTakesOrders ? '' : ' • المالك ما يأكّدش (يسيّر)'}`);
  if (P.workshops.length) L.push(`  🧵 الورشات: ${P.workshops.map(w => `${w.name}${w.unitCost ? ` (${w.unitCost} دج، ${w.leadDays || '؟'} أيام)` : ''}`).join(' • ')}`);
  P.agents.forEach(a => L.push(`  🤖 ${a.name}${a.roles && a.roles.length ? ` — ${a.roles.length} أدوار: ${a.roles.join('، ')}` : ''}: ${a.share}% من الأفعال • ${Object.entries(a.actions).map(([k, v]) => `${k.toLowerCase()} ${v}`).join('، ')}${Object.keys(a.tags).length ? ' • ' + Object.entries(a.tags).map(([k, v]) => `${k} ${v}`).join('، ') : ''}${a.errors ? ` • ⚠️ ${a.errors} أخطاء (${a.errorRate}%)` : ''}`));
  const hint = x => /409/.test(x) ? ' (409 = تعارض: طلب بنفس المفتاح مازال يخدم، ولا الحالة ما تسمحش — الوكيل يقرا `code` و`fix`، يستنى، ومن بعد يعاود؛ ماشي يعاود فوراً)' : /429/.test(x) ? ' (429 = بزاف طلبات: يستنى `Retry-After`)' : /403/.test(x) ? ' (403 = صلاحية ناقصة: scope)' : '';
  P.agents.filter(a => a.errors).forEach(a => L.push(`  🐞 أخطاء ${a.name} (${a.errorRate}%): ${a.errorSamples.map(x => '«' + x + '»' + hint(x)).join('، ')} ← البوصلة تبلّغ عليهم في التقرير اليومي حتى يتصلّحو.`));
  if (P.plugIn.length) { L.push('  🔌 البوصلة فوق نظامك:'); P.plugIn.forEach(x => L.push('     • ' + x)); }
  return L.join('\n');
}

const api = { profile, profileText, namingOf };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
