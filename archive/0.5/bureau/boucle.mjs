// ecomanita 0.5.0 — LA BOUCLE : un seul moteur pour tous les agents (المفتّش، البوصلة، الجاسوس…).
// Chaque agent = un contrat (agents/<id>/agent.json) + six fonctions (agents/<id>/agent.mjs) :
//   lire() · prerequis() · executer() · verifier() · rapport() · porte()
// Un CYCLE : lire → prérequis (manque : UNE question, la boucle s'arrête jusqu'à la réponse) → exécuter (une écriture :
// la carte « نعم », la boucle s'arrête) → vérifier (relire ce qui a été écrit) → carnet + rapport (loi de forme) → la porte
// (franchie : carte du القائد, « نعم », puis « fini » et les agents suivants s'ouvrent ; sinon la prochaine échéance de la cadence).
//
// La sûreté :
//  - l'état de chaque agent est écrit après CHAQUE pas (<maison>/carnet/etat/<id>.json) : le bureau s'éteint et se rallume,
//    l'agent reprend au pas où il s'était arrêté ;
//  - une écriture porte une CLÉ (agent + outil + entrée) : le même cycle rejoué n'écrit jamais deux fois ;
//  - la même erreur trois fois de suite → « bloque » + un message ; un plafond de cycles par jour et par agent ;
//  - « حبس » arrête un agent à tout moment, « حبس الكل » les arrête tous ; « شعّل » les rallume ;
//  - aucune écriture sans « نعم » : connecteur.ecrire() refuse hors du chemin de la carte acceptée ;
//  - aucun agent ne tourne sans dire au client ce qu'il fait (sauf la ronde silencieuse du الحارس, qui parle quand il y a un problème).
// Les messages passent par telegram.envoyer (la loi de forme). Code original « ecom manita ».
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fautesDeForme } from './telegram.mjs';
import { jsonBrut, couper } from './inspecteur.mjs';
import * as cerveau from './boussala/pont.mjs';
import * as regles from './regles-masar.mjs';
import { ouvrirProduits } from './fiche-produit.mjs';

export const ETATS = ['repos', 'en_cours', 'attend_reponse', 'attend_naam', 'bloque', 'fini'];
export const PAS = ['lire', 'prerequis', 'executer', 'verifier', 'rapport', 'porte'];
export const BOUTONS = { naam: 'نعم', la: 'لا', lancer: 'لانسي', hbes: 'حبس', kammelt: 'كمّلت', nadirha: 'نديرها أنا؟' };
const ECRITURES = /^(create|update|delete|set|adjust|add|assign|confirm|cancel|dispatch|deliver|return|schedule|publish|pause|resume|apply|upload|import|remove|move|save|detach|rename|restore|toggle|discard|propose|ads_create|ads_update|ads_activate|ads_creative_upload|ads_delete)/;
/** Ce qu'AUCUN agent n'écrit, jamais (même avec « نعم ») : c'est la main du client. */
export const JAMAIS_ECRIT = ['prix_retour', 'wallets', 'liaison_pub', 'tokens', 'mots_de_passe'];
const MOTS_INTERDITS = /retour|wallet|token|password|finance_transaction|billing|domain/i;
const CADENCES = ['evenement', 'heures', 'hebdo', 'horaire'];
const arabe = s => /[؀-ۿ]/.test(String(s || ''));
/** Une ligne arabe trop longue se plie mot par mot (36 caractères) ; une ligne de chiffres reste telle quelle (l'agent la tient courte). */
export const plier = lignes => lignes.flatMap(l => (arabe(l) && !/^https?:/.test(l) && l.length > 36 ? couper(l) : [l]));

