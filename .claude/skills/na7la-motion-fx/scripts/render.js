/* HibAI Motions: render the effect cards.
   node render.js <project> preview [effects…]  → <project>/prev/NN_effect_f.jpg (3 stills per card)
   node render.js <project> all [effects…]      → <project>/fx/NN.mp4 (1.8 s, 1080×1920, silent) + frames in fx/NN/
   Needs Google Chrome + puppeteer-core (npm i puppeteer-core) and ffmpeg. */
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const P = path.resolve(process.argv[2] || '.'), mode = process.argv[3] || 'preview', only = process.argv.slice(4);
const SKILL = path.join(__dirname, '..');
function lib() {
  const tries = [path.join(P, 'node_modules/puppeteer-core'), path.join(SKILL, 'node_modules/puppeteer-core'),
    path.join(os.homedir(), '.claude/skills/hibai-studio/node_modules/puppeteer-core'), 'puppeteer-core', path.join(os.homedir(), 'node_modules/puppeteer-core')];
  for (const p of tries) { try { return require(p); } catch (e) {} }
  throw new Error('puppeteer-core not found: run  npm i puppeteer-core  in the skill folder');
}
const CHROME = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const url = f => 'file:///' + path.resolve(f).replace(/\\/g, '/').replace(/^\/+/, '');

const cfg = JSON.parse(fs.readFileSync(path.join(P, 'motions.json'), 'utf8'));
const theme = Object.assign({ accent: '#E6F07C', handle: 'yourname', brand: '' }, cfg.theme || {});
for (const k of ['fontAr', 'fontEn', 'avatar']) if (theme[k]) theme[k] = url(path.resolve(P, theme[k]));
const thumbs = fs.existsSync(path.join(P, 'thumbs')) ? fs.readdirSync(path.join(P, 'thumbs')).filter(f => f.endsWith('.jpg')).sort().map(f => 'thumbs/' + f) : [];
const cards = cfg.cards.map((c, k) => ({ effect: c.effect, words: c.words || [], second: c.second, dir: String(k + 1).padStart(2, '0') }));
fs.copyFileSync(path.join(SKILL, 'assets', 'effects.html'), path.join(P, '_effects.html'));   // the page lives in the project so it can read cards/ and thumbs/

(async () => {
  const b = await lib().launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files', '--force-color-profile=srgb', ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [])] });
  const p = await b.newPage(); p.on('console', m => { if (/FX |font/.test(m.text())) console.log('page:', m.text()); }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.setViewport({ width: 1080, height: 1920 });
  await p.goto(url(path.join(P, '_effects.html')), { waitUntil: 'load' });
  await p.evaluate(c => window.setup(c), { theme, thumbs, cards });
  for (const [k, c] of cards.entries()) {
    if (only.length && !only.includes(c.effect)) continue;
    const frames = mode === 'preview' ? [6, 20, 40] : [...Array(54)].map((_, i) => i);
    const out = path.join(P, mode === 'preview' ? 'prev' : 'fx/' + c.dir); fs.mkdirSync(out, { recursive: true });
    for (const f of frames) {
      const d = await p.evaluate((k, f) => window.frame(k, f), k, f);
      const name = mode === 'preview' ? `${c.dir}_${c.effect}_${f}.jpg` : String(f + 1).padStart(5, '0') + '.jpg';
      fs.writeFileSync(path.join(out, name), Buffer.from(d.split(',')[1], 'base64'));
    }
    if (mode === 'all') execSync(`ffmpeg -nostdin -v error -y -framerate 30 -i "${out}/%05d.jpg" -c:v libx264 -crf 16 -pix_fmt yuv420p "${P}/fx/${c.dir}.mp4"`);
    console.log('done', c.dir, c.effect);
  }
  await b.close();
})();
