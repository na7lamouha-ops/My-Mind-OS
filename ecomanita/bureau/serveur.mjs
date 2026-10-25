// ecom manita — LE SERVEUR DU BUREAU : la page, l'API, la file de Claude, les travaux Python, la chaîne des
// missions (du lien Drive à la publicité qui tourne), Telegram, le carnet et l'horloge.
// Tout tourne sur la machine du client. Aucune clé API : le moteur lance Claude Code sur SON abonnement.
// Code original « ecom manita » — v0.2 le 28/09/2026, v0.3 (la chaîne, Windows) le 03/10/2026.
// v0.3.8 : un lien, plusieurs modèles — l'accueil lance un LOT (descente + séparation dans missions.mjs), le lot
// prêt revient à l'accueil (photos à confirmer), « ابدا » crée une mission par modèle. /api/lots pour la page.
// 08/10/2026 (décisions du vendeur) : un seul lien passe toujours — plus de repli « un lien par modèle » ; N = 1 est vérifié
// par separer.py (un lot d'un modèle : « seul » → sa mission, plusieurs → bascule) ; seul arrêt : « vide » (aucun groupe pur).
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tour, tokensDe, sonderConnecteurs, outilsEtape, trouverClaude, envEnfant, MODELES } from './moteur.mjs';
import { ouvrirCarnet, ecrireNote, listerNotes, lireNote, graphe, produits, refusDeContenu } from './carnet.mjs';
import { router, assemblerSysteme, lireSkill } from './routeur.mjs';
import { controleOutil, controleSource, controleAuditeur, verdictGlobal } from './controles.mjs';
import { creerTelegram } from './telegram.mjs';
import { creerSpy, lireDemandeSpy } from './spy.mjs'; // 23/10/2026 : « spy dz » écrit au robot du bureau
import { creerInspecteur, lireDemandeInspecteur } from './inspecteur.mjs'; // 0.4.0 : « افحص حسابي » écrit au robot du bureau
import { ouvrirRoutines } from './routines.mjs';
import { ouvrirAccueil, TEXTES as TEXTES_ACCUEIL, creasValide, creasDe } from './accueil.mjs';
import { pixelsDuBrut } from './missions.mjs'; // [v19-trois] les pixels de chaque compte, relus dans le brut
import { ouvrirMissions, WILAYAS_NORD, recouperRegions, ciblageDuClient, ciblageLu, ciblageDuPaquet, compterMusiques as compterMusiquesDe, detailMusiques, MUSIQUES_MIN, ecartMetaDe, choixLectureSeule } from './missions.mjs';
import { creerTravaux, trouverPython, envOutil } from './travaux.mjs';
import { creerDepot, epreuve as epreuveDuDepot, essaiMeta as essaiMetaDuDepot } from './depot.mjs';
import { lectureReelle, cheminJeton, sonder as sonderMetaLocal, configMcp, baseGraph, masquer, outilsDuCheminLocal, refusPendantTour, refusQuiArrete, PREFIXE as PREFIXE_META_LOCAL, VERSION_GRAPH, empreinteJeton, ressembleJeton, REFUS_SONDE } from './meta-mcp.mjs';

export const RACINE = path.dirname(fileURLToPath(import.meta.url));
const lireJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/* ---------- réglages ---------- */
const base = lireJSON(path.join(RACINE, 'bureau.json'));
if (!base) { console.error('bureau.json illisible'); process.exit(1); }
const FICHIER_LOCAL = path.join(RACINE, 'config.local.json');
const local = lireJSON(FICHIER_LOCAL) || {};
const cfg = () => lireJSON(FICHIER_LOCAL) || {};
export const BUREAU = { ...base, ...pick(local, ['nom', 'port', 'modele', 'dureeMaxSecondes']) };
const MAISON = process.env.MANITA_MAISON || local.maison || path.join(os.homedir(), 'ecom-manita-maison');
const ATELIER_DEFAUT = path.resolve(RACINE, '..', 'outils'); // le paquet : ecom-manita/bureau + ecom-manita/outils
const ATELIER = process.env.MANITA_ATELIER || local.atelier || (fs.existsSync(ATELIER_DEFAUT) ? ATELIER_DEFAUT : '');
const PORT = +(process.env.PORT || BUREAU.port || 4620);
const DUREE = Math.max(60, +BUREAU.dureeMaxSecondes || 300) * 1000;
const DUREE_CHAINE = Math.max(DUREE, 15 * 60000); // une étape de la chaîne (page, campagne) fait beaucoup d'appels
const DATA = path.join(MAISON, 'bureau-data');
fs.mkdirSync(DATA, { recursive: true });
const MUSIQUES_DEFAUT = path.join(MAISON, 'musiques');
fs.mkdirSync(MUSIQUES_DEFAUT, { recursive: true });
const carnet = ouvrirCarnet(MAISON);
const FICHIER_TACHES = path.join(DATA, 'taches.json');
const FICHIER_USAGE = path.join(DATA, 'usage.json');
const FICHIER_JOURNAL = path.join(DATA, 'journal.log');
const routines = ouvrirRoutines(path.join(MAISON, 'routines.json'), path.join(DATA, 'routines-etat.json'));
/* ---------- le serveur Meta LOCAL (09/10/2026, option A) : meta-mcp.mjs, le jeton d'utilisateur système du client ----------
 * Le jeton vit dans config.local.json (meta.jeton) : le serveur local le relit lui-même à chaque appel ; ce fichier-ci ne le
 * passe jamais en argument ni en variable d'environnement. Le fichier --mcp-config d'un tour ne porte AUCUN secret. */
const FICHIER_MCP_META = path.join(DATA, 'meta-mcp.json');
const DOSSIER_PORTES = path.join(DATA, 'meta-portes');
const JOURNAL_META = path.join(DATA, 'meta-mcp.log');
const FICHIER_SONDE_META = path.join(DATA, 'meta-sonde.json');
let GRAPH_LOCAL; try { GRAPH_LOCAL = baseGraph(process.env.MANITA_GRAPH || ''); } catch { GRAPH_LOCAL = baseGraph(''); }
const jetonMeta = () => { const c = cfg(); return typeof c?.meta?.jeton === 'string' ? c.meta.jeton.trim() : ''; };
function fichierMcpMeta({ pause = '' } = {}) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FICHIER_MCP_META, JSON.stringify(configMcp({ config: FICHIER_LOCAL, portes: DOSSIER_PORTES, journal: JOURNAL_META, graph: GRAPH_LOCAL, pause }), null, 1));
  return FICHIER_MCP_META;
}
/** La lecture RÉELLE (GET /me et le compte, par le code du serveur local) qui décide du chemin d'une mission ; journalisée. */
async function lireMetaLocal(compte) {
  // sans compte (la sonde de reprise) : le premier compte des réglages — jamais une reprise sur /me seul (10/10/2026)
  const c = cfg(); const cpt = compte || (c.comptes && c.comptes[0] && c.comptes[0].id) || null;
  const r = await lectureReelle({ fichierConfig: FICHIER_LOCAL, base: GRAPH_LOCAL, compte: cpt });
  journal(`meta local : lecture réelle ${r.ok ? 'OK' : 'refusée (' + (r.classe || '?') + ')'} — ${masquer(r.raison, jetonMeta())}`);
  return r;
}
/** Un jeton Meta collé AILLEURS que dans التحضير (la tâche, le chat du coach) : refusé, jamais gardé ni envoyé à Claude. */
const JETON_ICI = 'ما تلصقش التوكن هنا : لصقو في التحضير (توكن ميتا)';
function pick(o, cles) { const r = {}; for (const k of cles) if (o[k] !== undefined) r[k] = o[k]; return r; }

/* ---------- journal ---------- */
export function journal(texte) {
  const ligne = `${new Date().toISOString()} ${texte}`;
  console.log(ligne);
  try { fs.appendFileSync(FICHIER_JOURNAL, ligne + '\n'); } catch {}
}

/* ---------- ce qui se dit dans le bureau (les répliques des agents animés), gardé chez le client ---------- */
const FICHIER_BAVARDAGES = path.join(DATA, 'bavardages.jsonl');
export function ajouterBavardages(lignes) {
  if (!Array.isArray(lignes)) return 0;
  const n = Date.now(), quandDe = l => { const q = Date.parse(l?.quand); return q <= n + 5000 && n - q < 86400000 ? new Date(q).toISOString() : new Date(n).toISOString(); };
  const propres = lignes.slice(0, 50).map(l => ({ quand: quandDe(l), qui: String(l?.qui || '').slice(0, 40), a: String(l?.a || '').slice(0, 40), sorte: String(l?.sorte || '').slice(0, 20), texte: String(l?.texte || '').slice(0, 300) })).filter(l => l.texte.trim());
  if (!propres.length) return 0;
  try { if (fs.statSync(FICHIER_BAVARDAGES).size > 3e6) fs.renameSync(FICHIER_BAVARDAGES, FICHIER_BAVARDAGES + '.1'); } catch {}
  fs.appendFileSync(FICHIER_BAVARDAGES, propres.map(l => JSON.stringify(l)).join('\n') + '\n');
  return propres.length;
}
/** L'ancienne génération puis la courante ; max = les N dernières lignes (sans max : tout). */
export function lireBavardages(max = 0) {
  const lire = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
  const lignes = (lire(FICHIER_BAVARDAGES + '.1') + lire(FICHIER_BAVARDAGES)).split('\n').filter(Boolean);
  return (max ? lignes.slice(-max) : lignes).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
// un seul onglet enregistre à la fois : celui qui tient le bail (renouvelé à chaque envoi, repris après huit secondes de silence)
let bailBavardages = { id: null, t: 0 };
export function bailAccorde(onglet, focus = false) {
  const id = typeof onglet === 'string' ? onglet.slice(0, 40) : '', t = Date.now();
  if (!id) return true; // ancien client sans identifiant : on accepte
  if (!bailBavardages.id || bailBavardages.id === id || t - bailBavardages.t > 8000 || (focus && !bailBavardages.focus)) { bailBavardages = { id, t, focus: !!focus }; return true; }
  return false;
}

/* ---------- usage (le compte du bureau, sans lire aucun jeton) ---------- */
const FENETRE = 5 * 3600 * 1000;
let usage = lireJSON(FICHIER_USAGE) || { fenetreDebut: null, tokens: 0, tours: 0, totalTokens: 0, totalTours: 0 };
function compterUsage(u) {
  const t = tokensDe(u); const maintenant = Date.now();
  if (!usage.fenetreDebut || maintenant - usage.fenetreDebut >= FENETRE) { usage.fenetreDebut = maintenant; usage.tokens = 0; usage.tours = 0; }
  usage.tokens += t; usage.tours += 1; usage.totalTokens += t; usage.totalTours += 1;
  fs.writeFileSync(FICHIER_USAGE, JSON.stringify(usage));
}
function usageActuel() {
  const maintenant = Date.now();
  const vivante = usage.fenetreDebut && maintenant - usage.fenetreDebut < FENETRE;
  return { fenetre: { tokens: vivante ? usage.tokens : 0, tours: vivante ? usage.tours : 0, debut: vivante ? usage.fenetreDebut : null, fin: vivante ? usage.fenetreDebut + FENETRE : null }, total: { tokens: usage.totalTokens, tours: usage.totalTours } };
}

/* ---------- tâches (v0.2 : le client tape une tâche, le manager la route) ---------- */
let taches = lireJSON(FICHIER_TACHES) || [];
const sauver = () => fs.writeFileSync(FICHIER_TACHES, JSON.stringify(taches, null, 2));
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const connecteursVus = new Map(); // id → statut, depuis les événements init

function nouvelleTache({ texte, departement = null, modele = null, besoinOk = null, origine = 'bureau', routineId = null }) {
  const t = { id: nid(), creeLe: new Date().toISOString(), texte: String(texte).trim(), departement, poste: null, titre: String(texte).trim().slice(0, 60), etat: 'afaire', besoinOk, origine, routineId,
    modele: modele || BUREAU.modele, resultat: '', erreur: '', outilsUtilises: [], controles: {}, verdict: null, note: null, usage: 0, dureeMs: 0, historique: [], approbation: null };
  taches.unshift(t); sauver(); return t;
}
const trouver = id => taches.find(t => t.id === id);
function poser(t, champs) { Object.assign(t, champs); t.majLe = new Date().toISOString(); sauver(); }

/* ---------- leçons ---------- */
const FICHIER_LECONS = d => path.join(MAISON, 'lecons', `${d}.md`);
function lecons(d) { try { return fs.readFileSync(FICHIER_LECONS(d), 'utf8').split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2)).slice(-15); } catch { return []; } }
function apprendre(d, texte) { const refus = refusDeContenu(texte); if (refus) return refus; fs.mkdirSync(path.dirname(FICHIER_LECONS(d)), { recursive: true }); fs.appendFileSync(FICHIER_LECONS(d), `- ${new Date().toISOString().slice(0, 10)} : ${texte.trim().replace(/\n+/g, ' ')}\n`); return null; }

/* ---------- la file : un tour de Claude à la fois ---------- */
const file = []; let occupe = false;
function enfiler(fn) { file.push(fn); tourner(); }
async function tourner() {
  if (occupe) return; occupe = true;
  while (file.length) { const fn = file.shift(); try { await fn(); } catch (e) { journal('file : ' + e.message); } }
  occupe = false;
}

/** Les préfixes des connecteurs du client (trouvés par la sonde) : { tassyir: 'mcp__claude_ai_X__', meta: '…' }. */
const prefixes = () => (cfg().connecteurs && typeof cfg().connecteurs === 'object' && !Array.isArray(cfg().connecteurs)) ? cfg().connecteurs : {};
/** Les outils qu'un agent reçoit (tâches v0.2) : LECTURE seulement ; ÉCRITURE seulement en phase « lance ». */
export function outilsPour(dept, phase = 'travail') {
  const d = BUREAU.departements.find(x => x.id === dept) || {};
  const liste = [];
  for (const id of d.connecteurs || []) {
    const c = (BUREAU.connecteurs && BUREAU.connecteurs[id]) || null;
    if (!c) continue;
    for (const t of c.lecture || []) liste.push(`${id}.${t}`);
    if (phase === 'lance' && (d.ecriture || []).includes(id)) for (const t of c.ecriture || []) liste.push(`${id}.${t}`);
  }
  return outilsEtape(liste, prefixes());
}

