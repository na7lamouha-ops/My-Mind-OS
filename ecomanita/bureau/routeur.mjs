// ecom manita — LE ROUTEUR et l'assemblage des prompts.
// Le manager attribue une phrase à un département et un poste (un appel JSON bon marché),
// puis le prompt système de l'agent est empilé dans un ordre fixe : identité → skill du département →
// règles de la maison → leçons → notes du carnet choisies pour la tâche → règle des outils.
import fs from 'node:fs';
import path from 'node:path';
import { tour, jsonDans } from './moteur.mjs';
import { notesPourTache } from './carnet.mjs';

export function lireSkill(racine, chemin) {
  if (!chemin) return '';
  try { return fs.readFileSync(path.resolve(racine, chemin), 'utf8'); } catch { return ''; }
}

export const REGLES_MAISON = `RÈGLES DE LA MAISON (ecom manita) — elles passent avant tout :
- Tu lis librement. Tu n'envoies, ne publies, ne paies, ne supprimes et ne modifies RIEN hors de cette machine sauf si la tâche le demande explicitement, mot pour mot.
- Tout ce que tu crées chez Meta naît EN PAUSE. Tu ne lances rien tant que le client n'a pas écrit le mot « lance ».
- Tu ne demandes jamais un mot de passe, une clé, un code SMS, une carte bancaire. Tu ne les écris jamais.
- Aucun chiffre d'argent ne sort de ta tête : il sort d'un outil (la boussole). Tout montant se donne en dinars ET en dollars.
- Le ROAS se lit UNIQUEMENT sur les colis livrés ; un colis en route se compte au pire des cas, trois sur dix arrivent.
- Tu ne promets jamais un résultat de vente.
- Ce que tu écris pour le client est en darija ALGÉRIENNE, jamais marocaine : interdits « ديال » (écris « تاع »), « هاد » (écris « هاذ »), « جوج » (écris « زوج »), « تحوّس », « الكاس », « قاعهم », « دابا », « بزّاف » se dit « بزاف ». Mots de la maison : « تقلّب », « بصح », « برك », « ديما », « كيفاش », « وين », « هاذ », « دراهم ».
- AUCUN chiffre à l'intérieur d'une ligne arabe : le chiffre va sur SA propre ligne, en français. FAUX : « كاين 3 ألوان » / « السعر 5900 دج ». JUSTE : « كاين ثلاث ألوان » puis une ligne « Prix : 5 900 DA / 23 $ ».
- Avant de dire « c'est fait » : tu as relu le contenu réel, et tu écris tes SOURCES (ce que tu as lu, outil par outil). Si tu n'as pas pu lire, tu écris que tu n'as pas pu lire.
- Termine TOUJOURS ton livrable par une ligne « Sources lues : … » puis une ligne « Contrôle intégré : … » qui dit ce que tu as vérifié et comment.`;

/** La fiche du business du client (ses réglages) : ce que chaque agent doit savoir sur CE client, jamais deviné. */
export function blocFiche(fiche) {
  if (!fiche) return '';
  const l = [];
  if (fiche.nom) l.push(`business : ${fiche.nom}`);
  const c = fiche.couts || {};
  if (c.emballage != null || c.retour != null || c.livraison != null) l.push(`coûts fixes par colis (DA) : emballage ${c.emballage ?? '?'} · retour ${c.retour ?? '?'} · livraison à sa charge ${c.livraison ?? '?'}`);
  const d = fiche.declare || {};
  if (d.confirmation != null || d.livraison != null) l.push(`taux DÉCLARÉS par le client (souvenirs, pas des mesures) : confirmation ${d.confirmation ?? '?'} % · livraison ${d.livraison ?? '?'} %`);
  if (fiche.wilayas) l.push(`wilayas : ${fiche.wilayas}`);
  if (!l.length) return '\n=== FICHE DU BUSINESS : le client n\'a encore rien réglé (onglet الإعدادات) — ne devine aucun coût, demande-les au coach.';
  return '\n=== FICHE DU BUSINESS DU CLIENT (ses réglages, à utiliser tels quels) ===\n' + l.map(x => '- ' + x).join('\n');
}

