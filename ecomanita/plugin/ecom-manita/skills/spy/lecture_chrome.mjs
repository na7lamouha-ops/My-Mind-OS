// lecture_chrome.mjs — fait la même lecture que lecture_navigateur.js, sans Claude et sans navigateur ouvert :
// lance Google Chrome en arrière-plan (profil vide, temporaire), ouvre la page de la Ad Library,
// exécute lecture_navigateur.js, écrit le JSON, ferme Chrome. Aucune dépendance (Node 22+).
// usage : node lecture_chrome.mjs <page_id> <pays> <sortie.json>
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [pageId, pays, sortie] = process.argv.slice(2);
if (!/^\d{6,20}$/.test(pageId || "") || !/^[A-Z]{2}$/.test(pays || "") || !sortie) {
  console.log("ÉCHEC · usage : node lecture_chrome.mjs <page_id> <PAYS> <sortie.json>"); process.exit(2);
}
const CHROME = process.env.SPY_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const script = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "lecture_navigateur.js"), "utf8")
  .replace(/^\s*\/\/.*$/gm, "").replace(/^\s*await\s*/, "");
const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${pays}&view_all_page_id=${pageId}`;
const profil = mkdtempSync(join(tmpdir(), "spy-chrome-"));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`,
  "--no-first-run", "--no-default-browser-check", "--lang=fr-FR", "--window-size=1280,2000", "about:blank"],
  { stdio: "ignore" });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let fini = false;
const fin = async (code, msg) => {
  if (fini) return; fini = true; console.log(msg);
  const sortieChrome = new Promise((r) => chrome.once("exit", r));
  try { chrome.kill(); } catch {}
  await Promise.race([sortieChrome, attendre(5000)]);
  try { rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {}
  process.exit(code);
};
setTimeout(() => fin(3, "ÉCHEC · délai dépassé (4 min)"), 240000);
try {
  let cible = null;
  for (let i = 0; i < 40 && !cible; i++) {
    await attendre(500);
    try { cible = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
  }
  if (!cible) fin(4, "ÉCHEC · Chrome ne répond pas");
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
  let n = 0; const attente = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && attente.has(d.id)) { attente.get(d.id)(d); attente.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; attente.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  await cdp("Page.enable");
  await cdp("Page.navigate", { url });
  await attendre(8000);
  const r = await cdp("Runtime.evaluate", { expression: script, awaitPromise: true, returnByValue: true });
  const val = r.result && r.result.result && r.result.result.value;
  if (typeof val !== "string") fin(5, "ÉCHEC · lecture impossible : " + JSON.stringify(r.result && r.result.exceptionDetails || r.error || {}).slice(0, 200));
  const d = JSON.parse(val);
  if (!d.pubs.length) fin(6, "ÉCHEC · aucune pub lue (page vide, ou Facebook demande une connexion)");
  writeFileSync(sortie, JSON.stringify(d));
  fin(0, `PASSE · ${d.pubs.length} cartes lues sur ${d.total} résultats`);
} catch (e) { fin(7, "ÉCHEC · " + String(e).slice(0, 200)); }