async function executer(t, { phase = 'travail', consigne = '' } = {}) {
  try {
    if (!t.departement || !t.poste) {
      const r = await router({ bureau: BUREAU, texte: t.texte, modele: t.modele, deptForce: t.departement });
      if (r.usage) compterUsage(r.usage);
      poser(t, { departement: r.departement, poste: r.poste, titre: r.titre, besoinOk: t.besoinOk === null ? r.besoinOk : t.besoinOk, pourquoi: r.pourquoi });
      journal(`→ ${t.id} ${r.departement}/${r.poste} : ${r.titre}${r.erreur ? ' (routage de secours : ' + r.erreur + ')' : ''}`);
    }
    poser(t, { etat: 'encours', phase });
    const d = BUREAU.departements.find(x => x.id === t.departement);
    const systeme = assemblerSysteme({ racine: RACINE, bureau: BUREAU, dept: t.departement, poste: t.poste, carnet, texte: t.texte, lecons: lecons(t.departement), fiche: reglagesMasques() });
    const message = phase === 'lance'
      ? `Le client a écrit le mot « lance ». Exécute MAINTENANT, avec tes outils, l'étape que tu avais préparée dans ce livrable, exactement comme elle est écrite, sans rien ajouter :\n\n${t.resultat}\n\nRÈGLES QUI NE SAUTENT JAMAIS : tout objet publicitaire que tu crées naît EN PAUSE (status PAUSED) ; tu n'actives RIEN que le livrable ne nomme pas ; chaque objet est visé par son ID, jamais par son nom ; aucun plafond de dépense ; jamais dispatch_orders, cancel_order, deliver_order, return_order ni confirm_order.\n\nPuis rends le compte rendu de ce que tu as réellement fait, avec « Sources lues : » et « Contrôle intégré : ».`
      : phase === 'auto-correction'
        ? `Reprends ta tâche : ${t.texte}\n\nTon livrable précédent :\n${t.resultat}\n\nLES CONTRÔLES ONT TROUVÉ CES FAUTES (corrige-les TOUTES et rends le livrable complet corrigé, rien d'autre) : ${consigne}`
      : phase === 'revision'
        ? `Reprends ta tâche : ${t.texte}\n\nTon livrable précédent :\n${t.resultat}\n\nCORRECTION DU CLIENT (à appliquer, et à retenir pour toujours) : ${consigne}`
        : t.texte;
    const r = await tour({ message, systeme, modele: t.modele, dureeMaxMs: DUREE, outilsAutorises: outilsPour(t.departement, phase) });
    // une correction reprend le livrable déjà lu : les outils appelés aux phases précédentes de CETTE tâche restent la preuve de lecture
    if (phase === 'auto-correction' || phase === 'revision') r.outils = [...new Set([...t.historique.flatMap(h => h.outils || []), ...(r.outils || [])])];
    for (const c of r.connecteurs) connecteursVus.set(c.id, c.statut);
    if (r.usage) compterUsage(r.usage);
    const controles = { outil: controleOutil(r), source: controleSource(r, d?.connecteurs || []) };
    controles.auditeur = await controleAuditeur({ tache: t, resultat: r, modele: t.modele, dureeMaxMs: Math.min(DUREE, 150000) });
    if (controles.auditeur.usage) compterUsage(controles.auditeur.usage);
    const verdict = verdictGlobal(controles);
    let note = null;
    try { note = ecrireNote(carnet, { titre: t.titre, dept: t.departement, poste: t.poste, agent: t.poste, texte: r.texte, outils: r.outils, modele: r.modele, controles: { outil: controles.outil.verdict, source: controles.source.verdict, auditeur: controles.auditeur.verdict, verdict }, tacheId: t.id }); }
    catch (e) { journal(`note refusée pour ${t.id} : ${e.message}`); controles.carnet = { verdict: 'ECHEC', detail: e.message }; }
    t.historique.push({ phase, quand: new Date().toISOString(), verdict, dureeMs: r.dureeMs, outils: r.outils });
    poser(t, { resultat: r.texte, outilsUtilises: r.outils, controles, verdict, note, modeleUtilise: r.modele, usage: t.usage + tokensDe(r.usage) + tokensDe(controles.auditeur.usage), dureeMs: t.dureeMs + r.dureeMs, erreur: '' });
    if (verdict === 'ECHEC' && phase !== 'auto-correction' && phase !== 'lance' && !t.autoCorrige) {
      const fautes = [controles.outil.verdict === 'ECHEC' ? 'forme : ' + controles.outil.detail : '', ...(controles.auditeur.fautes || []), controles.auditeur.aCorriger || ''].filter(Boolean).join(' ; ');
      poser(t, { autoCorrige: true, etat: 'encours' });
      journal(`↻ ${t.id} auto-correction — ${fautes.slice(0, 200)}`);
      return executer(t, { phase: 'auto-correction', consigne: fautes });
    }
    const etat = verdict === 'ECHEC' ? 'echec' : (t.besoinOk && ['travail', 'auto-correction', 'revision'].includes(phase)) ? 'attente' : 'fini';
    poser(t, { etat });
    journal(`${etat === 'echec' ? '✗' : etat === 'attente' ? '⏸' : '✓'} ${t.id} ${t.titre} — outil ${controles.outil.verdict} · source ${controles.source.verdict} · auditeur ${controles.auditeur.verdict}${phase === 'auto-correction' ? ' (après auto-correction)' : ''}`);
    if (etat === 'attente') await demanderAccord(t);
    else await prevenir(t);
  } catch (e) {
    poser(t, { etat: 'echec', erreur: e.message });
    journal(`✗ ${t.id} ${e.message}`);
  }
}

/* ---------- les travaux Python, le dépôt, la chaîne ---------- */
const travaux = creerTravaux({ journal, python: () => trouverPython(cfg().python || ''), env: () => envOutil({ maison: MAISON, ffmpegDossier: cfg().ffmpegDossier || '' }) });
const depot = creerDepot({ journal, reglage: () => ({ type: (cfg().depot && cfg().depot.type) || 'tunnel', cloudflared: cfg().cloudflared || 'cloudflared', r2: (cfg().depot && cfg().depot.r2) || null }) });
/** Un tour de Claude pour la chaîne, dans LA file (un seul Claude à la fois, comme les tâches). modele : un tour léger
 *  (missions.mjs MODELE_LEGER, au premier essai seulement) passe son modèle au CLI ; sinon celui du bureau.
 *  Les connecteurs de l'étape sont EXIGÉS « connected » à l'init (needs-auth, pending, failed : le tour s'arrête avant
 *  toute question, erreur e.connecteur) ; un connecteur que la dernière sonde n'a pas gardé (préfixe absent) est un
 *  connecteur à reconnecter aussi — jamais une panne qui consomme un essai (missions.mjs). */
function claudeChaine({ systeme, message, outils, schema, images, modele, cheminMeta = null, pauseSeule = null, dureeMaxMs = null }) {
  return new Promise((ok, ko) => enfiler(async () => {
    try {
      // le chemin LOCAL (décidé par missions.mjs) : Meta = meta_manita (déclaré par --mcp-config), jamais le connecteur claude.ai
      const local = cheminMeta === 'local';
      if (local) outils = outilsDuCheminLocal(outils);
      const p = local ? { ...prefixes(), meta: PREFIXE_META_LOCAL } : prefixes();
      const cles = [...new Set((outils || []).map(o => String(o).split('.')[0]))];
      const besoin = cles.filter(k => !p[k]);
      if (besoin.length) throw Object.assign(new Error(`connecteur à reconnecter : ${besoin.join(', ')} (pas branché à la dernière sonde) — الإعدادات ← افحص الكونيكتورات`), { connecteur: { cles: besoin, statuts: besoin.map(k => `${k} (absent)`) }, appels: [] });
      const r = await tour({ message, systeme, outilsAutorises: outilsEtape(outils, p), schema, images, modele: MODELES.includes(modele) ? modele : BUREAU.modele, dureeMaxMs: Math.max(DUREE_CHAINE, +dureeMaxMs || 0), // le SPY lit jusqu'à quarante pages
        exigerConnecteurs: cles.filter(k => !(local && k === 'meta')).map(k => ({ cle: k, prefixe: p[k] })), ...(local ? { mcpConfig: fichierMcpMeta({ pause: pauseSeule || '' }) } : {}) });
      for (const c of r.connecteurs) connecteursVus.set(c.id, c.statut);
      // un refus de Meta au serveur local PENDANT le tour (#190 jeton, #200/#10 droits) : un connecteur à reconnecter, pas une panne
      if (local) {
        const refus = await refusQuiArrete(r.appels, () => lireMetaLocal(null));
        if (!refus && refusPendantTour(r.appels)) journal('meta local : un refus de droits pendant le tour (objet du tour), le jeton et le compte se lisent : le tour garde son résultat');
        if (refus) { if (r.usage) compterUsage(r.usage); throw Object.assign(new Error(`connecteur à reconnecter : metaLocal (${refus} refusé par Meta pendant le tour)`), { connecteur: { cles: ['metaLocal'], statuts: [`metaLocal (${refus})`] }, appels: r.appels }); }
      }
      if (r.usage) compterUsage(r.usage);
      if ((r.refus || []).length) journal(`chaîne : ${r.refus.length} appel(s) refusé(s) par la liste blanche : ${r.refus.map(x => x.tool_name || '?').join(', ')}`);
      ok({ ...r, tokens: tokensDe(r.usage) });
    } catch (e) { ko(e); }
  }));
}
const reglagesChaine = () => {
  const c = cfg();
  return { taux: +c.taux || 0, couts: c.couts || {}, declare: c.declare || {}, plafondJourDA: +c.plafondJourDA || 0, heureRapport: c.heureRapport || '20:30', joursReappro: +c.joursReappro || 7,
    // jamais toute l'Algérie (07/10/2026 : { type: 'pays' } envoyait le test sur les 58 wilayas) : sans « ciblage » à lui,
    // le client a les 25 wilayas du paquet (clés de Meta incluses, confirmées) ; une liste qu'il a décochée arrête la campagne AVANT Meta
    codeBoutique: c.codeBoutique || '', musiques: c.musiques || MUSIQUES_DEFAUT, magasin: c.magasin || null, ciblage: c.ciblage || ciblageDuPaquet(), ffmpegDossier: c.ffmpegDossier || '',
    // les créas du test par modèle (08/10/2026) : 1 à 4, défaut quatre ; une valeur abîmée dans config.local.json vaut quatre
    creasParModele: creasDe(undefined, c.creasParModele),
    // [porte-groupee] l'écart entre les heures de début des modèles d'un lot (porte « لانسي » groupée) : 0 à 12 h, défaut 2
    ecartMetaHeures: ecartMetaDe(c.ecartMetaHeures),
    // [anonymat] 10/10/2026 : une seule lecture des planches vérifiée → « continuer » (défaut, missions.LECTURE_SEULE_VERIFIEE)
    // ou « arreter » (l'ancien arrêt « vide ») ; [casse-6] lavé par missions.choixLectureSeule : « arrêter », « Arreter », « stop »,
    // false → arreter ; absent → continuer ; une valeur écrite non reconnue → arreter (prudence), jamais « continuer » en silence
    lectureSeuleVerifiee: choixLectureSeule(c.lectureSeuleVerifiee) };
};
const accueil = ouvrirAccueil({ dossier: path.join(MAISON, 'demandes'), journal, listes: () => ({ comptes: cfg().comptes || [], pages: cfg().pages || [], taux: +cfg().taux || 0, plafondJourDA: +cfg().plafondJourDA || 0, creasParModele: creasDe(undefined, cfg().creasParModele) }) });
const missions = ouvrirMissions({ maison: MAISON, atelier: ATELIER, journal, travaux, claude: claudeChaine, telegram: () => telegram, depot, reglages: reglagesChaine,
  skillDe: dept => lireSkill(RACINE, (BUREAU.departements.find(d => d.id === dept) || BUREAU.centre || {}).skill),
  surLot: lot => lotFini(lot),
  // un connecteur à reconnecter : la chaîne sonde elle-même (bornée), et reprend dès qu'il revient « connected »
  sonder: () => sonder(),
  metaLocal: { lire: compte => lireMetaLocal(compte) },
  ...(process.env.MANITA_DELAI_SONDE_MS ? { delaiSondeMs: +process.env.MANITA_DELAI_SONDE_MS } : {}),
  pauseReessaiMs: +(process.env.MANITA_PAUSE_REESSAI_MS || 30000) });

/* ---------- Telegram : l'entrée (le lien, les réponses) et la sortie (les questions, les rapports) ---------- */
let telegram = creerTelegram(local.telegram, journal, { fichierPosition: path.join(DATA, 'telegram-position.json') });
/** LE SPY (23/10/2026) : « spy dz » écrit au robot → un tour de Claude (ads_library_search seul, lecture), les outils de la skill
 *  spy (spy_calc.py, modeles.py, capture_modeles.mjs), puis photo et ligne de chaque boutique et la conclusion. Un seul à la fois. */
const spy = creerSpy({ telegram: () => telegram, claude: claudeChaine, prefixes: () => prefixes(), journal, dossier: path.join(DATA, 'spy'),
  skill: process.env.MANITA_SPY_SKILL || path.resolve(RACINE, '..', 'plugin', 'ecom-manita', 'skills', 'spy'), capture: process.env.MANITA_SPY_CAPTURE || '',
  python: () => trouverPython(cfg().python || ''), env: () => envOutil({ maison: MAISON, ffmpegDossier: cfg().ffmpegDossier || '' }) });
/** L'INSPECTEUR (0.4.0) : « افحص حسابي » écrit au robot → un tour de Claude en LECTURE Tassyir seulement, les contrôles calculés
 *  par inspecteur.mjs sur les réponses BRUTES, puis la note et UN devoir sur Telegram. Le fichier de règles unique : regles.json. */
