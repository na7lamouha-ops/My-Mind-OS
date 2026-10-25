// ecom manita — LES TRAVAUX : les outils Python de la maison (montage, captures, page, testing, coach,
// scaling, carnet) tournent ICI, en arrière-plan, un à la fois, hors de la file de Claude (un montage
// dure des minutes, le coach doit pouvoir répondre pendant ce temps).
// La surveillance se fait par les FICHIERS et le flux de sortie, jamais par la confiance : un outil qui
// n'écrit plus rien pendant trop longtemps est arrêté et on dit pourquoi (loi de surveillance du 16/09).
// Windows : python lancé en mode UTF-8 (-X utf8) — sinon l'arabe tue la sortie ; l'arbre entier est tué
// (taskkill /T), sinon un ffmpeg orphelin continue à tourner. Code original « ecom manita » — 03/10/2026.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Le python de la machine : le réglage (chemin exact écrit par l'installateur), sinon le nom standard. */
export function trouverPython(reglage, plateforme = process.platform) {
  if (reglage && fs.existsSync(reglage)) return reglage;
  if (process.env.MANITA_PYTHON && fs.existsSync(process.env.MANITA_PYTHON)) return process.env.MANITA_PYTHON; // posé par l'installateur pour l'épreuve
  return plateforme === 'win32' ? 'python' : 'python3';
}

/** L'environnement d'un outil : UTF-8 partout, la maison du client, ffmpeg devant dans le PATH, sortie JSON. */
export function envOutil({ base = process.env, maison, ffmpegDossier = '', plus = {} } = {}) {
  const env = { ...base, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1', MANITA_JSON: '1', ...plus };
  if (maison) env.MANITA_MAISON = maison;
  if (ffmpegDossier) {
    const cle = Object.keys(env).find(k => k.toUpperCase() === 'PATH') || 'PATH';
    env[cle] = ffmpegDossier + path.delimiter + (env[cle] || '');
  }
  return env;
}

/** Lit les lignes « MANITA_JSON {…} » qu'un outil imprime quand MANITA_JSON=1. */
export function jsonDesSorties(texte) {
  const out = [];
  for (const l of String(texte || '').split(/\r?\n/)) {
    const i = l.indexOf('MANITA_JSON ');
    if (i < 0) continue;
    try { out.push(JSON.parse(l.slice(i + 12))); } catch {}
  }
  return out;
}

function tuerArbre(p) {
  if (!p || p.exitCode !== null) return;
  if (process.platform === 'win32') { try { spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true }); } catch {} }
  else { try { process.kill(-p.pid, 'SIGKILL'); } catch { try { p.kill('SIGKILL'); } catch {} } }
}

const VIVANTS = new Set(); // les outils qui tournent : tués avec le bureau (sinon un montage orphelin continue seul)
let gardeSortie = false;
function garderLaSortie() {
  if (gardeSortie) return; gardeSortie = true;
  const tout = () => { for (const p of VIVANTS) tuerArbre(p); };
  process.on('exit', tout);
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) { try { process.on(s, () => { tout(); process.exit(0); }); } catch {} }
}

export function creerTravaux({ journal = () => {}, python = () => trouverPython(''), env = () => process.env } = {}) {
  garderLaSortie();
  const file = []; let occupe = false; let enCours = null;
  async function tourner() {
    if (occupe) return; occupe = true;
    while (file.length) { const { spec, ok, ko } = file.shift(); try { ok(await executer(spec)); } catch (e) { ko(e); } }
    occupe = false;
  }
  /**
   * spec = { nom, script, args, cwd, journalFichier, dureeMaxMs, inactiviteMaxMs, code (python -c) }
   * Rend { code, sortie (les 400 dernières lignes), json:[…], dureeMs, raison } — ne rejette jamais pour un
   * code de sortie non nul : c'est à l'étape de lire le code (un « porte fermée » rend 3, ce n'est pas une panne).
   */
  function executer(spec) {
    return new Promise(resoudre => {
      const debut = Date.now();
      const args = ['-X', 'utf8', '-u'];
      if (spec.code) args.push('-c', spec.code); else args.push(spec.script);
      args.push(...(spec.args || []).map(String));
      if (spec.cwd) fs.mkdirSync(spec.cwd, { recursive: true });
      if (spec.journalFichier) fs.mkdirSync(path.dirname(spec.journalFichier), { recursive: true });
      const flux = spec.journalFichier ? fs.createWriteStream(spec.journalFichier, { flags: 'a' }) : null;
      if (flux) flux.write(`\n===== ${new Date().toISOString()} ${spec.nom || ''}\n`);
      let p;
      try { p = spawn(python(), args, { cwd: spec.cwd || undefined, env: { ...env(), ...(spec.env || {}) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' }); }
      catch (e) { if (flux) flux.end(); return resoudre({ code: -1, sortie: '', json: [], dureeMs: 0, raison: 'python introuvable : ' + e.message }); }
      enCours = { nom: spec.nom, debut, pid: p.pid }; VIVANTS.add(p);
      let sortie = '', derniere = Date.now(), raison = '', fini = false;
      const garder = d => { const s = d.toString('utf8'); sortie += s; if (sortie.length > 400000) sortie = sortie.slice(-300000); derniere = Date.now(); if (flux) flux.write(s); };
      p.stdout.on('data', garder); p.stderr.on('data', garder);
      const dureeMax = spec.dureeMaxMs || 3600000, inactif = spec.inactiviteMaxMs || 900000;
      const garde = setInterval(() => {
        const t = Date.now();
        if (t - debut > dureeMax) { raison = `arrêté : plus de ${Math.round(dureeMax / 60000)} min`; tuerArbre(p); }
        else if (t - derniere > inactif) { raison = `arrêté : figé, plus rien écrit depuis ${Math.round(inactif / 60000)} min`; tuerArbre(p); }
      }, Math.min(10000, Math.max(1000, Math.floor(inactif / 6))));
      const finir = (code, err) => {
        if (fini) return; fini = true; clearInterval(garde); enCours = null; VIVANTS.delete(p);
        if (err && !raison) raison = err.code === 'ENOENT' ? 'python introuvable (installe-le, ou corrige le chemin dans الإعدادات)' : err.message;
        const lignes = sortie.split(/\r?\n/);
        const res = { code: code ?? -1, sortie: lignes.slice(-400).join('\n'), json: jsonDesSorties(sortie), dureeMs: Date.now() - debut, raison };
        if (flux) flux.end(`\n===== fin code ${res.code}${raison ? ' — ' + raison : ''} (${Math.round(res.dureeMs / 1000)} s)\n`);
        journal(`outil ${spec.nom || ''} → code ${res.code}${raison ? ' — ' + raison : ''} (${Math.round(res.dureeMs / 1000)} s)`);
        resoudre(res);
      };
      p.on('error', e => finir(-1, e));
      p.on('close', c => finir(c));
    });
  }
  return {
    lancer: spec => new Promise((ok, ko) => { file.push({ spec, ok, ko }); tourner(); }),
    etat: () => ({ enCours: enCours ? { nom: enCours.nom, depuisS: Math.round((Date.now() - enCours.debut) / 1000) } : null, attente: file.length })
  };
}
