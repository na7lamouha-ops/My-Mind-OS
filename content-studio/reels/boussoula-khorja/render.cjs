// Usage: node render.cjs [--stills 1.2,3.4]  -> video.mp4 (silent) or stills/*.png
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const FPS = 30, HERE = __dirname;
(async () => {
  const si = process.argv.indexOf('--stills');
  const stills = si > -1 ? process.argv[si + 1].split(',').map(Number) : null;
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await pg.goto('file://' + path.join(HERE, 'reel.html'));
  await pg.evaluate('document.fonts.ready.then(()=>fit())'); await pg.waitForTimeout(500);
  if (stills) {
    fs.mkdirSync(path.join(HERE, 'stills'), { recursive: true });
    for (const t of stills) { await pg.evaluate(`render(${t})`); await pg.screenshot({ path: path.join(HERE, 'stills', t.toFixed(2).padStart(5, '0') + '.png') }); }
  } else {
    const dur = await pg.evaluate('DUR');
    const tmp = path.join(HERE, 'video.tmp.mp4');
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(dur * FPS);
    for (let i = 0; i < n; i++) {
      await pg.evaluate(`render(${i / FPS})`);
      const buf = await pg.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) process.stdout.write(`\r${Math.round(i / n * 100)}%`);
    }
    ff.stdin.end(); await new Promise((r, j) => ff.on('close', c => c === 0 ? r() : j(c)));
    fs.renameSync(tmp, path.join(HERE, 'video.mp4')); console.log('\nvideo.mp4');
  }
  await b.close();
})();