/** Le contrat d'un agent (agent.json) → la liste de ses fautes ([] = valide). */
export function validerContrat(c) {
  const F = [];
  if (!c || typeof c !== 'object') return ['contrat absent'];
  if (!/^[a-z][a-z_]*$/.test(c.id || '')) F.push('id');
  if (!arabe(c.nom_ar)) F.push('nom_ar (en arabe)');
  if (!Array.isArray(c.declencheurs) || !c.declencheurs.length) F.push('declencheurs');
  if (!c.cadence || !CADENCES.includes(c.cadence.type)) F.push('cadence.type');
  if (c.cadence && c.cadence.type === 'heures' && !(Array.isArray(c.cadence.heures) && c.cadence.heures.every(h => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)))) F.push('cadence.heures');
  if (c.cadence && c.cadence.type === 'hebdo' && !(Number.isInteger(c.cadence.jour) && c.cadence.jour >= 0 && c.cadence.jour <= 6)) F.push('cadence.jour');
  if (!Array.isArray(c.questions)) F.push('questions');
  for (const q of c.questions || []) {
    if (!q.id || !arabe(q.ar)) F.push(`question ${q.id || '?'} : id et texte arabe`);
    if (/\d/.test(q.ar || '')) F.push(`question ${q.id} : un chiffre dans la ligne arabe`);
    if (/(صور|تصويرة|كابتور|capture|photo)/i.test(q.ar || '')) F.push(`question ${q.id} : on ne demande pas de photo`);
  }
  for (const k of ['prerequis_depart', 'prerequis_avancer', 'outils_lecture', 'outils_ecriture_avec_naam', 'interdit']) if (!Array.isArray(c[k])) F.push(k);
  for (const o of c.outils_lecture || []) { const [cle, nom] = String(o).split('.'); if (!cle || !nom) F.push(`outil ${o} : clé.outil`); else if (ECRITURES.test(nom)) F.push(`outil d'écriture en lecture : ${o}`); }
  for (const o of c.outils_ecriture_avec_naam || []) if (MOTS_INTERDITS.test(o)) F.push(`écriture interdite : ${o}`);
  if (!['prix_retour', 'wallets', 'tokens'].every(x => (c.interdit || []).includes(x))) F.push('interdit : prix_retour, wallets, tokens au moins');
  if (!c.sortie || c.sortie.carnet !== `etat/${c.id}.json` || !arabe(c.sortie.rapport)) F.push('sortie (carnet etat/<id>.json + nom du rapport)');
  if (!c.porte || (c.porte.id !== null && typeof c.porte.id !== 'string') || !Array.isArray(c.porte.debloque)) F.push('porte');
  if (!c.boucle || !(c.boucle.max_iterations_jour > 0) || !(c.boucle.meme_erreur_max > 0)) F.push('boucle');
  return F;
}

/** La prochaine échéance d'une cadence (ms), ou null (cadence « evenement » : seulement sur déclencheur). */
export function prochaineEcheance(cadence, depuis = Date.now()) {
  if (!cadence) return null;
  if (cadence.type === 'horaire') { const p = (cadence.minutes || 60) * 60000; return Math.floor(depuis / p) * p + p; }
  const heures = cadence.type === 'hebdo' ? [cadence.heure || '09:00'] : cadence.type === 'heures' ? cadence.heures : null;
  if (!heures) return null;
  const jours = cadence.type === 'hebdo' ? [cadence.jour] : (cadence.jours || [0, 1, 2, 3, 4, 5, 6]);
  let best = null;
  for (let i = 0; i < 8; i++) for (const h of heures) {
    const [hh, mm] = h.split(':').map(Number);
    const d = new Date(depuis); d.setDate(d.getDate() + i); d.setHours(hh, mm, 0, 0);
    if (d.getTime() > depuis && jours.includes(d.getDay()) && (best === null || d.getTime() < best)) best = d.getTime();
  }
  return best;
}

const cleEcriture = (agent, outil, entree) => crypto.createHash('sha1').update(JSON.stringify([agent, outil, entree])).digest('hex').slice(0, 12);
const jourDe = t => new Date(t).toISOString().slice(0, 10);
const etatNeuf = id => ({ id, etat: 'repos', pas: null, iteration: 0, jour: null, iterationsJour: 0, erreur: null, question: null, carte: null, cartes: {},
  reponses: {}, lecture: null, resultat: null, faits: {}, porteFranchie: false, prochaine: null, arrete: false, bloqueRaison: null, dernierRapport: null, historique: [] });

/**
 * @param {object} o
 *  - maison : le dossier du client (l'état va dans <maison>/carnet/etat)
 *  - agents : [{ contrat, module }] (agents/index.mjs › chargerAgents)
 *  - telegram : () => l'objet de telegram.mjs (envoyer, …)
 *  - claude : la file unique du bureau (serveur.mjs › claudeChaine) — un tour à la fois
 *  - prerequisCommuns : { nom: ctx => true | false | { ok, ar, question } } (connecteur_tassyir, connecteur_meta, cerveau…)
 *  - reglages : () => les réglages du client (taux, couts…) ; horloge : () => ms ; journal : texte => void
 */
