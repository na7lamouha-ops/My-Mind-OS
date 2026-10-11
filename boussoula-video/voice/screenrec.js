// تصوير الأداة «كأنك أنت»: فريم بفريم، كل خطوة مربوطة بجملة الصوت (VO)
// node screenrec.js <scenario.js> <outdir>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const FPS = 30, WPS = 2.6; // سرعة الكلام: ~2.6 كلمة في الثانية
(async () => {
  const [scnFile, out] = process.argv.slice(2); const SC = require(path.resolve(scnFile));
  const dir = `${out}/frames_${SC.name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.goto('file:///home/user/My-Mind-OS/boussoula-v2/index.html'); await pg.waitForTimeout(1200);
  await pg.addStyleTag({ content: `#guideFab{display:none!important}
   #fing{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.28);border:3px solid rgba(255,255,255,.9);box-shadow:0 4px 18px rgba(0,0,0,.5);z-index:99999;pointer-events:none;transition:none}
   #fing.tap{background:rgba(245,197,66,.55)}
   .rec-glow{outline:4px solid #F5C542!important;outline-offset:6px;border-radius:14px;box-shadow:0 0 40px rgba(245,197,66,.6)!important}` });
  await pg.evaluate(() => { const f = document.createElement('div'); f.id = 'fing'; f.style.left = '300px'; f.style.top = '600px'; document.body.appendChild(f); });
  if (SC.setup) await pg.evaluate(SC.setup);
  let n = 0, t = 0; const events = []; let fx = 300, fy = 600;
  const shot = async () => { await pg.screenshot({ path: `${dir}/f${String(n).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 }); n++; t = n / FPS; };
  const hold = async (sec) => { const k = Math.round(sec * FPS); for (let i = 0; i < k; i++) await shot(); };
  const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const center = sel => pg.evaluate(s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const moveF = async (x, y, sec = 0.45) => { const k = Math.max(1, Math.round(sec * FPS)), x0 = fx, y0 = fy; for (let i = 1; i <= k; i++) { const e = ease(i / k); fx = x0 + (x - x0) * e; fy = y0 + (y - y0) * e; await pg.evaluate(([x, y]) => { const f = document.getElementById('fing'); f.style.left = x + 'px'; f.style.top = y + 'px'; }, [fx, fy]); await shot(); } };
  const tapF = async () => { await pg.evaluate(() => document.getElementById('fing').classList.add('tap')); await hold(0.15); await pg.evaluate(() => document.getElementById('fing').classList.remove('tap')); };
  const scrollTo = async (sel, off = 120, sec = 0.9) => { const y1 = await pg.evaluate(([s, o]) => Math.max(0, document.querySelector(s).getBoundingClientRect().top + scrollY - o), [sel, off]); const y0 = await pg.evaluate(() => scrollY); const k = Math.round(sec * FPS); for (let i = 1; i <= k; i++) { await pg.evaluate(y => window.scrollTo(0, y), y0 + (y1 - y0) * ease(i / k)); await shot(); } };
  const read = sel => pg.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  const A = {
    wait: async (s) => hold(s.sec || 0.5),
    scroll: async (s) => scrollTo(s.sel, s.off ?? 120, s.sec || 0.9),
    type: async (s) => { const [x, y] = await center(s.sel); await moveF(x, y); await tapF(); await pg.evaluate(sel => { const e = document.querySelector(sel); e.focus(); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }, s.sel); await hold(0.1);
      const T = String(s.text); for (let i = 1; i <= T.length; i++) { const pre = T.slice(0, i); if (!pre.endsWith('.')) await pg.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [s.sel, pre]); await hold(s.fast ? 0.07 : 0.12); }
      await pg.evaluate(sel => document.querySelector(sel).blur(), s.sel); },
    slide: async (s) => { const [x, y] = await center(s.sel); await moveF(x, y); await tapF(); const k = Math.round((s.sec || 1) * FPS);
      for (let i = 1; i <= k; i++) { const v = Math.round(s.from + (s.to - s.from) * ease(i / k)); await pg.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [s.sel, v]); await shot(); } },
    tap: async (s) => { const [x, y] = await center(s.sel); await moveF(x, y); await tapF(); if (s.click) await pg.evaluate(sel => document.querySelector(sel).click(), s.sel); },
    glow: async (s) => { await pg.evaluate(sel => document.querySelector(sel).classList.add('rec-glow'), s.sel); await hold(s.sec || 1.2); if (!s.keep) await pg.evaluate(sel => document.querySelector(sel).classList.remove('rec-glow'), s.sel); },
    unglow: async (s) => pg.evaluate(sel => document.querySelector(sel).classList.remove('rec-glow'), s.sel),
    fingAway: async () => moveF(470, 900, 0.3),
  };
  // كل «بلوك»: جملة صوت + خطوات. مدة البلوك = أكبر وحدة بين الخطوات ومدة الكلام
  for (const blk of SC.blocks) {
    const t0 = t; for (const st of blk.do || []) await A[st.a](st);
    const words = (blk.say || '').split(/\s+/).filter(Boolean).length; const need = blk.say ? words / WPS + 0.35 : 0;
    if (t - t0 < need) await hold(need - (t - t0));
    if (blk.pause) await hold(blk.pause);
    const vals = {}; for (const [k, sel] of Object.entries(blk.read || {})) vals[k] = (await read(sel)).trim();
    events.push({ start: +t0.toFixed(2), end: +t.toFixed(2), say: blk.say || '', screen: blk.screen || '', vals });
  }
  await b.close();
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/f%05d.jpg`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/${SC.name}.mp4`]);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.writeFileSync(`${out}/${SC.name}.json`, JSON.stringify(events, null, 1));
  const ts = x => { const h = Math.floor(x / 3600), m = Math.floor(x % 3600 / 60), s = Math.floor(x % 60), ms = Math.round((x % 1) * 1000); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`; };
  fs.writeFileSync(`${out}/${SC.name}.srt`, events.filter(e => e.say).map((e, i) => `${i + 1}\n${ts(e.start)} --> ${ts(e.end)}\n${e.say}\n`).join('\n'));
  console.log(SC.name, 'dur', t.toFixed(1), 'frames', n); console.log(JSON.stringify(events.map(e => [e.start, e.vals])));
})();
