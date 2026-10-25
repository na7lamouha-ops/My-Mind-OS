#!/usr/bin/env node
/*
 * بوصلة التاجر — سطر الأوامر
 *   node bin/boussala.js guide  examples/path-lina.json            → المسار قبل التاست
 *   node bin/boussala.js suivre examples/path-lina.json examples/actuals-lina-day9.json  → المتابعة
 *   node bin/boussala.js test                                        → يتأكد المحرّك = الأداة الحية
 *   زيد --json باش تاخذ النتيجة كاملة JSON
 */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const E = require(path.join(root, 'engine', 'boussala-engine.js'));
const { suivre } = require(path.join(root, 'engine', 'suivre.js'));
const { guideText } = require(path.join(root, 'engine', 'text.js'));

const args = process.argv.slice(2), json = args.includes('--json'), pos = args.filter(a => !a.startsWith('--'));
const read = p => { if (!p) die('ناقص ملف.'); return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')); };
function die(msg) { console.error('❌ ' + msg + '\nالاستعمال: boussala guide <path.json> | boussala suivre <path.json> <actuals.json> | boussala test'); process.exit(1); }
const strip = o => JSON.stringify(o, (k, v) => (k === 'logs' || k === 'hc' || k === 'v' || k.startsWith('_')) ? undefined : v, 2);

try {
  switch (pos[0]) {
    case 'guide': { const o = E.guide(read(pos[1])); console.log(json ? strip(o) : guideText(o)); break; }
    case 'suivre': case 'track': { const r = suivre({ path: read(pos[1]), ...read(pos[2]) }); console.log(json ? strip(r) : r.text); break; }
    case 'test': require(path.join(root, 'tests', 'run.js')); break;
    case 'version': console.log('Boussala engine ' + E.ENGINE_VERSION); break;
    default: die('أمر غير معروف.');
  }
} catch (e) { die(e.message); }