export function creerBoucle({ maison, agents = [], telegram = () => null, claude = null, prerequisCommuns = {}, reglages = () => ({}), horloge = () => Date.now(), journal = () => {} }) {
  const dossier = path.join(maison, 'carnet', 'etat');
  fs.mkdirSync(dossier, { recursive: true });
  const parId = new Map(agents.map(a => [a.contrat.id, a]));
  const verrous = new Map();
  const produits = ouvrirProduits(maison);
  const fichier = id => path.join(dossier, `${id}.json`);
  const FICHIER_PORTES = path.join(dossier, '_portes.json');
  const FICHIER_BOITE = path.join(dossier, '_boite.jsonl');
  const lireJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  const charger = id => ({ ...etatNeuf(id), ...lireJ(fichier(id), {}) });
  const sauver = st => { const t = fichier(st.id) + '.tmp'; fs.writeFileSync(t, JSON.stringify(st, null, 1)); fs.renameSync(t, fichier(st.id)); };
  const portes = () => lireJ(FICHIER_PORTES, {});
  const histo = (st, quoi) => { st.historique = [...(st.historique || []), { t: new Date(horloge()).toISOString(), quoi }].slice(-40); };
  // le bureau s'est éteint PENDANT un cycle : l'agent n'est plus « en_cours » (personne ne le fait tourner) ; il garde son pas,
  // et l'horloge le reprend à la minute suivante, au pas où il s'était arrêté
  for (const a of agents) { const st = charger(a.contrat.id); if (st.etat === 'en_cours') { st.etat = 'repos'; st.prochaine = horloge(); histo(st, 'كمّل من بعد الانقطاع'); sauver(st); } }

  /** Un message au client : la première ligne dit QUI parle (« 🔍 المفتّش »). Sans Telegram, il va dans la boîte (la page le montre). */
  async function dire(id, lignes, { boutons = null } = {}) {
    const a = parId.get(id); const tete = `${a?.contrat.emoji || '•'} ${a?.contrat.nom_ar || id}`;
    let L = Array.isArray(lignes) ? lignes.flat().filter(x => x !== null && x !== undefined) : String(lignes).split('\n');
    if (L[0] !== tete) L = [tete, ...L];
    const texte = plier(L.flatMap(l => String(l).split('\n'))).join('\n');
    const fautes = fautesDeForme(texte);
    fs.appendFileSync(FICHIER_BOITE, JSON.stringify({ t: new Date(horloge()).toISOString(), agent: id, texte, boutons: boutons ? boutons.flat().map(b => b.texte) : [], fautes }) + '\n');
    if (fautes.length) { journal(`boucle ${id} : message refusé par la loi de forme — ${fautes.join(' ; ')}`); return { envoye: false, fautes }; }
    const tg = telegram();
    if (!tg || !tg.etat || !tg.etat().configure) return { envoye: false, fautes: ['telegram non configuré'] };
    const r = await tg.envoyer(texte, { boutons });
    if (!r.envoye) journal(`boucle ${id} : message non envoyé — ${(r.fautes || []).join(' ; ')}`);
    return r;
  }
  const bouton = (id, action, ref = '') => ({ texte: BOUTONS[action] || action, data: `b:${id}:${action}${ref ? ':' + ref : ''}` });

  /** Le connecteur d'un agent : lecture libre (dans SA liste) ; écriture SEULEMENT avec le jeton d'une carte « نعم » acceptée. */
  function connecteurDe(a, st, jetonNaam = null) {
    const c = a.contrat;
    return {
      async lire(appels, { message = '' } = {}) {
        for (const x of appels) if (!c.outils_lecture.includes(x.outil)) throw new Error(`outil hors contrat : ${x.outil}`);
        if (!claude) throw Object.assign(new Error('claude absent'), { connecteur: true });
        const r = await claude({ systeme: `Tu es ${c.id} (${c.nom_ar}) du bureau ecom manita. Tu LIS seulement. Appelle exactement les outils demandés et rends { lu: [...] }.`,
          message: message || `Appelle, dans l'ordre : ${appels.map(x => `${x.outil.split('.')[1]} ${JSON.stringify(x.entree || {})}`).join(' ; ')}. Ne calcule rien.`,
          outils: [...new Set(appels.map(x => x.outil))], schema: { type: 'object', properties: { lu: { type: 'array', items: { type: 'string' } } }, required: ['lu'] } });
        const brut = {};
        for (const ap of r.appels || []) { if (!ap || ap.erreur) continue; const nom = String(ap.nom || '').split('__').pop(); if (ECRITURES.test(nom)) continue; const v = jsonBrut(ap.sortie); if (v !== null) (brut[nom] ||= []).push({ entree: ap.entree || {}, v }); }
        return brut; // la deuxième méthode de 0.4.x : seuls les chiffres de la réponse BRUTE comptent
      },
      async ecrire(outil, entree) {
        const carte = !jetonNaam ? null : st.carte && st.carte.jeton === jetonNaam ? st.carte : Object.values(st.cartes || {}).find(x => x.jeton === jetonNaam) || null;
        if (!carte || carte.outil !== outil) throw Object.assign(new Error('كتابة بلا «نعم» : refusée'), { sansNaam: true });
        if (!c.outils_ecriture_avec_naam.includes(outil)) throw new Error(`écriture hors contrat : ${outil}`);
        if (!claude) throw new Error('claude absent');
        const r = await claude({ systeme: `Tu es ${c.id} (${c.nom_ar}). Le client a dit « نعم » à CE changement exact, rien d'autre. Fais UN appel, puis rends { lu: [...] }.`,
          message: `Appelle ${outil.split('.')[1]} avec exactement : ${JSON.stringify(entree)}`, outils: [outil], schema: { type: 'object', properties: { lu: { type: 'array', items: { type: 'string' } } }, required: ['lu'] } });
        const ap = (r.appels || []).find(x => String(x.nom || '').endsWith('__' + outil.split('.')[1]) && !x.erreur);
        if (!ap) throw new Error(`l'écriture ${outil} n'a pas été faite`);
        return jsonBrut(ap.sortie);
      }
    };
  }

  function ctxDe(a, st, extra = {}) {
    return { contrat: a.contrat, st, memo: (st.memo ||= {}), reponses: st.reponses, lecture: st.lecture, resultat: st.resultat, maintenant: horloge(),
      reglages: reglages(), cerveau, regles, produits, portes: portes(), journal: t => journal(`${a.contrat.id} : ${t}`),
      connecteur: connecteurDe(a, st, extra.jetonNaam || null), dire: (l, o) => dire(a.contrat.id, l, o), bouton: (act, ref) => bouton(a.contrat.id, act, ref),
      autres: () => agents.filter(x => x !== a).map(x => ({ contrat: x.contrat, etat: charger(x.contrat.id), module: x.module, ctx: () => ctxDe(x, charger(x.contrat.id)) })),
      boucle: api, ...extra };
  }

  /** Les prérequis : ceux du contrat (communs ou de l'agent) puis ceux que l'agent ajoute. → { manque: [{id, ar, question?}] } */
  async function evaluerPrerequis(a, st, liste, ctx) {
    const manque = [];
    for (const nom of liste) {
      let r;
      if (nom.startsWith('porte:')) r = !!portes()[nom.slice(6)];
      else if (prerequisCommuns[nom]) r = await prerequisCommuns[nom](ctx);
      else if (a.module.prerequisNommes && a.module.prerequisNommes[nom]) r = await a.module.prerequisNommes[nom](ctx);
      else r = { ok: false, ar: `شرط ما نعرفوش : ${nom}` };
      const o = typeof r === 'object' && r !== null ? r : { ok: !!r };
      if (!o.ok) manque.push({ id: nom, ar: o.ar || nom, question: o.question || null });
    }
    return manque;
  }

  async function demander(a, st, q, depuis) {
    st.question = { ...q, depuis, quand: horloge() }; st.etat = 'attend_reponse'; histo(st, `سؤال ${q.id}`); sauver(st);
    const boutons = (q.boutons || []).length ? [q.boutons.map((b, i) => ({ texte: String(b), data: `b:${a.contrat.id}:r:${q.id}:${i}` })), [bouton(a.contrat.id, 'hbes')]] : [[bouton(a.contrat.id, 'hbes')]];
    await dire(a.contrat.id, [...(Array.isArray(q.lignes) ? q.lignes : []), q.ar, 'جاوبني هنا برك'], { boutons });
  }

  async function erreurPas(a, st, pas, e) {
    const cle = `${pas}:${String(e.message || e).slice(0, 80)}`;
    st.erreur = st.erreur && st.erreur.cle === cle ? { cle, n: st.erreur.n + 1 } : { cle, n: 1 };
    journal(`boucle ${a.contrat.id} : ${pas} — ${e.message || e} (${st.erreur.n}/${a.contrat.boucle.meme_erreur_max})`);
    if (st.erreur.n >= a.contrat.boucle.meme_erreur_max) {
      st.etat = 'bloque'; st.bloqueRaison = { type: 'erreurs', cle }; histo(st, `bloque : ${cle}`); sauver(st);
      await dire(a.contrat.id, ['حبست : نفس الغلطة ثلاث مرات', e.cerveau ? 'العقل ما راهوش' : 'لازم واحد يشوف علاش', 'شوف الجورنال في المكتب']);
      return { fait: false, raison: 'bloque' };
    }
    st.etat = 'repos'; st.prochaine = horloge() + 15 * 60000; sauver(st);
    return { fait: false, raison: 'erreur', pas };
  }

  /** Un cycle, repris au pas gardé. Jamais deux en même temps pour le même agent (verrou). */
  async function cycle(id, { declencheur = 'manuel', humain = false, point = null, texte = null } = {}) {
    const prec = verrous.get(id) || Promise.resolve();
    const p = prec.then(() => cycleSeul(id, { declencheur, humain, point, texte })).catch(e => { journal(`boucle ${id} : ${e.message}`); return { fait: false, raison: 'exception' }; });
    verrous.set(id, p); return p;
  }
  async function cycleSeul(id, { declencheur, humain, point, texte, jetonNaam = null, reprise = false }) {
    const a = parId.get(id); if (!a) return { fait: false, raison: 'inconnu' };
    const st = charger(id); const c = a.contrat; const now = horloge();
    if (st.arrete) return { fait: false, raison: 'arrete' };
    if (!reprise) {
      if (st.etat === 'attend_reponse' || st.etat === 'attend_naam') return { fait: false, raison: st.etat };
      if (st.etat === 'bloque') { if (!humain) return { fait: false, raison: 'bloque' }; st.erreur = null; st.bloqueRaison = null; }
      if (st.jour !== jourDe(now)) { st.jour = jourDe(now); st.iterationsJour = 0; }
      if (st.iterationsJour >= c.boucle.max_iterations_jour) { sauver(st); return { fait: false, raison: 'max_jour' }; }
      st.iterationsJour++; st.iteration++; st.declencheur = declencheur; st.point = point; st.texte = texte; st.etat = 'en_cours';
      if (!st.pas || st.pas === 'fin') st.pas = 'lire';
      histo(st, `دورة ${st.iteration} (${declencheur})`); sauver(st);
      if (humain || !c.cadence.silencieux) await dire(id, [c.annonce || 'راني نخدم دركا', 'نبعتلك كي نكمل']);
    }
    const ctx = ctxDe(a, st, { declencheur: st.declencheur, point: st.point, texte: st.texte, jetonNaam });
    const m = a.module;
    while (st.pas && st.pas !== 'fin') {
      const pas = st.pas;
      try {
        if (pas === 'lire') { st.lecture = m.lire ? (await m.lire(ctx)) ?? {} : {}; ctx.lecture = st.lecture; st.pas = 'prerequis'; }
        else if (pas === 'prerequis') {
          const manque = await evaluerPrerequis(a, st, c.prerequis_depart, ctx);
          const extra = m.prerequis ? (await m.prerequis(ctx)) || {} : {};
          const tout = [...manque, ...(extra.manque || [])];
          const q = extra.question || (tout.find(x => x.question) || {}).question;
          if (q) { st.pas = 'prerequis'; await demander(a, st, q, 'prerequis'); return { fait: false, raison: 'question', question: q.id }; }
          if (tout.length) {
            st.etat = 'bloque'; st.bloqueRaison = { type: 'prerequis', manque: tout.map(x => x.id) }; st.pas = 'lire'; histo(st, `ناقص : ${tout.map(x => x.id).join(', ')}`); sauver(st);
            await dire(id, ['ما نقدرش نبدا، ناقص :', ...tout.map(x => `- ${x.ar}`), 'كي تصلّحها ابعثلي نفس الكلمة']);
            return { fait: false, raison: 'prerequis', manque: tout.map(x => x.id) };
          }
          st.pas = 'executer';
        }
        else if (pas === 'executer') {
          const r = (await m.executer(ctx)) || {};
          st.resultat = r.resultat ?? r; ctx.resultat = st.resultat;
          if (r.question) { st.pas = 'executer'; await demander(a, st, r.question, 'executer'); return { fait: false, raison: 'question', question: r.question.id }; }
          if (!r.ecriture && Array.isArray(r.ecritures) && r.ecritures.length) r.ecriture = r.ecritures[0];
          if (r.ecriture) {
            const cle = cleEcriture(id, r.ecriture.outil, r.ecriture.entree);
            if (st.faits[cle]) { st.pas = 'verifier'; }
            else if (c.boucle.cartes_paralleles) {
              // le القائد : une carte par modèle, sans arrêter le cycle (la lecture de 08:00 ne reste jamais bloquée)
              for (const e of r.ecritures || [r.ecriture]) {
                const kc = cleEcriture(id, e.outil, e.entree);
                const k = { ref: kc.slice(0, 8), cle: kc, type: e.type || 'ecriture', outil: e.outil, entree: e.entree, ar: e.ar || [], meta: e.meta || null, jeton: crypto.randomBytes(8).toString('hex'), quand: now };
                if (st.faits[kc] || st.cartes[k.ref]) continue;
                st.cartes[k.ref] = k; histo(st, `بطاقة ${k.type} ${k.outil}`); sauver(st);
                await dire(id, [...k.ar, 'نكتبها؟'], { boutons: [[bouton(id, 'naam', k.ref), bouton(id, 'la', k.ref)]] });
              }
              st.pas = 'rapport';
            }
            else {
              st.carte = { ref: cle.slice(0, 8), cle, type: r.ecriture.type || 'ecriture', outil: r.ecriture.outil, entree: r.ecriture.entree, ar: r.ecriture.ar || [], jeton: crypto.randomBytes(8).toString('hex'), quand: now };
              st.etat = 'attend_naam'; st.pas = 'ecrire'; histo(st, `بطاقة ${st.carte.type} ${r.ecriture.outil}`); sauver(st);
              const oui = st.carte.type === 'lancer' ? 'lancer' : 'naam';
              await dire(id, [...st.carte.ar, st.carte.type === 'lancer' ? 'نطلقو؟ اضغط «لانسي»' : 'نكتبها؟'], { boutons: [[bouton(id, oui, st.carte.ref), bouton(id, 'la', st.carte.ref)], [bouton(id, 'hbes')]] });
              return { fait: false, raison: 'attend_naam', carte: st.carte.ref };
            }
          } else st.pas = 'verifier';
        }
        else if (pas === 'ecrire') {
          // seulement ici, et seulement avec le jeton de la carte acceptée
          if (!jetonNaam) { st.etat = 'attend_naam'; sauver(st); return { fait: false, raison: 'attend_naam' }; }
          const sortie = m.ecrire ? await m.ecrire(ctx, st.carte) : await ctx.connecteur.ecrire(st.carte.outil, st.carte.entree);
          st.faits[st.carte.cle] = { quand: horloge(), outil: st.carte.outil };
          st.ecrit = { outil: st.carte.outil, entree: st.carte.entree, sortie: sortie ?? null }; ctx.ecrit = st.ecrit;
          histo(st, `كتب ${st.carte.outil}`); st.carte = null; st.pas = 'verifier';
        }
        else if (pas === 'verifier') {
          const v = m.verifier ? (await m.verifier({ ...ctx, ecrit: st.ecrit || null })) : { ok: true };
          if (v && v.ok === false) throw new Error(`vérification : ${v.ar || v.detail || 'ما تأكّدتش'}`);
          st.verification = v || { ok: true }; st.ecrit = null; st.pas = 'rapport';
        }
        else if (pas === 'rapport') {
          const t = m.rapport ? await m.rapport(ctx) : null;
          if (t) {
            const lignes = Array.isArray(t) ? t : String(t).split('\n');
            const tete = `${c.emoji || '•'} ${c.nom_ar}`;
            const complet = plier(lignes[0] === tete ? lignes : [tete, ...lignes]).join('\n');
            const f = fautesDeForme(complet); if (f.length) throw new Error('loi de forme : ' + f.join(' ; '));
            st.dernierRapport = { quand: horloge(), texte: complet };
            fs.mkdirSync(path.join(maison, 'carnet', 'rapports'), { recursive: true });
            fs.appendFileSync(path.join(maison, 'carnet', 'rapports', `${id}.md`), `\n## ${new Date(horloge()).toISOString()} · ${c.sortie.rapport}\n${complet}\n`);
            sauver(st);
            const boutons = m.boutonsRapport ? m.boutonsRapport(ctx) : null;
            await dire(id, complet, { boutons });
          }
          st.pas = 'porte';
        }
        else if (pas === 'porte') {
          const p = m.porte ? (await m.porte(ctx)) || { ouverte: false } : { ouverte: false };
          const manqueAvancer = p.ouverte ? await evaluerPrerequis(a, st, c.prerequis_avancer, ctx) : [];
          st.porteLue = { ouverte: !!p.ouverte && !manqueAvancer.length, manque: manqueAvancer.map(x => x.id), ar: p.ar || null };
          if (c.porte.id && st.porteLue.ouverte && !st.porteFranchie && !portes()[c.porte.id]) {
            // la porte se lit ouverte : JAMAIS franchie seule. Carte du القائد, « نعم » du client.
            st.carte = { ref: 'p' + crypto.randomBytes(3).toString('hex'), cle: 'porte:' + c.porte.id, type: 'porte', outil: null, entree: null, jeton: crypto.randomBytes(8).toString('hex'), quand: now };
            st.etat = 'attend_naam'; st.pas = 'fin'; histo(st, `الباب ${c.porte.id} : بطاقة للقائد`); sauver(st);
            const qaid = parId.get('qaid') ? 'qaid' : id;
            await dire(qaid, [`${c.nom_ar} حلّ الباب تاعو`, ...(p.lignes || []), 'نفوتو للمرحلة الجاية؟'], { boutons: [[{ texte: BOUTONS.naam, data: `b:${id}:naam:${st.carte.ref}` }, { texte: BOUTONS.la, data: `b:${id}:la:${st.carte.ref}` }]] });
            return { fait: true, raison: 'porte_carte' };
          }
          st.pas = 'fin';
        }
        else { st.pas = 'fin'; }
        st.erreur = null; sauver(st);
      } catch (e) { return erreurPas(a, st, pas, e); }
    }
    st.etat = st.porteFranchie || (c.porte.id && portes()[c.porte.id]) ? 'fini' : 'repos';
    st.prochaine = prochaineEcheance(c.cadence, horloge()); st.pas = null; sauver(st);
    return { fait: true, raison: 'fin', etat: st.etat };
  }

  /** Une réponse du client à la question ouverte (texte libre ou bouton). Rend false si l'agent n'attendait pas cette réponse. */
  async function repondre(id, questionId, valeur) {
    const a = parId.get(id); if (!a) return false;
    const prec = verrous.get(id) || Promise.resolve();
    const p = prec.then(async () => {
      const st = charger(id);
      if (st.arrete || st.etat !== 'attend_reponse' || !st.question || (questionId && st.question.id !== questionId)) return false;
      const q = st.question;
      const v = a.module.surReponse ? await a.module.surReponse(ctxDe(a, st), q.id, valeur) : { ok: true, valeur };
      if (v && v.ok === false) { await demander(a, st, { ...q, lignes: [v.ar || 'ما فهمتش الجواب'] }, q.depuis); return true; }
      st.reponses[q.id] = v && 'valeur' in v ? v.valeur : valeur; st.question = null; st.etat = 'en_cours'; st.pas = q.depuis === 'executer' ? 'executer' : 'prerequis';
      histo(st, `جواب ${q.id}`); sauver(st);
      await cycleSeul(id, { declencheur: 'reponse', humain: true, reprise: true });
      return true;
    });
    verrous.set(id, p.catch(() => {})); return p;
  }

  /** « نعم » / « لانسي » / « لا » sur la carte ouverte d'un agent. */
  async function trancher(id, ref, oui) {
    const a = parId.get(id); if (!a) return { ok: false, raison: 'inconnu' };
    const prec = verrous.get(id) || Promise.resolve();
    const p = prec.then(async () => {
      const st = charger(id);
      if (st.arrete) return { ok: false, raison: 'arrete' };
      if (st.cartes && st.cartes[ref]) return trancherParallele(a, st, st.cartes[ref], oui);
      if (!st.carte || st.carte.ref !== ref || st.etat !== 'attend_naam') return { ok: false, raison: 'carte_fermee' };
      const carte = st.carte;
      if (carte.type === 'porte') {
        st.carte = null;
        if (oui) {
          const P = portes(); P[a.contrat.porte.id] = { quand: new Date(horloge()).toISOString(), agent: id }; fs.writeFileSync(FICHIER_PORTES, JSON.stringify(P, null, 1));
          st.porteFranchie = true; st.etat = 'fini'; histo(st, `الباب ${a.contrat.porte.id} تحل («نعم»)`); sauver(st);
          const ouverts = a.contrat.porte.debloque.map(d => parId.get(d)?.contrat.nom_ar).filter(Boolean);
          await dire(parId.get('qaid') ? 'qaid' : id, [`الباب تاع ${a.contrat.nom_ar} تحل`, ouverts.length ? 'الوكلاء اللي يبداو دركا :' : 'المرحلة الجاية مفتوحة', ...ouverts.map(n => `- ${n}`)]);
          if (api.surPorte) await api.surPorte(id, a.contrat.porte);
        } else { st.etat = 'repos'; st.porteRefusee = horloge(); histo(st, 'الباب : «لا»'); st.prochaine = prochaineEcheance(a.contrat.cadence, horloge()); sauver(st); await dire(id, ['مليح، نبقاو هنا', 'كي تحب نفوتو ابعثلي']); }
        return { ok: true, porte: oui };
      }
      if (!oui) {
        st.carte = null; st.etat = 'en_cours'; st.pas = 'rapport'; st.refus = { outil: carte.outil, quand: horloge() }; histo(st, `«لا» على ${carte.outil}`); sauver(st);
        await cycleSeul(id, { declencheur: 'refus', humain: true, reprise: true });
        return { ok: true, ecrit: false };
      }
      st.etat = 'en_cours'; sauver(st);
      const r = await cycleSeul(id, { declencheur: 'naam', humain: true, reprise: true, jetonNaam: carte.jeton });
      return { ok: true, ecrit: true, r };
    });
    verrous.set(id, p.catch(() => {})); return p;
  }

  /** Une carte « parallèle » (القائد) : « نعم » → l'écriture avec son jeton, puis la relecture ; « لا » → rien d'écrit. */
  async function trancherParallele(a, st, carte, oui) {
    const id = a.contrat.id;
    delete st.cartes[carte.ref];
    if (!oui) { histo(st, `«لا» على ${carte.outil}`); sauver(st); if (a.module.apresRefus) await a.module.apresRefus(ctxDe(a, st), carte); await dire(id, ['مليح، ما كتبت والو']); return { ok: true, ecrit: false }; }
    if (st.faits[carte.cle]) { sauver(st); return { ok: true, ecrit: false, raison: 'deja' }; }
    st.cartes[carte.ref] = carte; // le jeton doit être visible du connecteur pendant l'écriture
    const ctx = ctxDe(a, st, { jetonNaam: carte.jeton });
    try {
      const sortie = a.module.ecrire ? await a.module.ecrire(ctx, carte) : await ctx.connecteur.ecrire(carte.outil, carte.entree);
      st.faits[carte.cle] = { quand: horloge(), outil: carte.outil };
      delete st.cartes[carte.ref]; sauver(st);
      const v = a.module.verifier ? await a.module.verifier({ ...ctx, ecrit: { outil: carte.outil, entree: carte.entree, sortie, carte } }) : { ok: true };
      if (v && v.ok === false) { histo(st, `ما تأكّدتش ${carte.outil}`); sauver(st); await dire(id, ['كتبت بصح ما تأكّدتش', v.ar || 'عاود اقرا في تسيير']); return { ok: false, ecrit: true, verifie: false }; }
      histo(st, `كتب ${carte.outil}`); sauver(st);
      await dire(id, v && v.lignes ? v.lignes : ['كتبتها وعاودت قريتها', 'كلش صحيح']);
      return { ok: true, ecrit: true, verifie: true };
    } catch (e) {
      delete st.cartes[carte.ref]; sauver(st); journal(`boucle ${id} : écriture refusée — ${e.message}`);
      await dire(id, ['ما كتبتش', String(e.message).replace(/[0-9]/g, '').slice(0, 30) || 'غلطة']);
      return { ok: false, ecrit: false, raison: e.message };
    }
  }

  /** Une proposition pour un agent (le القائد : « حطّ التاغ VALIDE ») : gardée dans sa mémoire, puis un cycle. */
  async function proposer(id, proposition) {
    const a = parId.get(id); if (!a) return { ok: false, raison: 'inconnu' };
    const st = charger(id); st.memo = st.memo || {}; st.memo.propositions = [...(st.memo.propositions || []), { ...proposition, quand: horloge() }]; sauver(st);
    return cycle(id, { declencheur: 'proposition' });
  }

  async function arreter(id) {
    const ids = id ? [id] : [...parId.keys()];
    for (const x of ids) { const st = charger(x); st.arrete = true; histo(st, 'حبس'); sauver(st); }
    return ids;
  }
  async function rallumer(id) {
    const ids = id ? [id] : [...parId.keys()];
    for (const x of ids) { const st = charger(x); st.arrete = false; if (st.etat === 'en_cours') st.etat = 'repos'; histo(st, 'شعّل'); sauver(st); }
    return ids;
  }

  /** L'horloge : les agents dont l'échéance est passée tournent (un cycle chacun). */
  async function tick(maintenant = horloge()) {
    const lances = [];
    for (const [id, a] of parId) {
      const st = charger(id);
      if (st.arrete || ['attend_reponse', 'attend_naam', 'bloque', 'en_cours'].includes(st.etat)) continue;
      const enSuspens = !!st.pas && st.pas !== 'fin'; // un cycle coupé (ou une erreur à réessayer) reprend, même sans cadence
      if (a.contrat.cadence.type === 'evenement' && !enSuspens) continue;
      if ((st.prochaine === null || st.prochaine === undefined) && !enSuspens) { st.prochaine = prochaineEcheance(a.contrat.cadence, maintenant); sauver(st); continue; }
      if (st.prochaine === null || st.prochaine === undefined || st.prochaine <= maintenant) { lances.push(id); await cycle(id, { declencheur: enSuspens ? 'reprise' : 'horloge' }); }
    }
    return lances;
  }

  /** Les boutons « b:<agent>:<action>[:ref…] ». Rend { pris, … }. */
  async function surBouton(data) {
    const m = /^b:([a-z_]+):([a-z]+)(?::(.+))?$/.exec(String(data || ''));
    if (!m) return { pris: false };
    const [, id, action, ref] = m;
    if (!parId.has(id)) return { pris: true, ok: false, raison: 'inconnu' };
    if (action === 'naam' || action === 'lancer') return { pris: true, ...(await trancher(id, ref, true)) };
    if (action === 'la') return { pris: true, ...(await trancher(id, ref, false)) };
    if (action === 'hbes') { await arreter(id); await dire(id, ['حبست', 'باش نعاود نخدم ابعثلي شعّل']); return { pris: true, ok: true }; }
    if (action === 'r') { const [qid, i] = String(ref || '').split(':'); const st = charger(id); const q = st.question; const v = q && q.id === qid && q.boutons ? q.boutons[+i] : undefined; return { pris: true, ok: v !== undefined && await repondre(id, qid, v) }; }
    if (action === 'kammelt') return { pris: true, ...(await cycle(id, { declencheur: 'kammelt', humain: true, point: ref || null })) };
    if (action === 'nadirha') return { pris: true, ...(await cycle(id, { declencheur: 'nadirha', humain: true, point: ref || null })) };
    return { pris: true, ok: false };
  }

  const api = {
    cycle, repondre, trancher, proposer, arreter, rallumer, tick, surBouton, dire, produits,
    etat: id => charger(id), etats: () => [...parId.keys()].map(charger), portes,
    agents: () => agents.map(a => a.contrat), agent: id => parId.get(id) || null,
    /** L'agent qui attend une réponse en texte libre (la question la plus récente). */
    enAttenteDeReponse: () => [...parId.keys()].map(charger).filter(s => s.etat === 'attend_reponse' && !s.arrete).sort((x, y) => (y.question?.quand || 0) - (x.question?.quand || 0))[0] || null,
    boite: (n = 50) => { try { return fs.readFileSync(FICHIER_BOITE, 'utf8').trim().split('\n').slice(-n).map(l => JSON.parse(l)); } catch { return []; } },
    ctx: id => { const a = parId.get(id); return a ? ctxDe(a, charger(id)) : null; },
    surPorte: null
  };
  return api;
}
