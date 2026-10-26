// يكتب docs/TEST_REPORT.md بالأرقام اللي خرجت فعلاً.
import fs from 'node:fs/promises';
import { CASES } from './cases.mjs';
import { runUiTest } from './ui-360.mjs';

const fmt = (o) => (typeof o === 'object' ? Object.entries(o).map(([k, v]) => `${k}: \`${typeof v === 'object' ? JSON.stringify(v) : v}\``).join('<br>') : `\`${o}\``);
let md = `# تقرير الاختبارات — البوصلة\n\nتولّد بـ \`npm run report:tests\` في ${new Date().toISOString()} (Node ${process.version}).\n\n| # | الاختبار | المنتظر | اللي خرج | النتيجة |\n|---|---|---|---|---|\n`;
let fails = 0;
const notes = [];
for (const c of CASES) {
  const r = await c.run();
  if (!r.pass) fails++;
  const got = Array.isArray(r.got) ? r.got.join(', ') : r.got;
  md += `| ${c.n} | ${c.name} | ${fmt(Array.isArray(r.expected) ? r.expected.join(', ') : r.expected)} | ${fmt(got)} | ${r.pass ? '✅' : '❌'} |\n`;
  if (c.note) notes.push(`- **${c.n}:** ${c.note}`);
}
const ui = await runUiTest();
const bad = ui.filter((x) => x.overflowPx > 0 || x.errors.length);
if (bad.length) fails++;
md += `| 12 | العرض: 360px بلا سكرول للجنب، بلا أخطاء كونسول | 0 px، 0 خطأ | ${ui.length} شاشة/عرض: أكبر سكرول \`${Math.max(...ui.map((x) => x.overflowPx))} px\`، أخطاء \`${ui.reduce((s, x) => s + x.errors.length, 0)}\` (${[...new Set(ui.map((x) => x.screen))].join(' ')} في 360 و1280) | ${bad.length ? '❌' : '✅'} |\n`;
md += `\n**المجموع:** ${12 - fails}/12 ✅\n\n## ملاحظات\n${notes.join('\n')}\n- **12:** Chromium (Playwright) على البيانات التجريبية؛ الخطوط من Google Fonts ما تتحسبش (الشبكة).\n`;
await fs.writeFile(new URL('../docs/TEST_REPORT.md', import.meta.url), md);
console.log(md);
process.exit(fails ? 1 : 0);