export function assemblerSysteme({ racine, bureau, dept, poste, carnet, texte, lecons = [], fiche = null }) {
  const d = bureau.departements.find(x => x.id === dept) || bureau.departements[0];
  const p = (d.postes || []).find(x => x.id === poste) || d.postes[0];
  const skill = lireSkill(racine, d.skill).slice(0, 60000);
  const notes = carnet ? notesPourTache(carnet, texte, dept) : [];
  const blocs = [
    `Tu es ${p.nom} (${p.nomAr}), poste du département ${d.nom} (${d.nomAr}) du bureau « ${bureau.nom} ».`,
    `Ton département : ${d.role}`,
    `Ton poste : ${p.role}`,
    skill ? `\n=== TA SKILL (la méthode de la maison, à suivre à la lettre) ===\n${skill}` : '',
    `\n=== ${REGLES_MAISON}`,
    blocFiche(fiche),
    lecons.length ? `\n=== LEÇONS RETENUES (les corrections du client, à appliquer toujours) ===\n${lecons.map(l => '- ' + l).join('\n')}` : '',
    notes.length ? `\n=== NOTES DU CARNET utiles pour cette tâche ===\n${notes.map(n => `--- [[${n.nom}]] ${n.titre}\n${n.texte}`).join('\n\n')}` : '\n=== LE CARNET est encore vide pour ce sujet : dis-le au lieu d\'inventer.',
    `\n=== FORME DU LIVRABLE ===\nUn livrable complet, prêt à l'emploi, en darija algérienne pour le texte et en français pour les chiffres (un chiffre par ligne française). Pas de préambule. Finis par « Sources lues : » et « Contrôle intégré : ».`
  ].filter(Boolean);
  return blocs.join('\n');
}

export function systemeRouteur(bureau) {
  const deps = bureau.departements.map(d => `- ${d.id} · ${d.nom} : ${d.role}\n  postes : ${(d.postes || []).map(p => `${p.id} (${p.role})`).join(' | ')}`).join('\n');
  return `Tu es le MANAGER du bureau « ${bureau.nom} » (e-commerce COD en Algérie). Tu ne fais pas le travail : tu attribues la tâche au bon département et au bon poste, tu lui donnes un titre court, et tu dis si elle exige l'accord du client avant toute action irréversible (créer/lancer/publier/envoyer/payer/supprimer → besoin_ok = true ; lire/analyser/préparer/rédiger → false).
Départements et postes :
${deps}
Règle d'ordre de la chaîne : editeur → page → testing → (le client dit « lance ») → coach (72 h) → scaling. Une tâche qui contient un lien Google Drive de shooting va à editeur/trieur. Une question du client sur son business ou son vêtement va à coach/questions.
Réponds UNIQUEMENT par un JSON strict : {"departement":"<id>","poste":"<id>","titre":"<6 à 10 mots, en français>","besoin_ok":true|false,"pourquoi":"<une phrase>"}`;
}

/** Route une phrase. Rend {departement, poste, titre, besoinOk, pourquoi, usage, modele}. Repli : coach/questions. */
export async function router({ bureau, texte, modele = 'sonnet', dureeMaxMs = 150000, deptForce = null }) {
  const systeme = systemeRouteur(bureau);
  const message = deptForce ? `Le client a choisi le département « ${deptForce} ». Choisis le POSTE dans ce département. Tâche : ${texte}` : `Tâche : ${texte}`;
  let r;
  try { r = await tour({ message, systeme, modele, dureeMaxMs, outilsAutorises: [], web: false, chrome: false }); }
  catch (e) { return { departement: deptForce || 'coach', poste: null, titre: texte.slice(0, 60), besoinOk: true, pourquoi: 'routage impossible : ' + e.message, usage: null, modele: null, erreur: e.message }; }
  let j = {};
  try { j = jsonDans(r.texte); } catch { j = {}; }
  const d = bureau.departements.find(x => x.id === (deptForce || j.departement)) || bureau.departements.find(x => x.id === 'coach');
  const p = (d.postes || []).find(x => x.id === j.poste) || d.postes[0];
  return { departement: d.id, poste: p.id, titre: String(j.titre || texte).slice(0, 80), besoinOk: typeof j.besoin_ok === 'boolean' ? j.besoin_ok : true, pourquoi: String(j.pourquoi || ''), usage: r.usage, modele: r.modele };
}
