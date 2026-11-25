#!/usr/bin/env node
// ecom manita — LE SERVEUR META LOCAL (option A, conception validée le 09/10/2026).
// Un serveur MCP minimal (JSON-RPC 2.0 sur stdio, une ligne = un message), en Node, SANS aucune dépendance, qui parle à la
// Graph API de Meta avec le jeton d'utilisateur système du client.
//
// Les lois de ce fichier :
//  - le JETON est lu par le serveur LUI-MÊME dans bureau/config.local.json (clé meta.jeton), À CHAQUE APPEL : jamais en
//    argument, jamais en variable d'environnement, jamais journalisé, jamais rendu dans une réponse d'outil (toute chaîne qui
//    ressemble à un jeton est masquée dans les journaux ET dans les erreurs) ;
//  - la version de la Graph API est ÉPINGLÉE dans UNE constante (VERSION_GRAPH), jamais « latest » ;
//  - les outils portent les MÊMES NOMS et les mêmes arguments que le connecteur claude.ai officiel « Meta Ads » (ceux que les
//    prompts de missions.mjs et les skills utilisent) ; ABSENTS : toute suppression, les audiences, les catalogues, le boost ;
//  - AUCUN plafond (spend_cap, daily_spend_cap, lifetime_spend_cap, campaign_spend_cap, budget de vie) : refusé même passé ;
//  - tout objet créé naît PAUSED (aucun argument de statut n'est lu) ;
//  - ads_activate_entity est REFUSÉ sans la PORTE : un jeton de porte à usage unique, écrit par missions.mjs (l'étape
//    d'activation qui suit « لانسي ») dans <bureau-data>/meta-portes/<porte>.json, lié à la mission et aux ids à activer ;
//    chaque id ne passe qu'une fois ; le refus est journalisé. ads_update_entity ne pose que status PAUSED et daily_budget :
//    aucun deuxième chemin d'activation.
//  - [porte-groupee] 10/10/2026 : l'HEURE DE DÉBUT d'un ad set (start_time) se pose par ads_update_entity, en LISTE FERMÉE :
//    un ad set seulement (les ad sets que la porte nomme), le SEUL champ start_time dans la charge (ni budget, ni status),
//    une date future et au plus sept jours, seulement avec une porte valide pour cet id (la porte n'est PAS consommée : l'id
//    doit encore passer l'activation), puis relue (GET) et rendue telle que Meta la garde.
//  - [casse-5] 10/10/2026 : la porte d'un LOT (les ids de tous ses modèles) porte aussi les ids de CHAQUE modèle (parMission) ;
//    pendant le tour d'un modèle (ouvrirTourPorte, posé par missions.mjs), seuls SES ids passent (activation et start_time) :
//    jamais l'objet d'un autre modèle du lot avec la même porte (il partirait sans son heure).
// Code original « ecom manita » — aucun code tiers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** La version de la Graph API / Marketing API — vérifiée en ligne le 09/10/2026 (changelog Meta) : v25.0 (18/02/2026) en
 *  service, v26.0 (29/07/2026) la plus récente. On épingle la version stable d'avant la dernière ; la changer = cette ligne. */
export const VERSION_GRAPH = 'v25.0';
export const NOM_SERVEUR = 'meta_manita';
export const PREFIXE = `mcp__${NOM_SERVEUR}__`;
const ICI = path.dirname(fileURLToPath(import.meta.url));
const GRAPH_META = 'https://graph.facebook.com';

