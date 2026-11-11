// capture_modeles.mjs — pour chaque modèle de modeles.json, télécharge l'IMAGE de sa pub la plus récente.
// 21/10 : seules les photos servies par scontent*.fbcdn.net (photo de la pub) ; jamais les illustrations
// de Meta (static.xx.fbcdn.net/rsrc.php) qu'affiche une pub qui n'est plus montrée.
// L'image ne vient d'aucun champ du connecteur : Chrome sans fenêtre (profil vide, jeté après) ouvre
// la page publique de la pub (ads/library/?id=…), lit la balise <img> de la pub (fbcdn) et télécharge ce fichier.
// Photo seulement, parmi les 5 pubs les plus récentes du modèle ; que des vidéos : « vidéo seulement », pas d'image. Rien trouvé : « capture: null », jamais une image vide.
// Une seule fenêtre Chrome pour toutes les pubs. Les liens fbcdn expirent : on télécharge pendant le run.
// usage : node capture_modeles.mjs <modeles.json> <dossier-captures> [page_id,page_id…]
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [chemin, dossier, filtre] = process.argv.slice(2);
if (!chemin || !dossier) { console.log("ÉCHEC · usage : node capture_modeles.mjs <modeles.json> <dossier> [page_ids]"); process.exit(2); }
const res = JSON.parse(readFileSync(chemin, "utf8"));
const seules = filtre ? new Set(filtre.split(",")) : null;
const travail = res.filter((m) => !seules || seules.has(m.page_id)).flatMap((m) => m.modeles.map((x, i) => ({ m, x, i })));
mkdirSync(dossier, { recursive: true });

const CHROME = process.env.SPY_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profil = mkdtempSync(join(tmpdir(), "spy-cap-"));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`,
  "--no-first-run", "--no-default-browser-check", "--lang=fr-FR", "--window-size=1280,1600", "about:blank"], { stdio: "ignore" });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
let fini = false;
const fin = async (code, msg) => {
  if (fini) return; fini = true;
  writeFileSync(chemin, JSON.stringify(res, null, 1));
  console.log(msg);
  try { chrome.kill(); } catch {}
  await attendre(1500);
  try { rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {}
  process.exit(code);
};
setTimeout(() => fin(3, "ÉCHEC · délai dépassé"), 60000 + travail.length * 5 * 12000);

let cible = null;
for (let i = 0; i < 40 && !cible; i++) {
  await attendre(500);
  try { cible = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
}
if (!cible) await fin(4, "ÉCHEC · Chrome ne répond pas");
const ws = new WebSocket(cible.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let n = 0; const att = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && att.has(d.id)) { att.get(d.id)(d); att.delete(d.id); } };
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; att.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await cdp("Page.enable");

const LIRE = `JSON.stringify((() => {
  const pub = (u) => { try { const h = new URL(u).host; return h.startsWith("scontent") && h.endsWith(".fbcdn.net"); } catch (e) { return false; } };
  const img = [...document.images].filter(i => pub(i.src) && i.naturalWidth >= 300).map(i => i.src)[0];
  const poster = [...document.querySelectorAll('video')].map(v => v.poster).filter(pub)[0];
  return { src: img || poster || null, video: !img && !!poster };
})())`;
let ok = 0;
for (const { m, x, i } of travail) {
  // une photo d'abord : la couverture d'une vidéo est souvent la 1re image du film, pas le modèle
  let d = {}, premiereVideo = null;
  for (const id of x.pubs_capture || [x.pub_capture]) {
    await cdp("Page.navigate", { url: `https://www.facebook.com/ads/library/?id=${id}` });
    await attendre(8000);
    const r = await cdp("Runtime.evaluate", { expression: LIRE, returnByValue: true });
    d = JSON.parse(r.result?.result?.value || "{}");
    if (d.src && !d.video) { x.pub_capture = id; break; }
    if (d.src && !premiereVideo) premiereVideo = { ...d, id };
    d = {};
  }
  // que des vidéos : leur couverture est souvent un décor sans le modèle, donc pas d'image, et on le dit
  x.capture = null; x.video_seulement = !d.src && !!premiereVideo;
  if (d.src) {
    try {
      const rep = await fetch(d.src);
      const b = Buffer.from(await rep.arrayBuffer());
      if (rep.ok && b.length > 2000) {
        const f = join(dossier, `${m.page_id}-${i + 1}.jpg`);
        writeFileSync(f, b); x.capture = f; ok++;
      }
    } catch {}
  }
  console.log(`${m.page} · ${x.modele} · ${x.capture ? "photo" : x.video_seulement ? "vidéo seulement, pas de photo" : "AUCUNE IMAGE"}`);
}
const videos = travail.filter(({ x }) => x.video_seulement).length;
await fin(ok + videos === travail.length ? 0 : 1,
  `${ok + videos === travail.length ? "PASSE" : "PARTIEL"} · ${ok} photo(s) · ${videos} vidéo(s) seulement · ${travail.length - ok - videos} échec(s) sur ${travail.length} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
