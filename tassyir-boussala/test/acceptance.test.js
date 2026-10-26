import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from './cases.mjs';
import { runUiTest } from './ui-360.mjs';

for (const c of CASES) {
  test(`${c.n}. ${c.name}`, async () => {
    const r = await c.run();
    assert.ok(r.pass, JSON.stringify(r, null, 1));
  });
}

test('12. العرض: بلا سكرول للجنب في 360px، وبلا أخطاء في الكونسول', { skip: process.env.SKIP_UI === '1' }, async () => {
  const res = await runUiTest();
  const bad = res.filter((r) => r.overflowPx > 0 || r.errors.length);
  assert.deepEqual(bad, []);
});
