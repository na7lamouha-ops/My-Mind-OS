// اختبار 12: بلا سكرول للجنب في 360px، وبلا أخطاء في الكونسول — على كل الشاشات.
import { createRequire } from 'node:module';
import { server } from '../server/server.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SCREENS = ['#home', '#products', '#product/p-lina', '#product/p-set', '#stock', '#levers', '#report'];

export async function runUiTest({ screenshotDir } = {}) {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [360, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('requestfailed', (r) => !r.url().includes('fonts.g') && errors.push(`failed ${r.url()}`));
      for (const s of SCREENS) {
        await page.goto(`http://localhost:${port}/${s}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('#app .card, #app .row');
        const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/${width}-${s.replace(/[#/]/g, '_')}.png`, fullPage: true });
        results.push({ width, screen: s, overflowPx: sw - cw, errors: [...errors] });
        errors.length = 0;
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = await runUiTest({ screenshotDir: process.argv[2] });
  let bad = 0;
  for (const r of res) {
    const ok = r.overflowPx <= 0 && !r.errors.length;
    if (!ok) bad++;
    console.log(`${ok ? '✔' : '✘'} ${r.width}px ${r.screen} overflow=${r.overflowPx} errors=${r.errors.length}${r.errors.length ? ' ' + r.errors.join(' | ') : ''}`);
  }
  process.exit(bad ? 1 : 0);
}