const lireRegles = () => { try { return JSON.parse(fs.readFileSync(path.join(RACINE, 'regles.json'), 'utf8')); } catch { return {}; } };
const inspecteur = creerInspecteur({ telegram: () => telegram, claude: claudeChaine, prefixes: () => prefixes(), magasin: () => cfg().magasin || null,
  regles: lireRegles, couts: () => cfg().couts || {}, dossier: path.join(DATA, 'inspecteur'), journal });
/** Les messages de l'accueil : un texte (avec boutons), ou une PHOTO avec sa légende et ses boutons (un modèle à confirmer).
 *  Une photo que Telegram refuse repart en texte : la conversation ne reste jamais muette. */
async function envoyerLot(lot) {
  for (const m of (Array.isArray(lot) ? lot : [])) {
    let r = m.photo && fs.existsSync(m.photo) ? await telegram.envoyerPhoto(m.photo, m.texte, { boutons: m.boutons || null, minArabe: 3 }) : null;
    if (r && !r.envoye) journal('telegram : photo non envoyée (' + (r.fautes || []).join(' ; ') + '), le texte part seul');
    if (!r || !r.envoye) r = await telegram.envoyer(m.texte, { boutons: m.boutons || null });
    if (!r.envoye) journal('telegram non envoyé : ' + (r.fautes || []).join(' ; '));
  }
}
/** Ce que rend l'accueil : des messages, ou une décision (une mission, un lot à lancer, à annuler, ou ses missions).
 *  La décision est appliquée TOUT DE SUITE, sans rien attendre du réseau (l'accueil a déjà fermé ou avancé la conversation
 *  sur le disque : une coupure du PC pendant un appel à Telegram perdrait la mission ou le lot). Rend les messages à envoyer. */
function decider(r) {
  if (!r) return [];
  if (Array.isArray(r)) return r;
  if (r.demande) {
    // une demande déjà devenue mission (un « ابدا » rejoué) ne fait JAMAIS une 2e mission (deux pages, deux campagnes)
    const deja = missions.parDemande(r.demande.id);
    if (deja) journal(`demande ${r.demande.id} : déjà la mission ${deja.id}, rien de créé`);
    else { const m = missions.creer(r.demande); journal(`mission ${m.id} créée depuis Telegram`); }
  }
  if (r.lot) {
    try { const l = missions.lancerLot(r.lot); journal(`lot ${l.id} lancé depuis Telegram (${l.n} modèle(s) annoncé(s)${l.n === 1 ? ', comptés par separer.py' : ''})`); }
    catch (e) { journal('lot : ' + e.message); const apres = accueil.annuler(); return [{ texte: TEXTES_ACCUEIL.lotEchec(e.message).join('\n') }, ...apres]; } // jamais une conversation figée « en analyse » ; un lien neuf qui attendait commence
  }
  if (r.lotAnnule) { try { missions.annulerLot(r.lotAnnule.id, r.lotAnnule); } catch (e) { journal('lot : ' + e.message); } }
  if (r.lotFinal) {
    // chaque modèle garde sa marque « صحيح، بصح اللونات غالطين » (couleursClient) : sa mission fera nommer ses couleurs au client.
    // Le lot final reste sur le disque (accueil : lot-final-<id>.json) jusqu'ici : une coupure avant cette ligne est reprise au démarrage
    try { const ms = missions.creerDepuisLot(r.lotFinal.id, r.lotFinal.modeles); journal(`lot ${r.lotFinal.id} : ${ms.length} mission(s) créée(s) depuis Telegram (${ms.map(m => m.id + (m.lot?.couleursClient ? ' : couleurs par le client' : '')).join(', ')})`); }
    catch (e) { journal('lot : ' + e.message); accueil.lotFinalFait(r.lotFinal.id); return [{ texte: TEXTES_ACCUEIL.lotPerdu.join('\n') }]; }
    accueil.lotFinalFait(r.lotFinal.id);
  }
  return r.envoyer || [];
}
async function suiteAccueil(r) { await envoyerLot(decider(r)); }
/** Un lot a fini de séparer (prêt, seul, vide ou échec) : l'accueil prend la suite (« لقيت … » et les photos à confirmer ;
 *  « تمام، الخدمة بدات » pour un N = 1 seul, dont la mission est déjà née ; aucun groupe pur ; l'échec). */
async function lotFini(lot) {
  const r = accueil.lotPret(lot);
  // un lot prêt que plus aucune conversation n'attend (annulée, perdue) ne reste pas « à confirmer » pour toujours
  if (!r && lot.etat === 'pret' && accueil.conversation()?.lot !== lot.id) missions.annulerLot(lot.id, { raison: 'plus aucune conversation ne l\'attend' });
  await suiteAccueil(r);
}
/** Un bouton d'une MISSION (« لانسي » de la scale, « حبس » après le lancement, « واه، طلّع », « كمّل على مسؤوليتي »…) peut
 *  lancer un tour de Claude (jusqu'à quinze minutes, derrière la file unique) ou attendre la file des outils. L'écoute de
 *  Telegram ne l'attend JAMAIS (07/10/2026 : le robot devenait sourd pendant ce temps — ni /start, ni un nouveau lien, ni
 *  les boutons des autres modèles, et le sablier du bouton tournait). Les boutons d'une même mission passent dans l'ordre
 *  (une file par mission). Le petit texte du bouton part dès que la réponse est connue, au plus tard après DELAI_BOUTON_MS
 *  (« وصلني ») ; les boutons du message s'effacent quand la réponse arrive, avec la même règle qu'avant. */
