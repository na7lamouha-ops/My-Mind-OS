// Usage:
//   node render.cjs                 -> out/video.mp4 (silent, 1080x1920, 30 fps)
//   node render.cjs --stills 1.4,13 -> stills/*.png
//   node render.cjs --sheet         -> out/contact-sheet.png (1 frame every 0.5 s)
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
const FPS = 30, HERE = __dirname, OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const arg = n => process.argv.indexOf(n);
  const t0 = Date.now();
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await pg.goto('file://' + path.join(HERE, 'reel.html'));
  await pg.evaluate('document.fonts.ready.then(()=>fit())'); await pg.waitForTimeout(400);
  const dur = await pg.evaluate('DUR');
  if (arg('--stills') > -1) {
    fs.mkdirSync(path.join(HERE, 'stills'), { recursive: true });
    for (const t of process.argv[arg('--stills') + 1].split(',').map(Number)) {
      await pg.evaluate(`render(${t})`);
      await pg.screenshot({ path: path.join(HERE, 'stills', t.toFixed(2).padStart(5, '0') + '.png') });
    }
  } else if (arg('--sheet') > -1) {
    const dir = path.join(OUT, 'sheet'); fs.mkdirSync(dir, { recursive: true });
    const ts = []; for (let t = 0; t < dur; t += 0.5) ts.push(t);
    for (const [i, t] of ts.entries()) { await pg.evaluate(`render(${t})`); await pg.screenshot({ path: path.join(dir, String(i).padStart(3, '0') + '.png') }); }
    const cols = 8, rows = Math.ceil(ts.length / cols);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(dir, '%03d.png'),
      '-vf', `scale=270:480,drawbox=x=0:y=0:w=iw:h=ih:color=gray@0.5:t=1,tile=${cols}x${rows}:padding=4:color=gray`, '-frames:v', '1', path.join(OUT, 'contact-sheet.png')]);
    console.log('out/contact-sheet.png', ts.length, 'frames');
  } else {
    const tmp = path.join(OUT, 'video.tmp.mp4');
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(dur * FPS);
    for (let i = 0; i < n; i++) {
      await pg.evaluate(`render(${i / FPS})`);
      const buf = await pg.screenshot({ type: 'jpeg', quality: 94 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 60 === 0) process.stdout.write(`\r${Math.round(i / n * 100)}%`);
    }
    ff.stdin.end(); await new Promise((r, j) => ff.on('close', c => c === 0 ? r() : j(c)));
    fs.renameSync(tmp, path.join(OUT, 'video.mp4')); console.log(`\nout/video.mp4 · ${n} frames`);
  }
  await b.close();
  console.log(`time ${((Date.now() - t0) / 1000).toFixed(1)} s`);
})();