/* ------------------------------------------------ le masquage ------------------------------------------------ */
/** Masque toute chaîne qui ressemble à un jeton (et le jeton exact connu) : journaux, erreurs, réponses. */
export function masquer(texte, jeton = '') {
  let t = String(texte ?? '');
  if (jeton && jeton.length >= 8) t = t.split(jeton).join('••••');
  return t
    .replace(/EAA[A-Za-z0-9]{16,}/g, '••••')
    .replace(/(access_token|input_token|appsecret_proof|client_secret)=([^&\s"'<>]+)/gi, '$1=••••')
    .replace(/("?(?:access_token|jeton|token)"?\s*:\s*")([^"]{8,})(")/gi, '$1••••$3')
    .replace(/(Bearer|OAuth)\s+[A-Za-z0-9._\-]{8,}/gi, '$1 ••••')
    .replace(/\b[A-Za-z0-9_\-]{120,}\b/g, '••••');
}

/* ------------------------------------------------ la configuration ------------------------------------------------ */
function argsDe(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); o[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1'; }
  return o;
}
const lireJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
/** La base de la Graph API : graph.facebook.com, ou un faux Graph LOCAL (http://127.0.0.1 / localhost) pour les épreuves.
 *  Toute autre adresse est refusée : le jeton ne part jamais ailleurs que chez Meta. */
export function baseGraph(voulu) {
  if (!voulu) return GRAPH_META;
  let u; try { u = new URL(voulu); } catch { throw new Error('adresse Graph illisible'); }
  if (u.origin === GRAPH_META) return GRAPH_META;
  if (u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return u.origin;
  throw new Error('adresse Graph refusée (seuls graph.facebook.com et un faux Graph local sont permis)');
}
/** Le jeton, relu à chaque appel. Rend '' quand il n'y en a pas. */
export function lireJeton(fichierConfig) {
  const c = lireJSON(fichierConfig) || {};
  return typeof c?.meta?.jeton === 'string' ? c.meta.jeton.trim() : '';
}

/* ------------------------------------------------ la Graph API ------------------------------------------------ */
/** La classe d'une erreur de Meta : « jeton » (#190, #102, OAuth sans droits), « droits » (#200–#299, #10, #3), sinon « meta ». */
export function classeErreur(e) {
  const code = +(e && e.code);
  if (code === 190 || code === 102 || code === 463 || code === 467) return 'jeton';
  if (code === 10 || code === 3 || (code >= 200 && code <= 299)) return 'droits';
  return 'meta';
}
/** Un appel à la Graph API. Le jeton part dans l'en-tête Authorization (jamais dans l'adresse). Rend l'objet JSON de Meta,
 *  ou rejette une erreur { code, type, sous_code, classe, message masqué }. */
/** LE CHEMIN d'un appel (10/10/2026, « casse ») : un nœud (me, act_<id>, <id>) et au plus UNE arête connue, rien d'autre.
 *  Un id collé tel quel (« C1/copies », « C1?status=ACTIVE », « 111/campaigns?method=post&… ») ouvrait une duplication,
 *  une activation sans porte ou un plafond passé dans l'adresse. */
export const ARETES = ['adaccounts', 'accounts', 'promote_pages', 'campaigns', 'adsets', 'ads', 'advideos', 'adimages', 'instagram_accounts', 'adspixels', 'adcreatives', 'owned_pixels'];
export const ID_SUR = /^[A-Za-z0-9_-]{1,64}$/;
export function cheminSur(chemin) {
  const c = String(chemin ?? '');
  if (c === '') return true;
  const [noeud, arete, ...reste] = c.split('/');
  return !reste.length && ID_SUR.test(noeud) && (arete === undefined || ARETES.includes(arete));
}
export async function graph({ jeton, base = GRAPH_META, methode = 'GET', chemin, params = {}, dureeMs = 60000 }) {
  if (!jeton) throw Object.assign(new Error('aucun jeton Meta enregistré (التحضير)'), { code: 190, classe: 'jeton', type: 'manita' });
  if (!cheminSur(chemin)) throw Object.assign(new Error(`chemin Graph refusé : ${String(chemin).slice(0, 80)}`), { refus: true, code: 'refus', classe: 'refus', type: 'manita' });
  // « method » (et ses variantes) change un GET en écriture chez Graph : jamais envoyé
  if (Object.keys(params).some(k => /^_?method$/i.test(k))) throw Object.assign(new Error('paramètre « method » refusé'), { refus: true, code: 'refus', classe: 'refus', type: 'manita' });
  const url = new URL(`${base}/${VERSION_GRAPH}/${String(chemin)}`);
  const plat = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) plat[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  const options = { method: methode, headers: { authorization: `Bearer ${jeton}` }, signal: AbortSignal.timeout(dureeMs) };
  if (methode === 'GET') for (const [k, v] of Object.entries(plat)) url.searchParams.set(k, v);
  else { options.headers['content-type'] = 'application/x-www-form-urlencoded'; options.body = new URLSearchParams(plat).toString(); }
  let r, texte;
  try { r = await fetch(url, options); texte = await r.text(); }
  catch (e) { throw Object.assign(new Error('Meta ne répond pas : ' + masquer(e.message, jeton)), { code: 0, classe: 'meta', type: 'reseau' }); }
  let j = null; try { j = JSON.parse(texte); } catch {}
  if (!r.ok || (j && j.error)) {
    const er = (j && j.error) || {};
    const code = er.code ?? r.status;
    throw Object.assign(new Error(masquer(er.message || `HTTP ${r.status}`, jeton)), { code, sous_code: er.error_subcode ?? null, type: er.type || 'http', classe: classeErreur({ code }), statut: r.status });
  }
  // un 200 qui n'est pas du JSON (portail Wi-Fi, proxy, page d'erreur) n'est PAS une lecture : jamais un faux vert
  if (!j || typeof j !== 'object') throw Object.assign(new Error(`réponse de Meta illisible (HTTP ${r.status}, pas du JSON)`), { code: r.status, classe: 'meta', type: 'illisible', statut: r.status });
  return j;
}
const sansAct = id => String(id ?? '').trim().replace(/^act_/, '');
const act = id => `act_${sansAct(id)}`;

/** La LECTURE RÉELLE qui décide du chemin d'une mission (missions.mjs) : GET /me, puis le compte. Rend { ok, classe, code, raison }. */
/** Une lecture n'est VRAIE que si Meta rend l'objet demandé (10/10/2026, « casse ») : /me avec un id, le compte avec SON id
 *  (act_<id> ou account_id), la page avec SON id. Un 200 vide ou l'objet d'un autre = pas lu. */
const memeId = (lu, voulu, compte = false) => { const v = compte ? sansAct(voulu) : String(voulu); return [lu?.id, lu?.account_id].some(x => x !== undefined && x !== null && (compte ? sansAct(x) : String(x)) === v); };
const pasLu = quoi => Object.assign(new Error(`${quoi} : Meta n'a pas rendu l'objet demandé (pas une lecture)`), { classe: 'meta', code: null, type: 'pas-lu' });
/** Le compte pub d'une mission ou des réglages : sans compte, la lecture ne prouve rien du compte (jamais « ok » sur /me seul). */
export async function lectureReelle({ fichierConfig, base, compte }) {
  const jeton = lireJeton(fichierConfig);
  if (!jeton) return { ok: false, classe: 'aucun', code: null, raison: 'aucun jeton Meta enregistré' };
  if (!compte || !ID_SUR.test(act(compte))) return { ok: false, classe: 'droits', code: null, raison: 'aucun compte publicitaire à lire (réglages) : GET /me seul ne prouve rien' };
  try {
    const me = await graph({ jeton, base, chemin: 'me', params: { fields: 'id,name' } });
    if (!me.id) throw pasLu('GET /me');
    let c;
    // le compte qui « n'existe pas ou sans droit » (#100) est un refus de DROITS, pas une panne de Meta
    try { c = await graph({ jeton, base, chemin: act(compte), params: { fields: 'account_status,currency,name' } }); }
    catch (e) { if (e.classe === 'meta' && +e.code === 100) e.classe = 'droits'; throw e; }
    if (!memeId(c, compte, true)) throw pasLu(`GET ${act(compte)}`);
    return { ok: true, classe: null, code: null, raison: `GET /me (${masquer(me.id, jeton)}) et ${act(compte)} lus` };
  } catch (e) { return { ok: false, classe: e.classe || 'meta', code: e.code ?? null, raison: masquer(`(#${e.code ?? '?'}) ${e.message}`, jeton) }; }
}
/** LES TROIS REFUS de la sonde (التحضير), en darija (loi de forme : une ligne, sans chiffre). */
export const REFUS_SONDE = {
  jeton: 'التوكن غالط ولا فات وقتو',
  droits: 'ناقصو الحق على الكونت ولا الصفحة',
  meta: 'ميتا رافضة ولا ما راهيش تجاوب',
  aucun: 'ما كاين حتى توكن، نخدمو بالكونيكتور',
  // 10/10/2026 (« casse ») : sans compte ni page, rien n'a été lu — jamais « يخدم » sur /me seul
  reglages: 'اختار الكونت و الصفحة قبل الفحص',
  ok: 'التوكن يخدم مع الكونت و الصفحة'
};
/** [raison-meta] (23/10/2026) Le STATUT du compte lu chez Meta (Graph rend un nombre, le connecteur un mot) : un compte
 *  pas actif dit POURQUOI (dette non payée, compte bloqué…), jamais « ناقصو الحق » — ce n'est pas le jeton ni ses droits. */
export const STATUTS_COMPTE = { 1: 'ACTIVE', 2: 'DISABLED', 3: 'UNSETTLED', 7: 'PENDING_RISK_REVIEW', 8: 'PENDING_SETTLEMENT', 9: 'IN_GRACE_PERIOD', 100: 'PENDING_CLOSURE', 101: 'CLOSED', 201: 'ANY_ACTIVE', 202: 'ANY_CLOSED' };
export const nomStatutCompte = v => { const t = String(v ?? '').trim().toUpperCase(); return STATUTS_COMPTE[t] || t; };
export const REFUS_STATUT = {
  UNSETTLED: 'الكونت محبوس : دين ما تخلصش في ميتا',
  DISABLED: 'ميتا وقّفت الكونت تاع البوب',
  PENDING_RISK_REVIEW: 'ميتا راهي تراجع الكونت تاع البوب',
  PENDING_SETTLEMENT: 'الخلاص راهو يتعالج في ميتا، استنى',
  IN_GRACE_PERIOD: 'كاين خلاص لازم يتخلص في ميتا',
  PENDING_CLOSURE: 'الكونت تاع البوب راهو يتسكّر',
  CLOSED: 'الكونت تاع البوب مسكّر في ميتا',
  autre: 'الكونت تاع البوب ماشي خدّام في ميتا'
};
export const STATUT_FR = {
  UNSETTLED: 'dette non payée chez Meta : payer dans Meta > Facturation',
  DISABLED: 'compte désactivé par Meta : voir Qualité du compte',
  PENDING_RISK_REVIEW: 'compte en vérification chez Meta',
  PENDING_SETTLEMENT: 'paiement en cours de traitement chez Meta',
  IN_GRACE_PERIOD: 'paiement à régler bientôt chez Meta',
  PENDING_CLOSURE: 'compte en cours de fermeture',
  CLOSED: 'compte fermé : choisir un autre compte'
};
/** Une empreinte COURTE du jeton (sha256, 12 caractères) : dit si la sonde gardée parle du jeton d'aujourd'hui, sans le garder. */
export const empreinteJeton = jeton => (jeton ? crypto.createHash('sha256').update(String(jeton)).digest('hex').slice(0, 12) : '');
/** Un texte qui RESSEMBLE à un jeton Meta (collé dans Telegram, le chat du coach, une tâche) : il ne part nulle part. */
export const ressembleJeton = (texte, jeton = '') => { const t = String(texte || ''); return /EAA[A-Za-z0-9]{20,}/.test(t) || (!!jeton && jeton.length >= 8 && t.includes(jeton)); };
/** La SONDE : GET /me, GET /act_<compte>?fields=account_status,currency,name, GET /<page>?fields=id,name. Chaque refus dit
 *  lequel des trois (jeton / droits / Meta). L'écriture se juge au premier appel d'écriture (aucune écriture ici). */
export async function sonder({ fichierConfig, base, compte, page }) {
  const jeton = lireJeton(fichierConfig);
  const etapes = [];
  if (!jeton) return { ok: false, refus: 'aucun', texte: REFUS_SONDE.aucun, etapes };
  if (!compte || !page || !ID_SUR.test(act(compte)) || !ID_SUR.test(String(page))) return { ok: false, refus: 'reglages', texte: REFUS_SONDE.reglages, etapes, empreinte: empreinteJeton(jeton) };
  const lire = async (quoi, chemin, fields, voulu = null) => {
    try {
      const j = await graph({ jeton, base, chemin, params: { fields } });
      if (quoi === 'me' ? !j.id : !memeId(j, voulu, quoi === 'compte')) throw pasLu(quoi);
      etapes.push({ quoi, ok: true }); return j;
    }
    catch (e) {
      // sur /me, tout refus d'OAuth est un jeton faux ; sur le compte ou la page, un #100 « n'existe pas / pas de droit » = droits
      let classe = e.classe || 'meta';
      if (quoi === 'me' && e.type === 'OAuthException') classe = 'jeton';
      else if (quoi !== 'me' && classe === 'meta' && +e.code === 100) classe = 'droits';
      etapes.push({ quoi, ok: false, code: e.code ?? null, detail: masquer(e.message, jeton) });
      throw Object.assign(new Error('refus'), { classe });
    }
  };
  const empreinte = empreinteJeton(jeton);
  try {
    await lire('me', 'me', 'id,name');
    const c = await lire('compte', act(compte), 'account_status,currency,name', compte);
    const devise = c.currency || null, nomCompte = c.name || null;
    // le statut du compte doit être LU et actif (1) : absent = pas lu
    if (c.account_status === undefined || c.account_status === null || String(c.account_status).trim() === '') { etapes.push({ quoi: 'compte', ok: false, detail: 'account_status absent' }); return { ok: false, refus: 'droits', texte: REFUS_SONDE.droits, etapes, empreinte }; }
    const statut = nomStatutCompte(c.account_status);
    // [raison-meta] lu mais pas actif : le refus « statut » dit la raison de Meta (le jeton n'est pas en cause)
    if (statut !== 'ACTIVE') { etapes.push({ quoi: 'compte', ok: false, detail: `account_status ${c.account_status} (${statut})` }); return { ok: false, refus: 'statut', statut, raison: STATUT_FR[statut] || `statut ${statut}`, texte: REFUS_STATUT[statut] || REFUS_STATUT.autre, etapes, empreinte }; }
    const p = await lire('page', String(page), 'id,name', page);
    return { ok: true, refus: null, texte: REFUS_SONDE.ok, etapes, devise, compte: nomCompte, page: p.name || null, version: VERSION_GRAPH, empreinte };
  } catch (e) { const k = e.classe === 'jeton' || e.classe === 'droits' ? e.classe : 'meta'; return { ok: false, refus: k, texte: REFUS_SONDE[k], etapes, empreinte }; }
}

/* ------------------------------------------------ la PORTE d'activation ------------------------------------------------ */
const NOM_PORTE = /^[a-f0-9]{32}$/;
/** missions.mjs, à l'étape d'activation après « لانسي » : écrit une porte liée à la mission et aux ids. Rend la porte. */
export function ecrirePorte(dossier, { mission, ids, adSets = [], dureeMs = 60 * 60000, parMission = null }) {
  fs.mkdirSync(dossier, { recursive: true });
  const porte = crypto.randomBytes(16).toString('hex'), liste = [...new Set((ids || []).map(String))];
  // [porte-groupee] les AD SETS de la porte (sous-ensemble de ses ids) : les seuls objets dont l'heure de début peut être posée
  const sets = [...new Set((adSets || []).map(String))].filter(id => liste.includes(id));
  // [casse-5] la porte d'un LOT : les ids de CHAQUE modèle (sous-ensembles de ses ids) ; pendant le tour d'un modèle (tour,
  // posé par ouvrirTourPorte), seuls SES ids passent — jamais l'objet d'un autre modèle du lot avec la même porte
  const par = parMission && typeof parMission === 'object' ? Object.fromEntries(Object.entries(parMission).map(([k, v]) => [String(k), [...new Set((v || []).map(String))].filter(id => liste.includes(id))])) : null;
  const f = path.join(dossier, porte + '.json'), t = f + '.tmp';
  fs.writeFileSync(t, JSON.stringify({ porte, mission: String(mission), ids: liste, restants: liste, adSets: sets, ...(par ? { parMission: par, tour: null } : {}), creeLe: new Date().toISOString(), expire: new Date(Date.now() + dureeMs).toISOString() }));
  fs.renameSync(t, f);
  return porte;
}
/** [casse-5] Le tour d'UN modèle sur la porte d'un lot : seuls ses ids passent tant que le tour est ouvert (les tours d'un lot
 *  vont un par un). fermerTourPorte le referme (seulement si c'est encore le sien). Rend true si la porte a été écrite. */
export function ouvrirTourPorte(dossier, porte, mission) {
  if (!NOM_PORTE.test(String(porte || ''))) return false;
  const f = path.join(dossier, porte + '.json'), p = lireJSON(f); if (!p || !p.parMission) return false;
  p.tour = String(mission); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(p)); fs.renameSync(t, f); return true;
}
export function fermerTourPorte(dossier, porte, mission) {
  if (!NOM_PORTE.test(String(porte || ''))) return false;
  const f = path.join(dossier, porte + '.json'), p = lireJSON(f); if (!p || !p.parMission || p.tour !== String(mission)) return false;
  p.tour = null; const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(p)); fs.renameSync(t, f); return true;
}
/** [casse-5] Les ids hors du modèle dont le tour est ouvert (porte d'un lot) : rend null (porte d'un modèle, ou tout est à lui)
 *  ou la raison du refus. */
function horsDuTour(p, ids) {
  if (!p || !p.parMission) return null;
  if (!p.tour || !Array.isArray(p.parMission[p.tour])) return 'porte du lot : aucun tour de modèle ouvert (les activations d\'un lot vont une par une)';
  const hors = ids.map(String).filter(id => !p.parMission[p.tour].includes(id));
  return hors.length ? `${hors.join(', ')} hors du modèle de ce tour (${p.tour}) : la porte du lot ne sert, pendant un tour, que les objets de CE modèle` : null;
}
/** La porte refermée après le tour (ce qui n'a pas servi ne servira plus). */
export function effacerPorte(dossier, porte) { if (NOM_PORTE.test(String(porte || ''))) { try { fs.unlinkSync(path.join(dossier, porte + '.json')); } catch {} } }
/** Le passage : chaque id visé doit être dans la porte, encore là, pas expiré ; il est retiré AVANT l'appel à Meta (un
 *  plantage pendant l'appel ne rend jamais la porte deux fois). Rend { ok, mission } ou { ok:false, raison }. */
export function passerPorte(dossier, porte, ids) {
  if (!dossier) return { ok: false, raison: 'aucun dossier de portes : activation impossible par ce serveur' };
  if (!porte) return { ok: false, raison: 'activation refusée : aucune porte (seule l\'étape d\'activation après « لانسي » en pose une)' };
  if (!NOM_PORTE.test(String(porte))) return { ok: false, raison: 'activation refusée : porte illisible' };
  const f = path.join(dossier, porte + '.json'), p = lireJSON(f);
  if (!p) return { ok: false, raison: 'activation refusée : porte inconnue ou déjà utilisée' };
  if (Date.parse(p.expire) < Date.now()) { try { fs.unlinkSync(f); } catch {} return { ok: false, raison: 'activation refusée : porte expirée' }; }
  const hors = ids.filter(id => !p.restants.includes(String(id)));
  if (hors.length) return { ok: false, raison: `activation refusée : ${hors.join(', ')} ${p.ids.some(x => hors.includes(x)) ? 'déjà activé avec cette porte (usage unique)' : 'hors de la porte de la mission ' + p.mission}` };
  const tourHors = horsDuTour(p, ids); if (tourHors) return { ok: false, raison: 'activation refusée : ' + tourHors };
  p.restants = p.restants.filter(id => !ids.includes(id));
  if (p.restants.length) { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(p)); fs.renameSync(t, f); } else { try { fs.unlinkSync(f); } catch {} }
  return { ok: true, mission: p.mission };
}

/** [porte-groupee] La porte COUVRE-t-elle cet ad set pour poser son heure de début ? Lecture seule : rien n'est retiré (l'id
 *  doit encore passer l'activation). L'id doit être un AD SET nommé par la porte et encore à activer. Rend { ok, raison }. */
export function porteCouvreAdSet(dossier, porte, id) {
  if (!dossier) return { ok: false, raison: 'aucun dossier de portes : heure de début impossible par ce serveur' };
  if (!porte) return { ok: false, raison: 'heure de début refusée : aucune porte (seule l\'étape d\'activation après « لانسي » en pose une)' };
  if (!NOM_PORTE.test(String(porte))) return { ok: false, raison: 'heure de début refusée : porte illisible' };
  const p = lireJSON(path.join(dossier, porte + '.json'));
  if (!p) return { ok: false, raison: 'heure de début refusée : porte inconnue ou déjà utilisée' };
  if (Date.parse(p.expire) < Date.now()) return { ok: false, raison: 'heure de début refusée : porte expirée' };
  if (!(p.adSets || []).includes(String(id))) return { ok: false, raison: `heure de début refusée : ${id} n'est pas un ad set de la porte de ${p.mission}` };
  if (!(p.restants || []).includes(String(id))) return { ok: false, raison: `heure de début refusée : ${id} déjà activé avec cette porte` };
  const tourHors = horsDuTour(p, [id]); if (tourHors) return { ok: false, raison: 'heure de début refusée : ' + tourHors };
  return { ok: true, mission: p.mission };
}
/** [porte-groupee] L'heure de début acceptée : une date lisible AVEC son fuseau (Z ou ±hh:mm), au moins une minute dans le
 *  futur, au plus sept jours. Rend { ok, ms, graph } (graph : « AAAA-MM-JJTHH:MM:SS+0000 », la forme que Meta rend) ou { ok:false, raison }. */
export const START_TIME_MAXI_MS = 7 * 86400000;
export function startTimeValide(v, maintenant = Date.now()) {
  const t = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(t)) return { ok: false, raison: `start_time illisible : ${t.slice(0, 40) || '(vide)'} (une date ISO avec son fuseau)` };
  const ms = Date.parse(t.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  if (!Number.isFinite(ms)) return { ok: false, raison: `start_time illisible : ${t.slice(0, 40)}` };
  if (ms < maintenant + 60000) return { ok: false, raison: 'start_time refusé : la date doit être dans le futur' };
  if (ms > maintenant + START_TIME_MAXI_MS) return { ok: false, raison: 'start_time refusé : au plus sept jours' };
  return { ok: true, ms, graph: new Date(ms).toISOString().replace(/\.\d{3}Z$/, '+0000') };
}

/* ------------------------------------------------ les outils ------------------------------------------------ */
// les arguments de traçage du connecteur officiel : acceptés (les habitudes de Claude ne cassent pas), jamais envoyés à Meta
const TRACE = { advertiser_request: { type: 'string' }, client_conversation_id: { type: 'string' }, client_model: { type: 'string' } };
const S = t => ({ type: t }), TXT = S('string'), INT = S('integer'), BOOL = S('boolean'), LISTE = { type: 'array', items: TXT };
const schema = (props, requis = []) => ({ type: 'object', properties: { ...props, ...TRACE }, required: requis });
/** LES PLAFONDS : refusés partout (arguments d'outil, et « fields » d'une mise à jour), même passés à zéro. */
export const PLAFONDS = ['spend_cap', 'daily_spend_cap', 'lifetime_spend_cap', 'campaign_spend_cap', 'campaign_lifetime_budget', 'lifetime_budget', 'lifetime_min_spend_target', 'budget_schedule_specs'];
/** Les champs que la mission lit (ads_get_field_context : une table LOCALE, les noms canoniques du connecteur). */
const CHAMPS = [
  ['id', 'ID', ['campaign', 'adset', 'ad', 'ad_account'], 'string', true], ['name', 'Name', ['campaign', 'adset', 'ad', 'ad_account'], 'string', true],
  ['status', 'Status', ['campaign', 'adset', 'ad'], 'enum', true], ['effective_status', 'Delivery', ['campaign', 'adset', 'ad'], 'enum', true],
  ['configured_status', 'Configured status', ['campaign', 'adset', 'ad'], 'enum', false], ['objective', 'Objective', ['campaign'], 'enum', true],
  ['buying_type', 'Buying type', ['campaign'], 'enum', false], ['bid_strategy', 'Bid strategy', ['campaign', 'adset'], 'enum', false],
  ['daily_budget', 'Daily budget', ['campaign', 'adset'], 'currency', false], ['lifetime_budget', 'Lifetime budget', ['campaign', 'adset'], 'currency', false],
  ['spend_cap', 'Spend cap', ['campaign', 'ad_account'], 'currency', false], ['daily_spend_cap', 'Daily spend cap', ['adset'], 'currency', false],
  ['lifetime_spend_cap', 'Lifetime spend cap', ['adset'], 'currency', false], ['bid_amount', 'Bid amount', ['adset'], 'currency', false],
  ['targeting', 'Targeting', ['adset'], 'json', false], ['optimization_goal', 'Optimization goal', ['adset'], 'enum', false],
  ['billing_event', 'Billing event', ['adset'], 'enum', false], ['promoted_object', 'Promoted object', ['adset'], 'json', false],
  ['destination_type', 'Destination type', ['adset'], 'enum', false], ['campaign_id', 'Campaign ID', ['adset', 'ad'], 'string', true],
  ['adset_id', 'Ad set ID', ['ad'], 'string', true], ['creative', 'Creative', ['ad'], 'json', false],
  ['created_time', 'Created', ['campaign', 'adset', 'ad'], 'datetime', false], ['start_time', 'Start time', ['campaign', 'adset'], 'datetime', false],
  ['stop_time', 'Stop time', ['campaign'], 'datetime', false], ['end_time', 'End time', ['adset'], 'datetime', false],
  ['currency', 'Currency', ['ad_account'], 'string', false], ['account_status', 'Account status', ['ad_account'], 'enum', false],
  ['amount_spent', 'Amount spent', ['campaign', 'adset', 'ad', 'ad_account'], 'currency', false, ['spend'], true],
  ['impressions', 'Impressions', ['campaign', 'adset', 'ad', 'ad_account'], 'number', false, [], true],
  ['reach', 'Reach', ['campaign', 'adset', 'ad', 'ad_account'], 'number', false, [], true],
  ['clicks', 'Clicks', ['campaign', 'adset', 'ad', 'ad_account'], 'number', false, [], true],
  ['ctr', 'CTR', ['campaign', 'adset', 'ad', 'ad_account'], 'percent', false, [], true],
  ['cpm', 'CPM', ['campaign', 'adset', 'ad', 'ad_account'], 'currency', false, [], true],
  ['results', 'Results', ['campaign', 'adset', 'ad'], 'actions', false, ['actions'], true],
  ['cost_per_result', 'Cost per result', ['campaign', 'adset', 'ad'], 'actions', false, ['cost_per_action_type'], true]
].map(([name, display_name, levels, type, filterable, aliases = [], metric = false]) => ({ name, display_name, levels, type, filterable, sortable: metric, metric, aliases }));
const METRIQUES = new Map(CHAMPS.filter(c => c.metric).map(c => [c.name, c.name === 'amount_spent' ? 'spend' : c.name === 'results' ? 'actions' : c.name === 'cost_per_result' ? 'cost_per_action_type' : c.name]));
/** LA LISTE FERMÉE de ads_get_ad_entities (10/10/2026, « casse ») : les champs de la table (noms et alias) et quelques champs
 *  simples d'un objet de pub. Avant, n'importe quel texte partait dans « fields » : une expansion vers d'autres objets
 *  (« adcreatives{…} », « ads.limit(…){…} »), ou « access_token » d'une PAGE lue par object_ids — un secret rendu à Claude. */
export const CHAMPS_ENTITE = [...new Set([...CHAMPS.flatMap(c => [c.name, ...c.aliases]), 'account_id', 'updated_time', 'issues_info', 'adlabels', 'special_ad_categories', 'attribution_spec', 'pacing_type', 'is_dynamic_creative', 'source_ad_id', 'learning_stage_info', 'frequency', 'cpc', 'cpp'])];
/** Les périodes que Graph connaît (date_preset) ; rien d'autre ne se colle dans « fields ». */
export const PERIODES = ['today', 'yesterday', 'this_month', 'last_month', 'this_quarter', 'maximum', 'data_maximum', 'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_90d', 'last_week_mon_sun', 'last_week_sun_sat', 'last_quarter', 'last_year', 'this_week_mon_today', 'this_week_sun_today', 'this_year'];
const ATTR_VIDEO = ['id', 'title', 'description', 'length', 'created_time', 'updated_time', 'permalink_url', 'picture', 'status'];
/** Les champs des lectures, tels que le connecteur les accepte (un autre nom est refusé, comme chez lui). */
export const CHAMPS_IMAGE = ['name', 'hash', 'status', 'width', 'height', 'original_width', 'original_height', 'url', 'url_128', 'download_url', 'permalink_url', 'created_time', 'updated_time'];
export const CHAMPS_CREA = ['id', 'name', 'status', 'account_id', 'object_type', 'body', 'title', 'description', 'display_link', 'link_url', 'image_hash', 'image_url', 'video_id', 'thumbnail_url', 'call_to_action_type', 'object_story_id', 'effective_object_story_id', 'effective_instagram_media_id', 'product_set_id', 'child_attachments'];
// description, display_link, child_attachments ne sont pas des champs Graph de la créa : lus dans object_story_spec
const CREA_DERIVES = ['description', 'display_link', 'child_attachments'];
const CREA_DEFAUT_LISTE = ['id', 'name', 'account_id', 'status', 'body', 'title', 'call_to_action_type'];
/** 28/10/2026 (rapport d'installation 0.4.2, n° 18) : les sous-codes de Meta que le bureau reconnaît, et ce qu'il faut dire au client.
 *  1885183 : la publication de la créa est créée par une app en mode Développement — Meta la refuse (« Invalid parameter »). */
export const EXPLICATIONS = {
  '1885183': "app Meta en mode Développement : Meta refuse une créa publiée par une app qui n'est pas en mode Live. Passer l'app en mode Live (Meta for Developers → l'app → Paramètres de base : URL de politique de confidentialité, icône, catégorie ; puis le bouton « Live »), ou faire la mission par le connecteur Meta Ads de claude.ai. Rien n'a été créé ni dépensé par cet appel."
};
/** LES OUTILS QUI ÉCRIVENT : tout le reste ne fait que des GET. */
export const ECRITURES = new Set(['ads_creative_upload_media', 'ads_create_campaign', 'ads_create_ad_set', 'ads_create_creative', 'ads_create_ad', 'ads_activate_entity', 'ads_update_entity']);

export const OUTILS = [
  { name: 'ads_get_ad_accounts', description: 'Les comptes publicitaires que le jeton voit (lecture). Rend ad_accounts [{ad_account_id, ad_account_name, business_id, business_name, currency, account_status, is_ads_mcp_enabled, is_queryable}] et next_cursor.', inputSchema: schema({ limit: INT, cursor: TXT }) },
  { name: 'ads_get_ad_account_pages', description: 'Les pages Facebook promues sous un compte (lecture). Rend pages [{page_id, page_name}].', inputSchema: schema({ ad_account_id: TXT, limit: INT, cursor: TXT }, ['ad_account_id']) },
  { name: 'ads_get_ad_entities', description: 'Campagnes, ad sets, annonces ou compte, et leurs métriques (lecture). object_state « live » (défaut) ou « draft » (ce serveur ne crée jamais de brouillon : tout naît EN PAUSE). fields, filtering [{field, operator, value[]}], object_ids, limit, cursor, date_preset ou time_range {"since","until"}, sort, level.', inputSchema: schema({ ad_account_id: TXT, level: TXT, fields: LISTE, filtering: { type: 'array', items: { type: 'object', properties: { field: TXT, operator: TXT, value: LISTE }, required: ['field', 'operator', 'value'] } }, object_ids: LISTE, object_state: TXT, limit: INT, cursor: TXT, date_preset: TXT, time_range: TXT, sort: TXT, breakdowns: LISTE, time_increment: TXT, include_additional_context: BOOL }, ['ad_account_id']) },
  { name: 'ads_get_field_context', description: 'Les champs que le bureau lit (table locale) : nom canonique, niveaux, type, filtrable, alias. Sans field_names : toute la table.', inputSchema: schema({ field_names: LISTE }) },
  { name: 'ads_creative_upload_media', description: 'Envoie une image ou une vidéo dans la bibliothèque du compte depuis une adresse PUBLIQUE (upload_source « URL », media_type IMAGE ou VIDEO, media_url, name). Une vidéo revient « processing » : relire avec ads_get_ad_videos.', inputSchema: schema({ ad_account_id: TXT, upload_source: TXT, media_type: TXT, media_url: TXT, name: TXT }, ['ad_account_id', 'upload_source']) },
  { name: 'ads_get_ad_videos', description: 'Les vidéos du compte (lecture). Avec video_ids : id, title, description, length, created_time, updated_time, permalink_url, picture, status.', inputSchema: schema({ ad_account_id: TXT, video_ids: LISTE, fields: LISTE, limit: INT, title: TXT, cursor: TXT }, ['ad_account_id']) },
  // LES QUATRE LECTURES (10/10/2026) : noms ET arguments du connecteur officiel (relevés sur ses schémas), aucun effet de bord
  // (GET seulement), et chaque id passe par la même liste fermée (ID_SUR / cheminSur) que les autres outils
  { name: 'ads_get_ad_images', description: 'Les images du compte (lecture). Sans hashes : hash et name seulement (name filtre, limit, cursor). Avec hashes : fields parmi ' + CHAMPS_IMAGE.join(', ') + ' (download_url seulement s\'il est demandé).', inputSchema: schema({ ad_account_id: TXT, hashes: LISTE, fields: LISTE, limit: INT, name: TXT, cursor: TXT }, ['ad_account_id']) },
  { name: 'ads_get_ig_accounts', description: 'Les comptes Instagram utilisables par le compte publicitaire (lecture), par pages de 25. Rend ig_accounts [{instagram_user_id, username, profile_pic}] et next_cursor.', inputSchema: schema({ ad_account_id: TXT, limit: INT, cursor: TXT }, ['ad_account_id']) },
  { name: 'ads_get_datasets', description: 'Les pixels (datasets) d\'un compte publicitaire OU d\'un business (un seul des deux), lecture. Rend datasets [{dataset_id, name, last_fired_time, creation_time}] et page_info.after_cursor.', inputSchema: schema({ ad_account_id: TXT, business_id: TXT, limit: INT, cursor: TXT }) },
  { name: 'ads_get_creatives', description: 'Les créas du compte (lecture) ; creative_ids pour des créas précises. fields parmi ' + CHAMPS_CREA.join(', ') + '.', inputSchema: schema({ ad_account_id: TXT, creative_ids: LISTE, fields: LISTE, limit: INT, cursor: TXT }, ['ad_account_id']) },
  { name: 'ads_create_campaign', description: 'Crée UNE campagne EN PAUSE. ABO : aucun budget de campagne. CBO : campaign_daily_budget (plus petite unité de la devise) et campaign_bid_strategy. REFUSÉS : campaign_spend_cap, campaign_lifetime_budget, budget_schedule_specs (aucun plafond, aucun budget de vie).', inputSchema: schema({ ad_account_id: TXT, campaign_name: TXT, objective: TXT, buying_type: TXT, campaign_daily_budget: INT, campaign_bid_strategy: TXT, special_ad_categories: TXT, promoted_object: TXT, campaign_start_time: TXT, adlabels: TXT }, ['ad_account_id', 'campaign_name', 'objective', 'buying_type']) },
  { name: 'ads_create_ad_set', description: 'Crée UN ad set EN PAUSE sous une campagne. daily_budget en ABO seulement ; en CBO, daily_min_spend_target (le plancher de l\'ad set, pas un plafond). REFUSÉS : daily_spend_cap, lifetime_spend_cap, lifetime_budget (aucun plafond, aucun budget de vie). targeting en texte JSON.', inputSchema: schema({ ad_account_id: TXT, campaign_id: TXT, ad_set_name: TXT, billing_event: TXT, optimization_goal: TXT, targeting: TXT, daily_budget: INT, daily_min_spend_target: INT, bid_strategy: TXT, bid_amount: INT, promoted_object: TXT, destination_type: TXT, start_time: TXT, attribution_spec: TXT, pacing_type: TXT, is_dynamic_creative: BOOL }, ['ad_account_id', 'campaign_id', 'ad_set_name', 'billing_event', 'optimization_goal', 'targeting']) },
  { name: 'ads_create_creative', description: 'Crée une créa : vidéo (page_id, video_id, image_url ou image_hash pour la vignette, message, headline, description, link_url, call_to_action_type), image (page_id, link_url, image_hash ou image_url…), ou un POST existant (page_id, object_story_id « <page>_<post> », instagram_user_id facultatif). Vidéo avec PLUSIEURS textes (1 à 5 de chaque) : primary_texts, headlines, descriptions — Meta choisit à la diffusion ; message, headline et description sont alors ignorés.', inputSchema: schema({ ad_account_id: TXT, page_id: TXT, name: TXT, video_id: TXT, image_hash: TXT, image_url: TXT, link_url: TXT, message: TXT, headline: TXT, description: TXT, call_to_action_type: TXT, instagram_user_id: TXT, object_story_id: TXT, primary_texts: LISTE, headlines: LISTE, descriptions: LISTE }, ['ad_account_id', 'page_id']) },
  { name: 'ads_create_ad', description: 'Crée UNE annonce EN PAUSE dans un ad set. creative en texte JSON avec exactement une source : creative_id, object_story_id ou object_story_spec. source_ad_id REFUSÉ (aucune duplication).', inputSchema: schema({ ad_account_id: TXT, ad_set_id: TXT, ad_name: TXT, creative: TXT, tracking_specs: TXT, conversion_domain: TXT }, ['ad_account_id', 'ad_set_id', 'ad_name']) },
  { name: 'ads_activate_entity', description: 'Active (PAUSED → ACTIVE) une campagne, un ad set ou une annonce. REFUSÉ sans « porte » : la porte à usage unique que l\'étape d\'activation du bureau donne après « لانسي ». object_ids : d\'autres objets de la même porte à activer dans le même appel.', inputSchema: schema({ ad_account_id: TXT, entity_id: TXT, entity_type: TXT, object_ids: LISTE, publish_as_active: BOOL, porte: TXT }, ['ad_account_id', 'entity_id', 'entity_type']) },
  { name: 'ads_update_entity', description: 'Met à jour une campagne, un ad set ou une annonce. fields (objet JSON) ne peut porter QUE {"status":"PAUSED"} et/ou {"daily_budget": <entier, plus petite unité>} — OU, seul et sur un AD SET seulement, {"start_time":"<date ISO avec fuseau, future, au plus 7 jours>"} avec la « porte » de l\'activation (l\'heure est relue et rendue). Tout autre champ (ACTIVE, plafonds, ciblage, nom…) est refusé.', inputSchema: schema({ ad_account_id: TXT, entity_id: TXT, entity_type: TXT, fields: TXT, porte: TXT }, ['ad_account_id', 'entity_id', 'entity_type', 'fields']) }
];
const NOMS = new Set(OUTILS.map(o => o.name));

/** Le serveur : contexte { fichierConfig, base, portes, journal }. */
/** pause : le fichier d'un TOUR DE PAUSE (missions.mjs, ecrireTicketPause) — pendant ce tour, la seule écriture permise est
 *  ads_update_entity {"status":"PAUSED"} sur les objets de la mission ; aucune activation, aucune création, aucun budget. */
export function creerServeur({ fichierConfig = path.join(ICI, 'config.local.json'), base = GRAPH_META, portes = '', journal = '', pause = '' } = {}) {
  const jetonActuel = () => lireJeton(fichierConfig);
  const noter = (outil, verdict, detail = '') => {
    if (!journal) return;
    const ligne = `${new Date().toISOString()} ${outil} ${verdict}${detail ? ' ' + String(detail).replace(/\s+/g, ' ').slice(0, 600) : ''}`;
    try { fs.mkdirSync(path.dirname(journal), { recursive: true }); fs.appendFileSync(journal, masquer(ligne, jetonActuel()) + '\n'); } catch {}
  };
  const refuser = raison => Object.assign(new Error(raison), { refus: true, code: 'refus', classe: 'refus' });
  const G = (methode, chemin, params) => graph({ jeton: jetonActuel(), base, methode, chemin, params });
  const comptesPermis = () => { const c = lireJSON(fichierConfig) || {}; return (c.comptes || []).map(x => sansAct(x.id)).filter(Boolean); };
  /** Une écriture ne vise que les comptes du client (ceux de ses réglages, quand il y en a). */
  const compteEcriture = id => { const ok = comptesPermis(); if (!sansAct(id)) throw refuser('ad_account_id manquant'); idSur(sansAct(id), 'ad_account_id'); if (ok.length && !ok.includes(sansAct(id))) throw refuser(`compte ${act(id)} hors des comptes du client`); return act(id); };
  const compteLu = id => act(idSur(sansAct(id), 'ad_account_id'));
  /** LES PLAFONDS partout (10/10/2026, « casse ») : à TOUTE profondeur, dans un objet, une liste, ou un texte JSON (même
   *  encodé deux fois), quelle que soit la casse — un « spend_cap » glissé dans targeting, promoted_object, creative… */
  const plafondDans = (o, prof = 0) => {
    if (prof > 8 || o === undefined || o === null) return [];
    if (typeof o === 'string') { const t = o.trim(); if (!/^[[{"]/.test(t)) return []; try { return plafondDans(JSON.parse(t), prof + 1); } catch { return PLAFONDS.filter(k => new RegExp(`["']?${k}["']?\\s*[:=]`, 'i').test(t)); } }
    if (typeof o !== 'object') return [];
    if (Array.isArray(o)) return o.flatMap(x => plafondDans(x, prof + 1));
    const ici = Object.keys(o).filter(k => PLAFONDS.includes(k.toLowerCase().trim()) && o[k] !== undefined && o[k] !== null).map(k => k.toLowerCase().trim());
    return [...ici, ...Object.values(o).flatMap(v => plafondDans(v, prof + 1))];
  };
  /** Un id qui entre dans un CHEMIN Graph : des lettres, chiffres, « _ » et « - », rien d'autre (jamais « / », « ? », « & »). */
  const idSur = (v, quoi) => { const s = String(v ?? '').trim(); if (!ID_SUR.test(s)) throw refuser(`${quoi} illisible : ${s.slice(0, 40) || '(vide)'} (un id Meta, rien d'autre)`); return s; };
  const jsonArg = (v, quoi) => { if (v === undefined || v === null || v === '') return undefined; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { throw refuser(`${quoi} : JSON illisible`); } };
  // 27/10/2026 : une app créée après v26.0 est servie en v26 même épinglée v25.0, et v26 refuse « ids » (#100) : alors un GET par id
  const parIds = async (ids, fields) => {
    ids = (Array.isArray(ids) ? ids : []).map(x => idSur(x, 'id')); if (!ids.length) throw refuser('aucun id à lire');
    try { const j = await G('GET', '', { ids: ids.join(','), fields }); return ids.map(id => j[id]).filter(Boolean); }
    catch (e) { if (!(+e.code === 100 && /ids query parameter is deprecated/i.test(e.message))) throw e; }
    return (await Promise.all(ids.map(id => G('GET', id, { fields })))).filter(Boolean);
  };
  /** Une liste d'arguments (liste, ou texte JSON d'une liste) ; chaque élément une chaîne. */
  const listeArg = (v, quoi) => { if (v === undefined || v === null || v === '') return []; let l = v; if (typeof l === 'string') { try { l = JSON.parse(l); } catch { l = l.split(/[\s,]+/).filter(Boolean); } } if (!Array.isArray(l)) throw refuser(`${quoi} : une liste`); return l.map(x => String(x ?? '').trim()).filter(Boolean); };
  /** Les champs demandés, dans la liste du connecteur ; un autre nom est refusé (rien ne part chez Meta). */
  const champsArg = (v, permis) => { const l = listeArg(v, 'fields'); const hors = l.filter(f => !permis.includes(f)); if (hors.length) throw refuser(`fields refusé(s) : ${hors.join(', ').slice(0, 120)} (permis : ${permis.join(', ')})`); return [...new Set(l)]; };
  const limiteArg = (v, defaut, maxi) => { const n = Math.floor(+v); return Number.isFinite(n) && n > 0 ? Math.min(n, maxi) : defaut; };
  const curseurArg = v => (v === undefined || v === null || v === '' ? undefined : String(v).slice(0, 512));
  const suivant = j => (j.paging?.next ? j.paging?.cursors?.after || null : null);

  const FAIRE = {
    async ads_get_ad_accounts(a) {
      const j = await G('GET', 'me/adaccounts', { fields: 'account_id,name,currency,account_status,business{id,name}', limit: limiteArg(a.limit, 50, 100), after: curseurArg(a.cursor) });
      return { ad_accounts: (j.data || []).map(x => ({ ad_account_id: x.account_id || sansAct(x.id), ad_account_name: x.name || '', business_id: x.business?.id || '', business_name: x.business?.name || '', currency: x.currency || '', account_status: x.account_status ?? null, is_ads_mcp_enabled: true, is_queryable: true })), next_cursor: j.paging?.next ? j.paging?.cursors?.after || null : null };
    },
    async ads_get_ad_account_pages(a) {
      const j = await G('GET', `${compteLu(a.ad_account_id)}/promote_pages`, { fields: 'id,name', limit: limiteArg(a.limit, 50, 100), after: curseurArg(a.cursor) });
      return { pages: (j.data || []).map(p => ({ page_id: p.id, page_name: p.name || '' })), next_cursor: j.paging?.next ? j.paging?.cursors?.after || null : null };
    },
    async ads_get_ad_entities(a) {
      if (String(a.object_state || 'live') === 'draft') return { ad_drafts: [], next_cursor: null, note: 'ce serveur ne crée jamais de brouillon : tout ce qu\'il crée est publié EN PAUSE (lis object_state « live »)' };
      const niveau = String(a.level || 'campaign').replace(/^account$/, 'ad_account');
      const voulus = champsArg(a.fields, CHAMPS_ENTITE);
      const demandes = voulus.length ? voulus : ['id', 'name', 'amount_spent'];
      if (a.date_preset !== undefined && a.date_preset !== null && a.date_preset !== '' && !PERIODES.includes(String(a.date_preset))) throw refuser(`date_preset refusé : ${String(a.date_preset).slice(0, 40)} (permis : ${PERIODES.join(', ')})`);
      const attrs = new Set(['id']), metriques = new Map();
      for (const f of demandes) { const c = CHAMPS.find(x => x.name === f || x.aliases.includes(f)); if (c && c.metric) metriques.set(c.name, METRIQUES.get(c.name)); else attrs.add(f); }
      let tr = null; if (a.time_range) { tr = jsonArg(a.time_range, 'time_range'); if (!tr || typeof tr !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(tr.since)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(tr.until))) throw refuser('time_range : {"since":"AAAA-MM-JJ","until":"AAAA-MM-JJ"}'); }
      const periode = tr ? `.time_range(${JSON.stringify({ since: tr.since, until: tr.until })})` : `.date_preset(${a.date_preset || 'maximum'})`;
      const champs = [...attrs, ...(metriques.size ? [`insights${periode}{${[...new Set(metriques.values())].join(',')}}`] : [])].join(',');
      const aplatir = o => {
        const r = { ...o }; const ins = o.insights?.data?.[0]; delete r.insights;
        for (const [nom, g] of metriques) r[nom] = ins ? (ins[g] ?? null) : (nom === 'amount_spent' ? '0' : null);
        return r;
      };
      if (niveau === 'ad_account') { const j = await G('GET', compteLu(a.ad_account_id), { fields: champs }); return { ad_entities: [aplatir(j)] }; }
      const arete = { campaign: 'campaigns', adset: 'adsets', ad_set: 'adsets', ad: 'ads' }[niveau];
      if (!arete) throw refuser(`level inconnu : ${niveau}`);
      if (Array.isArray(a.object_ids) && a.object_ids.length) return { ad_entities: (await parIds(a.object_ids, champs)).map(aplatir) };
      const params = { fields: champs, limit: limiteArg(a.limit, 100, 1000), after: curseurArg(a.cursor) };
      // LE FILTRE (10/10/2026, « casse ») : le connecteur prend value en LISTE ; Graph veut une valeur seule pour CONTAIN,
      // EQUAL… et une liste pour IN, NOT_IN. Envoyé tel quel, la recherche de la clé d'un test (« cherche la clé, ne crée pas
      // de deuxième campagne ») pouvait échouer après un #190 en pleine création → une deuxième campagne. Converti ; et si Graph
      // refuse quand même le filtre (#100), le serveur lit les objets du compte et filtre LUI-MÊME (jamais « aucune » à tort).
      const filtres = (Array.isArray(a.filtering) ? a.filtering : (jsonArg(a.filtering, 'filtering') || [])).filter(f => f && f.field && f.operator).map(f => {
        // le nom du champ filtré repart dans « fields » (filtre local) : un nom simple seulement, jamais une expansion
        if (!/^[a-z][a-z0-9_]{0,40}(\.[a-z][a-z0-9_]{0,40}){0,2}$/.test(String(f.field))) throw refuser(`filtering : champ illisible ${String(f.field).slice(0, 40)}`);
        const op = String(f.operator).toUpperCase(), liste = /^(IN|NOT_IN|ANY|ALL|NONE)$/.test(op);
        if (!/^[A-Z_]{2,20}$/.test(op)) throw refuser(`filtering : opérateur illisible ${op.slice(0, 20)}`);
        const v = Array.isArray(f.value) ? f.value : [f.value];
        return { field: String(f.field), operator: op, value: liste ? v.map(x => String(x ?? '')) : String(v[0] ?? '') };
      });
      if (filtres.length) params.filtering = filtres;
      const chemin = `${compteLu(a.ad_account_id)}/${arete}`;
      let j;
      try { j = await G('GET', chemin, params); }
      catch (e) {
        if (!filtres.length || e.refus || +e.code !== 100) throw e;
        const nom = f => f.field.split('.').pop();
        const garde = o => filtres.every(f => {
          const s = String(o[nom(f)] ?? ''), vals = Array.isArray(f.value) ? f.value : [f.value];
          switch (f.operator) {
            case 'CONTAIN': return s.toLowerCase().includes(String(f.value).toLowerCase());
            case 'NOT_CONTAIN': return !s.toLowerCase().includes(String(f.value).toLowerCase());
            case 'EQUAL': return s === String(f.value);
            case 'NOT_EQUAL': return s !== String(f.value);
            case 'IN': return vals.includes(s);
            case 'NOT_IN': return !vals.includes(s);
            default: return true;
          }
        });
        const tous = []; let apres;
        for (let page = 0; page < 10; page++) {
          const x = await G('GET', chemin, { fields: [champs, ...new Set(filtres.map(nom).filter(n => !attrs.has(n)))].join(','), limit: 500, after: apres });
          tous.push(...(x.data || []));
          apres = x.paging?.next ? x.paging?.cursors?.after : null; if (!apres) break;
        }
        return { ad_entities: tous.filter(garde).map(aplatir), pagination: { next_cursor: null }, note: `filtre refusé par Graph (#100) : filtré par le serveur local sur ${tous.length} objet(s) du compte` };
      }
      return { ad_entities: (j.data || []).map(aplatir), pagination: { next_cursor: j.paging?.next ? j.paging?.cursors?.after || null : null } };
    },
    async ads_get_field_context(a) {
      const voulus = Array.isArray(a.field_names) ? a.field_names.map(String) : [];
      if (!voulus.length) return { fields: CHAMPS, unknown_fields: [] };
      const fields = [], unknown_fields = [];
      for (const n of voulus) { const c = CHAMPS.find(x => x.name === n || x.aliases.includes(n)); if (c) fields.push(c); else unknown_fields.push(n); }
      return { fields, unknown_fields };
    },
    async ads_creative_upload_media(a) {
      if (String(a.upload_source || '').toUpperCase() !== 'URL') throw refuser('upload_source « URL » seulement (aucun fichier local par ce serveur)');
      const u = String(a.media_url || ''); if (!/^https?:\/\//i.test(u)) throw refuser('media_url : une adresse publique http(s)');
      const compte = compteEcriture(a.ad_account_id);
      if (String(a.media_type || '').toUpperCase() === 'VIDEO') {
        const j = await G('POST', `${compte}/advideos`, { file_url: u, name: a.name || undefined, title: a.name || undefined });
        return { result_kind: 'URL_VIDEO', video_id: String(j.id || ''), status: 'processing', title: a.name || '' };
      }
      if (String(a.media_type || '').toUpperCase() !== 'IMAGE') throw refuser('media_type : IMAGE ou VIDEO');
      const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw refuser(`image illisible à l'adresse (${r.status})`);
      const b = Buffer.from(await r.arrayBuffer()); if (b.length > 30e6) throw refuser('image de plus de 30 Mo');
      const j = await G('POST', `${compte}/adimages`, { bytes: b.toString('base64'), name: a.name || undefined });
      const img = Object.values(j.images || {})[0] || {};
      return { result_kind: 'URL_IMAGE', image_hash: img.hash || '', url: img.url || '', name: a.name || '' };
    },
    async ads_get_ad_videos(a) {
      if (Array.isArray(a.video_ids) && a.video_ids.length) {
        const f = (Array.isArray(a.fields) && a.fields.length ? a.fields.filter(x => ATTR_VIDEO.includes(x) || x === 'download_hd_url').map(x => (x === 'download_hd_url' ? 'source' : x)) : ATTR_VIDEO);
        return { videos: (await parIds(a.video_ids, [...new Set(['id', ...f])].join(','))).map(v => { const o = { ...v }; if (o.source !== undefined) { o.download_hd_url = o.source; delete o.source; } return o; }) };
      }
      const j = await G('GET', `${compteLu(a.ad_account_id)}/advideos`, { fields: 'id,title', limit: limiteArg(a.limit, 25, 100), after: curseurArg(a.cursor) });
      return { videos: (j.data || []).filter(v => !a.title || String(v.title || '').toLowerCase().includes(String(a.title).toLowerCase())), next_cursor: j.paging?.next ? j.paging?.cursors?.after || null : null };
    },
    async ads_get_ad_images(a) {
      const chemin = `${compteLu(a.ad_account_id)}/adimages`;
      const hashes = listeArg(a.hashes, 'hashes').map(h => idSur(h, 'hash'));
      if (hashes.length) {
        const voulus = champsArg(a.fields, CHAMPS_IMAGE); const montrer = voulus.length ? [...new Set(['hash', ...voulus])] : CHAMPS_IMAGE.filter(f => f !== 'download_url');
        // Graph n'a pas de « download_url » : l'image entière est son « url »
        const j = await G('GET', chemin, { hashes, fields: [...new Set(montrer.map(f => (f === 'download_url' ? 'url' : f)))].join(',') });
        return { images: (j.data || []).map(x => Object.fromEntries(montrer.map(f => [f, f === 'download_url' ? x.url ?? null : x[f] ?? null]))) };
      }
      const j = await G('GET', chemin, { fields: 'hash,name', limit: limiteArg(a.limit, 25, 100), after: curseurArg(a.cursor) });
      const nom = String(a.name || '').toLowerCase();
      return { images: (j.data || []).filter(x => !nom || String(x.name || '').toLowerCase().includes(nom)).map(x => ({ hash: x.hash, name: x.name || '' })), next_cursor: suivant(j) };
    },
    async ads_get_ig_accounts(a) {
      const j = await G('GET', `${compteLu(a.ad_account_id)}/instagram_accounts`, { fields: 'id,username,profile_pic', limit: limiteArg(a.limit, 25, 100), after: curseurArg(a.cursor) });
      return { ig_accounts: (j.data || []).map(x => ({ instagram_user_id: x.id, username: x.username || '', profile_pic: x.profile_pic || null })), next_cursor: suivant(j) };
    },
    async ads_get_datasets(a) {
      const parCompte = a.ad_account_id !== undefined && a.ad_account_id !== null && a.ad_account_id !== '', parBusiness = a.business_id !== undefined && a.business_id !== null && a.business_id !== '';
      if (parCompte === parBusiness) throw refuser('ads_get_datasets : ad_account_id OU business_id (un seul des deux)');
      const chemin = parCompte ? `${compteLu(a.ad_account_id)}/adspixels` : `${idSur(a.business_id, 'business_id')}/owned_pixels`;
      const j = await G('GET', chemin, { fields: 'id,name,last_fired_time,creation_time', limit: limiteArg(a.limit, 25, 100), after: curseurArg(a.cursor) });
      const apres = suivant(j);
      return { datasets: (j.data || []).map(x => ({ dataset_id: x.id, name: x.name || '', last_fired_time: x.last_fired_time || null, creation_time: x.creation_time || null })), page_info: { after_cursor: apres }, next_cursor: apres };
    },
    async ads_get_creatives(a) {
      const compte = compteLu(a.ad_account_id);
      const ids = listeArg(a.creative_ids, 'creative_ids');
      const voulus = champsArg(a.fields, CHAMPS_CREA);
      const montrer = voulus.length ? [...new Set(['id', ...voulus])] : ids.length ? CHAMPS_CREA : CREA_DEFAUT_LISTE;
      const graphF = [...new Set(montrer.filter(f => !CREA_DERIVES.includes(f)).concat(montrer.some(f => CREA_DERIVES.includes(f)) ? ['object_story_spec'] : []))].join(',');
      const forme = x => {
        const spec = x.object_story_spec || {}, ld = spec.link_data || {}, vd = spec.video_data || {};
        const derive = { description: ld.description ?? vd.link_description ?? null, display_link: ld.caption ?? null, child_attachments: ld.child_attachments ?? null };
        return Object.fromEntries(montrer.map(f => [f, CREA_DERIVES.includes(f) ? derive[f] : x[f] ?? null]));
      };
      if (ids.length) return { creatives: (await parIds(ids, graphF)).map(forme) };
      const j = await G('GET', `${compte}/adcreatives`, { fields: graphF, limit: limiteArg(a.limit, 25, 100), after: curseurArg(a.cursor) });
      return { creatives: (j.data || []).map(forme), next_cursor: suivant(j) };
    },
    async ads_create_campaign(a) {
      const compte = compteEcriture(a.ad_account_id);
      const p = { name: a.campaign_name, objective: a.objective, buying_type: a.buying_type || 'AUCTION', status: 'PAUSED', special_ad_categories: a.special_ad_categories ? jsonArg(a.special_ad_categories, 'special_ad_categories') : [] };
      if (a.campaign_daily_budget !== undefined && a.campaign_daily_budget !== null) { p.daily_budget = +a.campaign_daily_budget; p.bid_strategy = a.campaign_bid_strategy || 'LOWEST_COST_WITHOUT_CAP'; }
      else { if (a.campaign_bid_strategy) throw refuser('campaign_bid_strategy sans budget de campagne (ABO : la stratégie va sur l\'ad set)'); p.is_adset_budget_sharing_enabled = false; }
      if (a.promoted_object) p.promoted_object = jsonArg(a.promoted_object, 'promoted_object');
      // [relecture] 10/10/2026 : l'heure de début ne se pose JAMAIS à la création (ni sur une campagne) : seulement sur un ad
      // set, par ads_update_entity, avec la porte « لانسي » (liste fermée, futur, sept jours au plus)
      if (a.campaign_start_time) throw refuser('campaign_start_time : l\'heure de début ne se pose que sur un ad set, par ads_update_entity avec la porte « لانسي »');
      if (a.adlabels) p.adlabels = jsonArg(a.adlabels, 'adlabels');
      const j = await G('POST', `${compte}/campaigns`, p);
      return { campaign_id: String(j.id || ''), id: String(j.id || ''), status: 'PAUSED', name: a.campaign_name };
    },
    async ads_create_ad_set(a) {
      const compte = compteEcriture(a.ad_account_id);
      const p = { name: a.ad_set_name, campaign_id: a.campaign_id, billing_event: a.billing_event, optimization_goal: a.optimization_goal, targeting: jsonArg(a.targeting, 'targeting'), status: 'PAUSED' };
      for (const k of ['daily_budget', 'bid_amount', 'daily_min_spend_target']) if (a[k] !== undefined && a[k] !== null) p[k] = +a[k];
      if (a.start_time) throw refuser('start_time à la création : l\'heure de début ne se pose que par ads_update_entity avec la porte « لانسي »'); // [relecture]
      for (const k of ['bid_strategy', 'destination_type']) if (a[k]) p[k] = a[k];
      for (const k of ['promoted_object', 'attribution_spec', 'pacing_type']) if (a[k]) p[k] = jsonArg(a[k], k);
      if (a.is_dynamic_creative !== undefined) p.is_dynamic_creative = !!a.is_dynamic_creative;
      const j = await G('POST', `${compte}/adsets`, p);
      return { ad_set_id: String(j.id || ''), id: String(j.id || ''), status: 'PAUSED', name: a.ad_set_name };
    },
    async ads_create_creative(a) {
      const compte = compteEcriture(a.ad_account_id);
      const p = { name: a.name || undefined };
      if (a.object_story_id) {
        if (!String(a.object_story_id).startsWith(String(a.page_id) + '_')) throw refuser('object_story_id : la page du post doit être page_id');
        p.object_story_id = a.object_story_id; if (a.instagram_user_id) p.instagram_user_id = a.instagram_user_id;
      } else {
        const cta = a.call_to_action_type ? { type: a.call_to_action_type, ...(a.link_url ? { value: { link: a.link_url } } : a.call_to_action_type === 'MESSAGE_PAGE' ? { value: { app_destination: 'MESSENGER' } } : {}) } : (a.link_url ? { type: 'LEARN_MORE', value: { link: a.link_url } } : undefined);
        const spec = { page_id: a.page_id, ...(a.instagram_user_id ? { instagram_user_id: a.instagram_user_id } : {}) };
        // 28/10/2026 (décision du vendeur : le TEST porte les cinq textes, un par angle) : une vidéo et 1 à 5 textes de chaque
        // → asset_feed_spec (Meta choisit à la diffusion) ; sans ces listes, la créa d'avant, inchangée
        const variantes = { bodies: listeArg(a.primary_texts, 'primary_texts'), titles: listeArg(a.headlines, 'headlines'), descriptions: listeArg(a.descriptions, 'descriptions') };
        if (Object.values(variantes).some(l => l.length)) {
          if (!a.video_id) throw refuser('primary_texts, headlines, descriptions : seulement avec une vidéo (video_id)');
          for (const [k, l] of Object.entries(variantes)) if (l.length > 5) throw refuser(`${k} : cinq textes au plus (${l.length})`);
          p.object_story_spec = spec;
          p.asset_feed_spec = { videos: [{ video_id: a.video_id, ...(a.image_hash ? { thumbnail_hash: a.image_hash } : a.image_url ? { thumbnail_url: a.image_url } : {}) }],
            ...Object.fromEntries(Object.entries(variantes).filter(([, l]) => l.length).map(([k, l]) => [k, l.map(text => ({ text }))])),
            ...(a.link_url ? { link_urls: [{ website_url: a.link_url }] } : {}), ...(cta ? { call_to_action_types: [cta.type] } : {}),
            ad_formats: ['SINGLE_VIDEO'], optimization_type: 'DEGREES_OF_FREEDOM' };
          const j = await G('POST', `${compte}/adcreatives`, p);
          return { creative_id: String(j.id || ''), id: String(j.id || '') };
        }
        if (a.video_id) spec.video_data = { video_id: a.video_id, ...(a.image_hash ? { image_hash: a.image_hash } : a.image_url ? { image_url: a.image_url } : {}), message: a.message, title: a.headline, ...(a.description && a.link_url ? { link_description: a.description } : {}), ...(cta ? { call_to_action: cta } : {}) };
        else { if (!a.link_url) throw refuser('une créa image demande link_url'); spec.link_data = { link: a.link_url, message: a.message, name: a.headline, description: a.description, ...(a.image_hash ? { image_hash: a.image_hash } : a.image_url ? { picture: a.image_url } : {}), ...(cta ? { call_to_action: cta } : {}) }; }
        p.object_story_spec = spec;
      }
      const j = await G('POST', `${compte}/adcreatives`, p);
      return { creative_id: String(j.id || ''), id: String(j.id || '') };
    },
    async ads_create_ad(a) {
      const compte = compteEcriture(a.ad_account_id);
      const cr = jsonArg(a.creative, 'creative'); if (!cr || typeof cr !== 'object') throw refuser('creative requis (creative_id, object_story_id ou object_story_spec)');
      const sources = ['creative_id', 'object_story_id', 'object_story_spec'].filter(k => cr[k] !== undefined);
      if (sources.length !== 1) throw refuser('creative : exactement une source (creative_id, object_story_id ou object_story_spec)');
      const p = { name: a.ad_name, adset_id: a.ad_set_id, creative: cr, status: 'PAUSED' };
      if (a.tracking_specs) p.tracking_specs = jsonArg(a.tracking_specs, 'tracking_specs');
      if (a.conversion_domain) p.conversion_domain = a.conversion_domain;
      const j = await G('POST', `${compte}/ads`, p);
      return { ad_id: String(j.id || ''), id: String(j.id || ''), status: 'PAUSED', name: a.ad_name };
    },
    async ads_activate_entity(a) {
      compteEcriture(a.ad_account_id);
      let lot = a.object_ids; if (typeof lot === 'string') { try { lot = JSON.parse(lot); } catch { lot = lot.split(/[\s,;]+/).filter(Boolean); } }
      const ids = [...new Set([a.entity_id, ...(Array.isArray(lot) ? lot : [])].filter(x => x !== undefined && x !== null && String(x).trim()).map(x => idSur(x, 'entity_id')))];
      if (!ids.length) throw refuser('entity_id manquant');
      const p = passerPorte(portes, a.porte, ids);
      if (!p.ok) throw refuser(p.raison);
      const faits = [];
      for (const id of ids) { const j = await G('POST', id, { status: 'ACTIVE' }); faits.push({ entity_id: id, success: j.success !== false }); }
      return { success: faits.every(f => f.success), entities: faits, mission: p.mission, note: 'statut demandé ACTIVE : relis avec ads_get_ad_entities (effective_status) pour le statut réel' };
    },
    async ads_update_entity(a) {
      compteEcriture(a.ad_account_id);
      const f = jsonArg(a.fields, 'fields'); if (!f || typeof f !== 'object' || Array.isArray(f)) throw refuser('fields : un objet JSON');
      const cles = Object.keys(f); if (!cles.length) throw refuser('fields vide');
      // [porte-groupee] L'HEURE DE DÉBUT : liste fermée — le seul champ start_time, un ad set de la porte, futur, ≤ 7 jours, relu
      if (cles.includes('start_time')) {
        if (cles.length !== 1) throw refuser(`start_time doit être SEUL dans fields (reçu : ${cles.join(', ')}) : ni budget, ni status avec lui`);
        if (!/^(adset|ad_set)$/i.test(String(a.entity_type || '').trim())) throw refuser(`start_time refusé sur ${String(a.entity_type || '?').slice(0, 20)} : un ad set seulement`);
        const id = idSur(a.entity_id, 'entity_id');
        const c = porteCouvreAdSet(portes, a.porte, id); if (!c.ok) throw refuser(c.raison);
        const v = startTimeValide(f.start_time); if (!v.ok) throw refuser(v.raison);
        const j = await G('POST', id, { start_time: v.graph });
        const lu = await G('GET', id, { fields: 'id,start_time,effective_status' });
        return { success: j.success !== false, id, start_time: lu.start_time ?? null, demande: v.graph, relu: { id: lu.id ?? id, start_time: lu.start_time ?? null, effective_status: lu.effective_status ?? null }, mission: c.mission };
      }
      const autres = cles.filter(k => !['status', 'daily_budget'].includes(k));
      if (autres.length) throw refuser(`champ(s) refusé(s) : ${autres.join(', ')} (seuls status PAUSED et daily_budget passent)`);
      if (f.status !== undefined && String(f.status).toUpperCase() !== 'PAUSED') throw refuser(`status ${f.status} refusé : ce serveur ne pose que PAUSED (l'activation passe par la porte)`);
      if (f.daily_budget !== undefined && !(Number.isInteger(+f.daily_budget) && +f.daily_budget > 0)) throw refuser('daily_budget : un entier positif (plus petite unité de la devise)');
      const p = {}; if (f.status !== undefined) p.status = 'PAUSED'; if (f.daily_budget !== undefined) p.daily_budget = +f.daily_budget;
      const id = idSur(a.entity_id, 'entity_id');
      const j = await G('POST', id, p);
      return { success: j.success !== false, id, ...p };
    }
  };

  /** Un appel d'outil : { content:[{type:'text', text}], isError }. Rien de ce qui sort ne porte le jeton. */
  async function appeler(nom, a = {}) {
    const jeton = jetonActuel();
    const sortir = (obj, isError = false) => ({ content: [{ type: 'text', text: masquer(JSON.stringify(obj), jeton) }], isError });
    if (!NOMS.has(nom)) { noter(nom, 'REFUS', 'outil inconnu ou interdit'); return sortir({ error: { code: 'refus', manita: 'refus', message: `outil ${nom} absent de ce serveur` } }, true); }
    a = a && typeof a === 'object' ? a : {};
    try {
      const plaf = [...plafondDans(a), ...(nom === 'ads_update_entity' ? plafondDans(jsonArg(a.fields, 'fields') || {}) : [])];
      if (plaf.length) throw refuser(`plafond refusé (${[...new Set(plaf)].join(', ')}) : aucun plafond de dépense, aucun budget de vie`);
      if (nom === 'ads_create_ad' && a.source_ad_id) throw refuser('source_ad_id refusé : aucune duplication');
      // LE TOUR DE PAUSE (10/10/2026, pause symétrique) : seulement status PAUSED, seulement sur les objets de la mission
      if (pause && ECRITURES.has(nom)) {
        const t = lireJSON(pause);
        if (!t || !Array.isArray(t.ids)) throw refuser('tour de PAUSE : ticket illisible, aucune écriture');
        if (nom !== 'ads_update_entity') throw refuser(`tour de PAUSE : ${nom} refusé (seule la mise en pause passe, aucune activation ni création)`);
        const f = jsonArg(a.fields, 'fields');
        if (!f || typeof f !== 'object' || Array.isArray(f) || Object.keys(f).join() !== 'status' || String(f.status).toUpperCase() !== 'PAUSED') throw refuser('tour de PAUSE : fields doit être exactement {"status":"PAUSED"}');
        const id = idSur(a.entity_id, 'entity_id');
        if (!t.ids.map(String).includes(id)) throw refuser(`tour de PAUSE : ${id} hors des objets de la mission ${t.mission || '?'}`);
      }
      const r = await FAIRE[nom](a);
      const resume = { ...a }; for (const k of ['advertiser_request', 'client_conversation_id', 'client_model', 'porte']) delete resume[k];
      noter(nom, 'OK', JSON.stringify(resume).slice(0, 300));
      return sortir(r);
    } catch (e) {
      const classe = e.refus ? 'refus' : e.classe || 'meta';
      noter(nom, e.refus ? 'REFUS' : 'ERREUR', `${e.code !== undefined ? '(#' + e.code + ') ' : ''}${e.message}`);
      return sortir({ error: { code: e.code ?? null, error_subcode: e.sous_code ?? null, type: e.type || (e.refus ? 'manita' : 'meta'), manita: classe, message: masquer(e.message, jeton), ...(EXPLICATIONS[String(e.sous_code)] ? { explication: EXPLICATIONS[String(e.sous_code)] } : {}) } }, true);
    }
  }

  /** Un message JSON-RPC → la réponse (ou null pour une notification). */
  async function traiter(msg) {
    const { id, method, params } = msg || {};
    const rep = result => ({ jsonrpc: '2.0', id, result });
    const err = (code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
    if (id === undefined || id === null) return null; // notifications (notifications/initialized…)
    if (method === 'initialize') return rep({ protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: NOM_SERVEUR, version: `0.3.8-graph-${VERSION_GRAPH}` } });
    if (method === 'ping') return rep({});
    if (method === 'tools/list') return rep({ tools: OUTILS });
    if (method === 'tools/call') return rep(await appeler(params?.name, params?.arguments));
    return err(-32601, `méthode inconnue : ${method}`);
  }
  return { traiter, appeler, outils: OUTILS };
}

/** Le chemin LOCAL d'un tour (serveur.mjs claudeChaine) : la liste logique de l'étape gardée aux outils que CE serveur offre
 *  (« meta.ads_get_help_article » n'existe pas ici), les autres connecteurs inchangés. */
export function outilsDuCheminLocal(outils) { return (outils || []).filter(o => !String(o).startsWith('meta.') || NOMS.has(String(o).slice(5))); }
/** Un refus de Meta rendu par CE serveur pendant un tour (#190 → « jeton », #200/#10 → « droits ») : la classe, ou null. */
export function refusPendantTour(appels) {
  for (const a of appels || []) if (String(a.nom || '').startsWith(PREFIXE)) { const x = /"manita"\s*:\s*"(jeton|droits)"/.exec(String(a.sortie || '')); if (x) return x[1]; }
  return null;
}

/** CE QUI ARRÊTE un tour local (10/10/2026, « casse ») : un jeton refusé (#190) arrête toujours (connecteur à reconnecter). Un
 *  refus de DROITS (#200, #10) sur un objet du tour (le pixel, la page, le compte Instagram) n'est PAS un jeton mort : si la
 *  lecture réelle (GET /me + le compte) repasse, le tour garde son résultat (Claude a rendu l'erreur brute) — sinon chaque
 *  reprise retombait sur le même refus, en boucle, et le client lisait « التوكن ما بقاش يخدم » pour un pixel pas partagé.
 *  relire : async () => { ok }. Rend 'jeton' | 'droits' | null. */
export async function refusQuiArrete(appels, relire) {
  const r = refusPendantTour(appels);
  if (r !== 'droits') return r;
  try { return (await relire())?.ok ? null : 'droits'; } catch { return 'droits'; }
}

/** LE TICKET D'UN TOUR DE PAUSE (missions.mjs) : la mission et SES objets ; le serveur, lancé avec --pause, ne laisse passer
 *  que {"status":"PAUSED"} sur ces ids. Rend le chemin du fichier (effacé après le tour par effacerTicketPause). */
export function ecrireTicketPause(dossier, { mission, ids }) {
  fs.mkdirSync(dossier, { recursive: true });
  const f = path.join(dossier, crypto.randomBytes(16).toString('hex') + '.json'), t = f + '.tmp';
  fs.writeFileSync(t, JSON.stringify({ mission: String(mission), ids: [...new Set((ids || []).filter(x => x !== undefined && x !== null).map(String))], creeLe: new Date().toISOString() }));
  fs.renameSync(t, f);
  return f;
}
export function effacerTicketPause(f) { if (f && /[a-f0-9]{32}\.json$/.test(String(f))) { try { fs.unlinkSync(f); } catch {} } }

/** L'INSTALLATION SUR LE JETON (10/10/2026, décision du coordinateur) : les lectures d'installation (comptes et pages, clés
 *  des wilayas) passent par CE serveur, en direct (aucun tour de Claude), avec le jeton de التحضير — les mêmes outils, la
 *  même liste fermée. Chaque appel rend { nom, entree, sortie (texte BRUT), erreur, obj } : la 2e méthode relit le brut.
 *  Un refus de Meta lève une erreur dont la classe dit lequel (jeton / droits / meta / refus) — jamais de repli silencieux. */
export function cheminJeton({ fichierConfig, base = GRAPH_META, journal = '' }) {
  const srv = creerServeur({ fichierConfig, base, journal });
  const appels = [];
  const lire = async (nom, args) => {
    const r = await srv.appeler(nom, args); const sortie = r.content[0].text; let obj = null; try { obj = JSON.parse(sortie); } catch {}
    const a = { nom: PREFIXE + nom, entree: args, sortie, erreur: !!r.isError, obj }; appels.push(a);
    if (r.isError) { const e = obj?.error || {}; const classe = ['jeton', 'droits', 'refus'].includes(e.manita) ? e.manita : 'meta'; throw Object.assign(new Error(`${REFUS_SONDE[classe] || 'refus'} — ${nom} (#${e.code ?? '?'}) ${String(e.message || '').slice(0, 200)}`), { classe, appels }); }
    return obj;
  };
  return {
    appeler: srv.appeler, appels, lire,
    /** Les comptes pub du jeton et les pages promues de chacun. */
    async comptesEtPages() {
      const a = await lire('ads_get_ad_accounts', { limit: 100 });
      const comptes = (a.ad_accounts || []).filter(x => x.ad_account_id).map(x => ({ id: act(x.ad_account_id), nom: x.ad_account_name || '', devise: x.currency || '', statut: String(x.account_status ?? ''), mcp_ok: true }));
      const pages = new Map();
      // 28/10/2026 (rapport d'installation 0.4.2, n° 2) : d'abord les pages ATTRIBUÉES à l'utilisateur (système) du jeton, par
      //   me/accounts (promote_pages est vide pour un compte qui n'a jamais promu de page). Lu ICI, en direct, seulement pour
      //   l'installation : aucun outil de plus pour Claude. Champs id,name seulement (jamais le jeton d'une page). Un refus de
      //   DROITS (pages_show_list absent) n'arrête rien : il reste dans « appels », les pages promues suivent.
      { let apres, n = 0; do {
          const entree = { fields: 'id,name', limit: 100, ...(apres ? { after: apres } : {}) }; let j;
          try { j = await graph({ jeton: lireJeton(fichierConfig), base, methode: 'GET', chemin: 'me/accounts', params: entree }); }
          catch (e) { appels.push({ nom: PREFIXE + 'me/accounts', entree, sortie: JSON.stringify({ error: { code: e.code ?? null, manita: e.classe || 'meta', message: masquer(e.message, lireJeton(fichierConfig)) } }), erreur: true, obj: null }); if (e.classe !== 'droits') throw Object.assign(new Error(`${REFUS_SONDE[e.classe] || 'refus'} — me/accounts (#${e.code ?? '?'}) ${String(e.message || '').slice(0, 200)}`), { classe: e.classe || 'meta', appels }); break; }
          const obj = { pages: (j.data || []).map(p => ({ page_id: p.id, page_name: p.name || '' })) };
          appels.push({ nom: PREFIXE + 'me/accounts', entree, sortie: masquer(JSON.stringify(obj), lireJeton(fichierConfig)), erreur: false, obj });
          for (const x of obj.pages) if (x.page_id && !pages.has(String(x.page_id))) pages.set(String(x.page_id), { id: String(x.page_id), nom: x.page_name });
          apres = j.paging?.next ? j.paging?.cursors?.after || null : null; n++;
        } while (apres && n < 10); }
      for (const c of comptes) { const p = await lire('ads_get_ad_account_pages', { ad_account_id: sansAct(c.id), limit: 100 }); for (const x of p.pages || []) if (x.page_id && !pages.has(String(x.page_id))) pages.set(String(x.page_id), { id: String(x.page_id), nom: x.page_name || '' }); }
      return { comptes, pages: [...pages.values()], appels };
    },
    /** [v19-trois] Les PIXELS de chaque compte (ads_get_datasets par compte, toutes les pages, en lecture) : un compte dont la
     *  lecture est refusée (droits) n'arrête pas l'installation — ses pixels restent « non lus » (le bureau relit le brut :
     *  missions.mjs pixelsDuBrut). Rend { lus: [ids des comptes lus], refus: [{compte, raison}], appels }. */
    async pixelsDesComptes(comptes) {
      const lus = [], refus = [];
      for (const c of comptes || []) {
        const id = sansAct(c && c.id !== undefined ? c.id : c); if (!id) continue;
        try { let curseur, n = 0; do { const r = await lire('ads_get_datasets', { ad_account_id: id, limit: 100, ...(curseur ? { cursor: curseur } : {}) }); curseur = r && r.next_cursor; n++; } while (curseur && n < 10); lus.push(id); }
        catch (e) { refus.push({ compte: id, raison: String(e.message || e).slice(0, 160) }); }
      }
      return { lus, refus, appels };
    },
    /** Le ciblage des ad sets de chaque compte (les clés de région se relisent dans le brut : missions.mjs recouperRegions). */
    async adSetsCiblage(comptes) {
      for (const c of comptes || []) await lire('ads_get_ad_entities', { ad_account_id: sansAct(c), level: 'adset', fields: ['id', 'targeting'], limit: 500 });
      return { appels };
    }
  };
}

/** Le fichier --mcp-config d'un tour (SANS secret : la commande, le script, des chemins ; jamais le jeton). */
export function configMcp({ node = process.execPath, script = fileURLToPath(import.meta.url), config, portes, journal, graph: g, pause = '' }) {
  const args = [script, '--config', config, '--portes', portes, '--journal', journal];
  if (pause) args.push('--pause', pause);
  if (g && g !== GRAPH_META) args.push('--graph', g);
  return { mcpServers: { [NOM_SERVEUR]: { type: 'stdio', command: node, args } } };
}

/* ------------------------------------------------ lancé directement : la boucle stdio ------------------------------------------------ */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = argsDe(process.argv.slice(2));
  let base;
  try { base = baseGraph(o.graph); } catch (e) { process.stderr.write(e.message + '\n'); process.exit(2); }
  const srv = creerServeur({ fichierConfig: o.config ? path.resolve(o.config) : path.join(ICI, 'config.local.json'), base, portes: o.portes ? path.resolve(o.portes) : '', journal: o.journal ? path.resolve(o.journal) : '', pause: o.pause ? path.resolve(o.pause) : '' });
  let tampon = '', enVol = 0, finEntree = false;
  const ecrire = r => { if (r) process.stdout.write(JSON.stringify(r) + '\n'); };
  const finir = () => { if (finEntree && !enVol) process.exit(0); };
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => {
    tampon += d; let i;
    while ((i = tampon.indexOf('\n')) >= 0) {
      const l = tampon.slice(0, i).trim(); tampon = tampon.slice(i + 1); if (!l) continue;
      let m; try { m = JSON.parse(l); } catch { ecrire({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON illisible' } }); continue; }
      enVol++; srv.traiter(m).then(ecrire, e => ecrire({ jsonrpc: '2.0', id: m.id ?? null, error: { code: -32603, message: masquer(e.message) } })).finally(() => { enVol--; finir(); });
    }
  });
  process.stdin.on('end', () => { finEntree = true; finir(); });
}