const DELAI_BOUTON_MS = 1200;
const filesMission = new Map();
function boutonMission({ data, id, messageId }) {
  const cle = (/^mis:([0-9a-f]{6}):/.exec(data) || [])[1] || '?';
  const travail = (filesMission.get(cle) || Promise.resolve()).then(() => missions.surBouton(data));
  const suite = travail.catch(() => {});
  filesMission.set(cle, suite);
  suite.then(() => { if (filesMission.get(cle) === suite) filesMission.delete(cle); });
  let repondu = false;
  const repondre = async texte => { if (repondu) return; repondu = true; await telegram.repondreBouton(id, texte); };
  const minuteur = setTimeout(() => { repondre('وصلني').catch(() => {}); }, DELAI_BOUTON_MS);
  travail.then(async r => {
    clearTimeout(minuteur);
    await repondre(r.texte || '');
    // « ماشي دروك » (le test : lance:non ; la scale : scale:non) garde ses boutons : le « لانسي » reste à portée du client
    // « عاود » d'un connecteur toujours pas branché (r.garder) garde son bouton aussi
    if (r.connu && !r.garder && !/:page:non$|:lance:non$|:scale:non$/.test(data) && r.texte !== 'هاذ السؤال فات') await telegram.retirerBoutons(messageId);
  }, async e => { clearTimeout(minuteur); journal(`bouton ${data} : ${e.message}`); await repondre(''); }).catch(e => journal('telegram : ' + e.message));
}
/** [v19-trois] Les mots qui ferment les questions « لانسي » quand aucune fiche n'est ouverte (lavés : أ/إ/آ → ا, sans voyelles). */
const MOTS_ANNULE_PORTES = ['الغي', 'الغاء', 'annule', 'annuler'];
const ACCUEIL_DEBUT = ['السلام عليكم، أنا الروبو تاعك', 'باش نبداو موديل جديد :', 'ابعثلي لينك الدوسي تاع درايف', 'لي فيه الفيديوات تاع الشوتينغ'].join('\n');
function brancherTelegram() {
  if (!telegram.etat().configure || telegram.etat().ecoute) return;
  telegram.ecouter({
    surBouton: async ({ data, id, messageId }) => {
      if (data.startsWith('acc:')) {
        let r = accueil.surBouton(data);
        // un bouton d'un LOT déjà lancé (double clic sur « ابدا », vieux bouton d'une photo à confirmer) : jamais « ابعث لينك
        // جديد » — le client referait le même lot (deux pages, deux campagnes pour les mêmes modèles). N = 1 pareil (07/10/2026) :
        // un 2e « ابدا », « عاود من الأول » ou un vieux bouton d'une conversation déjà devenue mission → « ce modèle a démarré »
        // Une AUTRE conversation ouverte (l'accueil rend « هاذ الزر تاع سؤال فات » + la question en cours) : le vieux bouton
        // d'un lot ou d'un modèle déjà lancé dit aussi « ce modèle a démarré » à la place du premier message, et la question
        // en cours repart quand même (07/10/2026, « casse » : le client perdait cette information dès qu'un lien était ouvert)
        const idBouton = data.slice(4, 10), premier = Array.isArray(r) && r.length ? r[0].texte : null;
        const fatet = Array.isArray(r) && ((r.length === 1 && premier === TEXTES_ACCUEIL.questionFatet.join('\n')) || (premier === TEXTES_ACCUEIL.zarFat.join('\n') && accueil.conversation()?.id !== idBouton));
        const deja = !fatet ? null : missions.lireLot(idBouton)?.etat === 'missions' ? TEXTES_ACCUEIL.dejaLance : missions.parDemande(idBouton) ? TEXTES_ACCUEIL.dejaLanceUn : null;
        if (deja) r = [{ texte: deja.join('\n') }, ...r.slice(1)];
        const aEnvoyer = decider(r); // la mission, le lot : nés AVANT les appels à Telegram (qui peuvent durer)
        await telegram.repondreBouton(id, r ? 'وصلني' : '');
        if (r) await telegram.retirerBoutons(messageId); // une réponse prise (ou un bouton périmé) : ses boutons disparaissent
        await envoyerLot(aEnvoyer);
        return;
      }
      if (data.startsWith('mis:')) { boutonMission({ data, id, messageId }); return; } // jamais attendu par l'écoute
      if (/^spy:[A-Z]{2}$/.test(data)) { await telegram.repondreBouton(id, 'وصلني'); await telegram.retirerBoutons(messageId); await spy.demander({ pays: data.slice(4) }); return; } // le pays choisi après « spy » seul
      const m = /^(ok|non):(.+)$/.exec(data);
      if (m && telegram.questionOuverte(m[2])) {
        telegram.fermer(m[2]); await telegram.repondreBouton(id, m[1] === 'ok' ? 'وصلني : واه' : 'وصلني : لا'); await telegram.retirerBoutons(messageId);
        const t = trouver(m[2]); if (t) { if (m[1] === 'ok') approuver(t, 'telegram'); else refuser(t, '', 'telegram'); }
      } else await telegram.repondreBouton(id, 'هاذ السؤال راه مسكّر');
    },
    surTexte: async ({ texte }) => {
      const t = String(texte || '').trim();
      // « spy dz » passe AVANT l'accueil (jamais pris pour un nom de modèle) ; le travail ne bloque pas l'écoute
      if (lireDemandeInspecteur(t)) { await inspecteur.demander(); return; }
      const demandeSpy = lireDemandeSpy(t);
      if (demandeSpy) { await spy.demander(demandeSpy); return; }
      if (accueil.enCours()) return suiteAccueil(accueil.surTexte(t));
      const lien = (t.match(/https?:\/\/(drive|docs)\.google\.com\/\S+/i) || [])[0];
      if (lien) return envoyerLot(accueil.commencer(lien));
      if (/^\/start/.test(t)) return envoyerLot([{ texte: ACCUEIL_DEBUT }]);
      // [v19-trois] « الغي » SANS fiche ouverte : toutes les questions « لانسي » ouvertes se ferment (sans dialogue, rien activé, rien
      // supprimé chez Meta), et c'est dit ; « سقسيني » rouvre chacune plus tard
      if (MOTS_ANNULE_PORTES.includes(t.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').toLowerCase())) { const r = missions.annulerPortes(); journal(`« الغي » sans fiche : ${r.fermees} question(s) « لانسي » fermée(s)`); return envoyerLot([r.message]); }
      return envoyerLot([{ texte: ['وصلني الميساج تاعك', 'باش نبداو موديل جديد،', 'ابعث لينك الدرايف برك', 'والأسئلة كاينين في المكتب'].join('\n') }]);
    }
  }).catch(e => journal('telegram écoute : ' + e.message));
}

/* ---------- les réglages du client (config.local.json), modifiables depuis la page ---------- */
// « ciblage » n'est pas copié tel quel : ciblageDuClient le fusionne (clés lues chez Meta, cochées, confirmées)
const CLES_REGLAGES = ['nom', 'modele', 'atelier', 'couts', 'declare', 'wilayas', 'taux', 'plafondJourDA', 'creasParModele', 'ecartMetaHeures', 'heureRapport', 'joursReappro', 'codeBoutique', 'musiques', 'python', 'ffmpegDossier', 'cloudflared', 'magasin', 'comptes', 'pages'];
const masque = s => (s ? '••••' + String(s).slice(-4) : '');
export function reglagesMasques() {
  const c = cfg();
  const r2 = (c.depot && c.depot.r2) || {};
  return { nom: c.nom || BUREAU.nom, port: PORT, modele: c.modele || BUREAU.modele, maison: MAISON, atelier: c.atelier || ATELIER || '',
    couts: c.couts || { emballage: null, retour: null, livraison: null, fraisCod: 0 }, declare: c.declare || { confirmation: null, livraison: null }, wilayas: wilayasEnTexte(c.ciblage || ciblageDuPaquet()) || c.wilayas || '',
    taux: c.taux ?? null, plafondJourDA: c.plafondJourDA ?? null, creasParModele: creasDe(undefined, c.creasParModele), ecartMetaHeures: ecartMetaDe(c.ecartMetaHeures), heureRapport: c.heureRapport || '20:30', joursReappro: c.joursReappro ?? 7, codeBoutique: c.codeBoutique || '',
    musiques: c.musiques || MUSIQUES_DEFAUT, python: c.python || '', ffmpegDossier: c.ffmpegDossier || '', cloudflared: c.cloudflared || '',
    magasin: c.magasin || null, comptes: c.comptes || [], pages: c.pages || [], boutiques: c.boutiques || [], ciblage: c.ciblage || ciblageDuPaquet(), wilayasNord: WILAYAS_NORD, connecteurs: prefixes(),
    depot: { type: (c.depot && c.depot.type) || 'tunnel', r2: { compte: r2.compte || '', bucket: r2.bucket || '', cleId: r2.cleId || '', cleSecrete: masque(r2.cleSecrete), basePublique: r2.basePublique || '' } },
    telegram: { configure: !!(c.telegram && c.telegram.token && c.telegram.chat_id), token: c.telegram && c.telegram.token ? masque(c.telegram.token) : '', chat_id: c.telegram && c.telegram.chat_id ? String(c.telegram.chat_id) : '' },
    // le jeton Meta du serveur local : jamais rendu, seulement ••••<4 derniers> et la dernière sonde (sans secret)
    meta: { configure: !!jetonMeta(), jeton: masque(jetonMeta()), version: VERSION_GRAPH, sonde: lireJSON(FICHIER_SONDE_META) } };
}
function ecrireConfig(modifier) { const c = cfg(); modifier(c); fs.writeFileSync(FICHIER_LOCAL, JSON.stringify(c, null, 2)); return c; }
/** Les wilayas confirmées en une ligne (la fiche du business des tâches v0.2 lisait un texte libre « wilayas ») : elles passent
 *  AVANT ce vieux texte, que la page n'écrit plus (07/10/2026, « casse » : le texte d'avant restait figé et contredisait la liste). */
const wilayasEnTexte = cb => (cb && cb.type === 'regions' && cb.confirme === true && Array.isArray(cb.regions) ? cb.regions.map(r => r.wilaya || r.nom).filter(Boolean).join(', ') : '');
function enregistrerReglages(nouveau) {
  // les créas par modèle s'écrivent en NOMBRE (le POST a déjà refusé tout ce qui n'est pas 1 à 4)
  if (nouveau.creasParModele !== undefined) nouveau = { ...nouveau, creasParModele: creasValide(nouveau.creasParModele) };
  if (nouveau.ecartMetaHeures !== undefined) nouveau = { ...nouveau, ecartMetaHeures: +nouveau.ecartMetaHeures }; // [porte-groupee] le POST a déjà refusé tout le reste
  const ciblage = nouveau.ciblage !== undefined ? ciblageDuClient(nouveau.ciblage, cfg().ciblage || ciblageDuPaquet()) : undefined; // avant d'écrire : une clé fausse refuse TOUT
  const c = ecrireConfig(c => {
    for (const k of CLES_REGLAGES) if (nouveau[k] !== undefined) c[k] = nouveau[k];
    if (ciblage) c.ciblage = ciblage;
    if (nouveau.telegram) {
      c.telegram = c.telegram || {};
      if (typeof nouveau.telegram.token === 'string' && nouveau.telegram.token && !nouveau.telegram.token.startsWith('••••')) c.telegram.token = nouveau.telegram.token.trim();
      if (nouveau.telegram.chat_id !== undefined) c.telegram.chat_id = String(nouveau.telegram.chat_id).trim();
      if (nouveau.telegram.effacer) c.telegram = { token: '', chat_id: '' };
    }
    if (nouveau.meta && typeof nouveau.meta === 'object') {
      c.meta = c.meta || {};
      if (typeof nouveau.meta.jeton === 'string' && nouveau.meta.jeton.trim() && !nouveau.meta.jeton.startsWith('••••')) { c.meta.jeton = nouveau.meta.jeton.trim(); try { fs.unlinkSync(FICHIER_SONDE_META); } catch {} }
      if (nouveau.meta.effacer) { delete c.meta.jeton; try { fs.unlinkSync(FICHIER_SONDE_META); } catch {} }
    }
    if (nouveau.depot) {
      c.depot = c.depot || {}; if (nouveau.depot.type) c.depot.type = nouveau.depot.type === 'r2' ? 'r2' : 'tunnel';
      if (nouveau.depot.r2) { c.depot.r2 = c.depot.r2 || {}; for (const k of ['compte', 'bucket', 'cleId', 'basePublique']) if (typeof nouveau.depot.r2[k] === 'string') c.depot.r2[k] = nouveau.depot.r2[k].trim();
        if (typeof nouveau.depot.r2.cleSecrete === 'string' && nouveau.depot.r2.cleSecrete && !nouveau.depot.r2.cleSecrete.startsWith('••••')) c.depot.r2.cleSecrete = nouveau.depot.r2.cleSecrete.trim(); }
    }
  });
  if (nouveau.nom) BUREAU.nom = nouveau.nom;
  if (nouveau.modele && MODELES_OK.includes(nouveau.modele)) BUREAU.modele = nouveau.modele;
  if (nouveau.telegram) { telegram.arreter(); telegram = creerTelegram(c.telegram, journal, { fichierPosition: path.join(DATA, 'telegram-position.json') }); brancherTelegram(); }
  journal('réglages enregistrés (' + Object.keys(nouveau).join(', ') + ')');
  return reglagesMasques();
}
const MODELES_OK = ['sonnet', 'opus', 'fable', 'haiku'];
const nomDept = id => (BUREAU.departements.find(x => x.id === id) || {}).nomAr || id;
async function demanderAccord(t) {
  const question = ['المكتب حضّر خدمة وراه يستنى كلمتك', `القسم : ${nomDept(t.departement)}`, 'الخدمة :', t.titre.replace(/\d/g, '').slice(0, 34) || 'خدمة', 'تحب نلانسيها ؟'].join('\n');
  const r = await telegram.demander({ id: t.id, question, oui: 'لانسي', non: 'لا' });
  poser(t, { approbation: { demandeLe: new Date().toISOString(), telegram: r } });
}
async function prevenir(t) {
  if (!telegram.etat().configure) return;
  const lignes = t.etat === 'fini' ? ['خدمة كملات في المكتب', `القسم : ${nomDept(t.departement)}`, 'الحكم : ' + (t.verdict === 'PASSE' ? 'مراقَبة ثلاث مرات' : 'ما تأكدتش كامل'), 'شوفها في المكتب'] : ['خدمة ما كملاتش', `القسم : ${nomDept(t.departement)}`, 'شوف السبب في المكتب'];
  const r = await telegram.envoyer(lignes.join('\n'));
  if (!r.envoye) journal('telegram non envoyé : ' + r.fautes.join(' ; '));
}
function approuver(t, source = 'bureau') {
  if (t.etat !== 'attente') return false;
  // [relecture] 10/10/2026 : la phase « lance » est déjà EN FILE (la file est partagée avec la chaîne, la tâche reste « attente »
  // jusqu'à son tour) — un 2e « لانسي » (double clic, Telegram puis la page) n'enfile jamais une 2e exécution
  if (t.approbation && t.approbation.reponse === 'lance') return false;
  poser(t, { approbation: { ...(t.approbation || {}), reponse: 'lance', par: source, le: new Date().toISOString() } });
  telegram.fermer(t.id);
  enfiler(() => executer(t, { phase: 'lance' }));
  return true;
}
function refuser(t, note = '', source = 'bureau') {
  if (t.etat !== 'attente' && t.etat !== 'fini' && t.etat !== 'echec') return false;
  poser(t, { approbation: { ...(t.approbation || {}), reponse: 'non', par: source, le: new Date().toISOString(), note } });
  telegram.fermer(t.id);
  // [relecture] 10/10/2026 : une note refusée (un secret, un jeton) ne part jamais chez Claude dans une révision
  if (note && note.trim()) { const refus = apprendre(t.departement, note); if (refus) { journal('leçon refusée : ' + refus); poser(t, { etat: 'fini' }); } else enfiler(() => executer(t, { phase: 'revision', consigne: note })); }
  else poser(t, { etat: 'fini' });
  return true;
}

/* ---------- les connecteurs, les comptes, l'installation ---------- */
async function sonder() {
  const r = await sonderConnecteurs({ dureeMaxMs: 120000 });
  for (const s of r.serveurs) connecteursVus.set(s.nom, s.statut);
  // un préfixe n'est gardé que pour un connecteur BRANCHÉ ; une sonde qui n'a rien pu lire ne touche à rien
  const sur = !r.erreurs.length || r.serveurs.length > 0;
  if (sur) ecrireConfig(c => {
    const avant = (c.connecteurs && typeof c.connecteurs === 'object' && !Array.isArray(c.connecteurs)) ? c.connecteurs : {};
    const apres = { ...avant };
    for (const cle of ['tassyir', 'meta']) { if (r[cle]) apres[cle] = r[cle]; else delete apres[cle]; }
    c.connecteurs = apres;
  });
  // le serveur Meta LOCAL : revenu quand une lecture réelle repasse avec le jeton de التحضير (clé metaLocal des missions)
  r.metaLocal = jetonMeta() ? ((await lireMetaLocal(null).catch(() => ({ ok: false }))).ok ? PREFIXE_META_LOCAL : null) : null;
  journal(`sonde des connecteurs : tassyir ${r.tassyir || 'ABSENT'} · meta ${r.meta || 'ABSENT'} · meta local ${r.metaLocal ? 'OK' : jetonMeta() ? 'REFUSÉ' : 'sans jeton'} · ${r.serveurs.length} serveur(s)${r.manque.length ? ' · manque ' + r.manque.join(', ') : ''}${r.erreurs.length ? ' · ' + r.erreurs.join(' ; ') : ''}`);
  return r;
}
/** LA SONDE du jeton (التحضير) : GET /me, le compte, la page ; chaque refus dit lequel des trois. Le résultat (sans secret) est gardé. */
/** [relecture] 10/10/2026 : LE COMPTE ET LA PAGE DE LA PREUVE DU JETON — plus toujours comptes[0] / pages[0] : le compte de
 *  l'essai vidéo du jeton d'aujourd'hui (celui que le client a choisi dans la liste), sinon celui de la dernière sonde, s'ils
 *  sont dans ses comptes ; sinon le premier. La sonde, l'essai de « افحص كلش » et preuvesJeton lisent le MÊME compte. */
const sansAct = v => String(v || '').replace(/^act_/, '');
function compteRefJeton(c = cfg()) {
  const ids = (c.comptes || []).map(x => sansAct(x.id)).filter(Boolean), j = jetonMeta(), e = j ? empreinteJeton(j) : null;
  const es = lireJSON(FICHIER_ESSAI_META), sm = lireJSON(FICHIER_SONDE_META);
  if (e && es && es.empreinte === e && ids.includes(sansAct(es.compte))) return sansAct(es.compte);
  if (e && sm && sm.empreinte === e && ids.includes(sansAct(sm.compteSonde))) return sansAct(sm.compteSonde);
  return ids[0] || '';
}
function pageRefJeton(c = cfg()) {
  const ids = (c.pages || []).map(x => String(x.id || '')).filter(Boolean), sm = lireJSON(FICHIER_SONDE_META), j = jetonMeta();
  if (j && sm && sm.empreinte === empreinteJeton(j) && ids.includes(String(sm.pageSonde || ''))) return String(sm.pageSonde);
  return ids[0] || null;
}
async function sonderJetonMeta({ compte = null, page = null } = {}) {
  const c = cfg();
  const ref = compteRefJeton(c), cRef = (c.comptes || []).find(x => sansAct(x.id) === ref);
  const cpt = compte || (cRef && cRef.id) || null, pg = page || pageRefJeton(c);
  const r = await sonderMetaLocal({ fichierConfig: FICHIER_LOCAL, base: GRAPH_LOCAL, compte: cpt, page: pg });
  const garde = { ...r, le: new Date().toISOString(), compteSonde: cpt, pageSonde: pg };
  try { fs.writeFileSync(FICHIER_SONDE_META, masquer(JSON.stringify(garde), jetonMeta())); } catch {}
  journal(`meta local : sonde ${r.ok ? 'OK' : 'refus « ' + r.refus + ' »'} — ${r.etapes.map(e => `${e.quoi} ${e.ok ? 'ok' : '✗' + (e.code ? ' #' + e.code : '')}`).join(' · ')}`);
  return garde;
}
/** Un tour de Claude (lecture seulement) : les comptes pub du client, ses pages, ses boutiques Tassyir. */
/** L'INSTALLATION SUR LE JETON (10/10/2026, décision du coordinateur) : un jeton posé dans التحضير → les lectures Meta de
 *  l'installation (comptes et pages, clés des wilayas) et l'essai vidéo passent par le serveur local, EN DIRECT (aucun tour
 *  de Claude) ; un refus du jeton est dit tel quel (jamais de repli silencieux sur le connecteur). Tassyir reste un connecteur. */
const parJeton = () => cheminJeton({ fichierConfig: FICHIER_LOCAL, base: GRAPH_LOCAL, journal: JOURNAL_META });
function lireComptes() {
  return new Promise((ok, ko) => enfiler(async () => {
    try {
      const jeton = !!jetonMeta();
      const p = prefixes(); if ((!jeton && !p.meta) || !p.tassyir) throw new Error('connecteurs non trouvés : faire d\'abord « افحص الكونيكتورات »');
      if (jeton) {
        const j = await parJeton().comptesEtPages();
        const sch = { type: 'object', properties: { boutiques: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' }, actif: { type: 'boolean' }, sousDomaine: { type: 'string' } }, required: ['id', 'nom'] } }, erreur: { type: 'string' } }, required: ['boutiques'] };
        const r = await tour({ message: 'Lis, sans rien modifier : list_stores : les boutiques Tassyir (id, nom, actif, sous-domaine). Rends exactement ce que le connecteur a répondu.',
          systeme: 'Tu es le MANAGER du bureau ecom manita. Tu lis les boutiques Tassyir du client pour ses réglages. Aucune écriture. Tu rends le JSON demandé, rien d\'autre ; un identifiant non lu n\'est jamais inventé.',
          outilsAutorises: outilsEtape(['tassyir.list_stores', 'tassyir.get_store'], p), schema: sch, modele: BUREAU.modele, dureeMaxMs: 300000 });
        if (r.usage) compterUsage(r.usage);
        const brutT = (r.appels || []).map(a => a.sortie || '').join(' '), brutM = j.appels.filter(a => !a.erreur).map(a => a.sortie).join(' ');
        const boutiques = ((r.structure || {}).boutiques || []).filter(x => brutT.includes(String(x.id)));
        const comptes = j.comptes.filter(x => brutM.includes(String(x.id).replace(/^act_/, ''))), pages = j.pages.filter(x => brutM.includes(String(x.id)));
        // [v19-trois] LES PIXELS PAR COMPTE, lus EN VRAI par le jeton (ads_get_datasets), relus dans le brut ; un compte refusé : non lus
        try { const px = await parJeton().pixelsDesComptes(comptes); for (const c of comptes) { const l = pixelsDuBrut(px.appels, c.id); if (l) c.pixels = l; } if (px.refus.length) journal(`pixels non lus (refus) : ${px.refus.map(x => x.compte).join(', ')}`); }
        catch (e) { journal('pixels : lecture impossible — ' + e.message); }
        ecrireConfig(c => { c.comptes = comptes; c.pages = pages; c.boutiques = boutiques; if (!c.magasin && boutiques.filter(b => b.actif !== false).length === 1) c.magasin = boutiques.find(b => b.actif !== false); });
        journal(`comptes lus par le JETON (serveur local, ${j.appels.length} lecture(s) Graph) : ${comptes.length} compte(s) pub, ${pages.length} page(s) · ${boutiques.length} boutique(s) par le connecteur Tassyir`);
        return ok({ comptes, pages, boutiques, chemin: 'jeton', ecartes: ((r.structure || {}).boutiques || []).length - boutiques.length });
      }
      const schema = { type: 'object', properties: {
        comptes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' }, devise: { type: 'string' }, statut: { type: 'string' }, mcp_ok: { type: 'boolean' }, pixels: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' } } } } }, required: ['id', 'nom', 'devise'] } },
        pages: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' } }, required: ['id', 'nom'] } },
        boutiques: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' }, actif: { type: 'boolean' }, sousDomaine: { type: 'string' } }, required: ['id', 'nom'] } },
        erreur: { type: 'string' } }, required: ['comptes', 'pages', 'boutiques'] };
      const r = await tour({ message: `Lis, sans rien modifier : (1) ads_get_ad_accounts : chaque compte publicitaire (id avec act_, nom, devise, statut, is_ads_mcp_enabled → mcp_ok) ; (2) ads_get_user_pages (ou ads_get_ad_account_pages) : les pages Facebook (id, nom) ; (3) list_stores : les boutiques Tassyir (id, nom, actif, sous-domaine) ; (4) ads_get_datasets avec ad_account_id de CHAQUE compte lu en (1) : ses pixels (dataset_id, nom) dans comptes[].pixels. Rends exactement ce que les connecteurs ont répondu.`,
        systeme: 'Tu es le MANAGER du bureau ecom manita. Tu lis les comptes du client pour ses réglages. Aucune écriture. Tu rends le JSON demandé, rien d\'autre ; un identifiant non lu n\'est jamais inventé.',
        outilsAutorises: outilsEtape(['meta.ads_get_ad_accounts', 'meta.ads_get_user_pages', 'meta.ads_get_ad_account_pages', 'tassyir.list_stores', 'tassyir.get_store', 'meta.ads_get_datasets'], p), schema, modele: BUREAU.modele, dureeMaxMs: 300000 });
      if (r.usage) compterUsage(r.usage);
      const s = r.structure || {};
      if (s.erreur && !(s.comptes || []).length) throw new Error(s.erreur);
      // 2e méthode : chaque id doit être dans une réponse brute d'un connecteur
      const brut = (r.appels || []).map(a => a.sortie || '').join(' ');
      const vrai = x => brut.includes(String(x.id).replace(/^act_/, ''));
      const comptes = (s.comptes || []).filter(vrai), pages = (s.pages || []).filter(vrai), boutiques = (s.boutiques || []).filter(vrai);
      // [v19-trois] LES PIXELS PAR COMPTE : seulement ceux de la réponse BRUTE d'ads_get_datasets pour CE compte (jamais ce que le tour
      // dit) ; un compte jamais lu garde ses pixels « non lus » (pas de question du pixel pour lui)
      for (const c of comptes) { delete c.pixels; const l = pixelsDuBrut(r.appels, c.id); if (l) c.pixels = l; }
      ecrireConfig(c => { c.comptes = comptes; c.pages = pages; c.boutiques = boutiques; if (!c.magasin && boutiques.filter(b => b.actif !== false).length === 1) c.magasin = boutiques.find(b => b.actif !== false); });
      journal(`comptes lus : ${comptes.length} compte(s) pub, ${pages.length} page(s), ${boutiques.length} boutique(s)`);
      ok({ comptes, pages, boutiques, ecartes: (s.comptes || []).length + (s.pages || []).length + (s.boutiques || []).length - comptes.length - pages.length - boutiques.length });
    } catch (e) { ko(e); }
  }));
}
/** Un tour de Claude (lecture seulement) : les CLÉS DE RÉGION Meta des 25 wilayas du nord (décision du vendeur), lues une
 *  fois à l'installation. Aucun outil du connecteur ne cherche une clé de région : Claude les lit dans le ciblage des ad
 *  sets du client qui visent déjà des wilayas. Chaque clé gardée est RECOUPÉE dans les réponses brutes (recouperRegions) ;
 *  le client confirme ou corrige ensuite dans الإعدادات (la lecture remet la confirmation à zéro). */
