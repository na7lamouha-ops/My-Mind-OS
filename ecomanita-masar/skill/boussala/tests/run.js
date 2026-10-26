#!/usr/bin/env node
// اختبار المحرّك مقابل الأداة الحية V29 (6 حالات المرجع) — node boussala/tests/run.js
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine', 'boussala-engine.js'));
const G = require(path.join(__dirname, 'golden-v29.json'));
let pass = 0, fail = 0;
for (const c of G.cases) {
  const ctx = E.makeCtx({ ...G.base, ...c.settings });
  const p = E.normProduct(c.product, ctx);
  const R = E.calcOneProduct(p, E.sharedOf(ctx), ctx.target, ctx);
  const got = { ...R, ab: E.abExtra(p, R, ctx).profit };
  const errs = [];
  for (const [k, exp] of Object.entries(c.expect)) {
    const g = got[k];
    if (exp === null) { if (g !== null && g !== undefined) errs.push(`${k}: ${g}`); continue; }
    const tol = Math.max(0.011, Math.abs(exp) * 1e-6) + (k === 'ab' ? 1 : 0);
    if (!(Math.abs(g - exp) <= tol)) errs.push(`${k}: متوقع ${exp}، لقيت ${g}`);
  }
  if (errs.length) { fail++; console.log('❌ ' + c.name + ' — ' + errs.join(' · ')); } else pass++;
}
console.log(fail ? `❌ ${pass}/${pass + fail}` : `✅ ${pass}/${pass} المحرّك = الأداة V29 · ${E.ENGINE_VERSION}`);
process.exit(fail ? 1 : 0);