function lireWilayas() {
  return new Promise((ok, ko) => enfiler(async () => {
    try {
      const jeton = !!jetonMeta();
      const p = prefixes(); if (!jeton && !p.meta) throw new Error('connecteur Meta non trouvé : faire d\'abord « افحص الكونيكتورات »');
      const comptes = (cfg().comptes || []).map(c => String(c.id).replace(/^act_/, '')).filter(Boolean);
      if (!comptes.length) throw new Error('aucun compte publicitaire lu : faire d\'abord « جيب الكونتات و الصفحات »');
      if (jeton) {
        // le jeton : le ciblage des ad sets lu EN DIRECT par le serveur local ; les clés se relisent dans le brut (recouperRegions)
        const j = await parJeton().adSetsCiblage(comptes);
        const x = recouperRegions({ regions: [] }, j.appels.filter(a => !a.erreur));
        if (!x.regions.length) { const cb = cfg().ciblage || ciblageDuPaquet(); journal('wilayas (jeton) : aucune clé lue dans les ad sets du client — les clés du paquet restent'); return ok({ ...cb, ecartes: [], chemin: 'jeton', note: 'aucune clé lue chez Meta : les clés du paquet restent' }); }
        let ciblage = null;
        ecrireConfig(c => { ciblage = ciblageLu(x, c.ciblage || ciblageDuPaquet()); c.ciblage = ciblage; });
        journal(`wilayas lues par le JETON (serveur local) : ${x.regions.length} / ${WILAYAS_NORD.length}${ciblage.manquent.length ? ' · manquent ' + ciblage.manquent.join(', ') : ''}${x.doublons.length ? ' · deux clés pour ' + x.doublons.join(', ') : ''} — ${ciblage.confirme ? 'liste inchangée, toujours confirmée' : 'à confirmer dans الإعدادات'}`);
        return ok({ ...ciblage, ecartes: [], chemin: 'jeton' });
      }
      const schema = { type: 'object', properties: { regions: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, name: { type: 'string' }, country: { type: 'string' } }, required: ['key', 'name'] } }, erreur: { type: 'string' } }, required: ['regions'] };
      const r = await tour({ message: `Lis, sans rien modifier, les CLÉS DE RÉGION Meta de ces wilayas d'Algérie : ${WILAYAS_NORD.join(', ')}.
Comptes publicitaires : ${comptes.join(', ')}. Pour chaque compte : ads_get_ad_entities level "adset" (object_state « live », puis « draft »), fields avec le ciblage de l'ad set (vérifie le nom exact du champ, « targeting », avec ads_get_field_context), limit 500. Dans chaque targeting.geo_locations.regions, relève chaque région d'Algérie (country DZ) : {key, name, country} EXACTEMENT comme Meta les rend.
Rends {regions:[{key, name, country}]}. Une clé que tu n'as pas lue dans une réponse de Meta n'est JAMAIS inventée ; aucune région trouvée : dis-le dans « erreur ».`,
        systeme: 'Tu es le MANAGER du bureau ecom manita. Tu lis les clés de région Meta des wilayas du client pour ses réglages. Aucune écriture, aucune création. Tu rends le JSON demandé, rien d\'autre ; une clé non lue n\'est jamais inventée.',
        outilsAutorises: outilsEtape(['meta.ads_get_ad_accounts', 'meta.ads_get_ad_entities', 'meta.ads_get_field_context'], p), schema, modele: BUREAU.modele, dureeMaxMs: 600000 });
      if (r.usage) compterUsage(r.usage);
      const x = recouperRegions(r.structure || {}, r.appels || []);
      // rien lu dans les ad sets du client (la plupart visent toute l'Algérie) : les clés du PAQUET restent, rien n'est vidé
      if (!x.regions.length) { const cb = cfg().ciblage || ciblageDuPaquet(); journal(`wilayas : aucune clé lue dans les ad sets du client${r.structure?.erreur ? ' (' + String(r.structure.erreur).slice(0, 120) + ')' : ''} — les clés du paquet restent`); ok({ ...cb, ecartes: x.ecartes, note: 'aucune clé lue chez Meta : les clés du paquet restent' }); return; }
      // les clés tapées à la main restent, et une liste IDENTIQUE à la liste confirmée reste confirmée (ciblageLu)
      let ciblage = null;
      ecrireConfig(c => { ciblage = ciblageLu(x, c.ciblage || ciblageDuPaquet()); c.ciblage = ciblage; });
      journal(`wilayas lues : ${x.regions.length} / ${WILAYAS_NORD.length}${ciblage.regions.length > x.regions.length ? ` (+ ${ciblage.regions.length - x.regions.length} tapée(s) à la main, gardée(s))` : ''}${ciblage.manquent.length ? ' · manquent ' + ciblage.manquent.join(', ') : ''}${x.ecartes.length ? ' · ' + x.ecartes.length + ' écartée(s) (absentes du brut)' : ''}${x.doublons.length ? ' · deux clés pour ' + x.doublons.join(', ') : ''} — ${ciblage.confirme ? 'liste inchangée, toujours confirmée' : 'à confirmer dans الإعدادات'}`);
      ok({ ...ciblage, ecartes: x.ecartes });
    } catch (e) { ko(e); }
  }));
}
/* ---------- le dépôt à l'épreuve : le vrai chemin public (aller-retour + fermeture), puis une vraie vidéo chez Meta ---------- */
const DOSSIER_ESSAIS = path.join(DATA, 'depot-essai');
const epreuveDepot = () => epreuveDuDepot(depot, { dossier: DOSSIER_ESSAIS });
let essaiMeta = { etat: 'jamais' };
/** La vidéo d'essai : une mire de cinq secondes fabriquée par FFmpeg chez le client (aucune image de personne, aucune marque). */
function videoEssai() {
  const c = cfg(); fs.mkdirSync(DOSSIER_ESSAIS, { recursive: true });
  const f = path.join(DOSSIER_ESSAIS, 'essai-meta.mp4');
  if (fs.existsSync(f) && fs.statSync(f).size > 10000) return f;
  const ff = c.ffmpegDossier ? path.join(c.ffmpegDossier, executable('ffmpeg')) : 'ffmpeg';
  const g = spawnSync(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=720x1280:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', f], { encoding: 'utf8', timeout: 120000, windowsHide: true });
  if (g.status !== 0 || !fs.existsSync(f)) { try { fs.unlinkSync(f); } catch {} throw new Error('FFmpeg ne fabrique pas la vidéo d\'essai : ' + String(g.stderr || (g.error && g.error.message) || g.status).trim().slice(0, 200)); }
  return f;
}
/** L'essai vidéo (une ÉCRITURE dans la bibliothèque du compte) : par le JETON quand il est posé (en direct, aucun tour de
 *  Claude), sinon par le connecteur. Le résultat sur le jeton est gardé avec l'empreinte du jeton et le compte (sans secret). */
const FICHIER_ESSAI_META = path.join(DATA, 'meta-essai.json');
async function essaiDuJetonOuConnecteur(id) {
  const jeton = jetonMeta(); let r;
  try { r = jeton ? await essaiMetaDuDepot({ depot, meta: parJeton(), compte: id, fichier: videoEssai(), pauseLectureMs: +(process.env.MANITA_PAUSE_LECTURE_MS || 5000) }) : await essaiMetaDuDepot({ depot, claude: claudeChaine, compte: id, fichier: videoEssai() }); }
  catch (e) { r = { verdict: 'ECHEC', detail: String(e.message).slice(0, 400) }; }
  r = { ...r, chemin: jeton ? 'jeton' : 'connecteur' };
  if (jeton) { try { fs.writeFileSync(FICHIER_ESSAI_META, masquer(JSON.stringify({ verdict: r.verdict, video_id: r.video_id || null, detail: r.detail, compte: id, empreinte: empreinteJeton(jeton), le: new Date().toISOString() }), jeton)); } catch {} }
  journal(`essai Meta (${r.chemin}) : ${r.verdict} ${r.video_id ? 'video_id ' + r.video_id + ' · ' : ''}${masquer(r.detail || '', jeton)}`);
  return r;
}
/** LE JETON PROUVÉ (installation) : la sonde (lecture réelle) ET l'essai vidéo (écriture) du jeton d'AUJOURD'HUI sur le compte
 *  d'aujourd'hui — alors la ligne « الكونيكتورات » n'exige plus le connecteur Meta claude.ai (Tassyir reste un connecteur). */
function preuvesJeton(c = cfg()) {
  const j = jetonMeta(); if (!j) return { jeton: false, lecture: null, ecriture: null };
  const e = empreinteJeton(j), cpt = compteRefJeton(c); // [relecture] le compte de la preuve, plus toujours comptes[0]
  const sm = lireJSON(FICHIER_SONDE_META), es = lireJSON(FICHIER_ESSAI_META);
  const lecture = sm && sm.empreinte === e && String(sm.compteSonde || '').replace(/^act_/, '') === cpt ? sm : null;
  const ecriture = es && es.empreinte === e && String(es.compte || '').replace(/^act_/, '') === cpt ? es : null;
  // LE JETON MORT (10/10/2026, « casse ») : la dernière preuve du jeton d'aujourd'hui est un REFUS (la sonde, ou l'essai vidéo
  // refusé pour le jeton ou ses droits) — l'installation lit par le jeton et ne se replie jamais : rien n'est vert sur le connecteur
  const refusEcriture = ecriture && ecriture.verdict !== 'PASSE' && [REFUS_SONDE.jeton, REFUS_SONDE.droits].some(t => String(ecriture.detail || '').includes(t));
  const mort = !!((lecture && lecture.ok === false && ['jeton', 'droits'].includes(lecture.refus)) || refusEcriture);
  return { jeton: true, lecture, ecriture, mort, prouve: !mort && !!(lecture && lecture.ok && ecriture && ecriture.verdict === 'PASSE') };
}
function ligneConnecteurs(c = cfg()) {
  const p = prefixes(), pj = preuvesJeton(c);
  if (pj.mort) return { cle: 'connecteurs', ar: 'الكونيكتورات تسيير و ميتا', verdict: 'ECHEC', detail: `tassyir ${p.tassyir ? 'OK' : 'manque'} · meta : le JETON posé est REFUSÉ par Meta (${pj.lecture && pj.lecture.ok === false ? 'sonde : ' + (pj.lecture.refus || '?') : 'essai vidéo refusé'}) — l'installation lit par le jeton, jamais par le connecteur : remplace-le ou retire-le (التحضير)${p.meta ? ' ; le connecteur claude.ai branché ne suffit pas' : ''}` };
  if (pj.prouve) return { cle: 'connecteurs', ar: 'الكونيكتورات تسيير و ميتا', verdict: p.tassyir ? 'PASSE' : 'ECHEC', detail: `tassyir ${p.tassyir ? 'OK' : 'manque'} · meta par le JETON (lecture et essai vidéo prouvés) — le connecteur claude.ai ${p.meta ? 'aussi branché' : 'pas exigé'}` };
  return { cle: 'connecteurs', ar: 'الكونيكتورات تسيير و ميتا', verdict: p.tassyir && p.meta ? 'PASSE' : 'ECHEC', detail: `tassyir ${p.tassyir ? 'OK' : 'manque'} · meta ${p.meta ? 'OK' : 'manque'}${pj.jeton ? ' (le jeton n\'est pas encore prouvé : sonde + essai vidéo)' : ''}` };
}
function lancerEssaiMeta({ compte } = {}) {
  if (essaiMeta.etat === 'encours') return essaiMeta;
  const c = cfg(); const lus = (c.comptes || []).map(x => String(x.id).replace(/^act_/, ''));
  const id = String(compte || (lus.length === 1 ? lus[0] : '')).replace(/^act_/, '').trim();
  if (!id) return { etat: 'refuse', detail: 'quel compte publicitaire ? {"compte": "<id>"} — un des comptes lus par « جيب الكونتات »' };
  if (!lus.includes(id)) return { etat: 'refuse', detail: 'ce compte n\'est pas dans les comptes lus chez le client (« جيب الكونتات » d\'abord)' };
  essaiMeta = { etat: 'encours', debut: new Date().toISOString(), compte: id };
  const moi = essaiMeta;
  (async () => {
    await new Promise(x => setImmediate(x)); // la réponse part d'abord (« encours ») ; le travail suit
    let r;
    r = await essaiDuJetonOuConnecteur(id);
    if (essaiMeta === moi) essaiMeta = { ...moi, ...r, etat: 'fini', fin: new Date().toISOString() };
    journal(`essai Meta : ${r.verdict} ${r.video_id ? 'video_id ' + r.video_id + ' · ' : ''}${r.detail}`);
  })();
  return essaiMeta;
}
let installation = { verifieLe: null, controles: [] };
function versionDe(bin, args = ['--version']) { try { const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 20000, windowsHide: true, env: envEnfant() }); return r.status === 0 ? String(r.stdout || r.stderr).trim().split('\n')[0].slice(0, 80) : null; } catch { return null; } }
const executable = n => (process.platform === 'win32' ? n + '.exe' : n);
// les musiques (09/10/2026) : seuls les morceaux de PLUS de douze secondes comptent (ffprobe) ; le cache (nom, date, taille →
// durée) tient dans bureau-data/cache-musiques.json, pour ne pas relire cent fichiers à chaque ouverture de la page
const CACHE_MUSIQUES = path.join(DATA, 'cache-musiques.json');
function compterMusiques(d, c) {
  let cache = {}; try { const t = JSON.parse(fs.readFileSync(CACHE_MUSIQUES, 'utf8')); if (t && t.dossier === d && t.fichiers) cache = t.fichiers; } catch {}
  const ffprobe = c.ffmpegDossier ? path.join(c.ffmpegDossier, executable('ffprobe')) : 'ffprobe';
  const r = compterMusiquesDe(d, ffprobe, cache, envEnfant());
  if (r.existe && r.ffprobe && (r.relus || Object.keys(r.cache).length !== Object.keys(cache).length)) { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(CACHE_MUSIQUES, JSON.stringify({ dossier: d, fichiers: r.cache })); } catch {} }
  return r;
}
/** La liste de l'installation (ce que la vidéo d'activation fait cocher) : chaque ligne PASSE, ECHEC ou NON_VERIFIABLE. */
function etatInstallation({ complet = false } = {}) {
  const c = cfg(); const l = [];
  const ajoute = (cle, ar, ok, detail) => l.push({ cle, ar, verdict: ok === null ? 'NON_VERIFIABLE' : ok ? 'PASSE' : 'ECHEC', detail });
  const claude = trouverClaude();
  let auth = null; if (complet) { try { const r = spawnSync(claude, ['auth', 'status', '--json'], { encoding: 'utf8', timeout: 30000, windowsHide: true, env: envEnfant() }); auth = JSON.parse(r.stdout || '{}'); } catch { auth = null; } }
  ajoute('claude', 'Claude Code', complet ? !!(auth && auth.loggedIn) : (fs.existsSync(claude) || null), complet ? (auth ? (auth.loggedIn ? `connecté (${auth.authMethod || '?'})` : 'pas connecté : claude auth login') : 'claude introuvable') : claude);
  l.push(ligneConnecteurs(c));
  ajoute('comptes', 'الكونت تاع البوب و الصفحة و البوتيك', (c.comptes || []).length > 0 && (c.pages || []).length > 0 && !!c.magasin, `${(c.comptes || []).length} compte(s) · ${(c.pages || []).length} page(s) · boutique ${c.magasin ? c.magasin.nom : 'non choisie'}`);
  // les 25 wilayas du vendeur : lues chez Meta (« جيب الولايات ») ET confirmées par le client (الإعدادات) — sinon le test ne part pas
  const cb0 = c.ciblage || ciblageDuPaquet(), cb = cb0 && cb0.type === 'regions' && Array.isArray(cb0.regions) ? cb0 : null;
  ajoute('wilayas', 'الولايات تاع التيست', !!(cb && cb.regions.length && cb.confirme === true), cb ? `${cb.regions.length} / ${WILAYAS_NORD.length} wilaya(s) lue(s) · ${cb.confirme === true ? 'confirmées' : 'à confirmer dans الإعدادات'}` : 'pas lues : « جيب الولايات »');
  // ميتا (التوكن) : OPTIONNELLE — sans jeton, Meta passe par le connecteur claude.ai (NON_VERIFIABLE, jamais un échec)
  // la sonde gardée ne vaut que pour le jeton d'AUJOURD'HUI (empreinte) et le compte d'aujourd'hui : jamais un vert d'avant
  const sm0 = lireJSON(FICHIER_SONDE_META), cpt0 = (c.comptes && c.comptes[0] && c.comptes[0].id) || null;
  const sm = sm0 && sm0.empreinte && sm0.empreinte === empreinteJeton(jetonMeta()) && String(sm0.compteSonde || '').replace(/^act_/, '') === String(cpt0 || '').replace(/^act_/, '') ? sm0 : null;
  ajoute('meta-jeton', 'ميتا (التوكن)', !jetonMeta() ? null : sm ? !!sm.ok : null, !jetonMeta() ? 'pas de jeton : Meta passe par le connecteur claude.ai' : sm ? (sm.ok ? `jeton OK (${VERSION_GRAPH})` : `refus : ${sm.refus}${sm.refus === 'statut' ? ` ${sm.statut} — ${sm.raison}` : ''}`) : 'jeton enregistré, pas encore sondé');
  // l'ÉCRITURE du jeton : l'essai vidéo passé par le jeton d'aujourd'hui sur le compte d'aujourd'hui
  const ej = preuvesJeton(c).ecriture;
  ajoute('meta-ecriture', 'ميتا : فيديو التجربة بالتوكن', !jetonMeta() ? null : ej ? ej.verdict === 'PASSE' : null, !jetonMeta() ? 'pas de jeton : l\'essai vidéo passe par le connecteur claude.ai' : ej ? (ej.verdict === 'PASSE' ? `essai vidéo par le jeton : ${ej.video_id || '?'} ready` : `essai vidéo par le jeton : ${String(ej.detail || '').slice(0, 120)}`) : 'jeton pas encore prouvé en écriture (essai vidéo)');
  ajoute('telegram', 'تيليغرام', !!(c.telegram && c.telegram.token && c.telegram.chat_id), telegram.etat().ecoute ? 'écoute' : 'pas configuré');
  const py = versionDe(trouverPython(c.python || ''), ['--version']); ajoute('python', 'Python', !!py, py || 'introuvable');
  const ffm = versionDe(c.ffmpegDossier ? path.join(c.ffmpegDossier, executable('ffmpeg')) : 'ffmpeg', ['-version']); ajoute('ffmpeg', 'FFmpeg', !!ffm, ffm || 'introuvable');
  if (((c.depot && c.depot.type) || 'tunnel') === 'tunnel') { const cf = versionDe(c.cloudflared || 'cloudflared', ['--version']); ajoute('depot', 'الدوبو (tunnel)', !!cf, cf || 'cloudflared introuvable'); }
  else { const r2 = (c.depot && c.depot.r2) || {}; ajoute('depot', 'الدوبو (R2)', !!(r2.compte && r2.bucket && r2.cleId && r2.cleSecrete && r2.basePublique), 'R2 du client'); }
  const mus = compterMusiques(c.musiques || MUSIQUES_DEFAUT, c); ajoute('musiques', 'الموسيقى', mus.existe && !mus.ffprobe ? null : mus.longues >= MUSIQUES_MIN, detailMusiques(mus));
  const cts = c.couts || {}, dcl = c.declare || {};
  const manquent = [['emballage', cts.emballage], ['livraison', cts.livraison], ['retour', cts.retour], ['confirmation', dcl.confirmation], ['livraison %', dcl.livraison], ['taux du dollar', c.taux], ['budget max/jour', c.plafondJourDA], ['code boutique', c.codeBoutique]].filter(([, v]) => v === null || v === undefined || v === '').map(([k]) => k);
  ajoute('reglages', 'الإعدادات تاع البيزنس', !manquent.length, manquent.length ? 'manque : ' + manquent.join(', ') : 'complets');
  ajoute('atelier', 'الأدوات تاع Python', !!(ATELIER && fs.existsSync(ATELIER)), ATELIER || 'introuvable');
  return l;
}
async function verifierTout() {
  const l = etatInstallation({ complet: true });
  const iDepot = l.findIndex(x => x.cle === 'depot');
  if (iDepot >= 0 && l[iDepot].verdict === 'PASSE') { const e = await epreuveDepot(); l[iDepot] = { ...l[iDepot], verdict: e.verdict, detail: e.detail }; }
  const iMeta = l.findIndex(x => x.cle === 'meta-jeton');
  if (iMeta >= 0 && jetonMeta()) {
    const s = await sonderJetonMeta().catch(e => ({ ok: false, refus: 'meta', erreur: e.message })); l[iMeta] = { ...l[iMeta], verdict: s.ok ? 'PASSE' : 'ECHEC', detail: s.ok ? `jeton OK (${VERSION_GRAPH})` : `refus : ${s.refus}${s.refus === 'statut' ? ` ${s.statut} — ${s.raison}` : ''}` };
    // la vérification prouve LE JETON en écriture aussi : l'essai vidéo par le jeton (il lui faut le dépôt)
    const iE = l.findIndex(x => x.cle === 'meta-ecriture'), cpt = compteRefJeton(); // [relecture] le compte de la preuve
    if (iE >= 0) {
      if (!s.ok) l[iE] = { ...l[iE], verdict: 'ECHEC', detail: 'la lecture du jeton est refusée : aucun essai d\'écriture' };
      else if (iDepot < 0 || l[iDepot].verdict !== 'PASSE') l[iE] = { ...l[iE], verdict: 'NON_VERIFIABLE', detail: 'le dépôt ne passe pas : l\'essai vidéo du jeton attend « جرّب الدوبو »' };
      else if (!cpt) l[iE] = { ...l[iE], verdict: 'NON_VERIFIABLE', detail: 'aucun compte lu' };
      else { const e = await essaiDuJetonOuConnecteur(cpt); l[iE] = { ...l[iE], verdict: e.verdict === 'PASSE' ? 'PASSE' : 'ECHEC', detail: `essai vidéo par le jeton : ${String(e.detail || '').slice(0, 160)}` }; }
    }
    const iC = l.findIndex(x => x.cle === 'connecteurs'); if (iC >= 0) l[iC] = ligneConnecteurs();
  }
  for (const d of BUREAU.departements.filter(x => x.outilPython)) { const r = await verifierOutil(d.id); l.push({ cle: 'outil-' + d.id, ar: 'الأداة : ' + (d.nomAr || d.id), verdict: r.verdict, detail: r.detail }); }
  installation = { verifieLe: new Date().toISOString(), controles: l };
  return installation;
}

/* ---------- routines (tâches v0.2) et l'horloge de la chaîne ---------- */
setInterval(() => {
  for (const { routine, enRetard } of routines.dues()) {
    const t = nouvelleTache({ texte: routine.texte, departement: routine.departement, besoinOk: routine.besoinOk, origine: enRetard ? 'routine (en retard)' : 'routine', routineId: routine.id });
    journal(`⏱ routine ${routine.id} → ${t.id}${enRetard ? ' (en retard)' : ''}`);
    enfiler(() => executer(t));
  }
}, 30000).unref();
setInterval(() => { try { const n = missions.tick(); if (n) journal(`suivi du soir : ${n} mission(s)`); } catch (e) { journal('horloge des missions : ' + e.message); } }, 60000).unref();

/* ---------- chat : seul le coach a une voix ---------- */
const FICHIER_CHAT = path.join(DATA, 'chat-coach.json');
let chat = lireJSON(FICHIER_CHAT) || [];
async function parlerAuCoach(texte) {
  const systeme = assemblerSysteme({ racine: RACINE, bureau: BUREAU, dept: 'coach', poste: 'questions', carnet, texte, lecons: lecons('coach'), fiche: reglagesMasques() }) + '\n\nTu es en CONVERSATION avec le client : réponds court, en darija, sans « Sources lues » ni « Contrôle intégré » sauf si tu cites un chiffre du carnet.';
  const contexte = chat.slice(-8).map(m => `${m.de === 'client' ? 'Client' : 'Coach'} : ${m.texte}`).join('\n');
  const message = (contexte ? `Conversation jusqu'ici :\n${contexte}\n\n` : '') + `Client : ${texte}`;
  chat.push({ de: 'client', texte, quand: new Date().toISOString() });
  const r = await tour({ message, systeme, modele: BUREAU.modele, dureeMaxMs: DUREE, outilsAutorises: outilsPour('coach') });
  if (r.usage) compterUsage(r.usage);
  for (const c of r.connecteurs) connecteursVus.set(c.id, c.statut);
  chat.push({ de: 'coach', texte: r.texte, quand: new Date().toISOString(), outils: r.outils });
  chat = chat.slice(-200); fs.writeFileSync(FICHIER_CHAT, JSON.stringify(chat, null, 2));
  return r.texte;
}

/* ---------- outils Python : --verifier ---------- */
function verifierOutil(dept) {
  const d = BUREAU.departements.find(x => x.id === dept);
  if (!ATELIER || !d?.outilPython) return Promise.resolve({ verdict: 'NON_VERIFIABLE', detail: 'atelier non configuré' });
  const chemin = path.join(ATELIER, d.outilPython);
  if (!fs.existsSync(chemin)) return Promise.resolve({ verdict: 'ECHEC', detail: `outil absent : ${chemin}` });
  return travaux.lancer({ nom: `verifier/${dept}`, script: chemin, args: ['--verifier'], cwd: path.join(DATA, 'verifications', dept), journalFichier: path.join(DATA, 'verifications', `${dept}.log`), dureeMaxMs: 600000, inactiviteMaxMs: 300000 })
    .then(r => ({ verdict: r.code === 0 && /TOUT EST BON/i.test(r.sortie) ? 'PASSE' : 'ECHEC', detail: (r.raison || r.sortie.trim().split('\n').slice(-3).join(' | ')).slice(0, 300), code: r.code }));
}

/* ---------- l'équipage : XP et niveaux par poste (méthode 2) ---------- */
const XP = { fini: 10, attente: 6, echec: 2 };
export const TITRES = ['مبتدئ', 'خدّام', 'محترف', 'خبير', 'أسطورة'];
export function niveauDe(xp) { return 1 + Math.floor(Math.log2(1 + xp / 10)); }
export function equipage() {
  const out = [];
  for (const d of BUREAU.departements) for (const p of d.postes) {
    const miennes = taches.filter(t => t.departement === d.id && t.poste === p.id);
    let xp = 0; for (const t of miennes) xp += XP[t.etat] || 0;
    const derniere = miennes[0] || null;
    const niveau = niveauDe(xp);
    out.push({ departement: d.id, poste: p.id, nom: p.nom, nomAr: p.nomAr, xp, niveau, titre: TITRES[Math.min(TITRES.length - 1, niveau - 1)], prochain: Math.ceil(10 * (2 ** niveau - 1)),
      taches: miennes.length, finies: miennes.filter(t => t.etat === 'fini').length, passes: miennes.filter(t => t.verdict === 'PASSE').length, echecs: miennes.filter(t => t.etat === 'echec').length,
      etat: miennes.some(t => t.etat === 'encours') ? 'encours' : miennes.some(t => t.etat === 'attente') ? 'attente' : (derniere && derniere.etat === 'echec' && Date.now() - Date.parse(derniere.majLe || derniere.creeLe) < 86400000) ? 'echec' : 'libre',
      derniereTache: derniere ? { id: derniere.id, titre: derniere.titre, etat: derniere.etat, quand: derniere.majLe || derniere.creeLe } : null });
  }
  const mgr = taches.filter(t => t.departement && t.poste).length;
  return { postes: out, manager: { routees: mgr, xp: mgr * 3, niveau: niveauDe(mgr * 3), titre: TITRES[Math.min(TITRES.length - 1, niveauDe(mgr * 3) - 1)] }, totalXp: out.reduce((s, x) => s + x.xp, 0) };
}
export function absence(depuis) {
  const d = Date.parse(depuis || '') || 0;
  const recentes = taches.filter(t => Date.parse(t.majLe || t.creeLe) > d);
  return { depuis: d ? new Date(d).toISOString() : null, finies: recentes.filter(t => t.etat === 'fini'), attente: taches.filter(t => t.etat === 'attente'), echecs: recentes.filter(t => t.etat === 'echec'), encours: taches.filter(t => t.etat === 'encours'), routinesParties: recentes.filter(t => t.routineId).length, notes: listerNotes(carnet).filter(n => Date.parse(n.date) > d).length };
}

/* ---------- HTTP ---------- */
const WEB = path.join(RACINE, 'web');
const WEB_STATION = path.join(RACINE, 'web-station');
const BOUSSOLE = path.join(RACINE, 'boussole');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const json = (res, code, corps) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(corps)); };
const lireCorps = req => new Promise((ok, ko) => { let s = ''; req.on('data', d => { s += d; if (s.length > 2e6) ko(new Error('corps trop long')); }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { ko(new Error('JSON invalide')); } }); });
/** Une page web ouverte ailleurs ne doit RIEN pouvoir faire au bureau : hôte local exigé, origine locale, et un en-tête que seul le bureau envoie. */
export function requeteAutorisee(req, port = PORT) {
  const hotes = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];
  if (!hotes.includes(String(req.headers.host || '').toLowerCase())) return 'hôte refusé';
  if (req.method === 'GET' || req.method === 'HEAD') return null;
  const origine = req.headers.origin;
  if (origine && !hotes.map(h => 'http://' + h).includes(String(origine).toLowerCase())) return 'origine refusée';
  if (req.headers['x-manita'] !== '1') return 'en-tête x-manita manquant';
  return null;
}

export function sante() {
  return { ok: true, nom: BUREAU.nom, version: BUREAU.version, port: PORT, moteur: 'claude-cli', modele: BUREAU.modele, maison: MAISON, atelier: ATELIER || null, plateforme: process.platform,
    notes: listerNotes(carnet).length, produits: produits(carnet).length, connecteurs: [...connecteursVus].map(([id, statut]) => ({ id, statut })), prefixes: prefixes(), telegram: telegram.etat(), usage: usageActuel(),
    taches: taches.length, routines: routines.lister().length, missions: missions.lister().map(m => ({ id: m.id, etat: m.etat, attente: m.attente })), chaine: missions.etatChaine(), travaux: travaux.etat(), claudeOccupe: occupe, fileClaude: file.length, heure: new Date().toISOString() };
}

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname; const m = req.method;
  try {
    if (p.startsWith('/api/')) { const refus = requeteAutorisee(req); if (refus) return json(res, 403, { erreur: refus }); }
    if (p === '/api/sante' && m === 'GET') return json(res, 200, sante());
    if (p === '/api/bureau' && m === 'GET') return json(res, 200, { ...BUREAU, maison: MAISON });
    if (p === '/api/taches' && m === 'GET') return json(res, 200, taches.slice(0, 200));
    if (p === '/api/taches' && m === 'POST') {
      const c = await lireCorps(req);
      if (!c.texte || !String(c.texte).trim()) return json(res, 400, { erreur: 'tâche vide' });
      if (ressembleJeton(c.texte, jetonMeta())) { journal('tâche refusée : elle contient un jeton Meta (masqué, jamais gardé)'); return json(res, 400, { erreur: JETON_ICI }); }
      if (c.departement && !BUREAU.departements.some(d => d.id === c.departement)) return json(res, 400, { erreur: 'département inconnu' });
      const lien = (String(c.texte).match(/https?:\/\/(drive|docs)\.google\.com\/\S+/i) || [])[0];
      if (lien && !c.departement) return json(res, 400, { erreur: 'lien Drive : colle-le dans Telegram (le robot pose les questions), ou ouvre l\'onglet المهمات' });
      const t = nouvelleTache({ texte: c.texte, departement: c.departement || null, modele: c.modele || null, besoinOk: typeof c.besoinOk === 'boolean' ? c.besoinOk : null });
      journal(`+ ${t.id} ${t.titre}`); enfiler(() => executer(t)); return json(res, 200, t);
    }
    let x = /^\/api\/taches\/([a-z0-9]+)(?:\/(approuver|refuser|reviser|relancer))?$/.exec(p);
    if (x) {
      const t = trouver(x[1]); if (!t) return json(res, 404, { erreur: 'tâche inconnue' });
      if (m === 'DELETE' && !x[2]) { taches = taches.filter(y => y.id !== t.id); sauver(); return json(res, 200, { ok: true }); }
      if (m === 'GET' && !x[2]) return json(res, 200, t);
      if (m === 'POST' && x[2] === 'approuver') { const ok = approuver(t, 'bureau'); return json(res, ok ? 200 : 409, ok ? t : { erreur: 'pas en attente' }); }
      if (m === 'POST' && x[2] === 'refuser') { const c = await lireCorps(req); if (c.note && ressembleJeton(c.note, jetonMeta())) return json(res, 400, { erreur: JETON_ICI }); if (c.note && refusDeContenu(c.note)) return json(res, 400, { erreur: refusDeContenu(c.note) }); return json(res, refuser(t, c.note || '', 'bureau') ? 200 : 409, t); }
      if (m === 'POST' && x[2] === 'reviser') { const c = await lireCorps(req); if (!c.note) return json(res, 400, { erreur: 'note vide' }); if (ressembleJeton(c.note, jetonMeta())) return json(res, 400, { erreur: JETON_ICI }); const refus = apprendre(t.departement, c.note); if (refus) return json(res, 400, { erreur: refus }); enfiler(() => executer(t, { phase: 'revision', consigne: c.note })); return json(res, 200, t); }
      if (m === 'POST' && x[2] === 'relancer') { poser(t, { etat: 'afaire', erreur: '' }); enfiler(() => executer(t)); return json(res, 200, t); }
      return json(res, 405, { erreur: 'méthode' });
    }
    // ---- la chaîne : les missions
    if (p === '/api/missions' && m === 'GET') return json(res, 200, missions.lister());
    if (p === '/api/lots' && m === 'GET') return json(res, 200, missions.lots());
    x = /^\/api\/missions\/([0-9a-f]{6})(?:\/(reprendre|arreter|suivre))?$/.exec(p);
    if (x) {
      const mi = missions.lire(x[1]); if (!mi) return json(res, 404, { erreur: 'mission inconnue' });
      if (m === 'GET' && !x[2]) return json(res, 200, { ...mi, journal: lireJournalMission(mi.id) });
      if (m === 'POST' && x[2] === 'reprendre') return json(res, missions.reprendre(mi.id) ? 200 : 409, { ok: true });
      if (m === 'POST' && x[2] === 'arreter') { await missions.arreter(mi.id, 'arrêt depuis le bureau'); return json(res, 200, { ok: true }); }
      if (m === 'POST' && x[2] === 'suivre') return json(res, missions.suivreMaintenant(mi.id) ? 200 : 409, { ok: true });
      return json(res, 405, { erreur: 'méthode' });
    }
    x = /^\/api\/missions\/([0-9a-f]{6})\/fichier$/.exec(p);
    if (x && m === 'GET') { // une planche, un aperçu ou une vidéo de la mission (lecture seule, dans son dossier seulement)
      const racine = path.resolve(MAISON, 'missions', x[1]); const f = path.resolve(racine, url.searchParams.get('chemin') || '');
      if (!f.startsWith(racine + path.sep) || !fs.existsSync(f) || !/\.(png|jpg|jpeg|mp4)$/i.test(f)) return json(res, 404, { erreur: 'fichier introuvable' });
      res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); return fs.createReadStream(f).pipe(res);
    }
    // ---- l'installation : connecteurs, comptes, Telegram, la liste à cocher
    if (p === '/api/installation' && m === 'GET') return json(res, 200, { ...installation, rapide: etatInstallation() });
    if (p === '/api/installation/verifier' && m === 'POST') return json(res, 200, await verifierTout());
    // la sonde (« افحص الكونيكتورات ») : une mission qui attendait un connecteur reprend s'il est revenu « connected »
    if (p === '/api/meta/sonder' && m === 'POST') { const c = await lireCorps(req); try { const r = await sonderJetonMeta({ compte: c.compte || null, page: c.page || null }); return json(res, 200, r); } catch (e) { return json(res, 500, { erreur: masquer(e.message, jetonMeta()) }); } }
    if (p === '/api/connecteurs/sonder' && m === 'POST') { try { const r = await sonder(); const reprise = missions.connecteursSondes(r); return json(res, 200, { ...r, reprise }); } catch (e) { return json(res, 500, { erreur: e.message }); } }
    if (p === '/api/inspecteur' && m === 'POST') return json(res, 200, await inspecteur.demander());
    if (p === '/api/inspecteur' && m === 'GET') return json(res, 200, { occupe: inspecteur.occupe(), dernier: inspecteur.dernier() });
    if (p === '/api/reglages/comptes' && m === 'POST') { try { return json(res, 200, await lireComptes()); } catch (e) { return json(res, 500, { erreur: e.message }); } }
    if (p === '/api/telegram/chat' && m === 'POST') { // le client a écrit /start à son robot : on lit son chat_id (le token doit être enregistré)
      const c = cfg(); if (!(c.telegram && c.telegram.token)) return json(res, 400, { erreur: 'enregistre d\'abord le token du robot' });
      try { const t = creerTelegram({ token: c.telegram.token, chat_id: 'x' }, journal); const d = await t.dernierChat(); if (!d) return json(res, 404, { erreur: 'aucun message : écris /start à ton robot puis réessaie' }); return json(res, 200, enregistrerReglages({ telegram: { chat_id: d.chat_id } })); }
      catch (e) { return json(res, 500, { erreur: e.message.replace(c.telegram.token, '***') }); }
    }
    if (p === '/api/chat/coach' && m === 'GET') return json(res, 200, chat.slice(-50));
    if (p === '/api/chat/coach' && m === 'POST') { const c = await lireCorps(req); if (!c.texte) return json(res, 400, { erreur: 'texte vide' }); if (ressembleJeton(c.texte, jetonMeta())) { journal('chat du coach : un jeton Meta collé (masqué, jamais envoyé)'); return json(res, 400, { erreur: JETON_ICI }); } let reponse; await new Promise(r => enfiler(async () => { try { reponse = await parlerAuCoach(String(c.texte)); } catch (e) { reponse = 'الكوتش ما قدرش يجاوب دروك : ' + e.message; } r(); })); return json(res, 200, { texte: reponse }); }
    if (/^\/api\/chat\//.test(p)) return json(res, 403, { erreur: 'seul le coach parle au client' });
    if (p === '/api/carnet' && m === 'GET') return json(res, 200, { notes: listerNotes(carnet).slice(0, 300), produits: produits(carnet), graphe: graphe(carnet), lecons: Object.fromEntries(BUREAU.departements.map(d => [d.id, lecons(d.id)])), mesures: lireMesures() });
    if (p === '/api/carnet/note' && m === 'GET') { try { return json(res, 200, { chemin: url.searchParams.get('chemin'), contenu: lireNote(carnet, url.searchParams.get('chemin') || '') }); } catch (e) { return json(res, 404, { erreur: e.message }); } }
    if (p === '/api/routines' && m === 'GET') return json(res, 200, routines.lister());
    if (p === '/api/routines' && m === 'POST') { const c = await lireCorps(req); if (!c.texte || !c.departement) return json(res, 400, { erreur: 'texte et département obligatoires' }); if (ressembleJeton(c.texte, jetonMeta())) return json(res, 400, { erreur: JETON_ICI }); if (refusDeContenu(c.texte)) return json(res, 400, { erreur: refusDeContenu(c.texte) }); if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(c.heure || '18:00')) return json(res, 400, { erreur: 'heure au format HH:MM' }); return json(res, 200, routines.ajouter(c)); }
    x = /^\/api\/routines\/([a-z0-9]+)(?:\/(maintenant|pause|reprendre))?$/.exec(p);
    if (x) {
      if (m === 'DELETE') { routines.supprimer(x[1]); return json(res, 200, { ok: true }); }
      const r = routines.lister().find(y => y.id === x[1]); if (!r) return json(res, 404, { erreur: 'routine inconnue' });
      if (m === 'POST' && x[2] === 'maintenant') { const t = nouvelleTache({ texte: r.texte, departement: r.departement, besoinOk: r.besoinOk, origine: 'routine (à la demande)', routineId: r.id }); enfiler(() => executer(t)); return json(res, 200, t); }
      if (m === 'POST' && x[2] === 'pause') { routines.pause(r.id, true); return json(res, 200, { ok: true }); }
      if (m === 'POST' && x[2] === 'reprendre') { routines.pause(r.id, false); return json(res, 200, { ok: true }); }
      return json(res, 405, { erreur: 'méthode' });
    }
    if (p === '/api/reglages' && m === 'GET') return json(res, 200, reglagesMasques());
    if (p === '/api/reglages/wilayas' && m === 'POST') { try { return json(res, 200, await lireWilayas()); } catch (e) { return json(res, 500, { erreur: e.message }); } }
    if (p === '/api/reglages' && m === 'POST') { const c = await lireCorps(req); if (c.ciblage !== undefined) { try { ciblageDuClient(c.ciblage, cfg().ciblage || ciblageDuPaquet()); } catch (e) { return json(res, 400, { erreur: e.message }); } } if (c.modele && !MODELES_OK.includes(c.modele)) return json(res, 400, { erreur: 'modèle inconnu' }); if (c.nom !== undefined && !String(c.nom).trim()) return json(res, 400, { erreur: 'nom vide' }); if (c.heureRapport && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(c.heureRapport)) return json(res, 400, { erreur: 'heure au format HH:MM' }); if (c.creasParModele !== undefined && creasValide(c.creasParModele) === null) return json(res, 400, { erreur: 'créas par modèle : 1, 2, 3 ou 4' }); if (c.ecartMetaHeures !== undefined && !((typeof c.ecartMetaHeures === 'number' || (typeof c.ecartMetaHeures === 'string' && /^\d{1,2}$/.test(c.ecartMetaHeures))) && Number.isInteger(+c.ecartMetaHeures) && +c.ecartMetaHeures >= 0 && +c.ecartMetaHeures <= 12)) return json(res, 400, { erreur: 'écart Meta : un nombre entier d\'heures de 0 à 12' }); return json(res, 200, enregistrerReglages(c)); }
    if (p === '/api/equipage' && m === 'GET') return json(res, 200, equipage());
    if (p === '/api/absence' && m === 'GET') return json(res, 200, absence(url.searchParams.get('depuis')));
    if (p === '/api/telegram' && m === 'GET') return json(res, 200, telegram.etat());
    if (p === '/api/telegram/essai' && m === 'POST') { const r = await telegram.envoyer('المكتب تاع ecom manita\nراه يخدم\nهاذي رسالة تجريب\nكلش مليح'); return json(res, r.envoye ? 200 : 400, r); }
    if (p === '/api/outils' && m === 'GET') return json(res, 200, { atelier: ATELIER || null, outils: BUREAU.departements.map(d => ({ departement: d.id, outil: d.outilPython || null, present: !!(ATELIER && d.outilPython && fs.existsSync(path.join(ATELIER, d.outilPython))) })) });
    x = /^\/api\/outils\/([a-z]+)\/verifier$/.exec(p);
    if (x && m === 'POST') return json(res, 200, await verifierOutil(x[1]));
    if (p === '/api/arreter' && m === 'POST') { json(res, 200, { ok: true, arret: 'le bureau s\'arrête' }); journal('arrêt demandé depuis la page ou ARRETER-WINDOWS'); setTimeout(() => process.exit(0), 300); return; }
    if (p === '/api/bavardages' && m === 'GET') {
      if (url.searchParams.get('format') === 'txt') { // tout l'historique, à l'heure locale
        const heure = q => { const d = new Date(q); return isNaN(d) ? q : d.toLocaleString('fr-FR', { hour12: false }); };
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-disposition': 'attachment; filename="bavardages-bureau.txt"', 'cache-control': 'no-store' });
        return res.end(lireBavardages().map(l => `${heure(l.quand)} · ${l.qui}${l.a ? ' → ' + l.a : ''} : ${l.texte}`).join('\n') + '\n');
      }
      return json(res, 200, { lignes: lireBavardages(200) });
    }
    if (p === '/api/bavardages' && m === 'POST') { const c = await lireCorps(req); if (!bailAccorde(c.onglet, c.focus)) return json(res, 200, { ok: false, refuse: 'un autre onglet enregistre' }); return json(res, 200, { ok: true, n: ajouterBavardages(c.lignes) }); } // refusé : la page garde ses lignes et réessaie
    if (p === '/api/depot/epreuve' && m === 'POST') return json(res, 200, await epreuveDepot());
    if (p === '/api/depot/essai-meta' && m === 'POST') { const c = await lireCorps(req); return json(res, 200, lancerEssaiMeta(c)); }
    if (p === '/api/depot/essai-meta' && m === 'GET') return json(res, 200, essaiMeta);
    if (p === '/api/journal' && m === 'GET') { let s = ''; try { s = fs.readFileSync(FICHIER_JOURNAL, 'utf8'); } catch {} return json(res, 200, { lignes: s.trim().split('\n').slice(-200) }); }
    if (p.startsWith('/api/')) return json(res, 404, { erreur: 'route inconnue' });
    // les pages : / = le bureau (web/) · /station = la station (web-station/) · /boussole = l'outil de calcul du client
    let racineWeb = WEB, f = p;
    if (p === '/station' || p === '/boussole') { res.writeHead(302, { location: p + '/' }); return res.end(); }
    if (p.startsWith('/station/')) { racineWeb = WEB_STATION; f = p.slice('/station'.length) || '/'; }
    else if (p.startsWith('/boussole/')) { racineWeb = BOUSSOLE; f = p.slice('/boussole'.length) || '/'; }
    if (f === '/' || f === '') f = '/index.html';
    const chemin = path.resolve(racineWeb, '.' + decodeURIComponent(f));
    if (!chemin.startsWith(racineWeb + path.sep) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { res.writeHead(404); return res.end('introuvable'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(chemin)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(chemin).pipe(res);
  } catch (e) { journal('http : ' + e.message); json(res, 500, { erreur: e.message }); }
});
/** Au démarrage : une conversation restée « en analyse » dont le lot a fini pendant la coupure reprend (photos, seul, vide). */
function rattraperAccueil() {
  // « ابدا » pressé, puis le PC coupé avant que TOUTES les missions du lot soient nées : le lot final (réponses ET marques
  // « اللونات غالطين ») est relu du disque ; les missions qui manquent naissent, une mission déjà née n'est jamais doublée
  for (const lf of accueil.lotsFinalsEnAttente()) {
    const l = missions.lireLot(lf.id), lance = { texte: TEXTES_ACCUEIL.lotLance(lf.n || (lf.modeles || []).length).join('\n') };
    let aEnvoyer;
    if (l && l.etat === 'pret') { journal(`lot ${lf.id} : « ابدا » repris au démarrage (coupure avant la création des missions)`); aEnvoyer = decider({ lotFinal: lf, envoyer: [lance] }); }
    else {
      // déjà « missions » : la coupure est tombée après la création, avant le message (jamais parti) ; sinon le lot est perdu
      accueil.lotFinalFait(lf.id); journal(`lot ${lf.id} : lot final repris au démarrage, lot ${l ? l.etat : 'introuvable'}`);
      aEnvoyer = [l && l.etat === 'missions' ? lance : { texte: TEXTES_ACCUEIL.lotPerdu.join('\n') }];
    }
    envoyerLot(aEnvoyer).catch(e => journal('accueil : ' + e.message));
  }
  const c = accueil.conversation();
  // un lot prêt dont la conversation n'existe plus (« ابدا » sans missions, conversation perdue) : annulé, jamais repris en silence
  for (const l of missions.lots()) if (l.etat === 'pret' && c?.lot !== l.id) missions.annulerLot(l.id, { raison: 'plus aucune conversation ne l\'attend (redemarrage)' });
  if (!c || c.termine || c.phase !== 'analyse' || !c.lot) return;
  const l = missions.lireLot(c.lot);
  // la coupure est tombée entre la fin des questions communes et la naissance du lot : il naît maintenant
  if (!l) { journal(`accueil ${c.id} : lot ${c.lot} jamais né (coupure), lancé au démarrage`); suiteAccueil({ lot: accueil.lotDeLaConversation(), envoyer: [] }).catch(e => journal('accueil : ' + e.message)); return; }
  if (['pret', 'vide', 'seul', 'echec'].includes(l.etat)) lotFini(l).catch(e => journal('accueil : ' + e.message));
  // un lot qui attend la limite d'usage de Claude (« quota ») ou un connecteur n'est pas fini : sa conversation reste ouverte
  else if (!['encours', 'quota', 'connecteur'].includes(l.etat)) { journal(`accueil ${c.id} : lot ${c.lot} ${l.etat}, la conversation est fermée`); const apres = accueil.annuler(); if (apres.length) envoyerLot(apres).catch(e => journal('accueil : ' + e.message)); } // jamais figée « en analyse » ; un lien neuf qui attendait commence (10/10/2026)
}
function lireJournalMission(id) { const d = path.join(MAISON, 'missions', id, 'journal'); try { return fs.readdirSync(d).filter(f => f.endsWith('.log')).map(f => ({ fichier: f, fin: fs.readFileSync(path.join(d, f), 'utf8').split('\n').slice(-30).join('\n') })); } catch { return []; } }
function lireMesures() { try { return fs.readFileSync(path.join(MAISON, 'carnet', 'mesures.csv'), 'utf8').trim().split('\n').slice(-60); } catch { return []; } }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  serveur.on('error', e => { journal(e.code === 'EADDRINUSE' ? `le port ${PORT} est déjà pris : le bureau tourne peut-être déjà (http://localhost:${PORT})` : 'serveur : ' + e.message); process.exit(1); });
  serveur.listen(PORT, '127.0.0.1', () => {
    journal(`ecom manita — le bureau ${BUREAU.version} → http://localhost:${PORT}`);
    journal(`  maison : ${MAISON}   atelier : ${ATELIER || 'non trouvé'}`);
    journal(`  moteur : ${trouverClaude()} · ${BUREAU.modele}   telegram : ${telegram.etat().configure ? 'configuré' : 'à configurer (الإعدادات)'}   connecteurs : ${Object.keys(prefixes()).join(', ') || 'à sonder'}`);
    brancherTelegram();
    // [relecture] 10/10/2026 : une tâche coupée PENDANT sa phase « lance » (ou dont le « لانسي » était en file) ne repart pas
    // en travail (elle redemanderait « لانسي » et referait ce qui est peut-être déjà parti) : échec, la raison dite
    for (const t of taches.filter(x => x.etat === 'encours' && x.phase === 'lance')) {
      poser(t, { etat: 'echec', erreur: 'coupé pendant l\'exécution après « لانسي » : vérifie dans Meta et Tassyir ce qui est déjà parti avant de relancer' });
      journal(`${t.id} : coupé pendant sa phase « lance » — échec, rien n'est refait`);
    }
    // son « لانسي » était en file, rien n'avait commencé : il part (une seule fois), c'est le mot du client
    for (const t of taches.filter(x => x.etat === 'attente' && x.approbation && x.approbation.reponse === 'lance')) { journal(`${t.id} : « لانسي » en file avant la coupure — la phase « lance » repart une fois`); enfiler(() => executer(t, { phase: 'lance' })); }
    for (const t of taches.filter(x => x.etat === 'encours' || x.etat === 'afaire').reverse()) enfiler(() => executer(t));
    missions.redemarrer();
    rattraperAccueil();
  });
}
export { serveur, missions, accueil };
